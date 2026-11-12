import { app, BrowserWindow, ipcMain, dialog, Menu, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { execFile } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Logging System ───────────────────────────────────────────────────────
const logFilePath = path.join(__dirname, '../scoutraider.log');

const logToFileSync = (level, msg) => {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`;
  // Use appendFile from fs/promises (imported as fs)
  fs.appendFile(logFilePath, formattedMsg, 'utf-8').catch(e => {
    console.error("Failed to write to log file", e);
  });
};

let mainWindow = null;
let filePathToOpen = null;

// Handle Windows/Linux file association via argv
if (process.platform !== 'darwin') {
  const argv = process.argv;
  const fileArg = argv.find(arg => arg.endsWith('.srdoc') || arg.endsWith('.scoutproj'));
  if (fileArg) filePathToOpen = fileArg;
}

// Handle macOS file association
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('open-project-at-path', path);
  } else {
    filePathToOpen = path;
  }
});

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Nouveau',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu-action', 'new')
        },
        {
          label: 'Ouvrir...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu-action', 'open') // The frontend will then call window.electronAPI.openScoutproj()
        },
        { type: 'separator' },
        {
          label: 'Enregistrer',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu-action', 'save') // Frontend will call window.electronAPI.saveScoutproj()
        },
        {
          label: 'Enregistrer sous...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu-action', 'save-as')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        {
          label: 'Annuler',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu-action', 'undo')
        },
        {
          label: 'Rétablir',
          accelerator: 'Shift+CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu-action', 'redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#1c1c20',
    frame: false, // Frameless window
    titleBarStyle: 'hidden', // Hide title bar but keep traffic lights on Mac if needed
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../build/icon.png'),
  });

  // Remove native menu
  mainWindow.setMenu(null);

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Once the window is ready, if we have a file to open, send it to the renderer
  mainWindow.webContents.on('did-finish-load', () => {
    if (filePathToOpen) {
      mainWindow.webContents.send('open-project-at-path', filePathToOpen);
      filePathToOpen = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Add context menu with Inspect Element, standard edit actions, and DevTools
  mainWindow.webContents.on('context-menu', (event, params) => {
    const template = [
      {
        label: 'Inspecter l\'élément',
        click: () => {
          mainWindow.webContents.inspectElement(params.x, params.y);
        }
      },
      { type: 'separator' }
    ];

    // Add edit actions if applicable
    if (params.editFlags.canCopy) template.push({ role: 'copy', label: 'Copier' });
    if (params.editFlags.canCut) template.push({ role: 'cut', label: 'Couper' });
    if (params.editFlags.canPaste) template.push({ role: 'paste', label: 'Coller' });
    if (params.editFlags.canSelectAll) template.push({ role: 'selectAll', label: 'Tout sélectionner' });

    if (template.length > 2) {
      template.push({ type: 'separator' });
    }

    template.push(
      {
        label: 'Recharger la page',
        role: 'reload'
      },
      {
        label: 'Ouvrir la console',
        accelerator: 'F12',
        click: () => {
          mainWindow.webContents.toggleDevTools();
        }
      }
    );

    const contextMenu = Menu.buildFromTemplate(template);
    contextMenu.popup();
  });

  // Handle F12 shortcut for DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  // Overpass API requires a custom User-Agent and often blocks the default Electron one (406 Not Acceptable).
  // We set a unique identifier for the entire session.
  const appVersion = app.getVersion();
  const customUA = `ScoutRaider/${appVersion} (https://github.com/bastonus/ScoutRaider; ScoutRaider Desktop App)`;
  session.defaultSession.setUserAgent(customUA);

  // createMenu();
  createWindow();

  // Update check is now triggered by MenuBar.tsx to respect preferences.

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── Auto Updater ─────────────────────────────────────────────────────────

autoUpdater.autoDownload = true;

// Configure autoUpdater to use our logging system
autoUpdater.logger = {
  info: (msg) => logToFileSync('INFO', `[Updater] ${msg}`),
  warn: (msg) => logToFileSync('WARN', `[Updater] ${msg}`),
  error: (msg) => logToFileSync('ERROR', `[Updater] ${msg}`),
};

autoUpdater.on('checking-for-update', () => {
  logToFileSync('INFO', 'Checking for update...');
  if (mainWindow) mainWindow.webContents.send('update-checking');
});

autoUpdater.on('update-available', (info) => {
  logToFileSync('INFO', `Update available: ${info.version}`);
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  logToFileSync('INFO', 'Update not available.');
  if (mainWindow) mainWindow.webContents.send('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  logToFileSync('ERROR', `Update error: ${err.toString()}`);
  if (mainWindow) mainWindow.webContents.send('update-error', err.toString());
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) mainWindow.webContents.send('update-progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  logToFileSync('INFO', 'Update downloaded.');
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged && process.env.NODE_ENV === 'development') {
    if (mainWindow) mainWindow.webContents.send('update-error', 'DEV_MODE');
    return { error: 'DEV_MODE' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return result;
  } catch (err) {
    logToFileSync('ERROR', `Manual update check failed: ${err.toString()}`);
    if (mainWindow) mainWindow.webContents.send('update-error', err.toString());
    return { error: err.toString() };
  }
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
  return true;
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

// Window controls
ipcMain.handle('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (action === 'minimize') win.minimize();
  if (action === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  if (action === 'close') win.close();
});

ipcMain.handle('toggle-devtools', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.webContents.toggleDevTools();
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────

ipcMain.handle('get-app-version', () => app.getVersion());

// Show Save Dialog
ipcMain.handle('show-save-dialog', async (event, defaultName, format) => {
  const filters = format === 'pdf' ? [{ name: 'Document PDF', extensions: ['pdf'] }] :
                  format === 'html' ? [{ name: 'Page Web', extensions: ['html'] }] :
                  format === 'csv' ? [{ name: 'Fichier CSV', extensions: ['csv'] }] :
                  [{ name: 'Document ScoutRaider', extensions: ['srdoc', 'scoutproj'] }];

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer',
    defaultPath: defaultName || `projet.${format || 'srdoc'}`,
    filters
  });

  return canceled ? null : filePath;
});

// Show Open Dialog
ipcMain.handle('show-open-dialog', async (event, filters) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    properties: ['openFile'],
    filters: filters || [{ name: 'Projets ScoutRaider', extensions: ['srdoc', 'scoutproj'] }, { name: 'Tous les fichiers', extensions: ['*'] }]
  });

  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

// Save .srdoc
ipcMain.handle('save-scoutproj', async (event, stateJSON, filepath, defaultName) => {
  try {
    let targetPath = filepath;
    if (!targetPath) {
      const defName = defaultName ? (defaultName.endsWith('.srdoc') ? defaultName : `${defaultName}.srdoc`) : 'projet.srdoc';
      const { canceled, filePath: dialogPath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Enregistrer le projet',
        defaultPath: defName,
        filters: [{ name: 'Document ScoutRaider', extensions: ['srdoc', 'scoutproj'] }]
      });
      if (canceled) return false;
      targetPath = dialogPath;
    }
    
    await fs.writeFile(targetPath, stateJSON, 'utf-8');
    return targetPath;
  } catch (err) {
    console.error('Failed to save .srdoc:', err);
    throw err;
  }
});

// Open .srdoc
ipcMain.handle('open-scoutproj', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Ouvrir un projet',
      properties: ['openFile'],
      filters: [{ name: 'Projet ScoutRaider', extensions: ['srdoc', 'scoutproj'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    const data = await fs.readFile(filePaths[0], 'utf-8');
    return { state: data, filepath: filePaths[0] };
  } catch (err) {
    console.error('Failed to load .srdoc:', err);
    throw err;
  }
});

// Raw file IO
ipcMain.handle('read-file', async (event, filePath) => {
  return await fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('read-file-base64', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    return data.toString('base64');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  await fs.writeFile(filePath, data, 'utf-8');
  return true;
});

// ─── WeasyPrint Integration ───────────────────────────────────────────────

function getWeasyPrintCandidates() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const python312 = path.join(localAppData, 'Programs', 'Python', 'Python312');
  const python312Exe = path.join(python312, 'python.exe');
  const weasyprint312Exe = path.join(python312, 'Scripts', 'weasyprint.exe');

  return [
    { cmd: 'weasyprint', args: [] },
    { cmd: 'python', args: ['-m', 'weasyprint'] },
    { cmd: weasyprint312Exe, args: [] },
    { cmd: python312Exe, args: ['-m', 'weasyprint'] },
    { cmd: 'py', args: ['-3.12', '-m', 'weasyprint'] },
    { cmd: 'python3', args: ['-m', 'weasyprint'] },
  ];
}

async function renderHtmlToPdfWithWeasyPrint(html, outputPath) {
  const tmpDir = os.tmpdir();
  const tmpHtml = path.join(tmpDir, `scoutraider_export_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);

  try {
    await fs.writeFile(tmpHtml, html, 'utf-8');
    const candidates = getWeasyPrintCandidates();
    let lastError = null;

    for (const c of candidates) {
      try {
        const ok = await new Promise((resolve, reject) => {
          const runArgs = [...c.args, tmpHtml, outputPath];
          execFile(c.cmd, runArgs, {
            timeout: 120000,
            maxBuffer: 1024 * 1024 * 20,
            windowsHide: true,
          }, (err, stdout, stderr) => {
            if (err) {
              return reject(new Error(stderr || err.message));
            }
            resolve(true);
          });
        });

        if (ok) {
          try { await fs.unlink(tmpHtml); } catch { /* ignore */ }
          return { success: true };
        }
      } catch (e) {
        lastError = e;
      }
    }

    try { await fs.unlink(tmpHtml); } catch { /* ignore */ }
    return {
      success: false,
      error: lastError ? lastError.message : 'Aucun binaire WeasyPrint valide trouvé sur le système.'
    };
  } catch (err) {
    try { await fs.unlink(tmpHtml); } catch { /* ignore */ }
    return { success: false, error: err.message };
  }
}

// Export File (PDF / HTML)
ipcMain.handle('export-file', async (event, html, format, outputPath) => {
  try {
    if (format === 'html') {
      await fs.writeFile(outputPath, html, 'utf-8');
      return true;
    } 
    
    if (format === 'pdf') {
      const res = await renderHtmlToPdfWithWeasyPrint(html, outputPath);
      if (res.success) {
        return true;
      }
      throw new Error(`WeasyPrint export failed: ${res.error}`);
    }
    
    return false;
  } catch (err) {
    console.error('Export failed:', err);
    throw err;
  }
});

// Check if WeasyPrint is available
ipcMain.handle('check-weasyprint', async () => {
  const candidates = getWeasyPrintCandidates();
  for (const c of candidates) {
    try {
      const ver = await new Promise((resolve, reject) => {
        execFile(c.cmd, [...c.args, '--version'], { timeout: 5000, windowsHide: true }, (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout.trim());
        });
      });
      if (ver) {
        return { available: true, version: ver };
      }
    } catch {
      // Try next candidate
    }
  }
  return { available: false };
});

// Convert HTML to PDF via WeasyPrint
ipcMain.handle('convert-html-to-pdf', async (event, html, outputPath) => {
  return await renderHtmlToPdfWithWeasyPrint(html, outputPath);
});

// ─── Custom Logger ────────────────────────────────────────────────────────
ipcMain.handle('write-log', async (event, level, msg) => {
  logToFileSync(level, msg);
});
