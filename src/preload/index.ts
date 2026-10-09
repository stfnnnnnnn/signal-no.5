// Preload (sandboxed): exposes named functions only. Never exposes ipcRenderer itself.
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type AiStatus, type SignalBridge } from '../shared/bridge';

const bridge: SignalBridge = {
  ai: {
    status: () => ipcRenderer.invoke(IPC.aiStatus),
    onStatus: (cb) => {
      const fn = (_e: unknown, s: AiStatus) => cb(s);
      ipcRenderer.on(IPC.aiStatusChanged, fn);
      return () => { ipcRenderer.removeListener(IPC.aiStatusChanged, fn); };
    },
    generateScenario: (request, runId) => ipcRenderer.invoke(IPC.aiGenerate, request, runId),
    narrateDebrief: (evaluation, request) => ipcRenderer.invoke(IPC.aiNarrate, evaluation, request),
  },
  save: {
    write: (slot, state) => ipcRenderer.invoke(IPC.saveWrite, slot, state),
    read: (slot) => ipcRenderer.invoke(IPC.saveRead, slot),
    list: () => ipcRenderer.invoke(IPC.saveList),
    remove: (slot) => ipcRenderer.invoke(IPC.saveRemove, slot),
  },
  badges: { read: () => ipcRenderer.invoke(IPC.badgesRead), add: (ids) => ipcRenderer.invoke(IPC.badgesAdd, ids) },
  profile: { write: (p) => ipcRenderer.invoke(IPC.profileWrite, p), read: () => ipcRenderer.invoke(IPC.profileRead), remove: () => ipcRenderer.invoke(IPC.profileRemove) },
  app: { info: () => ipcRenderer.invoke(IPC.appInfo) },
};

contextBridge.exposeInMainWorld('signal', bridge);
