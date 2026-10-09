// THROWAWAY spike. Electron main: owns llama-server, exposes a narrow IPC API, runs an optional automated check.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { LlmServerManager } = require('./llm');
const { generate } = require('./adapter');

const MODEL_FILE = 'Qwen3-1.7B-Q4_K_M.gguf';
const llmDir = app.isPackaged ? path.join(process.resourcesPath, 'llm') : (process.env.SIGNAL_LLM_DIR || 'D:\\signal-llm\\llama-b11517-cuda124');
const modelPath = app.isPackaged ? path.join(process.resourcesPath, 'models', MODEL_FILE) : (process.env.SIGNAL_MODEL || `D:\\signal-llm\\models\\${MODEL_FILE}`);

let server, win, quitting = false;
const resultsFile = () => path.join(app.getPath('userData'), 'poc-results.json');
const results = { startedAt: new Date().toISOString(), packaged: app.isPackaged, llmDir, modelPath, steps: [] };
const record = (step, data) => { results.steps.push({ step, at: new Date().toISOString(), ...data }); fs.writeFileSync(resultsFile(), JSON.stringify(results, null, 2)); };

const FIXTURE = require('./fixture.json');
const GenerateArgs = z.object({ request: z.unknown(), inject: z.enum(['badjson', 'unknownAction', 'overlength', 'duplicate']).nullable() }).strict();

ipcMain.handle('ai:status', () => server ? server.status : 'stopped');
ipcMain.handle('ai:fixture', () => FIXTURE);
ipcMain.handle('ai:generate', async (_e, args) => {
  const { request, inject } = GenerateArgs.parse(args);
  const r = await generate(server, request, { inject });
  record('generate', { inject, source: r.content.source, ms: r.ms, meta: r.meta, content: r.content });
  return r;
});

async function createWindow() {
  // CSP: renderer may not reach the network at all.
  session.defaultSession.webRequest.onHeadersReceived((d, cb) => cb({ responseHeaders: { ...d.responseHeaders,
    'Content-Security-Policy': ["default-src 'self'; script-src 'self'; connect-src 'none'; img-src 'self' data:"] } }));
  win = new BrowserWindow({ width: 900, height: 640, title: 'Signal No. 5 — PoC',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  await win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
  await createWindow();
  server = new LlmServerManager({ exePath: path.join(llmDir, 'llama-server.exe'), modelPath,
    pidFile: path.join(app.getPath('userData'), 'llm-server.json'), logFile: path.join(app.getPath('userData'), 'llm-server.log'),
    extraArgs: ['--reasoning', 'off'] });
  try { record('server-start', await server.start()); }
  catch (e) { record('server-start-failed', { error: String(e) }); }
  win.webContents.send('ai:status-changed', server.status);

  if (process.argv.includes('--poc-auto')) {
    // Drive the same IPC path the UI uses, from the renderer, then quit.
    await win.webContents.executeJavaScript('window.__pocRunAll()');
    setTimeout(() => app.quit(), 1500);
  }
});

app.on('before-quit', async (e) => {
  if (quitting || !server) return;
  e.preventDefault(); quitting = true;
  const stopped = await server.stop();
  record('server-stop', { stopped, pid: server.child ? server.child.pid : null });
  app.quit();
});
app.on('window-all-closed', () => app.quit());
