# Signal No. 5

An offline-capable, personalized **8-bit typhoon preparedness RPG** for Windows. Players set up a household (real or fictional), prepare a fixed-layout Filipino home over a 48-hour fictional storm countdown, shop for supplies, respond to warnings and evacuation advisories, live through the impact and a three-day aftermath, and receive a preparedness score, badges and a personalised debrief.

A **local language model** (llama.cpp + Qwen3, running on the same laptop) writes contextual NPC dialogue and debrief wording. A **deterministic simulation engine** owns every rule, resource, consequence and score. The game stays fully playable without the model.

> **Status: playable end to end (2026-10-10).** The game runs from title screen to debrief: household onboarding (custom or random), the house, shop, street and evacuation centre in Phaser, the HUD and menus in React, AI-narrated events with reviewed fallback, autosave and Continue, the debrief with badges and a preparedness plan, achievements and replay. The packaged `SignalNo5.exe` runs Qwen3-4B locally. See [Known limitations](#known-limitations) before demoing on another PC.

## Core systems

| System | What it does | Where |
|---|---|---|
| Household configuration | Q0 mode + 8-question custom or 4-step random onboarding (legacy 26-question survey still accepted) → validated profile → roster (Boy/Girl/Mom/Dad sprites, ≤3 visible NPCs), starting resources and needs; fictional or partly randomised households | `src/core/household/`, `src/core/init/` |
| Deterministic simulation | Single authoritative `GameState`; every change goes through engine commands and is logged as a `DecisionRecord` | `src/core/engine.ts` |
| Hybrid clock | 240 real s = 1 game hour at 1×; speeds 1/2/4/8/16/32×; fixed action costs; pauses; milestones never skipped | `src/core/engine.ts`, `src/core/content/storm.ts` |
| Preparation actions | 19 actions (water, go-bag, documents, windows, roof, communication plan, …) with prerequisites and time costs | `src/core/content/actions.ts` |
| Inventory and shop | Home vs go-bag inventory; community shop with stock, fictional ₱ prices, late-price rule, atomic purchases | `src/core/selectors.ts`, `src/core/content/shop.ts` |
| Typhoon events | EV01–EV16 on an authored timeline; the engine picks each event's variant from the household and state | `src/core/content/events.ts`, `storm.ts` |
| Evacuation and aftermath | Advisory, assistance, route, travel, arrival, shelter-at-home hazards, authored damage, 3-day recovery | `src/core/content/*` |
| Local AI narrative | Context builder, constrained JSON decoding, validation, grounding guard, reviewed fallback text | `src/core/ai/`, `src/main/ai/` |
| Scene directives | Deterministic weather, lighting, flood, prop, NPC-cue and audio presets from state; optional AI atmospheric variations, validated and merged without overriding state | `src/core/scene/`, `src/shared/contracts/scene.ts` |
| Scoring, badges, achievements | 6 weighted competencies (100 pts), score endings, badges B01–B12 (Handa needs ≥ 85% player wellbeing + critical competencies), lessons, cross-run achievements A01–A10 | `src/core/evaluation/`, `src/core/content/badges.ts`, `findings.ts` |
| Game frontend | Phaser 3 world scenes (house, shop, street, evacuation centre), weather/flood/lighting from scene directives, NPCs; React screens (title, onboarding, HUD, inventory, objectives, shop, events, debrief, plan, achievements, settings); autosave and Continue | `src/renderer/` |
| Desktop packaging | Electron app + llama.cpp runtime + one model as a portable folder with `SignalNo5.exe` | `src/main/`, `scripts/pack.mjs` |

## Technology stack

**Installed** (from `package.json`):

| Package | Version | Role |
|---|---|---|
| TypeScript | 7.0.2 | Language (`tsc --noEmit` type checking) |
| Zod | 4.6.5 | Shared contracts and validation |
| Phaser | 3.90.0 | Game world rendering (scenes, sprites, movement) |
| React / React DOM | 19.3.0 | Screens, HUD and menus |
| @vitejs/plugin-react | 5.2.0 | JSX in the renderer build |
| pngjs | 7.0.0 | Asset preparation script (`npm run assets`) and image tests |
| Vitest | 5.0.3 | Unit and integration tests |
| Electron | 44.7.0 | Desktop shell |
| electron-vite | 5.0.0 | Dev server and build for main/preload/renderer |
| Vite | 7.3.7 | Renderer bundling (electron-vite 5 supports Vite ≤ 7) |
| electron-builder | 26.15.3 | Windows packaging (`dir` target) |
| @types/node | 24.19.1 | Node typings |

**External (not in Git, not npm):** llama.cpp `llama-server` build **b11517** (win-cuda-12.4-x64 + CUDA 12.4 runtime DLLs) and the model **Qwen3-4B-Instruct-2507 Q4_K_M** (GGUF; Qwen3-1.7B Q4_K_M was also benchmarked). See [docs/setup/LOCAL_AI_SETUP.md](docs/setup/LOCAL_AI_SETUP.md).

Playwright is **not** configured; UI behaviour is covered by server-rendered React tests and manual runs.

## Quick start

Prerequisites: Windows 10/11 x64, Git, **Node.js ≥ 22.12** (Node 24 LTS recommended; `package.json` `engines` enforces ≥ 22.12 because Electron 44 requires it).

```powershell
git clone https://github.com/stfnnnnnnn/signal-no.5 "signal no.5"
cd "signal no.5"
npm install
node node_modules/electron/install.js   # only if node_modules\electron\dist\electron.exe is missing (npm 11 skips Electron's download)
npm test            # 517 tests
npm run typecheck   # tsc --noEmit (main and renderer)
npm start           # build and play
```

No model? That's fine. If no llama.cpp runtime/model is found, the title screen shows "Local AI offline" and every dialogue uses reviewed fallback text; everything else plays the same. To enable local inference, put the runtime and model on the machine and point the app at them before `npm start` (details in [LOCAL_AI_SETUP.md](docs/setup/LOCAL_AI_SETUP.md)):

```powershell
$env:SIGNAL_LLM_DIR = 'C:\signal-llm\llama-b11517-cuda124'                    # folder with llama-server.exe
$env:SIGNAL_MODEL   = 'C:\signal-llm\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf'
npm start
```

To hand the game to someone without Node, build the portable folder with `npm run pack` ([WINDOWS_PACKAGING.md](docs/setup/WINDOWS_PACKAGING.md)) and copy all of `dist\win-unpacked\`; they run `SignalNo5.exe`.

## Controls

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| E or Space | Interact with the highlighted object or person |
| I / O | Inventory / objectives |
| `]` / `[` | Faster / slower game time |
| Esc | Close the open menu |

| Script | Command | What it does |
|---|---|---|
| `npm test` | `vitest run` | Run all tests once |
| `npm run test:watch` | `vitest` | Watch mode |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` | Type-check `src/` and `tests/` |
| `npm run dev` | `node scripts/run.mjs electron-vite dev` | Dev app with hot reload (renderer at `http://localhost:5173`) |
| `npm run build` | `electron-vite build` | Build to `out/` |
| `npm run start` | `node scripts/run.mjs electron-vite preview` | Build, then run the built app |
| `npm run pack` | `npm run build && … scripts/pack.mjs` | Portable Windows folder `dist/win-unpacked/` (needs runtime + model, see [WINDOWS_PACKAGING.md](docs/setup/WINDOWS_PACKAGING.md)) |

`scripts/run.mjs` clears `ELECTRON_RUN_AS_NODE` (VS Code sets it in its terminals, which makes Electron behave as plain Node).

## Repository structure

```
src/
  shared/contracts/   Zod schemas + types shared by engine, main and renderer (authoritative)
  shared/bridge.ts    window.signal API types and IPC channel names
  core/               Deterministic simulation (pure TS, runs in the renderer)
    engine.ts         Public engine API (createGame, GameEngine, startRun, loadGame)
    household/        Survey validation, fictional generation, roster
    init/             Profile → initial GameState
    content/          Static content: actions, events, storm timeline, shop, items, badges, findings, interactables
    evaluation/       Objectives, scoring, endings, badges
    ai/               Context builder, prompts, schema, validation, grounding guard, fallbacks
  main/               Electron main process: llama-server manager, AI service, saves, IPC, config
  preload/            contextBridge → window.signal
  renderer/           The game frontend: app/ (screens, routing), game/ (Phaser scenes, layout, textures),
                      ui/ (React screens and HUD), state/ (engine, app and UI stores), services/ (AI, saves)
tests/                Vitest suites (+ tests/main for main-process modules, tests/renderer and
                      tests/renderer-ui for frontend logic and server-rendered screens)
assets/               Source art sheets (processed copies used by the game live in src/renderer/assets)
scripts/              run.mjs (env-safe launcher), pack.mjs (packaging)
spikes/               Throwaway proof-of-concept code (not imported by src/)
docs/                 Specifications, architecture, implementation and setup docs
```

## Documentation

- **[docs/README.md](docs/README.md)**: index of all documentation.
- **Frontend developers start here: [docs/frontend/README.md](docs/frontend/README.md)** → [Getting started](docs/frontend/FRONTEND_GETTING_STARTED.md) → [Integration reference](docs/frontend/FRONTEND_BACKEND_INTEGRATION.md).

## Known limitations

- **Unsigned executable:** `SignalNo5.exe` is not code-signed. Windows SmartScreen may warn ("More info → Run anyway"), and on PCs with **Smart App Control** turned on, Windows can block a build outright ("An Application Control policy has blocked this file"). Whether a given build is blocked depends on Microsoft's reputation check for that exact file: on the development PC, two builds ran and the next was blocked. There is no workaround in the app; on such a PC, run from source with `npm start` instead. Only code signing fixes this.
- **AI needs an NVIDIA GPU:** the bundled runtime is llama.cpp's CUDA 12.4 build (driver 551.61 or newer). Without one, the game runs with reviewed fallback text. See [WINDOWS_PACKAGING.md §6](docs/setup/WINDOWS_PACKAGING.md#6-running-on-another-pc).
- **Offline test pending:** the packaged app runs inference fully locally (127.0.0.1 only) and has passed its self-test with the CUDA toolkit removed from PATH, but a run with networking disabled (airplane mode) has **not** been done yet.
- **Single floor plan:** every household uses the same house map. Two- and multi-story homes show a staircase as a cue but have no explorable upper floor; the floor count still changes flood losses, the windows needed for the Handa badge and the AI's descriptions.
- **Provisional model:** Qwen3-4B-Instruct-2507 is the configured primary model. Its responses sometimes assert ungrounded facts, which the grounding guard rejects in favour of reviewed fallback text. The 4B-vs-1.7B decision is still open.
- **Educational content needs review:** all fallback dialogue, lessons and checklist text is placeholder wording pending review against official Philippine sources (PAGASA, NDRRMC/OCD, Philippine Red Cross).
- **Saves are not encrypted:** local JSON files include the household profile. See [LOCAL_STORAGE_SETUP.md](docs/setup/LOCAL_STORAGE_SETUP.md).
- **Machine-specific dev defaults:** the default runtime and model paths in `src/main/config.ts` point at the original developer's folders. Other machines run in fallback mode unless `SIGNAL_LLM_DIR` / `SIGNAL_MODEL` are set.
