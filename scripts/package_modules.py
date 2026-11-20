"""
ScoutRaider Hub — Standard Module Packaging Tool (v2.0)
Packages all standardized modules in src/modules/ into individual .zip archives
accompanied by SHA-256 hashes and an S3-ready catalog index (catalog_v2.json).

Usage:
    python scripts/package_modules.py [--output-dir dist/packages] [--validate-only]
"""

import os
import sys
import json
import zipfile
import hashlib
import argparse
from pathlib import Path

# Add project root to path for backend module imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.modules.schema import HubResourceMetadata


def compute_sha256(filepath: Path) -> str:
    """Compute SHA-256 checksum of a file."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def package_module(module_dir: Path, output_dir: Path, s3_base_url: str = "https://s3.scoutraider.local/modules/") -> dict:
    """Validate and package a single module directory into a zip archive."""
    manifest_path = module_dir / "manifest.json"
    if not manifest_path.exists():
        return None

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest_raw = json.load(f)

    # Validate against Hub Schema v2
    validated = HubResourceMetadata.model_validate(manifest_raw)

    zip_filename = f"{validated.id}-{validated.version}.zip"
    zip_path = output_dir / zip_filename

    # Create zip archive
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in module_dir.rglob("*"):
            if file.is_file():
                # Avoid packing caches or node_modules
                if "__pycache__" in file.parts or "node_modules" in file.parts or file.suffix == ".pyc":
                    continue
                rel_path = file.relative_to(module_dir)
                zipf.write(file, arcname=str(rel_path))

    # Calculate checksum & size
    sha256 = compute_sha256(zip_path)
    file_size = zip_path.stat().st_size

    # Enrich metadata for catalog
    manifest_data = validated.model_dump()
    manifest_data["distribution"] = {
        "archive_url": f"{s3_base_url}{zip_filename}",
        "sha256": sha256,
        "byte_size": file_size,
        "signature": f"sig_sha256_{sha256[:16]}"
    }

    return manifest_data


def main():
    parser = argparse.ArgumentParser(description="Package ScoutRaider Hub modules into zip archives.")
    parser.add_argument("--modules-dir", default=str(PROJECT_ROOT / "src" / "modules"), help="Path to modules directory")
    parser.add_argument("--output-dir", default=str(PROJECT_ROOT / "dist" / "packages"), help="Target output directory")
    parser.add_argument("--validate-only", action="store_true", help="Only validate manifests without creating zip archives")
    parser.add_argument("--s3-url", default="https://s3.scoutraider.local/modules/", help="Base URL for S3 distribution")
    args = parser.parse_args()

    modules_path = Path(args.modules_dir)
    output_path = Path(args.output_dir)

    if not modules_path.exists():
        print(f"Error: Modules directory {modules_path} does not exist.")
        sys.exit(1)

    if not args.validate_only:
        output_path.mkdir(parents=True, exist_ok=True)

    catalog = []
    errors = []

    print(f"\n=======================================================")
    print(f"  ScoutRaider Hub v2.0 — Module Packaging Pipeline")
    print(f"=======================================================\n")
    print(f"Scanning modules in: {modules_path}")
    if not args.validate_only:
        print(f"Output directory:    {output_path}\n")

    for entry in sorted(modules_path.iterdir()):
        if entry.is_dir() and (entry / "manifest.json").exists():
            mod_id = entry.name
            try:
                if args.validate_only:
                    with open(entry / "manifest.json", "r", encoding="utf-8") as f:
                        data = json.load(f)
                    HubResourceMetadata.model_validate(data)
                    print(f"  [OK] Validated: {mod_id}")
                else:
                    item_meta = package_module(entry, output_path, args.s3_url)
                    catalog.append(item_meta)
                    print(f"  [OK] Packaged: {mod_id.ljust(22)} -> {item_meta['distribution']['archive_url']} ({item_meta['distribution']['byte_size']} bytes)")
            except Exception as e:
                print(f"  [FAIL] {mod_id}: {e}")
                errors.append((mod_id, str(e)))

    if not args.validate_only and catalog:
        catalog_file = output_path / "catalog_v2.json"
        with open(catalog_file, "w", encoding="utf-8") as f:
            json.dump({
                "hub_version": "2.0.0",
                "generated_at": "2026-11-20T19:00:00Z",
                "resources_count": len(catalog),
                "resources": catalog
            }, f, indent=2, ensure_ascii=False)
        print(f"\nCatalog index generated: {catalog_file} ({len(catalog)} resources)")

    print(f"\nSummary:")
    print(f"  - Successfully processed: {len(catalog) if not args.validate_only else 'all valid'}")
    print(f"  - Errors: {len(errors)}")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
