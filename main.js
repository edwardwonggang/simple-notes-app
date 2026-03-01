const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 460,
    minWidth: 420,
    minHeight: 320,
    title: '酷炫桌面小工具',
    backgroundColor: '#0f111a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
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

ipcMain.handle('window:set-always-on-top', (_event, value) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  mainWindow.setAlwaysOnTop(Boolean(value), 'screen-saver');
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle('clipboard:write-text', (_event, text) => {
  clipboard.writeText(text || '');
  return true;
});

ipcMain.handle('clipboard:read-text', () => clipboard.readText());
