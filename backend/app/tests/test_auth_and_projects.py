"""
test_auth_and_projects.py — Tests for authentication, guest mode, and document cloud synchronization.
Uses the current API structure with /api/documents endpoints.
"""

import pytest


def test_auth_and_cloud_documents_flow(client):
    # 1. Register a test user
    import time
    username = f"scout_tester_{int(time.time())}"
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "secretpassword123"
    })
    assert reg_res.status_code == 201, reg_res.text  # 201 Created
    user_data = reg_res.json()
    assert user_data["username"] == username
    assert "id" in user_data

    # 2. Login to get tokens
    login_res = client.post("/api/auth/login", json={
        "username": username,
        "password": "secretpassword123"
    })
    assert login_res.status_code == 200, login_res.text
    token_data = login_res.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    access_token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 3. Check /api/auth/me
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == username

    # 4. List documents (initially empty)
    list_res = client.get("/api/documents", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 0

    # 5. Create a document
    sample_json_data = {
        "schemaVersion": "2.0",
        "blocks": [],
        "assets": {"fonts": [], "images": {}},
        "pageLayout": {}
    }
    create_res = client.post("/api/documents", headers=headers, json={
        "title": "Grand Raid des Cimes",
        "schema_version": "2.0",
        "json_data": sample_json_data,
        "page_layout": {}
    })
    assert create_res.status_code == 201, create_res.text
    document = create_res.json()
    assert document["title"] == "Grand Raid des Cimes"
    assert "id" in document
    doc_id = document["id"]

    # 6. Fetch document
    fetch_res = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert fetch_res.status_code == 200
    doc_data = fetch_res.json()
    assert doc_data["title"] == "Grand Raid des Cimes"
    assert doc_data["id"] == doc_id

    # 7. Update document (with If-Match for optimistic locking)
    update_res = client.put(
        f"/api/documents/{doc_id}",
        headers={**headers, "If-Match": "1"},
        json={"title": "Grand Raid des Cimes - Updated", "version": 1}
    )
    assert update_res.status_code == 200, update_res.text
    updated = update_res.json()
    assert updated["title"] == "Grand Raid des Cimes - Updated"
    assert updated["version"] == 2

    # 8. Delete document (soft delete)
    del_res = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 204

    # 9. Unauthenticated request to /api/documents fails with 401
    unauth_res = client.get("/api/documents")
    assert unauth_res.status_code == 401


def test_sharing_and_permalinks_flow(client):
    import time
    ts = int(time.time())
    owner_name = f"owner_{ts}"
    editor_name = f"editor_{ts}"
    viewer_name = f"viewer_{ts}"

    # Create Owner
    r_owner = client.post("/api/auth/register", json={
        "username": owner_name,
        "email": f"{owner_name}@example.com",
        "password": "password123"
    })
    assert r_owner.status_code == 201
    owner_login = client.post("/api/auth/login", json={"username": owner_name, "password": "password123"})
    h_owner = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}

    # Create Editor
    r_editor = client.post("/api/auth/register", json={
        "username": editor_name,
        "email": f"{editor_name}@example.com",
        "password": "password123"
    })
    assert r_editor.status_code == 201
    editor_login = client.post("/api/auth/login", json={"username": editor_name, "password": "password123"})
    h_editor = {"Authorization": f"Bearer {editor_login.json()['access_token']}"}

    # Create Viewer
    r_viewer = client.post("/api/auth/register", json={
        "username": viewer_name,
        "email": f"{viewer_name}@example.com",
        "password": "password123"
    })
    assert r_viewer.status_code == 201
    viewer_login = client.post("/api/auth/login", json={"username": viewer_name, "password": "password123"})
    h_viewer = {"Authorization": f"Bearer {viewer_login.json()['access_token']}"}

    # Owner creates document
    create_res = client.post("/api/documents", headers=h_owner, json={
        "title": "Projet Partagé Test",
        "schema_version": "2.0",
        "json_data": {"schemaVersion": "2.0", "blocks": [], "assets": {"fonts": [], "images": {}}, "pageLayout": {}},
        "page_layout": {}
    })
    assert create_res.status_code == 201
    document = create_res.json()
    doc_id = document["id"]

    # Create share link (read permission)
    share_res = client.post(f"/api/documents/{doc_id}/share", headers=h_owner, json={
        "permissions": "read",
        "expires_in_days": 7
    })
    assert share_res.status_code == 200, share_res.text
    share_data = share_res.json()
    assert "token" in share_data
    assert share_data["token"].startswith("doc_")
    share_token = share_data["token"]

    # Unauthenticated user can fetch via share_token
    pub_get = client.get(f"/api/documents/shared/{share_token}")
    assert pub_get.status_code == 200, pub_get.text
    shared_doc = pub_get.json()
    assert shared_doc["document"]["id"] == doc_id
    assert shared_doc["permissions"] == "read"
    assert shared_doc["share_token"] == share_token

    # Create share link with edit permission for editor
    share_edit_res = client.post(f"/api/documents/{doc_id}/share", headers=h_owner, json={
        "permissions": "edit",
        "expires_in_days": 7
    })
    assert share_edit_res.status_code == 200
    share_edit_token = share_edit_res.json()["token"]

    # Editor can access with edit permission
    ed_get = client.get(f"/api/documents/shared/{share_edit_token}")
    assert ed_get.status_code == 200
    assert ed_get.json()["permissions"] == "edit"

    # List share links
    list_shares = client.get(f"/api/documents/{doc_id}/share", headers=h_owner)
    assert list_shares.status_code == 200
    shares = list_shares.json()
    assert len(shares) == 2

    # Revoke read-only share
    revoke_res = client.delete(f"/api/documents/{doc_id}/share/{share_token}", headers=h_owner)
    assert revoke_res.status_code == 204

    # Verify revoked
    list_shares2 = client.get(f"/api/documents/{doc_id}/share", headers=h_owner)
    assert len(list_shares2.json()) == 1


def test_projects_shared_alias(client):
    """Test the /api/projects/shared/{identifier} alias for frontend compatibility."""
    import time
    ts = int(time.time())
    owner_name = f"owner_alias_{ts}"

    r_owner = client.post("/api/auth/register", json={
        "username": owner_name,
        "email": f"{owner_name}@example.com",
        "password": "password123"
    })
    assert r_owner.status_code == 201
    owner_login = client.post("/api/auth/login", json={"username": owner_name, "password": "password123"})
    h_owner = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}

    # Create document
    create_res = client.post("/api/documents", headers=h_owner, json={
        "title": "Alias Test",
        "schema_version": "2.0",
        "json_data": {"schemaVersion": "2.0", "blocks": [], "assets": {"fonts": [], "images": {}}, "pageLayout": {}},
        "page_layout": {}
    })
    assert create_res.status_code == 201
    doc_id = create_res.json()["id"]

    # Create share link
    share_res = client.post(f"/api/documents/{doc_id}/share", headers=h_owner, json={
        "permissions": "read",
        "expires_in_days": 7
    })
    share_token = share_res.json()["token"]

    # Access via /api/projects/shared/{identifier} (frontend compatibility)
    alias_res = client.get(f"/api/projects/shared/{share_token}")
    assert alias_res.status_code == 200, alias_res.text
    data = alias_res.json()
    assert data["id"] == doc_id
    assert data["title"] == "Alias Test"
    assert data["role"] == "read"
    assert data["share_token"] == share_token
    assert data["is_owner"] is False