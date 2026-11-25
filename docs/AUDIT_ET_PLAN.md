# ScoutRaider — Audit Complet (UI, Frontend, Electron, Backend) & Plan de Remédiation

> **État de référence** : `npm run typecheck` (`tsc --noEmit`) et `npm test` (`vitest run`, 4 fichiers / 28 tests) passent.

---

## 1. UI, Design System & Accessibilité

- **Aucun `ErrorBoundary` React** (`src/`) : toute erreur d'exécution dans Leaflet, Markdown ou un module de chiffrement fait planter toute l'application.
- **Variable CSS `--text-bright` non définie** (`src/index.css`) : référencée dans 7 fichiers (`MarketplacePage.tsx`, `RightSidebar.tsx`, `MapHUD.tsx`, `MapSettings.tsx`, `LeftSidebarPanel.tsx`, `MarketplaceModal.tsx`, `MetroTimeline.tsx`).
- **Modales sans sémantique ARIA ni focus trap** : seule `src/modules/gilwell/components/ExportModal.tsx` définit `role="dialog"` et `aria-modal="true"`. `AuthModal`, `PreferencesModal` et les 10+ autres modales en sont dépourvues.
- **Contraste insuffisant (`--text-dim`)** : `#71717A` sur `#09090B` / `#18181B` (~3.8:1–4.1:1) échoue au seuil WCAG AA (4.5:1) pour les libellés `11px` (`.lbl`).
- **Contrôles non sémantiques** : séparateurs redimensionnables souris-uniquement (`App.tsx`, `ProjectWorkspace.tsx`), onglets `<div>` cliquables (`PreferencesModal.tsx`), logo cliquable `<div>` (`MarketplacePage.tsx`), `<label>` sans `htmlFor`/`id` (`LoginPage.tsx`).
- **8 `window.confirm()` natifs** (`ProjectsHomePage.tsx`, `LayerManagerPanel.tsx`, `UnifiedContextMenu.tsx`, `ThemeEditorModal.tsx`, `PresetEditorModal.tsx`, `CloudProjectsModal.tsx`).
- **Polices Google Fonts dupliquées & dépendantes d'Internet** : chargées à la fois dans `index.html` et via `@import url(...)` dans `src/index.css`.
- **Incohérence de charte & raccourci `Ctrl+P`** : `LoginPage.tsx` / `RouterRoot.tsx` utilisent `#6EC97E` / `#0d1511` au lieu de `#2563EB` / `#09090B`; `App.tsx` intercepte `Ctrl+P` pour les Préférences.

---

## 2. Architecture Frontend, État & Services

- **Fermeture périmée (stale closure) dans `EditorPage.tsx`** (`src/pages/EditorPage.tsx#L65-L77`) : `cloudSync.initialize({ getState: () => state })` capture l'état initial et n'est pas réactualisé ensuite.
- **Deux piles Auth / Sync concurrentes** : `AuthContext.tsx` + `CloudAuthService.ts` vs `src/services/api.ts` + `cloudSync.ts`. De plus, `assetsApi.upload()` envoie `document_id` dans `FormData` alors que le backend attend un paramètre `Query` UUID.
- **Composants monolithiques** : `TextualView.tsx` (1 681 l.), `CarnetStepBlock.tsx` (1 591 l.), `UnifiedResourceHub.tsx` (1 579 l.), `ProjectsHomePage.tsx` (1 421 l.), `MenuBar.tsx` (1 323 l.), `LayerManagerPanel.tsx` (1 253 l.).
- **Dépendances inutilisées dans `package.json`** : `@blocknote/*`, `@mantine/*`, `@ckeditor/*`, `@tiptap/*`, `react-quill`, `quill-image-resize-module-react`, `dockview`, `flexlayout-react` ont zéro import dans `src/` (seul `.dockview-theme-dark` reste dans `src/index.css`).
- **Écouteurs `resize` dupliqués** dans `App.tsx`, `ProjectWorkspace.tsx`, `MenuBar.tsx`, `MarketplacePage.tsx`, `PreferencesModal.tsx`.

---

## 3. Electron (`electron/main.js`, `electron/preload.js`)

- **IPC fichiers non sandboxés** (`read-file`, `read-file-base64`, `write-file`) : acceptent n'importe quel chemin envoyé par le renderer sans liste blanche de répertoires.
- **Fichier de log dans le bundle** (`path.join(__dirname, '../scoutraider.log')`) : échoue en production packagée (lecture seule); doit utiliser `app.getPath('logs')`.
- **Absence de CSP / `setWindowOpenHandler` / `will-navigate`** et `sandbox: false` dans `renderHtmlToPdfWithChromium` avec délai fixe de `600ms`.
- **Code mort `createMenu()`** commenté dans `electron/main.js`.

---

## 4. Backend FastAPI (`backend/app/`)

- **Contournement d'autorisation sur `POST /api/assets`** (`backend/app/api/assets.py#L49-L59`) : vérifie l'existence d'un `ShareLink` en édition sur le document sans vérifier que l'utilisateur courant détient ce lien. Lecture complète du fichier en RAM avant vérification de taille et `file.filename.endswith(...)` non protégé contre `None`.
- **Route debug non authentifiée** : `GET /api/auth/debug/test-db` dans `backend/app/api/auth.py#L84-L89`.
- **Modules morts avec secret codé en dur** : `backend/app/auth.py` (secret JWT par défaut) et `backend/app/db.py` (1 329 l.) ne sont importés nulle part dans `backend/app/`.
- **Génération PDF bloquante & `Content-Disposition` non assaini** dans `backend/app/api/export.py#L62-L74`.
- **CORS** (`backend/app/config.py`) : n'inclut pas l'origine Electron packagée (`null` / `file://`).

---

## 5. Plan de Remédiation

1. **Phase 1 — Sécurité & Intégrité des données** : corriger la ref `stateRef` dans `EditorPage.tsx`, unifier les services API/Sync (`assetsApi.upload`), corriger la vérification de partage dans `assets.py`, supprimer `/debug/test-db`, `app/auth.py` et `app/db.py`, exécuter WeasyPrint en threadpool, sandboxer les IPC fichiers Electron et déplacer les logs vers `app.getPath('logs')`.
2. **Phase 2 — UI, Design System & Accessibilité** : ajouter des `ErrorBoundary`, définir `--text-bright` et relever `--text-dim`, auto-héberger les polices, créer `<Modal>` et `<ConfirmDialog>` accessibles, remplacer les `<div>` cliquables et `window.confirm()`, passer les Préférences sur `Ctrl+,`.
3. **Phase 3 — Nettoyage & Modularisation** : purger les 6 dépendances inutilisées de `package.json`, extraire `useViewport()`, découper les composants > 1 000 lignes et étendre les tests UI/backend.
