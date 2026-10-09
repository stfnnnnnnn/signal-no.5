# Spec Reconciliation

Sources: **GD** = `docs/specs/SIGNAL_NO_5_COMPLETE_GAME_DESIGN.md` (v3.0) · **GS** = `docs/specs/SIGNAL_No5_Game_Settings_and_Configuration_Variables_Formatted.md` (v2.0) · **HF** = `docs/specs/SIGNAL_No5_Household_Health_Environmental_Character_Configuration_Form_Formatted.md` · **PC** = `project_context.md` · **AL** = `docs/architecture/ARCHITECTURE_LOCK.md`.

**Precedence:** the latest explicit decision wins. GD (behaviour) > GS (variables and defaults) > PC (earlier MVP scope). HF is authoritative for survey wording and options. AL is authoritative for stack and process boundaries.

## 1. Conflicts and resolutions

| # | Topic | Conflict | Resolution |
|---|---|---|---|
| R1 | Clock | GS: 4 s/h (preparation), 8 s/h (landfall). GD: 240 s/h at 1×, ×1–32. | **GD hybrid clock.** 240 real s = 1 game h at 1×; scales 1/2/4/8/16/32. Fixed action costs never scale. GS clock rates are **deprecated**. |
| R2 | Variants and actions | PC v1: AI may pick a variant or a subset of actions. | **Engine selects the event and variant, and owns the exact ordered action list** (approved P1/P2). The AI response must echo both exactly. |
| R3 | Scoring and endings | GS: score starts at 100 minus penalties; endings by lowest health. GD: competency points out of 100. | **GD competency scoring** (6 categories, 20/20/15/20/15/10). Non-applicable objectives are excluded. Endings: Handa ≥ 85, Nakaraos ≥ 60, otherwise Nahirapan. Na-rescue is an authored outcome only. Health-based endings are **deprecated**. |
| R4 | Flood, health and loss formulas | GS §10, §11, §13, §14 give numeric flood heights, damage per hour, age multipliers, loss thresholds. | **Not active in the MVP.** Authored severity states only (None/Low/Moderate/Severe), selected by the scenario. Retained as **experimental**, for traceability only. Age multipliers are **deprecated**: we never derive vulnerability from age or sex. |
| R5 | Time modifiers | GS: −20% with an additional adult, +25% for sleep deprivation. | **Deferred.** All action costs are fixed per GD §8. |
| R6 | Dam rumor | GS: 30% probability, +0.40 m flood. | The rumor event (EV07) is a **seed-enabled authored event**. It never changes the physical hazard (GD §9: "Rumors do not determine physical hazards"). |
| R7 | Late price rule | GS: ×1.5 after hour 24. GD: "optional original workbook rule". | **Configurable, default ON** (×1.5 at hour ≥ 24). It drives the GS §16 "bought after price increase" debrief finding. |
| R8 | Survey | PC §7: 5 questions. HF: 26 questions. | **HF 26 questions.** PC §7 is superseded once PC is updated. |
| R9 | Phases | PC/AL: `calm, preparation, escalation, decision, resolution, debrief`. GD: Preparation/Warning/Impact/Aftermath + scene stages. | `GamePhase` = `setup, preparation, warning, evacuation, impact, aftermath, debrief, complete`, aligned with GD §2. |
| R10 | Event and badge catalogs | PC §10/§11: 11 events and 10 English badges. GD §10/§15: EV01–EV16 and B01–B10 (Filipino names). | **GD catalogs.** These meet the "≥ 10 events, ≥ 10 badges" decision. |
| R11 | Scenes | PC: house-only MVP; street optional. | GD: HOUSE, SHOP, EVACUATION, HOME_IMPACT and AFTERMATH are required; STREET and BARANGAY are optional. The backend models scene IDs. The frontend decides how to render them. |
| R12 | Themes | PC: warm/cool/muted. | **GD/HF: `modern` / `traditional` Filipino.** Cosmetic only. |
| R13 | Contract `HouseholdProfile` | PC §15 v1 has 5 fields. | **`HouseholdProfile` schemaVersion 2**: same name, superset structure derived from HF. `ScenarioAIRequest.household` becomes a **minimised AI summary** (no medical categories). Migration: v1 has no consumers outside the spike. |
| R14 | Model | GD §16: Qwen3-4B (provisional). The guardrail re-test hasn't been run. | The adapter is model-agnostic. The model path comes from config. Grounding guard + fallback are mandatory for either model. |
| R15 | Medication target | GS: 3 days start, 7-day target (workbook). | **Experimental.** Medication is tracked as a readiness flag (`medicationPacked`, `medicalContinuityPlan`) and never as day counts, to avoid medical prescriptions. |
| R16 | Household-size ranges | HF Q1 uses ranges. | Exact size = sum of the Q2 age grid, which must fall within the Q1 range (validation error otherwise). |

| R17 | Badges | GD §15 B01–B10 (Handa ang Bag!, Tubig at Pagkain, Balitang Beripikado, Pamilyang Handa, Ligtas na Dokumento, May Plano Tayo, Walang Maiiwan, Handa sa Dilim, Tamang Desisyon, Signal No. 5 Master) | **Replaced by the approved 12-badge catalog** B01 Handa … B12 Powered Up (`src/core/content/badges.ts`). Badge IDs were reused with new meanings, so `badges.json` moved to schema v2 and v1 files are reset (there was no real player data). The old definitions are kept in this row for traceability. |
| R18 | Onboarding | HF 26 questions (R8) | **Onboarding v2:** Q0 mode + 8 custom questions or 4 random steps (`src/shared/contracts/onboarding.ts`). The 26-question path stays accepted for compatibility (deprecated). Apartment and condo housing were removed from new onboarding. |
| R19 | Health | R4 deprecated numeric health | **Limited reintroduction:** player-only *wellbeing* (0–100, fictional), changed by exactly two verified unsafe-decision rules (−15 advisory ignored with a severe flood at home; −10 remained in an unsafe room). No household-member values and no resource-health simulation. Used by Handa (≥ 85%). |
| R20 | Flood difficulty | Flood severity from surroundings + history ±1 | **Exposure profiles** (`EXPOSURE_PROFILES`): standard/waterway/floodProne/both/unknown with fixed peak, onset, escalation and advisory lead. Fictional. |
| R21 | Endings vs Handa | — | Score endings (Handa ≥ 85 / Nakaraos 60–84 / Nahirapan < 60) stay **independent** of the Handa badge. |
| R22 | Water/food objectives | Measured at landfall | Measured as **prepared stores at heavy rain** (evacuees carry only part of them), so Handa stays attainable for households that correctly evacuate. |

## 2. Variable status keys (used in the traceability matrix)
- **Active:** stored and mutated by the engine.
- **Derived:** computed by selectors, never stored.
- **Static:** constant config/content.
- **Experimental:** defined, not used by MVP rules.
- **Deprecated:** superseded (see R1–R5).
- **Deferred:** post-hackathon.

## 3. Missing definitions (decided with defaults; reversible)
| Gap | Default chosen |
|---|---|
| Budget tier isn't asked in HF | `budgetTier` is a setup option, default `moderate` (₱1,500). Fictional and randomised modes pick it from the seed. |
| GS §16 lists only 5 of ~16 debrief rules | **16 findings** defined in `src/core/content/findings.ts`, covering every scoring objective plus the GS examples. Marked *needs content review*. |
| Starting supplies when the survey says a supply exists | Present supplies map to concrete starting items: water 6 L (GS start) or 12 L if water is checked; food 1 person-day per member, or 3 if food is checked. |
| Shop stock quantities | 3 of each item; water and food 6. |
| Prices for batteries/hygiene/pet/child-care (GD "TBD") | ₱80 / ₱150 / ₱180 / ₱220, fictional. |
| Event priorities when several milestones coincide | Earlier time first. Then a fixed priority: advisory > evacuation > hazard > dilemma > reminder. |
| Safety guidance text | All reviewed fallback and lesson text is **placeholder pending review** against PAGASA/NDRRMC/PRC (PC §11). The engine stores `safetyRuleId` per action so the text can be swapped without code changes. |

## 4. Genuine blockers
None for the backend. The open items below don't block code:
- Qwen3-4B vs 1.7B grounding re-test (affects config only).
- Safety-content review (affects content text only).
- `project_context.md` Appendix A edits (documentation).
