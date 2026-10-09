# SIGNAL NO. 5 — ARCHITECTURE VALIDATION AND IMPLEMENTATION-READINESS INSTRUCTIONS

> **Revision 2.** This replaces the original 15-task / 17-document research brief. Goal: make the project **implementation-ready as quickly as possible** while keeping technical rigor, meaningful local AI inference, and the established product vision.

---

## 0. Role and objective

Act as the lead architect for a four-person team building Signal No. 5 in a **20-hour hackathon sprint**.

The objective is **not** the most sophisticated system. It is the **simplest, most reliable, technically defensible architecture** for a fully interactive, top-down, 8-bit, locally intelligent typhoon preparedness RPG, with research that **never blocks parallel development**.

**Standing prohibitions (all stages, unless explicitly approved):**
- Do not implement the application or modify application source code.
- Do not install dependencies, download model weights, or make significant system changes.
- Do not rename or silently overwrite established schemas or contracts.
- Do not edit `project_context.md` until the exact changes have been listed and approved (§2.3).

**Allowed without approval:** reading the repository, inspecting hardware and installed software (read-only commands), web research on official documentation, model cards, and published benchmarks, and creating the documents listed in §6.

---

## 1. Sources of truth

| Source | Role |
|---|---|
| `project_context.md` | **Existing source of truth** for product scope, survey, event catalog, badges, data contract (§15), checkpoints, and safety rules. Reference it; do not duplicate it. |
| §2.1 below | **Latest confirmed product direction.** Overrides `project_context.md` wherever the two conflict. |
| `CLAUDE.md` | Workflow rules (Inspect → Plan → Implement → Validate → Report). |
| *Signal No. 5 — General Project Direction Document v1.0* (team PDF) | Supplementary; already reconciled into `project_context.md`. |

Preserve every established decision that does not conflict with §2.1.

---

## 2. Requirements reconciliation (do this first)

### 2.1 Latest confirmed product direction (authoritative)

1. Signal No. 5 is a **fully interactive, top-down, 8-bit RPG-style** typhoon preparedness game.
2. The player **physically moves** through an explorable environment, interacts with objects and NPCs, and makes decisions that influence later events.
3. Floor-plan geometry is **fixed**; customization comes from palettes, sprites, props, and household configuration.
4. The household survey changes **actual scenario conditions**, not just dialogue wording.
5. **Typhoon is the only hazard** for the hackathon.
6. The outdoor/street scene is **optional** (an extended feature) for the MVP.
7. Local AI generates contextual scenario content, dialogue, and personalized explanations.
8. The AI **never directly mutates game state**. The deterministic simulation engine owns actions, consequences, resources, scoring, and safety rules.
9. **Godot 4 + GDScript is the preferred game framework**, but it must be independently verified against the strongest alternatives (§4).

**Not acceptable designs:** a visual novel, a static decision tree, a slideshow, a dialogue-only simulator, a questionnaire with illustrated results, or a text adventure with decorative backgrounds. Do not simplify toward these to reduce complexity. Movement, collision, spatial interaction, NPCs in the world, and an explorable environment are mandatory.

### 2.2 Known conflicts to resolve

| # | Topic | `project_context.md` today | Latest direction | Required action |
|---|---|---|---|---|
| C1 | Game engine | §13 default stack is Phaser 3 + TypeScript + React/Vite/Tailwind; Godot is the "alternative"; §22 lists the engine as an open decision | Godot 4 + GDScript preferred, to be verified | Verify (§4.2). If Godot is confirmed, propose §13/§22 updates. |
| C2 | Contract language | §15: Zod schemas in TypeScript (`src/core/contracts.ts`), with inferred TS types | GDScript would be the runtime language | Analyse how `ScenarioAIRequest`, `ScenarioAIResponse`, `DecisionRecord`, `DebriefEvaluation`, etc. are preserved across the boundary (§2.4). Explain the migration; don't perform it. |
| C3 | Supporting stack | IndexedDB persistence, Vitest + Playwright, Tiled JSON | Godot equivalents may replace these | Map each layer to its Godot equivalent, or justify keeping it. |
| C4 | Module layout | `src/core`, `src/ai`, `src/content`, … (TS project layout) | Godot project layout (`res://`) | Propose a Godot layout that keeps the same separation of concerns. |
| C5 | Movement | Team PDF: "four-direction movement"; `project_context.md` doesn't specify | Physical movement through an explorable environment | Confirm: continuous (non-grid-locked) four-direction movement with collision, unless research argues otherwise. |
| C6 | Outdoor scene | Already optional/extended in §8–§9 | Optional | **No conflict.** Preserve. |
| C7 | Checkpoints | §16: Hours 2 / 5 / 8 / 12 / 17 (freeze) | Not changed by the latest direction | **Preserve.** Only propose changes if the selected architecture makes them unrealistic, with justification. |
| C8 | Content scope | ≥10 events per run, 10 badges, 6 phases, 5-question survey | Not changed | **Preserve.** |

Report any **additional** conflicts discovered during inspection in the same format. Never resolve a conflict silently.

### 2.3 Rule for updating existing documents

Before editing `project_context.md`, `CLAUDE.md`, or `skill_configuration.md`:
1. List the exact sections and proposed text changes.
2. Mark each change as *required by the latest direction* or *proposed improvement*.
3. Wait for approval, then apply only the approved changes.

### 2.4 Contract preservation across a language boundary

The §15 contract is established. Names (`HouseholdProfile`, `VisualTheme`, `GameState`, `EventDefinition`, `ActionDefinition`, `DecisionRecord`, `ScenarioAIRequest`, `ScenarioAIResponse`, `ScenarioContent`, `DebriefEvaluation`, `DebriefNarration`, `BadgeDefinition`), field names (camelCase), ID conventions, and `schemaVersion` **must be preserved**.

If the runtime is GDScript, evaluate at minimum:
- **A.** JSON Schema as the canonical, language-neutral contract, generated from or replacing the Zod definitions. Validators in GDScript; Zod kept only for any TS tooling.
- **B.** Hand-written GDScript validators that mirror §15 exactly, with shared JSON fixtures as the conformance test.
- **C.** Typed Godot `Resource` classes for authored content (events, actions, badges), with JSON only at the AI boundary.

For the recommended option, state: what is canonical, where validation runs, how drift between the documented contract and the code is caught (shared fixtures), how camelCase JSON keys map onto GDScript naming style, and whether any field genuinely must change. **A change is allowed only for a verified architectural reason, explained before implementation.**

---

## 3. Workflow: Superpowers first

### 3.1 Skill discovery
Before substantive work, list the installed skills and read the actual `SKILL.md` of every skill you intend to use. Do not assume a skill exists or recall its contents from memory.

### 3.2 Superpowers mapping (verify against current skill text)

| Stage | Superpowers skill | How it applies |
|---|---|---|
| A | `superpowers:brainstorming` (**architectural path**) | Explore context → clarifying questions **one at a time** → 2–3 approaches with a recommendation → present the design **in sections, with approval after each** → write the spec → self-review → user reviews the spec. |
| B | `superpowers:brainstorming` (**spike path**) | Present the benchmark/PoC question and probe plan → get approval → run it as cheaply as correctness allows → report findings. Spike code is throwaway. |
| C | `superpowers:writing-plans` | Only after the spec is approved. Produces `IMPLEMENTATION_PLAN.md`. |
| All | `superpowers:verification-before-completion` | No claim (compatibility, latency, "works offline") without evidence. |
| Optional | `superpowers:dispatching-parallel-agents` | Only if the user approves subagents. Use it to group independent research (e.g. model research ∥ engine research). |

**Approval gates are mandatory.** Grouping independent research is allowed; skipping a brainstorming approval gate is not.

### 3.3 Supporting skills (use only where they materially help)
- **Local AI:** `huggingface-skills:huggingface-local-models` (GGUF/llama.cpp/quantization), `huggingface-skills:huggingface-best` (model selection for the hardware), `huggingface-skills:hf-mem` (memory estimates).
- **Verification/review:** `code-review` / `superpowers:requesting-code-review` for reviewing the spec or plan, if useful.

**Do not use** frontend/design/animation skills, Vercel skills, or training skills in this task. List skills considered and rejected in `ARCHITECTURE_LOCK.md` (one line each). **Never claim a skill was used unless it was actually invoked and followed.**

---

## 4. Stage A — Inspect, reconcile, and recommend (current stage)

**Goal:** a preliminary architecture recommendation **as soon as the critical decisions can be reasonably supported**. Not exhaustive coverage.

### 4.1 Inspection (no approval needed)
- Repository contents, existing docs, any manifests.
- **Hardware:** CPU model and core count, RAM, GPU model and VRAM, free disk space, OS version. Use read-only commands; record the exact command output in the doc.
- Installed software: Godot, Python, Node, Ollama, llama.cpp, Git (versions, or "not installed").
- Whether a demo device or Android phone has been identified (ask if unknown; never assume).

### 4.2 Research topics, in priority order
Spend effort proportional to decision impact. Don't research low-impact alternatives in depth.

1. **Godot 4 + GDScript feasibility.** Exact recommended stable version; `TileMapLayer`, `CharacterBody2D`, `AnimatedSprite2D`, `Area2D`, `CanvasLayer`/`Control`, autoloads, `FileAccess`/JSON, `HTTPRequest`, GDExtension, Android export. Verify each API against that exact version's docs.
2. **Comparison with the strongest alternatives:** Phaser 3 (+ TS), and **one** Python option (Pygame-ce *or* Arcade, whichever is stronger). Weighted matrix:

   | Criterion | Weight |
   |---|---:|
   | Interactive 2D gameplay | 25% |
   | 20-hour feasibility (incl. team skills) | 20% |
   | Local AI integration | 20% |
   | Offline deployment | 15% |
   | Pixel-art customization | 10% |
   | Cross-platform (Windows/Android) | 5% |
   | Maintainability | 5% |

   Adjust weights only with stated justification. Label scores as *engineering judgement* vs *verified*.
3. **PySide6 relevance.** Answer directly: is a Qt wrapper needed for a standalone game? (The expected answer is no. Verify it.) Distinguish supported approaches from fragile workarounds (e.g. embedding a Pygame window in Qt). One short section, not a report.
4. **Local model selection.** Small instruction models that run under llama.cpp/GGUF (Qwen3 small, Gemma small, Phi small, SmolLM, others if justified). For each: exact ID, parameters, quantizations, file size, RAM need, context length, license and redistribution terms, published structured-output/instruction-following evidence. Recommend a **primary** model and a **lightweight fallback**. Prioritize valid short JSON over prose quality. Never invent figures.
5. **Inference runtime.** Ollama (HTTP), llama.cpp server (HTTP), embedded llama.cpp via a Godot GDExtension. Judge each for: development, Windows laptop demo, packaged desktop, standalone Android. Include grammar/JSON-schema-constrained output support, startup/model-load time, bundling, and failure recovery.
6. **Deployment.** Windows export with the model and runtime bundled or installed separately (the game package does **not** automatically include the model). Standalone Android inference requirements. What's realistic in 20 hours vs. deferred.
7. **Integration complexity and offline operation.** The full inference path with networking disabled; where it can fail; fallback behavior.

### 4.3 Stage A outputs
1. **Reconciliation report:** the conflicts table (§2.2) with a proposed resolution for each, plus any new conflicts.
2. **Preliminary architecture recommendation:** engine and exact version, language, model (primary + fallback), runtime for dev / demo / Android, contract strategy (§2.4), Python service yes/no (default **no** unless it provides a clear, stated advantage).
3. **First architecture decisions for approval** (§4.4).
4. **Stage B benchmark proposal** (§5).
5. **Parallel-work list** (§7).
6. **Proposed edits** to `project_context.md` (§2.3). Not applied yet.

Present these through the brainstorming flow (questions → approaches → sectioned design approval). After approval, write `ARCHITECTURE_LOCK.md` (draft), `MODEL_AND_RUNTIME_RESEARCH.md`, and `GAME_FRAMEWORK_AND_DEPLOYMENT.md`.

### 4.4 Decisions that must be surfaced in Stage A
- **D1 Demo target:** laptop-local Windows demo vs standalone Android. This is the highest risk, and it drives D3.
- **D2 Engine:** Godot 4.x (exact version) confirmed or replaced.
- **D3 Runtime:** development runtime and demo runtime (e.g. Ollama over localhost vs embedded llama.cpp).
- **D4 Model:** primary and fallback, pending the Stage B benchmark.
- **D5 Contract strategy** across the TS→GDScript boundary (§2.4).
- **D6 Python service:** needed or not.
- **D7 Benchmark approval:** what to install and download (§5).

---

## 5. Stage B — Minimal proof of concept (after approval only)

**Benchmark proposal (Stage A deliverable).** Propose the *smallest useful* benchmark, stating:
- What will be installed, from where, and the expected download size, taken from official sources, not memory.
- Disk, RAM, and VRAM expected to be used.
- The exact commands.
- **Success criteria**, at minimum:
  - The model returns a `ScenarioAIResponse` that passes validation for 2 contrasting household profiles.
  - It works with networking disabled.
  - Report the measured JSON-valid rate over N ≥ 20 runs.
  - Report time-to-first-token and total latency.
  - Report peak memory.
- How everything will be removed afterward, if desired.

**PoC scope (after approval).** It must prove the riskiest path end to end, as throwaway spike code:
1. The game app launches; the player moves through a tile room with collision.
2. The player interacts with an object or NPC.
3. A sample `HouseholdProfile` is loaded.
4. The game sends a `ScenarioAIRequest` to the local model **with networking disabled**.
5. The response passes validation; invalid output triggers a fallback.
6. Generated dialogue is displayed.
7. The player picks an action; the deterministic engine updates state.
8. A later event reflects that decision.

Record **measurements**, not estimates. Report results as a recommendation. Spike code is labeled throwaway and isn't merged unless separately approved.

---

## 6. Documentation (≈6 focused documents)

Location: `docs/architecture/`. **Reference `project_context.md` section numbers instead of copying product specs.** Cross-reference between docs; avoid duplication.

| Document | Contents | Written in stage |
|---|---|---|
| `ARCHITECTURE_LOCK.md` | **The approved design spec.** Final decisions (D1–D7) with alternatives, evidence, and unresolved assumptions; contract strategy; reconciliation outcomes; skills used/rejected. A one-page "what is locked" summary at the top. | A (draft) → C (locked) |
| `MODEL_AND_RUNTIME_RESEARCH.md` | Model candidates, runtime comparison, sources, Stage B benchmark plan, then results | A → B |
| `GAME_FRAMEWORK_AND_DEPLOYMENT.md` | Weighted matrix, Godot API verification, PySide6/Python conclusion, Windows/Android packaging, model distribution | A |
| `SYSTEM_ARCHITECTURE.md` | Component and data-flow Mermaid diagrams; Godot scene hierarchy and project layout; AI adapter, validation, fallback; generation strategy (dynamic vs pre-generated vs hybrid, with a recommendation); prompt templates and context budget; how two profiles diverge in *gameplay conditions*; persistence | C |
| `IMPLEMENTATION_PLAN.md` | Produced via `superpowers:writing-plans`. Task sequence aligned to the `project_context.md` §16 checkpoints; which tasks are framework-dependent | C |
| `TESTING_AND_RISKS.md` | Minimal automated test strategy (contract fixtures, simulation unit tests, AI validation tests, offline test); risk register (probability, impact, early warning, mitigation, fallback); cut order (reference §16) | D |

> **Location note:** the brainstorming skill's default spec location is `docs/superpowers/specs/`. This project stores the approved spec as `docs/architecture/ARCHITECTURE_LOCK.md` instead. Confirm this choice during Stage A.

---

## 7. Parallel development: research must not block the team

During Stage A, produce early:
- **Mock payloads:** valid `ScenarioAIRequest`/`ScenarioAIResponse` JSON for at least two contrasting profiles (e.g. *alone + go-bag ready* vs *with others + assistance needed + go-bag partial*) plus **invalid** examples (unknown action ID, bad JSON, over-length text) for validator tests. These use the existing §15 contract unchanged.
- **Classification of every workstream** as *architecture-independent* (start now) or *framework/runtime-dependent* (wait for D2/D3).

Expected architecture-independent work (confirm in Stage A):

| Work | Owner (`project_context.md` §14) |
|---|---|
| Authoring the 11 events, action effects, variants, and reviewed fallback text as data | Backend A + content |
| 10 badge conditions and debrief findings/checklist text | Backend A |
| Curating Philippine safety sources (PAGASA, NDRRMC/OCD, Philippine Red Cross) into `SR_*` rules with source, date, and principle | Shared |
| Survey copy and privacy text (already drafted in §7) | Frontend B |
| Selecting licensed 16×16 tilesets and sprites; palette presets; house floor-plan layout on paper or in Tiled | Frontend A |
| Prompt drafts and the mock-payload test set | Backend B |
| UI wireframes (survey, HUD, dialogue, debrief, badges) | Frontend B |

Framework-dependent work (wait for the decision): scene and map implementation, the player controller, UI implementation, engine/validator code, AI adapter transport, persistence, packaging.

---

## 8. Stages C and D

**Stage C — Finalize (after Stage B results):** lock `ARCHITECTURE_LOCK.md`, write `SYSTEM_ARCHITECTURE.md`, run `superpowers:writing-plans` to produce `IMPLEMENTATION_PLAN.md`, and apply the approved `project_context.md` edits.

**Stage D — Supporting docs (non-blocking):** `TESTING_AND_RISKS.md` and remaining safety-source documentation. Development proceeds in parallel; Stage D must never gate implementation.

---

## 9. Evidence rules

- Use official docs, model cards, maintainer repos, and published benchmarks. Include the **URL and access date** for every external claim.
- Label every claim as **Verified** (source), **Measured** (Stage B), **Estimate** (engineering judgement), **Proposed**, or **Unverified**.
- Never fabricate benchmarks, compatibility, hardware specs, licensing, or packaging capabilities.
- Never claim on-phone inference when inference runs on a laptop; never substitute cloud inference silently.

---

## 10. Stage A final response format

1. **Reconciliation:** conflicts found and proposed resolutions.
2. **Preliminary recommendation:** engine/version, language, model, runtime, contract strategy, deployment.
3. **Godot verdict:** whether it's genuinely the strongest choice, and against what.
4. **PySide6/Python conclusion** (2–4 sentences).
5. **Decisions requiring approval:** D1–D7, each with a recommendation.
6. **Benchmark proposal:** downloads, resources, commands, success criteria.
7. **Parallel work the team can start now.**
8. **Proposed `project_context.md` edits** (not applied).
9. **Skills used** (only those actually invoked).

**Research first. Verify assumptions. Await approval at every gate.**
