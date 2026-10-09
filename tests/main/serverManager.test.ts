import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LlmServerManager, type ProcessIdentity } from '../../src/main/llm/serverManager';

const FAKE = resolve(__dirname, 'fake-llama-server.mjs');
const managers: LlmServerManager[] = [];
afterEach(async () => { for (const m of managers.splice(0)) await m.stop(); });

function manager(opts: Partial<ConstructorParameters<typeof LlmServerManager>[0]> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'signalno5-llm-'));
  const m = new LlmServerManager({
    exePath: process.execPath, // node runs the fake server script
    modelPath: 'model.gguf',
    pidFile: join(dir, 'llm-server.json'), logFile: join(dir, 'server.log'),
    buildArgs: (base) => [FAKE, ...base, '--load-ms', '200'],
    ports: [18901, 18902, 18903],
    ...opts,
  });
  managers.push(m);
  return m;
}
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

describe('LlmServerManager lifecycle', () => {
  it('starts the server, waits for /health, and reports ready with an endpoint', async () => {
    const m = manager();
    const r = await m.start();
    expect(m.status).toBe('ready');
    expect(r.readyMs).toBeGreaterThanOrEqual(150);
    const ep = m.endpoint()!;
    expect(ep.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:1890[1-3]$/);
    expect(ep.apiKey.length).toBeGreaterThanOrEqual(32);
  });

  it('passes fixed, explicit arguments (host, port, offload, context, api key, alias, no web UI)', async () => {
    let seen: string[] = [];
    const m = manager({ buildArgs: (base) => { seen = base; return [FAKE, ...base, '--load-ms', '0']; }, ngl: 99, ctx: 2048 });
    await m.start();
    const joined = seen.join(' ');
    for (const part of ['--host 127.0.0.1', '-ngl 99', '-c 2048', '-np 1', '--no-webui', '--api-key', '--alias signalno5-']) expect(joined).toContain(part);
  });

  it('stops the server and leaves no process behind', async () => {
    const m = manager();
    await m.start();
    const pid = m.pid!;
    expect(alive(pid)).toBe(true);
    await m.stop();
    await new Promise((r) => setTimeout(r, 200));
    expect(alive(pid)).toBe(false);
    expect(m.status).toBe('stopped');
  });

  it('skips ports that are already in use', async () => {
    const a = manager(); await a.start();
    const b = manager(); await b.start();
    expect(b.endpoint()!.baseUrl).not.toBe(a.endpoint()!.baseUrl);
  });

  it('reports unavailable when the executable is missing', async () => {
    const m = manager({ exePath: 'C:/does/not/exist/llama-server.exe', buildArgs: (b) => b });
    await expect(m.start()).rejects.toThrow();
    expect(m.status).toBe('unavailable');
  });

  it('marks the server unavailable if it exits unexpectedly', async () => {
    const m = manager();
    await m.start();
    process.kill(m.pid!);
    await new Promise((r) => setTimeout(r, 300));
    expect(m.status).toBe('unavailable');
    expect(m.endpoint()).toBeNull();
  });
});

describe('stale-process cleanup (identity verified)', () => {
  it('leaves an unrelated process alone even if its PID is in the PID file', async () => {
    const decoy = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 20000)']);
    const m = manager({ inspectProcess: async (): Promise<ProcessIdentity> => ({ exe: process.execPath, cmd: 'node -e ...', created: new Date().toISOString() }) });
    writeFileSync(m.options.pidFile, JSON.stringify({ pid: decoy.pid, exePath: process.execPath, port: 18901, startedAt: new Date().toISOString(), token: 'abc' }));
    const r = await m.cleanupStale();
    expect(r.action).toBe('left-alone-identity-mismatch');
    expect(alive(decoy.pid!)).toBe(true);
    decoy.kill();
  });

  it('terminates a stale server only when exe, marker and start time all match', async () => {
    const stale = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 20000)', '--', '--alias', 'signalno5-tok123']);
    const startedAt = new Date().toISOString();
    const m = manager({ inspectProcess: async () => ({ exe: process.execPath, cmd: `node -e x -- --alias signalno5-tok123`, created: startedAt }) });
    writeFileSync(m.options.pidFile, JSON.stringify({ pid: stale.pid, exePath: process.execPath, port: 18901, startedAt, token: 'tok123' }));
    const r = await m.cleanupStale();
    expect(r.action).toBe('killed-verified-stale');
    await new Promise((res) => setTimeout(res, 200));
    expect(alive(stale.pid!)).toBe(false);
  });

  it('ignores a corrupt PID file', async () => {
    const m = manager();
    writeFileSync(m.options.pidFile, 'not json');
    expect((await m.cleanupStale()).action).toBe('discarded-corrupt-pidfile');
  });
});
