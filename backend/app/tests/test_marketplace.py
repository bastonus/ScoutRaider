"""
test_marketplace.py — Integration tests for Marketplace, Preview Compilation & User Library Sync.
"""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_marketplace_endpoints():
    # 1. Preview compilation test
    prev_res = client.post("/api/marketplace/preview", json={
        "name": "Test Python Code",
        "category": "code",
        "code": "def encode(t):\n    return t.upper()",
        "version": "1.0.0",
        "author": "Scout Dev"
    })
    assert prev_res.status_code == 200
    data = prev_res.json()
    assert "preview_image" in data
    assert data["preview_image"].startswith("data:image/png;base64,")

    # 2. List marketplace modules (should have seeded items)
    list_res = client.get("/api/marketplace/modules")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 4

    # 3. Create a new community module
    mod_id = "test_custom_cipher"
    create_res = client.post("/api/marketplace/modules", json={
        "id": mod_id,
        "name": "Chiffre Custom",
        "category": "code",
        "description": "Mon chiffrement de patrouille",
        "version": "1.0.0",
        "is_public": True,
        "code": "def encode(t):\n    return f'PATROUILLE_{t}'"
    })
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["name"] == "Chiffre Custom"
    assert created["preview_image"].startswith("data:image/png;base64,")

    # 4. Modify community module
    update_res = client.put(f"/api/marketplace/modules/{mod_id}", json={
        "name": "Chiffre Custom v2",
        "category": "code",
        "description": "Version améliorée avec préfixe",
        "version": "1.1.0",
        "is_public": True,
        "code": "def encode(t):\n    return f'EPERVIER_{t}'"
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Chiffre Custom v2"
    assert updated["version"] == "1.1.0"

    # 5. Toggle visibility (hide / show)
    hide_res = client.patch(f"/api/marketplace/modules/{mod_id}/visibility", json={
        "is_public": False
    })
    assert hide_res.status_code == 200
    assert hide_res.json()["is_public"] is False

    show_res = client.patch(f"/api/marketplace/modules/{mod_id}/visibility", json={
        "is_public": True
    })
    assert show_res.status_code == 200
    assert show_res.json()["is_public"] is True
