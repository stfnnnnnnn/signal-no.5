# Frontend Getting Started

For developers who know TypeScript and React but haven't seen this backend yet.

## 1. First-time setup

```powershell
node --version        # must be ≥ 22.12 (Node 24 LTS recommended)
git clone <repository-url> "signal no.5"
cd "signal no.5"
npm install
node node_modules/electron/install.js   # only if node_modules\electron\dist\electron.exe is missing (npm 11)
npm test              # expect 517 passed
npm run dev           # opens the game with hot reload
```

The game opens on the title screen. (The original backend dev harness, `src/renderer/harness.ts`, was replaced by the game frontend.) Details: [DEVELOPMENT_SETUP.md](../setup/DEVELOPMENT_SETUP.md).

## 2. What already works (consume it, don't rebuild it)

- `createGame(onboarding, { seed })`: validates the onboarding answers (Q0 mode, then 8 custom questions or 4 random steps; `ONBOARDING_QUESTIONS` in `src/shared/contracts/onboarding.ts`) and returns a running engine. The legacy 26-question survey is still accepted but deprecated.
  - The first event (EV01, the advisory) is already open.
  - Pass a random-path answer such as `{ schemaVersion: 1, mode: 'random', r1SizeRange: '3-4', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['surprise'] }` for an instant household.
- **Engine commands** (all synchronous):
  - `engine.getWorldConfig()`: theme, characters (sprite base, clothing variant, palette, visible NPC IDs), which interactables exist.
  - `engine.interact(id)`, `getAvailableActions(id)`, `executeAction(actionId)`: object and NPC interactions with costs, availability and reasons.
  - `engine.getEventChoices()`, `resolveEvent(actionId)`: event dialogs with engine-owned, ordered choices.
  - `engine.tick(ms)`, `setSpeed(n)`, `pause(r)`, `resume(r)`: the clock.
  - `engine.getShopCatalog()`, `purchase(id, qty)`: the shop.
- **AI and evaluation:**
  - `buildScenarioRequest(state)` + `window.signal.ai.generateScenario(...)`: dialogue text (AI or fallback; always resolves).
  - `engine.evaluate()` (same as `evaluateRun(state)`): score, ending, categories, 12 badge statuses, Handa breakdown, lessons, checklist. Then `window.signal.ai.narrateDebrief(...)` and `window.signal.achievements.recordRun(state)`.
- **Persistence:** `window.signal.save.*`, `badges.*`, `achievements.*`, `profile.*`.
- **Scene directives:** `engine.getSceneDirective()` (+ optional `window.signal.ai.suggestScene`) tells Phaser what weather, lighting, flood, props, NPC cues and audio to show.

## 3. What needs to be built

Full requirements: [UI_GAMEPLAY_REQUIREMENTS.md](UI_GAMEPLAY_REQUIREMENTS.md).
- **Setup screens:**
  - Q0 mode choice, then the custom (Q1–Q8, Q2b) or random (R1–R4) onboarding rendered from `ONBOARDING_QUESTIONS` (validation messages from `error.issues`).
  - Customization (theme, player character, appearance, minimum-budget challenge) and a configuration review screen.
- **House scene (Phaser):** fixed-layout tilemap, 16×16 tiles, 4-direction movement (90 px/s), collision, NPC sprites (Boy/Girl/Mom/Dad + clothing variants), interactable objects with 24 px proximity prompts.
- **Panels:** dialogue with choices, inventory and go-bag, shop scene and purchase UI.
- **HUD:** time, phase, speed 1×–32×, warning state, cash, phone battery.
- **Storm and later scenes:** storm overlays (rain, wind, darkness, flood levels); evacuation (street travel → evacuation center), home impact, aftermath (days 1–3).
- **Results:** debrief and badge gallery, replay/continue menus.

## 4. Proposed frontend structure (not created yet)

Keep everything renderer-side under `src/renderer/`. The backend folders stay as they are.

```
src/renderer/
  index.html            (replace the harness page)
  main.tsx              React root + one GameEngine instance
  state/                engine store (wraps GameEngine; re-renders from returned state)
  ui/                   React: survey/, review/, hud/, dialogue/, inventory/, shop/, debrief/
  game/                 Phaser: scenes/ (House, Shop, Street, Evacuation, HomeImpact, Aftermath), input, sprites
  assets/               tilesets, sprites, audio (+ LICENSES.md)
```

You'll need to add React, Phaser and a Vite React plugin, and register the plugin in the `renderer` block of `electron.vite.config.ts`. These choices belong to the frontend team.

## 5. Developing with mock data

- **Random households:** `createGame({ schemaVersion: 1, mode: 'random', r1SizeRange: '3-4', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['surprise'] }, { seed: 42 })`. Same answers + seed → same household and storm.
- **Fixed onboarding fixtures:** `tests/fixtures/onboarding.ts` has `customFamily()`, `customSolo()`, `randomHousehold(overrides)` and `zeroAges()`. Import them into a dev page or story. (`tests/fixtures/households.ts` holds the deprecated 26-question fixtures.)
- **Jump ahead:** drive the engine at 32× and auto-resolve events (see `playToEnd` / `resolveFirst` in `tests/helpers.ts`) to reach the evacuation, impact or debrief UI quickly.
- **AI:** without a model, every dialogue is reviewed fallback text, which is good for layout work. Check `content.source` to show the "AI-personalized" label only when it's `'ai'`.

## 6. First integration milestone (minimum playable loop)

**Household setup → House scene → Object interaction → Backend action → Updated state → Dialogue display**

1. Onboarding (or a "Random household" button) → `createGame` → keep the `engine` in one store.
2. Render `getWorldConfig()` into the house scene (theme, player sprite, visible NPCs, interactables).
3. EV01 is open on start: build the request, `await window.signal.ai.generateScenario(req, runId)`, show the dialogue and `getEventChoices()`, then call `resolveEvent(choice)`.
4. Walk to `KITCHEN_SINK`, press E → `engine.interact('KITCHEN_SINK')` → show `actions` → `executeAction('FILL_CONTAINERS')`.
5. Re-render the HUD/inventory from `result.state`: water +15 L, clock +30 min.
6. Call `engine.tick(dt)` every frame. The next milestone event arrives as `eventTriggered` in a tick result → dialogue again. For example, EV02 fires at hour 8 if the go-bag isn't ready, otherwise EV03/EV04 follow at hours 12/16.

Done when this works with both `randomHousehold()` and `customFamily()`, in fallback mode.

The full, task-by-task plan is [FRONTEND_IMPLEMENTATION_BLUEPRINT.md](FRONTEND_IMPLEMENTATION_BLUEPRINT.md); the one-page summary is [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md).

## 7. Common mistakes

| Don't | Do instead |
|---|---|
| Keep a second `GameState` in React or Phaser | Keep the `GameEngine`; render from `getState()` / `result.state` |
| Re-implement rules (costs, eligibility, consequences) in UI code | Use `getAvailableActions` / `getEventChoices` (`available`, `reasons`) |
| Compute shop prices or stock | Use `getShopCatalog()` (`price`, `stock`, `affordable`) and `purchase()` |
| Let Phaser's timer drive game time | Phaser handles movement and animation only; pass real elapsed ms to `engine.tick()` |
| Call llama-server (`127.0.0.1:1873x`) from the renderer | Use `window.signal.ai.*`. The renderer CSP blocks network access anyway |
| Bypass the shared Zod contracts or hand-craft `ScenarioAIRequest` | Use `buildScenarioRequest(state)` and `buildDebriefRequest(ev, state)` |
| Hardcode outcomes, variants or dialogue per event | Show the engine's `activeEvent.variantId` and the AI/fallback `content` |
| Show AI text as authoritative safety advice | Label it; lessons come from `evaluateRun().learningPoints` (reviewed content) |
| Forget to pause | `pause('menu' \| 'shop' \| 'focusLost')` when menus open or the window loses focus; `resume()` after |
