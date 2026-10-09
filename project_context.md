# SIGNAL NO. 5 — MASTER PROJECT CONTEXT FOR CLAUDE

> **Purpose:** This document is the authoritative working context for Claude when planning, implementing, reviewing, debugging, or refining Signal No. 5. Read it before suggesting architecture or modifying code. It consolidates the team's conversation and decisions, not merely the earlier one-day build-plan PDF. Where choices remain unresolved, they are explicitly marked **DECISION NEEDED**. Do not present proposals as settled requirements.

**Project:** Signal No. 5 (working name)  
**Event:** AppBuildersPH Hackathon 2026 — Local AI  
**Timebox:** 20-hour hackathon development sprint  
**Team:** Four members: two frontend/UI/UX, two backend/AI  
**Platform goal:** Mobile-oriented experience; exact demo deployment must be confirmed  
**Hazard scope:** **Typhoon only** for the hackathon; flood/rain/wind impacts are part of the typhoon scenario, not separate disaster modes.  
**Style:** 2D, nostalgic **8-bit-inspired pixel-art** game, immersive, accessible, gamified.  
**Status:** Planning and implementation direction; no assumption that any feature already exists.

---

## 1. One-paragraph product definition

Signal No. 5 is an offline-capable, local-AI-powered, 2D pixel-art typhoon preparedness simulation. Players answer a brief, privacy-conscious survey about their household, home, resources, and assistance needs; optionally customize their character and visual theme; then explore a fixed-layout pixel-art environment and make choices as a typhoon approaches and develops. Decisions persist in a world-state engine and alter later dilemmas, resources, dialogue, and available actions. A small local model acts as a constrained **adaptive scenario director**, providing contextualized dialogue and narrative variations, while deterministic rules enforce safety constraints and calculate outcomes. After a short run, the player receives an action-based preparedness debrief, a practical household checklist, and badges for demonstrated competencies. The game teaches *why* choices matter rather than simply marking quiz answers right or wrong.

## 2. Unique value proposition and positioning

**Core proposition:** *Don't just learn what to do during a typhoon. Experience how your decisions could affect a household like yours.*

**Short pitch:** Every household is different. So why should disaster preparedness training be the same? Signal No. 5 lets players rehearse typhoon decisions in scenarios shaped by their household circumstances, experience simulated consequences, and identify practical preparedness gaps — with meaningful AI inference running locally.

**Distinctive combination:**
1. Household-to-simulation personalization: survey responses change gameplay, not merely labels.
2. Consequence-based branching with persistent state: prior decisions change later conditions.
3. Constrained local AI scenario direction: narrative/dialogue and contextual dilemmas adapt without cloud AI.
4. A validated, decision-specific post-run preparedness guide.
5. Friendly, memorable 8-bit-inspired exploration, rewards, and replayability.

**Avoid unsupported novelty claims.** Disaster preparedness guides, offline planners, gamified learning, and interactive disaster games already exist. The defensible differentiation is the *combination* of household-dependent branching, offline local inference, and action-based learning. Do not claim that the project is the first of its kind.

## 3. Hackathon rules and scoring (from user-provided slides)

**Theme:** Local AI — meaningful AI computation happens on the user's device rather than depending entirely on cloud inference. Local LLMs, vision, speech, embeddings, agents, image generation, edge/offline AI, and hybrid systems are in scope.

**Requirements:**
- Substantially built during the hackathon.
- A meaningful part of AI inference executes locally.
- Working product demonstrated.
- Models, APIs, frameworks, and major tools disclosed.
- Core local AI functionality works without relying entirely on a cloud AI API.
- Existing open-source models/libraries and AI-assisted development are allowed; cloud APIs can be secondary.

**Judging weights:**
| Criterion | Weight | What to prove |
|---|---:|---|
| Problem & Usefulness | 25% | Real disaster-preparedness learning need, clear target users, actionable outcomes |
| Local AI Implementation | 25% | Real offline inference, central to personalized experience, demonstrable advantage |
| Technical Execution | 20% | Working, reliable, validated, reproducible demo |
| Innovation | 15% | Adaptive household-aware branching, not cosmetic personalization |
| Product & Demo Quality | 15% | Playable polished experience, understandable UX, convincing demo |

**Critical distinction:** A browser game calling Ollama on a separate laptop is *locally inferred on that laptop* but is **not standalone on-device mobile inference**. Do not claim otherwise. Verify whether the competition accepts a laptop-local demo if mobile inference cannot be integrated. If the game is presented as standalone mobile AI, inference must run on that phone or supported local device.

## 4. Product principles / non-negotiables

- **Typhoon only.** Do not add an earthquake scenario in the sprint.
- **8-bit-inspired aesthetic** with consistent pixel scale, sprites, fonts, colors, and animations. Do not replace with photorealistic or generic web-app styling.
- **Fixed structural backbone.** No AI-generated floor plans, no generative image model rendering maps live. Reuse room and house geometry; vary palettes, decorative skins, optional props, character sprites, lighting, and storm overlays.
- **Personalization must affect choices and outcomes.** Survey variables should influence events, inventory, NPC responsibilities, and/or the debrief.
- **Consequence-based education.** Actions produce state changes and clear explanations, not only arbitrary score penalties.
- **Local AI must be meaningful.** Not just a chatbot, name generator, or palette selector.
- **Safety rules are deterministic and reviewed.** Model never invents authoritative safety instructions, certifies real-world safety, or decides medical advice.
- **Offline-first core experience.** No required cloud inference for the core demo.
- **20-hour feasibility first.** Favor a complete polished vertical slice over a broad unfinished game.
- **Privacy-aware.** Minimize household data, make sensitive questions optional, avoid collecting medication names or diagnoses, store locally where feasible.

## 5. Target users and learning outcomes

**Primary users:** Filipino students, young adults, and households learning typhoon preparedness. Secondary audiences may include educators and community awareness programs, but don't build teacher/admin portals in the MVP.

**Player should learn to:**
- Recognize and respond to official warnings/advisories.
- Prepare essential emergency supplies early.
- Plan household communication and assistance responsibilities.
- Make timely, context-aware evacuation preparations and follow official instructions.
- Recognize the consequences of delay, insufficient supplies, and unsafe exposure to storm/flood hazards.
- Reflect on their own household preparedness gaps.

**Do not position the simulation as:** live hazard forecasting, authoritative evacuation routing, a replacement for official disaster advisories, a medical decision tool, or a predictor of survival.

## 6. Core game loop

1. **Main menu:** Start, Continue (if save support), How to Play, Achievements.
2. **Household survey:** 5 concise, privacy-conscious questions; optional visual personalization.
3. **Configuration:** Build household profile, choose prebuilt visual theme, populate appropriate NPCs and props, set initial resources.
4. **AI scenario initialization:** Pass a bounded, sanitized profile and validated game state to the local model; generate short context-specific narrative/dialogue/events as structured output.
5. **Preparation gameplay:** Explore house, inspect/interact with items and family, prepare emergency bag, monitor warnings, decide priorities.
6. **Typhoon escalation:** Rain/wind intensity and possibly floodwater/obstructions change based on deterministic simulation phases and previous decisions.
7. **Decision events:** Choices modify time, inventory, preparedness flags, NPC status, and later options. AI adapts *presentation* and bounded scenario variations.
8. **Resolution:** Player reaches a clear scenario ending; no need for graphic death/failure scenes.
9. **Debrief:** Review decision timeline, strengths, gaps, safer alternatives, household-specific preparedness checklist, badges.
10. **Replay:** Change survey answers or choices to explore different scenarios and consequences.

**Target run duration:** Approximately 8–12 minutes (proposed, adjustable based on testing). This is gameplay time, not the 20-hour development sprint.

## 7. Survey and customization specification

### Household survey (MVP): 5 questions + 1 visual choice

**Wording rules:** plain language, second person ("you", "your home"), one topic per question, short helper text that explains why we ask, no diagnoses or medication names, and "Prefer not to say" on every sensitive question. Use "go-bag" with "(emergency kit)" on first mention, because players may know either term.

**Intro copy:** "A few quick questions shape your game. Your answers stay on this device. You can skip personal questions and delete your profile anytime."

| # | Field | Question | Answers | Helper text |
|---|---|---|---|---|
| 1 | `homeType` | What kind of home do you live in? | Single-story house / Multi-story house / Apartment or condo / Prefer not to say | Changes the story details. The game map stays the same. |
| 2 | `occupants` | Who lives in your home? | Just me / Me and others | Decides who you plan with during the storm. |
| 3 | `assistanceNeeded` | Does anyone in your home need extra help to move or get ready in an emergency? | Yes / No / Prefer not to say | This could be for any reason. We won't ask for details. |
| 4 | `essentialSupplies` | Does anyone in your home rely on medicine or medical supplies they can't go without? | Yes / No / Prefer not to say | Adds a reminder to pack them. We won't ask what they are. |
| 5 | `goBagStatus` | Is your go-bag (emergency kit) ready? | Ready / Partly ready / Not ready / I'm not sure what that is | Sets what you start the game with. |
| — | `themeId` (customization, not survey) | Pick a look for your home. | Warm / Cool / Muted | Visual only. Never affects gameplay or scoring. |

**Defaults:** "Prefer not to say" maps to a neutral path: no extra events, and a general (not personal) checklist item. "I'm not sure what that is" starts the player like "Not ready" and adds a short explanation of a go-bag during `GO_BAG_PACKING`. Don't assume anyone needs help because of age alone.

**Optional additional inputs (stretch):** pets, existing communication plan, player nickname, avatar look. Avoid long onboarding.

**Example mapping:**
| Input | State effect | Narrative effect | Debrief effect |
|---|---|---|---|
| Go-bag: partly ready | Missing supplies flags | NPC prompts preparation decision | Checklist highlights missing categories |
| Assistance needed: yes | Adds household coordination objective | NPC asks for help planning | Reviews assistance plan |
| Medication supplies: yes | Adds essential-supplies preparedness flag | Contextual reminder | Check continuity supplies, without medical advice |
| Home type: multi-story | Context flag; optional upstairs interaction | Context-specific dialogue | Home-relevant general preparedness points |
| Theme: cool palette | Changes visual skins only | No safety effect | No scoring effect |

**Data privacy:** All personal fields should be minimal and local. Explain what the survey does and provide skip options for sensitive questions. Do not transmit to third-party AI APIs without explicit consent.

## 8. 8-bit visual and UX direction — important

**Visual identity:** Cozy but atmospheric retro top-down 2D RPG with crisp pixels, approachable character sprites, expressive but simple environmental storytelling, and escalating typhoon effects. Keep visuals consistent and readable on mobile screens.

**Art approach:**
- Fixed map collision and room boundaries.
- **MVP map is the house only.** A street/exterior scene and an evacuation-center scene are **extended features**. Start them only after the full loop (survey → events → debrief → badges) works end to end.
- Internal canvas resolution **320×180 or 384×216**, with integer scaling and nearest-neighbor filtering. Test legibility on a phone.
- 16x16 tile grid is a practical production choice; an **8-bit-inspired** aesthetic does not require actual historical 8-bit hardware restrictions. Keep tile/sprite sizes consistent.
- Sprite budget: one player base sprite with 2–3 outfit/palette variants; 1–2 NPC sprites.
- Asset naming convention: `theme_[name]`, `prop_[name]`, `npc_[role]`, `overlay_[hazard]`. Document every asset's license.
- Use pixel-perfect rendering, nearest-neighbor scaling, limited cohesive palettes, and a legible pixel font (with fallback for small mobile text).
- Prebuilt tilesets and sprite sheets with appropriate licenses. Do not attempt real-time generative sprite/image creation.
- Two or three palette presets (e.g., warm home, cool home, muted urban). Palette swaps should not alter navigation or safety rules.
- Re-skin walls/floors/furniture; optional decorative props only at known anchor points. Never spawn props that block required paths.
- Player avatar variations: small number of hair/clothing/skin-tone options if assets allow; avoid treating sensitive identity attributes as safety-risk variables.
- Weather layers: rain streaks, wind sway, darkened sky, flickering lights, rising water overlays if implemented.
- Animation priority: idle/walk, item pickup, rain, simple NPC emotes, scene transition. Effects like shake and thunder are polish, not core.

**HUD:** Phase/time indicator, compact preparedness objectives, inventory/emergency kit, warning level, contextual interaction button, accessible dialogue panel. Avoid overloading the screen with gauges.

**UX screens:** splash/title; onboarding survey; avatar/theme customization; gameplay with tutorial prompts; decision modal/dialogue; results/debrief; achievements; replay. Mobile touch targets must be large and text readable; keyboard controls can be added for laptop demo.

**Audio:** Short retro SFX and optional ambient storm/chiptune; provide mute toggle. Never rely on audio alone to convey warnings.

**Mood:** Engaging, empathetic, not sensationalist. No graphic injuries, victim-blaming, or implication that one choice guarantees survival.

## 9. Map and world constraints

**MVP geometry:** One fixed playable house floor plan with logical areas (entry, living area, sleeping area, kitchen/supply area). The exterior/street map is an extended feature only (see §8). Multi-story and apartment answers are contextual variants, not promises of physically unique architecture.

**Interaction anchors:** door, go-bag/supply cabinet, phone, radio, flashlight, water storage, important documents, medicine/supplies marker, family NPC, window/house preparation point, exit. Each anchor maps to a known action ID.

**World variation:** theme palettes, furniture skins, occupant sprites, inventory props, rain intensity, lighting, optional obstruction overlays. Random seed can pick cosmetic variations, but AI need not generate map coordinates.

**Navigation:** Fixed walkable tile layer and collision; transitions between scenes if included; flood overlays can mark some paths as unsafe/impassable based on deterministic state.

**Map validation:** Player spawn is valid, objectives reachable at start, no prop overlaps collision, all exits functional, interactive elements visible.

## 10. Narrative, branching, and simulation

**Story phases** (these are also the `Phase` values in the code):
1. `calm`: **Calm before the storm.** Explore, receive forecast context, inspect supplies.
2. `preparation`: Pack essentials, plan with the household, check communications, secure the home.
3. `escalation`: Rain and wind intensify; warnings are upgraded; interruptions happen.
4. `decision`: Act on official evacuation guidance and coordinate household needs. Never teach a universal evacuation rule independent of official guidance.
5. `resolution`: Reach a clear scenario ending (no graphic failure scenes).
6. `debrief`: Review decisions, alternatives, gaps, checklist, and badges.

### Event catalog (MVP): at least 10 consequential events per run

**Rule:** every complete run encounters **at least 10 consequential events**. The ending (`STORM_OUTCOME`) doesn't count toward the 10. All 11 core events below fire in every run. Household profiles change *which variant* plays and *which actions* are offered; they don't skip core events. Write events as data (JSON/TS content files), not code, so content can be authored in parallel with the engine.

All action consequences and safety framing below are **proposed and require safety review** (§11) before they're final.

| # | Phase | Event ID | Approved action IDs | Profile-driven variants |
|---|---|---|---|---|
| 1 | calm | `FORECAST_BRIEFING` | `CHECK_ADVISORY`, `DELAY` | — |
| 2 | calm | `SUPPLY_CHECK` | `INSPECT_SUPPLIES`, `DELAY` | `__KIT_READY`, `__KIT_MISSING` |
| 3 | preparation | `GO_BAG_PACKING` | `PACK_GO_BAG`, `PACK_ESSENTIAL_SUPPLIES`*, `DELAY` | `__READY`, `__PARTIAL`, `__NOT_READY`, `__UNSURE` |
| 4 | preparation | `WATER_AND_FOOD` | `STORE_WATER`, `STOCK_FOOD`, `DELAY` | — |
| 5 | preparation | `COMMUNICATION_CHECK` | `CHARGE_PHONE`, `CHECK_RADIO`, `SHARE_CONTACT_PLAN` | `__ALONE`, `__WITH_OTHERS` |
| 6 | preparation | `HOUSEHOLD_PLAN` | `AGREE_MEETING_PLAN`, `PLAN_ASSISTANCE`*, `DELAY` | `__ALONE`, `__WITH_OTHERS`, `__ASSISTANCE` |
| 7 | preparation | `HOME_SECURING` | `SECURE_LOOSE_ITEMS`, `SECURE_WINDOWS`, `PROTECT_DOCUMENTS` | `__SINGLE_STORY`, `__MULTI_STORY`, `__APARTMENT` |
| 8 | escalation | `WARNING_UPGRADE` | `CHECK_ADVISORY`, `UPDATE_HOUSEHOLD`, `DELAY` | — |
| 9 | escalation | `POWER_INTERRUPTION` | `USE_FLASHLIGHT`, `CONSERVE_PHONE_BATTERY`, `CHECK_RADIO` | — |
| 10 | escalation | `FLOOD_ADVISORY` | `CHECK_ADVISORY`, `PREPARE_TO_EVACUATE`, `GO_OUTSIDE_TO_LOOK`† | — |
| 11 | decision | `EVACUATION_ADVISORY` | `CHECK_HOUSEHOLD`, `GRAB_GO_BAG`, `FOLLOW_ADVISORY`, `DELAY` | `__ASSISTANCE`, `__ESSENTIAL_SUPPLIES` |
| — | resolution | `STORM_OUTCOME` | (none: ending) | Outcome class computed by the engine |

\* Offered only when the matching survey answer is `yes`. † An unsafe choice offered on purpose so the debrief can explain why to avoid it. The game never rewards it, and never shows the player entering floodwater.

**Example event chain:**
1. A warning/advisory is received.
2. Player can check official information, prepare supplies, coordinate household, or delay.
3. State updates: `warning_checked`, `bag_ready`, `assistance_plan_ready`, `time_remaining`.
4. A later evacuation-related event checks those flags.
5. AI supplies a personalized NPC line and event framing; engine offers only valid actions.
6. Debrief explains the connection between earlier preparation and later options.

**Core state dimensions:** phase, simulated time, warning status, household members and assistance needs, emergency supplies, inventory, locations, current event, event history, completed actions, available choices, decision log, preparedness competency flags, badge eligibility.

**Avoid:** fabricated disaster physics, deterministic predictions of death/survival, arbitrary random penalties, AI-written unreviewed emergency instructions.

**Consequence design:** Use clear cause-effect relationships. Decisions can affect readiness, available time, supplies, and NPC coordination. Not every bad outcome is the player's fault; disasters are inherently uncertain.

## 11. Gamification and learning feedback

**Badge catalog (MVP): at least 10 badges.** Every badge is awarded **only** by deterministic engine rules, never by the AI. Conditions are proposed; finalize them alongside the safety review.

| # | Badge ID | Name | Proposed condition |
|---|---|---|---|
| 1 | `INFORMED` | Stay Informed | Checked official advisories in `calm` **and** after `WARNING_UPGRADE` |
| 2 | `READY_TO_GO` | Ready to Go | Go-bag fully packed before `escalation` |
| 3 | `SUPPLY_KEEPER` | Supply Keeper | Stored water **and** stocked food |
| 4 | `STAYING_CONNECTED` | Staying Connected | Charged phone **and** set up a contact plan or checked the radio |
| 5 | `HOME_GUARD` | Home Guard | Completed at least 2 home-securing actions |
| 6 | `COMMUNITY_CARE` | Community Care | Made an assistance or household plan (or contacted family/neighbors if living alone) |
| 7 | `EARLY_BIRD` | Early Bird | Finished all preparation actions without any `DELAY` in `preparation` |
| 8 | `SAFETY_FIRST` | Safety First | Never chose an unsafe action (e.g. `GO_OUTSIDE_TO_LOOK`) |
| 9 | `EVACUATION_PLANNER` | Evacuation Planner | Chose `FOLLOW_ADVISORY` with go-bag and household ready |
| 10 | `PREPAREDNESS_SCHOLAR` | Preparedness Scholar | Opened and finished reviewing the debrief |

**Fairness rules:** every profile must be able to earn all 10 badges (conditions adapt to the survey; e.g. `COMMUNITY_CARE` for someone living alone). Every run earns at least one (`PREPAREDNESS_SCHOLAR`). Each badge has an earned explanation and a "how to earn" hint for replay. Additional badges are stretch.

**Scoring:** Evaluate defined actions against a reviewed rubric. Avoid a numerical 'survival probability' or implying real-world certification. Show categories like warnings, supplies, communication, evacuation planning, and household assistance. Use score only as educational feedback, not a moral judgment.

**Debrief must contain:**
- Timeline of major decisions.
- What the player did well.
- Preparedness gaps based on actual game events and survey.
- Safer alternatives and explanation tied to reviewed source guidance.
- Personalized but practical checklist for the household.
- Badges unlocked and replay prompt.

**Safety sources:** Curate and verify current official Philippine disaster preparedness material (e.g., PAGASA, NDRRMC/OCD, local DRRM advisories) before coding the safety rubric. Document source, date, and exact principle. The LLM must not fabricate citations or warnings.

## 12. Local AI: essential design

**AI role:** An **adaptive scenario director**, not the source of physical/safety truth.

**Model tasks:**
1. Generate short contextual opening and NPC dialogue based on survey.
2. Select/reframe an allowed event variation based on current state and history.
3. Generate constrained descriptions of choices from allowed action IDs, where needed.
4. Narrate the final debrief using a structured, rule-computed evaluation and approved safety snippets.

**Non-AI tasks:** palette changes, map drawing, physics, collision, resource math, scoring, badge unlocking, hazard rules, authoritative preparedness guidance.

**Recommended candidate:** Quantized Qwen3 1.7B for experimentation; Qwen3 0.6B as a lighter fallback, or another verified small instruction model. **Benchmark on target hardware** for memory, output quality, JSON validity, and latency before locking model. Model sizes, licenses, and mobile support must be checked against actual distributions.

**Development runtime:** Ollama on developer laptop for rapid local API testing. **Mobile runtime:** llama.cpp-based Android integration or an appropriate embedded inference runtime, if a standalone Android build is required. The two are not equivalent deployments.

**Output contract:** Strict JSON with a schema (`ScenarioAIRequest` / `ScenarioAIResponse`, §15). The model must not invent event IDs, variant IDs, action IDs, speakers, props, scenes, or scores. It chooses only from the lists the engine sends. Use low temperature and output length limits. Generate ahead of time at phase transitions rather than on every click.

**Illustrative request** (built by the engine from validated state; contains no free-text personal data):
```json
{
  "schemaVersion": 1,
  "eventId": "HOUSEHOLD_PLAN",
  "phase": "preparation",
  "household": {
    "homeType": "singleStory",
    "occupants": "withOthers",
    "assistanceNeeded": "yes",
    "essentialSupplies": "preferNotToSay",
    "goBagStatus": "partial"
  },
  "state": {
    "tick": 4,
    "tickBudget": 12,
    "flags": { "WARNING_CHECKED": true, "GO_BAG_PACKED": false },
    "inventory": ["PHONE", "WATER"]
  },
  "recentDecisions": [{ "eventId": "SUPPLY_CHECK", "actionId": "INSPECT_SUPPLIES" }],
  "allowedVariantIds": ["HOUSEHOLD_PLAN__WITH_OTHERS", "HOUSEHOLD_PLAN__ASSISTANCE"],
  "allowedActionIds": ["AGREE_MEETING_PLAN", "PLAN_ASSISTANCE", "DELAY"],
  "allowedSpeakers": ["NPC_FAMILY_MEMBER"],
  "limits": { "dialogueMaxChars": 200, "descriptionMaxChars": 160 }
}
```

**Illustrative response:**
```json
{
  "schemaVersion": 1,
  "eventId": "HOUSEHOLD_PLAN",
  "variantId": "HOUSEHOLD_PLAN__ASSISTANCE",
  "speaker": "NPC_FAMILY_MEMBER",
  "dialogue": "The go-bag is only half packed, and Lola will need help getting ready. Can we agree who helps her before the rain gets worse?",
  "description": "Rain taps on the window. Your family gathers in the living room.",
  "actionIds": ["PLAN_ASSISTANCE", "AGREE_MEETING_PLAN", "DELAY"]
}
```

**Validate (adapter, in order):**
1. JSON parses.
2. Matches the Zod schema.
3. `eventId` equals the requested event.
4. `variantId`, `speaker`, and every `actionIds` entry are in the allowed lists; `actionIds` isn't empty.
5. `dialogue` and `description` are within the length limits.
6. A blocklist check finds no hotline numbers, URLs, invented warnings or signal levels, medical instructions, or "guaranteed/safe to" claims.

On timeout (~8 s, to be tuned after benchmarking) or failed validation: retry once, then use the variant's reviewed fallback text. The adapter (not the model) tags the result `source: "ai" | "fallback"`, so the UI can label AI-personalized text. **Action button labels are engine-owned**, so the AI can't reword a safety action.

**Proof of meaningful AI:** Two contrasting household profiles and/or decision histories produce different contextual events/dialogue while offline. Do not count cosmetic renaming as sufficient.

## 13. Proposed technology stack and tradeoffs

**Default rapid-build proposal (not finalized):**
| Layer | Candidate | Rationale |
|---|---|---|
| Game | Phaser 3 + TypeScript | Fast browser-based 2D tilemap development; fits frontend web skills |
| App shell/UI | React + Vite + Tailwind | Fast survey, menus, debrief, responsive interface |
| Pixel maps | Tiled editor / licensed tilesets | Reusable fixed geometry |
| Game state | Typed TypeScript state module | Single source of truth, deterministic transitions |
| Validation | Zod or JSON Schema | Enforce AI event contract |
| Local persistence | IndexedDB or local JSON save | Offline profile/run history |
| Local inference for laptop demo | Ollama | Rapid model integration and offline proof |
| Mobile on-device inference | llama.cpp / Android-compatible binding | Needed for independent mobile local AI |
| Tests | Vitest + Playwright, manual device tests | Game-state, UX, offline checks |
| Repository | Git + GitHub | Parallel work and integration |

**Alternative:** Godot 4 for native 2D game workflow; may be preferable if team already knows it. Do not change engines mid-sprint without clear reason.

**DECISION NEEDED: final demo target**
- **Option A — Laptop-local web demo:** Phaser/React + Ollama on same laptop, no cloud API. Fastest and least risky; disclose inference device honestly. Mobile-responsive browser UI is not on-phone inference.
- **Option B — Standalone Android demo:** Game and model inference run on Android; higher integration risk. Must test a minimal model call on device immediately, before building elaborate UI.

**Decision rule:** First 1–2 hours must establish whether the intended demo hardware can run the model locally and return validated JSON in acceptable time. If not, select a transparent, rule-compliant fallback and reduce scope. Do not silently substitute cloud inference.

## 14. Team responsibilities (four people)

### Frontend/UI/UX Member 1 — Pixel game and environment
- Set up Phaser/Godot game scene, camera, movement, collisions.
- Implement fixed house map, scene transitions, object interaction anchors.
- Implement palette/theme swaps, sprite variants, weather overlays.
- Coordinate game-to-UI events with Frontend 2.
- Deliver a controllable scene and working interactions early.

### Frontend/UI/UX Member 2 — Product interface and experience
- Design user flow and wireframes.
- Build survey, theme/avatar customization, HUD, dialogues, action choices.
- Build debrief, badge gallery, replay and tutorial UI.
- Ensure responsive touch targets, readability, accessible color contrast.
- Maintain consistent 8-bit visual language and demo polish.

### Backend Member 1 — Deterministic simulation and content rules
- Define shared state schema and action/event IDs.
- Implement game phases, resource/inventory mechanics, consequence transitions.
- Implement event eligibility and safe action validation.
- Encode reviewed preparedness rubric and badge logic.
- Supply frontend-friendly typed interfaces and test fixtures.

### Backend Member 2 — Local AI integration and scenario director
- Verify model/runtime/hardware and offline operation.
- Define prompt templates and strict response schemas.
- Implement AI request adapter, validation, retries/timeouts/fallback.
- Build contextual event/dialogue generation and constrained debrief narration.
- Benchmark performance, provide reproducible offline demo steps.

**Shared duties:** Integration, bug triage, safety-content review, testing, pitch. Nominate one integration lead and one demo lead (can be existing members, not extra roles).

## 15. Interfaces / contracts to agree before parallel coding

Define these as **Zod schemas** (with TypeScript types inferred from them) in one shared module (e.g. `src/core/contracts.ts`) by Hour 2. Every persisted or exchanged object carries `schemaVersion`.

### Naming conventions
| Thing | Convention | Example |
|---|---|---|
| Type names | PascalCase | `DecisionRecord` |
| Object fields (TS **and** JSON on the wire) | camelCase, one scheme everywhere | `goBagStatus` |
| String enums (survey answers, phases) | camelCase | `'preferNotToSay'`, `'escalation'` |
| Event IDs | SCREAMING_SNAKE **noun phrase** (the situation) | `EVACUATION_ADVISORY` |
| Action IDs | SCREAMING_SNAKE **verb first** (what the player does) | `FOLLOW_ADVISORY` |
| Variant IDs | `<EVENT_ID>__<QUALIFIER>` | `HOUSEHOLD_PLAN__ASSISTANCE` |
| Flags | SCREAMING_SNAKE, past/state | `GO_BAG_PACKED` |
| Items | SCREAMING_SNAKE noun; matching asset `prop_[name]` | `FLASHLIGHT` ↔ `prop_flashlight` |
| NPCs | `NPC_` + role; matching asset `npc_[role]` | `NPC_FAMILY_MEMBER` |
| Badges | SCREAMING_SNAKE | `READY_TO_GO` |
| Safety rules | `SR_` + short topic | `SR_FOLLOW_OFFICIAL_ADVISORY` |

### Contract (illustrative; adapt during Hour 0–2 but keep the shape)
```ts
type Phase = 'calm' | 'preparation' | 'escalation' | 'decision' | 'resolution' | 'debrief';
type Answer<T extends string> = T | 'preferNotToSay';

type HouseholdProfile = {
  schemaVersion: 1;
  homeType: Answer<'singleStory' | 'multiStory' | 'apartment'>;
  occupants: 'alone' | 'withOthers';
  assistanceNeeded: Answer<'yes' | 'no'>;
  essentialSupplies: Answer<'yes' | 'no'>;
  goBagStatus: 'ready' | 'partial' | 'notReady' | 'unsure';
};

// Kept separate from HouseholdProfile: visuals must never affect rules or scoring.
type VisualTheme = { themeId: 'warm' | 'cool' | 'muted'; avatarVariantId: string };

type GameState = {
  schemaVersion: 1;
  runId: string;
  seed: number;                 // reproducible demos
  phase: Phase;
  tick: number;                 // simulated time elapsed
  tickBudget: number;           // ticks before the storm peaks
  currentEventId: EventId | null;
  household: HouseholdProfile;
  theme: VisualTheme;
  inventory: ItemId[];
  flags: Partial<Record<FlagId, boolean>>;  // extensible; no one-off booleans
  npcReadiness: Partial<Record<NpcId, 'notReady' | 'preparing' | 'ready'>>;
  eventHistory: EventId[];
  decisionLog: DecisionRecord[];
  completed: boolean;
};

type ActionDefinition = {
  id: ActionId;
  label: string;                // engine-owned button text
  tickCost: number;
  effects: Effect[];            // add/remove item, set flag, set NPC readiness
  safetyRuleId?: SafetyRuleId;  // links the action to reviewed guidance
};

type EventDefinition = {
  id: EventId;
  phase: Phase;
  conditions: Condition[];      // eligibility, evaluated by the engine
  approvedActionIds: ActionId[];
  variants: {
    id: VariantId;
    when: Condition[];          // profile/state conditions for this variant
    fallback: { speaker: NpcId; dialogue: string; description: string }; // reviewed text
  }[];
  learningObjective: string;
  safetyRuleIds: SafetyRuleId[];
};

type StateSnapshot = Pick<GameState, 'tick' | 'inventory' | 'flags' | 'npcReadiness'>;

type DecisionRecord = {
  eventId: EventId;
  variantId: VariantId;
  actionId: ActionId;
  tick: number;
  stateBefore: StateSnapshot;
  stateAfter: StateSnapshot;
  safetyRuleId?: SafetyRuleId;
};

type ScenarioAIRequest = {      // see §12 for an example
  schemaVersion: 1;
  eventId: EventId;
  phase: Phase;
  household: HouseholdProfile;
  state: Pick<GameState, 'tick' | 'tickBudget' | 'flags' | 'inventory'>;
  recentDecisions: Pick<DecisionRecord, 'eventId' | 'actionId'>[]; // last 5 at most
  allowedVariantIds: VariantId[];
  allowedActionIds: ActionId[];
  allowedSpeakers: NpcId[];
  limits: { dialogueMaxChars: number; descriptionMaxChars: number };
};

type ScenarioAIResponse = {     // what the model must return
  schemaVersion: 1;
  eventId: EventId;
  variantId: VariantId;
  speaker: NpcId;
  dialogue: string;
  description: string;
  actionIds: ActionId[];        // subset of allowedActionIds; order = display order
};

type ScenarioContent = ScenarioAIResponse & { source: 'ai' | 'fallback' }; // added by the adapter

type DebriefEvaluation = {      // computed deterministically by the engine
  schemaVersion: 1;
  timeline: DecisionRecord[];
  strengths: FindingId[];
  gaps: FindingId[];
  learningPoints: { safetyRuleId: SafetyRuleId; text: string }[]; // reviewed text only
  checklistItems: ChecklistItemId[];  // from survey answers + gaps
  badgeIds: BadgeId[];
};

type DebriefNarration = {       // AI: wording only, built from DebriefEvaluation
  summary: string;              // ≤ 400 chars
  highlightFindingIds: FindingId[]; // subset of strengths/gaps
};

type BadgeDefinition = { id: BadgeId; name: string; description: string; hint: string; condition: Condition[] };
```

**Rule:** Backend owns valid state transitions; frontend renders state and dispatches known actions; AI returns constrained content and IDs, never directly mutates state.

**Cross-team contract owners:** Frontend B + Backend A, survey-to-state. Frontend A + Backend A, event triggers and action IDs. Frontend B + Backend B, dialogue/debrief response shapes. Backend A + Backend B, the allowlist and reviewed safety content.

## 16. Suggested 20-hour execution plan

| Hours | Milestone | Acceptance checkpoint |
|---|---|---|
| 0–2 | Repo setup, deployment decision, model feasibility, schemas | All four can run app; first offline model JSON response works on chosen inference device |
| 2–5 | Parallel foundations | Walkable map; working survey; deterministic state/actions; AI adapter stub |
| 5–8 | First integration | Survey changes profile/state/visual theme; at least one AI event displayed |
| 8–12 | Full vertical slice | One end-to-end typhoon run with branching decisions and a resolution |
| 12–15 | Education layer | Reviewed consequence feedback, debrief, checklist, all 10 badges |
| 15–17 | Visual customization and polish | Two themes, avatar variation if possible, rain/weather, mobile-friendly UI |
| 17–19 | Reliability testing | Offline demo, different profiles, fallback handling, bug fixes |
| 19–20 | Freeze and rehearse | Complete demo, backup recording, tool/model disclosure ready |

**Integration checkpoints:** a checkpoint is a hard, pass/fail integration milestone. All four members merge to `main`, and the team plays **one complete playthrough together**. If a checkpoint fails, the team stops adding features and either fixes the failure or cuts scope (cut order below) before moving on. Checkpoints exist so the four parallel workstreams can't drift apart until the last hour.

| Hour | Checkpoint | Pass condition |
|---|---|---|
| 2 | Contracts + AI feasibility | Shared schemas committed; the local model returns valid JSON on the chosen inference device; a blank game launches |
| 5 | First merge | Map, survey, engine, and AI adapter run together on `main` |
| 8 | Personalized event | Survey answers change state and theme; one AI-generated event plays |
| 12 | Full run | All 10+ core events play in order through `STORM_OUTCOME` |
| 17 | Feature freeze | Debrief, checklist, and all 10 badges work; only bug fixes, tests, and demo prep after this |

**Content volume (10+ events, 10+ badges):** events and badges are data files. Backend A builds the engine to handle *any* event/badge definition by Hour 5, so the remaining content can be authored in parallel after that.

**Fallback/cut order if behind:** extended street/evacuation-center scenes -> extra animations/audio -> extra themes/avatars -> extra NPCs -> profile variants beyond one per survey variable -> free-text commands. **Never cut:** working gameplay loop, the 10 core events, the 10 badges, survey-to-scenario effect, meaningful local AI proof, deterministic safety logic, and debrief.

## 17. Acceptance criteria and tests

**Core gameplay:**
- Player completes survey, selects theme, enters map, moves, interacts, makes decisions, reaches debrief.
- Every complete run encounters at least 10 consequential events (§10).
- At least 10 badges exist; each is earnable by every household profile; every run earns at least one (§11).
- At least 3 earlier actions have visible effects on later state or available choices.
- At least 3 survey variables meaningfully affect events/resources/objectives or debrief.
- Two different profiles create distinguishable contextual experiences beyond names/colors.

**Local AI:**
- Model generates valid event/dialogue JSON without internet access on the disclosed inference device.
- AI responses are validated; invalid output triggers a safe fallback.
- Model cannot invent actions or override safety rules.
- AI-personalized text is labeled in the UI (`source: "ai"` vs `"fallback"`).
- UI remains responsive while inference occurs; loading state and timeout handling exist.

**Visual/UX:**
- Pixel art crisp, consistent tile scale, readable dialogue and controls.
- Two palette themes work without changing collisions or breaking objectives.
- Touch or keyboard controls work on the target demo device.

**Education:**
- Feedback traces back to player decisions and reviewed rules.
- Checklist corresponds to actual household answers and gaps.
- No claims of guaranteed safety, live forecast accuracy, or medical advice.

**Reliability:**
- At least three full end-to-end runs tested with different household profiles.
- Offline test performed with Wi-Fi/data disabled.
- Refresh/restart behavior understood and demo-safe.
- Demo fallback available if model latency or hardware issues occur.

## 18. Demo and judging strategy

**Recommended short demo:**
1. State the problem: generic guidance cannot account for every household's situation.
2. Show the 8-bit game and quick household survey.
3. Run Profile A (e.g., alone, kit prepared) and show a contextual AI event.
4. Run Profile B (e.g., assistance needed, kit incomplete) and show a different event and available choices.
5. Make a choice, show persistent consequence, then debrief/checklist and badge.
6. Disable internet or show it is disabled and generate a new local response.
7. Explain exactly which model, runtime, device, and rules are used.

**Evidence to show:** Offline inference, different validated JSON responses, action-to-consequence state change, readable game, and household-specific debrief.

**Suggested pitch:** “Most disaster preparedness tools teach you what to do. Signal No. 5 lets you experience what your decisions could mean for a household like yours — with personalized scenarios generated locally, even without cloud AI.”

## 19. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| On-device mobile inference too hard in sprint | Critical | Test first; choose demo target early; transparent laptop-local fallback if permitted |
| Model outputs invalid JSON | High | Schema validation, constrained IDs, short outputs, fallback content |
| AI generates unsafe advice | Critical | Approved safety knowledge and deterministic outcomes; no free-form safety authority |
| Too many features / late integration | Critical | P0 scope, contracts at Hour 2, merge checkpoints, feature freeze |
| Pixel-art production takes too long | High | Licensed assets, fixed geometry, palette swaps, avoid new sprite generation |
| Survey changes only cosmetic appearance | High | Define explicit survey-to-state mappings and test two contrasting profiles |
| AI latency disrupts gameplay | High | Short outputs, pre-generation, loading UX, bounded timeouts, fallback |
| Confusing preparedness score | Medium | Competency rubric, transparent explanations, no survival predictions |
| Sensitive household data exposure | High | Minimize, optional inputs, local storage, no cloud transmission by default |
| Demo failure | High | Rehearsal, offline proof, backup recording and sample valid outputs |

## 20. Prioritized checklist for Claude and team

### Product and educational content
- [ ] Lock target audience, learning outcomes, and scope: typhoon only.
- [ ] Finalize 5-question survey and privacy copy.
- [ ] Finalize the 11-event catalog (≥10 consequential) and its action consequences (§10).
- [ ] Verify preparedness principles from official sources and create rule-to-source mapping.
- [ ] Finalize the 10 badge conditions (§11) and debrief sections.

### Technical decisions
- [ ] Confirm final target device and whether local inference runs on it.
- [ ] Benchmark small model on target hardware with offline JSON test.
- [ ] Select engine and UI approach (Phaser/React vs Godot).
- [ ] Freeze schemas and action/event IDs.
- [ ] Define local persistence and failure fallback.

### Frontend/UI/UX
- [ ] Produce main user flow and wireframes.
- [ ] Implement fixed house map, movement, collision, interactions.
- [ ] Create at least two palette/theme presets and consistent pixel UI.
- [ ] Build survey, customization, dialogue, HUD, and debrief screens.
- [ ] Implement touch/keyboard controls and basic accessibility.

### Backend/simulation
- [ ] Implement state machine and deterministic consequence transitions.
- [ ] Map survey answers to starting conditions and event eligibility.
- [ ] Implement event progression, inventory and decision log.
- [ ] Implement reviewed scoring, checklist assembly, and badges.
- [ ] Add unit tests for state transitions and event constraints.

### Local AI
- [ ] Define constrained prompts and JSON output schemas.
- [ ] Connect runtime and handle inference loading/timeouts.
- [ ] Validate all AI output and disallow invented IDs.
- [ ] Implement contextual scenario and dialogue generation.
- [ ] Implement debrief narration only from validated evaluation facts.
- [ ] Demonstrate offline inference with contrasting profiles.

### Integration/demo
- [ ] First integrated survey-to-game-to-AI event works.
- [ ] Full 8–12 minute vertical slice works.
- [ ] At least three meaningful branches or state-dependent outcomes.
- [ ] Three profile playtests completed.
- [ ] Offline test, fallback test, and model disclosure completed.
- [ ] Feature freeze, demo script, rehearsal, backup video.

## 21. Instructions for Claude when working on this project

**Role:** Be a pragmatic lead engineer and game/product collaborator helping a four-person team ship a polished vertical slice in 20 hours.

**Mandatory workflow for every code change:**
1. **INSPECT:** Read relevant files, current architecture, package manifests, and existing behavior. Do not assume the repository matches this document.
2. **PLAN:** Identify the smallest change that satisfies the requirement, affected files, interfaces, risks, and tests. Confirm architecture-changing or scope-expanding decisions.
3. **IMPLEMENT:** Make focused edits preserving established schemas and style; do not rewrite unrelated code or invent missing assets/APIs.
4. **VALIDATE:** Run available tests/build/lint, check runtime behavior and JSON schemas, and report what actually passed or could not be tested.
5. **REPORT:** Summarize changes, file paths, validation, blockers, and the next priority. Be transparent about incomplete work.

**Decision priorities:** Functional vertical slice > meaningful offline local AI > safety correctness > user experience > customization polish > optional features.

**Guardrails:**
- Never claim local phone inference if inference is actually on a laptop or server.
- Never substitute cloud inference silently.
- Never treat AI-generated dialogue as authoritative disaster advice.
- Never expand to earthquake or AI-generated maps without explicit approval.
- Never replace the fixed-map 8-bit aesthetic with generic designs.
- Never imply a feature is implemented solely because it is specified here.
- Ask only for genuinely blocking decisions; otherwise propose the simplest sensible option and state assumptions.
- Preserve reproducible demos: deterministic seeds, known-good fallback content, and clear model/tool disclosures.

## 22. Open decisions — resolve as soon as possible

1. **Demo platform:** Laptop-local browser experience vs standalone Android inference. This is the highest-risk choice.
2. **Game engine:** Phaser 3 + React or Godot 4, based on team's familiarity.
3. ~~Map scope~~ **Resolved:** house only for MVP; street and evacuation-center scenes are extended features (§8).
4. **AI model:** Confirm exact model, quantization, device memory, and response latency.
5. **Survey:** Final wording and which questions may be skipped.
6. **Narrative:** Final authored event catalog, phases, and validated safety content.
7. **Branding:** Confirm Signal No. 5 name, tagline, palette, and badge names.

## 23. Final definition of success

By the end of the hackathon, a judge can open a working 8-bit typhoon preparedness game, complete a short household survey, see a personalized environment and scenario, make meaningful choices that affect later events, receive an evidence-based debrief and badge, and witness real AI inference running locally without relying on a cloud AI API. The team can explain exactly which elements are AI-generated, which are rule-based, which device runs the model, and why the resulting experience is more useful than a static preparedness guide.

---

**Document note:** This is a consolidated direction/implementation brief derived from the conversation, the judging slides, and *Signal No. 5 — General Project Direction Document v1.0* (team PDF). Where this file and the PDF differ, this file reflects the team's later decisions: at least 10 events and 10 badges, house-only MVP map, 6-phase model, and the §15 contract. The previously uploaded one-day build plan is supplementary; its 12-hour schedule, fixed cast, two-floor house, and free-text action interpreter are **not** binding requirements. All implementation specifics labeled proposed or undecided should be verified with the team before coding.
