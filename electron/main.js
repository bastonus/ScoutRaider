import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { execFile } from 'child_process';
import { autoUpdater } from 'electron-updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../legacy/logo.png'),
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

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

autoUpdater.autoDownload = false;

autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  if (mainWindow) mainWindow.webContents.send('update-error', err.toString());
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

ipcMain.handle('check-for-updates', async () => {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    console.error('Update check failed:', err);
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

// ─── IPC Handlers ─────────────────────────────────────────────────────────

ipcMain.handle('get-app-version', () => app.getVersion());

// Show Save Dialog
ipcMain.handle('show-save-dialog', async (event, defaultName, format) => {
  const filters = format === 'pdf' ? [{ name: 'Document PDF', extensions: ['pdf'] }] :
                  format === 'html' ? [{ name: 'Page Web', extensions: ['html'] }] :
                  [{ name: 'Projet ScoutRaider', extensions: ['scoutproj'] }];

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer',
    defaultPath: defaultName || `projet.${format || 'scoutproj'}`,
    filters
  });

  return canceled ? null : filePath;
});

// Show Open Dialog
ipcMain.handle('show-open-dialog', async (event, filters) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir',
    properties: ['openFile'],
    filters: filters || [{ name: 'Projets ScoutRaider', extensions: ['scoutproj'] }, { name: 'Tous les fichiers', extensions: ['*'] }]
  });

  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

// Save .scoutproj
ipcMain.handle('save-scoutproj', async (event, stateJSON, filepath) => {
  try {
    let targetPath = filepath;
    if (!targetPath) {
      const { canceled, filePath: dialogPath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Enregistrer le projet',
        defaultPath: 'projet.scoutproj',
        filters: [{ name: 'Projet ScoutRaider', extensions: ['scoutproj'] }]
      });
      if (canceled) return false;
      targetPath = dialogPath;
    }
    
    await fs.writeFile(targetPath, stateJSON, 'utf-8');
    return targetPath;
  } catch (err) {
    console.error('Failed to save .scoutproj:', err);
    throw err;
  }
});

// Open .scoutproj
ipcMain.handle('open-scoutproj', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Ouvrir un projet',
      properties: ['openFile'],
      filters: [{ name: 'Projet ScoutRaider', extensions: ['scoutproj'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    const data = await fs.readFile(filePaths[0], 'utf-8');
    return { state: data, filepath: filePaths[0] };
  } catch (err) {
    console.error('Failed to load .scoutproj:', err);
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

// Export File (PDF / HTML)
ipcMain.handle('export-file', async (event, html, format, outputPath) => {
  try {
    if (format === 'html') {
      await fs.writeFile(outputPath, html, 'utf-8');
      return true;
    } 
    
    if (format === 'pdf') {
      // Create a hidden window to render the HTML and printToPDF
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Load the raw HTML into the hidden browser window
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      await printWin.loadURL(dataUrl);

      // Wait a bit for any map tiles/images/fonts to finish rendering
      // In a robust implementation, we'd wait for a signal from the renderer, but 2s is a reasonable fallback
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pdfData = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margin: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
      });

      await fs.writeFile(outputPath, pdfData);
      printWin.destroy();
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('Export failed:', err);
    throw err;
  }
});

// ─── WeasyPrint Integration ───────────────────────────────────────────────

// Check if WeasyPrint is available
ipcMain.handle('check-weasyprint', async () => {
  return new Promise((resolve) => {
    execFile('python', ['-m', 'weasyprint', '--version'], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        // Try python3 on Unix-like systems
        execFile('python3', ['-m', 'weasyprint', '--version'], { timeout: 5000 }, (err2, stdout2) => {
          if (err2) {
            resolve({ available: false });
          } else {
            resolve({ available: true, version: stdout2.trim() });
          }
        });
      } else {
        resolve({ available: true, version: stdout.trim() });
      }
    });
  });
});

// Convert HTML to PDF via WeasyPrint
ipcMain.handle('convert-html-to-pdf', async (event, html, outputPath) => {
  const tmpDir = os.tmpdir();
  const tmpHtml = path.join(tmpDir, `scoutraider_export_${Date.now()}.html`);

  try {
    // Write HTML to temp file
    await fs.writeFile(tmpHtml, html, 'utf-8');

    // Run WeasyPrint
    return await new Promise((resolve) => {
      const tryPython = (cmd) => {
        execFile(cmd, ['-m', 'weasyprint', tmpHtml, outputPath], {
          timeout: 120000, // 2 minutes max
          maxBuffer: 1024 * 1024 * 10,
        }, async (error, stdout, stderr) => {
          // Clean up temp file
          try { await fs.unlink(tmpHtml); } catch { /* ignore */ }

          if (error) {
            if (cmd === 'python') {
              // Retry with python3
              tryPython('python3');
            } else {
              resolve({
                success: false,
                error: stderr || error.message || 'WeasyPrint conversion failed'
              });
            }
          } else {
            resolve({ success: true });
          }
        });
      };
      tryPython('python');
    });
  } catch (err) {
    try { await fs.unlink(tmpHtml); } catch { /* ignore */ }
    return { success: false, error: err.message };
  }
});

// ─── Custom Logger ────────────────────────────────────────────────────────
const logFilePath = path.join(__dirname, '../scoutraider.log');
ipcMain.handle('write-log', async (event, level, msg) => {
  try {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`;
    await fs.appendFile(logFilePath, formattedMsg, 'utf-8');
  } catch (e) {
    console.error("Failed to write to log file", e);
  }
});
