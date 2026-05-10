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
        const listener = (_event, action) => callback(action);
        ipcRenderer.on('menu-action', listener);
        return () => ipcRenderer.removeListener('menu-action', listener);
    },

    onOpenProjectAtPath: (callback) => {
        const listener = (_event, path) => callback(path);
        ipcRenderer.on('open-project-at-path', listener);
        return () => ipcRenderer.removeListener('open-project-at-path', listener);
    },

    // ─── Window Controls ──────────────────────────────────────────────
    windowControl: (action) => ipcRenderer.invoke('window-control', action),
    toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),

    // ─── Auto Updater ─────────────────────────────────────────────────
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    onUpdateAvailable: (callback) => {
        const l = (_event, info) => callback(info);
        ipcRenderer.on('update-available', l);
        return () => ipcRenderer.removeListener('update-available', l);
    },
    onUpdateNotAvailable: (callback) => {
        const l = (_event, info) => callback(info);
        ipcRenderer.on('update-not-available', l);
        return () => ipcRenderer.removeListener('update-not-available', l);
    },
    onUpdateError: (callback) => {
        const l = (_event, error) => callback(error);
        ipcRenderer.on('update-error', l);
        return () => ipcRenderer.removeListener('update-error', l);
    },
    onUpdateDownloaded: (callback) => {
        const l = (_event, info) => callback(info);
        ipcRenderer.on('update-downloaded', l);
        return () => ipcRenderer.removeListener('update-downloaded', l);
    },

    // ─── Logging ──────────────────────────────────────────────────────
    writeLog: (level, msg) => ipcRenderer.invoke('write-log', level, msg)
});

