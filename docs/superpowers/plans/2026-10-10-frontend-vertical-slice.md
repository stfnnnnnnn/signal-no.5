# Frontend Vertical Slice (M1–M4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable first slice in the Electron app. A real household is created, the player walks a fixed pixel-art house with collisions, resolves the opening event (AI or fallback text), uses the phone to `CHECK_BULLETIN` then `SHARE_VERIFIED_ADVISORY`, and sees exactly one Bayanihan toast driven by the engine's `badgeEarned` event.

**Architecture:**
- One `EngineStore` singleton wraps the backend `GameEngine` and is the only game state.
- React renders overlays (HUD, prompt, menu, event dialog, toasts) from the store and a tiny `uiStore`.
- Phaser renders the world, owns movement and collision, and advances game time by calling `store.tick(delta)` from the House scene's `update`.
- All rules come from `src/core`. AI text comes only through `window.signal.ai`, with core fallbacks.

**Tech Stack:** Electron 44 + electron-vite 5 + Vite 7, React 19.3, Phaser 3.90.0 (Arcade physics), TypeScript 7, Vitest 5, pngjs 7 (asset prep only).

**Spec:** `docs/frontend/FRONTEND_IMPLEMENTATION_BLUEPRINT.md` (approved as the spec; §2, §4, §5.1, §5.12, §6.2, §6.5, §7, §8, §10 M1–M4). APIs: `docs/frontend/FRONTEND_BACKEND_INTEGRATION.md`.

## Global Constraints

- Frontend owns only `src/renderer/**`, `package.json` dependencies and scripts, the `renderer` block of `electron.vite.config.ts`, `tsconfig.renderer.json`, `tests/renderer/**`. Never edit `src/core`, `src/shared`, `src/main`, `src/preload`, `scripts`, or existing tests.
- Root `tsconfig.json`: the only permitted change is adding `"src/renderer"` to `exclude` (the renderer gets its own tsconfig).
- Backend tests must stay green: `npm test` = 329 existing tests plus the new renderer tests. `npm run typecheck` must stay clean.
- Node ≥ 22.12 (installed: 24.20.0 at `C:\Program Files\nodejs`).
- Phaser `3.90.0` exactly, with `pixelArt: true` and `roundPixels: true`. Base resolution 384×216. 16×16 tiles. Movement 4-direction at 90 px/s. Interaction radius 24 px. Keys E/Space.
- Production CSP (set by main, never by a renderer `<meta>`): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; connect-src 'none'`. Images must load via `HTMLImageElement`; there are no XHR-loaded JSON/tilemaps and no WebAudio.
- The UI never computes rules. Labels, availability, reasons, costs and badges come from engine calls.
- No neighbour NPC (no Aling Nena or any named neighbour). Bayanihan uses only `LIVING_PHONE` and `ENTRANCE_DOOR`.
- The label is "wellbeing", never "health". Fictional framing: never present advisories as real forecasts.
- Exact backend IDs are used verbatim (interactables, actions, badge `iconAssetId`s).
- Original art in `/assets` stays untracked. Only processed outputs under `src/renderer/assets/` are committed.

## Review Focus

1. **Production-only CSP failures.** Phaser loads fine in `npm run dev` but images are blocked in the built app. Expected: the built app logs `[signal] boot ok` with zero missing textures. Pinned by the Task 5 Step 7 smoke run.
2. **Interacting while an event is open or a menu is showing.** Expected: no crash and no second menu. Phaser input is frozen while an overlay is open, and `interact` with `EVENT_PENDING` shows the engine message. Pinned by a test in Task 6.
3. **AI unavailable, slow, throwing, or `window.signal` absent.** Expected: fallback text appears, choices are usable immediately, and text for a stale event key is discarded. Pinned by tests in Task 7.
4. **Duplicate Bayanihan toast** (repeat renders, StrictMode double effects, repeated share attempts). Expected: exactly one toast per `badgeEarned`. Pinned by tests in Tasks 3 and 8.
5. **Sharing before checking official information.** Expected: the menu item is disabled and shows the engine reason ("Check official information first…"). Pinned by a test in Task 6.

---

## File Structure

```
tsconfig.renderer.json                    renderer typecheck (jsx, vite/client)
src/renderer/
  index.html                              replaces harness page
  styles.css                              pixel UI styling
  main.tsx                                React root
  vite-env.d.ts                           vite/client types
  app/App.tsx                             slice shell: starts game, mounts world + overlays
  app/sliceHousehold.ts                   hard-coded CustomOnboarding for the slice (until M5 onboarding)
  state/engineStore.ts                    EngineStore (only game state) + singleton `store`
  state/uiStore.ts                        overlay/prompt/toast state + singleton `ui`
  state/hooks.ts                          useEngineState, useUi (useSyncExternalStore)
  state/interactionController.ts          interactWith / runMenuAction (store + ui glue)
  services/ai.ts                          requestScenario (cached, fallback-safe), AI status
  game/layout.ts                          fixed house_fixed_v1 layout: rooms, doors, anchors, grid (pure)
  game/proximity.ts                       nearestAnchor (pure)
  game/assets.ts                          Vite-imported asset URLs + texture keys
  game/config.ts                          Phaser game config
  game/scenes/Boot.ts                     loads images, generates tiles/placeholders
  game/scenes/House.ts                    tilemap, player, collisions, prompt, interact, tick
  game/PhaserGame.tsx                     mounts/destroys Phaser
  ui/Hud.tsx  ui/InteractionPrompt.tsx  ui/InteractionMenu.tsx  ui/DiscoveryCard.tsx  ui/EventDialog.tsx  ui/Toasts.tsx
  ui/format.ts                            formatClock (pure)
  tools/prepareAssets.mjs                 one-off asset processing (pngjs)
  assets/sprites/{boy,girl,mom,dad}.png   32×32 frame sheets (8 cols × 4 rows)
  assets/sprites/characters.json          frame map per character
  assets/items/*.png                      32×32 interactable sprites
  assets/badges/<iconAssetId>.png         96×96 badge/achievement icons
  assets/LICENSES.md                      provenance of art
tests/renderer/*.test.ts                  store, layout, proximity, controller, ai, assets, format
```

---

### Task 1: Renderer scaffold (F0)

**Files:**
- Modify: `package.json`, `electron.vite.config.ts` (renderer block), `tsconfig.json` (exclude only)
- Create: `tsconfig.renderer.json`, `src/renderer/index.html` (replace), `src/renderer/main.tsx`, `src/renderer/vite-env.d.ts`, `src/renderer/styles.css`, `src/renderer/app/App.tsx` (placeholder)
- Delete: `src/renderer/harness.ts`

**Interfaces:**
- Produces: `npm run typecheck` checks both configs. The React root mounts `<App/>` into `#root`.

- [ ] **Step 1: Install dependencies** (PowerShell; put Node on PATH first)

```powershell
$env:PATH="C:\Program Files\nodejs;$env:PATH"
npm install -E react@19.3.0 react-dom@19.3.0 phaser@3.90.0
npm install -E -D @vitejs/plugin-react@5.2.0 @types/react@19 @types/react-dom@19 pngjs@7.0.0 @types/pngjs
```

- [ ] **Step 2: Typecheck script.** In `package.json`, set:

```json
"typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.renderer.json",
```

Root `tsconfig.json` → `"exclude": ["node_modules", "spikes", "dist", "out", "src/renderer"]`.

`tsconfig.renderer.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "jsx": "react-jsx", "types": ["vite/client"], "lib": ["ES2023", "DOM", "DOM.Iterable"] },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx"],
  "exclude": ["node_modules", "src/renderer/tools"]
}
```

- [ ] **Step 3: Vite renderer plugin.** Edit `electron.vite.config.ts`: add `import react from '@vitejs/plugin-react';` and in `renderer` add `plugins: [react()],` (keep `root` and `build` unchanged).

- [ ] **Step 4: Page and root**

`src/renderer/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Signal No. 5</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

`src/renderer/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/renderer/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/bridge';
import './styles.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

`src/renderer/app/App.tsx` (placeholder; replaced in Task 8):
```tsx
export function App() {
  return <div className="boot">SIGNAL NO. 5</div>;
}
```

`src/renderer/styles.css`:
```css
:root {
  --bg: #10141f; --panel: #1b2236; --panel-2: #2b3550; --ink: #e8e6d9; --muted: #9aa3b8;
  --gold: #f2c14e; --sky: #9fd0ff; --ok: #5fb36a; --warn: #d9734e; --danger: #e05561;
  --font: ui-monospace, 'Cascadia Mono', Consolas, monospace;
}
* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; background: var(--bg); color: var(--ink); font: 14px/1.45 var(--font); }
.boot { display: grid; place-items: center; height: 100%; color: var(--gold); letter-spacing: .2em; }
```

- [ ] **Step 5: Delete the harness.** `git rm src/renderer/harness.ts`

- [ ] **Step 6: Verify**

Run: `npm run typecheck; npm test; npm run build`
Expected: typecheck exits 0. 329 tests pass. The build writes `out/renderer/index.html`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json electron.vite.config.ts tsconfig.json tsconfig.renderer.json src/renderer
git commit -m "Frontend F0: React + Phaser renderer scaffold replaces backend harness"
```

---

### Task 2: Asset preparation (processed sprites, items, badges)

**Files:**
- Create: `src/renderer/tools/prepareAssets.mjs`, `src/renderer/assets/**` (generated), `src/renderer/assets/LICENSES.md`, `tests/renderer/assets.test.ts`
- Modify: `package.json` (script `"assets": "node src/renderer/tools/prepareAssets.mjs"`)

**Interfaces:**
- Produces:
  - `src/renderer/assets/sprites/<base>.png` for base ∈ `boy|girl|mom|dad`: 256×128, 8 cols × 4 rows of 32×32. Rows: 0 down, 1 left, 2 right, 3 up. Cols 0–1 idle, 2–5 walk.
  - `characters.json` has the shape `Record<base, { idle: Record<Dir, number[]>; walk: Record<Dir, number[]> }>` with `Dir = 'down'|'left'|'right'|'up'` and frame index = row*8+col.
  - `items/<name>.png` (32×32) for `phone, radio, cupboard, drawers, document, medicines, shelf, water, door, bag, window, first_aid_kit, flashlight, powerbank, batteries, cannedfood, blanket, checklist, gate, raincot, whistle`.
  - `badges/<iconAssetId>.png` (96×96) for all 12 badges and 10 achievements.

- [ ] **Step 1: Write the failing test** `tests/renderer/assets.test.ts`

```ts
import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { BADGE_CATALOG } from '../../src/core/content/badges';
import { ACHIEVEMENT_CATALOG } from '../../src/core/content/achievements';

const A = 'src/renderer/assets';
const png = (p: string) => PNG.sync.read(readFileSync(p));

describe('processed assets', () => {
  it('has a 96px icon for every badge and achievement iconAssetId', () => {
    for (const m of [...BADGE_CATALOG, ...ACHIEVEMENT_CATALOG]) {
      const p = `${A}/badges/${m.iconAssetId}.png`;
      expect(existsSync(p), p).toBe(true);
      expect(png(p).width).toBe(96);
    }
  });
  it('has 256x128 sheets and complete frame maps for all four characters', () => {
    const map = JSON.parse(readFileSync(`${A}/sprites/characters.json`, 'utf8'));
    for (const base of ['boy', 'girl', 'mom', 'dad']) {
      const s = png(`${A}/sprites/${base}.png`);
      expect([s.width, s.height]).toEqual([256, 128]);
      for (const anim of ['idle', 'walk']) for (const dir of ['down', 'left', 'right', 'up'])
        expect(map[base][anim][dir].length, `${base}.${anim}.${dir}`).toBeGreaterThan(0);
    }
  });
  it('has the interactable item sprites used by the house', () => {
    for (const n of ['phone', 'radio', 'cupboard', 'drawers', 'document', 'medicines', 'shelf', 'water', 'door', 'bag', 'window'])
      expect(png(`${A}/items/${n}.png`).width).toBe(32);
  });
});
```

- [ ] **Step 2: Run it.** Run: `npx vitest run tests/renderer/assets.test.ts`. Expected: FAIL (files missing).

- [ ] **Step 3: Write the script** `src/renderer/tools/prepareAssets.mjs`

```js
// One-off: turn the original art in /assets into game-ready, nearest-neighbour PNGs under src/renderer/assets.
// Usage: npm run assets   (originals stay untracked; outputs are committed)
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = path.resolve('assets');
const OUT = path.resolve('src/renderer/assets');
const read = (p) => PNG.sync.read(readFileSync(p));
const write = (p, png) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, PNG.sync.write(png)); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

/** Nearest-neighbour sample of a source rectangle into a size×size image (samples block centres). */
function sample(src, sx, sy, sw, sh, size) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = Math.min(src.width - 1, Math.floor(sx + ((x + 0.5) * sw) / size));
    const py = Math.min(src.height - 1, Math.floor(sy + ((y + 0.5) * sh) / size));
    const i = (py * src.width + px) * 4, o = (y * size + x) * 4;
    for (let k = 0; k < 4; k++) out.data[o + k] = src.data[i + k];
    if (out.data[o + 3] < 128) out.data[o + 3] = 0; else out.data[o + 3] = 255; // hard pixel-art edges
  }
  return out;
}

/** Square crop around the opaque bounding box (alpha > 16), padded to a square. */
function squareBox(src) {
  let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++)
    if (src.data[(y * src.width + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const side = Math.max(x1 - x0, y1 - y0) + 1;
  return [x0 - (side - (x1 - x0 + 1)) / 2, y0 - (side - (y1 - y0 + 1)) / 2, side, side];
}

// ---- characters: 384×384 = 32×32 at 12× ----
const DIRS = { front: 'down', left: 'left', right: 'right', back: 'up' };
const ROW = { down: 0, left: 1, right: 2, up: 3 };
const frames = {}; // base -> state -> dir -> Map(index -> png)
for (const file of walk(path.join(SRC, 'CHARACTER SPRITE')).sort()) {
  const folder = path.basename(path.dirname(file)); // e.g. "WALKING BOY"
  const [stateWord, baseWord] = folder.toLowerCase().split(' ');
  const state = stateWord === 'walking' ? 'walk' : 'idle';
  const name = path.basename(file).toLowerCase();
  const dirWord = ['front', 'left', 'right', 'back'].find((d) => name.includes(d));
  const idx = Number((name.match(/-(\d)\.png/) ?? [0, 1])[1]);
  const dir = DIRS[dirWord];
  const slot = ((frames[baseWord] ??= {})[state] ??= {})[dir] ??= new Map();
  if (!slot.has(idx)) slot.set(idx, sample(read(file), 0, 0, 384, 384, 32));
}
const map = {};
for (const [base, states] of Object.entries(frames)) {
  const sheet = new PNG({ width: 256, height: 128 });
  map[base] = { idle: {}, walk: {} };
  for (const dir of Object.values(DIRS)) {
    const idle = [...(states.idle?.[dir]?.entries() ?? [])].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    let walkF = [...(states.walk?.[dir]?.entries() ?? [])].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    if (idle.length === 0) throw new Error(`${base} has no idle ${dir} frame`);
    if (walkF.length === 0) walkF = idle; // e.g. boy has no "walking front": reuse idle front
    const put = (img, col) => PNG.bitblt(img, sheet, 0, 0, 32, 32, col * 32, ROW[dir] * 32);
    idle.slice(0, 2).forEach((img, i) => put(img, i));
    walkF.slice(0, 4).forEach((img, i) => put(img, 2 + i));
    map[base].idle[dir] = idle.slice(0, 2).map((_, i) => ROW[dir] * 8 + i);
    map[base].walk[dir] = walkF.slice(0, 4).map((_, i) => ROW[dir] * 8 + 2 + i);
  }
  write(path.join(OUT, 'sprites', `${base}.png`), sheet);
}
writeFileSync(path.join(OUT, 'sprites', 'characters.json'), JSON.stringify(map, null, 2) + '\n');

// ---- items: 500×500, crop to content, 32×32 ----
for (const file of walk(path.join(SRC, 'PICKABLE ITEMS'))) {
  const src = read(file);
  const [x, y, w, h] = squareBox(src);
  write(path.join(OUT, 'items', `${path.basename(file, '.png').toLowerCase()}.png`), sample(src, x, y, w, h, 32));
}

// ---- badges/achievements: 1254×1254 opaque, file suffix number = catalog order ----
const ICONS = ['badge_b01_handa', 'badge_b02_go_bag_ready', 'badge_b03_tubig_muna', 'badge_b04_botika_run', 'badge_b05_fact_checker',
  'badge_b06_bayanihan', 'badge_b07_maagang_lumikas', 'badge_b08_walang_maiiwan', 'badge_b09_bintana_boss', 'badge_b10_bubong_secured',
  'badge_b11_family_plan', 'badge_b12_powered_up', 'achievement_a01_first_storm', 'achievement_a02_natuto', 'achievement_a03_lesson_collector',
  'achievement_a04_signal_master', 'achievement_a05_kapos_pero_handa', 'achievement_a06_storm_chaser', 'achievement_a08_whole_barangay',
  'achievement_a09_my_real_home', 'achievement_a07_no_rumor_spreader', 'achievement_a10_plan_in_hand'];
// File numbers 1..22 map in order above (19 = Whole Barangay, 20 = My Real Home, 21 = No Rumor Spreader, 22 = Plan in Hand).
for (const file of walk(path.join(SRC, 'BADGES'))) {
  const n = Number(path.basename(file).match(/-(\d+)\.png$/)[1]);
  const src = read(file);
  const out = sample(src, 0, 0, src.width, src.height, 96);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255; // badges are opaque art
  write(path.join(OUT, 'badges', `${ICONS[n - 1]}.png`), out);
}
console.log('assets prepared →', OUT);
```

`src/renderer/assets/LICENSES.md`:
```md
# Asset provenance
All PNGs here are generated by `npm run assets` from the project's own original art in `/assets`
(character sprites, pickable items, badges), supplied by the Signal No. 5 team. Tiles, placeholders and
effects are generated at runtime by Phaser (`game/scenes/Boot.ts`). No third-party assets.
```

- [ ] **Step 4: Run it, then the test.** Run: `npm run assets; npx vitest run tests/renderer/assets.test.ts`. Expected: PASS.

- [ ] **Step 5: Visual check.** Open `src/renderer/assets/sprites/boy.png`, `items/phone.png` and `badges/badge_b06_bayanihan.png` with the Read tool. Sprites must show crisp pixels and transparent backgrounds. If an item is unrecognisable at 32 px, note it for the placeholder list. Don't hand-tune now.

- [ ] **Step 6: Commit**

```bash
git add package.json src/renderer/tools src/renderer/assets tests/renderer/assets.test.ts
git commit -m "Frontend assets: process character sheets, item sprites and badge icons from original art"
```

---

### Task 3: EngineStore (F1)

**Files:**
- Create: `src/renderer/state/engineStore.ts`, `src/renderer/app/sliceHousehold.ts`, `tests/renderer/engineStore.test.ts`

**Interfaces:**
- Consumes: `createGame`, `GameEngine`, `CommandResult`, `EngineEvent`, `ActionOption` from `src/core/engine`. `CustomOnboarding` from `src/shared/contracts/onboarding`.
- Produces:
```ts
export type InteractResult = ReturnType<GameEngine['interact']>;
export class EngineStore {
  get state(): GameState | null;
  get engine(): GameEngine;                                   // throws if no game
  newGame(input: OnboardingInput, seed: number): { ok: true } | { ok: false; error: EngineError };
  dispatch(fn: (e: GameEngine) => CommandResult): CommandResult;
  interact(id: string): InteractResult;
  tick(deltaMs: number): void;                                // accumulates; engine.tick every TICK_INTERVAL_MS
  activeEventKey(): string | null;                            // `${eventId}@${triggeredAtMinute}`
  subscribe(l: () => void): () => void;                       // state changed
  onEvents(l: (events: EngineEvent[]) => void): () => void;  // engine events, once per command
  reset(): void;                                              // tests
}
export const TICK_INTERVAL_MS = 100;
export const store: EngineStore;
export function sliceHousehold(): CustomOnboarding;          // app/sliceHousehold.ts
export const SLICE_SEED = 20261010;
```

- [ ] **Step 1: Write the failing test** `tests/renderer/engineStore.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { EngineStore, TICK_INTERVAL_MS } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import type { EngineEvent } from '../../src/core/engine';

let s: EngineStore;
let events: EngineEvent[];
beforeEach(() => {
  s = new EngineStore(); events = [];
  s.onEvents((e) => events.push(...e));
  const r = s.newGame(sliceHousehold(), SLICE_SEED);
  expect(r.ok).toBe(true);
});

describe('EngineStore', () => {
  it('emits the opening events and exposes a stable active event key', () => {
    expect(events.some((e) => e.type === 'eventTriggered' && e.eventId === 'EV01')).toBe(true);
    expect(s.activeEventKey()).toMatch(/^EV01@\d+$/);
  });

  it('drives createGame → resolveEvent → executeAction headlessly', () => {
    const r = s.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    expect(r.ok).toBe(true);
    expect(s.state!.activeEvent).toBeNull();
    const before = s.state!.house.WATER ?? 0;
    expect(s.dispatch((e) => e.executeAction('FILL_CONTAINERS')).ok).toBe(true);
    expect(s.state!.house.WATER ?? 0).toBeGreaterThan(before);
  });

  it('leaves state unchanged and notifies nobody on a rejected command', () => {
    let notified = 0; s.subscribe(() => notified++);
    const prev = s.state;
    const r = s.dispatch((e) => e.executeAction('SHARE_VERIFIED_ADVISORY'));
    expect(r.ok).toBe(false);
    expect(s.state).toBe(prev);
    expect(notified).toBe(0);
  });

  it('accumulates frame deltas and ticks the engine at most every 100 ms', () => {
    s.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    const m0 = s.state!.clock.gameMinutes;
    s.tick(TICK_INTERVAL_MS / 2);
    expect(s.state!.clock.gameMinutes).toBe(m0);
    for (let i = 0; i < 120; i++) s.tick(1000); // 120 s real at 1× = 30 game minutes
    expect(s.state!.clock.gameMinutes).toBeGreaterThan(m0);
  });

  it('emits badgeEarned B06 exactly once for the Bayanihan slice', () => {
    s.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    events = [];
    expect(s.dispatch((e) => e.executeAction('SHARE_VERIFIED_ADVISORY')).ok).toBe(true); // CHECK_ADVISORY already verified
    expect(s.dispatch((e) => e.executeAction('SHARE_VERIFIED_ADVISORY')).ok).toBe(false); // once per run
    expect(events.filter((e) => e.type === 'badgeEarned')).toEqual([{ type: 'badgeEarned', badgeId: 'B06' }]);
  });
});
```

- [ ] **Step 2: Run it.** Run: `npx vitest run tests/renderer/engineStore.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/renderer/app/sliceHousehold.ts`:
```ts
// Hard-coded household for the first playable slice (replaced by onboarding screens in M5).
import type { CustomOnboarding } from '../../shared/contracts/onboarding';

export const SLICE_SEED = 20261010;

export function sliceHousehold(): CustomOnboarding {
  return {
    schemaVersion: 1, mode: 'custom', q1Housing: 'singleStory', q2SizeRange: '3-4', q2ExactSize: 4,
    q3AgeCounts: { age0to4: 0, age5to12: 1, age13to17: 0, age18to35: 0, age36to59: 2, age60plus: 1 },
    q4Assistance: 'yes', q5MedicalSupplies: 'yes', q6Surroundings: ['waterway', 'floodProne'], q7Pets: 'yes', q8Preparedness: 'partial',
    customization: { theme: 'traditional' },
  };
}
```

`src/renderer/state/engineStore.ts`:
```ts
// The renderer's ONLY game state: one GameEngine per run. React and Phaser read from here and send commands here.
import { createGame, type CommandResult, type EngineError, type EngineEvent, type GameEngine } from '../../core/engine';
import type { OnboardingInput } from '../../shared/contracts/onboarding';
import type { GameState } from '../../shared/contracts/state';

export type InteractResult = ReturnType<GameEngine['interact']>;
export const TICK_INTERVAL_MS = 100;

export class EngineStore {
  private eng: GameEngine | null = null;
  private st: GameState | null = null;
  private tickAcc = 0;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(events: EngineEvent[]) => void>();

  get state(): GameState | null { return this.st; }
  get engine(): GameEngine {
    if (!this.eng) throw new Error('No game in progress');
    return this.eng;
  }

  newGame(input: OnboardingInput, seed: number): { ok: true } | { ok: false; error: EngineError } {
    const r = createGame(input, { seed });
    if (!r.ok) return r;
    this.eng = r.engine; this.tickAcc = 0;
    this.apply(r.engine.getState(), r.events);
    return { ok: true };
  }

  dispatch(fn: (e: GameEngine) => CommandResult): CommandResult {
    const r = fn(this.engine);
    if (r.ok) this.apply(r.state, r.events);
    return r;
  }

  interact(id: string): InteractResult {
    const r = this.engine.interact(id);
    if (r.ok) this.apply(r.state, r.events);
    return r;
  }

  tick(deltaMs: number): void {
    if (!this.eng) return;
    this.tickAcc += deltaMs;
    if (this.tickAcc < TICK_INTERVAL_MS) return;
    const ms = this.tickAcc; this.tickAcc = 0;
    this.dispatch((e) => e.tick(ms));
  }

  activeEventKey(): string | null {
    const ev = this.st?.activeEvent;
    return ev ? `${ev.eventId}@${ev.triggeredAtMinute}` : null;
  }

  subscribe(l: () => void): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }
  onEvents(l: (events: EngineEvent[]) => void): () => void { this.eventListeners.add(l); return () => this.eventListeners.delete(l); }

  reset(): void { this.eng = null; this.st = null; this.tickAcc = 0; this.listeners.clear(); this.eventListeners.clear(); }

  private apply(state: GameState, events: EngineEvent[]): void {
    this.st = state;
    for (const l of this.listeners) l();
    if (events.length) for (const l of this.eventListeners) l(events);
  }
}

export const store = new EngineStore();
```

- [ ] **Step 4: Run tests.** Run: `npx vitest run tests/renderer/engineStore.test.ts`. Expected: PASS. If the Bayanihan test fails because `CHECK_ADVISORY` didn't set `BULLETIN_CHECKED` for this seed, add `s.dispatch((e) => e.executeAction('CHECK_BULLETIN'))` before sharing. That is still the blueprint §6.5 flow.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/state/engineStore.ts src/renderer/app/sliceHousehold.ts tests/renderer/engineStore.test.ts
git commit -m "Frontend F1: EngineStore drives the engine headlessly and broadcasts engine events"
```

---

### Task 4: Fixed house layout (house_fixed_v1)

**Files:**
- Create: `src/renderer/game/layout.ts`, `src/renderer/game/proximity.ts`, `tests/renderer/layout.test.ts`

**Interfaces:**
- Consumes: `INTERACTABLES` from `src/core/content/interactables`.
- Produces:
```ts
export const TILE = 16;
export const MAP_W = 30, MAP_H = 18;
export enum T { WALL = 0, KITCHEN = 1, BEDROOM = 2, UTILITY = 3, LIVING = 4, ENTRANCE = 5 }
export interface Anchor { id: string; tx: number; ty: number; sprite: string | null; size: 16 | 32 }
export const ANCHORS: Anchor[];                       // one per HOUSE interactable id
export const PLAYER_SPAWN: { tx: number; ty: number };
export const NPC_SPAWNS: { tx: number; ty: number }[];
export function buildGrid(): T[][];                   // [ty][tx]
export function solidTiles(grid: T[][], anchors?: Anchor[]): boolean[][];
export const tileCenter: (tx: number, ty: number) => { x: number; y: number };
// proximity.ts
export const INTERACT_RADIUS = 24;
export function nearestAnchor(x: number, y: number, anchors: { id: string; x: number; y: number }[], radius?: number): string | null;
```

- [ ] **Step 1: Write the failing test** `tests/renderer/layout.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { INTERACTABLES } from '../../src/core/content/interactables';
import { ANCHORS, buildGrid, MAP_H, MAP_W, NPC_SPAWNS, PLAYER_SPAWN, solidTiles, T, tileCenter } from '../../src/renderer/game/layout';
import { INTERACT_RADIUS, nearestAnchor } from '../../src/renderer/game/proximity';

const grid = buildGrid();
const solid = solidTiles(grid, ANCHORS);

function reachable(): boolean[][] {
  const seen = grid.map((r) => r.map(() => false));
  const q = [[PLAYER_SPAWN.tx, PLAYER_SPAWN.ty]];
  seen[PLAYER_SPAWN.ty]![PLAYER_SPAWN.tx] = true;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x! + dx!, ny = y! + dy!;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || seen[ny]![nx] || solid[ny]![nx]) continue;
      seen[ny]![nx] = true; q.push([nx, ny]);
    }
  }
  return seen;
}

describe('house_fixed_v1 layout', () => {
  it('is a closed 30×18 grid', () => {
    expect(grid.length).toBe(MAP_H);
    expect(grid.every((r) => r.length === MAP_W)).toBe(true);
    for (let x = 0; x < MAP_W; x++) { expect(grid[0]![x]).toBe(T.WALL); expect(grid[MAP_H - 1]![x]).toBe(T.WALL); }
  });

  it('has exactly one anchor for every HOUSE interactable id', () => {
    const ids = INTERACTABLES.filter((i) => i.scene === 'HOUSE').map((i) => i.id).sort();
    expect(ANCHORS.map((a) => a.id).sort()).toEqual(ids);
  });

  it('lets the player reach a tile beside every anchor and every NPC spawn', () => {
    const seen = reachable();
    for (const a of ANCHORS) {
      const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[a.ty + dy!]?.[a.tx + dx!]);
      expect(ok, a.id).toBe(true);
    }
    for (const n of NPC_SPAWNS) expect(seen[n.ty]![n.tx]).toBe(true);
  });

  it('finds the phone from an adjacent tile and nothing from the room centre far away', () => {
    const pts = ANCHORS.map((a) => ({ id: a.id, ...tileCenter(a.tx, a.ty) }));
    const phone = ANCHORS.find((a) => a.id === 'LIVING_PHONE')!;
    const beside = tileCenter(phone.tx - 1, phone.ty);
    expect(nearestAnchor(beside.x, beside.y, pts)).toBe('LIVING_PHONE');
    expect(nearestAnchor(beside.x - 3 * INTERACT_RADIUS, beside.y, pts)).not.toBe('LIVING_PHONE');
  });
});
```

- [ ] **Step 2: Run it.** Run: `npx vitest run tests/renderer/layout.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

`src/renderer/game/layout.ts`:
```ts
// house_fixed_v1: the one fixed floor plan (frontend-owned, gap G3). Tile coordinates, 16 px tiles.
// Geometry and collision are identical for every theme; themes only swap tile colours.
export const TILE = 16;
export const MAP_W = 30;
export const MAP_H = 18;

export enum T { WALL = 0, KITCHEN = 1, BEDROOM = 2, UTILITY = 3, LIVING = 4, ENTRANCE = 5 }

interface Room { floor: T; x: number; y: number; w: number; h: number }
const ROOMS: Room[] = [
  { floor: T.KITCHEN, x: 1, y: 1, w: 10, h: 6 },
  { floor: T.BEDROOM, x: 12, y: 1, w: 17, h: 6 },
  { floor: T.UTILITY, x: 1, y: 8, w: 10, h: 9 },
  { floor: T.LIVING, x: 12, y: 8, w: 11, h: 9 },
  { floor: T.ENTRANCE, x: 24, y: 8, w: 5, h: 9 },
];
// Door openings carved through interior walls, with the floor of the room they open into.
const DOORS: { tx: number; ty: number; floor: T }[] = [
  { tx: 5, ty: 7, floor: T.UTILITY }, { tx: 6, ty: 7, floor: T.UTILITY },     // kitchen ↔ utility
  { tx: 11, ty: 3, floor: T.KITCHEN }, { tx: 11, ty: 4, floor: T.KITCHEN },   // kitchen ↔ bedroom
  { tx: 16, ty: 7, floor: T.LIVING }, { tx: 17, ty: 7, floor: T.LIVING },     // bedroom ↔ living
  { tx: 11, ty: 12, floor: T.LIVING }, { tx: 11, ty: 13, floor: T.LIVING },   // utility ↔ living
  { tx: 23, ty: 11, floor: T.ENTRANCE }, { tx: 23, ty: 12, floor: T.ENTRANCE }, // living ↔ entrance
];

export interface Anchor { id: string; tx: number; ty: number; sprite: string | null; size: 16 | 32 }
/** One per HOUSE interactable (src/core/content/interactables.ts). `sprite` = items/<name>.png, null = generated placeholder. */
export const ANCHORS: Anchor[] = [
  { id: 'LIVING_TV', tx: 20, ty: 8, sprite: null, size: 16 },
  { id: 'LIVING_PHONE', tx: 20, ty: 14, sprite: 'phone', size: 16 },
  { id: 'LIVING_RADIO', tx: 13, ty: 9, sprite: 'radio', size: 16 },
  { id: 'KITCHEN_CABINET', tx: 2, ty: 1, sprite: 'cupboard', size: 32 },
  { id: 'KITCHEN_SINK', tx: 6, ty: 1, sprite: null, size: 16 },
  { id: 'BEDROOM_CLOTHES', tx: 14, ty: 1, sprite: 'drawers', size: 32 },
  { id: 'BEDROOM_DOCUMENTS', tx: 20, ty: 1, sprite: 'document', size: 16 },
  { id: 'BEDROOM_MEDICATION', tx: 24, ty: 1, sprite: 'medicines', size: 16 },
  { id: 'UTILITY_TOOLS', tx: 1, ty: 9, sprite: null, size: 16 },
  { id: 'UTILITY_SHELF', tx: 1, ty: 12, sprite: 'shelf', size: 32 },
  { id: 'UTILITY_DRUM', tx: 4, ty: 16, sprite: 'water', size: 16 },
  { id: 'UTILITY_LADDER', tx: 8, ty: 16, sprite: null, size: 16 },
  { id: 'PET_AREA', tx: 9, ty: 9, sprite: null, size: 16 },
  { id: 'ENTRANCE_DOOR', tx: 26, ty: 17, sprite: 'door', size: 32 },
  { id: 'ENTRANCE_BAG', tx: 28, ty: 9, sprite: 'bag', size: 16 },
  { id: 'STAIRS', tx: 28, ty: 15, sprite: null, size: 16 },
  { id: 'WINDOW', tx: 17, ty: 17, sprite: 'window', size: 32 },
];

export const PLAYER_SPAWN = { tx: 17, ty: 12 };
export const NPC_SPAWNS = [{ tx: 14, ty: 15 }, { tx: 21, ty: 11 }, { tx: 25, ty: 13 }];

export function buildGrid(): T[][] {
  const g: T[][] = Array.from({ length: MAP_H }, () => Array<T>(MAP_W).fill(T.WALL));
  for (const r of ROOMS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y]![x] = r.floor;
  for (const d of DOORS) g[d.ty]![d.tx] = d.floor;
  return g;
}

/** Walls plus the tiles occupied by interactable objects. */
export function solidTiles(grid: T[][], anchors: Anchor[] = ANCHORS): boolean[][] {
  const s = grid.map((row) => row.map((t) => t === T.WALL));
  for (const a of anchors) s[a.ty]![a.tx] = true;
  return s;
}

export const tileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
```

`src/renderer/game/proximity.ts`:
```ts
export const INTERACT_RADIUS = 24;

/** Closest anchor within `radius` px of (x, y), or null. */
export function nearestAnchor(x: number, y: number, anchors: { id: string; x: number; y: number }[], radius = INTERACT_RADIUS): string | null {
  let best: string | null = null, bestD = radius * radius;
  for (const a of anchors) {
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d <= bestD) { bestD = d; best = a.id; }
  }
  return best;
}
```

- [ ] **Step 4: Run tests.** Run: `npx vitest run tests/renderer/layout.test.ts`. Expected: PASS. If reachability fails for an anchor, move that anchor one tile into its room (never change doors to fit art).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/game/layout.ts src/renderer/game/proximity.ts tests/renderer/layout.test.ts
git commit -m "Frontend A2: fixed house_fixed_v1 layout with anchors for every interactable"
```

---

### Task 5: Phaser world: Boot, House, movement, collisions (A1–A3 movement)

**Files:**
- Create: `src/renderer/game/assets.ts`, `src/renderer/game/config.ts`, `src/renderer/game/scenes/Boot.ts`, `src/renderer/game/scenes/House.ts`, `src/renderer/game/PhaserGame.tsx`, `src/renderer/state/uiStore.ts`, `src/renderer/state/hooks.ts`
- Modify: `src/renderer/app/App.tsx` (temporary: start the slice game and mount PhaserGame)

**Interfaces:**
- Consumes: `store` (Task 3), layout and proximity (Task 4), `characters.json` and PNGs (Task 2).
- Produces:
```ts
// uiStore.ts
export type Overlay = { kind: 'none' } | { kind: 'menu'; interactableId: string; label: string; actions: ActionOption[] } | { kind: 'discovery'; title: string; lines: string[] };
export interface Toast { id: number; kind: 'badge' | 'error' | 'info'; title: string; body?: string; icon?: string }
export class UiStore {
  overlay: Overlay; prompt: string | null; toasts: Toast[];
  setPrompt(p: string | null): void; open(o: Overlay): void; close(): void;
  toast(t: Omit<Toast, 'id'>): number; dismiss(id: number): void;
  isBlocking(): boolean;   // overlay open OR store.state.activeEvent
  subscribe(l: () => void): () => void; version: number;
}
export const ui: UiStore;
// hooks.ts
export function useEngineState(): GameState | null;
export function useUi(): UiStore;   // re-renders on ui changes
// House scene calls: interactWith(id, label) from state/interactionController.ts (Task 6; stubbed here as a toast)
```

- [ ] **Step 1: uiStore + hooks**

`src/renderer/state/uiStore.ts`:
```ts
// Presentation-only UI state (which overlay is open, the prompt, toasts). Never holds game state.
import type { ActionOption } from '../../core/engine';
import { store } from './engineStore';

export type Overlay =
  | { kind: 'none' }
  | { kind: 'menu'; interactableId: string; label: string; actions: ActionOption[] }
  | { kind: 'discovery'; title: string; lines: string[] };
export interface Toast { id: number; kind: 'badge' | 'error' | 'info'; title: string; body?: string; icon?: string }

export class UiStore {
  overlay: Overlay = { kind: 'none' };
  prompt: string | null = null;
  toasts: Toast[] = [];
  version = 0;
  private nextId = 1;
  private readonly listeners = new Set<() => void>();

  setPrompt(p: string | null) { if (p !== this.prompt) { this.prompt = p; this.emit(); } }
  open(o: Overlay) { this.overlay = o; this.emit(); }
  close() { this.overlay = { kind: 'none' }; this.emit(); }
  toast(t: Omit<Toast, 'id'>): number { const id = this.nextId++; this.toasts = [...this.toasts, { ...t, id }]; this.emit(); return id; }
  dismiss(id: number) { this.toasts = this.toasts.filter((t) => t.id !== id); this.emit(); }
  isBlocking(): boolean { return this.overlay.kind !== 'none' || !!store.state?.activeEvent; }
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit() { this.version++; for (const l of this.listeners) l(); }
}

export const ui = new UiStore();
```

`src/renderer/state/hooks.ts`:
```ts
import { useSyncExternalStore } from 'react';
import { store } from './engineStore';
import { ui, type UiStore } from './uiStore';

export function useEngineState() {
  return useSyncExternalStore((l) => store.subscribe(l), () => store.state);
}

export function useUi(): UiStore {
  useSyncExternalStore((l) => ui.subscribe(l), () => ui.version);
  return ui;
}
```

- [ ] **Step 2: Asset registry** `src/renderer/game/assets.ts`

```ts
// Vite-imported asset URLs (bundled as files or data: URIs, so they load under the production CSP).
import boy from '../assets/sprites/boy.png';
import girl from '../assets/sprites/girl.png';
import mom from '../assets/sprites/mom.png';
import dad from '../assets/sprites/dad.png';
import characters from '../assets/sprites/characters.json';

export type SpriteBase = 'boy' | 'girl' | 'mom' | 'dad';
export type Dir = 'down' | 'left' | 'right' | 'up';
export const CHARACTER_SHEETS: Record<SpriteBase, string> = { boy, girl, mom, dad };
export const CHARACTER_FRAMES = characters as Record<SpriteBase, { idle: Record<Dir, number[]>; walk: Record<Dir, number[]> }>;

const itemUrls = import.meta.glob('../assets/items/*.png', { eager: true, import: 'default' }) as Record<string, string>;
export const ITEM_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(itemUrls).map(([p, url]) => [p.split('/').pop()!.replace('.png', ''), url]));

const badgeUrls = import.meta.glob('../assets/badges/*.png', { eager: true, import: 'default' }) as Record<string, string>;
/** Keyed by backend iconAssetId (e.g. badge_b06_bayanihan). */
export const ICON_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(badgeUrls).map(([p, url]) => [p.split('/').pop()!.replace('.png', ''), url]));

export const charKey = (b: SpriteBase) => `char_${b}`;
export const itemKey = (name: string) => `item_${name}`;
```

- [ ] **Step 3: Config, Boot, House, PhaserGame**

`src/renderer/game/config.ts`:
```ts
import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { House } from './scenes/House';

export const BASE_W = 384;
export const BASE_H = 216;

export function makeConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: BASE_W, height: BASE_H, backgroundColor: '#10141f',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: false } },
    // Production CSP: no blob: images, no XHR (connect-src 'none'), no WebAudio needed yet.
    loader: { imageLoadType: 'HTMLImageElement' },
    audio: { disableWebAudio: true, noAudio: true },
    input: { keyboard: { target: window } },
    scene: [Boot, House],
  };
}
```

`src/renderer/game/scenes/Boot.ts`:
```ts
// Loads images by Vite URL and generates every texture the slice needs that has no art yet.
import Phaser from 'phaser';
import { ANCHORS, T, TILE } from '../layout';
import { CHARACTER_SHEETS, ITEM_URLS, charKey, itemKey, type SpriteBase } from '../assets';

/** Floor/wall colours per theme: [wall, kitchen, bedroom, utility, living, entrance]. Same geometry for both. */
export const THEME_TILES: Record<'modern' | 'traditional', string[]> = {
  traditional: ['#5a3a22', '#7fb89a', '#b07a45', '#8a8f99', '#c99a5e', '#9aa6b0'],
  modern: ['#3c4660', '#a9d6c1', '#d7b98a', '#9aa3ad', '#e6cf9f', '#b9c4cc'],
};
export const PLACEHOLDER_COLORS: Record<string, string> = {
  LIVING_TV: '#2e3440', KITCHEN_SINK: '#9fd0ff', UTILITY_TOOLS: '#d9734e', UTILITY_LADDER: '#c9a227', PET_AREA: '#e8a0b4', STAIRS: '#7a5230',
};

export class Boot extends Phaser.Scene {
  readonly missing: string[] = [];
  constructor() { super('Boot'); }

  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => { this.missing.push(f.key); console.warn('[asset-missing]', f.key); });
    for (const [base, url] of Object.entries(CHARACTER_SHEETS)) this.load.spritesheet(charKey(base as SpriteBase), url, { frameWidth: 32, frameHeight: 32 });
    for (const a of ANCHORS) if (a.sprite && ITEM_URLS[a.sprite]) this.load.image(itemKey(a.sprite), ITEM_URLS[a.sprite]);
  }

  create() {
    for (const theme of Object.keys(THEME_TILES) as (keyof typeof THEME_TILES)[]) this.makeTileset(theme);
    for (const a of ANCHORS) {
      const key = a.sprite ? itemKey(a.sprite) : `ph_${a.id}`;
      if (!this.textures.exists(key)) this.makeBlock(key, PLACEHOLDER_COLORS[a.id] ?? '#ff00ff');
    }
    for (const base of Object.keys(CHARACTER_SHEETS)) if (!this.textures.exists(charKey(base as SpriteBase))) this.makeBlock(charKey(base as SpriteBase), '#ff00ff');
    console.log(`[signal] boot ok textures=${this.textures.getTextureKeys().length} missing=${JSON.stringify(this.missing)}`);
    this.scene.start('House');
  }

  private makeTileset(theme: 'modern' | 'traditional') {
    const colors = THEME_TILES[theme];
    const tex = this.textures.createCanvas(`tiles_${theme}`, TILE * colors.length, TILE)!;
    const ctx = tex.getContext();
    colors.forEach((c, i) => {
      ctx.fillStyle = c; ctx.fillRect(i * TILE, 0, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      if (i === T.WALL) { ctx.fillRect(i * TILE, TILE - 3, TILE, 3); ctx.fillRect(i * TILE, 7, TILE, 1); }
      else { ctx.fillRect(i * TILE, TILE - 1, TILE, 1); ctx.fillRect(i * TILE + TILE - 1, 0, 1, TILE); }
    });
    tex.refresh();
  }

  private makeBlock(key: string, color: string) {
    const tex = this.textures.createCanvas(key, TILE, TILE)!;
    const ctx = tex.getContext();
    ctx.fillStyle = '#10141f'; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = color; ctx.fillRect(1, 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(2, 2, TILE - 4, 2);
    tex.refresh();
  }
}
```

`src/renderer/game/scenes/House.ts`:
```ts
// The fixed house: tilemap + collision, the player (4 directions, 90 px/s), interactable objects,
// the proximity prompt, E/Space to interact, and the ONE place that advances game time (store.tick).
import Phaser from 'phaser';
import { store } from '../../state/engineStore';
import { ui } from '../../state/uiStore';
import { interactWith } from '../../state/interactionController';
import { ANCHORS, MAP_H, MAP_W, PLAYER_SPAWN, T, TILE, buildGrid, tileCenter } from '../layout';
import { nearestAnchor } from '../proximity';
import { CHARACTER_FRAMES, charKey, itemKey, type Dir, type SpriteBase } from '../assets';

const SPEED = 90;

export class House extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private base: SpriteBase = 'boy';
  private facing: Dir = 'down';
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'e' | 'space', Phaser.Input.Keyboard.Key>;
  private anchorPoints: { id: string; x: number; y: number }[] = [];
  private labels = new Map<string, string>();

  constructor() { super('House'); }

  create() {
    const world = store.engine.getWorldConfig();
    const theme = world.theme === 'modern' ? 'modern' : 'traditional';
    const map = this.make.tilemap({ data: buildGrid(), tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage(`tiles_${theme}`, `tiles_${theme}`, TILE, TILE, 0, 0)!;
    const layer = map.createLayer(0, tiles, 0, 0)!;
    layer.setCollision([T.WALL]);

    const objects = this.physics.add.staticGroup();
    const present = new Set(world.interactables.map((i) => i.id));
    for (const i of world.interactables) this.labels.set(i.id, i.label);
    for (const a of ANCHORS.filter((x) => present.has(x.id))) {
      const c = tileCenter(a.tx, a.ty);
      const key = a.sprite ? itemKey(a.sprite) : `ph_${a.id}`;
      const img = objects.create(c.x, c.y - (a.size - TILE) / 2, key) as Phaser.Physics.Arcade.Sprite;
      img.setDisplaySize(a.size, a.size).setDepth(c.y);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE).position.set(a.tx * TILE, a.ty * TILE);
      this.anchorPoints.push({ id: a.id, ...c });
    }

    const playerCfg = world.characters.find((c) => c.isPlayer);
    this.base = (playerCfg?.spriteBase ?? 'boy') as SpriteBase;
    this.makeAnims(this.base);
    const spawn = tileCenter(PLAYER_SPAWN.tx, PLAYER_SPAWN.ty);
    this.player = this.physics.add.sprite(spawn.x, spawn.y - 8, charKey(this.base), CHARACTER_FRAMES[this.base].idle.down[0]);
    this.player.body.setSize(12, 8).setOffset(10, 24);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.player, objects);

    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE).startFollow(this.player, true);
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, e: K.E, space: K.SPACE }) as typeof this.keys;
    this.input.keyboard!.on('keydown-E', () => this.tryInteract());
    this.input.keyboard!.on('keydown-SPACE', () => this.tryInteract());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.removeAllListeners());
  }

  update(_t: number, delta: number) {
    store.tick(delta);
    const blocked = ui.isBlocking();
    let vx = 0, vy = 0;
    if (!blocked) {
      const k = this.keys;
      if (k.left.isDown || k.a.isDown) vx = -SPEED; else if (k.right.isDown || k.d.isDown) vx = SPEED;
      else if (k.up.isDown || k.w.isDown) vy = -SPEED; else if (k.down.isDown || k.s.isDown) vy = SPEED;
    }
    this.player.setVelocity(vx, vy);
    if (vx || vy) this.facing = vx < 0 ? 'left' : vx > 0 ? 'right' : vy < 0 ? 'up' : 'down';
    this.player.anims.play(`${this.base}_${vx || vy ? 'walk' : 'idle'}_${this.facing}`, true);
    this.player.setDepth(this.player.body.center.y);

    const near = blocked ? null : this.nearest();
    ui.setPrompt(near ? `E  ${this.labels.get(near) ?? near}` : null);
  }

  private nearest(): string | null {
    const c = this.player.body.center;
    return nearestAnchor(c.x, c.y, this.anchorPoints);
  }

  private tryInteract() {
    if (ui.isBlocking()) return;
    const id = this.nearest();
    if (id) interactWith(id, this.labels.get(id) ?? id);
  }

  private makeAnims(base: SpriteBase) {
    const f = CHARACTER_FRAMES[base];
    for (const kind of ['idle', 'walk'] as const) for (const dir of ['down', 'left', 'right', 'up'] as const) {
      const key = `${base}_${kind}_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(charKey(base), { frames: f[kind][dir] }), frameRate: kind === 'walk' ? 8 : 2, repeat: -1 });
    }
  }
}
```

Temporary `src/renderer/state/interactionController.ts` (replaced in Task 6):
```ts
import { ui } from './uiStore';
export function interactWith(id: string, label: string): void { ui.toast({ kind: 'info', title: `${label} (${id})` }); }
```

`src/renderer/game/PhaserGame.tsx`:
```tsx
import { memo, useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { makeConfig } from './config';

/** Mounts one Phaser game for the lifetime of the component (StrictMode-safe: destroy on cleanup). */
export const PhaserGame = memo(function PhaserGame() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const game = new Phaser.Game(makeConfig(host.current!));
    return () => game.destroy(true);
  }, []);
  return <div ref={host} className="world" />;
});
```

Temporary `App.tsx`:
```tsx
import { useState } from 'react';
import { store } from '../state/engineStore';
import { sliceHousehold, SLICE_SEED } from './sliceHousehold';
import { PhaserGame } from '../game/PhaserGame';

export function App() {
  const [ready] = useState(() => store.state !== null || store.newGame(sliceHousehold(), SLICE_SEED).ok);
  return ready ? <PhaserGame /> : <div className="boot">Could not start the game.</div>;
}
```

Add to `styles.css`:
```css
.world { position: fixed; inset: 0; }
.world canvas { image-rendering: pixelated; }
```

- [ ] **Step 4: Typecheck and tests.** Run: `npm run typecheck; npm test`. Expected: clean, all pass.

- [ ] **Step 5: Temporary movement check (EV01 blocks input until Task 7).** In `App.tsx`, temporarily call `store.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'))` right after `newGame`, run `npm run dev`, and verify:
  - WASD and the arrows walk in 4 directions with walk and idle animations;
  - walls and objects block movement;
  - the camera follows the player;
  - nothing crashes.

  Remove the temporary dispatch afterwards. Note: the dev window can't be seen by an agent. Ask the human partner to confirm, or capture a screenshot with the `run` skill if available.

- [ ] **Step 6: Set the dev AI runtime path once (user-level env var):** `setx SIGNAL_LLM_DIR "C:\signal-llm\llama-b11517-cuda124"`. The model is found at `C:\signal-llm\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf` by `src/main/config.ts`.

- [ ] **Step 7: Production CSP smoke (Review Focus 1).**

```powershell
npm run build
$env:ELECTRON_RUN_AS_NODE=$null
$p = Start-Process -PassThru -RedirectStandardError "$env:TEMP\sig-err.log" -RedirectStandardOutput "$env:TEMP\sig-out.log" -FilePath node_modules\electron\dist\electron.exe -ArgumentList '.','--enable-logging'
Start-Sleep 15; Stop-Process -Id $p.Id; Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process
Select-String -Path "$env:TEMP\sig-*.log" -Pattern 'boot ok|Content Security Policy|asset-missing|Refused'
```
Expected: a `[signal] boot ok … missing=[]` line, and no `Refused`/CSP lines. If images are refused, stop and report to the human partner (the backend owner changes `src/main/index.ts`; don't add a `<meta>` CSP).

- [ ] **Step 8: Commit**

```bash
git add src/renderer
git commit -m "Frontend A1-A3: Phaser house with collisions, 4-direction movement and pixel-art character"
```

---

### Task 6: Interactions: prompt, menu, discovery, errors (A3 interaction, B5 menu/discovery)

**Files:**
- Modify: `src/renderer/state/interactionController.ts` (real implementation)
- Create: `src/renderer/ui/InteractionPrompt.tsx`, `src/renderer/ui/InteractionMenu.tsx`, `src/renderer/ui/DiscoveryCard.tsx`, `tests/renderer/interactionController.test.ts`

**Interfaces:**
- Consumes: `store`, `ui`, `ActionOption`, `missingGoBagItems`, `ITEM_LABELS`.
- Produces:
```ts
export function interactWith(id: string, label: string): void;     // opens menu, or lets EventDialog open, or toasts error
export function runMenuAction(option: ActionOption): CommandResult | null; // null if unavailable (never dispatches)
export function closeMenu(): void;                                    // close + resume('menu')
```

- [ ] **Step 1: Write the failing test** `tests/renderer/interactionController.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { closeMenu, interactWith, runMenuAction } from '../../src/renderer/state/interactionController';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

beforeEach(() => {
  store.reset(); ui.close(); ui.toasts = [];
  expect(store.newGame(sliceHousehold(), SLICE_SEED).ok).toBe(true);
});

describe('interaction controller', () => {
  it('shows the engine message instead of a menu while an event is pending', () => {
    interactWith('LIVING_PHONE', 'Phone');
    expect(ui.overlay.kind).toBe('none');
    expect(ui.toasts.at(-1)).toMatchObject({ kind: 'error', title: 'Respond to the current event first.' });
  });

  it('opens the phone menu, pauses for the menu, and keeps sharing disabled with the engine reason until verified', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');
    expect(ui.overlay.kind).toBe('menu');
    expect(store.state!.clock.pauseReasons).toContain('menu');
    const menu = ui.overlay.kind === 'menu' ? ui.overlay : null;
    const share = menu!.actions.find((a) => a.actionId === 'SHARE_VERIFIED_ADVISORY')!;
    expect(share.available).toBe(false);
    expect(share.reasons.join(' ')).toMatch(/official information/i);
    expect(runMenuAction(share)).toBeNull();
  });

  it('runs CHECK_BULLETIN then SHARE_VERIFIED_ADVISORY from refreshed menus', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');
    const m1 = ui.overlay.kind === 'menu' ? ui.overlay : null;
    expect(runMenuAction(m1!.actions.find((a) => a.actionId === 'CHECK_BULLETIN')!)!.ok).toBe(true);
    expect(ui.overlay.kind).toBe('none');
    expect(store.state!.clock.pauseReasons).not.toContain('menu');
    interactWith('LIVING_PHONE', 'Phone');
    const m2 = ui.overlay.kind === 'menu' ? ui.overlay : null;
    const share = m2!.actions.find((a) => a.actionId === 'SHARE_VERIFIED_ADVISORY')!;
    expect(share.available).toBe(true);
    expect(runMenuAction(share)!.ok).toBe(true);
  });

  it('runs discovery actions without spending time and shows a card', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    const m0 = store.state!.clock.gameMinutes;
    interactWith('ENTRANCE_BAG', 'Go-bag');
    if (ui.overlay.kind !== 'menu') return; // EV02 may open instead; covered by EventDialog
    runMenuAction(ui.overlay.actions.find((a) => a.actionId === 'INSPECT_GO_BAG')!);
    expect(ui.overlay.kind).toBe('discovery');
    expect(store.state!.clock.gameMinutes).toBe(m0);
    closeMenu();
  });
});
```

- [ ] **Step 2: Run it.** Run: `npx vitest run tests/renderer/interactionController.test.ts`. Expected: FAIL (the stub has no `runMenuAction`).

- [ ] **Step 3: Implement** `src/renderer/state/interactionController.ts`

```ts
// Glue between the world (who is near what) and the engine (what can be done). No rules here:
// availability, reasons, labels and costs all come from the engine.
import type { ActionOption, CommandResult } from '../../core/engine';
import { ITEM_LABELS } from '../../core/content/items';
import { missingGoBagItems } from '../../core/selectors';
import { store } from './engineStore';
import { ui } from './uiStore';

export function interactWith(id: string, label: string): void {
  const r = store.interact(id);
  if (!r.ok) { ui.toast({ kind: 'error', title: r.error.message, body: r.error.reasons?.join(' ') }); return; }
  if (r.events.some((e) => e.type === 'eventTriggered')) return; // EventDialog opens from state.activeEvent
  if (r.actions.length === 0) { ui.toast({ kind: 'info', title: `${label}: nothing to do here right now.` }); return; }
  store.dispatch((e) => e.pause('menu'));
  ui.open({ kind: 'menu', interactableId: id, label, actions: r.actions });
}

export function closeMenu(): void {
  ui.close();
  if (store.state?.clock.pauseReasons.includes('menu')) store.dispatch((e) => e.resume('menu'));
}

export function runMenuAction(option: ActionOption): CommandResult | null {
  if (!option.available) return null;
  const r = store.dispatch((e) => e.executeAction(option.actionId));
  if (!r.ok) {
    ui.toast({ kind: 'error', title: r.error.message, body: r.error.reasons?.join(' ') });
    return r;
  }
  closeMenu();
  if (option.kind === 'discovery') ui.open({ kind: 'discovery', title: option.label, lines: discoveryLines(option.actionId) });
  else ui.toast({ kind: 'info', title: option.label, body: option.timeCostMinutes ? `Took ${option.timeCostMinutes} min.` : undefined });
  return r;
}

/** Built from engine state only (blueprint §6.3; copy pending content review, BK-3). */
function discoveryLines(actionId: string): string[] {
  const s = store.state!;
  if (actionId === 'INSPECT_GO_BAG') {
    const missing = missingGoBagItems(s);
    return missing.length === 0 ? ['The go-bag has everything it needs.']
      : ['Still missing:', ...missing.map((alts) => `• ${alts.map((i) => ITEM_LABELS[i]).join(' or ')}`)];
  }
  const counts = Object.entries(s.house).filter(([, n]) => (n ?? 0) > 0);
  return counts.length === 0 ? ['Nothing stored here yet.'] : counts.map(([id, n]) => `• ${ITEM_LABELS[id as keyof typeof ITEM_LABELS]}: ${n}`);
}
```

- [ ] **Step 4: Run tests.** Run: `npx vitest run tests/renderer/interactionController.test.ts`. Expected: PASS. If `DEFER` isn't an EV01 choice for this household, use `getEventChoices()` and pick the first available non-departing choice. Don't change engine code.

- [ ] **Step 5: UI components**

`src/renderer/ui/InteractionPrompt.tsx`:
```tsx
import { useUi } from '../state/hooks';
export function InteractionPrompt() {
  const ui = useUi();
  return ui.prompt ? <div className="prompt" role="status">{ui.prompt}</div> : null;
}
```

`src/renderer/ui/InteractionMenu.tsx`:
```tsx
import { useEffect } from 'react';
import { useUi } from '../state/hooks';
import { closeMenu, runMenuAction } from '../state/interactionController';

export function InteractionMenu() {
  const ui = useUi();
  const o = ui.overlay;
  useEffect(() => {
    if (o.kind === 'none') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [o.kind]);
  if (o.kind !== 'menu') return null;
  return (
    <div className="panel menu" role="dialog" aria-label={o.label}>
      <h2>{o.label}</h2>
      <ul>
        {o.actions.map((a) => (
          <li key={a.actionId}>
            <button disabled={!a.available} onClick={() => runMenuAction(a)} title={a.reasons.join(' ')}>
              {a.unsafe && <span className="unsafe" aria-label="unsafe">⚠ </span>}{a.label}
              <span className="cost">{a.kind === 'discovery' ? 'free' : `${a.timeCostMinutes} min`}</span>
            </button>
            {!a.available && a.reasons.length > 0 && <p className="reason">{a.reasons.join(' ')}</p>}
          </li>
        ))}
      </ul>
      <button className="ghost" onClick={closeMenu}>Close (Esc)</button>
    </div>
  );
}
```

`src/renderer/ui/DiscoveryCard.tsx`:
```tsx
import { useUi } from '../state/hooks';
import { closeMenu } from '../state/interactionController';
export function DiscoveryCard() {
  const ui = useUi();
  const o = ui.overlay;
  if (o.kind !== 'discovery') return null;
  return (
    <div className="panel menu" role="dialog" aria-label={o.title}>
      <h2>{o.title}</h2>
      {o.lines.map((l, i) => <p key={i}>{l}</p>)}
      <button onClick={closeMenu} autoFocus>OK</button>
    </div>
  );
}
```

Add to `styles.css`:
```css
.panel { background: var(--panel); border: 3px solid var(--gold); box-shadow: 0 0 0 3px var(--bg), 6px 6px 0 #000a; padding: 12px 14px; }
.panel h2 { margin: 0 0 8px; font-size: 15px; color: var(--gold); letter-spacing: .05em; }
.menu { position: fixed; right: 24px; top: 50%; transform: translateY(-50%); width: min(420px, 90vw); max-height: 80vh; overflow: auto; z-index: 10; }
.menu ul { list-style: none; margin: 0 0 8px; padding: 0; }
.menu li { margin: 0 0 6px; }
button { font: inherit; color: var(--ink); background: var(--panel-2); border: 2px solid var(--sky); padding: 6px 10px; cursor: pointer; width: 100%; text-align: left; display: flex; justify-content: space-between; gap: 8px; }
button:hover:not(:disabled), button:focus-visible { border-color: var(--gold); outline: none; background: #34406160; }
button:disabled { opacity: .5; cursor: not-allowed; }
button.ghost { border-color: var(--muted); justify-content: center; }
.cost { color: var(--muted); white-space: nowrap; }
.reason { margin: 2px 0 0 4px; font-size: 12px; color: var(--warn); }
.unsafe { color: var(--danger); }
.prompt { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: var(--panel); border: 2px solid var(--gold); padding: 4px 12px; z-index: 5; }
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer tests/renderer/interactionController.test.ts
git commit -m "Frontend A3/B5: proximity interactions, engine-driven action menu, discovery card"
```

---

### Task 7: Event dialog with local AI and fallback (B5 EventDialog)

**Files:**
- Create: `src/renderer/services/ai.ts`, `src/renderer/ui/EventDialog.tsx`, `tests/renderer/ai.test.ts`

**Interfaces:**
- Consumes: `buildScenarioRequest`, `fallbackFromRequest` (`src/core/ai/scenario`), `window.signal.ai`.
- Produces:
```ts
export function requestScenario(req: ScenarioAIRequest, runId: string, key: string): Promise<ScenarioContent>; // never rejects; cached per key
export function getAiStatus(): AiStatus;            // last known; 'unavailable' without a bridge
export function onAiStatus(cb: (s: AiStatus) => void): () => void;
export function clearScenarioCache(): void;         // tests
```

- [ ] **Step 1: Write the failing test** `tests/renderer/ai.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildScenarioRequest } from '../../src/core/ai/scenario';
import { clearScenarioCache, requestScenario } from '../../src/renderer/services/ai';
import { EngineStore } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

function req() {
  const s = new EngineStore(); s.newGame(sliceHousehold(), SLICE_SEED);
  return { r: buildScenarioRequest(s.state!)!, runId: s.state!.runId, key: s.activeEventKey()! };
}
afterEach(() => { clearScenarioCache(); vi.unstubAllGlobals(); });

describe('requestScenario', () => {
  it('falls back to reviewed text when there is no bridge', async () => {
    vi.stubGlobal('window', {});
    const { r, runId, key } = req();
    const c = await requestScenario(r, runId, key);
    expect(c.source).toBe('fallback');
    expect(c.actionIds).toEqual(r.actionIds);
  });

  it('falls back when the bridge rejects', async () => {
    vi.stubGlobal('window', { signal: { ai: { generateScenario: () => Promise.reject(new Error('ipc')) } } });
    const { r, runId, key } = req();
    expect((await requestScenario(r, runId, key)).source).toBe('fallback');
  });

  it('calls the model once per event key', async () => {
    const gen = vi.fn(async (q: { eventId: string; variantId: string; actionIds: string[] }) =>
      ({ eventId: q.eventId, variantId: q.variantId, speaker: 'NARRATOR', dialogue: 'x', description: 'y', actionIds: q.actionIds, source: 'ai' }));
    vi.stubGlobal('window', { signal: { ai: { generateScenario: gen } } });
    const { r, runId, key } = req();
    await requestScenario(r, runId, key); await requestScenario(r, runId, key);
    expect(gen).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it.** Run: `npx vitest run tests/renderer/ai.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `src/renderer/services/ai.ts`

```ts
// The renderer's only door to local AI (window.signal.ai). Always resolves; gameplay never waits on it.
import { fallbackFromRequest } from '../../core/ai/scenario';
import type { AiStatus } from '../../shared/bridge';
import type { ScenarioAIRequest, ScenarioContent } from '../../shared/contracts/ai';

const cache = new Map<string, Promise<ScenarioContent>>();
const bridge = () => (typeof window !== 'undefined' ? window.signal : undefined);

export function requestScenario(req: ScenarioAIRequest, runId: string, key: string): Promise<ScenarioContent> {
  const k = `${runId}:${key}`;
  let p = cache.get(k);
  if (!p) {
    const ai = bridge()?.ai;
    p = ai ? ai.generateScenario(req, runId).catch(() => fallbackFromRequest(req, 'bridge-error'))
      : Promise.resolve(fallbackFromRequest(req, 'no-bridge'));
    cache.set(k, p);
  }
  return p;
}

export function clearScenarioCache() { cache.clear(); }

let status: AiStatus = bridge() ? 'starting' : 'unavailable';
const statusListeners = new Set<(s: AiStatus) => void>();
const setStatus = (s: AiStatus) => { status = s; for (const l of statusListeners) l(s); };
const b = bridge();
if (b) { b.ai.status().then(setStatus).catch(() => setStatus('unavailable')); b.ai.onStatus(setStatus); }

export const getAiStatus = () => status;
export function onAiStatus(cb: (s: AiStatus) => void) { statusListeners.add(cb); return () => { statusListeners.delete(cb); }; }
```

- [ ] **Step 4: Run tests.** Run: `npx vitest run tests/renderer/ai.test.ts`. Expected: PASS.

- [ ] **Step 5: EventDialog** `src/renderer/ui/EventDialog.tsx`

```tsx
import { useEffect, useState } from 'react';
import { buildScenarioRequest } from '../../core/ai/scenario';
import { EVENT_BY_ID } from '../../core/content/events';
import type { ScenarioContent } from '../../shared/contracts/ai';
import { requestScenario } from '../services/ai';
import { store } from '../state/engineStore';
import { useEngineState } from '../state/hooks';
import { ui } from '../state/uiStore';

const SPEAKERS: Record<string, string> = { NARRATOR: 'Narrator', NPC_NEIGHBOR: 'A neighbour (message)', NPC_CENTER_STAFF: 'Evacuation centre staff' };

export function EventDialog() {
  const state = useEngineState();
  const ev = state?.activeEvent ?? null;
  const key = ev ? `${ev.eventId}@${ev.triggeredAtMinute}` : null;
  const [content, setContent] = useState<{ key: string; c: ScenarioContent } | null>(null);

  useEffect(() => {
    if (!key || !state) return;
    const req = buildScenarioRequest(state);
    if (!req) return;
    let live = true;
    requestScenario(req, state.runId, key).then((c) => { if (live && store.activeEventKey() === key) setContent({ key, c }); });
    return () => { live = false; };
  }, [key]); // once per event key (blueprint §7)

  if (!ev || !key) return null;
  const c = content?.key === key ? content.c : null; // never show text for a different event
  const choices = store.engine.getEventChoices();
  const title = EVENT_BY_ID.get(ev.eventId)?.title ?? ev.eventId;
  const choose = (id: string) => {
    const r = store.dispatch((e) => e.resolveEvent(id));
    if (!r.ok) ui.toast({ kind: 'error', title: r.error.message, body: r.error.reasons?.join(' ') });
  };
  return (
    <div className="panel event" role="dialog" aria-label={title}>
      <h2>{title} {c?.source === 'ai' && <span className="tag">AI-personalized</span>}</h2>
      {c ? (<>
        <p className="speaker">{SPEAKERS[c.speaker] ?? c.speaker}</p>
        <p className="dialogue">{c.dialogue}</p>
        <p className="desc">{c.description}</p>
      </>) : <p className="loading" aria-busy="true">The scene is taking shape…</p>}
      <ul>
        {choices.map((a) => (
          <li key={a.actionId}>
            <button disabled={!a.available} onClick={() => choose(a.actionId)} title={a.reasons.join(' ')}>
              {a.unsafe && <span className="unsafe">⚠ </span>}{a.label}<span className="cost">{a.timeCostMinutes ? `${a.timeCostMinutes} min` : ''}</span>
            </button>
            {!a.available && a.reasons.length > 0 && <p className="reason">{a.reasons.join(' ')}</p>}
          </li>
        ))}
      </ul>
      <p className="fine">Fictional scenario for learning. Always follow official advisories in a real emergency.</p>
    </div>
  );
}
```

Add to `styles.css`:
```css
.event { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(720px, 94vw); max-height: 70vh; overflow: auto; z-index: 20; }
.event ul { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 6px; }
.tag { font-size: 11px; color: var(--ok); border: 1px solid currentColor; padding: 0 4px; vertical-align: middle; }
.speaker { margin: 0; color: var(--sky); } .dialogue { margin: 4px 0; font-size: 15px; } .desc { margin: 0 0 4px; color: var(--muted); font-style: italic; }
.loading { color: var(--muted); } .fine { margin: 8px 0 0; font-size: 11px; color: var(--muted); }
```

- [ ] **Step 6: Typecheck and tests.** Run: `npm run typecheck; npm test`. Expected: clean, all pass. (Confirm `EVENT_BY_ID` entries have `title`; blueprint §5.2 says so. If the property name differs, use what `src/core/content/events.ts` exports.)

- [ ] **Step 7: Commit**

```bash
git add src/renderer tests/renderer/ai.test.ts
git commit -m "Frontend B5: event dialog with local-AI text, reviewed fallback and stale-text guard"
```

---

### Task 8: Slice shell: HUD, toasts, Bayanihan, end-to-end check

**Files:**
- Create: `src/renderer/ui/Hud.tsx`, `src/renderer/ui/Toasts.tsx`, `src/renderer/ui/badgeToasts.ts` (pure, testable under the root tsconfig), `src/renderer/ui/format.ts`, `tests/renderer/format.test.ts`, `tests/renderer/slice.test.ts`
- Modify: `src/renderer/app/App.tsx` (final slice shell)

**Interfaces:**
- Consumes: everything above. `getBadgeCatalog()`, `ICON_URLS`.
- Produces: `formatClock(gameMinutes: number): string` → `"Day 1 · 06:30"`. `badgeToasts(events: EngineEvent[], catalog: BadgeMeta[]): Omit<Toast,'id'>[]` in `ui/badgeToasts.ts`, used by `App`.

- [ ] **Step 1: Write the failing tests**

`tests/renderer/format.test.ts`:
```ts
import { expect, it } from 'vitest';
import { formatClock } from '../../src/renderer/ui/format';
it('formats day and time from game minutes', () => {
  expect(formatClock(0)).toBe('Day 1 · 00:00');
  expect(formatClock(1440 + 6 * 60 + 5)).toBe('Day 2 · 06:05');
});
```

`tests/renderer/slice.test.ts` (the vertical slice end to end through the same functions the UI calls):
```ts
import { beforeEach, expect, it } from 'vitest';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { interactWith, runMenuAction } from '../../src/renderer/state/interactionController';
import { badgeToasts } from '../../src/renderer/ui/badgeToasts';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import type { EngineEvent } from '../../src/core/engine';

beforeEach(() => { store.reset(); ui.close(); ui.toasts = []; });

it('phone → bulletin → share → exactly one Bayanihan toast; B06 earned by the engine', () => {
  const seen: EngineEvent[] = [];
  store.newGame(sliceHousehold(), SLICE_SEED);
  store.onEvents((e) => { seen.push(...e); for (const t of badgeToasts(e, store.engine.getBadgeCatalog())) ui.toast(t); });
  const first = store.engine.getEventChoices().find((c) => c.available)!;
  store.dispatch((e) => e.resolveEvent(first.actionId));
  const pick = (id: string) => (ui.overlay.kind === 'menu' ? ui.overlay.actions.find((a) => a.actionId === id)! : undefined)!;
  interactWith('LIVING_PHONE', 'Phone');
  if (pick('CHECK_BULLETIN')) runMenuAction(pick('CHECK_BULLETIN'));
  interactWith('LIVING_PHONE', 'Phone');
  runMenuAction(pick('SHARE_VERIFIED_ADVISORY'));
  interactWith('LIVING_PHONE', 'Phone'); // a second share is now unavailable
  expect(pick('SHARE_VERIFIED_ADVISORY').available).toBe(false);
  expect(ui.toasts.filter((t) => t.kind === 'badge')).toHaveLength(1);
  expect(ui.toasts.find((t) => t.kind === 'badge')).toMatchObject({ title: 'Badge earned: Bayanihan', icon: 'badge_b06_bayanihan' });
  expect(store.engine.evaluate().badges.find((b) => b.id === 'B06')!.status).toBe('earned');
  expect(seen.filter((e) => e.type === 'badgeEarned')).toHaveLength(1);
});
```

- [ ] **Step 2: Run them.** Run: `npx vitest run tests/renderer/format.test.ts tests/renderer/slice.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

`src/renderer/ui/format.ts`:
```ts
const pad = (n: number) => String(n).padStart(2, '0');
export function formatClock(gameMinutes: number): string {
  const day = Math.floor(gameMinutes / 1440) + 1, m = gameMinutes % 1440;
  return `Day ${day} · ${pad(Math.floor(m / 60))}:${pad(Math.floor(m % 60))}`;
}
```

`src/renderer/ui/badgeToasts.ts`:
```ts
import type { BadgeMeta } from '../../core/content/badges';
import type { EngineEvent } from '../../core/engine';
import type { Toast } from '../state/uiStore';

/** One toast per badgeEarned engine event (never inferred from re-renders). `icon` is the backend iconAssetId. */
export function badgeToasts(events: EngineEvent[], catalog: BadgeMeta[]): Omit<Toast, 'id'>[] {
  return events.flatMap((e) => {
    if (e.type !== 'badgeEarned') return [];
    const m = catalog.find((b) => b.id === e.badgeId);
    return [{ kind: 'badge' as const, title: `Badge earned: ${m?.name ?? e.badgeId}`, body: m?.description, icon: m?.iconAssetId }];
  });
}
```

`src/renderer/ui/Toasts.tsx`:
```tsx
import { useEffect } from 'react';
import { ICON_URLS } from '../game/assets';
import { useUi } from '../state/hooks';

export function Toasts() {
  const ui = useUi();
  useEffect(() => {
    const timers = ui.toasts.map((t) => setTimeout(() => ui.dismiss(t.id), t.kind === 'badge' ? 6000 : 3500));
    return () => timers.forEach(clearTimeout);
  }, [ui, ui.toasts]);
  return (
    <div className="toasts" aria-live="polite">
      {ui.toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.icon && ICON_URLS[t.icon] && <img src={ICON_URLS[t.icon]} alt="" width={48} height={48} />}
          <div><strong>{t.title}</strong>{t.body && <p>{t.body}</p>}</div>
        </div>
      ))}
    </div>
  );
}
```

`src/renderer/ui/Hud.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { getAiStatus, onAiStatus } from '../services/ai';
import { useEngineState } from '../state/hooks';
import { formatClock } from './format';

export function Hud() {
  const s = useEngineState();
  const [ai, setAi] = useState(getAiStatus());
  useEffect(() => onAiStatus(setAi), []);
  if (!s) return null;
  return (
    <div className="hud">
      <span>{formatClock(s.clock.gameMinutes)}</span>
      <span className="phase">{s.phase}</span>
      <span>Wellbeing {s.player.wellbeing.current}/{s.player.wellbeing.max}</span>
      <span className={`ai ai-${ai}`}>{ai === 'unavailable' ? 'AI offline: using reviewed text' : `AI ${ai}`}</span>
    </div>
  );
}
```

Final `src/renderer/app/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { store } from '../state/engineStore';
import { ui } from '../state/uiStore';
import { PhaserGame } from '../game/PhaserGame';
import { Hud } from '../ui/Hud';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { InteractionMenu } from '../ui/InteractionMenu';
import { DiscoveryCard } from '../ui/DiscoveryCard';
import { EventDialog } from '../ui/EventDialog';
import { Toasts } from '../ui/Toasts';
import { badgeToasts } from '../ui/badgeToasts';
import { sliceHousehold, SLICE_SEED } from './sliceHousehold';

export function App() {
  const [ready] = useState(() => store.state !== null || store.newGame(sliceHousehold(), SLICE_SEED).ok);
  useEffect(() => store.onEvents((events) => {
    for (const t of badgeToasts(events, store.engine.getBadgeCatalog())) ui.toast(t);
  }), []);
  if (!ready) return <div className="boot">Could not start the game.</div>;
  return (<>
    <PhaserGame />
    <Hud /><InteractionPrompt /><InteractionMenu /><DiscoveryCard /><EventDialog /><Toasts />
  </>);
}
```
(The effect returns the unsubscribe function, so StrictMode's mount/unmount/mount leaves exactly one listener: Review Focus 4.)

Add to `styles.css`:
```css
.hud { position: fixed; top: 0; left: 0; right: 0; display: flex; gap: 16px; padding: 6px 12px; background: #10141fcc; border-bottom: 2px solid var(--panel-2); z-index: 5; }
.hud .phase { color: var(--gold); text-transform: uppercase; } .ai-ready { color: var(--ok); } .ai-unavailable { color: var(--warn); }
.toasts { position: fixed; top: 44px; right: 16px; display: grid; gap: 8px; z-index: 30; width: min(360px, 90vw); }
.toast { display: flex; gap: 10px; align-items: center; background: var(--panel); border: 2px solid var(--sky); padding: 8px 10px; animation: toast-in .18s ease-out; }
.toast p { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
.toast img { image-rendering: pixelated; }
.toast-badge { border-color: var(--gold); } .toast-error { border-color: var(--danger); }
@keyframes toast-in { from { transform: translateY(-6px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
```

- [ ] **Step 4: Run all checks.** Run: `npm run typecheck; npm test`. Expected: clean, and all tests pass (329 backend tests plus the renderer tests).

- [ ] **Step 5: Manual vertical-slice check in the real app.** Run `npm run dev` with the AI runtime env set and the model present, and check:
  - the EV01 dialog shows "The scene is taking shape…", then text (the "AI-personalized" tag appears if the model answered);
  - choosing an option closes it;
  - walk to the phone and the prompt shows "E Phone";
  - E opens the menu, and Share is disabled with the engine reason;
  - Check official information → time advances;
  - E → Share → exactly one "Badge earned: Bayanihan" toast with the icon;
  - movement continues.

  Repeat once with `$env:SIGNAL_LLM_DIR='C:\nope'` to confirm the fallback text and the "AI offline" HUD label. Confirm with the human partner, since the agent can't see the window.

- [ ] **Step 6: Production smoke again.** Run Task 5 Step 7. Expected: `boot ok … missing=[]` and no CSP refusals.

- [ ] **Step 7: Commit**

```bash
git add src/renderer tests/renderer
git commit -m "Frontend M4 vertical slice: HUD, event-driven Bayanihan toast, full phone → share flow"
```

---

## After this plan

Next milestones get their own plans: M5 onboarding and customization (frontend-design skill for the screens), M6 SceneDirective rendering and scenes, M7 HUD, inventory and shop, M8 badges and achievements, M9 debrief, save and replay, M10 packaged offline validation.
