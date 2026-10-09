# Windows Packaging

The deliverable is a **portable application folder** containing `SignalNo5.exe`, the llama.cpp runtime and one model. It is **not** a single self-contained `.exe`: electron-builder's single-file "portable" target unpacks to TEMP on every launch, which is impractical with a 2.4 GB model.

## 1. Build and package

```powershell
# Inputs (examples; the defaults are the original developer's paths):
$env:SIGNAL_LLM_DIR    = 'E:\tools\llama-b11517-cuda124'                  # llama.cpp b11517 CUDA 12.4 + cudart DLLs
$env:SIGNAL_MODEL_FILE = 'E:\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf'   # exactly one model is bundled
npm run pack
```

`npm run pack` runs `npm run build` (electron-vite → `out/`), then `scripts/pack.mjs`. That script:
- checks that the runtime folder contains `llama-server.exe`, `llama-server-impl.dll`, `ggml-cuda.dll`, `cudart64_12.dll`, `cublas64_12.dll` and `cublasLt64_12.dll`;
- calls electron-builder with target `dir`;
- copies the runtime and the model **outside** `app.asar` via `extraResources`.

Measured: about 80 s, producing a 3.80 GB folder.

## 2. Output

```
dist\win-unpacked\
  SignalNo5.exe                 Electron app (unsigned)
  resources\
    app.asar                    out/main, out/preload, out/renderer + package.json + zod
    llm\                        34 files, 1.14 GB: llama-server.exe, llama-server-impl.dll, ggml*.dll,
                                llama*.dll, cudart64_12.dll, cublas64_12.dll, cublasLt64_12.dll, …
    models\
      Qwen3-4B-Instruct-2507-Q4_K_M.gguf   2.38 GB
  (Electron/Chromium runtime files)
```

At runtime (`src/main/config.ts`), a packaged app reads `resources\llm\llama-server.exe` and **the first `.gguf` in `resources\models\`**. `SIGNAL_LLM_DIR`/`SIGNAL_MODEL` are ignored when packaged; tuning variables (`SIGNAL_NGL`, `SIGNAL_CTX`, …) still apply. Zip `dist\win-unpacked` to hand it over. No Python, Node or separate AI install is needed on the target machine. It does need an NVIDIA driver that supports CUDA 12.4.

## 3. Runtime behaviour

| Stage | Behaviour |
|---|---|
| First launch | AI status `starting` → `warming` → `ready`. The first launch of a new folder took 18.8 s to ready (cold 2.4 GB read from HDD plus GPU warm-up). Later launches take ~3 s |
| No GPU / runtime failure | Status `unavailable`; the game continues with reviewed fallback text |
| Shutdown | Quitting stops the model server and deletes the PID file. A crash also ends it (Windows job object). The next launch's stale-PID cleanup kills only a verified Signal No. 5 server |
| Data | `%APPDATA%\signal-no5\` (see [LOCAL_STORAGE_SETUP.md](LOCAL_STORAGE_SETUP.md)) |

## 4. Packaged self-test

```powershell
dist\win-unpacked\SignalNo5.exe --self-test
Get-Content "$env:APPDATA\signal-no5\selftest.json"
```

It runs two real scenario generations, a debrief narration and a save round-trip through the main-process stack, then quits. **Verified 2026-10-09** with the CUDA toolkit removed from `PATH`:
- `packaged: true`, `aiStatus: ready`;
- 2/2 scenarios `source: ai` with exact actions, 3.7–4.7 s each;
- `debriefSource: ai`, `saveRoundTrip: true`;
- no `llama-server.exe` left afterwards.

## 5. Offline test: **PENDING**

The airplane-mode run has **not** been done yet. To do it:
1. Turn on Airplane mode (or disconnect Wi-Fi and unplug Ethernet).
2. Confirm there's no connectivity.
3. Run the self-test above and check `selftest.json`, with the same expectations as §4.
4. Reconnect.

Record the result in [docs/implementation/IMPLEMENTATION_PLAN.md](../implementation/IMPLEMENTATION_PLAN.md).

## 6. Common errors

| Error | Fix |
|---|---|
| `Missing llama.cpp runtime: …` / `Missing model: …` | Set `SIGNAL_LLM_DIR` / `SIGNAL_MODEL_FILE` |
| `Runtime folder is missing: cudart64_12.dll, …` | Extract `cudart-llama-bin-win-cuda-12.4-x64.zip` into the runtime folder |
| Electron opens as Node / exits | Run through `npm run pack` (it clears `ELECTRON_RUN_AS_NODE`) |
| SmartScreen warning on the target PC | The build is unsigned. Choose "More info → Run anyway" (code signing is out of scope) |
| AI `unavailable` on the target PC | Driver too old for CUDA 12.4, or no NVIDIA GPU. The game still runs with fallback text |
| Folder > 4 GB when zipped | Expected with the 4B model (≈ 3.8 GB uncompressed). Bundling the 1.7B model instead gives ≈ 2.5 GB |
