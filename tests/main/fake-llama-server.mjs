// Test double for llama-server: a real child process speaking the same HTTP surface.
// Args: --port N --api-key K --alias A [--load-ms N]. /health is 503 while "loading", then 200.
import http from 'node:http';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; };
const port = Number(arg('--port', '0'));
const key = arg('--api-key', '');
const loadMs = Number(arg('--load-ms', '300'));
const started = Date.now();

http.createServer((req, res) => {
  if (req.url === '/health') {
    const ready = Date.now() - started >= loadMs;
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(ready ? { status: 'ok' } : { error: { code: 503, message: 'Loading model' } }));
  }
  if (req.headers.authorization !== `Bearer ${key}`) { res.writeHead(401); return res.end('{}'); }
  res.writeHead(404); res.end('{}');
}).listen(port, '127.0.0.1');
