# Frontend ↔ Backend Integration Reference

The authoritative API for the frontend. Every signature below exists in the code; file references are given per section.

**Import paths** are relative from a file in `src/renderer/` (no path alias is configured):

```ts
import { createGame, startRun, loadGame, type GameEngine, type EngineEvent, type ActionOption, type ShopCatalogEntry } from '../core/engine';
import { buildScenarioRequest } from '../core/ai/scenario';
import { buildDebriefRequest } from '../core/ai/debrief';
import { evaluateRun } from '../core/evaluation/evaluate';
import type { GameState } from '../shared/contracts/state';
import type { SurveyResponses } from '../shared/contracts/survey';
import '../shared/bridge'; // declares window.signal
```

**Two kinds of call:**
- **Sync:** `GameEngine` methods return immediately.
- **Async:** `window.signal.*` returns Promises via IPC.

**Shared result types** (`src/core/engine.ts`):

```ts
type CommandResult = { ok: true; state: GameState; events: EngineEvent[]; decision?: DecisionRecord }
                   | { ok: false; error: EngineError };
interface EngineError { code: ErrorCode; message: string; reasons?: string[]; issues?: { path: (string|number)[]; message: string }[] }
interface ActionOption { actionId: string; label: string; timeCostMinutes: number; available: boolean; reasons: string[]; unsafe: boolean }
```

A rejected command (`ok: false`) **never** changes state.

---

## 1. Submit survey responses · 2. Initialise a household  (sync)

```ts
createGame(responses: SurveyResponses, opts: { seed: number; runId?: string })
  : { ok: true; engine: GameEngine; events: EngineEvent[] } | { ok: false; error: EngineError }
```

- **Schemas:** `SurveyResponses` and `CompleteSurvey` (`src/shared/contracts/survey.ts`) → `HouseholdProfile` v2 (`household.ts`) → `GameState` v2 (`state.ts`).
- **Field-by-field mapping:** [SURVEY_TO_GAMESTATE_MAPPING.md](../implementation/SURVEY_TO_GAMESTATE_MAPPING.md).

```ts
const r = createGame({ schemaVersion: 1, q3Mode: 'fictional', q26Theme: 'modern' }, { seed: Date.now() % 2 ** 31 });
if (!r.ok) {
  // r.error.code === 'INVALID_SURVEY'; show each issue next to its question
  for (const i of r.error.issues ?? []) showFieldError(String(i.path[0]), i.message); // e.g. ['q2AgeGrid'] "age-group total 4 does not match household size 2"
} else {
  const engine = r.engine;   // r.events includes eventTriggered EV01 (the initial advisory is open)
}
```

**Errors:** `INVALID_SURVEY`, with `issues` such as `required`, an age-grid mismatch, an assistance count larger than the household, exclusive options combined, conditional fields without their parent answer, or a player index outside the household.

## 3. Retrieve GameState  (sync)

| Call | Returns | Notes |
|---|---|---|
| `engine.getState()` | `GameState` | Deep copy; mutating it has no effect |
| `engine.getProfile()` | `HouseholdProfile` | For the review screen |
| `engine.getWorldConfig()` | `{ layoutId, theme, characters[], interactables[], pets }` | `characters[]`: `{ memberId, spriteBase, clothingVariant, paletteId, isPlayer, visibleNpc, npcId, dependent }`. `interactables[]`: `{ id, scene, area, label }` for this household only |
| `engine.getGoBagStatus()` | `'none' \| 'partial' \| 'ready'` | |

Useful `GameState` fields for the HUD:
- `clock.gameMinutes`, `clock.timeScale`, `clock.pauseReasons`
- `phase`, `scene`, `landfallMinute` (only reveal it to the player after `environment.landfallRevealed`)
- `cash`, `phoneBattery`, `house`, `goBag`
- `environment.*` (weather, flood, power, road, shop open, advisories)
- `activeEvent`, `aftermathDay`, `completed`

## 4. Subscribe to state changes  (gap)

There is **no observer or subscription API**. Every command returns the new `state` and the `events` it produced, so update your store from each `CommandResult`:

```ts
function apply(r: CommandResult) { if (r.ok) { store.set(r.state); handleEvents(r.events); } else showError(r.error); }
apply(engine.executeAction('FILL_CONTAINERS'));
```

## 5. Submit object interactions · 6. Retrieve available actions  (sync)

```ts
engine.interact(interactableId: string)
  : { ok: true; state: GameState; events: EngineEvent[]; actions: ActionOption[] } | { ok: false; error: EngineError }
engine.getAvailableActions(interactableId?: string): ActionOption[]
```

- Call `interact` when the player presses **E** near an object or NPC. Pass NPCs as their `npcId` (e.g. `'NPC_M2'`).
- If the interaction opens an event, `events` contains `eventTriggered` and `actions` is `[]`. Show the dialog (§12).
- Otherwise `actions` lists what's offered there. Unavailable actions include `reasons` (e.g. "You need tools first.").
- `getAvailableActions()` with no argument lists every world action in the current scene.

| Interactable IDs (house) | `LIVING_TV, LIVING_PHONE, LIVING_RADIO, KITCHEN_CABINET, KITCHEN_SINK, BEDROOM_CLOTHES, BEDROOM_DOCUMENTS, BEDROOM_MEDICATION*, UTILITY_TOOLS, UTILITY_SHELF, UTILITY_DRUM, UTILITY_LADDER, PET_AREA*, ENTRANCE_DOOR, ENTRANCE_BAG, STAIRS, WINDOW` |
|---|---|
| Shop | `SHOP_COUNTER` (open the purchase UI; it has no engine actions), `SHOP_EXIT` |

\* only for some households; check `getWorldConfig().interactables`. Source: `src/core/content/interactables.ts`.

**Errors:** `UNKNOWN_INTERACTABLE`, `EVENT_PENDING` (an event is open).

## 7. Execute an action  (sync)

```ts
engine.executeAction(actionId: string): CommandResult   // result.decision = the DecisionRecord written
```

```ts
const r = engine.executeAction('PACK_GO_BAG');   // 90 simulated minutes, regardless of speed
if (!r.ok && r.error.code === 'ACTION_UNAVAILABLE') toast(r.error.reasons!.join(' '));
```

- Milestones crossed during the action fire afterwards, so the result may include `milestone`, `phaseChanged` and `eventTriggered`.
- **Errors:** `UNKNOWN_ACTION`, `ACTION_UNAVAILABLE` (see `reasons`), `EVENT_PENDING`, `GAME_OVER`.
- Action IDs, labels and costs are defined in `src/core/content/actions.ts`.

## 8. Update inventory displays  (sync)

Read `state.house` (at home) and `state.goBag` (`Partial<Record<ItemId, number>>`). `WATER` is in liters, `FOOD` in person-days, everything else in units. Labels: `ITEM_LABELS` in `src/core/content/items.ts`. For go-bag status use `engine.getGoBagStatus()`. Never compute inventory yourself.

## 9. Purchase shop items  (sync)

```ts
engine.getShopCatalog(): ShopCatalogEntry[]
// { shopItemId, label, basePrice, price, stock, grants: { item, quantity }, affordable }
engine.purchase(shopItemId: ShopItemId, quantity = 1): CommandResult   // events: purchaseCompleted { shopItemId, quantity, total }
engine.priceOf(shopItemId): number
```

Flow: `executeAction('SHOP_TRIP')` (60 min; `sceneChanged` → `SHOP`) → `getShopCatalog()` → `purchase(...)` → `executeAction('RETURN_HOME')` (60 min).

**Errors:** `NOT_IN_SHOP`, `UNKNOWN_ITEM` (not stocked for this household), `OUT_OF_STOCK`, `INSUFFICIENT_FUNDS`, `INVALID_QUANTITY`, `EVENT_PENDING`. Prices rise ×1.5 from game hour 24 (`price` already reflects this).

## 10. Control clock speed  (sync)

```ts
engine.tick(realMs: number): CommandResult             // every frame; no-op while paused or an event is open
engine.setSpeed(timeScale: 1 | 2 | 4 | 8 | 16 | 32): CommandResult   // other values → INVALID_SPEED
engine.pause(reason: 'menu' | 'dialogue' | 'loading' | 'focusLost' | 'decision' | 'shop' | 'external'): CommandResult
engine.resume(reason): CommandResult                    // resume('decision') while an event is open → EVENT_PENDING
engine.skipToNextMilestone(): CommandResult             // only in evacuation/impact/aftermath phases
```

- 1× = 240 real s per game hour.
- Ambient time stops exactly at milestones that raise events, and at critical milestones (evacuation advisory, landfall, peak), which also reset the speed to 1×: `speedChanged { reason: 'critical' }`.

## 11. Receive scheduled events  (sync, via results)

`EngineEvent` (in every `result.events`):

```ts
| { type: 'actionCompleted'; actionId; decisionSeq }      | { type: 'eventTriggered'; eventId; variantId; mandatory }
| { type: 'eventResolved'; eventId; actionId }            | { type: 'milestone'; id; minute }
| { type: 'phaseChanged'; from; to }                      | { type: 'sceneChanged'; from; to }
| { type: 'speedChanged'; timeScale; reason: 'player' | 'critical' }
| { type: 'purchaseCompleted'; shopItemId; quantity; total } | { type: 'runCompleted' }
```

The current event is always `state.activeEvent` (`{ eventId, variantId, triggeredAtMinute, mandatory, actionIds }`). Event titles: `EVENT_BY_ID.get(id).title` in `src/core/content/events.ts`.

## 12. Request contextual dialogue  (async)

```ts
buildScenarioRequest(state: GameState): ScenarioAIRequest | null      // sync; null if no active event
window.signal.ai.generateScenario(request: ScenarioAIRequest, runId: string): Promise<ScenarioContent>
// ScenarioContent = { schemaVersion: 1, eventId, variantId, speaker, dialogue, description, actionIds, source: 'ai' | 'fallback', fallbackReason }
window.signal.ai.status(): Promise<'starting' | 'warming' | 'ready' | 'unavailable' | 'stopped'>
window.signal.ai.onStatus(cb): () => void   // returns an unsubscribe function
```

```ts
const st = engine.getState();
const req = buildScenarioRequest(st)!;
const content = await window.signal.ai.generateScenario(req, st.runId);  // resolves with AI text or reviewed fallback
showDialog(content.speaker, content.dialogue, content.description, content.source === 'ai');
```

- **Always resolves:**
  - with validated AI text, or reviewed fallback text after a timeout (default 12 s), invalid or ungrounded output, or no model;
  - `actionIds` always equals the engine's list.
- **Rejects only** if the request fails Zod validation in the main process, or if `runId` doesn't match `^[A-Za-z0-9._-]{1,64}$`. Always build the request with `buildScenarioRequest` and pass `state.runId`.
- **Speakers:** `NARRATOR`, `NPC_NEIGHBOR`, `NPC_CENTER_STAFF`, or a household `npcId`.
- **Schemas:** `ScenarioAIRequest`, `ScenarioAIResponse`, `ScenarioContent` (`src/shared/contracts/ai.ts`).

## 13. Submit scenario decisions  (sync)

```ts
engine.getEventChoices(): ActionOption[]          // ordered, engine-owned; `unsafe: true` marks a deliberately unsafe option
engine.resolveEvent(actionId: string): CommandResult
```

**Errors:** `NO_ACTIVE_EVENT`, `NOT_A_CHOICE`, `ACTION_UNAVAILABLE` (e.g. "Leave for the evacuation destination" before assistance is arranged; see `reasons`).

## 14. Transition between phases  (sync, via events)

- **Phases:** a new run starts in `preparation` → `warning` (h24) → `evacuation` (travelling to or at the center before landfall) → `impact` (landfall) → `aftermath` → `debrief`. `completed: true` after EV16. `setup` exists in the `GamePhase` enum but the engine never sets it; pre-game screens are frontend-only.
- **Scenes:** `HOUSE`, `SHOP`, `STREET` (evacuation travel), `EVACUATION`, `HOME_IMPACT`, `AFTERMATH`, `RESULTS`.
- React to `phaseChanged` / `sceneChanged` (load the matching Phaser scene). During `evacuation`, `impact` and `aftermath`, offer a "Continue" button that calls `skipToNextMilestone()`.

## 15. Retrieve scoring and badges

```ts
evaluateRun(state: GameState): DebriefEvaluation                                     // sync, deterministic
buildDebriefRequest(ev: DebriefEvaluation, state: GameState): DebriefNarrationRequest // sync
window.signal.ai.narrateDebrief(ev, request): Promise<DebriefNarration & { source: 'ai' | 'fallback' }>  // async, always resolves
window.signal.badges.add(ids: string[]): Promise<string[]>   // merged list across runs
window.signal.badges.read(): Promise<string[]>
```

- `DebriefEvaluation` (`src/shared/contracts/debrief.ts`):
  - `score`, `ending` (`handa | nakaraos | nahirapan`), `rescueOutcome`
  - `categories[]`: weight, earned, included, objectives
  - `timeline[]`, `strengths[]`, `gaps[]`
  - `learningPoints[] { findingId, safetyRuleId, text }`, `checklistItems[] { id, text }`, `badgeIds[]`
- Badge names, descriptions and hints: `BADGES` in `src/core/content/badges.ts`.
- Finding texts: `FINDING_BY_ID` in `src/core/content/findings.ts`.

## 16. Save and load progress  (async)

```ts
window.signal.save.write(slot: string, state: GameState): Promise<void>     // slot: /^[a-z0-9][a-z0-9-]{0,31}$/
window.signal.save.read(slot: string): Promise<GameState | null>            // null if missing, corrupted or a different schema version
window.signal.save.list(): Promise<string[]>
window.signal.save.remove(slot: string): Promise<void>
loadGame(raw: unknown): { ok: true; engine: GameEngine } | { ok: false; error: EngineError }   // sync; INVALID_SAVE
window.signal.profile.write(p) / read() / remove()                           // household profile (privacy: let players delete it)
```

```ts
await window.signal.save.write('slot-1', engine.getState());
const saved = await window.signal.save.read('slot-1');
const r = saved && loadGame(saved);
if (r && r.ok) engine = r.engine;
```

Promises reject on an invalid slot name or invalid state. Details: [LOCAL_STORAGE_SETUP.md](../setup/LOCAL_STORAGE_SETUP.md).

## 17. Start a new playthrough  (sync)

```ts
startRun(profile: HouseholdProfile, opts: { seed: number; runId?: string }): { ok: true; engine: GameEngine; events: EngineEvent[] }
// Same household, new storm:  startRun(engine.getProfile(), { seed: newSeed })
// New household:              createGame(newSurvey, { seed })
```

Badges persist through `window.signal.badges`. Dialogue cached for the old `runId` simply goes unused.

---

## 18. Known gaps

| # | Gap | Impact / workaround |
|---|---|---|
| G1 | No state subscription API | Update your store from every `CommandResult` (§4) |
| G2 | No autosave | Call `save.write` yourself (e.g. on `phaseChanged`) |
| G3 | No interactable coordinates or tilemap data | The frontend owns the layout and places sprites at the IDs |
| G4 | `BARANGAY` scene not wired; `BARANGAY_VISIT` is an action without a scene change | Optional scene per GD; show a short transition if desired |
| G5 | No settings store (volume, accessibility) | Use `localStorage` in the renderer for UI-only preferences |
| G6 | No exported type for `getWorldConfig()`'s return value | Use `ReturnType<GameEngine['getWorldConfig']>` |
| G7 | No save-schema migration | Saves from older schema versions read as `null` |
| G8 | React, Phaser and Playwright are not installed; no import alias | Frontend adds its own dependencies and config |
| G9 | Focus-loss pause isn't automatic | Call `pause('focusLost')` on window blur and `resume('focusLost')` on focus |
| G10 | No per-item add/remove for the go-bag (GD §6) | Packing happens through `PACK_GO_BAG` and the `PACK_MEDICATION`/`PREPARE_PET_SUPPLIES`/`PREPARE_CHILD_SUPPLIES` actions |
