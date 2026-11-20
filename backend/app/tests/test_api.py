"""
Test Suite for FastAPI Endpoints.
Tests:
  - GET /health
  - GET /health/db, /health/s3, /health/full
  - POST /api/auth/register, /api/auth/login
  - CRUD /api/documents
  - Share /api/documents/{id}/share
"""

import pytest


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert data["service"] == "scoutraider-api"


def test_health_db(client):
    res = client.get("/health/db")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("ok", "error")
    assert "database" in data


def test_health_full(client):
    res = client.get("/health/full")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("ok", "degraded")
    assert "database" in data
    assert "s3" in data
    assert "environment" in data


def test_auth_register_and_login(client):
    import time
    username = f"testuser_{int(time.time())}"

    # Register
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "password123"
    })
    assert reg_res.status_code == 201
    user = reg_res.json()
    assert user["username"] == username
    assert "id" in user

    # Login
    login_res = client.post("/api/auth/login", json={
        "username": username,
        "password": "password123"
    })
    assert login_res.status_code == 200
    tokens = login_res.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"

    # Use access token
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == username


def test_documents_crud(client):
    import time
    username = f"cruduser_{int(time.time())}"

    # Register and login
    client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "password123"
    })
    login_res = client.post("/api/auth/login", json={"username": username, "password": "password123"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # Create document
    sample_json = {
        "schemaVersion": "2.0",
        "blocks": [],
        "assets": {"fonts": [], "images": {}},
        "pageLayout": {}
    }
    create_res = client.post("/api/documents", headers=headers, json={
        "title": "Test Document",
        "schema_version": "2.0",
        "json_data": sample_json,
        "page_layout": {}
    })
    assert create_res.status_code == 201
    doc = create_res.json()
    assert doc["title"] == "Test Document"
    doc_id = doc["id"]

    # List documents
    list_res = client.get("/api/documents", headers=headers)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc_id

    # Get document
    get_res = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Test Document"

    # Update document with optimistic locking
    update_res = client.put(
        f"/api/documents/{doc_id}",
        headers={**headers, "If-Match": "1"},
        json={"title": "Updated Title", "version": 1}
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["title"] == "Updated Title"
    assert updated["version"] == 2

    # Delete document
    del_res = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify deleted
    get_res2 = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert get_res2.status_code == 404


def test_share_links(client):
    import time
    # Use different timestamps to avoid collisions
    ts = int(time.time())
    owner_name = f"shareowner_{ts}"
    viewer_name = f"shareviewer_{ts+1}"
    password = "password123"

    # Create owner and login
    reg_owner = client.post("/api/auth/register", json={"username": owner_name, "email": f"{owner_name}@e.com", "password": password})
    assert reg_owner.status_code == 201, f"Register failed: {reg_owner.text}"
    owner_tokens = client.post("/api/auth/login", json={"username": owner_name, "password": password}).json()
    assert "access_token" in owner_tokens, f"Login failed: {owner_tokens}"
    h_owner = {"Authorization": f"Bearer {owner_tokens['access_token']}"}

    # Create viewer and login
    reg_viewer = client.post("/api/auth/register", json={"username": viewer_name, "email": f"{viewer_name}@e.com", "password": password})
    assert reg_viewer.status_code == 201, f"Register failed: {reg_viewer.text}"
    viewer_tokens = client.post("/api/auth/login", json={"username": viewer_name, "password": password}).json()
    assert "access_token" in viewer_tokens, f"Login failed: {viewer_tokens}"
    h_viewer = {"Authorization": f"Bearer {viewer_tokens['access_token']}"}

    # Create document
    create_res = client.post("/api/documents", headers=h_owner, json={
        "title": "Shared Doc",
        "schema_version": "2.0",
        "json_data": {"schemaVersion": "2.0", "blocks": [], "assets": {"fonts": [], "images": {}}, "pageLayout": {}},
        "page_layout": {}
    })
    doc_id = create_res.json()["id"]

    # Create share link (read)
    share_res = client.post(f"/api/documents/{doc_id}/share", headers=h_owner, json={
        "permissions": "read",
        "expires_in_days": 1
    })
    assert share_res.status_code == 200
    share_token = share_res.json()["token"]

    # Access via share token (unauthenticated)
    pub_res = client.get(f"/api/documents/shared/{share_token}")
    assert pub_res.status_code == 200
    shared = pub_res.json()
    assert shared["document"]["id"] == doc_id
    assert shared["permissions"] == "read"

    # List shares
    list_res = client.get(f"/api/documents/{doc_id}/share", headers=h_owner)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # Revoke share
    revoke_res = client.delete(f"/api/documents/{doc_id}/share/{share_token}", headers=h_owner)
    assert revoke_res.status_code == 204

    # Verify revoked
    pub_res2 = client.get(f"/api/documents/shared/{share_token}")
    assert pub_res2.status_code == 404


def test_projects_shared_alias(client):
    """Test the /api/projects/shared/{identifier} alias endpoint."""
    import time
    username = f"aliastest_{int(time.time())}"
    password = "password123"
    client.post("/api/auth/register", json={"username": username, "email": f"{username}@e.com", "password": password})
    tokens = client.post("/api/auth/login", json={"username": username, "password": password}).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    create_res = client.post("/api/documents", headers=headers, json={
        "title": "Alias Test Doc",
        "schema_version": "2.0",
        "json_data": {"schemaVersion": "2.0", "blocks": [], "assets": {"fonts": [], "images": {}}, "pageLayout": {}},
        "page_layout": {}
    })
    doc_id = create_res.json()["id"]

    share_res = client.post(f"/api/documents/{doc_id}/share", headers=headers, json={
        "permissions": "read",
        "expires_in_days": 1
    })
    share_token = share_res.json()["token"]

    # Access via alias
    alias_res = client.get(f"/api/projects/shared/{share_token}")
    assert alias_res.status_code == 200
    data = alias_res.json()
    assert data["id"] == doc_id
    assert data["title"] == "Alias Test Doc"
    assert data["role"] == "read"
    assert data["share_token"] == share_token
    assert data["is_owner"] is False


def test_projects_crud_endpoints(client):
    """Test /api/projects CRUD endpoints used by frontend CloudAuthService."""
    import time
    username = f"projuser_{int(time.time() * 1000)}"
    password = "password123"
    reg_res = client.post("/api/auth/register", json={"username": username, "email": f"{username}@test.com", "password": password})
    assert reg_res.status_code == 201

    login_res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "user" in login_data
    assert login_data["user"]["username"] == username
    token = login_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 0. Reject saving empty project with default title
    empty_res = client.post("/api/projects", headers=headers, json={
        "title": "Document sans titre",
        "state": {}
    })
    assert empty_res.status_code == 400

    # 1. Save new project via POST /api/projects
    save_res = client.post("/api/projects", headers=headers, json={
        "title": "Mon Raid 2026",
        "state": {"routes": [], "markers": []}
    })
    assert save_res.status_code == 200
    saved = save_res.json()
    assert saved["title"] == "Mon Raid 2026"
    assert saved["is_owner"] is True
    project_id = saved["id"]

    # 2. List projects via GET /api/projects
    list_res = client.get("/api/projects", headers=headers)
    assert list_res.status_code == 200
    projects = list_res.json()
    assert len(projects) >= 1
    assert any(p["id"] == project_id for p in projects)

    # 3. Get single project via GET /api/projects/{id}
    get_res = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_res.status_code == 200
    project = get_res.json()
    assert project["id"] == project_id
    assert project["title"] == "Mon Raid 2026"
    assert project["state"] == {"routes": [], "markers": []}

    # 4. Update project via POST /api/projects with existing id
    update_res = client.post("/api/projects", headers=headers, json={
        "id": project_id,
        "title": "Mon Raid 2026 (Mis à jour)",
        "state": {"routes": ["route_1"], "markers": []}
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["id"] == project_id
    assert updated["title"] == "Mon Raid 2026 (Mis à jour)"

    # 4a. Test sharing details: initially limited/restricted
    share_details_res = client.get(f"/api/projects/{project_id}/share", headers=headers)
    assert share_details_res.status_code == 200
    details = share_details_res.json()
    assert details["is_public"] is False
    assert details["project_id"] == project_id

    # 4b. Update public access to Public (Tous avec le lien)
    pub_res = client.post(f"/api/projects/{project_id}/public-access", headers=headers, json={
        "is_public": True,
        "public_role": "editor"
    })
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["is_public"] is True
    assert pub_data["public_role"] == "editor"
    token = pub_data["share_token"]
    assert token.startswith("doc_")

    # 4c. Access project via shared permalink
    shared_res = client.get(f"/api/projects/shared/{token}")
    assert shared_res.status_code == 200
    shared_data = shared_res.json()
    assert shared_data["title"] == "Mon Raid 2026 (Mis à jour)"
    assert shared_data["role"] == "editor"

    # 4d. Revert public access back to restricted (Limité)
    priv_res = client.post(f"/api/projects/{project_id}/public-access", headers=headers, json={
        "is_public": False
    })
    assert priv_res.status_code == 200
    assert priv_res.json()["is_public"] is False

    # 4e. Verify shared permalink is now revoked (404/403)
    shared_revoked = client.get(f"/api/projects/shared/{token}")
    assert shared_revoked.status_code in (403, 404)

    # 5. Delete project via DELETE /api/projects/{id}
    del_res = client.delete(f"/api/projects/{project_id}", headers=headers)
    assert del_res.status_code == 200

    # 6. Verify deleted
    get_after_del = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_after_del.status_code == 404
