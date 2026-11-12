"""
Phase 1 Test Suite — Modules validation, ZIP loading, legacy adaptation, and transformations.
"""

import os
import shutil
import tempfile
import zipfile
import pytest
from pathlib import Path

from backend.app.modules.schema import ModuleMetadata, RenderType, ModuleCategory
from backend.app.modules.registry import ModuleRegistry, SecurityError
from backend.app.modules.adapter import LegacyManifestAdapter
from backend.app.modules.sandbox import (
    execute_builtin_transform,
    encode_morse,
    encode_vigenere,
    encode_polybe,
    encode_caesar,
    encode_templier,
    encode_maritime,
    generate_gilwell_svg
)

LEGACY_MODULES_DIR = Path(__file__).resolve().parents[3] / "legacy" / "modules"


class TestModuleLegacyAuditAndMigration:

    def test_legacy_modules_directory_exists(self):
        assert LEGACY_MODULES_DIR.exists(), f"Path not found: {LEGACY_MODULES_DIR}"

    def test_all_11_legacy_modules_migrate_successfully(self):
        expected_modules = {
            "avocat", "carte_simple", "carte_ign", "cassis", "drapeaux", "gilwell",
            "maritime", "morse", "polybe", "templier", "texte_clair", "vigenere"
        }
        registry = ModuleRegistry()
        loaded = registry.load_from_base_dir(LEGACY_MODULES_DIR)
        loaded_ids = {m.id for m in loaded}

        for m_id in expected_modules:
            assert m_id in loaded_ids, f"Module {m_id} failed to load or migrate!"

            meta = registry.get(m_id)
            assert isinstance(meta, ModuleMetadata)
            assert meta.id == m_id
            assert meta.name is not None and len(meta.name) > 0
            assert meta.constraints.max_proportion > 0.0
            assert isinstance(meta.category, ModuleCategory)
            assert isinstance(meta.render_type, RenderType)

            # Check specific heuristic migrations
            if m_id == "vigenere":
                assert meta.constraints.max_occurrences == 1
                assert meta.render_type == RenderType.GRID
            elif m_id == "gilwell":
                assert meta.render_type == RenderType.SVG
            elif m_id in ("carte_ign", "drapeaux"):
                assert meta.render_type == RenderType.MAP


class TestZipExtractionAndSecurity:

    def setup_method(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.registry = ModuleRegistry(modules_dir=str(self.temp_dir / "storage"))

    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_package_and_reload_module_as_zip(self):
        # 1. Load legacy morse
        self.registry.load_from_base_dir(LEGACY_MODULES_DIR)
        morse_meta = self.registry.get("morse")
        assert morse_meta is not None

        # 2. Package to ZIP
        zip_path = self.temp_dir / "morse_v1.zip"
        self.registry.package_module_to_zip("morse", zip_path)
        assert zip_path.exists()

        # 3. Load ZIP into fresh registry
        fresh_registry = ModuleRegistry(modules_dir=str(self.temp_dir / "fresh_storage"))
        loaded_meta = fresh_registry.register_zip(zip_path, module_id="custom_morse")

        assert loaded_meta.id == "morse"
        assert loaded_meta.schema_version == "1.0"
        assert loaded_meta.render_type == RenderType.TEXT

    def test_zip_slip_security_rejection(self):
        # Craft a malicious zip containing traversal filename "../../evil.txt"
        bad_zip_path = self.temp_dir / "evil.zip"
        with zipfile.ZipFile(bad_zip_path, 'w') as zf:
            zf.writestr("../../evil.txt", "Malicious content")

        with pytest.raises(SecurityError) as exc_info:
            self.registry.register_zip(bad_zip_path)
        assert "Zip-Slip" in str(exc_info.value)

    def test_zip_bomb_size_rejection(self):
        # Create uncompressed size exceeding limit
        bomb_zip_path = self.temp_dir / "bomb.zip"
        with zipfile.ZipFile(bomb_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            # 55 MB of zeros compressed
            zf.writestr("huge.txt", b"\x00" * (55 * 1024 * 1024))

        with pytest.raises(SecurityError) as exc_info:
            self.registry.register_zip(bomb_zip_path)
        assert "exceeds limit" in str(exc_info.value)


class TestModuleEncodersAndTransforms:

    SAMPLE_FRENCH_TEXT = "Prendre à l'azimut 120° pendant 450 mètres vers l'église Saint-Étienne."

    def test_morse_encoding(self):
        enc = encode_morse("SOS 123")
        assert "... --- ..." in enc
        assert ".---- ..--- ...--" in enc

        out = execute_builtin_transform("morse", self.SAMPLE_FRENCH_TEXT)
        assert out.encoded_text is not None
        assert "alphabet_morse" in out.annexes

    def test_vigenere_encoding_and_decoding(self):
        key = "SCOUT"
        plain = "RENDEZVOUSALACIMEDELAMONTAGNE"
        cipher = encode_vigenere(plain, key=key)
        assert cipher != plain
        assert len(cipher) == len(plain)
        decoded = encode_vigenere(cipher, key=key, decode=True)
        assert decoded == plain

    def test_polybe_grid_encoding(self):
        enc = encode_polybe("AB 12")
        # A -> 11, B -> 12, 1 -> 53 (in 6x6 grid)
        assert "11 12" in enc

    def test_caesar_avocat_and_cassis(self):
        # Avocat: A=K (+10)
        enc_avocat = encode_caesar("A", shift=10)
        assert enc_avocat == "K"

        # Cassis: C=6 (shift 21)
        enc_cassis = encode_caesar("A", shift=21)
        assert enc_cassis == "V"

    def test_gilwell_svg_generation(self):
        dummy_segments = [
            {"azimut": 45, "distance": 150},
            {"azimut": 90, "distance": 200},
            {"azimut": 180, "distance": 80}
        ]
        svg = generate_gilwell_svg(dummy_segments)
        assert svg.startswith("<svg")
        assert svg.strip().endswith("</svg>")
        assert "45° (150m)" in svg
        assert "marker-end" in svg

    def test_all_modules_produce_non_empty_output(self):
        modules = [
            "morse", "vigenere", "polybe", "gilwell", "avocat",
            "drapeaux", "maritime", "cassis", "templier", "texte_clair",
            "carte_ign", "carte_simple"
        ]
        for mid in modules:
            res = execute_builtin_transform(
                mid,
                solution_text=self.SAMPLE_FRENCH_TEXT,
                segments=[{"azimut": 30, "distance": 100}]
            )
            assert res.module_id == mid
            assert res.solution_text == self.SAMPLE_FRENCH_TEXT
            assert res.encoded_text is not None or res.svg_content is not None
