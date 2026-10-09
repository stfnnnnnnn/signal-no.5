# Local AI Setup

The local model writes **only** NPC dialogue, short scene descriptions and debrief wording. The deterministic engine chooses every event, variant, action list and fact. The model never changes game state. If the model is missing, slow or wrong, the game uses reviewed fallback text and stays fully playable.

## 1. What's supported (measured on 2026-10-09)

| Component | Value |
|---|---|
| Runtime | llama.cpp `llama-server`, build **b11517**, `llama-b11517-bin-win-cuda-12.4-x64.zip` (sha256 `136c9581…16ab4d`) |
| CUDA runtime | `cudart-llama-bin-win-cuda-12.4-x64.zip` (sha256 `8c79a9b2…ae1d6`), extracted **into the same folder**: `cudart64_12.dll`, `cublas64_12.dll`, `cublasLt64_12.dll` |
| Primary model | `Qwen3-4B-Instruct-2507-Q4_K_M.gguf` (unsloth, 2,497,281,120 bytes, sha256 `3605803b…c67e597`, Apache-2.0) |
| Lighter alternative | `Qwen3-1.7B-Q4_K_M.gguf` (unsloth, 1,107,409,472 bytes, Apache-2.0) |
| Format | GGUF |
| GPU | NVIDIA GPU with a CUDA-12-class driver. The CUDA 13 llama.cpp builds need driver ≥ 580 and **won't** run on 576.x. Baseline: GTX 1650 Ti 4 GB (4B uses ≈ 3.3 of 4 GB with all 37 layers on the GPU) |
| CPU-only | Not configured or tested. The CUDA build includes CPU backends, but performance is unmeasured |

Downloads come from the official GitHub release `ggml-org/llama.cpp` tag `b11517` and the Hugging Face repos `unsloth/Qwen3-4B-Instruct-2507-GGUF` and `unsloth/Qwen3-1.7B-GGUF`. **Never commit runtime binaries or model weights.** `.gitignore` excludes `*.gguf` and `vendor/llm/`. Full research and benchmark numbers are in [MODEL_AND_RUNTIME_RESEARCH.md](../architecture/MODEL_AND_RUNTIME_RESEARCH.md).

## 2. Install (example folders; any location works)

```powershell
# 1. Extract BOTH zips into one folder (example path):
Expand-Archive llama-b11517-bin-win-cuda-12.4-x64.zip   -DestinationPath E:\tools\llama-b11517-cuda124
Expand-Archive cudart-llama-bin-win-cuda-12.4-x64.zip   -DestinationPath E:\tools\llama-b11517-cuda124
# The folder must contain llama-server.exe, llama-server-impl.dll, ggml-cuda.dll, cudart64_12.dll, cublas64_12.dll, cublasLt64_12.dll

# 2. Put the model anywhere (an SSD is faster on first load):
#    E:\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf

# 3. Point the app at them:
$env:SIGNAL_LLM_DIR = 'E:\tools\llama-b11517-cuda124'
$env:SIGNAL_MODEL   = 'E:\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf'
npm run dev
```

If neither variable is set, the dev app tries the original developer's default paths (see [DEVELOPMENT_SETUP.md §4](DEVELOPMENT_SETUP.md#4-environment-variables-all-optional)), and otherwise falls back.

## 3. How it runs

1. **Start** (`LlmServerManager`, `src/main/llm/serverManager.ts`):
   - Clean up a stale server, but only after verifying it's ours: same exe path, alias marker and start time.
   - Pick a free port from 18731–18735.
   - Spawn `llama-server.exe -m <model> --host 127.0.0.1 --port <p> -ngl 99 -c 2048 -np 1 --no-webui --api-key <random> --alias signalno5-<token> --reasoning off`.
   - Poll `GET /health` (503 while loading → 200).
2. **Warm-up** (`AIService.warmUp`): one tiny request, status `warming` → `ready`. It absorbs the slow first request (measured ≈ 20 s once for a new model).
3. **Status** for the UI: `window.signal.ai.status()` / `onStatus` → `starting | warming | ready | unavailable | stopped`.
4. **Requests** (`AIService.generateScenario`, `src/main/ai/aiService.ts`):
   - One at a time, using the OpenAI-compatible `/v1/chat/completions` with `response_format: json_schema`.
   - The schema pins `eventId`, `variantId` and the exact ordered `actionIds` tuple, plus length caps.
   - Timeout 12 s (`SIGNAL_AI_TIMEOUT_MS`), `max_tokens` 220 (`SIGNAL_AI_MAX_TOKENS`), 1 retry on invalid output, no retry after a timeout.
   - Results are cached per `runId:eventId:variantId`.
5. **Validation** (`validateScenarioResponse`, `src/core/ai/scenario.ts`):
   - JSON parse, then a Zod schema check.
   - The action list must equal the engine's list exactly.
   - **Grounding guard** (`src/core/ai/guard.ts`) rejects: URLs, phone numbers, signal levels, storm categories, safety guarantees, medical instructions, stated forecasts, claims about what officials or advisories say, instructions to evacuate, invented places (outside the arrival event), family members for single-person households, and items the household doesn't have.
6. **Fallback** (`fallbackFromRequest`): reviewed text for the selected variant, with identical actions. `source: 'fallback'` plus a `fallbackReason` for diagnostics.
7. **Shutdown:** on quit the server is killed and the PID file removed. If Electron crashes, Windows ends the child process too (measured).

Measured on the GTX 1650 Ti through the real Electron stack (Qwen3-4B, 2048 context):
- Ready 3.3 s warm (18.8 s on the first launch from a new folder on an HDD).
- Warm-up ≈ 0.3 s.
- 3.7–5.0 s per scenario response.

## 4. Verify

```powershell
npm run build
node scripts\run.mjs node_modules\electron\dist\electron.exe . --self-test   # backslashes required (cmd.exe)
Get-Content "$env:APPDATA\signal-no5\selftest.json"
```

`selftest.json` should show:
- `"aiStatus": "ready"`
- scenarios with `"source": "ai"` and `"actionsExact": true`
- `"saveRoundTrip": true`

The process exits by itself, and no `llama-server.exe` should remain (`Get-Process llama-server` → none).

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Status `unavailable`, `selftest.json` startup error "model server not found" | `SIGNAL_LLM_DIR` is wrong or doesn't contain `llama-server.exe` |
| Status `unavailable`, "exited during startup" | Model path wrong, CUDA DLLs missing (extract the cudart zip into the same folder), or the driver is too old for CUDA 12.4. Check `%APPDATA%\signal-no5\llm-server.log` |
| Very slow first launch | One-time GPU warm-up for a new model plus a cold disk read (HDD). Later launches take ~3 s |
| Log warning `failed to fit params … n_gpu_layers already set by user to 99, abort` | Informational: llama.cpp's auto-fit is skipped because `-ngl` is explicit. All layers still load (verified) |
| Out-of-memory on a 4 GB GPU | Close other GPU apps; try `SIGNAL_CTX=1536` or the 1.7B model; or `SIGNAL_NGL` < 37 (slower) |
| Many `fallbackReason: "ungrounded:…"` | The guard rejected the model's text (by design). Review `fallbackReason` values; content and prompt tuning is a known open item |
| `fallbackReason: "timeout"` | The request exceeded `SIGNAL_AI_TIMEOUT_MS`; raise it or use the 1.7B model |
| Another laptop (e.g. RTX 4050) | Run `nvidia-smi`. The driver must support CUDA 12.4 (Windows driver 551.61 or newer, per NVIDIA's CUDA compatibility table). Then run the self-test there |
