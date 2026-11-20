# utils

## Overview
Legacy utility engines for BRouter routing, polygon simplification, presets, and multi-format export.

## Interface
- `[auto_updater.py] def parse_version()`
- `[auto_updater.py] class UpdateCheckerThread`
- `[auto_updater.py]   UpdateCheckerThread.__init__()`
- `[auto_updater.py]   UpdateCheckerThread.run()`
- `[background_engine.py] class JobType`
- `[background_engine.py] class JobQueueWorker`
- `[background_engine.py]   JobQueueWorker.__init__()`
- `[background_engine.py]   JobQueueWorker.enqueue_route_leg()`
- `[background_engine.py]   JobQueueWorker.enqueue_azimut_leg()`
- `[background_engine.py]   JobQueueWorker.clear_queue()`
- `[background_engine.py]   JobQueueWorker.run()`
- `[background_engine.py]   JobQueueWorker.stop()`
- `[export_content.py] def extract_step_content()`
- `[export_csv.py] def export_csv_file()`
- `[export_docx.py] def export_docx()`
- `[export_html.py] def export_html()`
- `[export_odt.py] def render_odt()`
- `[export_odt.py] def export_odt()`
- `[ign_client.py] class _TTLCache`
- `[ign_client.py]   _TTLCache.__init__()`
- `[ign_client.py]   _TTLCache.get()`
- `[ign_client.py]   _TTLCache.put()`
- `[ign_client.py]   _TTLCache.clear()`
- `[ign_client.py] class IGNClient`
- `[ign_client.py]   IGNClient.__init__()`
- *(and 52 more exported symbols)*

## Invariants
- None

## Side Effects
- Filesystem operations (file read/write)
- Network / HTTP / S3 external requests

## Verification
- Run: `python main.py`
