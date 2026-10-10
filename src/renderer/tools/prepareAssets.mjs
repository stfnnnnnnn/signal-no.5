// One-off: turn the original art in /assets into game-ready, nearest-neighbour PNGs under src/renderer/assets.
// Usage: npm run assets   (originals stay untracked; outputs are committed)
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = path.resolve('assets');
const OUT = path.resolve('src/renderer/assets');
/** Decode a PNG, ignoring any bytes some editors append after the IEND chunk. */
function read(p) {
  const buf = readFileSync(p);
  const iend = buf.lastIndexOf('IEND');
  return PNG.sync.read(iend > 0 ? buf.subarray(0, iend + 8) : buf);
}
const write = (p, png) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, PNG.sync.write(png)); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

/** Nearest-neighbour sample of a source rectangle into a size×size image (samples block centres). */
function sample(src, sx, sy, sw, sh, size) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = Math.min(src.width - 1, Math.max(0, Math.floor(sx + ((x + 0.5) * sw) / size)));
    const py = Math.min(src.height - 1, Math.max(0, Math.floor(sy + ((y + 0.5) * sh) / size)));
    const i = (py * src.width + px) * 4, o = (y * size + x) * 4;
    for (let k = 0; k < 4; k++) out.data[o + k] = src.data[i + k];
    out.data[o + 3] = out.data[o + 3] < 128 ? 0 : 255; // hard pixel-art edges
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
  const idx = Number([...name.matchAll(/-(\d)\.png/g)].at(-1)?.[1] ?? 1); // last "-N.png" is the frame number
  const dir = DIRS[dirWord];
  const slot = (((frames[baseWord] ??= {})[state] ??= {})[dir] ??= new Map());
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

// ---- badges/achievements: 1254×1254 opaque; the file's number suffix (1..22) indexes this list ----
const ICONS = ['badge_b01_handa', 'badge_b02_go_bag_ready', 'badge_b03_tubig_muna', 'badge_b04_botika_run', 'badge_b05_fact_checker',
  'badge_b06_bayanihan', 'badge_b07_maagang_lumikas', 'badge_b08_walang_maiiwan', 'badge_b09_bintana_boss', 'badge_b10_bubong_secured',
  'badge_b11_family_plan', 'badge_b12_powered_up', 'achievement_a01_first_storm', 'achievement_a02_natuto', 'achievement_a03_lesson_collector',
  'achievement_a04_signal_master', 'achievement_a05_kapos_pero_handa', 'achievement_a06_storm_chaser', 'achievement_a08_whole_barangay',
  'achievement_a09_my_real_home', 'achievement_a07_no_rumor_spreader', 'achievement_a10_plan_in_hand'];
for (const file of walk(path.join(SRC, 'BADGES'))) {
  const n = Number(path.basename(file).match(/-(\d+)\.png$/)[1]);
  const src = read(file);
  const out = sample(src, 0, 0, src.width, src.height, 96);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255; // badges are opaque art
  write(path.join(OUT, 'badges', `${ICONS[n - 1]}.png`), out);
}
console.log('assets prepared →', OUT);
