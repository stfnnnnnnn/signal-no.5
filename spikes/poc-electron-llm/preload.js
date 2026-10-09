// THROWAWAY spike. The only surface the renderer gets: named functions, no raw ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('signal', {
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    fixture: () => ipcRenderer.invoke('ai:fixture'),
    generate: (request, inject = null) => ipcRenderer.invoke('ai:generate', { request, inject }),
    onStatus: (cb) => ipcRenderer.on('ai:status-changed', (_e, s) => cb(s)),
  },
});
