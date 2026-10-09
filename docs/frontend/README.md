# Frontend Hub

Start here if you're building the Signal No. 5 game UI (Phaser + React).

## Status

| Backend: done and tested (you consume it) | Frontend: not started (you build it) |
|---|---|
| Survey validation and household generation (26 questions) | React survey, review and character/theme selection screens |
| Authoritative `GameState`, actions, consequences, decision log | Phaser house scene: tilemap, 4-direction movement, collision |
| Hybrid clock 1×–32×, milestones, auto-pause | HUD: clock, speed controls, phase, warnings, cash, go-bag status |
| Inventory, go-bag, shop with prices and stock | Inventory/go-bag panel, shop scene and purchase UI |
| EV01–EV16 events, engine-chosen variants and choices | Dialogue panel with choices (⚠ for unsafe ones), "AI-personalized" label |
| Evacuation, impact, aftermath, scene changes | Evacuation/street, home-impact and aftermath scenes, storm overlays |
| Scoring, endings, badges, lessons, checklist | Debrief and achievements screens |
| Local AI dialogue with validation and fallback | Loading screen until AI status is `ready` or `unavailable` |
| Saves, badges, profile (local JSON via IPC) | Save/continue/replay menus, "delete my profile" control |

## How the frontend talks to the backend

```
React UI ─┐                                        ┌─ window.signal.ai.*      (async, IPC → main → llama-server)
          ├─▶ GameEngine (src/core, synchronous) ──┤
Phaser ───┘    the ONLY source of game state       └─ window.signal.save/badges/profile.* (async, IPC → JSON files)
```

1. **Engine (synchronous):** import from `src/core/engine.ts` and call its methods directly in the renderer.
2. **Bridge (asynchronous):** `window.signal` (types in `src/shared/bridge.ts`), only for AI text and persistence.

## Authoritative contracts

- `src/shared/contracts/*.ts`: Zod schemas and types (`SurveyResponses`, `HouseholdProfile`, `GameState`, `DecisionRecord`, `ScenarioAIRequest`/`ScenarioContent`, `DebriefEvaluation`).
- `src/core/engine.ts`: `createGame`, `startRun`, `loadGame`, `GameEngine`, `EngineEvent`, `ActionOption`, `ShopCatalogEntry`.
- `src/shared/bridge.ts`: `SignalBridge` (`window.signal`).
- Display metadata (labels, names): `src/core/content/badges.ts`, `items.ts`, `events.ts` (`title`), `interactables.ts`.

## What you may change

| You own | Leave unchanged (ask the backend owner) |
|---|---|
| `src/renderer/**` (replace `harness.ts` and `index.html` with the real app) | `src/core/**` (simulation rules, content, scoring) |
| New frontend dependencies (React, Phaser, a React plugin for Vite) | `src/shared/contracts/**`, `src/shared/bridge.ts` |
| Renderer config in `electron.vite.config.ts` (the `renderer` block only) | `src/main/**`, `src/preload/**`, `scripts/**` |
| Assets under `src/renderer/` (tilesets, sprites, audio, with licenses) | `tests/**` (add renderer tests in a new folder if you want) |

If the backend lacks something you need, raise it. Don't work around it in the UI. Known gaps are listed in [FRONTEND_BACKEND_INTEGRATION.md §18](FRONTEND_BACKEND_INTEGRATION.md#18-known-gaps).

## Run and test

```powershell
npm install
npm run dev        # Electron + Vite (hot reload) at http://localhost:5173 inside the app window
npm test           # backend tests must stay green (162)
npm run typecheck
```

No GPU or model is needed: AI status becomes `unavailable` and dialogue uses reviewed fallback text.

## Next

1. **[FRONTEND_GETTING_STARTED.md](FRONTEND_GETTING_STARTED.md):** setup, what to build, first milestone, common mistakes.
2. **[FRONTEND_BACKEND_INTEGRATION.md](FRONTEND_BACKEND_INTEGRATION.md):** every call, with types, examples and errors.
3. **[UI_GAMEPLAY_REQUIREMENTS.md](UI_GAMEPLAY_REQUIREMENTS.md):** scenes, sprites, HUD and gameplay UI requirements (MVP vs optional).
