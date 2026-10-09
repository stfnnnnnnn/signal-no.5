# Development Setup (Windows)

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Windows | 10 22H2 or 11, x64 | Development and the demo target |
| Git | any recent | |
| **Node.js** | **≥ 22.12** (Node **24 LTS** recommended) | Enforced by `package.json` `engines`; required by Electron 44. Verified with Node 24.21.0 / npm 11.19.0 |
| npm | ships with Node | npm 11 blocks dependency install scripts by default (see §6) |
| GPU + model | **optional** | Only needed for real local inference ([LOCAL_AI_SETUP.md](LOCAL_AI_SETUP.md)). Without it the app runs in fallback mode |

Install Node 24 LTS from nodejs.org (installer), or use the official `node-v24.x-win-x64.zip` and put its folder first on `PATH` for your shell. Check with `node --version` and `npm --version`.

## 2. Install

```powershell
git clone <repository-url> "signal no.5"
cd "signal no.5"
npm install
```

If `node_modules\electron\dist\electron.exe` is missing after install (npm 11 blocks Electron's post-install download), run:

```powershell
node node_modules/electron/install.js
```

## 3. Commands (from `package.json`)

| Task | Command |
|---|---|
| Run all tests | `npm test` |
| Tests in watch mode | `npm run test:watch` |
| One test file | `npx vitest run tests/clock.test.ts` |
| Type check | `npm run typecheck` |
| Dev app (hot reload; renderer at `http://localhost:5173`) | `npm run dev` |
| Production build to `out/` | `npm run build` |
| Run the built app | `npm run start` |
| Package the Windows folder | `npm run pack` (see [WINDOWS_PACKAGING.md](WINDOWS_PACKAGING.md)) |

Expected results: `npm test` → **185 passed**; `npm run typecheck` → no output, exit code 0.

## 4. Environment variables (all optional)

These are the only variables the code reads (`src/main/config.ts`, `scripts/pack.mjs`, `src/main/index.ts`):

| Variable | Read by | Default | Purpose |
|---|---|---|---|
| `SIGNAL_LLM_DIR` | app (dev), `pack.mjs` | `D:\signal-llm\llama-b11517-cuda124` | Folder containing `llama-server.exe` + DLLs |
| `SIGNAL_MODEL` | app (dev) | first existing of `C:\signal-llm\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf`, `D:\signal-llm\models\Qwen3-1.7B-Q4_K_M.gguf` | Model file for dev runs |
| `SIGNAL_MODEL_FILE` | `pack.mjs` | `C:\signal-llm\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf` | The single model to bundle |
| `SIGNAL_NGL` | app | `99` | GPU layers (`-ngl`) |
| `SIGNAL_CTX` | app | `2048` | Context size (`-c`) |
| `SIGNAL_AI_TIMEOUT_MS` | app | `12000` | Per-request timeout |
| `SIGNAL_AI_MAX_TOKENS` | app | `220` | Output token cap |
| `ELECTRON_RENDERER_URL` | app | set by `electron-vite dev` | Dev server URL. Don't set manually |

The defaults are the original developer's folders. **On other machines they won't exist, so the app automatically runs in fallback mode.** Set `SIGNAL_LLM_DIR` and `SIGNAL_MODEL` to enable inference, for example:

```powershell
$env:SIGNAL_LLM_DIR = 'E:\tools\llama-b11517-cuda124'
$env:SIGNAL_MODEL   = 'E:\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf'
npm run dev
```

## 5. Working without the model (frontend developers)

Nothing to configure. With no runtime or model found:
- `window.signal.ai.status()` → `'unavailable'`.
- `window.signal.ai.generateScenario(...)` resolves immediately with reviewed fallback text (`source: 'fallback'`, `fallbackReason: 'model-unavailable'`), with the same variant and action list the engine chose.
- `narrateDebrief` returns a deterministic summary. Saves, badges and the whole simulation work normally.

This mode was verified by running the app with `SIGNAL_LLM_DIR` pointing at a non-existent folder. To force it on a machine that has the model, set `SIGNAL_LLM_DIR` to any non-existent path.

The engine itself (`src/core`) has no Electron dependency, so you can also drive it directly from tests or scripts (see `tests/helpers.ts` → `newGame`, `playToEnd`).

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` warns "install scripts … not yet covered by allowScripts" | Expected with npm 11. Electron's binary may be missing; run `node node_modules/electron/install.js`. The esbuild warning is harmless (the build works) |
| `electron` exits immediately or prints a Node stack trace / "Node.js v24…" | `ELECTRON_RUN_AS_NODE=1` is set (VS Code terminals do this). Use the npm scripts (they clear it via `scripts/run.mjs`), or `$env:ELECTRON_RUN_AS_NODE = $null` in PowerShell |
| `EBADENGINE` / Electron install fails | Node is older than 22.12. Upgrade to Node 24 LTS |
| `npm run dev` window shows AI `unavailable` | Expected without a model. See [LOCAL_AI_SETUP.md](LOCAL_AI_SETUP.md) |
| Port 5173 busy | Another Vite dev server is running. Close it |
| "Second instance" closes immediately | The app holds a single-instance lock. Close the running copy |
| Rollup warns "contains an annotation that Rollup cannot interpret" (zod) | Harmless build notice |
