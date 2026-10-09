# Survey → GameState Mapping

## Onboarding v2 (current)

**Pipeline:** `CustomOnboarding` / `RandomOnboarding` → `buildFromOnboarding` (`src/core/household/onboarding.ts`). This converts the input into the established survey shape and reuses `buildHouseholdProfile` (one roster and validation implementation), then produces `HouseholdProfile` (+ `configMode`, `exposure`, `scenarioPreference`) → `createInitialState`.

| Q | Field | Profile effect | Gameplay effect |
|---|---|---|---|
| Q0 | `mode` | `configMode` | Replay and achievements (A09) |
| Q1 | `q1Housing` | `housing.floors` 1/2/3 (layout fixed; `type: detached`) | Window requirement for B09 (2/3/4), supply loss in floods (single floor), dialogue |
| Q2 | `q2SizeRange` + `q2ExactSize` | `size` (max 10) | Water target 12 L × size, food 3 × size |
| Q3 | `q3AgeCounts` | `members[]` (sex unspecified → seeded sprite) | Roster, NPCs, dependents, child supplies |
| Q4 | `q4Assistance` | `assistance.required` yes/no/**unknown** | Assistance objective, departure gate, B08 |
| Q5 | `q5MedicalSupplies` | `medical.essentialMedication` yes/no/**unknown/undisclosed** | yes → O_MEDICATION, B04. Unknown/undisclosed → medicine-cabinet discovery (O_MEDICAL_CHECK); B04 not applicable |
| Q6 | `q6Surroundings` | `exposure` standard/waterway/floodProne/both/unknown | Flood peak, onset, escalation, advisory timing (`EXPOSURE_PROFILES`) |
| Q7 | `q7Pets` | `pets.present` (prefer not to say → not present) | Pet area, pet supplies, B08 |
| Q8 | `q8Preparedness` | `preparedness.*` (provisional) | Starting go-bag, supplies, plan flags. **Scoring uses in-game state only** |
| — | `customization` | theme, player, appearance, `minimumBudgetChallenge` | Budget ₱1,500 by default, ₱800 with the challenge |
| R1 | `r1SizeRange` | seeded exact size | as Q2 |
| R2 | `r2PlayerAge` | the player's age group (counted in the size) | — |
| R3 | `r3OtherAgeGroups` | others drawn from the chosen groups (an adult is added if an adolescent would be the only carer of young children) | as Q3 |
| R4 | `r4Preference` | surprise (seeded) / balanced (standard or waterway, moderate budget) / challenging (both, ₱800) | Difficulty |

**Neutral defaults for fields that aren't asked (custom):**
- roof `notSure`, so roof work is **not** required;
- exits `one`, flood history `notSure`;
- no equipment or allergies recorded;
- no condition categories (diagnoses are never asked or generated).

---

## Legacy 26-question survey (deprecated, still accepted)

**Pipeline:** `SurveyResponses` → `buildHouseholdProfile` (`src/core/household/buildProfile.ts`) → `HouseholdProfile` v2 → `createInitialState` (`src/core/init/initialState.ts`) → `GameState`.

**Columns:**
- **Type:** S = single choice, M = multi choice, N = number.
- **Req.:** whether the answer is required in actual mode.

| Q | Field | Type | Req. | Validation / conditional | Profile field | Gameplay effect |
|---|---|---|---|---|---|---|
| 1 | `q1HouseholdSize` | S `1/2/3-4/5-6/7+` | ✓ | — | `size` (exact, from Q2) | Water target 12 L × size; food 3 × size; starting food |
| 2 | `q2AgeGrid` | N per age×{male,female,unspecified} | ✓ | Total must fall in the Q1 range | `members[]` | Roster, sprites (Boy/Girl/Mom/Dad), max 3 visible NPCs, infants as dependents; `CHILD_CARE` go-bag requirement, EV04/EV12 child variants |
| 3 | `q3Mode`, `q3RandomizeFields` | S, M | ✓ | `randomize` regenerates the listed sections | `mode` | Fictional or partial generation from the seed |
| 4 | `q4Assistance`, `q4AssistanceCount` | S, N | ✓ | Count required if yes; 1..size | `assistance` | `ARRANGE_ASSISTANCE` action; EV03/EV08/EV12 assistance variants; departure blocked until arranged; +1 h travel; O_ASSISTANCE objective |
| 5 | `q5Pets`, `q5PetTypes` | S, M | ✓ | Types required if yes | `pets` | `PET_AREA` interactable, pet shop stock, pet go-bag requirement, EV12 pet variant, O_PETS |
| 6 | `q6Housing` | S | ✓ | — | `housing.type` | Apartment/condo: no sandbag gate or sandbags; dialogue context |
| 7 | `q7Floors` | S | ✓ | — | `housing.floors` | Multi-floor: supplies not lost to flooding; shelter severity |
| 8 | `q8Surroundings` | S | ✓ | — | `housing.surroundings` | Authored peak flood severity; flood-prone variants; evacuation advisory authored; O_FLOOD_PREP |
| 9 | `q9FloodHistory` | S | ✓ | — | `housing.floodHistory` | +1 flood severity level; flood-prone |
| 10 | `q10Roof` | S | ✓ | — | `housing.roof` | `SECURE_ROOF` applies unless concrete; roof damage; shelter condition |
| 11 | `q11Exits` | S | ✓ | — | `housing.exits` | Stored (dialogue/context); no MVP rule yet |
| 12 | `q12MedicalCondition` | S | — | prefer-not-to-say → `undisclosed` | `medical.conditionPresent` | Never scored or penalised |
| 13 | `q13ConditionCategories` | M | — | Only if Q12 = yes | `medical.conditionCategories` | **Not sent to the AI**; stored for local context only |
| 14 | `q14EssentialMedication` | S | — | — | `medical.essentialMedication` | Medication container interactable, refill stock, go-bag requirement, EV04/EV05 variants, O_MEDICATION (only if "yes") |
| 15 | `q15Allergies`, categories | S, M | — | Categories only if yes | `medical.allergies*` | Stored; no MVP rule (deferred) |
| 16 | `q16Equipment` | M | — | none/notSure/preferNotToSay exclusive | `medical.equipment` | Powered equipment → EV05/EV12 variants, O_POWERED_EQUIPMENT |
| 17 | `q17WarningAssistance` | S | — | — | `medical.warningAssistance` | O_WARNING_SUPPORT objective |
| 18 | `q18GoBag` | S | ✓ | — | `preparedness.goBag` | Starting go-bag: complete = all essentials, partial = every other one, none = empty |
| 19 | `q19Supplies` | M | — | none/notSure exclusive | `preparedness.supplies` | Starting items (water 12 L vs 6 L, food 3 vs 1 per person, flashlight, radio, …); waterproof documents → `DOCUMENTS_PROTECTED` |
| 20 | `q20EvacuationPlan` | S | ✓ | — | `preparedness.evacuationPlan` | yes → `EVACUATION_PLAN_READY` |
| 21 | `q21EvacuationCenterKnown` | S | ✓ | — | `preparedness.evacuationCenterKnown` | yes → destination known (no +1.5 h travel); O_DESTINATION |
| 22 | `q22CommunicationPlan` | S | ✓ | — | `preparedness.communicationPlan` | yes → `COMMUNICATION_PLAN_READY`, `MEETING_POINT_KNOWN` |
| 23 | `q23WarningSources` | M | — | noConsistentSource exclusive | `preparedness.warningSources` | Stored (dialogue context); no MVP rule |
| 24 | `q24BackupPower` | M | — | none/notSure exclusive | `preparedness.backupPower` | flashlight → `FLASHLIGHT`, rechargeable → `POWER_BANK`; EV09 variant |
| 25 | `q25PlayerMemberIndex`, `q25Appearance`, `q25ClothingColor` | N, S | — | Index < size; colour only with customColor | `playerMemberId`, `appearance` | Playable character; default = first adult |
| 26 | `q26Theme` | S `modern/traditional` | ✓ | — | `theme` | Cosmetic only (never scored) |
| — | `budgetTier` | S | — | default `moderate` | `budgetTier` | Starting cash ₱800 / ₱1,500 / ₱3,000 |

**Fictional mode:** only `q3Mode` is required. Q25, Q26 and the budget are kept if given; every other section is generated from the seed.

**Privacy:**
- Diagnoses and medication names are never asked.
- Condition categories, sex and allergy details are never sent to the local model. `ScenarioAIRequest.household` contains only size, visible member roles, dependents, assistance yes/no, pets, home type, floors and theme.
- The profile is stored locally and can be deleted (`window.signal.profile.remove()`).
