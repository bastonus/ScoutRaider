"""
Test Suite for FastAPI Endpoints.
Tests:
  - GET /health
  - GET /modules
  - POST /diffraction/solve
  - POST /render/html
  - POST /render/pdf
"""

from fastapi.testclient import TestClient
import pytest
from backend.app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["loaded_modules_count"] >= 11


def test_list_modules():
    res = client.get("/modules")
    assert res.status_code == 200
    modules = res.json()
    ids = {m["id"] for m in modules}
    assert "morse" in ids
    assert "vigenere" in ids
    assert "carte_ign" in ids
    assert "carte_simple" in ids


def test_diffraction_solve_endpoint():
    payload = {
        "segments": [
            {"index": 0, "distance": 120.0, "azimut": 45.0, "poi_count": 0, "poi_density": 0.0},
            {"index": 1, "distance": 350.0, "azimut": 90.0, "poi_count": 0, "poi_density": 0.0},
            {"index": 2, "distance": 400.0, "azimut": 180.0, "poi_count": 0, "poi_density": 0.0},
            {"index": 3, "distance": 500.0, "azimut": 270.0, "poi_count": 0, "poi_density": 0.0},
            {"index": 4, "distance": 220.0, "azimut": 315.0, "poi_count": 0, "poi_density": 0.0}
        ],
        "preset_id": "seconde_classe_1",
        "seed": 42
    }
    res = client.post("/diffraction/solve", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["segment_count"] == 5
    assert len(data["assignments"]) > 0


def test_render_html_endpoint():
    payload = {
        "segments": [
            {"index": 0, "distance": 150.0, "azimut": 30.0, "poi_count": 0, "poi_density": 0.0},
            {"index": 1, "distance": 280.0, "azimut": 120.0, "poi_count": 0, "poi_density": 0.0}
        ],
        "preset_id": "arret_de_promesse_1",
        "options": {
            "title": "Carnet Test API",
            "is_solution": False
        }
    }
    res = client.post("/render/html", json=payload)
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Carnet Test API" in res.text


def test_render_pdf_endpoint():
    payload = {
        "segments": [
            {"index": 0, "distance": 200.0, "azimut": 60.0, "poi_count": 0, "poi_density": 0.0},
            {"index": 1, "distance": 310.0, "azimut": 180.0, "poi_count": 0, "poi_density": 0.0}
        ],
        "preset_id": "arret_de_promesse_1",
        "options": {
            "title": "Carnet API PDF",
            "is_solution": True
        }
    }
    res = client.post("/render/pdf", json=payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 1000  # valid PDF bytes


def test_render_raw_html_to_pdf_endpoint():
    payload = {
        "html": "<!DOCTYPE html><html><head><style>@page { size: A4; margin: 10mm; }</style></head><body><h1>Direct WeasyPrint Test</h1></body></html>",
        "title": "DirectPDF"
    }
    res = client.post("/render/html-to-pdf", json=payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")
    assert len(res.content) > 500
