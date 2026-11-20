# legacy

## Overview
Legacy Python/PySide6 desktop raid generator application and offline toolset.

## Interface
- `[build.py] def main()`
- `[install.py] def install()`
- `[main.py] class _SpatialGrid`
- `[main.py]   _SpatialGrid.__init__()`
- `[main.py]   _SpatialGrid.insert_points()`
- `[main.py]   _SpatialGrid.count_nearby()`
- `[main.py] class _RouteCalculationWorker`
- `[main.py]   _RouteCalculationWorker.__init__()`
- `[main.py]   _RouteCalculationWorker.cancel()`
- `[main.py]   _RouteCalculationWorker.run()`
- `[main.py] class ExportWarningDialog`
- `[main.py]   ExportWarningDialog.__init__()`
- `[main.py]   ExportWarningDialog.on_selection_changed()`
- `[main.py] class _ExportWorker`
- `[main.py]   _ExportWorker.__init__()`
- `[main.py]   _ExportWorker.cancel()`
- `[main.py]   _ExportWorker.run()`
- `[main.py] class ScoutWorkspace`
- `[main.py]   ScoutWorkspace.__init__()`
- `[main.py]   ScoutWorkspace.state_manager()`
- `[main.py]   ScoutWorkspace.map_view()`
- `[main.py]   ScoutWorkspace.export_panel()`
- `[main.py]   ScoutWorkspace.on_state_changed_globally()`
- `[main.py]   ScoutWorkspace.setup_menus()`
- `[main.py]   ScoutWorkspace.setup_toolbars()`
- *(and 75 more exported symbols)*

### Subdirectories
- [modules](./modules/README.md) - Collection of cryptographic and cryptographic-cipher puzzle modules for legacy raid generation.
- [ui](./ui/README.md) - Legacy PySide6 desktop user interface wizard steps and dialog components.
- [utils](./utils/README.md) - Legacy utility engines for BRouter routing, polygon simplification, presets, and multi-format export.

## Invariants
- [main_orchestrator.py] Enforces: ValueError(f"Format d'export inconnu: {fmt}")
- [main_orchestrator.py] Enforces: ValueError("State manager non défini dans l'orchestrateur")

## Side Effects
- Filesystem operations (file read/write)
- Network / HTTP / S3 external requests
- Spawns external processes

## Verification
- Run: `python main.py`
