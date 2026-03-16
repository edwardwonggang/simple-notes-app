const { contextBridge, ipcRenderer } = require('electron');
const hljs = require('highlight.js/lib/common');

contextBridge.exposeInMainWorld('aiClient', {
  debugLog: (message, metadata) => ipcRenderer.invoke('debug:log', { message, metadata }),
  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  initDocuments: () => ipcRenderer.invoke('docs:init'),
  openDocument: (id) => ipcRenderer.invoke('docs:open', id),
  createDocument: (payload) => ipcRenderer.invoke('docs:create', payload),
  saveDocument: (payload) => ipcRenderer.invoke('docs:save', payload),
  deleteDocument: (id) => ipcRenderer.invoke('docs:delete', id),
  startChat: (payload) => ipcRenderer.invoke('chat:start', payload),
  stopChat: () => ipcRenderer.invoke('chat:stop'),
  renderPlantUml: (source) => ipcRenderer.invoke('diagram:render-plantuml', source),
  highlightCode: (source, language) => {
    const code = String(source || '');
    const lang = String(language || '').trim().toLowerCase();
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  onChatEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('chat:event', handler);
    return () => ipcRenderer.removeListener('chat:event', handler);
  }
});
