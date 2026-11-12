"""
test_auth_and_projects.py — Tests for authentication, guest mode, and project cloud synchronization.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_auth_and_cloud_projects_flow():
    # 1. Register a test user
    username = f"scout_tester_{int(pytest.importorskip('time').time())}"
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "secretpassword123"
    })
    assert reg_res.status_code == 200, reg_res.text
    data = reg_res.json()
    assert "token" in data
    assert data["user"]["username"] == username
    token = data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check /api/auth/me
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["user"]["username"] == username

    # 3. List projects (initially empty)
    list_res = client.get("/api/projects", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 0

    # 4. Save a project to cloud
    sample_state = {
        "version": "5.0.0",
        "document_title": "Grand Raid des Cimes",
        "stages": [{"id": "st-1", "coords": [45.1, 6.2], "label": "A"}]
    }
    save_res = client.post("/api/projects", headers=headers, json={
        "id": "proj_test_123",
        "title": "Grand Raid des Cimes",
        "state": sample_state
    })
    assert save_res.status_code == 200
    saved = save_res.json()
    assert saved["id"] == "proj_test_123"
    assert saved["title"] == "Grand Raid des Cimes"

    # 5. Fetch project
    fetch_res = client.get("/api/projects/proj_test_123", headers=headers)
    assert fetch_res.status_code == 200
    proj_data = fetch_res.json()
    assert proj_data["title"] == "Grand Raid des Cimes"
    assert proj_data["state"]["document_title"] == "Grand Raid des Cimes"

    # 6. Delete project
    del_res = client.delete("/api/projects/proj_test_123", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 7. Unauthenticated request to /api/projects fails with 401
    unauth_res = client.get("/api/projects")
    assert unauth_res.status_code == 401


def test_sharing_and_permalinks_flow():
    import time
    ts = int(time.time())
    owner_name = f"owner_{ts}"
    editor_name = f"editor_{ts}"
    viewer_name = f"viewer_{ts}"

    # Create Owner
    r_owner = client.post("/api/auth/register", json={"username": owner_name, "password": "password123"})
    h_owner = {"Authorization": f"Bearer {r_owner.json()['token']}"}

    # Create Editor
    r_editor = client.post("/api/auth/register", json={"username": editor_name, "password": "password123"})
    h_editor = {"Authorization": f"Bearer {r_editor.json()['token']}"}

    # Create Viewer
    r_viewer = client.post("/api/auth/register", json={"username": viewer_name, "password": "password123"})
    h_viewer = {"Authorization": f"Bearer {r_viewer.json()['token']}"}

    # Owner creates project
    pid = f"proj_share_{ts}"
    save_res = client.post("/api/projects", headers=h_owner, json={
        "id": pid,
        "title": "Projet Partagé Test",
        "state": {"title": "Projet Partagé Test", "steps": []}
    })
    assert save_res.status_code == 200

    # Get sharing info
    sh_res = client.get(f"/api/projects/{pid}/share", headers=h_owner)
    assert sh_res.status_code == 200
    sh_data = sh_res.json()
    assert sh_data["is_owner"] is True
    share_token = sh_data["share_token"]
    assert share_token.startswith("doc_")

    # Invite editor
    inv_res = client.post(f"/api/projects/{pid}/share", headers=h_owner, json={
        "username_or_email": editor_name,
        "role": "editor"
    })
    assert inv_res.status_code == 200

    # Editor can fetch and update project
    ed_get = client.get(f"/api/projects/{pid}", headers=h_editor)
    assert ed_get.status_code == 200
    assert ed_get.json()["role"] == "editor"

    ed_save = client.post("/api/projects", headers=h_editor, json={
        "id": pid,
        "title": "Projet Modifié par Editor",
        "state": {"title": "Projet Modifié par Editor", "steps": [1]}
    })
    assert ed_save.status_code == 200

    # Invite viewer
    inv_v = client.post(f"/api/projects/{pid}/share", headers=h_owner, json={
        "username_or_email": viewer_name,
        "role": "viewer"
    })
    assert inv_v.status_code == 200

    # Viewer can fetch
    v_get = client.get(f"/api/projects/{pid}", headers=h_viewer)
    assert v_get.status_code == 200
    assert v_get.json()["role"] == "viewer"

    # Viewer CANNOT update project
    v_save = client.post("/api/projects", headers=h_viewer, json={
        "id": pid,
        "title": "Hack Viewer",
        "state": {}
    })
    assert v_save.status_code == 403

    # Test Public link access
    pub_res = client.post(f"/api/projects/{pid}/public-access", headers=h_owner, json={
        "is_public": True,
        "public_role": "viewer"
    })
    assert pub_res.status_code == 200

    # Unauthenticated user can fetch via share_token
    pub_get = client.get(f"/api/projects/shared/{share_token}")
    assert pub_get.status_code == 200
    assert pub_get.json()["id"] == pid
    assert pub_get.json()["role"] == "viewer"

    # Remove editor collaborator
    rem_res = client.delete(f"/api/projects/{pid}/share/{r_editor.json()['user']['id']}", headers=h_owner)
    assert rem_res.status_code == 200
