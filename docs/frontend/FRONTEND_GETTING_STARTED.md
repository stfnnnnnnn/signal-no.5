# Frontend Getting Started

For developers who know TypeScript and React but haven't seen this backend yet.

## 1. First-time setup

```powershell
node --version        # must be ≥ 22.12 (Node 24 LTS recommended)
git clone <repository-url> "signal no.5"
cd "signal no.5"
npm install
node node_modules/electron/install.js   # only if node_modules\electron\dist\electron.exe is missing (npm 11)
npm test              # expect 162 passed
npm run dev           # opens the Electron window with the backend dev harness
```

The dev harness (`src/renderer/harness.ts`) shows a fictional household with buttons for actions and event choices, JSON state, and AI/fallback labels. It's the quickest way to see what the engine does. Details: [DEVELOPMENT_SETUP.md](../setup/DEVELOPMENT_SETUP.md).

## 2. What already works (consume it, don't rebuild it)

- `createGame(survey, { seed })`: validates the 26-question survey and returns a running engine.
  - The first event (EV01, the advisory) is already open.
  - Pass `{ schemaVersion: 1, q3Mode: 'fictional' }` for an instant fictional household.
- **Engine commands** (all synchronous):
  - `engine.getWorldConfig()`: theme, characters (sprite base, clothing variant, palette, visible NPC IDs), which interactables exist.
  - `engine.interact(id)`, `getAvailableActions(id)`, `executeAction(actionId)`: object and NPC interactions with costs, availability and reasons.
  - `engine.getEventChoices()`, `resolveEvent(actionId)`: event dialogs with engine-owned, ordered choices.
  - `engine.tick(ms)`, `setSpeed(n)`, `pause(r)`, `resume(r)`: the clock.
  - `engine.getShopCatalog()`, `purchase(id, qty)`: the shop.
- **AI and evaluation:**
  - `buildScenarioRequest(state)` + `window.signal.ai.generateScenario(...)`: dialogue text (AI or fallback; always resolves).
  - `evaluateRun(state)`: score, ending, category breakdown, badges, lessons, checklist. Then `window.signal.ai.narrateDebrief(...)`.
- **Persistence:** `window.signal.save.*`, `badges.*`, `profile.*`.

## 3. What needs to be built

Full requirements: [UI_GAMEPLAY_REQUIREMENTS.md](UI_GAMEPLAY_REQUIREMENTS.md).
- **Setup screens:**
  - React household survey (26 questions, conditional fields, validation messages from `error.issues`).
  - Configuration review screen and character selection (Q25).
  - Modern / Traditional Filipino theme selection (Q26).
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

- **Fictional households:** `createGame({ schemaVersion: 1, q3Mode: 'fictional' }, { seed: 42 })`. Same seed → same household and storm.
- **Fixed survey fixtures:** `tests/fixtures/households.ts` has `familySurvey()` (4 people, assistance needed, pet, flood-prone, ₱800) and `aloneSurvey()` (1 adult, well prepared, ₱3,000). Import them into a dev page or story.
- **Jump ahead:** drive the engine at 32× and auto-resolve events (see `playToEnd` / `resolveFirst` in `tests/helpers.ts`) to reach the evacuation, impact or debrief UI quickly.
- **AI:** without a model, every dialogue is reviewed fallback text, which is good for layout work. Check `content.source` to show the "AI-personalized" label only when it's `'ai'`.

## 6. First integration milestone (minimum playable loop)

**Household setup → House scene → Object interaction → Backend action → Updated state → Dialogue display**

1. Survey (or a "Fictional household" button) → `createGame` → keep the `engine` in one store.
2. Render `getWorldConfig()` into the house scene (theme, player sprite, visible NPCs, interactables).
3. EV01 is open on start: build the request, `await window.signal.ai.generateScenario(req, runId)`, show the dialogue and `getEventChoices()`, then call `resolveEvent(choice)`.
4. Walk to `KITCHEN_SINK`, press E → `engine.interact('KITCHEN_SINK')` → show `actions` → `executeAction('FILL_CONTAINERS')`.
5. Re-render the HUD/inventory from `result.state`: water +15 L, clock +30 min.
6. Call `engine.tick(dt)` every frame. The next milestone event arrives as `eventTriggered` in a tick result → dialogue again. For example, EV02 fires at hour 8 if the go-bag isn't ready, otherwise EV03/EV04 follow at hours 12/16.

Done when this works with both a fictional household and `familySurvey()`, in fallback mode.

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
