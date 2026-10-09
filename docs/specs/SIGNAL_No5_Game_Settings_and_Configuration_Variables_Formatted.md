# SIGNAL No. 5 — Game Settings and Configuration Variables

**Revised Game Logic Specification · Version 2.0**

## Purpose and Scope

The following 17 sections define the game-state categories, variables, default values, conditions, and purposes based on the game logic workbook, the finalized household configuration questionnaire, and the revised gameplay flow.

This version incorporates the pre-disaster shop, 48-hour preparation period, interactive 8-bit exploration, household customization, typhoon branching, evacuation, aftermath, local AI debrief, and replay system.

Numerical values inherited from the original workbook are retained where applicable. Additional settings are identified as new configurations. Hazard and health calculations are fictional gameplay parameters, not scientifically validated predictions.

## Table of Contents

1. [Core Game State](#1-core-game-state)
2. [Time Configuration](#2-time-configuration)
3. [Household Configuration](#3-household-configuration)
4. [House and Environmental Configuration](#4-house-and-environmental-configuration)
5. [Medical and Accessibility Configuration](#5-medical-and-accessibility-configuration)
6. [Resource and Inventory Configuration](#6-resource-and-inventory-configuration)
7. [Player Actions and Preparation Tasks](#7-player-actions-and-preparation-tasks)
8. [Shop and Purchasing Configuration](#8-shop-and-purchasing-configuration)
9. [Storm Configuration](#9-storm-configuration)
10. [Flood Configuration](#10-flood-configuration)
11. [Health and Hazard Configuration](#11-health-and-hazard-configuration)
12. [Evacuation Configuration](#12-evacuation-configuration)
13. [Property and Supply Loss Configuration](#13-property-and-supply-loss-configuration)
14. [Aftermath Configuration](#14-aftermath-configuration)
15. [Results, Scoring, and Achievement Configuration](#15-results-scoring-and-achievement-configuration)
16. [Debrief and Local AI Configuration](#16-debrief-and-local-ai-configuration)
17. [Visual, Character, Interaction, and Replay Configuration](#17-visual-character-interaction-and-replay-configuration)

---

## 1. Core Game State

| Category | Variable | Default / Configuration | Purpose |
|---|---|---|---|
| Game | `gamePhase` | `Setup` | Current stage of simulation |
| Game | `gameStatus` | `Active` | Active, completed, or early ending |
| Game | `currentHour` | `0` | Current simulated time |
| Game | `landfallHour` | `48` | Scheduled typhoon landfall |
| Game | `stormSeed` | Random integer | Reproducible storm variation |
| Game | `difficulty` | `Standard` | Optional gameplay difficulty |
| Game | `actionLog` | Empty array | Records completed player actions |
| Game | `decisionHistory` | Empty array | Records decisions and consequences |
| Game | `currentLocation` | `House` | Current playable scene |
| Game | `householdProfile` | Survey-derived | Household configuration |
| Game | `scenarioId` | Generated ID | Identifies current scenario |
| Game | `eventHistory` | Empty array | Records triggered scenario events |
| Game | `simulationComplete` | `False` | Determines whether gameplay has ended |
| Game | `endingType` | `None` | Records the final outcome |
| Game | `replayCount` | `0` | Tracks completed playthroughs |
| Game | `saveSlot` | `Default` | Local game progress storage |

## 2. Time Configuration

| Category | Variable | Value / Default | Purpose |
|---|---|---|---|
| Preparation | `preparationClockRate` | 4 real seconds / game hour | Preparation clock progression |
| Landfall | `landfallClockRate` | 8 real seconds / game hour | Clock progression during typhoon impact |
| Time | `initialHour` | `0` | Starting simulated hour |
| Time | `defaultLandfallHour` | `48` | Default landfall schedule |
| Time | `landfallAcceleration` | 0, 4, or 8 hours | Randomized advancement of landfall |
| Time | `accelerationRevealHour` | `24` | Reveals updated landfall timing |
| Time | `menuPausesTime` | `True` | Pauses time during dialogue and menus |
| Time | `actionTimeCost` | Action-dependent | Time consumed by player actions |
| Time | `additionalAdultTimeModifier` | −20% | Original assistance-based task modifier |
| Time | `sleepDeprivationModifier` | +25% | Original fatigue-related task modifier |
| Time | `shopTravelTime` | 2 game hours | Time required for a shopping trip |
| Time | `barangayTravelTime` | 1.5 game hours | Time required to visit barangay hall |
| Time | `aftermathDuration` | 3 days | Post-typhoon simulation period |
| Time | `clockPaused` | `False` | Current pause status |
| Time | `timeRemaining` | Calculated | Remaining time before landfall |

## 3. Household Configuration

| Category | Variable | Values / Configuration | Purpose |
|---|---|---|---|
| Household | `householdSize` | Exact integer; survey categories 1, 2, 3–4, 5–6, 7+ | Number of household members |
| Household | `householdMode` | Actual / Fictional / Randomized | Household profile-generation mode |
| Household | `ageGroup` | 0–4 / 5–12 / 13–17 / 18–35 / 36–59 / 60+ | Age classification |
| Household | `ageGroupCounts` | Counts per age category | Household age distribution |
| Household | `sex` | Male / Female / Unspecified | Sprite presentation |
| Household | `assistanceRequired` | Yes / No / Unknown | Evacuation-assistance requirements |
| Household | `assistanceCount` | Integer | Number of members requiring assistance |
| Household | `petsPresent` | Boolean | Pet-related preparedness |
| Household | `petTypes` | Dog / Cat / Bird / Other | Animal representation and supplies |
| Household | `selectedPlayer` | Household member ID | Playable character |
| Household | `npcRoster` | Household member IDs | NPC generation |
| Household | `visibleNpcLimit` | `3` | Maximum representative NPCs in house |
| Household | `memberLocation` | Room / Upstairs / Evacuation center / Other | Household member tracking |
| Household | `memberHealth` | 0–100 | Original numerical health mechanic |
| Household | `householdReady` | `False` | Overall preparedness status |
| Household | `membersAccountedFor` | `False` | Household coordination status |
| Household | `familyMeetingCompleted` | `False` | Emergency planning interaction |

## 4. House and Environmental Configuration

| Category | Variable | Values / Configuration | Purpose |
|---|---|---|---|
| Housing | `housingType` | Detached / Townhouse / Apartment / Condominium / Temporary / Other | Housing context |
| Housing | `floorCount` | 1 / 2 / 3+ | Number of floors |
| Environment | `environmentType` | Residential / Coastal / Riverside / Low-lying / Hillside / Other | Surrounding environment |
| Environment | `floodHistory` | Never / Rarely / Occasionally / Frequently / Unknown | Previous flooding experience |
| Housing | `roofType` | Metal / Concrete / Tile / Lightweight / Other | Roofing configuration |
| Housing | `exitCount` | One / Multiple / Unknown / No identified route | Exit availability |
| Housing | `windowsBoarded` | `0` | Number of prepared windows |
| Housing | `roofSecured` | `False` | Roof preparation status |
| Housing | `looseItemsSecured` | `False` | Loose-object preparation |
| Housing | `gateSandbagged` | `False` | Gate preparation |
| Housing | `belongingsLocation` | Floor / Raised / Upstairs | Property placement |
| Housing | `documentsProtected` | `False` | Important document protection |
| Housing | `propertyDamage` | None / Minor / Major | Property condition |
| Environment | `visualTheme` | Modern Filipino / Traditional Filipino | House appearance |
| Environment | `houseLayoutId` | Fixed layout ID | Reusable floor plan |
| Environment | `weatherState` | Clear / Rain / Heavy rain / Typhoon | Weather appearance |
| Environment | `floodOverlay` | None / Low / Moderate / Severe | Floodwater rendering |
| Environment | `powerAvailable` | `True` | Electricity availability |
| Environment | `tapWaterAvailable` | `True` | Water source availability |
| Environment | `roadsClear` | `True` | Route and travel availability |

## 5. Medical and Accessibility Configuration

| Category | Variable | Values / Configuration | Purpose |
|---|---|---|---|
| Medical | `medicalConditionPresent` | Yes / No / Unknown / Undisclosed | Medical preparedness context |
| Medical | `conditionCategories` | Respiratory / Cardiovascular / Metabolic / Kidney / Neurological / Musculoskeletal / Sensory / Cognitive / Mental health / Other | Relevant scenario categories |
| Medical | `essentialMedicationRequired` | Boolean / Unknown | Medication preparedness |
| Medical | `medicationDays` | Numeric | Available medication duration |
| Medical | `allergiesPresent` | Boolean / Unknown | Allergy-related preparedness |
| Medical | `allergyCategories` | Food / Medication / Environmental / Other | Relevant precautions |
| Medical | `mobilityAidRequired` | Boolean | Mobility equipment |
| Medical | `electricityDependentEquipment` | Boolean | Backup power requirements |
| Medical | `refrigeratedMedication` | Boolean | Medication storage requirements |
| Medical | `respiratoryEquipment` | Boolean | Respiratory equipment |
| Medical | `glucoseMonitoringSupplies` | Boolean | Medical monitoring supplies |
| Accessibility | `warningAssistanceRequired` | Boolean / Unknown | Accessible emergency communication |
| Medical | `medicalSuppliesReady` | `False` / Survey-derived | Medical preparedness |
| Medical | `medicationPacked` | `False` | Medication included in go-bag |
| Medical | `medicalContinuityPlan` | None / Partial / Complete | Medical continuity preparedness |

## 6. Resource and Inventory Configuration

| Category | Variable | Default / Value | Purpose |
|---|---|---|---|
| Cash | `startingCash` | ₱800 / ₱1,500 / ₱3,000 | Starting purchasing capacity |
| Cash | `currentCash` | Starting cash | Remaining money |
| Phone | `phoneBattery` | 55% | Communication resource |
| Water | `startingWater` | 6 L | Initial water inventory |
| Water | `waterRequirement` | 12 L × household size | Workbook's three-day planning quantity |
| Food | `startingFood` | 1 person-day per member | Initial food inventory |
| Food | `foodRequirement` | 3 person-days × household size | Three-day food planning |
| Medication | `startingMedication` | 3 days | Original medication inventory |
| Medication | `medicationTarget` | 7 days | Original workbook target |
| Inventory | `hasTools` | `False` | Tool availability |
| Inventory | `hasFlashlight` | Survey-derived | Emergency lighting |
| Inventory | `hasPowerBank` | Survey-derived | Backup phone charging |
| Inventory | `hasRadio` | Survey-derived | Emergency information |
| Inventory | `hasFirstAidKit` | Survey-derived | First-aid preparedness |
| Inventory | `hasFuel` | `False` | Transportation resource |
| Inventory | `hasWhistle` | Survey-derived | Emergency signaling |
| Inventory | `hasBatteries` | Survey-derived | Battery supply |
| Inventory | `hasEmergencyCash` | Survey-derived | Emergency funds |
| Inventory | `hasPetSupplies` | Survey-derived | Pet preparedness |
| Inventory | `hasChildCareSupplies` | Survey-derived | Child-care preparedness |
| Preparedness | `goBagReady` | Survey-derived | Emergency bag status |
| Preparedness | `evacuationPlanReady` | Survey-derived | Evacuation planning |
| Preparedness | `meetingPointKnown` | Survey-derived | Household coordination |
| Preparedness | `evacuationCenterKnown` | Survey-derived | Destination awareness |
| Inventory | `purchasedItems` | Empty array | Records purchases |
| Inventory | `collectedItems` | Empty array | Records collected objects |

## 7. Player Actions and Preparation Tasks

| Category | Action | Time Cost | Prerequisite | Effect |
|---|---|---:|---|---|
| Tools | Take tools | 0.25 h | Garage | Tools acquired |
| Windows | Board window | 1.5 h each | Tools, safe conditions | Window-preparation count increases |
| Roofing | Secure roof | 3 h | Tools, safe conditions | Roof preparation completed |
| Household | Secure loose items | 0.5 h | Safe conditions | Loose objects secured |
| Water | Fill containers | 0.5 h | Tap water available | +15 L, maximum twice |
| Water | Fill drum | 1 h | Garage, tap water | +60 L |
| Go-bag | Pack emergency bag | 1.5 h | Accessible supplies | Go-bag status updated |
| Phone | Charge phone | 2 h | Electricity available | Battery replenished |
| Documents | Protect documents | 0.5 h | Documents accessible | Documents protected |
| Belongings | Raise belongings | 2 h | Suitable raised storage | Belongings relocated |
| Planning | Family meeting | 0.5 h | Household available | Coordination flag |
| Information | Check official bulletin | 0.5 h | Phone or radio | Updated typhoon information |
| Flood preparation | Sandbag gate | 1.5 h | Gate, safe conditions | Gate preparation completed |
| Shopping | Visit shop | 2 h | Shop open, roads clear | Shop interaction |
| Coordination | Visit barangay hall | 1.5 h | Roads clear | Barangay information |
| Medical | Pack essential medications | Action-dependent | Supplies available | Medication readiness updated |
| Accessibility | Arrange evacuation assistance | Action-dependent | Relevant household need | Assistance arrangement updated |
| Pets | Prepare pet supplies | Action-dependent | Pets present | Pet preparedness updated |
| Communication | Establish communication plan | 0.5 h | None | Communication plan updated |

## 8. Shop and Purchasing Configuration

| Category | Variable / Item | Default / Price | Effect / Purpose |
|---|---|---|---|
| Shop | `shopOpen` | `True` | Shop availability |
| Shop | `shopVisitCount` | `0` | Shopping trips completed |
| Shop | `shopTravelTime` | 2 h | Time consumed by travel |
| Shop | `shopPriceMultiplier` | 1.0 | Current price multiplier |
| Shop | `shopStock` | Item-dependent | Available inventory |
| Shop | `shopClosureHour` | Scenario-dependent | Shop closing time |
| Shop | `shopPriceIncreaseHour` | 24 | Original workbook price-change trigger |
| Shop | `latePriceMultiplier` | 1.5 | Original fictional price increase |
| Water | Water jug | ₱100 | +20 L |
| Food | Food pack | ₱280 | +6 person-days |
| Medical | Medicine refill | ₱350 | Additional prescribed medication supply |
| Lighting | Flashlight | ₱120 | Flashlight acquired |
| Power | Power bank | ₱450 | Power bank acquired |
| Medical | First-aid kit | ₱200 | First-aid kit acquired |
| Equipment | Tools | ₱250 | Tools acquired |
| Communication | Radio | ₱250 | Radio acquired |
| Transportation | Fuel | ₱150 | Fuel acquired |
| Shop | `remainingCash` | Calculated | Purchasing budget |
| Shop | `totalSpent` | `0` | Total expenditure |
| Shop | `purchasedItems` | Empty array | Purchase history |

## 9. Storm Configuration

| Category | Variable | Value / Range | Purpose |
|---|---|---|---|
| Storm | `stormSeed` | Random integer | Reproducible typhoon variation |
| Storm | `landfallHour` | `48` | Default landfall |
| Storm | `landfallAcceleration` | 0 / 4 / 8 hours | Landfall timing variation |
| Storm | `accelerationRevealHour` | `24` | Reveals revised timing |
| Wind | `windFactor` | 0.85–1.30 | Original wind-related modifier |
| Flood | `floodVariation` | −0.20 to +0.30 m | Flood scenario variation |
| Rumor | `damRumorProbability` | 30% | Original misinformation-event probability |
| Rumor | `damRumorFloodBonus` | +0.40 m | Original conditional flood modifier |
| Storm | `stormPhase` | Preparation / Warning / Impact / Aftermath | Current storm stage |
| Storm | `officialAdvisoryIssued` | `False` | Official warning state |
| Storm | `evacuationAdvisoryIssued` | `False` | Evacuation decision trigger |
| Storm | `powerOutageTriggered` | `False` | Power interruption event |
| Storm | `roadClosureTriggered` | `False` | Route closure event |
| Storm | `stormEventHistory` | Empty array | Triggered typhoon events |

## 10. Flood Configuration

| Category | Variable | Value | Purpose |
|---|---|---|---|
| Flood | `baseFloodHeight` | 0.80 m | Original baseline |
| Location | `highGroundBonus` | +0.00 m | High-ground modifier |
| Location | `lowStreetBonus` | +0.50 m | Low-street modifier |
| Location | `riverBonus` | +0.90 m | Riverside modifier |
| Location | `coastalBonus` | +1.00 m | Coastal modifier |
| Flood | `damRumorBonus` | +0.40 m | Original conditional modifier |
| Flood | `sandbagReduction` | −0.15 m | Original gate-preparation modifier |
| Flood | `riseStart` | 6 hours before landfall | Flood onset |
| Flood | `peakTime` | 3 hours after landfall | Flood peak |
| Flood | `peakFloodHeight` | Calculated | Maximum simulated flood height |
| Flood | `currentFloodHeight` | Dynamic | Current simulated flood level |
| Flood | `floodSeverity` | None / Low / Moderate / Severe | Scenario severity category |
| Flood | `groundFloorFlooded` | `False` | Ground-floor condition |
| Flood | `floodOverlayActive` | `False` | Floodwater visual effects |
| Flood | `roadsFlooded` | `False` | Road accessibility |

**Original workbook calculation:**

```text
Hpeak = 0.8 + Hlocation + Hvariation + Hrumor - Hsandbag
```

> **Parameter caveat:** The numerical values are fictional game parameters and must not be presented as real flood forecasts.

## 11. Health and Hazard Configuration

The following numerical injury values are inherited from the original workbook. They are not medically validated and should not be treated as real-world health predictions.

| Category | Variable / Condition | Original Value | Purpose |
|---|---|---|---|
| Health | `maxHealth` | `100` | Maximum numerical health |
| Health | `minHealth` | `0` | Original rescue-ending threshold |
| Flood exposure | Water above 0.5 m | −6 health/hour | Low-level exposure |
| Flood exposure | Water above 1.0 m | −15 health/hour | Increased exposure |
| Flood exposure | Water above 1.6 m | −30 health/hour | Severe exposure |
| Roof exposure | Character on roof | −10 health/hour | Roof hazard |
| Shelter damage | Upstairs, roof torn | −6 health/hour | Shelter-damage exposure |
| Window damage | Broken window | −8 health/person | Glass-related incident |
| Loose objects | Unsecured items | 30% chance of −6/hour | Object hazard |
| Roof damage | Unsecured roof | 25% chance/hour | Roof damage probability |
| Age modifier | Children / older adults | 1.5× damage | Original age-related multiplier |
| Rescue | Any health reaches zero | Immediate ending | Original rescue outcome |
| Safety | `hazardExposure` | None / Potential / Critical | Hazard status |
| Safety | `shelterCondition` | Normal / Compromised / Unsafe | Shelter integrity |
| Safety | `householdSafetyStatus` | Safe / At risk / Assistance needed | Household status |

## 12. Evacuation Configuration

| Category | Variable | Original / Default Value | Purpose |
|---|---|---|---|
| Evacuation | `evacuationDecision` | Undecided | Evacuate or remain |
| Walking | `walkingTravelTime` | 2 hours | Walking travel duration |
| Motorcycle | `motorcycleTravelTime` | 1 hour | Motorcycle travel duration |
| Age modifier | `dependentTravelPenalty` | +1 hour | Original child/older-adult travel modifier |
| Destination | `unknownCenterPenalty` | +1.5 hours | Original destination-uncertainty delay |
| Flood | `floodedRouteDamage` | −15 health/person | Original flooded-route effect |
| Older adult | `olderAdultFloodDamage` | −25 health | Original age-specific effect |
| Landfall | `postLandfallEvacuationBlocked` | `True` | Original evacuation restriction |
| Assistance | `barangayAssistanceDelay` | 0 hours | Registered-assistance adjustment |
| Escort | `adultEscortTime` | +0.5 hours | Escort time |
| Transportation | `motorcycleFuelRequired` | `True` | Transport prerequisite |
| Route | `roadsClear` | `True` | Route availability |
| Route | `routeStatus` | Open / Restricted / Closed / Unknown | Travel eligibility |
| Evacuation | `evacuated` | `False` | Evacuation completion |
| Destination | `evacuationLocation` | Home / Nena's / Evacuation center / Other | Household destination |
| Planning | `evacuationCenterKnown` | Survey-derived | Destination awareness |
| Planning | `evacuationAssistanceArranged` | `False` | Assistance readiness |
| Planning | `membersAccountedFor` | `False` | Household coordination |
| Evacuation | `goBagBrought` | `False` | Supplies taken during evacuation |

## 13. Property and Supply Loss Configuration

| Category | Variable / Condition | Original / Default Value | Purpose |
|---|---|---|---|
| Belongings | On floor | 0.30 m threshold | Property exposure |
| Belongings | Raised | 0.90 m threshold | Raised-item exposure |
| Belongings | Upstairs | Never lost | Original protection rule |
| Food and water | Not upstairs | 0.90 m threshold | Original loss of half of supplies |
| Documents | Unprotected | 0.50 m threshold | Document-loss condition |
| Property | `propertyLoss` | Calculated | Total simulated loss |
| Property | `propertyDamage` | None / Minor / Major | Damage classification |
| Supplies | `suppliesLost` | Calculated | Lost supplies |
| Supplies | `suppliesStoredSafely` | `False` | Supply protection |
| Documents | `documentsProtected` | `False` | Document protection |
| Belongings | `belongingsRaised` | `False` | Belongings preparation |
| Property | `damageEventHistory` | Empty array | Property-related incidents |

## 14. Aftermath Configuration

| Category | Variable / Condition | Original / Default Value | Purpose |
|---|---|---|---|
| Aftermath | `aftermathDuration` | 3 days | Recovery simulation period |
| Aftermath | `aftermathDay` | `1` | Current recovery day |
| Water | Insufficient water at home | Up to −35 health | Original shortage effect |
| Food | Insufficient food at home | Up to −15 health | Original shortage effect |
| Evacuation center | With go-bag | −3 health | Original preparedness adjustment |
| Evacuation center | Without go-bag | −15 health | Original supply-related adjustment |
| Medication | Under 3 days available | Up to −25 health | Original medication-shortage effect |
| Medication | At evacuation center | Must be in go-bag | Original supply-access condition |
| Supplies | `remainingWater` | Calculated | Available water |
| Supplies | `remainingFood` | Calculated | Available food |
| Medical | `medicationContinuityStatus` | Ready / Incomplete / Unknown | Medication preparedness |
| Household | `membersAccountedFor` | Boolean | Household status |
| Recovery | `officialUpdatesChecked` | `False` | Post-typhoon information |
| Recovery | `recoveryTasksCompleted` | Empty array | Completed aftermath objectives |
| Recovery | `aftermathComplete` | `False` | Recovery-stage completion |

## 15. Results, Scoring, and Achievement Configuration

| Category | Variable / Result | Original / Default Condition | Purpose |
|---|---|---|---|
| Score | `preparednessScore` | Starts at 100 | Preparedness evaluation |
| Score | `scorePenalty` | Rule-dependent | Identified preparedness gaps |
| Result | `naRescue` | Original: health reaches 0 | Early rescue ending |
| Result | `handa` | Original: lowest health ≥70 and no major loss | Strong outcome |
| Result | `nakaraos` | Original: lowest health ≥40 | Moderate outcome |
| Result | `nahirapan` | Original: lowest health below 40 | Difficult outcome |
| Debrief | `preparednessGaps` | Empty array | Identified weaknesses |
| Debrief | `evacuationPlanItems` | Empty array | Personalized action plan |
| Debrief | `lessonCards` | Empty array | Educational lessons |
| Achievements | `earnedBadges` | Empty array | Unlocked achievements |
| Achievements | `badgeConditions` | Rule-dependent | Badge requirements |
| Achievements | `badgeCount` | Calculated | Total earned badges |
| Results | `finalDecisionLog` | Completed decision history | End-of-game review |
| Results | `scenarioCompleted` | `False` | Simulation completion |
| Results | `replayAvailable` | `True` | Replay functionality |

## 16. Debrief and Local AI Configuration

| Category | Variable / Rule | Default / Trigger | Purpose |
|---|---|---|---|
| Debrief | `debriefRules` | Approximately 16 rules referenced in workbook | Preparedness evaluation |
| Communication | No meeting point | `meetingPointKnown = false` | Communication preparedness finding |
| Medication | Medication under 7 days | Original workbook threshold | Medication preparedness finding |
| Purchasing | Bought after price increase | Purchase after Hour 24 | Early preparation lesson |
| Information | Forwarded unverified rumor | Rumor-sharing decision | Information-verification lesson |
| Evacuation | Stayed in single-story home in flood scenario | Original condition | Evacuation-planning lesson |
| AI | `aiModel` | Selected local model | Narrative generation |
| AI | `aiRuntime` | `llama.cpp` server | Offline inference |
| AI | `scenarioContext` | Household profile + current state | Personalization context |
| AI | `scenarioAIResponse` | Validated JSON | Generated scenario content |
| AI | `debriefEvaluation` | Deterministic findings | Preparedness assessment |
| AI | `debriefNarration` | Locally generated | Personalized explanation |
| AI | `aiTimeout` | Configurable | Maximum response wait |
| AI | `fallbackEnabled` | `True` | Continue if inference fails |
| AI | `aiResponseSource` | AI / Fallback | Records content origin |
| AI | `generatedLessonCards` | Empty array | Personalized lesson narration |
| AI | `generatedActionPlan` | Empty array | Personalized preparedness guidance |

> **Specification gap:** Only five debrief-rule examples are explicitly defined in the workbook; the remaining rules require specification.

## 17. Visual, Character, Interaction, and Replay Configuration

| Category | Variable | Values / Default | Purpose |
|---|---|---|---|
| Theme | `visualTheme` | Modern Filipino / Traditional Filipino | House appearance |
| Character | `spriteBase` | Boy / Girl / Mom / Dad | Reusable character sprite |
| Character | `clothingVariant` | Variant ID | Clothing variation |
| Character | `characterPalette` | Palette ID | Character colors |
| Character | `playerCharacterId` | Household member ID | Playable character |
| NPC | `npcSpriteVariant` | Variant ID | NPC differentiation |
| NPC | `npcInteractionEnabled` | `True` | NPC interaction availability |
| Environment | `houseLayoutId` | Fixed layout ID | Reusable floor plan |
| Environment | `furnitureTheme` | Modern / Traditional | Furniture appearance |
| Environment | `weatherOverlay` | Clear / Rain / Heavy rain / Typhoon | Weather rendering |
| Environment | `floodOverlay` | None / Low / Moderate / Severe | Floodwater appearance |
| Movement | `movementMode` | Four-direction | Player navigation |
| Movement | `collisionEnabled` | `True` | Physical world boundaries |
| Interaction | `interactionRange` | Configurable | Proximity-based interactions |
| Interaction | `interactableObjects` | Scene-dependent | Objects available to inspect |
| Scene | `currentScene` | `House` | Current playable area |
| Scene | `shopSceneEnabled` | `True` | Pre-disaster shopping |
| Scene | `evacuationSceneEnabled` | `True` | Evacuation gameplay |
| Scene | `outdoorSceneEnabled` | Optional | Neighborhood exploration |
| Replay | `newStormSeed` | Random / Selected | New scenario variation |
| Replay | `retainHouseholdProfile` | `True` / `False` | Reuse or change household |
| Replay | `retainAchievements` | `True` | Persistent earned badges |
| Replay | `restartGameState` | `True` | Reset simulation resources and events |

---

## Core Design Principle

Household characteristics establish different preparedness needs and gameplay opportunities. The player earns achievements through appropriate decisions, not because their household has fewer medical needs, fewer members, or a supposedly safer home type.
