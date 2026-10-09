// THROWAWAY spike. LlmServerManager: spawn, health-check, stop, and identity-verified stale cleanup.
const { spawn, execFile } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const PORT_RANGE = [18731, 18732, 18733, 18734, 18735];

function portIsFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

// Read identity fields for a PID via CIM. Arguments are fixed; the PID is validated as an integer.
function processIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return Promise.resolve(null);
  const ps = `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; if ($p) { @{ exe = $p.ExecutablePath; cmd = $p.CommandLine; created = $p.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress }`;
  const encoded = Buffer.from(ps, 'utf16le').toString('base64');  // avoids argument-quoting issues
  return new Promise((resolve) => {
    const psExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    execFile(psExe, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true, timeout: 10000 },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve(null);
        try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
      });
  });
}

class LlmServerManager {
  constructor({ exePath, modelPath, pidFile, logFile, extraArgs = [], ngl = 99, ctx = 3072 }) {
    Object.assign(this, { exePath, modelPath, pidFile, logFile, extraArgs, ngl, ctx });
    this.child = null; this.port = null; this.status = 'stopped';
    this.token = crypto.randomBytes(12).toString('hex');
    this.apiKey = crypto.randomBytes(24).toString('hex');
  }

  // Terminate a previously recorded server ONLY if every identity check passes.
  async cleanupStale() {
    if (!fs.existsSync(this.pidFile)) return { action: 'none' };
    let rec; try { rec = JSON.parse(fs.readFileSync(this.pidFile, 'utf8')); } catch { rec = null; }
    fs.rmSync(this.pidFile, { force: true });
    if (!rec) return { action: 'discarded-corrupt-pidfile' };
    const id = await processIdentity(rec.pid);
    if (!id) return { action: 'not-running', pid: rec.pid };
    const sameExe = typeof id.exe === 'string' && path.resolve(id.exe).toLowerCase() === path.resolve(this.exePath).toLowerCase();
    const hasMarker = typeof id.cmd === 'string' && id.cmd.includes(`signalno5-${rec.token}`);
    const ageDelta = Math.abs(Date.parse(id.created) - Date.parse(rec.startedAt));
    const sameStart = Number.isFinite(ageDelta) && ageDelta < 10000;
    if (sameExe && hasMarker && sameStart) {
      try { process.kill(rec.pid); return { action: 'killed-verified-stale', pid: rec.pid }; }
      catch (e) { return { action: 'kill-failed', pid: rec.pid, error: String(e) }; }
    }
    return { action: 'left-alone-identity-mismatch', pid: rec.pid, sameExe, hasMarker, sameStart };
  }

  async start({ timeoutMs = 90000 } = {}) {
    const cleanup = await this.cleanupStale();
    this.port = null;
    for (const p of PORT_RANGE) { if (await portIsFree(p)) { this.port = p; break; } }
    if (!this.port) throw new Error('no free port in range');
    const args = ['-m', this.modelPath, '--host', '127.0.0.1', '--port', String(this.port),
      '-ngl', String(this.ngl), '-c', String(this.ctx), '-np', '1', '--no-webui', '--api-key', this.apiKey,
      '--alias', `signalno5-${this.token}`, ...this.extraArgs];
    const log = fs.openSync(this.logFile, 'w');
    this.child = spawn(this.exePath, args, { cwd: path.dirname(this.exePath), windowsHide: true, shell: false, stdio: ['ignore', log, log] });
    const startedAt = new Date().toISOString();
    fs.writeFileSync(this.pidFile, JSON.stringify({ pid: this.child.pid, exePath: this.exePath, port: this.port, startedAt, token: this.token }));
    this.status = 'starting';
    this.child.once('exit', (code) => { this.status = 'unavailable'; this.exitCode = code; this.child = null; });
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (!this.child) throw new Error(`server exited during startup (code ${this.exitCode})`);
      try {
        const r = await fetch(`http://127.0.0.1:${this.port}/health`, { signal: AbortSignal.timeout(2000) });
        if (r.status === 200) { this.status = 'ready'; return { cleanup, readyMs: Date.now() - t0, port: this.port }; }
      } catch { /* still loading */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    this.status = 'unavailable';
    throw new Error('server did not become ready in time');
  }

  stop() {
    return new Promise((resolve) => {
      fs.rmSync(this.pidFile, { force: true });
      if (!this.child) return resolve(false);
      const c = this.child;
      const timer = setTimeout(() => resolve(false), 5000);
      c.once('exit', () => { clearTimeout(timer); resolve(true); });
      c.kill();
    });
  }
}

module.exports = { LlmServerManager, processIdentity };
