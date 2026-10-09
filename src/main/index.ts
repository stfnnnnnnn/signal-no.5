// Electron main process: window, security hardening, model-server lifecycle, AI warm-up, IPC.
import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AiStatus } from '../shared/bridge';
import { IPC } from '../shared/bridge';
import { AIService } from './ai/aiService';
import { resolveRuntimeConfig, RUNTIME_LABEL } from './config';
import { registerIpc } from './ipc';
import { LlmServerManager } from './llm/serverManager';
import { SaveStore } from './persistence/saveStore';

const here = path.dirname(fileURLToPath(import.meta.url));
let win: BrowserWindow | null = null;
let aiStatus: AiStatus = 'starting';
let server: LlmServerManager | null = null;
let quitting = false;

function setAiStatus(s: AiStatus) {
  aiStatus = s;
  win?.webContents.send(IPC.aiStatusChanged, s);
}

if (!app.requestSingleInstanceLock()) app.quit(); // never run two model servers
app.enableSandbox();

async function createWindow() {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const csp = devUrl
    ? `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*`
    : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; connect-src 'none'`;
  session.defaultSession.webRequest.onHeadersReceived((d, cb) => cb({ responseHeaders: { ...d.responseHeaders, 'Content-Security-Policy': [csp] } }));
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540, title: 'Signal No. 5', backgroundColor: '#10141f', show: false,
    webPreferences: { preload: path.join(here, '../preload/index.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!devUrl || !url.startsWith(devUrl)) e.preventDefault(); });
  win.once('ready-to-show', () => win?.show());
  if (devUrl) await win.loadURL(devUrl);
  else await win.loadFile(path.join(here, '../renderer/index.html'));
}

app.whenReady().then(async () => {
  const cfg = resolveRuntimeConfig(app.isPackaged, process.resourcesPath);
  const userData = app.getPath('userData');
  const store = new SaveStore(path.join(userData, 'data'));
  server = cfg.modelPath ? new LlmServerManager({
    exePath: cfg.exePath, modelPath: cfg.modelPath, ngl: cfg.ngl, ctx: cfg.ctx, extraArgs: ['--reasoning', 'off'],
    pidFile: path.join(userData, 'llm-server.json'), logFile: path.join(userData, 'llm-server.log'),
  }) : null;
  const ai = new AIService({ endpoint: () => (aiStatus === 'ready' || aiStatus === 'warming' ? server?.endpoint() ?? null : null), timeoutMs: cfg.timeoutMs, maxTokens: cfg.maxTokens });
  registerIpc({
    ai, store, aiStatus: () => aiStatus,
    info: () => ({ version: app.getVersion(), packaged: app.isPackaged, modelFile: cfg.modelPath ? path.basename(cfg.modelPath) : null, runtime: RUNTIME_LABEL, aiStatus, inferenceDevice: 'local' }),
  });
  await createWindow();

  const t0 = Date.now();
  let startup: Record<string, unknown> = {};
  if (!server) setAiStatus('unavailable');
  else {
    server.onStatus((s) => { if (s === 'unavailable' && !quitting) setAiStatus('unavailable'); });
    try {
      const started = await server.start();
      setAiStatus('warming');
      const warm = await ai.warmUp(); // absorbs the one-time slow first request during the loading screen
      setAiStatus('ready');
      startup = { readyMs: started.readyMs, cleanup: started.cleanup.action, warmUpMs: warm.ms, warmUpOk: warm.ok };
    } catch (e) {
      setAiStatus('unavailable'); // gameplay continues with reviewed fallback content
      startup = { error: String(e) };
    }
  }
  if (process.argv.includes('--self-test')) await runSelfTest(ai, store, { ...startup, totalStartupMs: Date.now() - t0, model: cfg.modelPath, exe: cfg.exePath });
});

/** Packaging verification: real inference + validation + persistence through the main-process stack, then quit. */
async function runSelfTest(ai: AIService, store: SaveStore, startup: Record<string, unknown>) {
  const { createGame } = await import('../core/engine');
  const { buildScenarioRequest } = await import('../core/ai/scenario');
  const { evaluateRun } = await import('../core/evaluation/evaluate');
  const { buildDebriefRequest } = await import('../core/ai/debrief');
  const { writeFile } = await import('node:fs/promises');
  const out: Record<string, unknown> = { at: new Date().toISOString(), packaged: app.isPackaged, aiStatus, startup, scenarios: [] as unknown[] };
  for (const [label, survey] of [['fictional-1', { schemaVersion: 1 as const, q3Mode: 'fictional' as const }], ['fictional-2', { schemaVersion: 1 as const, q3Mode: 'fictional' as const }]] as const) {
    const g = createGame(survey, { seed: label === 'fictional-1' ? 101 : 202 });
    if (!g.ok) continue;
    const req = buildScenarioRequest(g.engine.getState())!;
    const t = Date.now();
    const content = await ai.generateScenario(req, `selftest-${label}`);
    (out.scenarios as unknown[]).push({ label, eventId: req.eventId, variant: req.allowedVariantIds[0], ms: Date.now() - t, source: content.source, fallbackReason: content.fallbackReason, dialogue: content.dialogue, actionsExact: content.actionIds.join() === req.allowedActionIds.join() });
    const st = g.engine.getState();
    await store.writeGame('selftest', st);
    out.saveRoundTrip = JSON.stringify(await store.readGame('selftest')) === JSON.stringify(st);
    await store.deleteGame('selftest');
    const ev = evaluateRun(st);
    const n = await ai.narrateDebrief(ev, buildDebriefRequest(ev, st));
    out.debriefSource = n.source;
  }
  const file = path.join(app.getPath('userData'), 'selftest.json');
  await writeFile(file, JSON.stringify(out, null, 2));
  console.log(`SELFTEST ${file}`);
  app.quit();
}

app.on('before-quit', async (e) => {
  if (quitting || !server) return;
  e.preventDefault();
  quitting = true;
  await server.stop();
  setAiStatus('stopped');
  app.quit();
});
app.on('window-all-closed', () => app.quit());
