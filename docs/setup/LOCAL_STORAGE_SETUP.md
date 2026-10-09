# Local Storage and Persistence

**Signal No. 5 does not use a database.** Persistence is a small set of **plain JSON files** in Electron's per-user application data folder (`app.getPath('userData')`). There is no SQLite, server or connection string, and nothing to install or initialise manually.

## 1. Storage architecture

| Aspect | Implementation |
|---|---|
| Mechanism | JSON files, written atomically (temp file + rename) |
| Owning module | `SaveStore` in [`src/main/persistence/saveStore.ts`](../../src/main/persistence/saveStore.ts) (Electron **main** process only) |
| Root folder | `<userData>/data`, created in [`src/main/index.ts`](../../src/main/index.ts) as `new SaveStore(path.join(app.getPath('userData'), 'data'))` |
| `<userData>` on Windows | `%APPDATA%\signal-no5`. Electron derives the folder from the app name (`package.json` `name`). Verified for both the dev and the packaged app |
| Renderer access | **Only** through `window.signal.save.*`, `window.signal.badges.*`, `window.signal.profile.*` (preload bridge → IPC). The renderer has no file-system access |
| Validation | Every write and read is checked with Zod (`GameState`, `HouseholdProfile`, badge list) in the main process |

```
%APPDATA%\signal-no5\
  data\
    games\<slot>.json     GameState (one file per save slot)
    profile.json          HouseholdProfile (optional, player-controlled)
    badges.json           { schemaVersion: 1, badgeIds: [...] } (earned across runs)
  llm-server.json         PID file for the local model server (identity check on next launch)
  llm-server.log          llama-server log: startup lines and timings only (no prompts)
  selftest.json           only written by `SignalNo5.exe --self-test`
  (Cache, GPUCache, Local Storage, …)  Chromium/Electron internals, not used by the game
```

`data\` and `games\` are **created automatically** on the first write (`mkdir -p` inside `SaveStore`). Nothing is created at launch until something is saved.

## 2. Data organisation

| Data | Stored in | Notes |
|---|---|---|
| Household profile (incl. optional medical answers) | `profile.json` **and** inside every game save (`GameState.household`) | Written only when the frontend calls `profile.write` / `save.write` |
| Medical preparedness information | Part of `HouseholdProfile.medical` (categories, yes/no answers). Never diagnoses or medication names (the survey doesn't ask) | Stored locally; **never** sent to the local model (see §7) |
| Game saves | `games/<slot>.json` | The full `GameState`: clock, phase, scene, cash, phone battery, `house`/`goBag` inventory, flags, counters, storm config, environment, evacuation, shop, pending/active events, `eventHistory`, `decisionLog`, `earnedBadges` |
| Inventory and resources | Inside the game save | `house`, `goBag`, `cash`, `phoneBattery` |
| Decision history | Inside the game save | `decisionLog[]` (`DecisionRecord` with before/after snapshots) |
| Event history | Inside the game save | `eventHistory[]`, `firedMilestones[]` |
| Achievement progress | `badges.json` | Persists across runs; merged and de-duplicated by `addBadges` |
| Generated dialogue cache | **Not persisted** | In-memory in `AIService`, keyed by `runId:eventId:variantId`; cleared when the app quits |
| Configuration preferences (volume, etc.) | **Not implemented** | Gap: no settings store exists yet |

## 3. Initialisation

There is no setup step. On launch the main process constructs `SaveStore` with the `data` path and does **not** touch the disk. Folders appear on the first save. A missing file reads as `null` (or `[]` for badges and slot lists).

## 4. Configuration

| Option | Supported? |
|---|---|
| Change the storage location | **No.** There is no environment variable or setting. The location is always `app.getPath('userData')/data`. Changing it requires a code change in `src/main/index.ts` (gap, not needed for the MVP) |
| Save slot names | Must match `^[a-z0-9][a-z0-9-]{0,31}$` (lower-case letters, digits, hyphens). Anything else is rejected, which prevents path traversal |
| Encryption | **Not implemented** (see §7) |

## 5. Save, load, delete, reset

All of these are **asynchronous** bridge calls from the renderer (types in [`src/shared/bridge.ts`](../../src/shared/bridge.ts); IPC channel names in the `IPC` constant):

| Operation | Renderer call | IPC channel | Main-process implementation |
|---|---|---|---|
| Save progress | `await window.signal.save.write(slot, engine.getState())` | `save:write` | `SaveStore.writeGame` (Zod-validates `GameState`) |
| Load progress | `const s = await window.signal.save.read(slot)` → `loadGame(s)` | `save:read` | `SaveStore.readGame` → `GameState \| null` |
| List saves | `await window.signal.save.list()` | `save:list` | `SaveStore.listGames` → sorted slot names |
| Delete a save | `await window.signal.save.remove(slot)` | `save:remove` | `SaveStore.deleteGame` |
| Store the household profile | `await window.signal.profile.write(engine.getProfile())` | `profile:write` | `SaveStore.writeProfile` |
| Read the profile | `await window.signal.profile.read()` | `profile:read` | `SaveStore.readProfile` → `HouseholdProfile \| null` |
| **Delete the household profile** | `await window.signal.profile.remove()` | `profile:remove` | `SaveStore.deleteProfile` (also delete saves; they contain the profile too) |
| Read badges | `await window.signal.badges.read()` | `badges:read` | `SaveStore.readBadges` |
| Retain achievements | `await window.signal.badges.add(evaluation.badgeIds)` | `badges:add` | `SaveStore.addBadges` (merge) |

**Runs** are engine operations in the renderer, **not** storage operations:

```ts
import { createGame, startRun, loadGame } from '../core/engine';
// New household: createGame(surveyResponses, { seed })
// Replay with the same household (new storm): startRun(engine.getProfile(), { seed: newSeed })
// Restore a save:
const saved = await window.signal.save.read('slot-1');
const r = saved ? loadGame(saved) : null;   // { ok: true, engine } | { ok: false, error: { code: 'INVALID_SAVE' } }
```

"Reset a run" = start a new run with `startRun`/`createGame`. Delete the old slot if you don't want it. Nothing is saved automatically: **the frontend decides when to call `save.write`** (gap: no autosave; suggested on `phaseChanged`).

### Example save file (abridged, real field names)

```json
{ "schemaVersion": 2, "runId": "run-b-mg2k3x", "seed": 11, "phase": "preparation", "scene": "HOUSE",
  "clock": { "gameMinutes": 30, "timeScale": 1, "pauseReasons": [] }, "landfallMinute": 2880,
  "household": { "schemaVersion": 2, "mode": "actual", "size": 4, "members": [ … ], "medical": { … }, "theme": "traditional", … },
  "cash": 800, "phoneBattery": 55, "house": { "WATER": 12, "FOOD": 4 }, "goBag": { "FLASHLIGHT": 1 },
  "flags": { "BULLETIN_CHECKED": true }, "decisionLog": [ { "seq": 1, "actionId": "CHECK_ADVISORY", … } ], … }
```

## 6. Validation and schema versions

- `GameState` and `HouseholdProfile` carry `schemaVersion: 2`. Badges use `schemaVersion: 1`.
- **Writes:** `writeGame`/`writeProfile` call `.parse()`, so invalid data throws and nothing is written. Over IPC the promise rejects.
- **Reads:** `readGame`/`readProfile` call `.safeParse()`. **Invalid JSON, a corrupted file or a different schema version returns `null`** (the file is left untouched). `loadGame(raw)` in the engine returns `{ ok: false, error: { code: 'INVALID_SAVE', issues } }` for anything that doesn't match.
- **No migrations exist.** A save from an older schema version will not load (gap; acceptable for the hackathon).

## 7. Privacy and security

| Question | Answer |
|---|---|
| Does data leave the machine? | **No.** Saves are local files. The renderer has no network access (CSP `connect-src 'none'` in builds). The model server listens on `127.0.0.1` only and requires a random per-launch API key |
| Is household data sent to the AI? | Only a **minimised summary**: household size, visible members' roles (adult, older adult, child, …), dependents yes/no, assistance yes/no, pets, home type, floors, theme. **Never** medical categories, allergies, equipment, sex or ages (`buildScenarioRequest` in `src/core/ai/scenario.ts`; verified by a test) |
| Is medical information written to logs? | No. `llm-server.log` contains only startup lines and timings (verified). The backend has no other logging of game data |
| Are save files encrypted? | **No.** Plain JSON, readable by anyone with access to the Windows user account |
| How is a profile deleted? | `window.signal.profile.remove()` deletes `profile.json`. Saves also contain the profile, so remove them with `save.remove(slot)` for each slot (`save.list()`) |
| Known limitations | No encryption. No automatic deletion. Saves duplicate the profile. Health answers are optional ("Prefer not to say" → `undisclosed`, never scored) |

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Save path not found" | Normal before the first save; folders are created on first write. Check `%APPDATA%\signal-no5\data\games` |
| Permission errors (`EPERM`/`EACCES`) | Another process (antivirus, sync tool) is locking the file, or `%APPDATA%` isn't writable. Close other copies of the app (only one instance can run) and retry |
| `save.read` returns `null` for an existing slot | The file is corrupted, isn't valid JSON, or has a different `schemaVersion`. Inspect the file; delete it if it can't be repaired |
| `loadGame` → `INVALID_SAVE` | The data didn't match `GameState`. `error.issues` lists the failing paths |
| Missing profile | `profile.read()` → `null` until `profile.write` is called. Not created automatically |
| `save.write` rejects | Invalid slot name (must match `^[a-z0-9][a-z0-9-]{0,31}$`) or state that fails `GameState` validation |
| Reset development data safely | Quit the app, then delete `%APPDATA%\signal-no5\data` (saves, profile, badges). Deleting the whole `%APPDATA%\signal-no5` folder also clears Electron caches and the model-server PID/log files. That's safe while the app is closed |
