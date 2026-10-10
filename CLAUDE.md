# CLAUDE.md

Before planning, implementing, or modifying this project,
read project_context.md.

Treat it as the primary product direction document.

Follow the Inspect → Plan → Implement → Validate → Report
workflow for development tasks.

Distinguish confirmed requirements from proposed technologies
and unresolved decisions.

Prioritize a working 20-hour hackathon prototype, meaningful
local AI inference, educational accuracy, and the established
8-bit pixel-art visual identity.

When asked to set up skills or plugins, follow skill_configuration.md.
Run the install steps yourself (using the `claude plugin` CLI), then
list the sign-in steps the user must complete themselves.

## Repository guide

- Start with docs/README.md (documentation index). Where documents
  disagree, the code wins, then docs/implementation/SPEC_RECONCILIATION.md,
  then docs/specs/. Parts of project_context.md are superseded (see the index).
- Ownership: the backend (src/core, src/shared, src/main, src/preload,
  scripts, tests) is complete and owned by the backend developer. The
  frontend (src/renderer: React screens + Phaser scenes) is built separately.
  Don't modify the other side without being asked.
- Authoritative contracts: src/shared/contracts/*.ts (Zod), src/shared/bridge.ts
  (window.signal), src/core/engine.ts (public engine API). Extend them;
  don't rename or replace them. Bump schemaVersion on incompatible changes.
- One simulation engine only: all rules, costs, eligibility, prices, scoring
  and state live in src/core. UI code renders engine state and sends commands.
- The renderer gets no Node or privileged APIs: everything goes through the
  preload bridge, and the main process Zod-validates every IPC payload.
- Frontend code never calls the model server directly. AI text goes through
  window.signal.ai.*; the AI never mutates state and always has a reviewed fallback.
- No invented medical or disaster-safety guidance. Fallback text, lessons and
  checklist live in src/core/content and are pending review against official sources.
- Don't reopen settled architecture (Phaser + React + Electron + llama.cpp)
  without a verified blocking reason.
- Verify with `npm test` and `npm run typecheck` (Node ≥ 22.12). Never commit
  models, runtime binaries, build output or user data (see .gitignore).
