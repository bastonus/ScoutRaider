# workspace

## Overview
Legacy PySide6 workspace widgets, map canvas, and inspector docks.

## Interface
- `[difficulty_panel.py] class _SummaryWidget`
- `[difficulty_panel.py]   _SummaryWidget.__init__()`
- `[difficulty_panel.py]   _SummaryWidget.update_summary()`
- `[difficulty_panel.py] class PresetEditorDialog`
- `[difficulty_panel.py]   PresetEditorDialog.__init__()`
- `[difficulty_panel.py] class DifficultyPanel`
- `[difficulty_panel.py]   DifficultyPanel.__init__()`
- `[difficulty_panel.py]   DifficultyPanel.load_presets()`
- `[difficulty_panel.py]   DifficultyPanel.refresh_from_state()`
- `[difficulty_panel.py]   DifficultyPanel.set_state_manager()`
- `[export_gallery.py] class _ExportOptionsBar`
- `[export_gallery.py]   _ExportOptionsBar.__init__()`
- `[export_gallery.py]   _ExportOptionsBar.current_fmt_key()`
- `[export_gallery.py] class _ProgressWidget`
- `[export_gallery.py]   _ProgressWidget.__init__()`
- `[export_gallery.py] class _ExportCard`
- `[export_gallery.py]   _ExportCard.__init__()`
- `[export_gallery.py] class ExportGallery`
- `[export_gallery.py]   ExportGallery.__init__()`
- `[export_gallery.py]   ExportGallery.start_progress()`
- `[export_gallery.py]   ExportGallery.update_progress()`
- `[export_gallery.py]   ExportGallery.finish_progress()`
- `[export_gallery.py]   ExportGallery.add_entry()`
- `[export_panel.py] class ExportPanel`
- `[export_panel.py]   ExportPanel.__init__()`
- *(and 134 more exported symbols)*

## Invariants
- [GpPluginLeaflet.js] Requires: !(!t.type)
- [GpPluginLeaflet.js] Requires: !(null===t.startPoint.x)
- [GpPluginLeaflet.js] Requires: !(!i)
- [GpPluginLeaflet.js] Requires: !(null===t.position.x)
- [GpPluginLeaflet.js] Requires: !("GET"!==this.method)
- [GpPluginOpenLayers.js] Requires: !(!t.recoverable)
- [GpPluginOpenLayers.js] Requires: !(!n||3!==n.nodeType)
- [GpPluginOpenLayers.js] Requires: !(n&&void 0===t&&"|"===e)

## Side Effects
- Browser storage access (localStorage)
- DOM / browser window side effects
- Filesystem operations (file read/write)
- Network HTTP API calls (fetch/axios)
- Spawns external processes

## Verification
- Run: `python main.py`
