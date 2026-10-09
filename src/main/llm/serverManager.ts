// Owns the llama-server child process (ARCHITECTURE_LOCK §3.2). Node-only; no Electron imports (testable).
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export type ServerStatus = 'stopped' | 'starting' | 'ready' | 'unavailable';
export interface ProcessIdentity { exe: string | null; cmd: string | null; created: string | null }
export interface Endpoint { baseUrl: string; apiKey: string }

export interface ServerManagerOptions {
  exePath: string;
  modelPath: string;
  pidFile: string;
  logFile: string;
  ngl?: number;
  ctx?: number;
  extraArgs?: string[];
  ports?: number[];
  startupTimeoutMs?: number;
  /** Test hook: transform the argument list (e.g. to run a fake server script). */
  buildArgs?: (base: string[]) => string[];
  /** Read identity fields of a PID (default: Windows CIM via absolute-path PowerShell). */
  inspectProcess?: (pid: number) => Promise<ProcessIdentity | null>;
}

export type CleanupResult =
  | { action: 'none' | 'discarded-corrupt-pidfile' }
  | { action: 'not-running' | 'killed-verified-stale' | 'kill-failed'; pid: number }
  | { action: 'left-alone-identity-mismatch'; pid: number; sameExe: boolean; hasMarker: boolean; sameStart: boolean };

export const DEFAULT_PORTS = [18731, 18732, 18733, 18734, 18735];

/** Windows: read ExecutablePath/CommandLine/CreationDate for a PID. PowerShell by absolute path, encoded command. */
export function inspectProcessWindows(pid: number): Promise<ProcessIdentity | null> {
  if (!Number.isInteger(pid) || pid <= 0) return Promise.resolve(null);
  const ps = `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; if ($p) { @{ exe = $p.ExecutablePath; cmd = $p.CommandLine; created = $p.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress }`;
  const psExe = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return new Promise((resolve) => {
    execFile(psExe, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true, timeout: 10_000 },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve(null);
        try { resolve(JSON.parse(stdout) as ProcessIdentity); } catch { resolve(null); }
      });
  });
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LlmServerManager {
  readonly options: ServerManagerOptions;
  status: ServerStatus = 'stopped';
  private child: ChildProcess | null = null;
  private port: number | null = null;
  private readonly token = randomBytes(12).toString('hex');
  private readonly apiKey = randomBytes(24).toString('hex');
  private listeners = new Set<(s: ServerStatus) => void>();

  constructor(options: ServerManagerOptions) {
    this.options = options;
  }

  get pid(): number | null { return this.child?.pid ?? null; }
  onStatus(fn: (s: ServerStatus) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private setStatus(s: ServerStatus) { this.status = s; for (const fn of this.listeners) fn(s); }

  endpoint(): Endpoint | null {
    return this.status === 'ready' && this.port ? { baseUrl: `http://127.0.0.1:${this.port}`, apiKey: this.apiKey } : null;
  }

  /** Terminate a previously recorded server ONLY if exe path, alias marker and start time all match. */
  async cleanupStale(): Promise<CleanupResult> {
    const file = this.options.pidFile;
    if (!existsSync(file)) return { action: 'none' };
    let rec: { pid: number; exePath: string; startedAt: string; token: string } | null = null;
    try { rec = JSON.parse(readFileSync(file, 'utf8')); } catch { rec = null; }
    rmSync(file, { force: true });
    if (!rec || !Number.isInteger(rec.pid)) return { action: 'discarded-corrupt-pidfile' };
    const id = await (this.options.inspectProcess ?? inspectProcessWindows)(rec.pid);
    if (!id) return { action: 'not-running', pid: rec.pid };
    const sameExe = !!id.exe && path.resolve(id.exe).toLowerCase() === path.resolve(this.options.exePath).toLowerCase();
    const hasMarker = !!id.cmd && id.cmd.includes(`signalno5-${rec.token}`);
    const delta = Math.abs(Date.parse(id.created ?? '') - Date.parse(rec.startedAt));
    const sameStart = Number.isFinite(delta) && delta < 10_000;
    if (!(sameExe && hasMarker && sameStart)) return { action: 'left-alone-identity-mismatch', pid: rec.pid, sameExe, hasMarker, sameStart };
    try { process.kill(rec.pid); return { action: 'killed-verified-stale', pid: rec.pid }; } catch { return { action: 'kill-failed', pid: rec.pid }; }
  }

  async start(): Promise<{ readyMs: number; port: number; cleanup: CleanupResult }> {
    if (this.status === 'ready' || this.status === 'starting') throw new Error(`server already ${this.status}`);
    this.setStatus('starting');
    try {
      const cleanup = await this.cleanupStale();
      this.port = null;
      for (const p of this.options.ports ?? DEFAULT_PORTS) if (await portIsFree(p)) { this.port = p; break; }
      if (!this.port) throw new Error('no free port for the model server');
      if (!existsSync(this.options.exePath)) throw new Error(`model server not found: ${this.options.exePath}`);
      const base = ['-m', this.options.modelPath, '--host', '127.0.0.1', '--port', String(this.port), '-ngl', String(this.options.ngl ?? 99),
        '-c', String(this.options.ctx ?? 2048), '-np', '1', '--no-webui', '--api-key', this.apiKey, '--alias', `signalno5-${this.token}`, ...(this.options.extraArgs ?? [])];
      const args = this.options.buildArgs ? this.options.buildArgs(base) : base;
      const log = openSync(this.options.logFile, 'w');
      // Never `detached`: Node/libuv's kill-on-close job object then ends the server if Electron dies (measured).
      const child = spawn(this.options.exePath, args, { cwd: path.dirname(this.options.exePath), windowsHide: true, shell: false, stdio: ['ignore', log, log] });
      closeSync(log);
      this.child = child;
      const startedAt = new Date().toISOString();
      writeFileSync(this.options.pidFile, JSON.stringify({ pid: child.pid, exePath: this.options.exePath, port: this.port, startedAt, token: this.token }));
      let exited = false;
      child.once('error', () => { exited = true; });
      child.once('exit', () => { exited = true; this.child = null; if (this.status !== 'stopped') this.setStatus('unavailable'); rmSync(this.options.pidFile, { force: true }); });
      const t0 = Date.now();
      const timeout = this.options.startupTimeoutMs ?? 120_000;
      while (Date.now() - t0 < timeout) {
        if (exited) throw new Error('model server exited during startup');
        try {
          const r = await fetch(`http://127.0.0.1:${this.port}/health`, { signal: AbortSignal.timeout(2000) });
          if (r.status === 200) { this.setStatus('ready'); return { readyMs: Date.now() - t0, port: this.port, cleanup }; }
        } catch { /* still loading */ }
        await sleep(150);
      }
      throw new Error('model server did not become ready in time');
    } catch (e) {
      await this.stop();
      this.setStatus('unavailable');
      throw e;
    }
  }

  async stop(): Promise<boolean> {
    rmSync(this.options.pidFile, { force: true });
    const c = this.child;
    if (!c) { if (this.status !== 'unavailable') this.setStatus('stopped'); return false; }
    this.setStatus('stopped');
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      c.once('exit', () => { clearTimeout(timer); resolve(true); });
      c.kill();
    });
  }
}
