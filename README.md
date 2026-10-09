# Signal No. 5

An offline-capable, personalized **8-bit typhoon preparedness RPG** for Windows. Players set up a household (real or fictional), prepare a fixed-layout Filipino home over a 48-hour fictional storm countdown, shop for supplies, respond to warnings and evacuation advisories, live through the impact and a three-day aftermath, and receive a preparedness score, badges and a personalised debrief.

A **local language model** (llama.cpp + Qwen3, running on the same laptop) writes contextual NPC dialogue and debrief wording. A **deterministic simulation engine** owns every rule, resource, consequence and score. The game stays fully playable without the model.

> **Status: backend complete, frontend not started.** This repository contains the simulation engine, shared contracts, local-AI integration, Electron shell, persistence, tests and a packaging proof of concept. There is **no playable game UI yet**. `src/renderer/` holds a backend *development harness* (plain buttons and JSON), not the game.

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
| Desktop packaging | Electron app + llama.cpp runtime + one model as a portable folder with `SignalNo5.exe` | `src/main/`, `scripts/pack.mjs` |

## Technology stack

**Installed** (from `package.json`):

| Package | Version | Role |
|---|---|---|
| TypeScript | 7.0.2 | Language (`tsc --noEmit` type checking) |
| Zod | 4.6.5 | Shared contracts and validation (the only runtime dependency) |
| Vitest | 5.0.3 | Unit and integration tests |
| Electron | 44.7.0 | Desktop shell |
| electron-vite | 5.0.0 | Dev server and build for main/preload/renderer |
| Vite | 7.3.7 | Renderer bundling (electron-vite 5 supports Vite ≤ 7) |
| electron-builder | 26.15.3 | Windows packaging (`dir` target) |
| @types/node | 24.19.1 | Node typings |

**External (not in Git, not npm):** llama.cpp `llama-server` build **b11517** (win-cuda-12.4-x64 + CUDA 12.4 runtime DLLs) and the model **Qwen3-4B-Instruct-2507 Q4_K_M** (GGUF; Qwen3-1.7B Q4_K_M was also benchmarked). See [docs/setup/LOCAL_AI_SETUP.md](docs/setup/LOCAL_AI_SETUP.md).

**Planned (frontend, not installed yet):** Phaser 3.90 and React (per `docs/architecture/ARCHITECTURE_LOCK.md`). Playwright is **not** configured.

## Quick start

Prerequisites: Windows 10/11 x64, Git, **Node.js ≥ 22.12** (Node 24 LTS recommended; `package.json` `engines` enforces ≥ 22.12 because Electron 44 requires it).

```powershell
git clone <repository-url> "signal no.5"
cd "signal no.5"
npm install
npm test            # 329 backend tests
npm run typecheck   # tsc --noEmit
npm run dev         # Electron + Vite dev server; opens the backend dev harness
```

No model? That's fine. If no llama.cpp runtime/model is found, the app reports AI status `unavailable` and every dialogue uses reviewed fallback text. To enable local inference, follow [LOCAL_AI_SETUP.md](docs/setup/LOCAL_AI_SETUP.md).

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
  renderer/           Backend dev harness (to be replaced by the frontend)
tests/                Vitest suites (+ tests/main for main-process modules)
scripts/              run.mjs (env-safe launcher), pack.mjs (packaging)
spikes/               Throwaway proof-of-concept code (not imported by src/)
docs/                 Specifications, architecture, implementation and setup docs
```

## Documentation

- **[docs/README.md](docs/README.md)**: index of all documentation.
- **Frontend developers start here: [docs/frontend/README.md](docs/frontend/README.md)** → [Getting started](docs/frontend/FRONTEND_GETTING_STARTED.md) → [Integration reference](docs/frontend/FRONTEND_BACKEND_INTEGRATION.md).

## Known limitations

- **No frontend yet:** no Phaser scenes, React UI, sprites, animations or maps.
- **Offline test pending:** the packaged app has run with inference fully local and the CUDA toolkit removed from PATH. A run with networking disabled (airplane mode) has **not** been done yet.
- **Provisional model:** Qwen3-4B-Instruct-2507 is the configured primary model. Its responses sometimes assert ungrounded facts, which the grounding guard rejects in favour of reviewed fallback text. The 4B-vs-1.7B decision is still open.
- **Educational content needs review:** all fallback dialogue, lessons and checklist text is placeholder wording pending review against official Philippine sources (PAGASA, NDRRMC/OCD, Philippine Red Cross).
- **Saves are not encrypted:** local JSON files include the household profile. See [LOCAL_STORAGE_SETUP.md](docs/setup/LOCAL_STORAGE_SETUP.md).
- **Machine-specific dev defaults:** the default runtime and model paths in `src/main/config.ts` point at the original developer's folders. Other machines run in fallback mode unless `SIGNAL_LLM_DIR` / `SIGNAL_MODEL` are set.
