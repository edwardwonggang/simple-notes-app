const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { app, BrowserWindow, ipcMain, screen } = require('electron');

const {
  MIN_WIDTH,
  MIN_HEIGHT,
  loadWindowBounds,
  saveWindowBounds
} = require('./src/main/window-state');
const { loadConfig, saveConfig, normalizeConfig } = require('./src/main/config-store');
const { streamChatCompletion } = require('./src/main/chat-service');
const {
  initDocuments,
  openDocument,
  saveDocument,
  deleteDocument,
  createDocument
} = require('./src/main/document-store');

let mainWindow = null;
let saveBoundsTimer = null;
const activeRequests = new Map();
const HOMEBREW_PREFIX = '/opt/homebrew';
const OPENJDK_BIN = path.join(HOMEBREW_PREFIX, 'opt/openjdk/bin/java');
const GRAPHVIZ_DOT = path.join(HOMEBREW_PREFIX, 'bin/dot');
const LOCAL_PLANTUML_JAR = path.join(__dirname, 'src', 'vendor', 'plantuml.jar');

function createWindow() {
  const bounds = loadWindowBounds(app, screen);

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'AI Markdown Client',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('resize', scheduleBoundsSave);
  mainWindow.on('move', scheduleBoundsSave);
  mainWindow.on('close', () => {
    flushBoundsSave();
    abortRequest(mainWindow.webContents.id);
  });
}

function scheduleBoundsSave() {
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer);
  }

  saveBoundsTimer = setTimeout(() => {
    flushBoundsSave();
  }, 180);
}

function flushBoundsSave() {
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = null;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    saveWindowBounds(app, mainWindow);
  }
}

function sendChatEvent(webContents, payload) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }
  webContents.send('chat:event', payload);
}

function renderPlantUmlLocally(source) {
  return new Promise((resolve, reject) => {
    const javaBin = OPENJDK_BIN;
    const javaArgs = [
      '-Djava.awt.headless=true',
      '-jar',
      LOCAL_PLANTUML_JAR,
      '-charset',
      'UTF-8',
      '-tsvg',
      '-pipe'
    ];

    if (GRAPHVIZ_DOT) {
      javaArgs.push('-graphvizdot', GRAPHVIZ_DOT);
    }

    const child = spawn(javaBin, javaArgs, {
      env: {
        ...process.env,
        PATH: `${path.join(HOMEBREW_PREFIX, 'opt/openjdk/bin')}:${path.join(HOMEBREW_PREFIX, 'bin')}:${process.env.PATH || ''}`
      }
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    child.on('error', (error) => {
      reject(new Error(`本地 PlantUML 启动失败：${error.message}`));
    });
    child.on('close', (code) => {
      const output = Buffer.concat(stdoutChunks).toString('utf8').trim();
      const errorText = Buffer.concat(stderrChunks).toString('utf8').trim();

      if (code === 0 && output) {
        resolve(output);
        return;
      }

      reject(new Error(errorText || output || `本地 PlantUML 渲染失败（退出码 ${code}）`));
    });

    child.stdin.write(String(source || ''));
    child.stdin.end();
  });
}

function abortRequest(webContentsId) {
  const current = activeRequests.get(webContentsId);
  if (!current) {
    return false;
  }

  current.controller.abort();
  activeRequests.delete(webContentsId);
  return true;
}

function buildApiMessages(messages, systemPrompt) {
  const result = [];

  if (systemPrompt && systemPrompt.trim()) {
    result.push({
      role: 'system',
      content: systemPrompt.trim()
    });
  }

  messages.forEach((message) => {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(message?.content ?? '');
    if (!content.trim()) {
      return;
    }
    result.push({ role, content });
  });

  return result;
}

async function startChat(webContents, payload) {
  const webContentsId = webContents.id;
  abortRequest(webContentsId);

  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const config = normalizeConfig(payload?.config || {});
  const messages = buildApiMessages(payload?.messages || [], config.systemPrompt);

  activeRequests.set(webContentsId, {
    requestId,
    controller
  });

  sendChatEvent(webContents, {
    type: 'started',
    requestId
  });

  try {
    await streamChatCompletion(config, messages, controller.signal, (chunk) => {
      sendChatEvent(webContents, {
        type: 'chunk',
        requestId,
        chunk
      });
    });

    sendChatEvent(webContents, {
      type: 'done',
      requestId
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    sendChatEvent(webContents, {
      type: aborted ? 'aborted' : 'error',
      requestId,
      message: aborted ? '已停止生成。' : error.message
    });
  } finally {
    const current = activeRequests.get(webContentsId);
    if (current?.requestId === requestId) {
      activeRequests.delete(webContentsId);
    }
  }

  return { requestId };
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

ipcMain.handle('config:load', () => loadConfig(app));
ipcMain.handle('config:save', (_event, nextConfig) => saveConfig(app, nextConfig));
ipcMain.handle('docs:init', () => initDocuments(app));
ipcMain.handle('docs:open', (_event, id) => openDocument(app, id));
ipcMain.handle('docs:create', (_event, payload) => createDocument(app, payload));
ipcMain.handle('docs:save', (_event, payload) => saveDocument(app, payload));
ipcMain.handle('docs:delete', (_event, id) => deleteDocument(app, id));
ipcMain.handle('chat:start', (event, payload) => startChat(event.sender, payload));
ipcMain.handle('chat:stop', (event) => {
  abortRequest(event.sender.id);
  return { stopped: true };
});
ipcMain.handle('diagram:render-plantuml', (_event, source) => renderPlantUmlLocally(source));
