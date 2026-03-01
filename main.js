const { app, BrowserWindow, ipcMain, clipboard, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let saveStateTimer = null;
let snapTimer = null;

const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 460;
const MIN_WIDTH = 420;
const MIN_HEIGHT = 320;
const SNAP_THRESHOLD = 18;
const WINDOW_STATE_FILE = 'window-state.json';

function getWindowStatePath() {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function hasIntersection(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function getDefaultBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = Math.min(DEFAULT_WIDTH, workArea.width);
  const height = Math.min(DEFAULT_HEIGHT, workArea.height);
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2)
  };
}

function sanitizeSavedBounds(savedBounds) {
  if (!savedBounds || typeof savedBounds !== 'object') {
    return null;
  }

  const { x, y, width, height } = savedBounds;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  const cleanBounds = {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(MIN_WIDTH, Math.round(width)),
    height: Math.max(MIN_HEIGHT, Math.round(height))
  };

  const displays = screen.getAllDisplays();
  const visible = displays.some((display) => hasIntersection(cleanBounds, display.workArea));
  return visible ? cleanBounds : null;
}

function loadWindowBounds() {
  try {
    const statePath = getWindowStatePath();
    if (!fs.existsSync(statePath)) {
      return getDefaultBounds();
    }

    const content = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(content);
    return sanitizeSavedBounds(parsed) || getDefaultBounds();
  } catch (_error) {
    return getDefaultBounds();
  }
}

function writeWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized() || mainWindow.isMaximized() || mainWindow.isFullScreen()) {
    return;
  }

  const bounds = mainWindow.getBounds();
  const statePath = getWindowStatePath();
  const payload = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };

  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (_error) {
    // Ignore persistence failures to avoid impacting app behavior.
  }
}

function scheduleWindowStateSave() {
  if (saveStateTimer) {
    clearTimeout(saveStateTimer);
  }
  saveStateTimer = setTimeout(() => {
    writeWindowBounds();
    saveStateTimer = null;
  }, 180);
}

function applySnapIfNeeded() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized() || mainWindow.isMaximized() || mainWindow.isFullScreen()) {
    return;
  }

  const bounds = mainWindow.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  let nextX = bounds.x;
  let nextY = bounds.y;

  if (Math.abs(bounds.x - workArea.x) <= SNAP_THRESHOLD) {
    nextX = workArea.x;
  }
  if (Math.abs(bounds.y - workArea.y) <= SNAP_THRESHOLD) {
    nextY = workArea.y;
  }

  const rightEdge = bounds.x + bounds.width;
  const bottomEdge = bounds.y + bounds.height;
  const workAreaRight = workArea.x + workArea.width;
  const workAreaBottom = workArea.y + workArea.height;

  if (Math.abs(rightEdge - workAreaRight) <= SNAP_THRESHOLD) {
    nextX = workAreaRight - bounds.width;
  }
  if (Math.abs(bottomEdge - workAreaBottom) <= SNAP_THRESHOLD) {
    nextY = workAreaBottom - bounds.height;
  }

  if (nextX !== bounds.x || nextY !== bounds.y) {
    mainWindow.setBounds({
      x: nextX,
      y: nextY,
      width: bounds.width,
      height: bounds.height
    });
  }
}

function scheduleSnap() {
  if (snapTimer) {
    clearTimeout(snapTimer);
  }
  snapTimer = setTimeout(() => {
    applySnapIfNeeded();
    scheduleWindowStateSave();
    snapTimer = null;
  }, 80);
}

function createWindow() {
  const savedBounds = loadWindowBounds();
  mainWindow = new BrowserWindow({
    x: savedBounds.x,
    y: savedBounds.y,
    width: savedBounds.width,
    height: savedBounds.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: '酷炫桌面小工具',
    backgroundColor: '#0f111a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('move', () => {
    scheduleSnap();
    scheduleWindowStateSave();
  });
  mainWindow.on('resize', scheduleWindowStateSave);
  mainWindow.on('close', writeWindowBounds);
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
