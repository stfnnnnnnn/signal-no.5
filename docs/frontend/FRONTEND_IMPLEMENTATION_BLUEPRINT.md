# Frontend Implementation Blueprint (canonical)

**Audience:** frontend developers, or another Claude Code instance, building the Signal No. 5 game UI from the current repository state through to a complete, playable, packaged game.

**How to use it:**
1. Read §1 (what exists).
2. Read §2 (architecture).
3. Work through the milestones in §10 in order (one frontend workstream). Each task lists its files, contracts, assets, steps and definition of done.
4. Use §3–§5 as reference while implementing.

The API details live in [FRONTEND_BACKEND_INTEGRATION.md](FRONTEND_BACKEND_INTEGRATION.md) (every call, type and error). The scene contract and asset IDs are in [FRONTEND_BACKEND_CONTRACTS.md](../implementation/FRONTEND_BACKEND_CONTRACTS.md). This blueprint links to them and doesn't copy them.

> **Verified, 2026-10-10** (repository after the Bayanihan revision `01eaf7f` and the evacuation-timing fix `20d1f2d`, plus this documentation commit):
> - Every code example in §6 runs as `tests/docs-examples.test.ts`.
> - The mapping tables in §5 were generated from `src/core/content/*`.
> - Nothing in this document claims a frontend feature works: **no frontend exists yet** (see §1).

---

## 1. Current repository state (inspected, not assumed)

| Area | State | Evidence |
|---|---|---|
| Game UI (React screens) | **Missing** | No `.tsx` files anywhere. React isn't installed |
| Game world (Phaser) | **Missing** | Phaser isn't installed. No scenes |
| Assets (tilesets, sprites, audio, fonts, icons) | **Missing** | No image, audio or font files in the repo |
| Renderer entry | **Backend dev harness only** | `src/renderer/index.html` + `src/renderer/harness.ts` (buttons and JSON; uses the deprecated legacy survey). It's a reference, to be replaced |
| Renderer build | **Exists** | `electron.vite.config.ts` `renderer` block (root `src/renderer`, input `index.html`). Vite 7.3.7 |
| Remote (`origin/main`) | Only the two initial commits | `git fetch` on 2026-10-09: no frontend branch exists |
| Backend engine, contracts, AI, persistence, packaging | **Complete and tested** (329 tests) | `npm test`. See [IMPLEMENTATION_PLAN.md](../implementation/IMPLEMENTATION_PLAN.md) |
| Electron shell, preload bridge, CSP, model server | **Complete** | `src/main/*`, `src/preload/index.ts`, `src/shared/bridge.ts` |

**What the frontend gets on day one:**
- a deterministic `GameEngine` it calls synchronously;
- `window.signal` for AI text, scene suggestions, saves, badges, achievements and the household profile;
- full display metadata (labels, badge and achievement names, icon IDs);
- a working Electron dev loop (`npm run dev`).

---

## 2. Architecture

```
┌──────────────────────── Electron renderer (sandboxed, no Node, CSP: no network) ─────────────────────────┐
│  React app (screens, HUD, dialogs) ──┐                                                                  │
│                                      ├─► EngineStore (one GameEngine instance; the ONLY game state)      │
│  Phaser game (world, sprites, FX) ───┘      ▲ commands (sync)        │ results: { state, events }       │
│                                             │                       ▼                                   │
│                     src/core (engine, scene directive, evaluation; imported directly)                   │
│  window.signal.* (async IPC) ── ai.generateScenario / suggestScene / narrateDebrief · save · badges ·      │
│                                 achievements · profile · app.info                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                     ▼ IPC (Zod-validated)                       Electron main: llama-server, JSON files
```

### 2.1 Rules (these don't change)
1. **One engine, one store.** Create the `GameEngine` once per run (`createGame` / `startRun` / `loadGame`) and keep it in a single store module. React and Phaser both read from that store. Never keep a second copy of game state.
2. **Commands go through the store.** Every engine call returns a `CommandResult`. The store applies `result.state`, then broadcasts `result.events` to subscribers. There's no backend subscription API (gap G1), so the store *is* the subscription mechanism.
3. **Phaser owns pixels; the engine owns time.**
   - Phaser handles movement, collision, animation and particles at normal speed.
   - Game time advances only by calling `engine.tick(realElapsedMs)`, once per frame, from **one** place: the Phaser `update` loop of the active world scene.
   - Never derive game time from Phaser timers.
4. **The UI never computes rules.** Availability, costs, prices, eligibility, scores and badges always come from the engine (`getAvailableActions`, `getEventChoices`, `getShopCatalog`, `evaluate`).
5. **AI is optional and asynchronous.** Gameplay never waits on it. `generateScenario`, `suggestScene` and `narrateDebrief` always resolve (with fallback text or `null`).

### 2.2 Proposed renderer layout (to create; nothing exists yet)

```
src/renderer/
  index.html                 replace the harness page (keep the CSP meta out: main sets CSP headers)
  main.tsx                   React root; mounts <App/>
  app/App.tsx                screen router (title → onboarding → customization → game → debrief → achievements)
  state/engineStore.ts       EngineStore: holds GameEngine, apply(result), subscribe(listener), selectors
  state/useEngine.ts         React hook: subscribe + throttled re-render (≈4 Hz for HUD)
  services/ai.ts             wraps window.signal.ai (status, generateScenario per event key, suggestScene per basisKey)
  services/persistence.ts    wraps window.signal.save/badges/achievements/profile
  ui/onboarding/*            Q0, CustomForm, RandomForm (render ONBOARDING_QUESTIONS), Customization, Review
  ui/hud/*                   Clock, SpeedControls, PhaseBadge, Cash, Phone, GoBag, Wellbeing, AIStatus
  ui/dialogs/*               EventDialog, InteractionMenu, DiscoveryCard, Toasts
  ui/inventory/*             InventoryPanel (house vs go-bag)
  ui/shop/*                  ShopPanel
  ui/debrief/*               Debrief, HandaBreakdown, BadgeGrid, PlanSummary
  ui/achievements/*          AchievementsScreen, UnlockToast
  game/PhaserGame.tsx        mounts Phaser into a <div>; bridges store ↔ scenes
  game/config.ts             Phaser config (pixelArt, integer zoom, 384×216 or 320×180 base)
  game/scenes/*              Boot, Preload, House, Shop, Street, Evacuation, HomeImpact, Aftermath
  game/systems/*             PlayerController, InteractionSystem, NpcSystem, SceneDirectiveRenderer, AudioDirector
  game/data/layout.ts        tile coordinates for interactables, PropAnchors and NPC spawns (frontend-owned; gap G3)
  assets/                    tilesets, sprites, audio, fonts (+ LICENSES.md)
```

### 2.3 Game loop

```
Phaser House.update(time, delta):
  player.move(input, delta)                        // 90 px/s, 4 directions, collision (frontend)
  result = store.tick(delta)                       // engine.tick(delta); a no-op while paused or an event is open
  if result.events has sceneChanged → this.scene.start(map[to])
  if result.events has eventTriggered → store.emit('openEvent')    // React shows EventDialog
  if result has events → sceneDirectiveRenderer.refresh()          // cheap; diffs internally
```

### 2.4 Scene routing (`state.scene` → Phaser scene)
| `SceneId` | Phaser scene | Entered when |
|---|---|---|
| `HOUSE` | House | Run start; `RETURN_HOME` |
| `SHOP` | Shop | `SHOP_TRIP` |
| `STREET` | Street (transit) | `FOLLOW_EVACUATION` (phase `evacuation`). A household still travelling at landfall **stays on `STREET`** (phase `impact`) until it arrives |
| `EVACUATION` | Evacuation | Arrival milestone `EVAC_ARRIVAL` (EV11), before or after landfall |
| `HOME_IMPACT` | HomeImpact (House map, storm look) | Landfall while the household is **at home** (never for a household that has left) |
| `AFTERMATH` | Aftermath (House map, recovery look) | `AFTERMATH_DAY1` milestone |
| `RESULTS` | React Debrief screen (Phaser paused) | EV16 resolved (`runCompleted`) |

---

## 3. Screen-by-screen

Each screen lists its inputs, outputs, backend calls, navigation and acceptance criteria. Detailed tasks are in §10.

| # | Screen | Inputs → outputs | Backend | Next | Accept when |
|---|---|---|---|---|---|
| S1 | Title | — → New / Continue / Achievements / Settings | `ai.status()`, `save.list()`, `achievements.read()` | S2, S7(load), S12 | Continue only shows when a save exists. AI status is visible |
| S2 | Q0 Mode | choice → `mode` | `ONBOARDING_QUESTIONS[Q0]` | S3a or S3b | Both cards show the exact Q0 text and details |
| S3a | Custom onboarding (Q1–Q8, Q2b) | answers → `CustomOnboarding` | `ONBOARDING_QUESTIONS` (path `custom`), `createGame` | S4 | Exclusive options, conditional Q2b, live age total; `error.issues` shown per field |
| S3b | Random onboarding (R1–R4) | answers → `RandomOnboarding` | path `random`, `createGame` | S4 | R3 hidden for 1 person; R4 skippable (default surprise) |
| S4 | Customization + review | theme, player, appearance, budget challenge → `customization` | `getProfile()`, `getWorldConfig()` | S5 | Review shows roster, exposure (labelled fictional), budget; Start creates the game |
| S5 | Loading / AI warm-up | — | `ai.status()` / `onStatus` | S6 | Proceeds on `ready` **or** `unavailable` (no hard wait) |
| S6 | Game (Phaser world + HUD + dialogs) | input → commands | engine commands, `getSceneDirective`, `ai.*` | S7 on `runCompleted` | See §4 and §10 |
| S7 | Debrief | `evaluate()` → screens | `evaluate`, `ai.narrateDebrief`, `achievements.recordRun`, `achievements.markPlanViewed` | S8, S12, S1 | Score and ending shown **separately** from the Handa badge; all 12 badges with status; plan shown → `markPlanViewed` |
| S8 | Replay | — | `startRun(profile,{seed})` or back to S2 | S5 | New seed, same household; earned badges persist |
| S12 | Achievements | — | `achievements.read()`, `getAchievementCatalog()` | S1 | progress/target bars; unlock dates |
| S13 | Settings | volume, mute, text size (localStorage) | — (gap G5) | S1 | Survives restart |

---

## 4. World implementation

### 4.1 Rendering setup
- Phaser 3.90, `pixelArt: true`, `roundPixels: true`.
- Base resolution **384×216** (or 320×180), scaled by integer `zoom` to fit the window. The window is 1280×720 (min 960×540), set in `src/main/index.ts`.
- 16×16 tiles. Tiled JSON is recommended.

### 4.2 House tilemap (one fixed layout, `layoutId: 'house_fixed_v1'`)
- **Layers:** `floor`, `walls` (collision), `furniture` (collision where solid), `decor`, `overhead`.
- **One map, two tilesets:**
  - Modern Filipino → `tileset_house_modern`.
  - Traditional Filipino → `tileset_house_traditional`.
  - Swap by `getWorldConfig().theme`. The geometry and collision are identical for both.
- **Areas:** living room, kitchen, bedroom, utility, entrance/yard, stairs, windows. These match `interactables[].area`.
- **Object layer `anchors`:** one point per interactable ID (§5.1), one per `PropAnchor`, NPC spawn points (`npc_spawn_1..3`) and `player_spawn`. These coordinates are **frontend-owned** (gap G3).
- **Multi-floor homes** (`profile.housing.floors > 1`): only show the stairs as a visual cue. Don't add explorable floors.

### 4.3 Player and NPCs
- **Player:** from `getWorldConfig().characters.find(c => c.isPlayer)`.
  - Use its `spriteBase` (`boy|girl|mom|dad`), `clothingVariant` 0–3, and `paletteId`. `'custom'` means use `profile.appearance.clothingColor`.
  - 4-direction movement at 90 px/s with collision.
- **Household NPCs:** `characters.filter(c => c.visibleNpc)` (at most 3), placed at `npc_spawn_*`. Interact by passing the NPC's `npcId`, e.g. `engine.interact('NPC_M2')`.
- **Dependents** (`dependent: true`, toddlers): draw them near an adult. They're never interactable or walking.
- **No neighbour character.** Community assistance (Bayanihan) uses existing objects only: the phone and the front door (§5.12). Don't add a neighbour sprite, marker or dialogue tree.
- **Pets:** `getWorldConfig().pets` (`dog|cat|bird|other`), placed at `PET_AREA`.

### 4.4 Interaction system
- **Proximity:** 24 px. Show a prompt with the interactable's `label`.
- **On E or Space:** `const r = engine.interact(id)`.
  - `!r.ok`: show `r.error.message` (e.g. `EVENT_PENDING`).
  - `r.events` contains `eventTriggered`: open the EventDialog (§7.2).
  - Otherwise, open the InteractionMenu with `r.actions` (each has `label`, `timeCostMinutes`, `available`, `reasons`, `kind`).
- **Menu by `kind`:**
  - `discovery` (0 min): run it, then show a DiscoveryCard built from state (§6.3), e.g. missing go-bag items, water vs target.
  - `preparation`: run `executeAction(id)` and show the time spent (`timeCostMinutes`).
  - `conversation`: reserved kind; no current world action uses it.
- **Unavailable actions:** disabled, with `reasons` shown as a tooltip.

### 4.5 Typhoon progression and environment
- **Render everything from `engine.getSceneDirective()`.** Mapping rules are in [FRONTEND_BACKEND_CONTRACTS.md](../implementation/FRONTEND_BACKEND_CONTRACTS.md#scene-directives-ai-directed-environmental-variation). Don't read `environment.*` directly for visuals.
- **Flood timing comes from the engine** via the milestones in §5.3: `FLOOD_ONSET` (low) and `FLOOD_RISING` (moderate) before landfall for flood-related exposures, then the peak. `directive.flood` already reflects it.
- **Critical milestones** (advisory, landfall, peak) reset the speed to 1×. The `speedChanged` event has `reason: 'critical'`; show a banner.

---

## 5. Exact backend mappings (generated from the code)

### 5.1 Interactables → world actions

| Interactable | Scene | Area | Actions (id · kind · min) |
|---|---|---|---|
| `LIVING_TV` (Television) | HOUSE | livingRoom | CHECK_BULLETIN · preparation · 30 |
| `LIVING_PHONE` (Phone) | HOUSE | livingRoom | CHARGE_PHONE · preparation · 120<br>CHECK_BULLETIN · preparation · 30<br>ARRANGE_ASSISTANCE · preparation · 60<br>PREPARE_COMMUNICATION · preparation · 30<br>CHARGE_POWER_BANK · preparation · 60<br>SHARE_VERIFIED_ADVISORY · preparation · 15 (Bayanihan) |
| `LIVING_RADIO` (Radio) | HOUSE | livingRoom | CHECK_BULLETIN · preparation · 30 |
| `KITCHEN_CABINET` (Food cabinet) | HOUSE | kitchen | INSPECT_SUPPLIES · discovery · 0 |
| `KITCHEN_SINK` (Sink) | HOUSE | kitchen | FILL_CONTAINERS · preparation · 30<br>INSPECT_SUPPLIES · discovery · 0 |
| `BEDROOM_CLOTHES` (Clothes cabinet) | HOUSE | bedroom | PACK_GO_BAG · preparation · 90<br>PREPARE_CHILD_SUPPLIES · preparation · 30 |
| `BEDROOM_DOCUMENTS` (Documents drawer) | HOUSE | bedroom | PROTECT_DOCUMENTS · preparation · 30 |
| `BEDROOM_MEDICATION` (Medicine cabinet) | HOUSE | bedroom | PACK_MEDICATION · preparation · 30<br>CHECK_ESSENTIAL_SUPPLIES · discovery · 0 |
| `UTILITY_TOOLS` (Toolbox) | HOUSE | utility | GET_TOOLS · preparation · 15 |
| `UTILITY_SHELF` (Supply shelf) | HOUSE | utility | INSPECT_SUPPLIES · discovery · 0 |
| `UTILITY_DRUM` (Water drum) | HOUSE | utility | FILL_DRUM · preparation · 60 |
| `UTILITY_LADDER` (Ladder) | HOUSE | utility | SECURE_ROOF · preparation · 180 |
| `PET_AREA` (Pet corner) | HOUSE | utility | PREPARE_PET_SUPPLIES · preparation · 30 |
| `ENTRANCE_DOOR` (Front door) | HOUSE | entrance | SECURE_OBJECTS · preparation · 30<br>SANDBAG_GATE · preparation · 90<br>SHOP_TRIP · preparation · 60<br>BARANGAY_VISIT · preparation · 90<br>HELP_COMMUNITY_PREPARATION · preparation · 60 (Bayanihan)<br>FOLLOW_EVACUATION · preparation · 0 |
| `ENTRANCE_BAG` (Go-bag) | HOUSE | entrance | PACK_GO_BAG · preparation · 90<br>INSPECT_GO_BAG · discovery · 0 |
| `STAIRS` (Stairs / high shelf) | HOUSE | stairs | RAISE_BELONGINGS · preparation · 120 |
| `WINDOW` (Windows) | HOUSE | windows | BOARD_WINDOW · preparation · 90<br>SECURE_OBJECTS · preparation · 30 |
| `SHOP_COUNTER` (Shop counter) | SHOP | shop | — (UI only) |
| `SHOP_EXIT` (Shop exit) | SHOP | shop | RETURN_HOME · preparation · 60 |
| `NPC` (Any household NPC (pass its npcId, e.g. NPC_M2)) | HOUSE | any | FAMILY_MEETING · preparation · 30<br>ARRANGE_ASSISTANCE · preparation · 60 |

### 5.2 Events → variants → ordered choices

Trigger notes: EV07 fires at `H28_RUMOR` only when the storm includes a rumour; EV11 fires at `EVAC_ARRIVAL`. Choices are filtered per household and state: EV09 with lighting = `USE_FLASHLIGHT, USE_POWER_BANK, CHECK_HOUSEHOLD_NEEDS`; EV10 adds `SEEK_HELP` when the shelter isn't normal; EV12__COMMUNITY = `HELP_COMMUNITY_PREPARATION, SHARE_VERIFIED_ADVISORY, CHECK_HOUSEHOLD_NEEDS, DEFER`; EV10 fires only for a household **at home**. Always render `engine.getEventChoices()`.

| Event | Title | Mandatory | Trigger | Variants | Choices (engine order; filtered per household) |
|---|---|---|---|---|---|
| EV01 | Initial advisory | yes | milestone H0_ADVISORY | `EV01__DEFAULT`<br>`EV01__FLOOD_PRONE` | CHECK_ADVISORY, REVIEW_PLAN, DEFER |
| EV02 | Go-bag inspection | no | milestone H8_REMINDER | `EV02__EMPTY`<br>`EV02__PARTIAL` | INSPECT_GO_BAG, PACK_GO_BAG, DEFER |
| EV03 | Household coordination | no | milestone H12_COORDINATION | `EV03__DEFAULT`<br>`EV03__ASSISTANCE` | FAMILY_MEETING, ASSIGN_TASKS, ARRANGE_ASSISTANCE, DEFER |
| EV04 | Supply gap | yes | milestone H16_SUPPLY | `EV04__SUPPLY_BUDGET_GAP`<br>`EV04__CHILD_SUPPLIES_GAP`<br>`EV04__MEDICATION_SUPPLY_GAP`<br>`EV04__SUPPLIES_READY` | INSPECT_SUPPLIES, SHOP_TRIP, PRIORITIZE_SUPPLIES, DEFER |
| EV05 | Medical preparedness | no | milestone H20_MEDICAL | `EV05__ESSENTIAL_SUPPLIES`<br>`EV05__POWERED_EQUIPMENT` | REVIEW_MED_SUPPLIES, PACK_MEDICATION, ARRANGE_CONTINUITY, DEFER |
| EV06 | Updated warning | yes | milestone H24_UPDATE | `EV06__ON_SCHEDULE`<br>`EV06__ACCELERATED` | READ_UPDATE, REASSESS_PLAN, DEFER |
| EV07 | Rumor | yes | — | `EV07__DAM_RUMOR` | VERIFY_RUMOR, IGNORE_RUMOR, FORWARD_RUMOR |
| EV08 | Evacuation advisory | yes | milestone EVAC_ADVISORY | `EV08__DEFAULT`<br>`EV08__ASSISTANCE_READY`<br>`EV08__ASSISTANCE_UNPLANNED` | REVIEW_ADVISORY, PREPARE_TO_EVACUATE, FOLLOW_EVACUATION, SEEK_ASSISTANCE, DELAY_EVACUATION |
| EV09 | Power interruption | yes | milestone POWER_OUTAGE | `EV09__BACKUP_READY`<br>`EV09__LIGHTING_GAP` | CHECK_HOUSEHOLD_NEEDS, DEFER |
| EV10 | Shelter hazard | yes | milestone PEAK | `EV10__CRITICAL`<br>`EV10__WATER_RISING`<br>`EV10__LOOSE_OBJECTS`<br>`EV10__STRONG_WIND` | MOVE_TO_SAFER_ROOM, ACCOUNT_MEMBERS, GO_OUTSIDE_TO_CHECK |
| EV11 | Evacuation arrival | yes | — | `EV11__WITH_SUPPLIES`<br>`EV11__WITHOUT_SUPPLIES` | ACCOUNT_MEMBERS, INSPECT_GO_BAG, CHECK_ADVISORY |
| EV12 | Household dilemma | yes | milestone H32_DILEMMA | `EV12__ASSISTANCE`<br>`EV12__POWERED_EQUIPMENT`<br>`EV12__PET`<br>`EV12__CHILD`<br>`EV12__COMMUNITY` | HELP_WITH_NEED, REVIEW_NEEDS, DEFER, HELP_COMMUNITY_PREPARATION, SHARE_VERIFIED_ADVISORY, CHECK_HOUSEHOLD_NEEDS |
| EV13 | Household status | yes | milestone IMPACT_END | `EV13__ACCOUNTED`<br>`EV13__CHECK_NEEDED` | ACCOUNT_MEMBERS, REVIEW_NEEDS, DEFER |
| EV14 | Resource review | yes | milestone AFTERMATH_DAY1 | `EV14__SUFFICIENT`<br>`EV14__SHORTFALL` | REVIEW_RESOURCES, DEFER |
| EV15 | Recovery update | yes | milestone AFTERMATH_DAY2 | `EV15__DEFAULT` | VERIFY_GUIDANCE, PLAN_RECOVERY, DEFER |
| EV16 | Final reflection | yes | milestone AFTERMATH_DAY3 | `EV16__DEFAULT` | FINISH_REFLECTION |

### 5.3 Storm milestones (example: landfall at hour 48, exposure "both"; landfall moves 0/4/8 h earlier by seed, revealed at h24)

| Milestone | Hour | Event | Critical |
|---|---|---|---|
| H0_ADVISORY | 0 | EV01 |  |
| H8_REMINDER | 8 | EV02 |  |
| H12_COORDINATION | 12 | EV03 |  |
| H16_SUPPLY | 16 | EV04 |  |
| H20_MEDICAL | 20 | EV05 |  |
| H24_UPDATE | 24 | EV06 |  |
| H28_RUMOR | 28 | EV07 |  |
| H32_DILEMMA | 32 | EV12 |  |
| EVAC_ADVISORY | 36 | EV08 | yes |
| HEAVY_RAIN | 40 | — |  |
| FLOOD_ONSET | 42 | — |  |
| SHOP_CLOSURE | 42 | — |  |
| ROAD_RESTRICTED | 44 | — |  |
| POWER_OUTAGE | 44 | EV09 |  |
| FLOOD_RISING | 46 | — |  |
| ROAD_CLOSED | 46 | — |  |
| LANDFALL | 48 | — | yes |
| PEAK | 51 | EV10 (home only) | yes |

Route status: with a road-closure event the road is restricted at L−4 and closed at L−2 (as above). Without one, landfall only **restricts** the road and it closes at the peak. `FOLLOW_EVACUATION` is rejected when the trip would end after that closure (§5.13).
| IMPACT_END | 54 | EV13 |  |
| AFTERMATH_DAY1 | 60 | EV14 |  |
| AFTERMATH_DAY2 | 84 | EV15 |  |
| AFTERMATH_DAY3 | 108 | EV16 |  |

### 5.4 All actions (button labels and fixed costs)

| Action | Label | Min | Unsafe |
|---|---|---|---|
| GET_TOOLS | Retrieve tools | 15 |  |
| BOARD_WINDOW | Prepare a window | 90 |  |
| SECURE_ROOF | Arrange safe roof preparation | 180 |  |
| SECURE_OBJECTS | Secure loose items | 30 |  |
| FILL_CONTAINERS | Fill water containers | 30 |  |
| FILL_DRUM | Fill the water drum | 60 |  |
| PACK_GO_BAG | Pack the go-bag | 90 |  |
| CHARGE_PHONE | Charge the phone | 120 |  |
| PROTECT_DOCUMENTS | Waterproof important documents | 30 |  |
| RAISE_BELONGINGS | Move belongings and supplies higher | 120 |  |
| FAMILY_MEETING | Discuss the household plan | 30 |  |
| CHECK_BULLETIN | Check official information | 30 |  |
| SANDBAG_GATE | Prepare the gate with sandbags | 90 |  |
| SHOP_TRIP | Go to the community shop | 60 |  |
| RETURN_HOME | Return home | 60 |  |
| BARANGAY_VISIT | Visit the barangay hall | 90 |  |
| PACK_MEDICATION | Prepare essential medication and supplies | 30 |  |
| PREPARE_PET_SUPPLIES | Organise pet supplies | 30 |  |
| PREPARE_CHILD_SUPPLIES | Prepare child-care supplies | 30 |  |
| ARRANGE_ASSISTANCE | Coordinate help for a household member | 60 |  |
| PREPARE_COMMUNICATION | Set a communication plan | 30 |  |
| INSPECT_SUPPLIES | Inspect supplies | 0 |  |
| INSPECT_GO_BAG | Inspect the go-bag | 0 |  |
| CHECK_ESSENTIAL_SUPPLIES | Check the medicine cabinet | 0 |  |
| CHARGE_POWER_BANK | Charge the power bank | 60 |  |
| SHARE_VERIFIED_ADVISORY | Share the verified official advisory with neighbours | 15 |  |
| HELP_COMMUNITY_PREPARATION | Help neighbours with the community preparedness activity | 60 |  |
| FOLLOW_EVACUATION | Leave for the evacuation destination | 0 |  |
| CHECK_ADVISORY | Check the official advisory | 30 |  |
| REVIEW_PLAN | Review the household plan | 15 |  |
| DEFER | Not now | 0 |  |
| ASSIGN_TASKS | Assign preparation tasks | 30 |  |
| PRIORITIZE_SUPPLIES | Prioritise what is missing | 15 |  |
| REVIEW_MED_SUPPLIES | Review essential supplies | 15 |  |
| ARRANGE_CONTINUITY | Plan how essential supplies continue | 30 |  |
| READ_UPDATE | Read the updated advisory | 15 |  |
| REASSESS_PLAN | Reassess the plan | 15 |  |
| VERIFY_RUMOR | Verify with an official source | 30 |  |
| IGNORE_RUMOR | Ignore the message | 0 |  |
| FORWARD_RUMOR | Forward the message | 5 | ⚠ |
| REVIEW_ADVISORY | Review the evacuation advisory | 15 |  |
| PREPARE_TO_EVACUATE | Prepare to leave | 60 |  |
| DELAY_EVACUATION | Wait for now | 0 |  |
| SEEK_ASSISTANCE | Ask officials for assistance | 30 |  |
| USE_FLASHLIGHT | Use backup lighting | 5 |  |
| USE_POWER_BANK | Charge the phone from the power bank | 10 |  |
| CHECK_HOUSEHOLD_NEEDS | Check on everyone’s needs | 15 |  |
| MOVE_TO_SAFER_ROOM | Move everyone to the safest room | 15 |  |
| ACCOUNT_MEMBERS | Account for every household member | 15 |  |
| SEEK_HELP | Call for official help | 15 |  |
| GO_OUTSIDE_TO_CHECK | Go outside to look | 15 | ⚠ |
| HELP_WITH_NEED | Make a plan for this need | 30 |  |
| REVIEW_NEEDS | Review household needs | 15 |  |
| REVIEW_RESOURCES | Review water, food and supplies | 15 |  |
| VERIFY_GUIDANCE | Check official recovery updates | 15 |  |
| PLAN_RECOVERY | Plan recovery priorities | 30 |  |
| FINISH_REFLECTION | Review and finish | 0 |  |

### 5.5 Items

| ItemId | Label |
|---|---|
| WATER | Drinking water (L) |
| FOOD | Food (person-days) |
| FLASHLIGHT | Flashlight |
| BATTERIES | Batteries |
| POWER_BANK | Power bank |
| RADIO | Battery-powered radio |
| FIRST_AID_KIT | First-aid kit |
| MEDICATION | Essential medication supply |
| HYGIENE_KIT | Hygiene kit |
| DOCUMENTS | Important documents |
| EMERGENCY_CASH | Emergency cash |
| WHISTLE | Whistle |
| CLOTHES | Extra clothing |
| CHILD_CARE_SUPPLIES | Child-care supplies |
| PET_SUPPLIES | Pet supplies |
| TOOLS | Tools |
| FUEL | Fuel |
| SANDBAGS | Sandbags |
| PHONE | Mobile phone |

### 5.6 Shop items (fictional ₱; ×1.5 from game hour 24; only household-relevant items are stocked)

| ShopItemId | Label | ₱ | Grants |
|---|---|---|---|
| WATER_JUG | Water jug (20 L) | 100 | WATER ×20 |
| FOOD_PACK | Food pack (6 person-days) | 280 | FOOD ×6 |
| MEDICATION_REFILL | Prescribed medication refill | 350 | MEDICATION ×1 |
| FLASHLIGHT | Flashlight | 120 | FLASHLIGHT ×1 |
| POWER_BANK | Power bank | 450 | POWER_BANK ×1 |
| FIRST_AID_KIT | First-aid kit | 200 | FIRST_AID_KIT ×1 |
| TOOLS | Tools | 250 | TOOLS ×1 |
| RADIO | Battery-powered radio | 250 | RADIO ×1 |
| FUEL | Fuel | 150 | FUEL ×1 |
| BATTERIES | Batteries | 80 | BATTERIES ×1 |
| HYGIENE_KIT | Hygiene kit | 150 | HYGIENE_KIT ×1 |
| PET_SUPPLIES | Pet supplies | 180 | PET_SUPPLIES ×1 |
| CHILD_CARE_SUPPLIES | Child-care supplies | 220 | CHILD_CARE_SUPPLIES ×1 |
| SANDBAGS | Sandbags | 120 | SANDBAGS ×1 |

### 5.7 Badges (names, descriptions and hints: `engine.getBadgeCatalog()`)

| Id | Name | Icon asset ID |
|---|---|---|
| B01 | Handa | `badge_b01_handa` |
| B02 | Go-Bag Ready | `badge_b02_go_bag_ready` |
| B03 | Tubig Muna | `badge_b03_tubig_muna` |
| B04 | Botika Run | `badge_b04_botika_run` |
| B05 | Fact Checker | `badge_b05_fact_checker` |
| B06 | Bayanihan | `badge_b06_bayanihan` |
| B07 | Maagang Lumikas | `badge_b07_maagang_lumikas` |
| B08 | Walang Maiiwan | `badge_b08_walang_maiiwan` |
| B09 | Bintana Boss | `badge_b09_bintana_boss` |
| B10 | Bubong Secured | `badge_b10_bubong_secured` |
| B11 | Family Plan | `badge_b11_family_plan` |
| B12 | Powered Up | `badge_b12_powered_up` |

### 5.8 Achievements (`engine.getAchievementCatalog()`)

| Id | Name | Icon asset ID |
|---|---|---|
| A01 | First Storm | `achievement_a01_first_storm` |
| A02 | Natuto | `achievement_a02_natuto` |
| A03 | Lesson Collector | `achievement_a03_lesson_collector` |
| A04 | Signal Master | `achievement_a04_signal_master` |
| A05 | Kapos Pero Handa | `achievement_a05_kapos_pero_handa` |
| A06 | Storm Chaser | `achievement_a06_storm_chaser` |
| A07 | No Rumor Spreader | `achievement_a07_no_rumor_spreader` |
| A08 | Whole Barangay | `achievement_a08_whole_barangay` |
| A09 | My Real Home | `achievement_a09_my_real_home` |
| A10 | Plan in Hand | `achievement_a10_plan_in_hand` |

### 5.9 SceneDirective enums (every value needs a rendering; see §9)

- **SceneId** (11): `TITLE`, `ONBOARDING`, `CUSTOMIZATION`, `HOUSE`, `SHOP`, `EVACUATION`, `HOME_IMPACT`, `AFTERMATH`, `RESULTS`, `STREET`, `BARANGAY`
- **WeatherPreset** (6): `clear`, `overcast`, `rain`, `heavyRain`, `typhoon`, `clearingSky`
- **LightingPreset** (9): `daylight`, `overcast`, `gloomy`, `stormDark`, `outageDark`, `outageFlashlight`, `evacuationCenter`, `shopInterior`, `morningAfter`
- **FloodOverlay** (4): `none`, `low`, `moderate`, `severe`
- **EffectId** (12): `RAIN_STREAKS`, `WINDOW_DRIPS`, `WIND_DEBRIS`, `TREE_SWAY`, `LIGHTNING_FLASH`, `MIST`, `PUDDLES`, `FLOOD_RIPPLES`, `FLICKERING_LIGHTS`, `DEBRIS_AFTERMATH`, `SUNBEAMS`, `DUST_MOTES`
- **PropAnchor** (9): `WINDOW`, `YARD`, `ENTRANCE`, `STAIRS`, `LIVING_TABLE`, `GO_BAG_SPOT`, `LIVING_DECOR`, `KITCHEN_DECOR`, `BEDROOM_DECOR`
- **PropVariantId** (25): `WINDOW_PLAIN`, `WINDOW_BOARDED`, `YARD_LOOSE_ITEMS`, `YARD_SECURED`, `ENTRANCE_PLAIN`, `ENTRANCE_SANDBAGS`, `STAIRS_PLAIN`, `STAIRS_RAISED_BELONGINGS`, `LIVING_TABLE_EMPTY`, `LIVING_TABLE_FLASHLIGHT`, `GO_BAG_EMPTY`, `GO_BAG_PARTIAL`, `GO_BAG_READY`, `MODERN_LIVING_PHOTOS`, `MODERN_LIVING_PLANTS`, `MODERN_KITCHEN_RICE_COOKER`, `MODERN_KITCHEN_FRUIT_BOWL`, `MODERN_BEDROOM_POSTERS`, `MODERN_BEDROOM_DESK_LAMP`, `TRAD_LIVING_ALTAR`, `TRAD_LIVING_CAPIZ_LAMP`, `TRAD_KITCHEN_PALAYOK`, `TRAD_KITCHEN_BAYONG`, `TRAD_BEDROOM_BANIG`, `TRAD_BEDROOM_WOODEN_CHEST`
- **NpcAnimation** (9): `idle`, `pacing`, `packing`, `sitting`, `lookingOutWindow`, `huddled`, `waving`, `cleaning`, `sleeping`
- **NpcEmotion** (6): `calm`, `worried`, `anxious`, `determined`, `relieved`, `tired`
- **AudioPreset** (8): `dayAmbience`, `lightRainRoof`, `heavyRainRoof`, `typhoonWind`, `outageStormMuffled`, `evacuationCenterCrowd`, `shopChatter`, `aftermathDrips`
- **Mood** (6): `calm`, `uneasy`, `tense`, `urgent`, `somber`, `hopeful`
- **TransitionPreset** (4): `none`, `fade`, `rainWipe`, `flashToBlack`

### 5.10 NPC and speaker IDs
| ID | Who | Where it appears |
|---|---|---|
| `NPC_M<n>` | Visible household member n (`characters[].npcId`) | World NPC, dialog speaker, scene-directive `npcCues` |
| `NPC_NEIGHBOR` | Generic neighbour voice (EV07; EV12 in single-person households). No sprite: show it as an off-screen voice or a phone message | Dialog speaker only |
| `NPC_CENTER_STAFF` | Evacuation-center staff | Dialog speaker (EV11) |
| `NARRATOR` | Narration and advisories | Dialog speaker |

### 5.11 State fields the UI reads

| UI element | Fields |
|---|---|
| HUD clock | `state.clock.gameMinutes` (day = ⌊min/1440⌋+1, hh:mm) |
| HUD speed | `state.clock.timeScale` |
| Paused indicator | `state.clock.pauseReasons` |
| Phase | `state.phase` |
| Money | `state.cash` |
| Phone | `state.phoneBattery` |
| Go-bag status | `engine.getGoBagStatus()` |
| Wellbeing | `state.player.wellbeing` (+ `wellbeingEvents` for the reason toast) |
| Warning banner | `environment.officialAdvisoryIssued`, `environment.evacuationAdvisoryIssued` |
| Landfall countdown | Show only if `environment.landfallRevealed`; `landfallMinute − gameMinutes` |
| Inventory | `state.house`, `state.goBag` + `ITEM_LABELS` (`src/core/content/items.ts`) |
| Aftermath day | `state.aftermathDay` |
| Run done | `state.completed` |

---

### 5.12 Community assistance (B06 Bayanihan, A08 Whole Barangay)

Bayanihan is earned by **one completed, safe, qualifying community action**. There is no neighbour NPC, scene or dialogue tree: the actions sit on existing objects and in EV12. The allowlist is `COMMUNITY_ASSISTANCE` in `src/core/content/community.ts`; evaluation is in `src/core/evaluation/community.ts`.

| Action ID | Where | Cost | Available when (engine reasons shown if not) | Deadline (must be *finished* by) | Effect |
|---|---|---|---|---|---|
| `SHARE_VERIFIED_ADVISORY` | `LIVING_PHONE`; EV12__COMMUNITY choice | 15 min; −5 % phone battery during an outage | Official information already checked (`flags.BULLETIN_CHECKED`, set by `CHECK_BULLETIN`, `CHECK_ADVISORY`, `READ_UPDATE`, `REVIEW_ADVISORY`); power or battery ≥ 10 %; once per run | Landfall | `flags.VERIFIED_INFO_SHARED` |
| `HELP_COMMUNITY_PREPARATION` | `ENTRANCE_DOOR`; EV12__COMMUNITY choice | 60 min | At `HOUSE`; safe outdoors; no evacuation advisory yet; road not closed; once per run | Heavy rain (L−8 h) or the advisory, whichever is first | `flags.COMMUNITY_PREP_HELPED` |

| Case | Engine behaviour | UI |
|---|---|---|
| Completed qualifying action | `ok: true`; decision appended to `decisionLog`; **first time only**, `events` include `{ type: 'badgeEarned', badgeId: 'B06' }`; `evaluate()` shows B06 `earned` immediately | Badge toast (icon `badge_b06_bayanihan`, name from `getBadgeCatalog()`), `sfx_badge_unlock` once |
| Rejected (not verified, too late, unsafe, already done) | `ok: false`, `ACTION_UNAVAILABLE`, `error.reasons[]`; nothing recorded | Disabled menu item with the reasons (from `getAvailableActions`/`getEventChoices`) |
| Non-qualifying community-flavoured actions | `CHECK_BULLETIN`, `CHECK_ADVISORY`, `BARANGAY_VISIT`, `VERIFY_RUMOR` never earn B06; `FORWARD_RUMOR` is unsafe | Nothing special |
| Declining | No penalty: B06 is never part of Handa, the score or wellbeing | Show B06 as "Not earned" neutrally in the debrief |
| No opportunity | B06 `notApplicable` (not reachable in supported configurations; every household has the phone action) | Neutral "Not applicable" |

**A08 Whole Barangay:** `progress` = number of distinct completed runs whose B06 result was `earned` (target 5). Recorded by `window.signal.achievements.recordRun(state)`, which re-evaluates in the main process. Each run ID counts once; abandoned runs are rejected; progress survives restarts. Show `progress/target` on the achievements screen and a toast when `newlyUnlocked` contains `A08`. Persistence of B06 across runs happens at `recordRun`, so a mid-run toast doesn't need a save call.

### 5.13 Evacuation travel and household location

| Derived location (`sel.householdLocation(state)`) | Condition | Scene during impact | Home hazards (EV10, peak shelter damage) |
|---|---|---|---|
| `home` | Not departed | `HOME_IMPACT` | Yes |
| `inTransit` | `evacuation.departedAtMinute` set, not arrived | `STREET` (even after landfall) | No |
| `evacuationCenter` | `evacuation.completed` | `EVACUATION` | No |

`FOLLOW_EVACUATION` needs: an evacuation advisory; not already departed; before landfall; road not closed; assistance arranged if needed; and **arrival (now + travel time) ≤ `sel.routeClosureMinute(state)`**. Otherwise its reason is "Too late to travel safely: the route is expected to close before you would arrive. Stay indoors in the safest room and follow official instructions." Travel time is 2 h, +90 min if the destination isn't known yet, +1 h with a household member who needs assistance. While in transit, show the `STREET` scene and a "Continue" control (`skipToNextMilestone()`).

## 6. Verified integration examples

Source: `tests/docs-examples.test.ts`. All of these run under `npm test`. The payload excerpts below are real output.

### 6.1 Configuration → HouseholdProfile → game initialisation
```ts
import { createGame, type GameEngine } from '../core/engine';
import { ONBOARDING_QUESTIONS, type CustomOnboarding } from '../shared/contracts/onboarding';

const customQs = ONBOARDING_QUESTIONS.filter((q) => q.path === 'custom'); // Q1, Q2, Q2b, Q3 … Q8
const answers: CustomOnboarding = {
  schemaVersion: 1, mode: 'custom', q1Housing: 'twoStory', q2SizeRange: '3-4', q2ExactSize: 3,
  q3AgeCounts: { age0to4: 0, age5to12: 1, age13to17: 0, age18to35: 0, age36to59: 2, age60plus: 0 },
  q4Assistance: 'no', q5MedicalSupplies: 'notSure', q6Surroundings: ['waterway'], q7Pets: 'yes', q8Preparedness: 'partial',
  customization: { theme: 'traditional' },
};
const r = createGame(answers, { seed: 20261010 });
if (!r.ok) showFieldErrors(r.error.issues);          // e.g. [{ path: ['q2ExactSize'], message: 'must be between 3 and 4' }]
else {
  const engine: GameEngine = r.engine;               // r.events includes eventTriggered EV01
  const profile = engine.getProfile();               // { configMode: 'custom', exposure: 'waterway', size: 3, budgetTier: 'moderate', … }
  const world = engine.getWorldConfig();             // interactables include LIVING_PHONE and BEDROOM_MEDICATION (medical "not sure")
}
```
Real `profile.members[0]`: `{"id":"M1","ageGroup":"age36to59","sex":"unspecified","spriteBase":"dad","clothingVariant":0,"paletteId":"pal_dad_0","dependent":false,"isPlayer":true,"visibleNpc":false,"npcId":null}`

### 6.2 Event dialog → AI text → choices → decision
```ts
import { buildScenarioRequest } from '../core/ai/scenario';
const st = engine.getState();
const req = buildScenarioRequest(st)!;
const content = await window.signal.ai.generateScenario(req, st.runId);   // always resolves
const choices = engine.getEventChoices();                                  // ordered; render as buttons
const res = engine.resolveEvent(choice.actionId);
```
Real fallback `content` (offline):
```json
{"eventId":"EV01","variantId":"EV01__FLOOD_PRONE","speaker":"NARRATOR","dialogue":"A fictional typhoon advisory is in effect. Your area has flooded before, so the next two days matter.","description":"Rain clouds gather on the horizon as the bulletin plays.","actionIds":["CHECK_ADVISORY","REVIEW_PLAN","DEFER"],"source":"fallback","fallbackReason":"model-unavailable"}
```
Real choice: `{"actionId":"CHECK_ADVISORY","label":"Check the official advisory","timeCostMinutes":30,"available":true,"reasons":[],"unsafe":false,"kind":"preparation"}`

### 6.3 Interaction → action → state update → SceneDirective
```ts
import { missingGoBagItems, waterRequirement } from '../core/selectors';
import { buildSceneAIRequest, mergeSceneSuggestion } from '../core/scene/directive';

const near = engine.interact('ENTRANCE_BAG');               // may open EV02 instead of a menu
const missing = missingGoBagItems(engine.getState());       // ItemId[][] for the DiscoveryCard
const target = waterRequirement(engine.getProfile());       // 12 L × household size
engine.executeAction('GET_TOOLS'); engine.executeAction('BOARD_WINDOW');
let scene = engine.getSceneDirective();                     // props now include WINDOW_BOARDED
const s = await window.signal.ai.suggestScene(buildSceneAIRequest(engine.getState()), engine.getState().runId);
scene = mergeSceneSuggestion(engine.getState(), engine.getSceneDirective(), s);  // null → deterministic directive
```
Real directive (abridged):
```json
{"sceneId":"HOUSE","weather":{"preset":"clear","rain":"none","wind":"calm"},"lighting":"daylight","flood":"none","effects":[],
 "props":[{"anchor":"WINDOW","variant":"WINDOW_BOARDED"},{"anchor":"YARD","variant":"YARD_LOOSE_ITEMS"},{"anchor":"LIVING_TABLE","variant":"LIVING_TABLE_FLASHLIGHT"},{"anchor":"GO_BAG_SPOT","variant":"GO_BAG_EMPTY"},{"anchor":"LIVING_DECOR","variant":"TRAD_LIVING_CAPIZ_LAMP"}],
 "npcCues":[{"npcId":"NPC_M2","animation":"idle","emotion":"calm"}],"audio":"dayAmbience","mood":"calm","transition":"none","source":"deterministic"}
```

### 6.4 Run completion → evaluation → debrief → achievement persistence
```ts
import { buildDebriefRequest } from '../core/ai/debrief';
// on runCompleted:
const ev = engine.evaluate();                                             // DebriefEvaluation
const narration = await window.signal.ai.narrateDebrief(ev, buildDebriefRequest(ev, engine.getState()));
const { achievements, newlyUnlocked } = await window.signal.achievements.recordRun(engine.getState());
// when the personalised plan (ev.checklistItems + ev.learningPoints) is on screen:
await window.signal.achievements.markPlanViewed(engine.getState().runId);
```
Real `ev.handa` for a qualifying run:
```json
{"earned":true,"runCompleted":true,"wellbeingPercent":100,"wellbeingThreshold":85,"wellbeingMet":true,
 "criticalCompetencies":[{"objectiveId":"O_WATER","applicable":true,"met":true}, … ,{"objectiveId":"O_MEDICATION","applicable":false,"met":null}],
 "criticalGaps":[],"evacuationAndAssistanceMet":true,"exposure":"standard","reasons":[]}
```
Real `ev.badges` start: `[{"id":"B01","status":"earned"},{"id":"B02","status":"earned"},{"id":"B03","status":"earned"},{"id":"B04","status":"notApplicable","reasons":["Not applicable to this household or run."]}]`

Real `recordRun`: `newlyUnlocked: ["A01","A09"]`. A03 shows `progress: 15, target: 26`.

---

### 6.5 Community assistance: phone → verified bulletin → share → Bayanihan → A08
```ts
// Player walks to the phone and presses E.
const menu = engine.interact('LIVING_PHONE');                    // r.actions includes CHECK_BULLETIN and SHARE_VERIFIED_ADVISORY
// SHARE_VERIFIED_ADVISORY is disabled until official information was checked:
//   { available: false, reasons: ['Check official information first; only verified information should be shared.'] }
engine.executeAction('CHECK_BULLETIN');                          // verified official information (30 min)
const r = engine.executeAction('SHARE_VERIFIED_ADVISORY');       // validated by the engine (15 min)
if (r.ok) {
  r.decision!.actionId;                                          // 'SHARE_VERIFIED_ADVISORY' (also r.state.decisionLog.at(-1))
  if (r.events.some((e) => e.type === 'badgeEarned' && e.badgeId === 'B06')) showBadgeToast('B06');
  engine.evaluate().badges.find((b) => b.id === 'B06')!.status; // 'earned' (already mid-run)
}
// At the end of the run (runCompleted):
const { achievements } = await window.signal.achievements.recordRun(engine.getState());
achievements.find((a) => a.id === 'A08');                        // { progress: 1, target: 5, unlocked: false, … }
```
Verified in `tests/docs-examples.test.ts` (6.5).

### More verified flows (same test file)

| Flow | Test |
|---|---|
| Random onboarding → preview → deterministic re-roll (same answers + seed = same household; R3 skipped for 1 person) | 6.6 |
| Interaction after movement: `interact('KITCHEN_SINK')` → `FILL_CONTAINERS` (+15 L, +30 min); `EVENT_PENDING` while an event is open | 6.7 |
| EV08 → `resolveEvent('FOLLOW_EVACUATION')` → `phaseChanged` evacuation, `sceneChanged` HOUSE→STREET, location `inTransit`, transition `rainWipe` | 6.8 |
| Wellbeing → HUD: stayed home with a severe flood → `{ current: 85, max: 100 }` + `W_ADVISORY_IGNORED_SEVERE_FLOOD` | 6.9 |
| End-of-run new badges (`ev.badgeIds` minus `badges.read()`), persistence across a restart | 6.10 |
| Save → load → resume (`save.write` → `save.read` → `loadGame` → `tick`) | 6.11 |
| AI unavailable → fallback text, `suggestScene` null, fallback narration (timeout: `tests/main/aiService.test.ts`) | 6.12 |

## 7. State synchronisation, de-duplication and audio

| Concern | Rule |
|---|---|
| Refresh state | After **every** command, store `result.state`. Never mutate it (it's a copy). |
| HUD re-render | Throttle React HUD updates to ≈ 4 Hz. Phaser reads the store every frame. |
| Event dialog | Open when `state.activeEvent` changes. Key it by `${eventId}@${triggeredAtMinute}` and open each key once. Call `generateScenario` once per key (it's also cached server-side). Close on a successful `resolveEvent`. |
| Stale AI text | If the event key changed before `generateScenario` resolved, **discard** the text. |
| SceneDirective | Recompute after any result whose events include `sceneChanged`, `phaseChanged`, `milestone`, `purchaseCompleted` or `actionCompleted`. Compare with the previous directive (deep equal or JSON) and only re-apply on change. Applying the same directive twice must be a no-op. |
| AI scene suggestion | Request when `directive.basisKey` changes. When it resolves, call `mergeSceneSuggestion(currentState, currentDirective, s)`, which discards stale suggestions itself. |
| Audio | **Ambient:** one loop keyed by `directive.audio`; crossfade only when the key changes. **One-shots** (alert, badge, thunder): play only from `EngineEvent`s or newly added `LIGHTNING_FLASH`, never from re-renders. Mute and volume come from Settings. |
| Pausing | `pause('menu'|'shop')` while menus or the shop UI are open. `pause('focusLost')` on window blur. `pause('loading')` while showing a loading screen. Always `resume` with the same reason. **Don't** pause for discovery or conversation. |
| Speed | `setSpeed(1|2|4|8|16|32)`. Show a banner on `speedChanged` with `reason: 'critical'`. |
| Badge unlock | Show a toast for each `badgeEarned` event in a command result (only B06 today; emitted once per run). Never infer unlocks from re-renders |
| After landfall | Show a "Continue" button calling `skipToNextMilestone()` when no event is open during the `evacuation`, `impact` and `aftermath` phases. |

## 8. Error handling

| Situation | Behaviour |
|---|---|
| `createGame` → `INVALID_SURVEY` | Map `error.issues[].path[0]` to fields and show the messages inline |
| Command `ok: false` | Toast `error.message` plus `reasons` (e.g. `ACTION_UNAVAILABLE`, `INSUFFICIENT_FUNDS`, `EVENT_PENDING`). State is unchanged; just re-render |
| AI unavailable or slow | Show a loading skeleton in the dialog, then the text. Hide the "AI-personalized" tag when `source === 'fallback'`. Never block input to choices |
| `ai.status() === 'unavailable'` | Small HUD badge "AI offline: using reviewed text". The game continues |
| `save.write` rejects | Toast "Couldn't save" and keep playing; offer retry |
| `save.read` → `null`, or `loadGame` → `INVALID_SAVE` | "This save can't be loaded" plus a delete option |
| `achievements.recordRun` rejects | Only for incomplete runs or invalid state. Log it, still show the debrief |
| Missing asset | Fall back to a magenta placeholder sprite and log the asset ID (never crash) |

## 9. Asset manifest

**Existing: none.** Everything below is **missing** and must be produced or licensed. Record licenses in `src/renderer/assets/LICENSES.md`. The IDs in `code` are the exact backend identifiers.

| Group | Assets (exact IDs) | Notes |
|---|---|---|
| Tilesets | `tileset_house_modern`, `tileset_house_traditional`, `tileset_exterior_yard_street`, `tileset_shop`, `tileset_evacuation_center` | 16×16 |
| Player and household sprites | `sprite_boy`, `sprite_girl`, `sprite_mom`, `sprite_dad` × 4 clothing variants (`pal_<base>_0..3`) + `custom` tint; `sprite_toddler_dependent` | Animations: idle and walk × 4 directions, plus `NpcAnimation`: `idle, pacing, packing, sitting, lookingOutWindow, huddled, waving, cleaning, sleeping`; `NpcEmotion` bubbles: `calm, worried, anxious, determined, relieved, tired` |
| Other characters | `npc_shopkeeper`, `npc_center_staff`; pets `pet_dog`, `pet_cat`, `pet_bird`, `pet_other` | No neighbour sprite is needed (Bayanihan uses the phone and front door) |
| Props (`PropVariantId`) | `WINDOW_PLAIN/BOARDED`, `YARD_LOOSE_ITEMS/SECURED`, `ENTRANCE_PLAIN/SANDBAGS`, `STAIRS_PLAIN/RAISED_BELONGINGS`, `LIVING_TABLE_EMPTY/FLASHLIGHT`, `GO_BAG_EMPTY/PARTIAL/READY`, plus the 12 decor variants (`MODERN_*`, `TRAD_*`) | Placed at `PropAnchor` points |
| Interactable objects | One sprite per interactable in §5.1 (TV, phone, radio, cabinet, sink, clothes, documents, medicine cabinet, toolbox, shelf, drum, ladder, pet corner, door, go-bag, stairs, windows, shop counter, shop exit) | |
| Weather and effects | `WeatherPreset` sky tints (6). `EffectId` particles/overlays (12): `RAIN_STREAKS, WINDOW_DRIPS, WIND_DEBRIS, TREE_SWAY, LIGHTNING_FLASH, MIST, PUDDLES, FLOOD_RIPPLES, FLICKERING_LIGHTS, DEBRIS_AFTERMATH, SUNBEAMS, DUST_MOTES` | |
| Lighting | `LightingPreset` overlays (9): `daylight, overcast, gloomy, stormDark, outageDark, outageFlashlight, evacuationCenter, shopInterior, morningAfter` | |
| Flood | `FloodOverlay` `low, moderate, severe` (exterior water layers) | Never show the player in water |
| Transitions | `TransitionPreset`: `fade, rainWipe, flashToBlack` | |
| Audio | `AudioPreset` loops (8): `dayAmbience, lightRainRoof, heavyRainRoof, typhoonWind, outageStormMuffled, evacuationCenterCrowd, shopChatter, aftermathDrips`. SFX: `sfx_ui_click`, `sfx_interact`, `sfx_event_alert`, `sfx_badge_unlock`, `sfx_achievement_unlock`, `sfx_thunder` | Mute toggle required |
| Icons | Badges `badge_b01_handa` … `badge_b12_powered_up` (12; IDs in §5). Achievements `achievement_a01_first_storm` … `achievement_a10_plan_in_hand` (10). Items: one per `ItemId` (19). HUD: clock, speed, cash, phone, go-bag, wellbeing, warning, power, water | |
| UI | Pixel font (+ fallback), 9-slice panel, buttons, dialog box, toast, progress bar | High contrast; large targets |

## 10. Implementation plan (one frontend workstream, dependency-ordered)

One developer, or one Claude Code instance, owns the whole frontend: React UI, Phaser world, assets and integration. Under the frontend's control: `src/renderer/**`, `package.json` dependencies and the `renderer` block of `electron.vite.config.ts`. Everything else is backend-owned.

**First playable vertical slice (end of M4):** initialise a hard-coded household → enter the house → move → interact with the phone → `CHECK_BULLETIN` → `SHARE_VERIFIED_ADVISORY` → Bayanihan toast from `badgeEarned`. It needs no onboarding screens and no art (placeholder textures); see §6.5 for the exact calls.

| Milestone | Tasks (details below) | Depends on | Checkpoint |
|---|---|---|---|
| **M1** Foundation and shared state | F0, F1 | — | Store drives `createGame → resolveEvent → executeAction` headlessly; production-CSP asset load proven |
| **M2** House map, movement, collisions | A1, A2, A3 (movement part) | M1 | Player walks the fixed house in both themes |
| **M3** Object interactions and backend actions | A3 (interaction part), B5 (InteractionMenu, DiscoveryCard), badge toast from B9 | M2 | Phone → bulletin → share → one Bayanihan toast |
| **M4** Event dialogue and branching | B5 (EventDialog) | M3 | EV01 dialog with fallback/AI text; choices resolve. **Vertical slice complete** |
| **M5** Custom/random onboarding and customization | B1, B2, B3 | M1 (can follow M4) | Both paths start a real household |
| **M6** SceneDirective rendering and scenes | A4, A5, A6 | M2, M4 | Weather/flood/lighting/props/cues/audio follow the directive; late departures stay on STREET |
| **M7** Inventory, HUD, wellbeing, shop | B4, A7, B6, B7 | M3, M6 | HUD matches state; wellbeing toast; shop errors verbatim |
| **M8** Badges and achievements | B9 | M3, M5 | Four badge statuses; one toast per unlock; A08 n/5 |
| **M9** Debrief, save/load, replay, settings | B8, B10, B11 | M7, M8 | Full run to debrief; save → continue; replay |
| **M10** End-to-end and offline validation | A8, §11 end-to-end checklist, packaged run | M9 | Packaged, offline playthrough (rebuild needs owner approval) |

### M1 — Foundation

**F0 — Dependencies and renderer scaffold**
- **Objective:** a React + Phaser renderer replaces the harness, built by electron-vite.
- **Inspect:** `electron.vite.config.ts`, `src/renderer/index.html`, `src/renderer/harness.ts`, `src/main/index.ts` (CSP, window size).
- **Create or modify:** `package.json` (add `react`, `react-dom`, `phaser@3.90.0`, `@vitejs/plugin-react` compatible with Vite 7, and types), the `electron.vite.config.ts` renderer block (`plugins: [react()]`, input `index.html`), `src/renderer/index.html`, `src/renderer/main.tsx`.
- **Contracts:** none. **Assets:** none.
- **Steps:**
  1. Install the dependencies (frontend decision; this is the first dependency change).
  2. Mount `<App/>`.
  3. Keep `harness.ts` until F1 works, then delete it.
- **Dependencies:** none.
- **Done when:**
  - `npm run dev` shows the React root;
  - `npm run build` passes;
  - `npm test` (329) stays green;
  - one PNG, one tilemap JSON and one audio file load in a **production** build.
- **CSP (critical; verify in M1):** the production CSP is `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; connect-src 'none'`. The dev CSP allows `localhost`, so problems only appear in builds.
  - Phaser 3's loader uses XHR for JSON, tilemaps and WebAudio, which `connect-src 'none'` blocks, and by default it turns images into `blob:` URLs, which `img-src` doesn't allow. This hasn't been verified, because Phaser isn't installed.
  - Intended safe pattern:
    - import assets through Vite;
    - `loader: { imageLoadType: 'HTMLImageElement' }`;
    - add tilemaps from imported JSON with `this.cache.tilemap.add(key, { format: Phaser.Tilemaps.Formats.TILED_JSON, data })`;
    - `audio: { disableWebAudio: true }`;
    - bundle fonts locally.
  - If it still fails, ask the backend owner to adjust `src/main/index.ts`. Don't add a CSP `<meta>` in the renderer.

**F1 — EngineStore and services**
- **Objective:** one store wrapping `GameEngine`, plus thin bridge services.
- **Inspect:** `src/core/engine.ts` (`CommandResult`, `EngineEvent`), `src/shared/bridge.ts`, `tests/docs-examples.test.ts`.
- **Create:** `state/engineStore.ts`, `state/useEngine.ts`, `services/ai.ts`, `services/persistence.ts`.
- **Contracts:** `GameState`, `CommandResult`, `EngineEvent`, `SignalBridge`.
- **Steps:**
  1. `newGame(input|profile|save)`.
  2. `dispatch(fn: (e) => CommandResult)` applies the result and emits events, including `badgeEarned`.
  3. Event-key de-duplication (§7).
  4. Scene-directive caching (§7).
  5. `tick(ms)`: accumulate Phaser `delta` and call `engine.tick` about every 100 ms. Each call deep-copies the state (measured ≈ 0.4 ms with 23 decisions).
- **Done when:** a unit test (Vitest) drives the store through `createGame` → `resolveEvent` → `executeAction` with no React or Phaser involved.

### Task reference (Phaser world: A-tasks; React UI: B-tasks; one owner, scheduled by the milestone table)

| Task | Milestone | Objective | Inspect | Create/modify | Contracts | Assets | Done when |
|---|---|---|---|---|---|---|---|
| **A1** Boot/Preload | M2 | Load assets by the IDs in §9 with a placeholder fallback | §9 | `game/config.ts`, `game/scenes/Boot.ts`, `Preload.ts`, `PhaserGame.tsx` | — | all (generated placeholders first) | A progress bar; missing IDs logged, not crashing |
| **A2** House map | M2 | Fixed layout; theme tileset swap; collision; anchors | `getWorldConfig()`, §4.2 | `assets/maps/house.tmj`, `game/data/layout.ts`, `game/scenes/House.ts` | `theme`, `interactables[]` | house tilesets | Both themes render the same collision; every interactable ID has an anchor |
| **A3** Player + interaction | M2/M3 | 4-direction movement at 90 px/s; 24 px prompts; E/Space → `interact` | §4.4 | `game/systems/PlayerController.ts`, `InteractionSystem.ts` | `interact`, `ActionOption` | player sprites | Walking into walls stops; the prompt appears at 24 px; interact opens a menu or event |
| **A4** NPCs | M6 | Household NPCs, dependents, pets | §4.3 | `game/systems/NpcSystem.ts` | `characters[]`, `npcCues` | NPC sprites | ≤ 3 NPCs placed; `NPC_M*` interact; dependents never interactable |
| **A5** SceneDirective renderer | M6 | Weather, lighting, flood overlay, effects, props, NPC cues, audio, transitions | [FRONTEND_BACKEND_CONTRACTS.md](../implementation/FRONTEND_BACKEND_CONTRACTS.md) | `game/systems/SceneDirectiveRenderer.ts`, `AudioDirector.ts` | `SceneDirective`, `suggestScene`, `mergeSceneSuggestion` | §9 effects, lighting, flood, props, audio | Re-applying the same directive changes nothing; outage never shows electric light; the flood overlay equals `directive.flood`; ambient audio restarts only on a key change |
| **A6** Other scenes | M6 | Shop, Street, Evacuation, HomeImpact, Aftermath; route `sceneChanged` | §2.4, §5.13 | `game/scenes/*.ts` | `SceneId`, `skipToNextMilestone` | shop/center/street tilesets | Each `sceneChanged` loads the right scene; a household in transit at landfall stays on STREET; a full run traverses them |
| **A7** Wellbeing indicator | M7 | Player wellbeing meter (not "health") plus a toast on change | §5.11 | `ui/hud/Wellbeing.tsx` | `player.wellbeing`, `wellbeingEvents` | icon | Shows `current/max`; a toast shows the rule `reason` when an event is appended |
| **A8** Performance | M10 | 60 fps on the GTX 1650 Ti laptop while the AI generates | — | — | — | — | No frame stalls while awaiting AI (all calls async) |
| **B1** App shell | M5 | Screen router S1–S13; Title; Loading | §3 | `app/App.tsx`, `ui/title/*`, `ui/loading/*` | `ai.status/onStatus`, `save.list` | — | Navigation works; loading proceeds on `ready` or `unavailable` |
| **B2** Q0 + onboarding | M5 | Render Q0, custom (Q1–Q8, Q2b) and random (R1–R4) from `ONBOARDING_QUESTIONS` | `src/shared/contracts/onboarding.ts` | `ui/onboarding/*` | `CustomOnboarding`, `RandomOnboarding`, `MAX_HOUSEHOLD_SIZE`, `createGame` | — | Exclusive and conditional rules enforced; a live Q3 total; backend `issues` shown per field; both paths start a game |
| **B3** Customization + review | M5 | Theme, player, appearance, minimum-budget challenge; review roster, exposure (fictional), budget | `getProfile()`, `getWorldConfig()` | `ui/onboarding/Customization.tsx`, `Review.tsx` | `Customization`, `HouseholdProfile` | character sprites | Choices reflected in the profile; minimum budget gives ₱800 |
| **B4** HUD | M7 | Clock, speed controls, phase, warning, cash, phone, go-bag, wellbeing (A7), AI badge | §5.11 | `ui/hud/*` | `GameState`, `setSpeed`, `getGoBagStatus` | HUD icons | Updates ≈ 4 Hz; critical-speed banner; landfall countdown only after reveal |
| **B5** Dialogs | M3/M4 | InteractionMenu, DiscoveryCard (M3); EventDialog (AI/fallback, ordered choices, ⚠ unsafe) (M4) | §4.4, §6.2, §7 | `ui/dialogs/*` | `buildScenarioRequest`, `generateScenario`, `getEventChoices`, `resolveEvent`, `ActionOption.kind` | UI kit | One dialog per event key; stale AI text discarded; discovery takes no game time |
| **B6** Inventory | M7 | House vs go-bag lists; missing go-bag categories | §5 items | `ui/inventory/*` | `state.house/goBag`, `ITEM_LABELS`, `missingGoBagItems` | item icons | Matches state after every action |
| **B7** Shop | M7 | Catalog, quantity, purchase, errors | §5 shop | `ui/shop/*` | `getShopCatalog`, `purchase`, `RETURN_HOME` | — | Prices and stock from the engine; errors shown; `pause('shop')` while open |
| **B8** Debrief + plan | M9 | Score and ending; categories; Handa breakdown; 12 badges with status; timeline; lessons; checklist (the plan); narration; `markPlanViewed` | `src/shared/contracts/debrief.ts`, §6.4 | `ui/debrief/*` | `evaluate`, `narrateDebrief`, `recordRun`, `markPlanViewed`, `getBadgeCatalog` | badge icons | The ending label and Handa badge are visually separate; "Not applicable" is neutral; the plan view triggers A10 |
| **B9** Badges + achievements | M3 (toast) / M8 | Screen with progress/target; unlock toasts from `newlyUnlocked`; mid-run badge toasts from `badgeEarned` (B06, §5.12) | §3 S12 | `ui/achievements/*` | `achievements.read`, `getAchievementCatalog` | achievement icons | Progress survives restart; each toast shows once |
| **B10** Saves and replay | M9 | Continue/save slots, delete profile, replay | [LOCAL_STORAGE_SETUP.md](../setup/LOCAL_STORAGE_SETUP.md) | `ui/menus/*` | `save.*`, `profile.*`, `loadGame`, `startRun` | — | Save → quit → continue restores state; replay keeps the household with a new seed |
| **B11** Settings | M9 | Volume, mute, text size | — | `ui/settings/*` | — (localStorage; gap G5) | — | Persists across restarts |

## 11. Testing

| Level | What | How |
|---|---|---|
| Backend contracts | Must stay green | `npm test` (329), `npm run typecheck` |
| Store (F1) | Store applies results, de-duplicates events, caches directives | Vitest in `src/renderer/**/__tests__` (add to `vitest.config.ts` include, coordinating with the backend owner) |
| Screens | S2–S4: valid and invalid inputs show the right errors. S7: Handa vs ending shown separately | Component tests or manual checklist |
| World | Collision; prompts at 24 px; scene routing; directive application is idempotent; outage lighting | Manual checklist per A-task |
| End to end | Launch → Custom → onboarding → customize → house → prepare (water, go-bag, windows) → check bulletin → share it (Bayanihan toast) → events through EV16 → debrief with 12 badge statuses → achievements (A08 progress) → replay; plus a late departure that crosses landfall (stays on STREET, arrives at EVACUATION, no EV10) | Manual run in `npm run dev` with the model **and** with `SIGNAL_LLM_DIR` set to a missing folder (fallback). Optionally Playwright for Electron (not installed) |
| Packaged | Same flow from `dist\win-unpacked\SignalNo5.exe`, offline | [WINDOWS_PACKAGING.md](../setup/WINDOWS_PACKAGING.md) |

## 12. Backend gaps and blockers affecting the frontend

| ID | Gap | Impact | Workaround / proposal |
|---|---|---|---|
| ~~BK-1~~ | **Fixed (`20d1f2d`):** late departures crossing landfall stay in transit (`STREET`), departures that would arrive after route closure are rejected, and EV10 is home-only | — | Nothing for the frontend beyond §2.4 routing |
| BK-2 | No tile coordinates or tilemap data (G3) | The frontend must author `layout.ts` and the map | Frontend-owned by design |
| BK-3 | No authored sentences for discovery results or for community-action results | The UI needs copy | Build from state (§6.3, §5.12); proposed templates in CONTENT_REVIEW §2 and §4 |
| BK-5 | No state subscription (G1), no autosave (G2), no settings store (G5) | Store and UI must handle these | §2.1, §7; save on `phaseChanged` |
| BK-7 | Playwright/E2E tooling not installed | No automated UI tests yet | Manual checklist, or add Playwright later |
| R-CSP | Phaser asset loading under the production CSP (`connect-src 'none'`, no `blob:` images) is unverified | Assets could fail only in packaged/production builds | Prove in M1 (F0); if it fails, the backend owner adjusts `src/main/index.ts` |

Nothing above blocks starting M1. R-CSP must be resolved in M1, before art and audio work.
