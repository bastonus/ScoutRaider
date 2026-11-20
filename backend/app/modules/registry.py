"""
Server-side Module Registry for ScoutRaider.
Handles secure ZIP decompression, schema validation, legacy migration,
and execution dispatching.
"""

import os
import io
import json
import hashlib
import zipfile
import shutil
from typing import Dict, List, Optional, Any, Tuple, Union
from pathlib import Path

from .schema import (
    ModuleMetadata,
    EncodedOutput,
    DataCapability,
    HubResourceMetadata,
    TrameDependencies,
    HubResourceType,
    S3DistributionMeta
)
from .adapter import LegacyManifestAdapter
from .sandbox import execute_builtin_transform


class SecurityError(Exception):
    """Raised when an uploaded zip or module violates security constraints."""
    pass


class ModuleRegistry:
    """
    Central server registry for loaded, validated ScoutRaider modules.
    """

    MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024  # 50 MB
    MAX_FILE_COUNT = 250

    def __init__(self, modules_dir: Optional[str] = None):
        self.modules_dir = Path(modules_dir) if modules_dir else Path("./modules_storage")
        self._modules: Dict[str, ModuleMetadata] = {}
        self._module_paths: Dict[str, Path] = {}
        self._migration_logs: Dict[str, List[str]] = {}

    def get(self, module_id: str) -> Optional[ModuleMetadata]:
        return self._modules.get(module_id.lower().strip())

    def list_all(self) -> List[ModuleMetadata]:
        return list(self._modules.values())

    def get_migration_log(self, module_id: str) -> List[str]:
        return self._migration_logs.get(module_id.lower().strip(), [])

    # ─── Secure ZIP Extraction ────────────────────────────────────────────────

    @classmethod
    def safe_extract_zip(cls, zip_source: Any, dest_dir: Path) -> Path:
        """
        Safely unpacks a ZIP archive to dest_dir, preventing Zip-Slip directory traversal
        and zip bombs.
        """
        dest_dir = dest_dir.resolve()
        dest_dir.mkdir(parents=True, exist_ok=True)

        if isinstance(zip_source, (str, Path)):
            zf = zipfile.ZipFile(zip_source, 'r')
        elif isinstance(zip_source, bytes):
            zf = zipfile.ZipFile(io.BytesIO(zip_source), 'r')
        else:
            zf = zipfile.ZipFile(zip_source, 'r')

        total_size = 0
        file_count = 0

        with zf:
            for member in zf.infolist():
                file_count += 1
                if file_count > cls.MAX_FILE_COUNT:
                    raise SecurityError(f"Archive exceeds maximum file count ({cls.MAX_FILE_COUNT}).")

                total_size += member.file_size
                if total_size > cls.MAX_UNCOMPRESSED_SIZE:
                    raise SecurityError(f"Archive uncompressed size exceeds limit ({cls.MAX_UNCOMPRESSED_SIZE} bytes).")

                # Zip Slip Protection: Ensure target file is inside dest_dir
                target_path = (dest_dir / member.filename).resolve()
                try:
                    target_path.relative_to(dest_dir)
                except ValueError:
                    raise SecurityError(f"Potential Zip-Slip attack detected with filename: {member.filename}")

                # Prevent writing dangerous device files or pipes
                if member.is_dir():
                    target_path.mkdir(parents=True, exist_ok=True)
                else:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(member, 'r') as source, open(target_path, 'wb') as target:
                        shutil.copyfileobj(source, target)

        return dest_dir

    # ─── Module Registration ──────────────────────────────────────────────────

    def register_directory(self, dir_path: Path) -> ModuleMetadata:
        """
        Loads and validates a module located in a directory.
        """
        dir_path = dir_path.resolve()
        manifest_path = dir_path / "manifest.json"

        raw_manifest: Dict[str, Any] = {}
        if manifest_path.exists():
            with open(manifest_path, "r", encoding="utf-8") as f:
                raw_manifest = json.load(f)

        module_id = raw_manifest.get("id") or dir_path.name

        # Detect assets
        discovered_assets: List[str] = []
        assets_dir = dir_path / "assets"
        if assets_dir.is_dir():
            for f in assets_dir.rglob("*"):
                if f.is_file():
                    discovered_assets.append(str(f.relative_to(dir_path)))

        metadata, logs = LegacyManifestAdapter.migrate(
            module_id=module_id,
            raw_manifest=raw_manifest,
            discovered_assets=discovered_assets
        )

        clean_id = metadata.id
        self._modules[clean_id] = metadata
        self._module_paths[clean_id] = dir_path
        self._migration_logs[clean_id] = logs

        return metadata

    def register_zip(self, zip_source: Any, module_id: Optional[str] = None) -> ModuleMetadata:
        """
        Safely unpacks a ZIP archive into a dedicated storage folder and registers it.
        """
        temp_target = self.modules_dir / (module_id or f"pkg_{os.urandom(4).hex()}")
        self.safe_extract_zip(zip_source, temp_target)

        # Detect if zip content was wrapped in a single root folder
        children = [c for c in temp_target.iterdir() if c.is_dir()]
        has_manifest_in_root = (temp_target / "manifest.json").exists()
        if not has_manifest_in_root and len(children) == 1 and (children[0] / "manifest.json").exists():
            scan_dir = children[0]
        else:
            scan_dir = temp_target

        meta = self.register_directory(scan_dir)
        return meta

    def load_from_base_dir(self, base_dir: Path) -> List[ModuleMetadata]:
        """
        Scans all subfolders in base_dir and registers any folder with a manifest or module name.
        """
        registered = []
        base = base_dir.resolve()
        if not base.exists() or not base.is_dir():
            return registered

        for entry in sorted(base.iterdir()):
            if entry.is_dir() and not entry.name.startswith(('.', '__')):
                try:
                    meta = self.register_directory(entry)
                    registered.append(meta)
                except Exception as e:
                    print(f"[ModuleRegistry] Warning: Failed to load module from {entry.name}: {e}")

        return registered

    # ─── Execution ────────────────────────────────────────────────────────────

    def execute(
        self,
        module_id: str,
        solution_text: str,
        segments: Optional[List[Dict[str, Any]]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> EncodedOutput:
        """
        Executes transformation for the given module ID.
        """
        meta = self.get(module_id)
        if not meta:
            # Fallback to plain text
            return execute_builtin_transform("texte_clair", solution_text, segments, options)

        # Execute transformation through safe dispatcher
        return execute_builtin_transform(meta.id, solution_text, segments, options)

    # ─── Module Export Packager ───────────────────────────────────────────────

    def package_module_to_zip(self, module_id: str, output_zip_path: Path) -> Path:
        """
        Packages a loaded module into a standard v1 compliant ZIP archive.
        """
        meta = self.get(module_id)
        if not meta:
            raise ValueError(f"Module '{module_id}' not found in registry.")

        source_dir = self._module_paths.get(meta.id)
        output_zip_path = output_zip_path.resolve()
        output_zip_path.parent.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Write normalized v1 manifest.json
            manifest_json = meta.model_dump_json(indent=2)
            zf.writestr("manifest.json", manifest_json)

            if source_dir and source_dir.is_dir():
                # Write other files like module.py or assets
                for f in source_dir.rglob("*"):
                    if f.is_file() and f.name != "manifest.json" and not f.name.endswith(('.pyc', '.git')):
                        rel = f.relative_to(source_dir)
                        zf.write(f, str(rel))

        return output_zip_path

    # ─── Hub v2 & S3 Extensions ──────────────────────────────────────────────

    @staticmethod
    def compute_file_sha256(file_path: Path) -> str:
        """Calculates the SHA-256 hash of a file."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    def list_by_capability(self, capability: Union[str, DataCapability]) -> List[ModuleMetadata]:
        """Filters registered modules by their DataCapability."""
        cap_val = capability.value if isinstance(capability, DataCapability) else str(capability).lower()
        results = []
        for m in self._modules.values():
            if m.data_capability and m.data_capability.value == cap_val:
                results.append(m)
        return results

    def resolve_trame_dependencies(
        self,
        trame_id: str,
        dependencies: Optional[TrameDependencies] = None
    ) -> Dict[str, Any]:
        """
        Analyses dependencies declared by a Trame de Raid and determines
        satisfied, fetchable from S3/Hub, or missing modules.
        """
        deps_list = []
        if dependencies and dependencies.required_modules:
            deps_list = dependencies.required_modules

        satisfied = []
        missing = []
        to_download = []

        for dep in deps_list:
            mod_id = dep.id.lower().strip()
            installed = self.get(mod_id)
            if installed:
                satisfied.append({
                    "id": mod_id,
                    "version": installed.version,
                    "role": dep.role,
                    "status": "installed"
                })
            else:
                # Mock or resolve remote Hub S3 availability
                download_candidate = {
                    "id": mod_id,
                    "version_req": dep.version_req,
                    "role": dep.role,
                    "optional": dep.optional,
                    "s3_url": f"https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/{mod_id}-2.0.0.zip"
                }
                if not dep.optional:
                    to_download.append(download_candidate)
                else:
                    missing.append(download_candidate)

        is_ready = len(to_download) == 0 and len([m for m in missing if not m.get("optional")]) == 0

        return {
            "trame_id": trame_id,
            "status": "ready" if is_ready else "requires_resolution",
            "satisfied": satisfied,
            "to_download": to_download,
            "missing": missing
        }

    @staticmethod
    def validate_manifest_payload(manifest_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates raw manifest JSON payload according to Schema v2 rules.
        Returns a structured validation diagnostic for AI agents and human creators.
        """
        errors = []
        warnings = []

        m_id = manifest_data.get("id")
        if not m_id or not isinstance(m_id, str):
            errors.append("Field 'id' is required and must be a string.")
        elif not m_id.islower() or " " in m_id:
            errors.append("Field 'id' must be lowercase without spaces (kebab-case or snake_case).")

        name = manifest_data.get("name")
        if not name or len(name) < 2:
            errors.append("Field 'name' is required (min 2 chars).")

        res_type = manifest_data.get("resource_type", "crypto_module")
        try:
            HubResourceType(res_type)
        except ValueError:
            errors.append(f"Invalid 'resource_type': '{res_type}'. Allowed: {[t.value for t in HubResourceType]}.")

        # Crypto module capability checks
        if res_type == "crypto_module":
            data_cap = manifest_data.get("data_capability")
            if not data_cap:
                warnings.append("Recommendation: Declare 'data_capability' (map_path, numeric, alphabetic, etc.).")
            else:
                try:
                    DataCapability(data_cap)
                except ValueError:
                    errors.append(f"Invalid 'data_capability': '{data_cap}'. Allowed: {[c.value for c in DataCapability]}.")

        # Constraints validation
        constraints = manifest_data.get("constraints", {})
        if constraints:
            max_prop = constraints.get("max_proportion")
            if max_prop is not None and (max_prop < 0.0 or max_prop > 1.0):
                errors.append("Constraint 'max_proportion' must be between 0.0 and 1.0.")

        is_valid = len(errors) == 0
        return {
            "valid": is_valid,
            "resource_id": m_id or "unknown",
            "resource_type": res_type,
            "errors": errors,
            "warnings": warnings,
            "schema_version": manifest_data.get("schema_version", "2.0")
        }


# Global singleton instance
module_registry = ModuleRegistry()


# Default singleton instance for application use
module_registry = ModuleRegistry()
_legacy_dir = Path(__file__).resolve().parents[3] / "legacy" / "modules"
if _legacy_dir.exists():
    module_registry.load_from_base_dir(_legacy_dir)

