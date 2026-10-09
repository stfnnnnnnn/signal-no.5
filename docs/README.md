# Documentation Index

**Types:**
- **Spec:** source specification (what the game must do).
- **Ref:** implementation reference (how the code does it).
- **Guide:** operational how-to.
- **History:** research or decision record. Read for context; it's not current instructions.

When two documents disagree:
1. **The code** (`src/shared/contracts`, `src/core/engine.ts`) wins.
2. Then [SPEC_RECONCILIATION.md](implementation/SPEC_RECONCILIATION.md).
3. Then the specs in `specs/`.

## 1. Project overview
| Document | Description | Audience | Type |
|---|---|---|---|
| [../README.md](../README.md) | What Signal No. 5 is, status, stack, quick start, structure, limitations | Everyone | Guide |
| [../project_context.md](../project_context.md) | Original product direction (vision, principles, judging, safety stance). **Partly superseded:** its 5-question survey, 11-event catalog, badges, phases and stack table were replaced (see SPEC_RECONCILIATION and ARCHITECTURE_LOCK Appendix A) | Everyone | Spec (partly superseded) |

## 2. Game design specifications
| Document | Description | Audience | Type |
|---|---|---|---|
| [specs/SIGNAL_NO_5_COMPLETE_GAME_DESIGN.md](specs/SIGNAL_NO_5_COMPLETE_GAME_DESIGN.md) | Game Design v3.0: journey, clock, actions, shop, storm, events, evacuation, scoring, badges, AI director | All developers | Spec (behaviour authority) |
| [specs/SIGNAL_No5_Game_Settings_and_Configuration_Variables_Formatted.md](specs/SIGNAL_No5_Game_Settings_and_Configuration_Variables_Formatted.md) | 17 categories of variables and defaults (includes workbook values that are now deprecated) | Backend, content | Spec (variable inventory) |
| [specs/SIGNAL_No5_Household_Health_Environmental_Character_Configuration_Form_Formatted.md](specs/SIGNAL_No5_Household_Health_Environmental_Character_Configuration_Form_Formatted.md) | The 26-question household form | Frontend (survey), backend | Spec (survey wording authority) |
| [implementation/SPEC_RECONCILIATION.md](implementation/SPEC_RECONCILIATION.md) | Conflicts between the specs and how they were resolved; deprecated variables; defaults chosen | All developers | Ref |

## 3. Backend architecture
| Document | Description | Audience | Type |
|---|---|---|---|
| [architecture/ARCHITECTURE_LOCK.md](architecture/ARCHITECTURE_LOCK.md) | Approved stack and process boundaries, PoC results, proposed `project_context` edits (Appendix A) | Backend, leads | Ref (draft) |
| [architecture/GAME_FRAMEWORK_AND_DEPLOYMENT.md](architecture/GAME_FRAMEWORK_AND_DEPLOYMENT.md) | Why Phaser + React + Electron (vs Godot, Tauri, Python) | Leads | History |
| [architecture/MODEL_AND_RUNTIME_RESEARCH.md](architecture/MODEL_AND_RUNTIME_RESEARCH.md) | Model and runtime research, measured benchmarks (§6) | Backend | History + measurements |
| [implementation/IMPLEMENTATION_PLAN.md](implementation/IMPLEMENTATION_PLAN.md) | Backend milestone status and next steps | Backend, leads | Ref |
| [implementation/REQUIREMENT_TRACEABILITY.md](implementation/REQUIREMENT_TRACEABILITY.md) | Each spec requirement → module → status → test | Backend, reviewers | Ref |

## 4. Household configuration
| Document | Description | Audience | Type |
|---|---|---|---|
| [implementation/SURVEY_TO_GAMESTATE_MAPPING.md](implementation/SURVEY_TO_GAMESTATE_MAPPING.md) | All 26 questions → field, validation, profile, gameplay effect, privacy | Frontend (survey), backend | Ref |

## 5. Simulation mechanics
| Document | Description | Audience | Type |
|---|---|---|---|
| [specs/SIGNAL_NO_5_COMPLETE_GAME_DESIGN.md](specs/SIGNAL_NO_5_COMPLETE_GAME_DESIGN.md) §3–§15 | Rules as designed | All | Spec |
| [implementation/REQUIREMENT_TRACEABILITY.md](implementation/REQUIREMENT_TRACEABILITY.md) | Where each mechanic lives in `src/core` | Backend | Ref |

## 6. AI integration
| Document | Description | Audience | Type |
|---|---|---|---|
| [setup/LOCAL_AI_SETUP.md](setup/LOCAL_AI_SETUP.md) | Runtime, model, configuration, validation, grounding guard, fallback, troubleshooting | Backend, demo machine owner | Guide |

## 7. Local storage and persistence
| Document | Description | Audience | Type |
|---|---|---|---|
| [setup/LOCAL_STORAGE_SETUP.md](setup/LOCAL_STORAGE_SETUP.md) | JSON files in Electron userData: layout, APIs, validation, privacy, troubleshooting | Frontend, backend | Guide |

## 8. Development setup
| Document | Description | Audience | Type |
|---|---|---|---|
| [setup/DEVELOPMENT_SETUP.md](setup/DEVELOPMENT_SETUP.md) | Node version, install, scripts, environment variables, no-model mode, troubleshooting | Everyone | Guide |
| [../CLAUDE.md](../CLAUDE.md) | Instructions for Claude Code sessions in this repo | AI-assisted development | Guide |
| [../skill_configuration.md](../skill_configuration.md) | Installing the Claude Code skills/plugins used here | AI-assisted development | Guide |

## 9. Frontend integration
| Document | Description | Audience | Type |
|---|---|---|---|
| [frontend/README.md](frontend/README.md) | **Start here (frontend):** what's done, what to build, ownership | Frontend | Guide |
| [frontend/FRONTEND_GETTING_STARTED.md](frontend/FRONTEND_GETTING_STARTED.md) | Setup, mock data, first milestone, common mistakes | Frontend | Guide |
| [frontend/FRONTEND_BACKEND_INTEGRATION.md](frontend/FRONTEND_BACKEND_INTEGRATION.md) | Every API call, with types, examples, errors and gaps | Frontend | Ref |
| [frontend/UI_GAMEPLAY_REQUIREMENTS.md](frontend/UI_GAMEPLAY_REQUIREMENTS.md) | Scenes, sprites, HUD, overlays (MVP vs optional) | Frontend | Spec digest |
| [implementation/FRONTEND_BACKEND_CONTRACTS.md](implementation/FRONTEND_BACKEND_CONTRACTS.md) | **Scene directive contract** (weather, lighting, flood, props, NPC cues, audio): authority rules, runtime flow, every asset ID the frontend must provide | Frontend (Phaser), backend | Ref |

## 10. Testing
| Location | Description |
|---|---|
| `tests/*.test.ts` | Household, init, actions, clock/scheduler, shop, storm/evacuation/aftermath, evaluation/badges, AI context/validation/guard |
| `tests/main/*.test.ts` | Model-server manager (real child process + `fake-llama-server.mjs`), AI service (real HTTP fake model), save store (temp folders) |
| `tests/helpers.ts`, `tests/fixtures/households.ts` | `newGame`, `playToEnd`, `resolveFirst`; `familySurvey()`, `aloneSurvey()` |

Run with `npm test` (289 tests) and `npm run typecheck`. The packaged app has a `--self-test` mode ([WINDOWS_PACKAGING.md §4](setup/WINDOWS_PACKAGING.md#4-packaged-self-test)). There are no UI or E2E tests yet (Playwright is not installed).

## 11. Packaging
| Document | Description | Audience | Type |
|---|---|---|---|
| [setup/WINDOWS_PACKAGING.md](setup/WINDOWS_PACKAGING.md) | `npm run pack`, the portable folder layout, first launch, self-test, the pending offline test | Backend, demo owner | Guide |

## 12. Known limitations
These are summarised in [../README.md#known-limitations](../README.md#known-limitations) and tracked in [implementation/IMPLEMENTATION_PLAN.md](implementation/IMPLEMENTATION_PLAN.md):
- the frontend isn't built;
- the airplane-mode test is pending;
- the model choice is provisional;
- educational content needs review;
- saves are unencrypted;
- there are integration gaps G1–G10 ([frontend/FRONTEND_BACKEND_INTEGRATION.md §18](frontend/FRONTEND_BACKEND_INTEGRATION.md#18-known-gaps)).

## Historical / superseded
| Document | Status |
|---|---|
| [../instruction.md](../instruction.md) | Stage-A architecture research brief (completed; it still names Godot as preferred, which was later replaced by Phaser + Electron) |
| `spikes/poc-electron-llm/` | Throwaway proof of concept (Electron → llama-server), kept as evidence; not used by `src/` |
