# Requirement Traceability

Status: ✅ implemented + tested · 🟡 partial · ⏳ deferred · ⛔ deprecated (see SPEC_RECONCILIATION). Tests are in `tests/`.

## Complete Game Design (GD)

| Source | Requirement | Backend module | Status | Test |
|---|---|---|---|---|
| GD §2 | Player journey: setup → preparation → warning → evacuation/impact → aftermath → debrief → replay | `core/engine.ts`, `content/storm.ts` | ✅ | `clock.test` phases; `storm.test` aftermath |
| GD §2 | Core loop: interact → available? → action → time/state → decision log → event → engine variant → AI/fallback → engine choices | `engine.ts` (`interact`, `executeAction`, `resolveEvent`) | ✅ | `actions.test`, `ai.test` |
| GD §3 | Hybrid clock: 240 s/h at 1×, speeds 1–32×, fixed action costs, pause reasons, chronological milestones, critical → 1× | `engine.ts` `tick`/`advanceTo`/`processDue` | ✅ | `clock.test` (6 speeds, fixed cost, pause, crossing, critical stop) |
| GD §3 | Model loading doesn't consume time | `pause('loading')` | ✅ | `clock.test` |
| GD §4 | Survey → roster, needs, cash; ≤3 visible NPCs; Boy/Girl/Mom/Dad templates; no risk from sex | `household/buildProfile.ts` | ✅ | `household.test` |
| GD §4 | Budget tiers ₱800/1,500/3,000 | `init/initialState.ts` | ✅ | `init.test` |
| GD §5 | Scenes, house areas, interactables | `content/interactables.ts`, `getWorldConfig()` | ✅ | `actions.test`, `shop.test` |
| GD §5 | Movement 16 px / 90 px/s / 24 px | frontend-owned | — | — |
| GD §6 | Inventory, go-bag, applicable requirements, water 12 L/person, food 3/person | `selectors.ts`, `content/items.ts` | ✅ | `init.test`, `actions.test` |
| GD §7 | Shop: 2 h round trip, catalog, stock, atomic purchase, insufficient funds, closure, late price | `engine.purchase`, `content/shop.ts` | ✅ | `shop.test` |
| GD §8 | 19 preparation actions with costs and prerequisites; no unsafe outdoor tasks after conditions turn | `content/actions.ts` | ✅ | `actions.test` |
| GD §9 | Storm timeline (h0/8/16/24/32, advisory, outage, closures, landfall, +3, +6, days 1–3), seed variation, acceleration 0/4/8 | `content/storm.ts` | ✅ | `clock.test` (acceleration), `storm.test` |
| GD §10 | EV01–EV16 with engine-selected variants (incl. the GD variant table) | `content/events.ts` | ✅ | `storm.test` variants |
| GD §11 | Evacuation branching: advisory, assistance, destination, route, travel, arrival, home branch | `actions.ts` FOLLOW_EVACUATION, `storm.ts`, `selectors.householdLocation/routeClosureMinute` | ✅ | `storm.test`, `evacuation-timing.test` |
| R23 | Bayanihan community assistance (B06) and Whole Barangay (A08) | `content/community.ts`, `evaluation/community.ts`, `evaluation/badges.ts`, `evaluation/achievements.ts`, `migrations.ts` | ✅ | `community.test`, `docs-examples.test` 6.5 |
| GD §12 | Authored hazard states, shelter condition, property/supply outcomes; no numeric formulas | `storm.ts` `applyPeak`/`applyImpactEnd` | ✅ | `storm.test` |
| GD §13 | Three-day aftermath with resource review, updates, reflection | `storm.ts`, EV14–16 | ✅ | `storm.test` |
| GD §14 | 6 competencies (20/20/15/20/15/10), reweighting, no demographic penalty, endings 85/60, Na-rescue authored | `evaluation/*` | ✅ | `evaluation.test` |
| GD §15 | Badges B01–B10, debrief elements | `content/badges.ts`, `content/findings.ts` | ✅ | `evaluation.test` |
| GD §16 | AI director: engine owns event/variant/actions/facts; AI narrates; grounding guard; fallback; 2048 ctx, 220 tokens, 12 s, warm-up, concurrency 1 | `core/ai/*`, `main/ai/aiService.ts` | ✅ | `ai.test`, `main/aiService.test`, packaged self-test |
| Add-on | AI-directed scene and environmental variation: deterministic directive (weather, lighting, flood, props, cues, audio, mood, transition) + optional validated AI suggestions that never override state | `src/core/scene/*`, `shared/contracts/scene.ts`, `AIService.suggestScene` | ✅ | `scene.test`, `main/aiService.test`, real-model self-test |
| Directive 2026-10-09 | Onboarding v2 (Q0, 8 custom, 4 random), seeded and reproducible | `core/household/onboarding.ts`, `contracts/onboarding.ts` | ✅ | `onboarding.test` |
| Directive 2026-10-09 | Environmental exposure difficulty (5 profiles, flood timing) | `content/storm.ts` `EXPOSURE_PROFILES` | ✅ | `exposure.test` |
| Directive 2026-10-09 | Player wellbeing (2 verified penalties) | `core/wellbeing.ts` | ✅ | `wellbeing.test` |
| Directive 2026-10-09 | Badges B01–B12, Handa ≥ 85% (boundary, attainability for all profiles) | `evaluation/badges.ts`, `evaluation/handa.ts` | ✅ | `badges.test` (mutation-checked) |
| Directive 2026-10-09 | Achievements A01–A10 + persistence | `evaluation/achievements.ts`, `SaveStore` | ✅ | `achievements.test`, `integration.test` |
| GD §17 | Persistence (saves, badges, profile; replay resets run) | `main/persistence/saveStore.ts`, `startRun` | ✅ | `main/saveStore.test`, `clock.test` save/load |
| GD §17 | Packaged `.exe` offline | `scripts/pack.mjs`, `main/index.ts --self-test` | 🟡 runs packaged without the CUDA toolkit on PATH; airplane-mode run still pending; unsigned `.exe` can be blocked by Smart App Control | self-test 2026-10-09, 2026-10-10 (with frontend) |
| GD §17 | Acceptance matrix: four-member roster ✅, two-story ✅, theme ✅, collision (frontend), bag prompt ✅, water ✅, buy ✅, funds ✅, 32× ✅, milestone at 32× ✅, dialogue pauses ✅, 1.5 h action ✅, medical event ✅, outage variants ✅, advisory choices ✅, unsupported AI fact ✅, model unavailable ✅, deterministic debrief ✅, badge ✅, replay 🟡 (`startRun`), packaged offline 🟡 | — | — | various |

## Game Settings (GS): 17 categories

| § | Category | Status | Notes |
|---|---|---|---|
| 1 | Core game state | ✅ | `GameState` v2. `difficulty` and `replayCount` are deferred; `endingType` lives in the evaluation |
| 2 | Time | ✅ / ⛔ | GD clock active. 4 s/8 s rates deprecated (R1). Adult/sleep modifiers deferred (R5). `barangayTravelTime` 1.5 h active |
| 3 | Household | ✅ | `memberHealth` deprecated (R4). `memberLocation` derived from the shelter |
| 4 | House and environment | ✅ | `exitCount` stored only |
| 5 | Medical and accessibility | ✅ / ⏳ | Medication as flags (R15). Allergy rules deferred |
| 6 | Resources and inventory | ✅ | `hasWhistle`, `hasEmergencyCash` are items. `meetingPointKnown` is a flag |
| 7 | Actions | ✅ | All 19 + event choices |
| 8 | Shop | ✅ | Late price rule configurable (R7) |
| 9 | Storm | ✅ / 🧪 | `windFactor` and `floodVariation` replaced by authored severity (experimental) |
| 10 | Flood | 🧪 | Numeric heights experimental. Severity categories active |
| 11 | Health and hazard | ⛔ / 🧪 | Numeric damage deprecated. `shelterCondition`/`householdSafetyStatus` active as categories |
| 12 | Evacuation | ✅ | Walking 2 h, unknown destination +1.5 h, assistance +1 h (age penalty deprecated). Motorcycle/fuel deferred |
| 13 | Property and supply loss | ✅ | Categorical. Supplies halved when flooded without raised storage on one floor |
| 14 | Aftermath | ✅ | Health penalties deprecated. Resource review and findings active |
| 15 | Results and achievements | ✅ | Competency scoring replaces the "starts at 100" penalty model (R3) |
| 16 | Debrief and local AI | ✅ | 26 findings defined (covers the GS gap). AI config in `main/config.ts` |
| 17 | Visual, character, replay | ✅ | Sprite and theme data via `getWorldConfig`; rendering is frontend-owned |

## Household Form (HF)
All 26 questions are mapped in [SURVEY_TO_GAMESTATE_MAPPING.md](SURVEY_TO_GAMESTATE_MAPPING.md). Status ✅ (`household.test`, `init.test`).
