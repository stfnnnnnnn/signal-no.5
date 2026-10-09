# Backend Implementation Plan and Status

The milestones follow the backend directive (§15). They are tracked here; details are in the traceability matrix.

| Milestone | Scope | Status | Evidence |
|---|---|---|---|
| 1. Foundation | Contracts, state, initialisation, action registry, deterministic transitions, decision log, public API | ✅ | `init.test`, `actions.test` |
| 2. Household personalisation | 26-question validation, fictional and partial generation, roster/NPCs, starting resources, eligibility | ✅ | `household.test`, `init.test` |
| 3. Time and preparation | Hybrid clock 1–32×, scheduler, inventory, go-bag, actions, shop | ✅ | `clock.test`, `shop.test` |
| 4. Typhoon simulation | Phases, EV01–16, variants, evacuation, impact, aftermath | ✅ | `storm.test` (mutation-checked) |
| 5. Local AI and evaluation | Context builder, prompts, constrained schema, validation + grounding guard, fallback, scoring, badges, debrief | ✅ | `evaluation.test`, `ai.test`, guard run over 60 real benchmark outputs |
| 6. Persistence and deployment | Save/load, badges, profile, LLM lifecycle, IPC bridge, packaging, self-test | 🟡 | `main/*.test`; packaged self-test passed. **Airplane-mode run pending** |

**Frontend handoff (2026-10-09):** added the docs (root README, docs index, setup guides, frontend hub) and `GameEngine.getShopCatalog()` (tested). Known integration gaps G1–G10 are listed in `docs/frontend/FRONTEND_BACKEND_INTEGRATION.md` §18.

## Next (priority order)
1. **Airplane-mode run** of the packaged `SignalNo5.exe --self-test`. This needs the team: networking off.
2. **Frontend integration:** replace `src/renderer/harness.ts` with React + Phaser and use `FRONTEND_BACKEND_CONTRACTS.md`. Backend support: pair on the first event dialog.
3. **Model decision (4B vs 1.7B):** the guard flagged 9 of 30 Qwen3-4B and 6 of 30 Qwen3-1.7B benchmark outputs; flagged outputs fall back to reviewed text. Re-run the 30-request benchmark with the hardened prompt (`src/core/ai/prompts.ts`) and the guard, and compare the fallback rate.
4. **Content review:** fallback text, lessons and checklist (`content/events.ts`, `content/findings.ts`) against PAGASA/NDRRMC/PRC.
5. **RTX 4050 laptop:** check `nvidia-smi` for the driver version, then run the packaged self-test there.
6. Apply the `project_context.md` edits (ARCHITECTURE_LOCK Appendix A, plus survey/catalog/scoring updates from SPEC_RECONCILIATION).

## Commands
`npm test` · `npm run typecheck` · `npm run build` · `npm run pack` · `dist/win-unpacked/SignalNo5.exe --self-test` (writes `%APPDATA%\signal-no5\selftest.json`)
