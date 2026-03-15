const fs = require('fs');
const path = require('path');

const WINDOW_STATE_FILE = 'window-state.json';
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 860;
const MIN_WIDTH = 920;
const MIN_HEIGHT = 680;

function hasIntersection(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function getStatePath(app) {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function getDefaultBounds(screen) {
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

function sanitizeBounds(screen, savedBounds) {
  if (!savedBounds || typeof savedBounds !== 'object') {
    return null;
  }

  const { x, y, width, height } = savedBounds;
  if (![x, y, width, height].every(Number.isFinite)) {
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

function loadWindowBounds(app, screen) {
  const statePath = getStatePath(app);

  try {
    if (!fs.existsSync(statePath)) {
      return getDefaultBounds(screen);
    }

    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return sanitizeBounds(screen, parsed) || getDefaultBounds(screen);
  } catch (_error) {
    return getDefaultBounds(screen);
  }
}

function saveWindowBounds(app, browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) {
    return;
  }
  if (browserWindow.isMinimized() || browserWindow.isMaximized() || browserWindow.isFullScreen()) {
    return;
  }

  const bounds = browserWindow.getBounds();
  const statePath = getStatePath(app);

  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      JSON.stringify(
        {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (_error) {
  }
}

module.exports = {
  MIN_WIDTH,
  MIN_HEIGHT,
  loadWindowBounds,
  saveWindowBounds
};
