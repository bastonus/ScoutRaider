"""
test_modules_and_preview.py — Integration tests for Modules Registry, Preview Compilation.
Note: Marketplace API endpoints are not currently exposed via HTTP.
These tests verify the internal modules system and preview generation.
"""

import pytest
from app.modules.registry import ModuleRegistry
from app.modules.preview_generator import compile_and_generate_preview
from app.modules.schema import ModuleCategory

LEGACY_MODULES_DIR = __import__("pathlib").Path(__file__).resolve().parents[3] / "legacy" / "modules"


def test_preview_compilation():
    """Test preview image generation for a module."""
    preview = compile_and_generate_preview(
        module_id="test_preview",
        name="Test Module",
        category="code",
        code="def encode(t):\n    return t.upper()",
        author="Test Author",
        version="1.0.0"
    )
    assert preview is not None
    assert preview.startswith("data:image/png;base64,")


def test_module_registry_loads_legacy():
    """Test that all legacy modules load successfully."""
    registry = ModuleRegistry()
    loaded = registry.load_from_base_dir(LEGACY_MODULES_DIR)
    loaded_ids = {m.id for m in loaded}

    expected_modules = {
        "avocat", "carte_simple", "carte_ign", "cassis", "drapeaux", "gilwell",
        "maritime", "morse", "polybe", "templier", "texte_clair", "vigenere"
    }

    for m_id in expected_modules:
        assert m_id in loaded_ids, f"Module {m_id} failed to load or migrate!"

        meta = registry.get(m_id)
        assert meta is not None
        assert meta.id == m_id
        assert meta.name is not None and len(meta.name) > 0
        assert meta.constraints.max_proportion > 0.0
        assert isinstance(meta.category, ModuleCategory)


def test_module_registry_package_and_reload():
    """Test packaging a module to ZIP and reloading it."""
    import tempfile
    import shutil
    from pathlib import Path

    temp_dir = Path(tempfile.mkdtemp())
    try:
        registry = ModuleRegistry()
        registry.load_from_base_dir(LEGACY_MODULES_DIR)

        # Package morse module to ZIP
        zip_path = temp_dir / "morse_v1.zip"
        registry.package_module_to_zip("morse", zip_path)
        assert zip_path.exists()

        # Load ZIP into fresh registry
        fresh_registry = ModuleRegistry(modules_dir=str(temp_dir / "fresh_storage"))
        loaded_meta = fresh_registry.register_zip(zip_path, module_id="custom_morse")

        assert loaded_meta.id == "morse"
        assert loaded_meta.schema_version == "1.0"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_module_encoders():
    """Test that all builtin encoders produce output."""
    from app.modules.sandbox import execute_builtin_transform

    SAMPLE_TEXT = "Prendre à l'azimut 120° pendant 450 mètres."
    modules = [
        "morse", "vigenere", "polybe", "gilwell", "avocat",
        "drapeaux", "maritime", "cassis", "templier", "texte_clair",
        "carte_ign", "carte_simple"
    ]

    for mid in modules:
        res = execute_builtin_transform(
            mid,
            solution_text=SAMPLE_TEXT,
            segments=[{"azimut": 30, "distance": 100}]
        )
        assert res.module_id == mid
        assert res.solution_text == SAMPLE_TEXT
        assert res.encoded_text is not None or res.svg_content is not None