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

### Proposed household questions (MVP)
1. **Home context:** single-story / multi-story / apartment or similar. Since geometry is fixed, represent differences through visual theme, descriptive context, an optional interaction point, and scenario rules; do not promise physically accurate customized floor plans.
2. **Household:** alone / with family or others / household includes someone who may need help during evacuation.
3. **Assistance/accessibility:** does anyone need additional assistance moving or preparing? Optional and phrased respectfully; do not assume inability from age alone.
4. **Essential medication/medical supplies:** yes / no / prefer not to say. Do not ask for diagnosis or medication names.
5. **Emergency kit readiness:** prepared / partially prepared / not prepared.

**Optional additional inputs:** pets, existing communication plan, player nickname, avatar look, color palette. Avoid long onboarding.

**Example mapping:**
| Input | State effect | Narrative effect | Debrief effect |
|---|---|---|---|
| Emergency kit: partial | Missing supplies flags | NPC prompts preparation decision | Checklist highlights missing categories |
| Assistance needed: yes | Adds household coordination objective | NPC asks for help planning | Reviews assistance plan |
| Medication supplies: yes | Adds essential-supplies preparedness flag | Contextual reminder | Check continuity supplies, without medical advice |
| Home type: multi-story | Context flag; optional upstairs interaction | Context-specific dialogue | Home-relevant general preparedness points |
| Theme: cool palette | Changes visual skins only | No safety effect | No scoring effect |

**Data privacy:** All personal fields should be minimal and local. Explain what the survey does and provide skip options for sensitive questions. Do not transmit to third-party AI APIs without explicit consent.

## 8. 8-bit visual and UX direction — important

**Visual identity:** Cozy but atmospheric retro top-down 2D RPG with crisp pixels, approachable character sprites, expressive but simple environmental storytelling, and escalating typhoon effects. Keep visuals consistent and readable on mobile screens.

**Art approach:**
- Fixed map collision and room boundaries.
- Use one base house map and a small street/exterior scene; evacuation-center scene only if schedule permits.
- 16x16 tile grid is a practical production choice; an **8-bit-inspired** aesthetic does not require actual historical 8-bit hardware restrictions. Keep tile/sprite sizes consistent.
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

**MVP geometry:** One fixed playable house floor plan with logical areas (entry, living area, sleeping area, kitchen/supply area), plus optional small exterior/street map. Multi-story and apartment answers are contextual variants, not promises of physically unique architecture.

**Interaction anchors:** door, emergency bag/supply cabinet, phone/radio, water storage, important documents, family NPC, window/house preparation point, exit. Each anchor maps to a known action ID.

**World variation:** theme palettes, furniture skins, occupant sprites, inventory props, rain intensity, lighting, optional obstruction overlays. Random seed can pick cosmetic variations, but AI need not generate map coordinates.

**Navigation:** Fixed walkable tile layer and collision; transitions between scenes if included; flood overlays can mark some paths as unsafe/impassable based on deterministic state.

**Map validation:** Player spawn is valid, objectives reachable at start, no prop overlaps collision, all exits functional, interactive elements visible.

## 10. Narrative, branching, and simulation

**Recommended story phases:**
- Phase 1: **Before the storm** — warnings, preparing supplies, household planning.
- Phase 2: **Escalation** — worsening weather, household coordination, resource and timing tradeoffs.
- Phase 3: **Critical decision** — official evacuation advisory or shelter-related decision appropriate to scripted context; never teach a universal evacuation rule independent of official guidance.
- Phase 4: **Aftermath/debrief** — consequences and practical learning.

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

**Badge examples:**
- Ready to Go — demonstrated emergency-kit preparedness.
- Safety First — followed appropriate protective actions and advisories.
- Community Care — considered assistance/household coordination.
- Evacuation Planner — demonstrated an appropriate plan under the scenario's official guidance.
- Preparedness Scholar — completed and reviewed the learning debrief.

**MVP:** Three badges plus a competency-based results screen; additional badges are stretch.

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

**Output contract:** Strict JSON with a schema. The model must not invent event IDs, action IDs, props, scenes, or scores. Use temperature and output length constraints as appropriate; validate, retry at most a bounded number of times, and fall back to reviewed authored text. Avoid unbounded generation on every click; precompute or generate ahead of events.

**Illustrative request:**
```json
{
  "phase": "pre_landfall",
  "household": {"home_type": "single_story", "occupants": 3, "assistance_needed": true, "medication_supplies_needed": false, "kit_status": "partial"},
  "state": {"warning_checked": true, "bag_ready": false, "time_remaining": 6},
  "allowed_event_ids": ["SUPPLY_CHECK", "HOUSEHOLD_PLAN"],
  "allowed_action_ids": ["CHECK_SUPPLIES", "PLAN_ASSISTANCE", "CHECK_ADVISORY"]
}
```

**Illustrative response:**
```json
{
  "event_id": "HOUSEHOLD_PLAN",
  "speaker": "Family member",
  "dialogue": "We need to agree on how everyone will get ready. Who will help with the supplies?",
  "action_ids": ["PLAN_ASSISTANCE", "CHECK_SUPPLIES"]
}
```

**Validate:** JSON parse, schema, enum IDs, length, phase relevance, no unsupported safety claims, no invented personal details. If invalid, use deterministic fallback event.

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

Define these as TypeScript types or JSON schemas by Hour 2:
- `HouseholdProfile`
- `VisualTheme`
- `GameState`
- `ActionId` and `ActionRequest`
- `EventDefinition` and `EventInstance`
- `ScenarioAIRequest` / `ScenarioAIResponse`
- `DecisionLogEntry`
- `DebriefEvaluation` and `BadgeAward`

**Illustrative state (adapt as needed):**
```ts
type GameState = {
  runId: string;
  seed: number;
  phase: 'preparation' | 'escalation' | 'critical' | 'debrief';
  timeRemaining: number;
  household: HouseholdProfile;
  themeId: string;
  warningChecked: boolean;
  bagReady: boolean;
  assistancePlanReady: boolean;
  inventory: string[];
  completedActionIds: string[];
  eventHistory: string[];
  decisionLog: DecisionLogEntry[];
};
```

**Rule:** Backend owns valid state transitions; frontend renders state and dispatches known actions; AI returns constrained content and IDs, never directly mutates state.

## 16. Suggested 20-hour execution plan

| Hours | Milestone | Acceptance checkpoint |
|---|---|---|
| 0–2 | Repo setup, deployment decision, model feasibility, schemas | All four can run app; first offline model JSON response works on chosen inference device |
| 2–5 | Parallel foundations | Walkable map; working survey; deterministic state/actions; AI adapter stub |
| 5–8 | First integration | Survey changes profile/state/visual theme; at least one AI event displayed |
| 8–12 | Full vertical slice | One end-to-end typhoon run with branching decisions and a resolution |
| 12–15 | Education layer | Reviewed consequence feedback, debrief, checklist, three badges |
| 15–17 | Visual customization and polish | Two themes, avatar variation if possible, rain/weather, mobile-friendly UI |
| 17–19 | Reliability testing | Offline demo, different profiles, fallback handling, bug fixes |
| 19–20 | Freeze and rehearse | Complete demo, backup recording, tool/model disclosure ready |

**Integration checkpoints:** Hour 2 contracts, Hour 5 first merge, Hour 8 personalized event, Hour 12 full run, Hour 17 feature freeze. Never leave integration to the last hour.

**Fallback/cut order if behind:** extra animations/audio -> extra themes/avatars -> extra NPCs -> exterior/evacuation-center scene -> free-text commands. **Never cut:** working gameplay loop, survey-to-scenario effect, meaningful local AI proof, deterministic safety logic, and debrief.

## 17. Acceptance criteria and tests

**Core gameplay:**
- Player completes survey, selects theme, enters map, moves, interacts, makes decisions, reaches debrief.
- At least 3 earlier actions have visible effects on later state or available choices.
- At least 3 survey variables meaningfully affect events/resources/objectives or debrief.
- Two different profiles create distinguishable contextual experiences beyond names/colors.

**Local AI:**
- Model generates valid event/dialogue JSON without internet access on the disclosed inference device.
- AI responses are validated; invalid output triggers a safe fallback.
- Model cannot invent actions or override safety rules.
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
- [ ] Create approved action/event catalog and narrative phases.
- [ ] Verify preparedness principles from official sources and create rule-to-source mapping.
- [ ] Define badge conditions and debrief sections.

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
3. **Map scope:** House only vs house + street; evacuation-center scene is optional.
4. **AI model:** Confirm exact model, quantization, device memory, and response latency.
5. **Survey:** Final wording and which questions may be skipped.
6. **Narrative:** Final authored event catalog, phases, and validated safety content.
7. **Branding:** Confirm Signal No. 5 name, tagline, palette, and badge names.

## 23. Final definition of success

By the end of the hackathon, a judge can open a working 8-bit typhoon preparedness game, complete a short household survey, see a personalized environment and scenario, make meaningful choices that affect later events, receive an evidence-based debrief and badge, and witness real AI inference running locally without relying on a cloud AI API. The team can explain exactly which elements are AI-generated, which are rule-based, which device runs the model, and why the resulting experience is more useful than a static preparedness guide.

---

**Document note:** This is a consolidated direction/implementation brief derived from the conversation and judging slides. The previously uploaded one-day build plan is supplementary; its 12-hour schedule, fixed cast, two-floor house, and free-text action interpreter are **not** binding requirements. All implementation specifics labeled proposed or undecided should be verified with the team before coding.
