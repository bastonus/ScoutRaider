# electron

## Overview

Desktop runtime wrapper for ScoutRaider built on Electron (`electron/main.js` ES module main process and `electron/preload.js` CommonJS context-bridge preload). Manages the frameless application window, OS file associations, Overpass API User-Agent compliance, local project/raw file I/O, HTML/PDF export pipelines, auto-updates via `electron-updater`, and file logging.

## Window Lifecycle & Runtime Configuration

### Frameless Window (`createWindow`)
- **Geometry & Appearance**: `1440×900`, `backgroundColor: '#1c1c20'`, `frame: false`, `titleBarStyle: 'hidden'` (preserves macOS traffic lights while hiding the native title bar), and icon `../build/icon.png`.
- **Native Menu**: `mainWindow.setMenu(null)` disables the native menu bar on the window (`createMenu()` defines a French `Fichier` / `Édition` / `Affichage` template that emits `'menu-action'`, though its call in `app.whenReady()` is currently commented out).
- **Content Loading**:
  - When `process.env.NODE_ENV === 'development'` or `!app.isPackaged`, attempts `http://localhost:5173` and falls back to `../dist/index.html` if the dev server is unreachable. Automatically calls `openDevTools()` when `NODE_ENV === 'development'`.
  - In packaged builds, loads `../dist/index.html` directly.
- **DevTools & Context Menu**:
  - Right-click `context-menu` provides *Inspecter l'élément*, conditional edit actions (*Copier*, *Couper*, *Coller*, *Tout sélectionner*), *Recharger la page*, and *Ouvrir la console* (`F12`).
  - `before-input-event` intercepts `F12` (`keyDown`) to toggle DevTools.
- **App Lifecycle**:
  - `app.whenReady()` configures the session User-Agent and creates the main window.
  - `activate` recreates the window on macOS if `BrowserWindow.getAllWindows().length === 0`.
  - `window-all-closed` calls `app.quit()` on non-macOS platforms (`process.platform !== 'darwin'`).
  - `did-finish-load` flushes any queued startup file path to the renderer via `'open-project-at-path'`.

### File Associations (`.srdoc`, `.scoutproj`)
- **Windows / Linux**: At startup (`process.platform !== 'darwin'`), scans `process.argv` for an argument ending in `.srdoc` or `.scoutproj` and queues it in `filePathToOpen` until `did-finish-load`.
- **macOS (`open-file`)**: Intercepts `app.on('open-file')` (`event.preventDefault()`). Sends `'open-project-at-path'` immediately if `mainWindow` exists, or queues it in `filePathToOpen` until `did-finish-load`.
- **Packaging**: `package.json` (`build.fileAssociations`) registers `.srdoc` (*ScoutRaider Document*) for `electron-builder` packages; runtime handlers and dialogs support both `.srdoc` and `.scoutproj`.

### Custom Overpass User-Agent
- Inside `app.whenReady()`, `session.defaultSession.setUserAgent(...)` sets:
  ```text
  ScoutRaider/<app.getVersion()> (https://github.com/bastonus/ScoutRaider; ScoutRaider Desktop App)
  ```
- Prevents OpenStreetMap Overpass API endpoints from rejecting requests with HTTP `406 Not Acceptable` due to Electron's default User-Agent.

## `window.electronAPI` IPC Reference

All renderer-to-main and main-to-renderer channels exposed by `electron/preload.js` via `contextBridge.exposeInMainWorld('electronAPI', ...)`. Event listener helpers (`on*`) return an unsubscribe cleanup function.

### App Info
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `getAppVersion()` | `get-app-version` | `invoke` | Returns `app.getVersion()`. |

### Project Persistence
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `saveScoutproj(stateJSON, filepath, defaultName)` | `save-scoutproj` | `invoke` | Writes UTF-8 `stateJSON` to `filepath`, or opens a `.srdoc`/`.scoutproj` save dialog if `filepath` is falsy. Returns saved path or `false` if canceled. |
| `openScoutproj()` | `open-scoutproj` | `invoke` | Opens a `.srdoc`/`.scoutproj` file dialog and returns `{ state, filepath }`, or `null` if canceled. |

### Dialogs
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `showSaveDialog(defaultName, format)` | `show-save-dialog` | `invoke` | Opens native save dialog filtered by `format` (`pdf`, `html`, `csv`, or default `srdoc`/`scoutproj`). Returns selected path or `null`. |
| `showOpenDialog(filters)` | `show-open-dialog` | `invoke` | Opens native `openFile` dialog using `filters` (defaults to `.srdoc`/`.scoutproj` and `*`). Returns first selected path or `null`. |
| `showExportDialog(defaultName, format)` | `show-export-dialog` | `invoke` | Exposed in `preload.js` (no matching `ipcMain.handle` is registered in `main.js`; `showSaveDialog` handles export formats). |

### Export & PDF Engines
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `exportFile(html, format, outputPath, engine)` | `export-file` | `invoke` | Writes UTF-8 HTML for `format === 'html'`, or calls `renderHtmlToPdf(html, outputPath, engine)` (`engine` defaults to `'auto'`) for `format === 'pdf'`. Returns `true` on success (`false` for other formats; throws on PDF failure). |
| `checkWeasyPrint()` | `check-weasyprint` | `invoke` | Probes WeasyPrint CLI candidates with `--version` (5 s timeout). Returns `{ available: true, version }` or `{ available: false }`. |
| `convertHtmlToPdf(html, outputPath, engine)` | `convert-html-to-pdf` | `invoke` | Invokes `renderHtmlToPdf(html, outputPath, engine)` (`engine` defaults to `'auto'`). Returns `{ success: true }` or `{ success: false, error }`. |
| `printToPdf(html, outputPath)` | `print-to-pdf` | `invoke` | Directly invokes Chromium `renderHtmlToPdfWithChromium(html, outputPath)`. Returns `{ success: true }` or `{ success: false, error }`. |

### Raw File I/O
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `readFile(path)` | `read-file` | `invoke` | Reads UTF-8 file; resolves relative paths against repo/app root (`..`), falling back to `process.cwd()`. |
| `readFileBase64(path)` | `read-file-base64` | `invoke` | Probes relative resolution against repo/app root, `process.cwd()`, and `electron/` (`__dirname`), returning Base64 string or `null`. |
| `writeFile(path, data)` | `write-file` | `invoke` | Writes UTF-8 `data` to `path` and returns `true`. |

### Menu Actions
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `onMenuAction(callback)` | `menu-action` | `main → renderer` | Subscribes to menu action strings (`'new'`, `'open'`, `'save'`, `'save-as'`, `'undo'`, `'redo'`). |
| `onOpenProjectAtPath(callback)` | `open-project-at-path` | `main → renderer` | Subscribes to OS file-open paths passed via CLI `argv` or macOS `open-file`. |

### Window Controls
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `windowControl(action)` | `window-control` | `invoke` | Executes `'minimize'`, `'maximize'` (toggles maximize/unmaximize), or `'close'` on the sender's `BrowserWindow`. |
| `toggleDevTools()` | `toggle-devtools` | `invoke` | Toggles DevTools on the sender's `BrowserWindow`. |

### Auto-Updater
Powered by `electron-updater` (`autoUpdater.autoDownload = true`), routing updater logs to `scoutraider.log`:

| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `checkForUpdates()` | `check-for-updates` | `invoke` | Returns `{ error: 'DEV_MODE' }` and emits `'update-error'` in unpackaged dev mode (`!app.isPackaged && NODE_ENV === 'development'`); otherwise calls `autoUpdater.checkForUpdates()`. |
| `downloadUpdate()` | `download-update` | `invoke` | Calls `autoUpdater.downloadUpdate()` and returns `true`. |
| `quitAndInstall()` | `quit-and-install` | `invoke` | Calls `autoUpdater.quitAndInstall()`. |
| `onUpdateChecking(callback)` | `update-checking` | `main → renderer` | Fired when update check starts. |
| `onUpdateAvailable(callback)` | `update-available` | `main → renderer` | Receives update `info` when a release is available. |
| `onUpdateNotAvailable(callback)` | `update-not-available` | `main → renderer` | Receives `info` when already up to date. |
| `onUpdateError(callback)` | `update-error` | `main → renderer` | Receives error string on update failure or `'DEV_MODE'`. |
| `onUpdateProgress(callback)` | `update-progress` | `main → renderer` | Receives `progress` payload during download. |
| `onUpdateDownloaded(callback)` | `update-downloaded` | `main → renderer` | Receives `info` once the update installer is downloaded. |

### Logging
| Method | IPC Channel | Direction | Behavior |
| --- | --- | --- | --- |
| `writeLog(level, msg)` | `write-log` | `invoke` | Appends `[<ISO-timestamp>] [<LEVEL>] <msg>\n` asynchronously to `../scoutraider.log`. |

## PDF Export Pipeline: WeasyPrint & Chromium `printToPDF` Fallback

`renderHtmlToPdf(html, outputPath, engine = 'auto')` routes HTML-to-PDF rendering as follows:

1. **Engine Selection**:
   - `engine === 'electron'`: runs `renderHtmlToPdfWithChromium` directly.
   - `engine === 'weasyprint'`: runs `renderHtmlToPdfWithWeasyPrint` directly without fallback.
   - `engine === 'auto'` (default): runs `renderHtmlToPdfWithWeasyPrint` first; if it fails (`!weasyResult.success`), logs a warning and falls back to `renderHtmlToPdfWithChromium`.
2. **WeasyPrint Path (`renderHtmlToPdfWithWeasyPrint`)**:
   - Writes HTML to `os.tmpdir()/scoutraider_export_<timestamp>_<rand>.html`.
   - Probes candidates from `getWeasyPrintCandidates()` in order via `execFile` (`timeout: 120000`, `maxBuffer: 20 MB`, `windowsHide: true`):
     1. `weasyprint`
     2. `python -m weasyprint`
     3. `%LOCALAPPDATA%\Programs\Python\Python312\Scripts\weasyprint.exe`
     4. `%LOCALAPPDATA%\Programs\Python\Python312\python.exe -m weasyprint`
     5. `py -3.12 -m weasyprint`
     6. `python3 -m weasyprint`
   - Deletes the temporary HTML file after execution and returns `{ success: true }` or `{ success: false, error }`.
3. **Chromium Fallback Path (`renderHtmlToPdfWithChromium`)**:
   - Writes HTML to `os.tmpdir()/scoutraider_print_<timestamp>_<rand>.html`.
   - Creates a hidden offscreen `BrowserWindow` (`show: false`, `offscreen: true`, `sandbox: false`), loads the temporary HTML file, and waits `600` ms for fonts and layout to settle.
   - Prints via `printWin.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { marginType: 'none' } })`.
   - Writes the resulting PDF buffer to `outputPath`, removes the temporary HTML file, and closes `printWin`.

## Security Model & Invariants

- **Renderer Isolation**: `mainWindow` enforces `contextIsolation: true` and `nodeIntegration: false` in `webPreferences`.
- **Preload Bridge**: `electron/preload.js` exposes only the explicit `window.electronAPI` surface via `contextBridge`; raw `ipcRenderer` and Node.js APIs are never exposed to the renderer.
- **Offscreen Print Window**: Only the short-lived hidden `BrowserWindow` created inside `renderHtmlToPdfWithChromium` sets `offscreen: true` and `sandbox: false` to render local temporary export HTML before closing immediately.

## Side Effects

- Filesystem reads/writes for `.srdoc` / `.scoutproj` projects, raw files, exported HTML/PDF outputs, temporary HTML files in `os.tmpdir()`, and log appends to `../scoutraider.log`.
- Spawns local Python/WeasyPrint subprocesses via `execFile`.
- Modifies `session.defaultSession` User-Agent globally and triggers `electron-updater` network checks/downloads.

## Verification

- Launch Electron against local dev server (or `dist/index.html` fallback):
  ```bash
  npm run electron
  ```
- Launch Vite dev server and wait for `http://localhost:5173` before starting Electron:
  ```bash
  npm run electron:dev
  ```
