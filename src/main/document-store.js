const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOCS_DIR = 'documents';
const STATE_FILE = 'documents-state.json';

function getDocsDir(app) {
  return path.join(app.getPath('userData'), DOCS_DIR);
}

function getStateFile(app) {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function ensureDocsDir(app) {
  const dir = getDocsDir(app);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeTitle(value) {
  const title = String(value || '').trim();
  return title || '未命名文稿';
}

function normalizeContent(value) {
  return String(value || '');
}

function getDocFile(dir, id) {
  return path.join(dir, `${id}.json`);
}

function readState(app) {
  const stateFile = getStateFile(app);
  try {
    if (!fs.existsSync(stateFile)) {
      return { lastOpenedId: '' };
    }
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (_error) {
    return { lastOpenedId: '' };
  }
}

function writeState(app, nextState) {
  const stateFile = getStateFile(app);
  fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2), 'utf8');
}

function readDocument(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function toSummary(doc) {
  return {
    id: doc.id,
    title: normalizeTitle(doc.title),
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt
  };
}

function listDocuments(app) {
  const dir = ensureDocsDir(app);
  const docs = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readDocument(path.join(dir, name)))
    .filter(Boolean)
    .sort((a, b) => {
      const left = new Date(b.updatedAt || 0).getTime();
      const right = new Date(a.updatedAt || 0).getTime();
      return left - right;
    });

  return docs;
}

function createDocumentRecord({ id, title, contentHtml, createdAt, updatedAt }) {
  return {
    id,
    title: normalizeTitle(title),
    contentHtml: normalizeContent(contentHtml),
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString()
  };
}

function createDocument(app, payload = {}) {
  const dir = ensureDocsDir(app);
  const now = new Date().toISOString();
  const doc = createDocumentRecord({
    id: crypto.randomUUID(),
    title: payload.title,
    contentHtml: payload.contentHtml,
    createdAt: now,
    updatedAt: now
  });

  fs.writeFileSync(getDocFile(dir, doc.id), JSON.stringify(doc, null, 2), 'utf8');
  writeState(app, { lastOpenedId: doc.id });
  return doc;
}

function ensureSeedDocument(app) {
  const docs = listDocuments(app);
  if (docs.length) {
    return docs;
  }
  return [createDocument(app, { title: '未命名文稿', contentHtml: '' })];
}

function buildSnapshot(app, activeId = '') {
  const docs = ensureSeedDocument(app);
  const state = readState(app);
  const selectedId = activeId || state.lastOpenedId || docs[0]?.id || '';
  const activeDoc = docs.find((doc) => doc.id === selectedId) || docs[0] || null;

  if (activeDoc) {
    writeState(app, { lastOpenedId: activeDoc.id });
  }

  return {
    documentsPath: getDocsDir(app),
    documents: docs.map(toSummary),
    activeDocument: activeDoc
  };
}

function initDocuments(app) {
  return buildSnapshot(app);
}

function openDocument(app, id) {
  return buildSnapshot(app, id);
}

function saveDocument(app, payload = {}) {
  const dir = ensureDocsDir(app);
  const existing = payload.id ? readDocument(getDocFile(dir, payload.id)) : null;
  const now = new Date().toISOString();
  const doc = createDocumentRecord({
    id: existing?.id || payload.id || crypto.randomUUID(),
    title: payload.title || existing?.title,
    contentHtml: payload.contentHtml ?? existing?.contentHtml ?? '',
    createdAt: existing?.createdAt || now,
    updatedAt: now
  });

  fs.writeFileSync(getDocFile(dir, doc.id), JSON.stringify(doc, null, 2), 'utf8');
  return buildSnapshot(app, doc.id);
}

function deleteDocument(app, id) {
  const dir = ensureDocsDir(app);
  if (id) {
    const filePath = getDocFile(dir, id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  return buildSnapshot(app);
}

module.exports = {
  initDocuments,
  openDocument,
  saveDocument,
  deleteDocument,
  createDocument
};
