const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ─── App info ─────────────────────────────────────────────────────
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // ─── Project persistence (.scoutproj) ─────────────────────────────
    saveScoutproj: (stateJSON, filepath) =>
        ipcRenderer.invoke('save-scoutproj', stateJSON, filepath),

    openScoutproj: () =>
        ipcRenderer.invoke('open-scoutproj'),

    // ─── File dialogs ─────────────────────────────────────────────────
    showSaveDialog: (defaultName, format) =>
        ipcRenderer.invoke('show-save-dialog', defaultName, format),

    showOpenDialog: (filters) =>
        ipcRenderer.invoke('show-open-dialog', filters),

    // ─── Export (HTML / PDF) ──────────────────────────────────────────
    exportFile: (html, format, outputPath) =>
        ipcRenderer.invoke('export-file', html, format, outputPath),

    showExportDialog: (defaultName, format) =>
        ipcRenderer.invoke('show-export-dialog', defaultName, format),

    // ─── WeasyPrint ───────────────────────────────────────────────────
    checkWeasyPrint: () =>
        ipcRenderer.invoke('check-weasyprint'),

    convertHtmlToPdf: (html, outputPath) =>
        ipcRenderer.invoke('convert-html-to-pdf', html, outputPath),

    // ─── Raw file I/O ─────────────────────────────────────────────────
    readFile: (path) =>
        ipcRenderer.invoke('read-file', path),

    readFileBase64: (path) =>
        ipcRenderer.invoke('read-file-base64', path),

    writeFile: (path, data) =>
        ipcRenderer.invoke('write-file', path, data),

    // ─── Menu actions (main → renderer) ───────────────────────────────
    onMenuAction: (callback) => {
        ipcRenderer.on('menu-action', (_event, action) => callback(action));
    },

    // ─── Window Controls ──────────────────────────────────────────────
    windowControl: (action) => ipcRenderer.invoke('window-control', action),
    toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),

    // ─── Auto Updater ─────────────────────────────────────────────────
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (_event, info) => callback(info)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, error) => callback(error)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),

    // ─── Logging ──────────────────────────────────────────────────────
    writeLog: (level, msg) => ipcRenderer.invoke('write-log', level, msg)
});

