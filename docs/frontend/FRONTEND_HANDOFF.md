# Frontend Handoff

**Audience:** the frontend developer (or frontend Claude Code instance). There is **one frontend workstream** covering the Phaser world (A-tasks), the React UI (B-tasks) and integration.

This is the one-page summary. The full detail for every task is in [FRONTEND_IMPLEMENTATION_BLUEPRINT.md](FRONTEND_IMPLEMENTATION_BLUEPRINT.md) (task IDs match). Every API is in [FRONTEND_BACKEND_INTEGRATION.md](FRONTEND_BACKEND_INTEGRATION.md).

**State on 2026-10-10:**
- The backend is complete, with 329 tests passing (2026-10-10).
- **No frontend code or assets exist.** `src/renderer/harness.ts` is a dev harness to be replaced.

## Order of work (milestones M1–M10, blueprint §10)
1. **M1** foundation (F0, F1) → **M2** map + movement (A1, A2, A3) → **M3** interactions + actions (A3, B5 menu, B5b, badge toast) → **M4** event dialogs (B5).
   - **First playable vertical slice:** household → house → move → phone → `CHECK_BULLETIN` → `SHARE_VERIFIED_ADVISORY` → Bayanihan toast from `badgeEarned` (blueprint §6.5).
2. **M5** onboarding + customization (B1–B3).
3. **M6** SceneDirective + scenes (A4–A6).
4. **M7** HUD, wellbeing, inventory, shop (B4, A7, B6, B7).
5. **M8** badges + achievements (B9).
6. **M9** debrief, save/load, replay, settings (B8, B10, B11).
7. **M10** end-to-end + offline validation.

## M1 Foundation
| Task | Backend | Done when |
|---|---|---|
| **F0** Install React and Phaser 3.90; React root replaces the harness | — | `npm run dev` shows the React app; `npm test` still passes |
| **F1** `EngineStore`: one `GameEngine`, `dispatch(cmd)` → applies `result.state`, emits `result.events` | `createGame`, `startRun`, `loadGame`, `CommandResult`, `EngineEvent` | A Vitest test drives create → resolveEvent → executeAction through the store |

M1 must also prove asset loading under the **production CSP** (blueprint §10 F0, gap R-CSP).

## Phaser world tasks

| Task | Backend method | Contract fields | Expected behaviour | Depends on | Acceptance |
|---|---|---|---|---|---|
| A1 Asset loading | — | asset IDs (blueprint §9) | Load by ID; magenta placeholder if missing | F0 | No crash with zero art |
| A2 House map | `getWorldConfig()` | `theme`, `layoutId`, `interactables[].id/area` | One fixed layout; theme swaps the tileset only | A1 | Every interactable ID has an anchor; collision is identical in both themes |
| A3 Movement + interaction | `interact(id)`, `executeAction(id)` | `ActionOption{actionId,label,timeCostMinutes,available,reasons,kind}` | 4 directions, 90 px/s, 24 px prompt, E/Space | A2, F1 | The prompt shows the label; the result opens a menu or an event |
| A4 NPCs | `getWorldConfig()` | `characters[]{spriteBase,clothingVariant,paletteId,visibleNpc,npcId,dependent}`, `pets` | ≤ 3 household NPCs; dependents not interactable; **no neighbour NPC** | A2 | `interact('NPC_M2')` opens EV03 or a menu |
| A5 Scene directive | `getSceneDirective()`, `ai.suggestScene`, `mergeSceneSuggestion` | `weather, lighting, flood, effects, props, npcCues, audio, mood, transition, basisKey` | Recompute after state-changing results; apply only on diff | A2, A4 | Same directive twice = no change; boarding the window shows `WINDOW_BOARDED`; no electric light during an outage |
| A6 Other scenes | `tick`, `skipToNextMilestone` | `state.scene`, `sceneChanged`, `sel.householdLocation` | Route `HOUSE/SHOP/STREET/EVACUATION/HOME_IMPACT/AFTERMATH`; a household travelling at landfall stays on `STREET` | A5 | A full run visits every scene it should; a late departure never shows `HOME_IMPACT` |
| A7 Wellbeing meter | — | `player.wellbeing{current,max}`, `wellbeingEvents[]` | Meter plus a reason toast on change | F1 | Labelled "wellbeing", never "health" |

## React UI tasks

| Task | Backend method | Contract fields | Expected behaviour | Depends on | Acceptance |
|---|---|---|---|---|---|
| B1 App shell | `ai.status/onStatus`, `save.list` | `AIStatus` | Title → mode → onboarding → customize → load → game → debrief | F0 | Loading continues on `ready` **or** `unavailable` |
| B2 Onboarding | `createGame(input,{seed})` | `ONBOARDING_QUESTIONS`, `CustomOnboarding`, `RandomOnboarding`, `error.issues[].path` | Q0 → Q1–Q8 (+Q2b) or R1–R4 | B1 | Invalid input shows the error on the right field; both paths start a game |
| B3 Customize + review | `getProfile()`, `getWorldConfig()` | `customization{theme,playerMemberIndex,appearance,clothingColor,minimumBudgetChallenge}`, `exposure`, `budgetTier` | Exposure shown as fictional | B2 | Minimum budget = ₱800 |
| B4 HUD | `setSpeed`, `pause/resume`, `getGoBagStatus` | `clock`, `phase`, `cash`, `phoneBattery`, `environment.*` | ≈ 4 Hz refresh; critical milestones force 1× | F1 | Landfall countdown appears only after `landfallRevealed` |
| B5 Dialogs | `buildScenarioRequest`, `ai.generateScenario`, `getEventChoices`, `resolveEvent` | `ScenarioContent{dialogue,description,speaker,source}`, `ActionOption.unsafe` | One dialog per `eventId@triggeredAtMinute`; stale AI text dropped | F1 | Fallback works with the model absent; unsafe choices get a ⚠ |
| B6 Inventory | — | `house`, `goBag`, `ITEM_LABELS`, `missingGoBagItems` | Two lists | F1 | Matches state after every action |
| B7 Shop | `getShopCatalog`, `purchase`, `executeAction('RETURN_HOME')` | `ShopCatalogEntry{price,stock,affordable}` | Engine prices only | B4 | Errors are shown; no client-side price maths |
| B8 Debrief | `evaluate()`, `ai.narrateDebrief`, `achievements.recordRun`, `achievements.markPlanViewed`, `getBadgeCatalog()` | `score`, `ending`, `categories`, `badges[]{id,status,reasons}`, `handa`, `checklistItems`, `learningPoints` | **The ending (score) and the Handa badge (≥ 85% wellbeing + critical objectives) are separate UI elements** | B5 | All 12 badges shown with a status; "not applicable" is neutral; plan view → A10 |
| B5b Community actions (Bayanihan) | `interact('LIVING_PHONE'/'ENTRANCE_DOOR')`, `executeAction('SHARE_VERIFIED_ADVISORY'/'HELP_COMMUNITY_PREPARATION')` | `ActionOption{available,reasons,timeCostMinutes}`, `badgeEarned` event | Shown in the normal interaction menu and EV12; disabled with engine reasons; badge toast once | B5 | Sharing before checking the bulletin is disabled; after checking it earns B06 with one toast (blueprint §5.12, §6.5) |
| B9 Achievements | `achievements.read()`, `getAchievementCatalog()` | `{id,progress,target,unlocked,unlockedAt}` | Toast per `newlyUnlocked`; A08 shows progress/5 | B8 | Progress persists across restarts |
| B10 Saves / replay | `save.*`, `profile.*`, `loadGame`, `startRun` | `GameState` | Save on phase change; replay = same household, new seed | B4 | Save → restart → continue restores the run |
| B11 Settings | — (no backend store) | — | Volume, mute, text size in localStorage | B1 | Settings persist |

## Checkpoints
- **M1:** store drives the engine headlessly; production-CSP asset load works.
- **M4:** first playable vertical slice (above).
- **M9:** full run to the debrief and achievements.
- **M10:** packaged and offline. See [WINDOWS_PACKAGING.md §5](../setup/WINDOWS_PACKAGING.md); this needs owner approval before rebuilding.

## Open backend items (don't work around them in the UI)
- **BK-1 (fixed):** late departures crossing landfall now stay in transit; departures that couldn't arrive before route closure are rejected.
- **BK-3:** no authored sentences for discovery or community-action results. Use the proposed copy in [CONTENT_REVIEW.md](../implementation/CONTENT_REVIEW.md) §2 and §4.
- **G1/G2/G5:** no subscription, autosave or settings store.

Full list: blueprint §12.
