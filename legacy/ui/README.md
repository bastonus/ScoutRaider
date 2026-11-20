# ui

## Overview
Legacy PySide6 desktop user interface wizard steps and dialog components.

## Interface
- `[step1_import.py] class Step1Import`
- `[step1_import.py]   Step1Import.__init__()`
- `[step1_import.py]   Step1Import.import_geojson()`
- `[step1_import.py]   Step1Import.draw_map()`
- `[step1_import.py]   Step1Import.update_from_state()`
- `[step2_polygon.py] class PolyWorker`
- `[step2_polygon.py]   PolyWorker.__init__()`
- `[step2_polygon.py]   PolyWorker.run()`
- `[step2_polygon.py] class Step2Polygon`
- `[step2_polygon.py]   Step2Polygon.__init__()`
- `[step2_polygon.py]   Step2Polygon.on_slider_changed()`
- `[step2_polygon.py]   Step2Polygon.on_bypass_toggled()`
- `[step2_polygon.py]   Step2Polygon.on_setting_changed()`
- `[step2_polygon.py]   Step2Polygon.update_live_feedback()`
- `[step2_polygon.py]   Step2Polygon.on_map_generated()`
- `[step3_mode.py] class Step3Mode`
- `[step3_mode.py]   Step3Mode.__init__()`
- `[step3_mode.py]   Step3Mode.on_mode_changed()`
- `[step3_mode.py]   Step3Mode.update_from_state()`
- `[step4a_auto.py] class OverrideDialog`
- `[step4a_auto.py]   OverrideDialog.__init__()`
- `[step4a_auto.py]   OverrideDialog.get_new_overrides()`
- `[step4a_auto.py] class Step4AAuto`
- `[step4a_auto.py]   Step4AAuto.__init__()`
- `[step4a_auto.py]   Step4AAuto.populate_themes()`
- *(and 30 more exported symbols)*

### Subdirectories
- [workspace](./workspace/README.md) - Legacy PySide6 workspace widgets, map canvas, and inspector docks.

## Invariants
- [step1_import.py] Enforces: ValueError("Aucune feature trouvée dans les fichiers.")

## Side Effects
- Filesystem operations (file read/write)
- Network / HTTP / S3 external requests
- Spawns external processes

## Verification
- Run: `python main.py`
