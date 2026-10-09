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
createGame(input: OnboardingInput | SurveyResponses, opts: { seed: number; runId?: string })   // OnboardingInput = CustomOnboarding | RandomOnboarding
  : { ok: true; engine: GameEngine; events: EngineEvent[] } | { ok: false; error: EngineError }
```

- **Schemas:** `SurveyResponses` and `CompleteSurvey` (`src/shared/contracts/survey.ts`) → `HouseholdProfile` v2 (`household.ts`) → `GameState` v2 (`state.ts`).
- **Field-by-field mapping:** [SURVEY_TO_GAMESTATE_MAPPING.md](../implementation/SURVEY_TO_GAMESTATE_MAPPING.md).

```ts
// Preferred input is onboarding v2 (§17b); the legacy SurveyResponses shape is still accepted.
const r = createGame({ schemaVersion: 1, mode: 'random', r1SizeRange: '3-4', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['surprise'] }, { seed: Date.now() % 2 ** 31 });
if (!r.ok) {
  // r.error.code === 'INVALID_SURVEY'; show each issue next to its question
  for (const i of r.error.issues ?? []) showFieldError(String(i.path[0]), i.message); // e.g. ['q2ExactSize'] "must be between 3 and 4"
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
| { type: 'badgeEarned'; badgeId: 'B06' }                 // once per run, when a qualifying community action completes
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

- **Phases:** a new run starts in `preparation` → `warning` (h24) → `evacuation` (travelling to or at the center before landfall) → `impact` (landfall; a household still travelling stays on `STREET` until it arrives) → `aftermath` → `debrief`. `completed: true` after EV16. `setup` exists in the `GamePhase` enum but the engine never sets it; pre-game screens are frontend-only.
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
- Badge names, descriptions, hints and icon IDs: `engine.getBadgeCatalog()` (from `BADGE_CATALOG` in `src/core/content/badges.ts`; 12 badges B01–B12). Achievements: `engine.getAchievementCatalog()`.
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

## 17b. Scene presentation (weather, lighting, props, NPC cues, audio)

```ts
engine.getSceneDirective(): SceneDirective                                        // sync, deterministic, idempotent
buildSceneAIRequest(state: GameState): SceneAIRequest                             // sync (src/core/scene/directive.ts)
window.signal.ai.suggestScene(req: SceneAIRequest, runId: string): Promise<SceneAISuggestion | null>  // async, optional, always resolves
mergeSceneSuggestion(state: GameState, base: SceneDirective, s: SceneAISuggestion | null): SceneDirective  // sync; re-validates against the current state
```

The contract, authority rules, runtime flow and the full list of asset IDs are in **[FRONTEND_BACKEND_CONTRACTS.md](../implementation/FRONTEND_BACKEND_CONTRACTS.md#scene-directives-ai-directed-environmental-variation)**. Schemas: `SceneDirective`, `SceneAIRequest`, `SceneAISuggestion` (`src/shared/contracts/scene.ts`). The IPC channel is `ai:suggestScene`, Zod-validated in main. It rejects only on an invalid request or `runId`.

## 17c. Onboarding v2 (Q0 + 8 custom questions or 4 random steps)  (sync)

```ts
import { ONBOARDING_QUESTIONS, MAX_HOUSEHOLD_SIZE, type CustomOnboarding, type RandomOnboarding } from '../shared/contracts/onboarding';
createGame(input: CustomOnboarding | RandomOnboarding | SurveyResponses /* legacy, deprecated */, { seed })
```

- **Render the questions from data:** `ONBOARDING_QUESTIONS` lists Q0, Q1–Q8, Q2b (exact size) and R1–R4, each with text, choices (`exclusive` marks options that can't be combined), `visibleWhen`, `optional` and `validation`.
- **Validation errors** come back as `error.issues[]`, with `path[0]` set to the field name (`q2ExactSize`, `q3AgeCounts`, `q6Surroundings`, `r3OtherAgeGroups`, …).
- **Q0:** `mode: 'custom' | 'random'`. It's stored as `profile.configMode`.
- **Custom:** `q1Housing` (single, two or multi-story), `q2SizeRange` + `q2ExactSize` (for ranges, max `MAX_HOUSEHOLD_SIZE` = 10), `q3AgeCounts` (must add up to the size), `q4Assistance`, `q5MedicalSupplies`, `q6Surroundings` (waterway and floodProne can combine; neither and notSure are exclusive), `q7Pets`, `q8Preparedness`.
- **Random:** `r1SizeRange`, `r2PlayerAge` (13+), `r3OtherAgeGroups` (skip for 1 person, or `['surprise']`), `r4Preference` (optional, default `surprise`).
- **Customization (both paths, not counted as questions):** `customization: { theme?, playerMemberIndex?, appearance, clothingColor?, minimumBudgetChallenge }`. `minimumBudgetChallenge` gives ₱800; the default is moderate (₱1,500). The random path's `challenging` preference also gives the minimum budget and the highest exposure.
- **Profile additions:** `profile.exposure` (`standard | waterway | floodProne | both | unknown`, a fictional difficulty) and `profile.scenarioPreference`. Unknown or undisclosed answers are kept as `unknown` / `undisclosed`.

## 17d. In-game preparedness interactions

`ActionOption.kind` tells the UI how to present an action:

| Kind | Meaning |
|---|---|
| `discovery` | Reveals information. 0 game minutes, and the UI must **not** pause the clock for it |
| `preparation` | Fixed time cost; changes resources and flags |
| `conversation` | Short talk (5 min) |

Don't call `pause('dialogue')` for optional interactions; only mandatory events pause the clock.

New interactions:
- `BEDROOM_MEDICATION` → `CHECK_ESSENTIAL_SUPPLIES` (discovery). The cabinet also exists when the medical answer was "not sure" or "prefer not to say", and checking it is a privacy-preserving objective.
- `LIVING_PHONE` → `CHARGE_POWER_BANK`.
- `LIVING_PHONE` → `SHARE_VERIFIED_ADVISORY` and `ENTRANCE_DOOR` → `HELP_COMMUNITY_PREPARATION`: the Bayanihan community-assistance actions (§17h). EV12__COMMUNITY offers both.
- `INSPECT_GO_BAG` and `INSPECT_SUPPLIES` are now discovery actions (0 min).

## 17e. Player wellbeing  (state)

`state.player.wellbeing { current, max: 100 }` is a fictional gameplay indicator, not a medical value, and applies to the player only.

`state.player.wellbeingEvents[] { ruleId, delta, atMinute, reason }` explains each change. There are only two rules (`WELLBEING_RULES` in `src/core/wellbeing.ts`):

| Rule | Change | When |
|---|---|---|
| `W_ADVISORY_IGNORED_SEVERE_FLOOD` | −15 | Stayed home after an applicable advisory and the home flooded severely |
| `W_REMAINED_IN_UNSAFE_ROOM` | −10 | In EV10's critical variant, chose something other than "Move everyone to the safest room" |

Show wellbeing in the HUD and the debrief. Don't display it as health or injury.

## 17f. Badges (B01–B12) and Handa

`engine.evaluate()` (or `evaluateRun(state)`) returns a `DebriefEvaluation` that now includes:
- `badges[] { id, status: 'eligible' | 'earned' | 'notEarned' | 'notApplicable', reasons[] }`, all 12 in order. `eligible` means in progress (the run isn't complete yet).
- `handa { earned, runCompleted, wellbeingPercent, wellbeingThreshold: 85, wellbeingMet, criticalCompetencies[] { objectiveId, applicable, met }, criticalGaps[], evacuationAndAssistanceMet, exposure, reasons[] }`.
- `lessonIds[]`: the lesson cards unlocked this run.
- `badgeIds[]`: earned badges only, as before.

Display metadata (name, description, hint, `iconAssetId`) comes from `engine.getBadgeCatalog()`.

> **The Handa *badge* (B01) and the Handa *ending* are different things.**
> - The ending (`ev.ending`: `handa` ≥ 85 score, `nakaraos` 60–84, `nahirapan` < 60) is score-based.
> - The badge (`ev.handa.earned`) needs:
>   - a completed run;
>   - raw player wellbeing ≥ 85% (inclusive and unrounded, so a UI showing "85%" from 84.6 does **not** qualify);
>   - every applicable critical competency met (`CRITICAL_OBJECTIVES` in `src/core/evaluation/handa.ts`: O_WATER, O_GO_BAG, O_BULLETIN, O_COMMUNICATION, O_ACCOUNTED, O_DESTINATION, O_ADVISORY_RESPONSE, O_MEDICATION, O_ASSISTANCE, O_HAZARD_RESPONSE, O_NO_UNSAFE);
>   - no critical gaps;
>   - the household evacuation and assistance rules met (B08).
> - Neither depends on the other.

For a "Handa breakdown" panel, show `wellbeingPercent` against 85, each item in `criticalCompetencies` (skip `applicable: false`), and `reasons`.

## 17g. Cross-run achievements (A01–A10)  (async)

```ts
window.signal.achievements.recordRun(state: GameState): Promise<{ achievements: AchievementStatus[]; newlyUnlocked: string[] }>
window.signal.achievements.markPlanViewed(runId: string): Promise<AchievementStatus[]>   // call when the plan/checklist summary is shown
window.signal.achievements.read(): Promise<AchievementStatus[]>
// AchievementStatus { id, name, description, iconAssetId, progress, target, unlocked, unlockedAt }
```

- Call `recordRun` once when `runCompleted` fires.
- The main process **re-evaluates the state itself** and stores a run summary with no household or medical data. It also merges earned badges into `badges.read()`.
- Calls are idempotent per `runId`, and incomplete runs are rejected (the promise rejects).
- `newlyUnlocked` drives unlock toasts. The catalog is `engine.getAchievementCatalog()`.

---

## 17h. Community assistance (B06 Bayanihan, A08 Whole Barangay)  (sync)

No neighbour character exists. Two allowlisted actions qualify (`COMMUNITY_ASSISTANCE`, `src/core/content/community.ts`):

| Action | Interactable / event | Cost | Requires | Must finish by |
|---|---|---|---|---|
| `SHARE_VERIFIED_ADVISORY` | `LIVING_PHONE`, EV12__COMMUNITY | 15 min (−5 % battery in an outage) | Official info already checked (`BULLETIN_CHECKED`); power or battery ≥ 10 %; once | Landfall |
| `HELP_COMMUNITY_PREPARATION` | `ENTRANCE_DOOR`, EV12__COMMUNITY | 60 min | At home, safe outdoors, no evacuation advisory, road not closed; once | Heavy rain or the advisory (earlier one) |

- Success: `ok: true`, a `DecisionRecord`, and the first time `{ type: 'badgeEarned', badgeId: 'B06' }`. `evaluate()` then reports B06 `earned` mid-run.
- Rejection: `ok: false`, `ACTION_UNAVAILABLE`, `error.reasons[]`; nothing is recorded. Reading an advisory, visiting the barangay hall or forwarding a rumour never qualifies.
- B06 is optional: never part of Handa, the score or wellbeing. `notApplicable` only if no allowlisted action applies (not the case for any supported household).
- A08: `progress` = completed runs whose B06 was earned (target 5), from `achievements.recordRun`. Run summaries store `communityHelpCompleted` and `communityHelpActionId`.

## 17i. Evacuation travel  (sync)

- `sel.householdLocation(state)` (`src/core/selectors.ts`) = `home | inTransit | evacuationCenter`, derived from `state.evacuation`.
- `FOLLOW_EVACUATION` is rejected when now + travel time would pass `sel.routeClosureMinute(state)` (road-closure event: L−2 h, otherwise the peak at L+3 h). Reason: "Too late to travel safely: …".
- Landfall no longer closes every road (open → `restricted`). A household travelling at landfall stays on `STREET` (phase `impact`), arrives at `EVACUATION` (EV11), and never gets EV10 or home damage.

## 18. Known gaps

| # | Gap | Impact / workaround |
|---|---|---|
| G1 | No state subscription API | Update your store from every `CommandResult` (§4) |
| G2 | No autosave | Call `save.write` yourself (e.g. on `phaseChanged`) |
| G3 | No interactable coordinates or tilemap data | The frontend owns the layout and places sprites at the IDs |
| G4 | `BARANGAY` scene not wired; `BARANGAY_VISIT` is an action without a scene change | Optional scene per GD; show a short transition if desired |
| G5 | No settings store (volume, accessibility) | Use `localStorage` in the renderer for UI-only preferences |
| G6 | No exported type for `getWorldConfig()`'s return value | Use `ReturnType<GameEngine['getWorldConfig']>` |
| G7 | No general save-schema migration | Saves from older schema versions read as `null`. Exception: saves and `progress.json` v1 from before the Bayanihan revision are migrated on load (`src/core/migrations.ts`) |
| G8 | React, Phaser and Playwright are not installed; no import alias | Frontend adds its own dependencies and config |
| G9 | Focus-loss pause isn't automatic | Call `pause('focusLost')` on window blur and `resume('focusLost')` on focus |
| G11 | Shopkeeper and center staff have no NPC cue or interaction IDs beyond the shop counter and EV11 | Presentation-only characters |
| G10 | No per-item add/remove for the go-bag (GD §6) | Packing happens through `PACK_GO_BAG` and the `PACK_MEDICATION`/`PREPARE_PET_SUPPLIES`/`PREPARE_CHILD_SUPPLIES` actions |
