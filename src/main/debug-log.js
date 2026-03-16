const fs = require('fs');
const os = require('os');
const path = require('path');

let debugLogFilePath = path.join(os.tmpdir(), 'ai-markdown-client-debug.log');

function configureDebugLog(baseDir) {
  if (!baseDir) {
    return debugLogFilePath;
  }

  debugLogFilePath = path.join(baseDir, 'debug.log');
  return debugLogFilePath;
}

function getDebugLogFilePath() {
  return debugLogFilePath;
}

function debugLog(scope, message, metadata = undefined) {
  const timestamp = new Date().toISOString();
  const meta = metadata === undefined ? '' : ` ${safeSerialize(metadata)}`;
  const line = `[${timestamp}] [${scope}] ${message}${meta}\n`;

  try {
    fs.mkdirSync(path.dirname(debugLogFilePath), { recursive: true });
    fs.appendFileSync(debugLogFilePath, line, 'utf8');
  } catch (_error) {
    // Ignore logging failures.
  }

  process.stdout.write(line);
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return JSON.stringify({ note: 'unserializable metadata' });
  }
}

module.exports = {
  configureDebugLog,
  getDebugLogFilePath,
  debugLog
};
