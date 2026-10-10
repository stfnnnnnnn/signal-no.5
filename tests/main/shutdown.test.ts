// Application shutdown: status sends never target a destroyed window, shutdown is idempotent and always
// completes, and the model server never outlives a stop() — whenever it is requested.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onceShutdown, sendToWindow, type StatusTarget } from '../../src/main/lifecycle';
import { LlmServerManager } from '../../src/main/llm/serverManager';
import { AIService } from '../../src/main/ai/aiService';
import { buildScenarioRequest } from '../../src/core/ai/scenario';
import { aloneSurvey } from '../fixtures/households';
import { newGame } from '../helpers';

const FAKE = resolve(__dirname, 'fake-llama-server.mjs');
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeWindow(destroyed: { win: boolean; contents: boolean }) {
  const sent: unknown[][] = [];
  const target: StatusTarget = {
    isDestroyed: () => destroyed.win,
    webContents: {
      isDestroyed: () => destroyed.contents,
      send: (...a: unknown[]) => { if (destroyed.win || destroyed.contents) throw new TypeError('Object has been destroyed'); sent.push(a); },
    },
  };
  return { target, sent };
}

describe('sendToWindow', () => {
  it('delivers to a live window', () => {
    const w = fakeWindow({ win: false, contents: false });
    expect(sendToWindow(w.target, 'ai:status-changed', 'stopped')).toBe(true);
    expect(w.sent).toEqual([['ai:status-changed', 'stopped']]);
  });
  it('skips a destroyed window or destroyed contents without throwing', () => {
    expect(sendToWindow(fakeWindow({ win: true, contents: true }).target, 'c', 1)).toBe(false);
    expect(sendToWindow(fakeWindow({ win: false, contents: true }).target, 'c', 1)).toBe(false);
    expect(sendToWindow(null, 'c', 1)).toBe(false);
  });
});

describe('onceShutdown', () => {
  it('stops the server once, however many times quit is requested', async () => {
    const stop = vi.fn(async () => true);
    const shutdown = onceShutdown(stop);
    await Promise.all([shutdown(), shutdown(), shutdown()]);
    await shutdown();
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it('still resolves (so the app can exit) when stopping the server fails', async () => {
    const shutdown = onceShutdown(async () => { throw new Error('kill failed'); });
    await expect(shutdown()).resolves.toBeUndefined();
  });
});

describe('LlmServerManager.stop() during startup', () => {
  const managers: LlmServerManager[] = [];
  afterEach(async () => { for (const m of managers.splice(0)) await m.stop(); });
  function manager(loadMs: number, onSpawn: () => void = () => {}) {
    const dir = mkdtempSync(join(tmpdir(), 'signalno5-shutdown-'));
    const m = new LlmServerManager({
      exePath: process.execPath, modelPath: 'model.gguf', pidFile: join(dir, 'llm-server.json'), logFile: join(dir, 'server.log'),
      buildArgs: (base) => { onSpawn(); return [FAKE, ...base, '--load-ms', String(loadMs)]; }, ports: [18911, 18912, 18913],
    });
    managers.push(m);
    return m;
  }

  it('never spawns the model server when stop() arrives before the process is launched', async () => {
    let spawned = 0;
    const m = manager(200, () => spawned++);
    const starting = m.start();
    await m.stop();                        // the window closed while startup was still preparing
    await expect(starting).rejects.toThrow();
    await sleep(300);
    expect(spawned).toBe(0);
    expect(m.pid).toBeNull();
    expect(m.status).not.toBe('ready');
  });

  it('kills a server that is still loading the model and leaves no process behind', async () => {
    const m = manager(10_000);
    const starting = m.start();
    await sleep(500);                      // spawned, /health still 503
    const pid = m.pid!;
    expect(alive(pid)).toBe(true);
    await m.stop();
    await expect(starting).rejects.toThrow();
    await sleep(200);
    expect(alive(pid)).toBe(false);
  });

  it('tolerates repeated stop() calls after a normal start', async () => {
    const m = manager(0);
    await m.start();
    const pid = m.pid!;
    expect(await m.stop()).toBe(true);
    expect(await m.stop()).toBe(false);
    await sleep(200);
    expect(alive(pid)).toBe(false);
    expect(m.status).toBe('stopped');
  });
});

describe('closing during inference', () => {
  let server: http.Server | null = null;
  afterEach(async () => { await new Promise<void>((r) => (server ? server.close(() => r()) : r())); server = null; });

  it('an in-flight generation resolves with reviewed fallback when the model server goes away', async () => {
    server = http.createServer(() => { /* never answers: generation in progress */ });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const ai = new AIService({ endpoint: () => ({ baseUrl: url, apiKey: 'k' }), timeoutMs: 10_000, retries: 0 });
    const req = buildScenarioRequest(newGame(aloneSurvey()).getState())!;
    const t0 = Date.now();
    const pending = ai.generateScenario(req, 'run-x');
    await sleep(150);
    server.closeAllConnections();          // llama-server killed mid-request
    const c = await pending;
    expect(c.source).toBe('fallback');
    expect(c.actionIds).toEqual(req.allowedActionIds);
    expect(Date.now() - t0).toBeLessThan(5_000); // not waiting for the 10 s timeout
  });
});
