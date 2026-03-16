const fs = require('fs');
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
const { configureDebugLog, getDebugLogFilePath, debugLog } = require('./src/main/debug-log');
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
let plantUmlRuntimeCache = null;

function getExecutableName(baseName) {
  return process.platform === 'win32' ? `${baseName}.exe` : baseName;
}

function canReadFile(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    return fs.statSync(filePath).isFile();
  } catch (_error) {
    return false;
  }
}

function uniquePaths(paths) {
  return Array.from(new Set(paths.filter(Boolean)));
}

function getPathEntries() {
  return String(process.env.PATH || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function findExecutableInPath(baseName) {
  const pathEntries = getPathEntries();
  const executableNames = process.platform === 'win32'
    ? Array.from(new Set([
      `${baseName}.exe`,
      ...String(process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
        .split(';')
        .filter(Boolean)
        .map((extension) => `${baseName}${extension.toLowerCase()}`)
    ]))
    : [baseName];

  for (const entry of pathEntries) {
    for (const executableName of executableNames) {
      const fullPath = path.join(entry, executableName);
      if (canReadFile(fullPath)) {
        return fullPath;
      }
    }
  }

  return '';
}

function listChildDirectories(baseDir) {
  try {
    return fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(baseDir, entry.name));
  } catch (_error) {
    return [];
  }
}

function getCommonJavaCandidates() {
  const executableName = getExecutableName('java');
  const candidates = [
    process.env.AI_MARKDOWN_JAVA_BIN,
    process.env.PLANTUML_JAVA_BIN,
    process.env.JAVA_BIN,
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', executableName) : ''
  ];

  if (process.platform === 'darwin') {
    candidates.push(
      '/opt/homebrew/opt/openjdk/bin/java',
      '/usr/local/opt/openjdk/bin/java'
    );
  }

  if (process.platform === 'win32') {
    [
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Microsoft',
      'C:\\Program Files\\BellSoft',
      'C:\\Program Files\\Zulu',
      'C:\\Program Files\\Amazon Corretto'
    ].forEach((baseDir) => {
      listChildDirectories(baseDir).forEach((childDir) => {
        candidates.push(path.join(childDir, 'bin', executableName));
      });
    });
  }

  if (process.platform === 'linux') {
    candidates.push('/usr/bin/java', '/usr/local/bin/java');
  }

  if (process.platform === 'darwin') {
    listChildDirectories('/Library/Java/JavaVirtualMachines').forEach((childDir) => {
      candidates.push(path.join(childDir, 'Contents', 'Home', 'bin', executableName));
    });
  }

  candidates.push(findExecutableInPath('java'));

  return uniquePaths(candidates);
}

function getCommonGraphvizCandidates() {
  const executableName = getExecutableName('dot');
  const candidates = [
    process.env.AI_MARKDOWN_GRAPHVIZ_DOT,
    process.env.GRAPHVIZ_DOT,
    process.env.PLANTUML_GRAPHVIZ_DOT
  ];

  if (process.platform === 'darwin') {
    candidates.push('/opt/homebrew/bin/dot', '/usr/local/bin/dot');
  }

  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Graphviz\\bin\\dot.exe',
      'C:\\Program Files (x86)\\Graphviz\\bin\\dot.exe'
    );

    ['C:\\Program Files', 'C:\\Program Files (x86)'].forEach((baseDir) => {
      listChildDirectories(baseDir)
        .filter((dirPath) => path.basename(dirPath).toLowerCase().startsWith('graphviz'))
        .forEach((graphvizDir) => {
          candidates.push(path.join(graphvizDir, 'bin', executableName));
        });
    });
  }

  if (process.platform === 'linux') {
    candidates.push('/usr/bin/dot', '/usr/local/bin/dot');
  }

  candidates.push(findExecutableInPath('dot'));

  return uniquePaths(candidates);
}

function resolveExecutable(candidates) {
  return candidates.find((candidate) => canReadFile(candidate)) || '';
}

function getLocalPlantUmlJarPath() {
  const devPath = path.join(__dirname, 'src', 'vendor', 'plantuml.jar');
  const packagedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'vendor', 'plantuml.jar');
  return canReadFile(packagedPath) ? packagedPath : devPath;
}

function resolvePlantUmlRuntime() {
  if (plantUmlRuntimeCache) {
    return plantUmlRuntimeCache;
  }

  const runtime = {
    javaBin: resolveExecutable(getCommonJavaCandidates()),
    dotBin: resolveExecutable(getCommonGraphvizCandidates()),
    jarPath: getLocalPlantUmlJarPath()
  };

  plantUmlRuntimeCache = runtime;
  return runtime;
}

function buildProcessPath(extraEntries = []) {
  return uniquePaths([...extraEntries, ...getPathEntries()]).join(path.delimiter);
}

function getPlatformName(platform = process.platform) {
  if (platform === 'darwin') {
    return 'macOS';
  }
  if (platform === 'win32') {
    return 'Windows';
  }
  if (platform === 'linux') {
    return 'Linux';
  }
  return platform;
}

function getPreferredLineBreakModifierLabel(platform = process.platform) {
  return platform === 'darwin' ? 'Cmd' : 'Ctrl';
}

function getSystemInfo() {
  const runtime = resolvePlantUmlRuntime();
  const platform = process.platform;

  return {
    platform,
    platformName: getPlatformName(platform),
    isMac: platform === 'darwin',
    isWindows: platform === 'win32',
    isLinux: platform === 'linux',
    preferredLineBreakModifier: getPreferredLineBreakModifierLabel(platform),
    plantUmlRuntime: {
      javaDetected: Boolean(runtime.javaBin),
      dotDetected: Boolean(runtime.dotBin),
      jarDetected: canReadFile(runtime.jarPath)
    }
  };
}

function getRuntimeInstallHint(tool) {
  if (process.platform === 'darwin') {
    if (tool === 'java') {
      return ' 可在 macOS 上安装 Java 17+，例如执行 `brew install openjdk`，或设置 `JAVA_HOME` / `AI_MARKDOWN_JAVA_BIN`。';
    }
    if (tool === 'graphviz') {
      return ' 可在 macOS 上安装 Graphviz，例如执行 `brew install graphviz`，或设置 `GRAPHVIZ_DOT` / `AI_MARKDOWN_GRAPHVIZ_DOT`。';
    }
  }

  if (process.platform === 'win32') {
    if (tool === 'java') {
      return ' 请在 Windows 上安装 Java 17+ 并加入 PATH，或设置 `JAVA_HOME` / `AI_MARKDOWN_JAVA_BIN`。';
    }
    if (tool === 'graphviz') {
      return ' 请在 Windows 上安装 Graphviz 并将 `dot.exe` 加入 PATH，或设置 `GRAPHVIZ_DOT` / `AI_MARKDOWN_GRAPHVIZ_DOT`。';
    }
  }

  if (tool === 'java') {
    return ' 请安装 Java 17+ 并确保 `java` 可执行，或设置 `JAVA_HOME` / `AI_MARKDOWN_JAVA_BIN`。';
  }

  return ' 请安装 Graphviz 并确保 `dot` 可执行，或设置 `GRAPHVIZ_DOT` / `AI_MARKDOWN_GRAPHVIZ_DOT`。';
}

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
  if (payload?.type !== 'chunk') {
    debugLog('main.chat', 'send chat event', { type: payload?.type, requestId: payload?.requestId });
  }
  webContents.send('chat:event', payload);
}

function renderPlantUmlLocally(source) {
  return new Promise((resolve, reject) => {
    const { javaBin, dotBin, jarPath } = resolvePlantUmlRuntime();
    if (!canReadFile(jarPath)) {
      reject(new Error('本地 PlantUML JAR 不存在，请检查应用资源是否完整。'));
      return;
    }

    if (!javaBin) {
      reject(new Error(`未找到本地 Java 运行时。${getRuntimeInstallHint('java')}`));
      return;
    }

    const javaArgs = [
      '-Djava.awt.headless=true',
      '-jar',
      jarPath,
      '-charset',
      'UTF-8',
      '-tsvg',
      '-pipe'
    ];

    if (dotBin) {
      javaArgs.push('-graphvizdot', dotBin);
    }

    const child = spawn(javaBin, javaArgs, {
      env: {
        ...process.env,
        PATH: buildProcessPath([
          path.dirname(javaBin),
          dotBin ? path.dirname(dotBin) : ''
        ])
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

      const guidance = !dotBin
        ? ` 当前未检测到 Graphviz dot。${getRuntimeInstallHint('graphviz')}`
        : '';
      reject(new Error((errorText || output || `本地 PlantUML 渲染失败（退出码 ${code}）`) + guidance));
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

  debugLog('main.chat', 'start chat request', {
    requestId,
    webContentsId,
    model: config.model,
    apiUrl: config.apiUrl,
    messageCount: messages.length
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
  configureDebugLog(app.getPath('userData'));
  debugLog('main.app', 'app ready', {
    userData: app.getPath('userData'),
    debugLogFile: getDebugLogFilePath()
  });
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
ipcMain.handle('system:get-info', () => getSystemInfo());
ipcMain.handle('debug:log', (_event, payload) => {
  debugLog('renderer', payload?.message || 'renderer log', payload?.metadata);
  return { ok: true, path: getDebugLogFilePath() };
});
