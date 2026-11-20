# modules

## Overview
Raid puzzle and cryptography modules (Morse, Vigenere, Avocat, etc.) on the backend.

## Interface
- `[adapter.py] class LegacyManifestAdapter`
- `[adapter.py]   LegacyManifestAdapter.migrate()`
- `[preview_generator.py] def get_default_font()`
- `[preview_generator.py] def render_code_preview()`
- `[preview_generator.py] def compile_and_generate_preview()`
- `[registry.py] class SecurityError`
- `[registry.py] class ModuleRegistry`
- `[registry.py]   ModuleRegistry.__init__()`
- `[registry.py]   ModuleRegistry.get()`
- `[registry.py]   ModuleRegistry.list_all()`
- `[registry.py]   ModuleRegistry.get_migration_log()`
- `[registry.py]   ModuleRegistry.safe_extract_zip()`
- `[registry.py]   ModuleRegistry.register_directory()`
- `[registry.py]   ModuleRegistry.register_zip()`
- `[registry.py]   ModuleRegistry.load_from_base_dir()`
- `[registry.py]   ModuleRegistry.execute()`
- `[registry.py]   ModuleRegistry.package_module_to_zip()`
- `[sandbox.py] def normalize_text()`
- `[sandbox.py] def encode_morse()`
- `[sandbox.py] def encode_vigenere()`
- `[sandbox.py] def encode_polybe()`
- `[sandbox.py] def encode_caesar()`
- `[sandbox.py] def encode_templier()`
- `[sandbox.py] def encode_maritime()`
- `[sandbox.py] def generate_gilwell_svg()`
- *(and 7 more exported symbols)*

## Invariants
- [registry.py] Enforces: SecurityError(f"Archive exceeds maximum file count ({cls.MAX_FILE_COUNT})
- [registry.py] Enforces: ValueError(f"Module '{module_id}' not found in registry.")
- [registry.py] Enforces: SecurityError(f"Archive uncompressed size exceeds limit ({cls.MAX_UNCOMPRESSED_S
- [registry.py] Enforces: SecurityError(f"Potential Zip-Slip attack detected with filename: {member.filena

## Side Effects
- Filesystem operations (file read/write)
- Spawns external processes

## Verification
- Run: `pytest tests/ -v`
