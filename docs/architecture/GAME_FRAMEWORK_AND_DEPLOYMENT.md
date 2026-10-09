# Game Framework and Deployment

> **Status:** Stage A research (2026-10-09). The decisions are recorded in [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md) §1 and §4.

## Decision summary (supersedes the recommendation in the research notes below)

The research below recommended **Godot 4.7.2** on its baseline scoring, with one exception: Phaser wins (4.20 vs 4.15) when **no one on the team knows Godot and the team is strong in web/TS**. The team confirmed that's our situation (option C, 2026-10-09). The team then added a requirement for a **Windows desktop `.exe`**. Re-evaluated against that:

| Priority | Phaser 3 + React + Electron | Godot 4.7.2 | Tauri |
|---|---|---|---|
| Windows `.exe` | ✅ electron-builder | ✅ native, smaller | ✅ smallest |
| Managed local runtime | ✅ Node `child_process` in main | ✅ `OS.create_process` | ✅ sidecar API |
| Keep TS/Zod contracts | ✅ unchanged | ❌ re-implement in GDScript | ✅ |
| Tests + Claude-assisted dev | ✅ Vitest, Playwright (Electron) | ⚠️ GUT | ⚠️ Rust |
| 20 h feasibility for this team | ✅ | ❌ no Godot experience | ❌ no Rust toolchain/experience |

**Selected:** Phaser **3.90.0** (final v3 release, 2025-05-23 [V]; chosen over 4.2.1 because there are far more v3 top-down/Tiled examples [E]) + TypeScript + React + **Electron 44.x** (44.7.0, 2026-10-08, Node 24.21 / Chromium 152 [V: releases.electronjs.org]) + electron-builder **`dir`** target.

### Electron packaging facts used
- `extraResources` copies files into `resources/` **outside** `app.asar`, and code reads them via `process.resourcesPath` [V: https://www.electron.build/docs/contents, accessed 2026-10-09].
- The `portable` target unpacks to TEMP per launch (`unpackDirName`) [V: https://www.electron.build/docs/api/app-builder-lib.Interface.PortableOptions], so it's unsuitable for large model files. Use `dir`.
- Renderer hardening: context isolation (default since Electron 12), `contextBridge.exposeInMainWorld`, and never exposing raw `ipcRenderer` [V: https://www.electronjs.org/docs/latest/tutorial/context-isolation].
- The llama.cpp CUDA build needs the **separate** `cudart-…` zip. The executable doesn't contain the CUDA DLLs [V: release assets]. See ARCHITECTURE_LOCK §4.

**Android:** deferred. A future path would be either a different engine or an in-process llama.cpp binding. It's out of hackathon scope.

---

## Research notes (Research Agent A, Godot-provisional; retained for evidence)

# Research A: Framework and Deployment for "Signal No. 5"

All sources accessed **2026-10-09**. Labels used: **[V]** = checked against an official page this session; **[EJ]** = engineering judgement; **[UNVERIFIED]** = from prior knowledge only, not re-checked this session.

---

## 0. TL;DR

- **Engine:** **Godot 4.7.2-stable** (released 2026-08-18), GDScript, Standard (non-.NET) build. [V]
- **Weighted matrix (baseline):** Godot **4.55**, Phaser (TS + Electron/Tauri) **4.00**, Python Arcade **3.35**. Godot wins in every scenario except one: if **nobody on the team knows Godot and the team is strong in TS/web**, Phaser comes out narrowly ahead (4.20 vs 4.15), which is effectively a tie.
- **LLM integration:** keep the LLM out of the engine process. Godot launches the bundled `llama-server.exe` with `OS.create_process`, polls `GET /health` until it returns 200, then calls `/v1/chat/completions` through `HTTPRequest` with a JSON-schema `response_format`, and validates the result again in GDScript. Ollama is a fallback, used only if a dev already has it installed. Don't build on NobodyWho or godot-llm for this hackathon.
- **PySide6:** not needed. Embedding Pygame in Qt depends on the `SDL_WINDOWID` hack, which the docs warn about. Treat it as fragile.
- **Android:** defer. It's feasible later through NobodyWho or a custom llama.cpp GDExtension, but it doesn't fit in 20 hours.

---

## 1. Godot 4: version and API verification

### 1.1 Latest stable
| Item | Finding | Source |
|---|---|---|
| Latest stable | **4.7.2-stable, 2026-08-18** (maintenance). 4.7-stable was 2026-06-18, 4.7.1 was 2026-07-14. | https://godotengine.org/download/windows/ ; https://github.com/godotengine/godot/releases [V] |
| Next line | 4.8 is in dev (gdUnit4 lists "v4.8.dev7"). **Don't use it.** | https://github.com/godot-gdunit-labs/gdUnit4 [V] |
| Docs | `docs.godotengine.org/en/stable/` currently serves **4.7** docs. | pages below [V] |
| Install | Godot isn't installed on the demo machine. The editor ships as a portable download, no installer needed [UNVERIFIED exact size]. Export templates install via *Editor > Manage Export Templates* or offline from a `.tpz` file. | https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html [V] |

**Recommendation:** pin **Godot 4.7.2 Standard (GDScript)**. Every dev should use the same build. Commit a `.godot-version` note or a README line.

### 1.2 API checks against 4.7 docs
| API | Status in 4.7 | Notes | Source |
|---|---|---|---|
| **TileMap** | **Deprecated.** "Use multiple TileMapLayer nodes instead." The editor has an "Extract TileMap layers" tool. | Use **TileMapLayer** (one node per layer: floor, walls, furniture). | https://docs.godotengine.org/en/stable/classes/class_tilemap.html [V] |
| **CharacterBody2D.move_and_slide()** | No arguments. Uses the `velocity` property and returns `bool`. `MOTION_MODE_FLOATING` is documented as "suitable for top-down games". | Set `motion_mode = FLOATING` for 4-direction movement. | https://docs.godotengine.org/en/stable/classes/class_characterbody2d.html [V] |
| AnimatedSprite2D, Area2D/CollisionShape2D, CanvasLayer/Control/Theme, Autoloads, custom `Resource` with `class_name` and `@export` | Core 4.x features, unchanged in kind | Class pages weren't fetched individually this session. | [UNVERIFIED this session; very high confidence] |
| **JSON** | `JSON.parse_string()` (static) returns `null` on failure and gives no error detail. Instance `JSON.parse()` returns an `Error` and exposes `get_error_line()` / `get_error_message()`. **Numbers parse as float.** No schema validation. | Use the instance `parse()` on LLM output so failures can be logged. Cast ints explicitly. | https://docs.godotengine.org/en/stable/classes/class_json.html [V] |
| **FileAccess** | Standard 4.x file I/O. | Not re-fetched. | [UNVERIFIED this session] |
| **HTTPRequest** | Non-blocking: results arrive through the `request_completed` signal. `timeout` defaults to 0 (none), and the docs recommend 1-10 s for REST. Also has `use_threads`, `download_chunk_size`, `body_size_limit`. One request per node at a time. **No streaming**: the body arrives whole. Android needs the INTERNET permission. | Fits short strict-JSON replies well. Set `timeout` to about 8-15 s. Use one HTTPRequest node per in-flight call. | https://docs.godotengine.org/en/stable/classes/class_httprequest.html [V] |
| **HTTPClient** | Poll-based, low-level. `read_response_body_chunk()`, `is_response_chunked()`, `read_chunk_size`, `blocking_mode_enabled`. **Can consume streamed or chunked (SSE) responses incrementally.** | Only needed for a token-streaming "typing" effect. Not needed for strict JSON. | https://docs.godotengine.org/en/stable/classes/class_httpclient.html [V] |
| http://127.0.0.1 | The docs list no localhost restriction. Plain HTTP needs no TLS. | | HTTPRequest page [V]. Android cleartext behaviour [UNVERIFIED] |
| **WorkerThreadPool** | `add_task(callable)`, `is_task_completed()`, `wait_for_task_completion()`. The docs warn the scene tree isn't thread-safe. | Not needed with HTTPRequest. The simulation should stay deterministic on the main thread. | https://docs.godotengine.org/en/stable/classes/class_workerthreadpool.html [V] |
| **OS process control** | `create_process(path, args, open_console=false) -> pid` and `execute_with_pipe(path, args, blocking=true) -> {stdio, stderr, pid}`. Also `kill(pid)`, `is_process_running(pid)`, `get_process_exit_code(pid)`, `execute()` (blocking). All available on **Windows and Android**. | Can launch and kill `llama-server.exe` as a sidecar. | https://docs.godotengine.org/en/stable/classes/class_os.html [V] |
| **GDExtension** | Supported native-extension mechanism in 4.x. | The intro page returned 404 this session. | [UNVERIFIED this session] |

### 1.3 Pixel-art settings
- Docs: use **Stretch Mode = `viewport`** and **Stretch Scale Mode = `integer`** ("rounded down to the nearest integer") under *Display > Window*. Base size should be something like 320x180 or 384x216. Aspect: `keep`, or `expand` if you want more of the world shown. https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html [V]
  - On a 1920x1080 display, **320x180 gives an exact 6x** and **384x216 gives an exact 5x**. Both are clean on 1080p. [EJ, arithmetic]
- Default canvas texture filter = **Nearest** (Project Settings, *Rendering > Textures > Canvas Textures > Default Texture Filter*). [UNVERIFIED exact path this session, standard 4.x setting]
- **Palette swap:** a `canvas_item` shader that samples a small palette texture (`uniform sampler2D palette : filter_nearest;`) and maps the source color index or luminance to the palette row. Swap themes by swapping the palette texture or the row uniform. This is a standard technique. [EJ; `filter_nearest` hint syntax UNVERIFIED this session]

### 1.4 JSON Schema validation in GDScript
| Option | Type | Status | Source |
|---|---|---|---|
| **GDSchema** (fimbul-works) | C++ GDExtension, MIT. Godot 4.3+. v2.1.0. Claims full draft-07 and 2020-12 test-suite conformance. Binaries for Windows x64 and Android arm64/x64. | Most complete option, but it's a native dependency. | https://github.com/fimbul-works/GDSchema [V] |
| GD JSON Schema (whogben) | Pure GDScript, Godot 4.1+, v0.5, supports a subset of keywords. | Small and easy to vendor. Old. | https://github.com/whogben/gd_json_schema (via asset-lib search) [V-ish: search snippet only] |
| kibble-cabal json-library | GDScript parse and validate addon | Not evaluated | https://github.com/kibble-cabal/json-library [search snippet only] |

**Recommendation [EJ]:** **hand-write validators** (about 50-100 lines of GDScript per response type: required keys, types, enum membership against IDs the simulation allows, string length clamp). Also send the JSON schema to llama-server / Ollama so decoding is constrained on the model side. There are only a handful of fixed response shapes, so hand validators are easier to test and debug than a native addon. Don't take on GDSchema unless the shapes multiply.

### 1.5 Test frameworks
| Framework | Version for 4.7 | Source |
|---|---|---|
| **GUT** | **9.7.1 lists Godot 4.7.x support** (main branch = 4.6.x) | https://github.com/bitwes/Gut [V] |
| **gdUnit4** | v6.2.x lists Godot **4.5 to 4.7.1**. master (v6.2.2) lists 4.5 to 4.8.dev7. Has CLI, JUnit/HTML reports and a GitHub Action. **4.7.2 isn't named explicitly**, though a patch release should work. | https://github.com/godot-gdunit-labs/gdUnit4 [V] |

**Recommendation [EJ]:** use **GUT 9.7.1**. Its version table names 4.7.x, and it's simple. Use it for headless tests of the deterministic simulation and the JSON validators.

---

## 2. Godot and local LLM integration

### 2.1 Sidecar process (recommended)
- Call `OS.create_process(exe_path, args)` with a real filesystem path. A `res://` path won't work for an executable, so build the path from `OS.get_executable_path().get_base_dir()`. Pass `["-m", model_path, "--host","127.0.0.1","--port", "<port>", "-ngl", "all", "-c", "4096"]` and keep the returned pid. Call `OS.kill(pid)` on `NOTIFICATION_WM_CLOSE_REQUEST`. API [V]. Path approach [EJ].
- llama-server facts: `GET /health` returns **503 "Loading model"** while loading and **200 `{"status":"ok"}`** when ready. `/completion` and `/v1/chat/completions` take `response_format: {"type":"json_schema","schema":{...}}` and also `grammar`. `stream: true` uses SSE. `--offline` blocks network access. `-ngl` accepts N / `auto` / `all`. https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md [V]
  - The README fetch reported the **default bind as `127.0.0.1:9931`**. Older builds used 8080. **Always pass `--port` explicitly.** [V as reported, but surprising]
- llama.cpp latest release seen: **b11517**, with Windows assets `win-cuda-12.4-x64`, `win-cuda-13.4-x64`, `win-vulkan-x64`, `win-cpu-x64`, plus matching `cudart` zips. The page rendering gave the date as "October 9, 2024", which is almost certainly a rendering error. https://github.com/ggml-org/llama.cpp/releases [V tag/assets; date UNVERIFIED]
  - **Demo GPU: GTX 1650 Ti on driver 576.02 (CUDA 12.9) should use the `cuda-12.4` build.** It probably can't run the `cuda-13.4` build because that needs a CUDA-13 driver. Keep the **Vulkan** build as a fallback. [EJ based on CUDA driver compatibility]
- Pick one async pattern [EJ]: an `LLMClient` autoload with a queue and one in-flight HTTPRequest, timeout of about 10 s, and a deterministic **fallback text table** used on timeout, invalid JSON, or validation failure. The game stays fully playable with the AI off.
- Qwen3-1.7B: Apache-2.0, 32k context, thinking switch via `enable_thinking` or `/no_think`. https://huggingface.co/Qwen/Qwen3-1.7B [V]. With llama-server, disable thinking through the chat template kwargs or `/no_think` [UNVERIFIED exact llama-server flag]. With Ollama, use `think: false` "if the model permits it", and check with `/api/show`. https://docs.ollama.com/capabilities/thinking [V]

### 2.2 Ollama path
- Windows 10 22H2+ is required. NVIDIA driver ≥ 551.61. Server runs at `http://localhost:11434`. `ollama-windows-amd64.zip` is offered "for embedding in applications". `OLLAMA_MODELS` sets the model directory. https://docs.ollama.com/windows [V]
- Structured output: `format: "json"` or a JSON-schema object on `/api/chat`. The docs recommend putting the schema in the prompt and using temperature 0. https://docs.ollama.com/capabilities/structured-outputs [V]
- Godot can detect Ollama by sending `GET http://127.0.0.1:11434/api/tags` through HTTPRequest with a short timeout. [EJ; endpoint UNVERIFIED this session]
- Drawbacks for the demo [EJ]: the base install is 4 GB, there's a separate model store, and a tray/service lifecycle sits outside your control. Good for dev convenience; worse for a self-contained offline package.

### 2.3 In-process GDExtensions (honest maturity)
| Project | Latest | Godot | Platforms / GPU | Structured output | Verdict |
|---|---|---|---|---|---|
| **NobodyWho** | **nobodywho-godot-v12.0.0, 2026-10-05** (4 days ago). Described as "a complete reimplementation of every class exposed via the godot bindings" with breaking API changes. | 4.5+ | Windows x86_64, Linux, macOS, **Android, iOS**. Vulkan, CUDA, Metal. **v12 notes: CUDA needs a CUDA-13 driver, and CUDA 12 builds are no longer shipped** (the note sits next to an ONNX-runtime bump; how far it affects the LLM path is UNVERIFIED). | Grammar from function signatures, `constrain_with_grammar()` | Active and the most credible option. License **EUPL-1.2** (copyleft on modifications). A fresh major rewrite plus loss of CUDA-12 on our driver make it **too risky for the 20 h build**. On this GPU it would probably fall back to Vulkan or CPU [EJ]. https://github.com/nobodywho-ooo/nobodywho ; .../releases/tag/nobodywho-godot-v12.0.0 [V] |
| **godot-llm** (Adriankhl) | Releases v0.1 to v1.0, dated "Apr 29 to May 30" with no year shown (these appear to be 2024). Labeled experimental. | Not stated | Windows (CPU, Vulkan), macOS (Metal), Linux, Android (CPU) | JSON schema and GBNF | **Looks stale. Don't use.** https://github.com/Adriankhl/godot-llm , /releases [V; year UNVERIFIED] |

**Recommendation:** use the **sidecar llama-server over HTTP**. It runs in a separate process, so a crash or OOM can't take the game down. It's easy to swap for Ollama with the same JSON contract, the backend devs can test it with curl and Python before the Godot side exists, and it works with the CUDA 12.4 build on the demo GPU.

---

## 3. Weighted comparison

Python choice: **Arcade over pygame-ce**. Arcade ships Tiled map loading, physics engines (simple top-down collision), a camera and GUI widgets, so fewer core systems need to be hand-rolled in 20 h (GitHub feature list [V], https://github.com/pythonarcade/arcade). pygame-ce is more recently released (2.5.8, 2026-08-09, Python ≥3.10 [V] https://pypi.org/project/pygame-ce/). With pygame-ce you'd hand-write tilemaps, collision resolution, camera and UI. Arcade's latest PyPI release is **3.3.3 (2025-10-09)**, about a year old, and it needs OpenGL (fine on the GTX 1650 Ti) [V] https://pypi.org/project/arcade/.

Phaser note: **Phaser 4.2.1 (2026-07-09) is the current stable line. Phaser 3.90.0 (2025-05-23) is the final v3 release.** https://github.com/phaserjs/phaser/releases [V]. A new project should use v4, but most tutorials and examples are v3, which is a mild risk. GameConfig `pixelArt` (sets antialias off and roundPixels on) and the `scale` config (zoom, mode, autoRound) are confirmed in the v4 docs: https://docs.phaser.io/api-documentation/typedef/types-core [V]. For desktop, Tauri v2 sidecars (`bundle.externalBin`, target-triple names, `Command.sidecar()`) can ship llama-server: https://v2.tauri.app/develop/sidecar/ [V]. Electron can do the same with Node `child_process` [UNVERIFIED this session].

### Baseline matrix (team skills mixed or unknown; assumes at least one dev can pick up an engine)
| Criterion (weight) | Godot 4.7 | Phaser 4 + TS (Electron/Tauri) | Python Arcade |
|---|---|---|---|
| Interactive 2D gameplay (25%) | **5**: TileMapLayer, CharacterBody2D floating mode, Area2D, AnimatedSprite2D, built-in editor. [V features / EJ score] | 4: Arcade physics and Tiled tilemaps are good, but the scene editor and UI layer are weaker. [EJ] | 3: Tiled loading and simple physics exist, but UI, dialogue and scene management are more manual. [EJ] |
| 20 h feasibility incl. skills (20%) | 4 [EJ, sensitive] | 4 [EJ, sensitive] | 3 [EJ] |
| Local AI integration (20%) | 4: HTTPRequest async, OS.create_process sidecar [V]. JSON numbers come back as floats, minor. | 4: fetch plus sidecar via Tauri/Electron [V Tauri]. A pure browser build can't spawn processes and runs into CORS [EJ]. | 5: subprocess and HTTP are trivial, and llama-cpp-python is available. Needs a thread to keep the loop responsive. [EJ] |
| Offline deployment (15%) | 5: export templates, optional embedded PCK (≤ ~3.89 GB exe) [V], with sidecar files next to the exe. | 4: Electron or Tauri bundle works offline. Larger and more config. [EJ] | 3: PyInstaller-style freezing of pyglet/OpenGL is workable but fiddly. [EJ] |
| Pixel-art customization (10%) | 5: integer scale mode, nearest filter, canvas shaders for palette swaps. [V scale / EJ] | 4: `pixelArt`, WebGL shaders/filters. Integer scaling needs some care. [V config / EJ] | 3: nearest filtering is possible, shaders are less ergonomic. [EJ] |
| Cross-platform Win/Android (5%) | 5: Android export documented (JDK 17, SDK 35, build-tools 35.0.1, NDK r28b) [V] | 4: browser/Capacitor on Android, with no local LLM sidecar there. [EJ] | 2: no first-class Android path. [EJ] |
| Maintainability (5%) | 4: scenes, Resources and typed GDScript. [EJ] | 4: TS typing. [EJ] | 3 [EJ] |
| **Weighted total** | **4.55** | **4.00** | **3.35** |

### Sensitivity (only the feasibility score changes)
| Scenario | Godot | Phaser | Python | Winner |
|---|---|---|---|---|
| Baseline (above) | 4.55 | 4.00 | 3.35 | Godot |
| **Nobody knows Godot, team strong in web/TS** (Godot feas 2, Phaser feas 5) | 4.15 | **4.20** | 3.35 | **Phaser (narrowly, a tie in practice)** |
| At least one dev knows Godot (Godot feas 5) | **4.75** | 4.00 | 3.35 | Godot |
| Team Python-only (Python feas 4, Godot 3, Phaser 3) | 4.35 | 3.80 | 3.55 | Godot |

**Reading [EJ]:** Godot should be chosen unless the frontend pair is fluent in TS/Phaser **and** nobody has touched Godot. In that case the TS team's fluency outweighs Godot's built-in editor. Ask the team before hour 0. The backend/AI pair can work in Python (prompt eval harness, schema tests) whatever engine is chosen, because the engine boundary is HTTP and JSON.

---

## 4. PySide6
Qt isn't needed for a standalone game. Godot, Phaser and Arcade each provide their own window, input and UI. The pygame-ce docs say embedding is possible "on some platforms" by setting the `SDL_WINDOWID` environment variable to an existing window handle, and they warn of "many strange side effects when running in an embedded display" (https://pyga.me/docs/ref/display.html [V]). Community threads describe it as a hack: the variable is read only on first import, which means one window per process, and segfaults have been reported on Windows (https://discourse.libsdl.org/t/qt-sdl-with-sdl-windowid-hack-in-win32/9274 ; https://forum.qt.io/topic/104966/how-to-embedded-sdl-window-into-qt-widget [community sources, not official]). **Verdict: fragile workaround. Don't use it.**

---

## 5. Deployment

### 5.1 Windows package layout (recommended)
```
SignalNo5/
  SignalNo5.exe            (Godot export, PCK embedded or SignalNo5.pck alongside)
  runtime/llama-server.exe (+ ggml*.dll, llama.dll, cudart64_*.dll, cublas64_*.dll, cublasLt64_*.dll from the CUDA 12.4 zip + cudart zip)
  runtime/vulkan/...       (optional fallback build)
  models/qwen3-1.7b-<quant>.gguf   (separate file, NOT in the PCK)
  LICENSES/ (Godot MIT, llama.cpp MIT, NVIDIA notice, Qwen Apache-2.0, assets)
```
- Export filters can include non-resource files (`*.json`, `*.csv`) in the PCK [V, exporting_projects]. **Keep the .gguf and the .exe files outside the PCK.** Godot can't execute a binary from inside a PCK, and a 1+ GB model would bloat or slow the pack. Resolve paths at runtime with `OS.get_executable_path().get_base_dir()` [EJ]. A ZIP pack isn't loaded automatically and needs `--main-pack` [V], so use PCK, embedded or adjacent.
- Embedded PCK is only supported for executables up to about 3.89 GB [V], https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html
- GDExtension DLLs (if any are used) get copied next to the exe and can't be embedded in it [UNVERIFIED this session]. In practice "single exe" means one exe plus a few side files.
- Code signing (SignTool) is supported but optional. Unsigned builds may trigger SmartScreen [V signing support; SmartScreen EJ].
- **Option B, require Ollama:** the user installs Ollama (Windows 10 22H2+, ≥ 4 GB), then runs `ollama pull` while online or copies the model store over. The game only probes `:11434`. Simpler to build, but the install isn't self-contained and needs online setup once. [V requirements / EJ]
- **Recommendation:** ship **llama-server (CUDA 12.4 build) + .gguf** next to the exe for the demo. Keep Ollama as the dev-time alternative behind the same `LLMClient` interface. Always include the no-AI fallback.

### 5.2 Licensing
| Component | License | Obligation | Source |
|---|---|---|---|
| llama.cpp / ggml | MIT, "Copyright (c) 2023-2026 The ggml authors" | Include the copyright and license text | https://github.com/ggml-org/llama.cpp/blob/master/LICENSE [V] |
| Ollama | MIT, "Copyright (c) Ollama" | Include the notice (if redistributing) | https://github.com/ollama/ollama/blob/main/LICENSE [V] |
| NVIDIA CUDA runtime / cuBLAS DLLs | NVIDIA EULA. Attachment A lists cudart and cublas/cublasLt as distributable with your application, under the §1.1.2 conditions (material added functionality, accessed only by your app, notice "This software contains source code provided by NVIDIA Corporation", etc.) | Include the notice and don't ship them standalone | https://docs.nvidia.com/cuda/eula/index.html [V] |
| Qwen3-1.7B weights | Apache-2.0 | Include the license/NOTICE | https://huggingface.co/Qwen/Qwen3-1.7B [V] |
| NobodyWho (if ever used) | EUPL-1.2 | Modifications must be open-sourced | repo README [V] |
| Godot | MIT | Godot license notice | [UNVERIFIED this session; well known] |

### 5.3 Standalone Android (on-device inference)
- Godot side: the Android export needs OpenJDK 17, SDK Platform 35, Build-Tools 35.0.1, Platform-Tools ≥ 35.0.0, NDK r28b and a keystore. AAB is required for Play [V] https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html. `OS.create_process` is listed for Android [V], but shipping and executing a `llama-server` binary inside an APK is non-standard and runs into Android exec restrictions [UNVERIFIED / EJ].
- Realistic path: an **in-process GDExtension**. NobodyWho lists Android support [V]. Alternatively, build llama.cpp for arm64-v8a yourself as a custom GDExtension. A Qwen3-1.7B Q4 GGUF is roughly 1.1 GB [EJ], so it needs side-loading or download-on-first-run, and it's slow on CPU-only mid-range phones [EJ].
- **Verdict: defer. Not realistic in 20 h** alongside the Windows build [EJ]. Keep the `LLMClient` interface backend-agnostic so an Android backend (NobodyWho or a custom GDExtension) can be added later.

---

## 6. Claims NOT verified this session
1. Individual 4.7 class pages for AnimatedSprite2D, Area2D, CanvasLayer/Control/Theme, Autoloads, Resource, FileAccess, TileMapLayer: not fetched, assumed unchanged (high confidence).
2. Exact project-setting path for the default canvas texture filter, and the `filter_nearest` shader hint syntax.
3. GDExtension intro page (404). Whether GDExtension DLLs can be embedded in the exe (believed not).
4. Android cleartext-HTTP behaviour for Godot's network stack. Exec restrictions for a bundled binary on Android.
5. llama-server default port "9931" as reported by the fetch tool (older default was 8080). Pass `--port` regardless. The exact flag or kwarg for disabling Qwen3 thinking in llama-server.
6. llama.cpp b11517 release date (page rendering showed 2024, which is implausible).
7. Whether NobodyWho v12's "CUDA 13 only" note applies to LLM inference or only to the ONNX (speech) runtime.
8. godot-llm release year (the page shows no year; the releases appear to be 2024).
9. gdUnit4 compatibility with 4.7.2 specifically (the table lists up to 4.7.1).
10. Ollama `/api/tags` endpoint (not re-fetched). Electron `child_process` sidecar (not fetched).
11. Godot editor download size. Qwen3-1.7B GGUF file sizes per quant.
12. All 1-5 matrix scores are engineering judgement. Only the feature facts behind them are verified.
