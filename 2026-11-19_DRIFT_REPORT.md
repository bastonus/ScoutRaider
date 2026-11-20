# EGM Drift Report

**Date**: 2026-11-19  
**Target**: ScoutRaider Repository Subtree Contracts and Architecture Documents  

---

## README.md

- **Scope Evolution**: Root overview was updated to reflect version `0.3.11` and the dual-target architecture (Web SPA + Electron Desktop + FastAPI backend). Previous human documentation primarily focused on user-facing release notes without detailing subsystem contract boundaries (`electron/`, `backend/`, `legacy/`, `src/`).
- **Missing CLI Script Reference**: Root scripts `start.sh` and `test_overpass.js` / `test_poi.ts` are present in root but are development utilities rather than production modules.

---

## backend/README.md

- **Undocumented Subdirectories**: The structure tree and architectural notes only listed `api/`, `models/`, `schemas/`, and `services/`. The codebase has expanded to include `backend/app/ai/`, `backend/app/connectors/`, `backend/app/diffraction/`, `backend/app/mcp/`, `backend/app/modules/`, and `backend/app/renderer/`.
- **API Endpoint Coverage**: The structure diagram omitted `backend/app/api/health.py` (system health checks) and `backend/app/api/projects.py` (shared project access routes).
- **Direct Entry Point**: Root file `backend/run_server.py` provides uvicorn launch orchestration but was previously omitted from the interface manifest.

---

## backend/alembic/README.md

No drift detected.

---

## backend/alembic/versions/README.md

No drift detected.

---

## backend/app/README.md

- **Coverage**: Root `app/` coordinates FastAPI initialization (`main.py`), database engines (`database.py`, `db.py`), settings (`config.py`), and authentication utilities (`auth.py`). All 6 root modules are grounded in code.

---

## backend/app/ai/README.md

No drift detected.

---

## backend/app/api/README.md

- **Route Count**: Documented interface captures 38 router endpoints across 8 router modules (`assets.py`, `auth.py`, `documents.py`, `export.py`, `health.py`, `import_export.py`, `projects.py`, `share.py`). Fully aligned with router declarations.

---

## backend/app/connectors/README.md

No drift detected.

---

## backend/app/diffraction/README.md

No drift detected.

---

## backend/app/mcp/README.md

No drift detected.

---

## backend/app/models/README.md

No drift detected.

---

## backend/app/modules/README.md

No drift detected.

---

## backend/app/renderer/README.md

No drift detected.

---

## backend/app/schemas/README.md

No drift detected.

---

## backend/app/services/README.md

No drift detected.

---

## electron/README.md

No drift detected.

---

## legacy/README.md

- **Module Count Divergence**: Historical README mentions 11 test modules. The codebase contains 12 active module packages in `legacy/modules/` (`avocat`, `carte_ign`, `carte_simple`, `cassis`, `drapeaux`, `gilwell`, `maritime`, `morse`, `polybe`, `templier`, `texte_clair`, `vigenere`).
- **Architectural Role**: The legacy codebase reflects PySide6 desktop architecture from Beta 0.1.8. It is maintained alongside the modern Electron/React codebase for reference routing and polygonization algorithms.

---

## legacy/modules/README.md

No drift detected.

---

## legacy/modules/avocat/README.md

No drift detected.

---

## legacy/modules/carte_ign/README.md

No drift detected.

---

## legacy/modules/carte_simple/README.md

No drift detected.

---

## legacy/modules/cassis/README.md

No drift detected.

---

## legacy/modules/drapeaux/README.md

No drift detected.

---

## legacy/modules/gilwell/README.md

No drift detected.

---

## legacy/modules/maritime/README.md

No drift detected.

---

## legacy/modules/morse/README.md

No drift detected.

---

## legacy/modules/polybe/README.md

No drift detected.

---

## legacy/modules/templier/README.md

No drift detected.

---

## legacy/modules/texte_clair/README.md

No drift detected.

---

## legacy/modules/vigenere/README.md

No drift detected.

---

## legacy/ui/README.md

No drift detected.

---

## legacy/ui/workspace/README.md

No drift detected.

---

## legacy/utils/README.md

No drift detected.

---

## src/README.md

No drift detected.

---

## src/components/README.md

No drift detected.

---

## src/components/layout/README.md

No drift detected.

---

## src/components/map/README.md

No drift detected.

---

## src/components/panels/README.md

No drift detected.

---

## src/components/textual/README.md

No drift detected.

---

## src/logic/README.md

No drift detected.

---

## src/modules/README.md

No drift detected.

---

## src/modules/gilwell/README.md

No drift detected.

---

## src/modules/gilwell/components/README.md

No drift detected.

---

## src/modules/gilwell/logic/README.md

No drift detected.

---

## src/pages/README.md

No drift detected.

---

## src/services/README.md

No drift detected.

---

## src/types/README.md

No drift detected.
