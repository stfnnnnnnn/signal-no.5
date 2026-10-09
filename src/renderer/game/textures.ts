// Generated pixel-art placeholders for everything the art set does not cover yet (effects, props, NPC cues, pets).
// Small canvases drawn with hard pixels, so they sit with the processed 32x32 sprites.
import Phaser from 'phaser';
import type { PropVariantId } from '../../shared/contracts/scene';

type Px = (x: number, y: number, w: number, h: number, c: string) => void;
function draw(scene: Phaser.Scene, key: string, w: number, h: number, paint: (px: Px) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  paint((x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); });
  tex.refresh();
}

/** Prop variants that change how the house looks (null = nothing drawn: the plain/empty state). */
export const PROP_TEXTURE: Partial<Record<PropVariantId, string>> = {
  WINDOW_BOARDED: 'prop_boards', YARD_LOOSE_ITEMS: 'prop_loose', YARD_SECURED: 'prop_tied', ENTRANCE_SANDBAGS: 'prop_sandbags',
  STAIRS_RAISED_BELONGINGS: 'prop_boxes', LIVING_TABLE_EMPTY: 'prop_table', LIVING_TABLE_FLASHLIGHT: 'prop_table_light',
  GO_BAG_PARTIAL: 'prop_bag_partial', GO_BAG_READY: 'prop_bag_ready',
  MODERN_LIVING_PHOTOS: 'decor_photos', MODERN_LIVING_PLANTS: 'decor_plant', MODERN_KITCHEN_RICE_COOKER: 'decor_ricecooker',
  MODERN_KITCHEN_FRUIT_BOWL: 'decor_fruit', MODERN_BEDROOM_POSTERS: 'decor_poster', MODERN_BEDROOM_DESK_LAMP: 'decor_lamp',
  TRAD_LIVING_ALTAR: 'decor_altar', TRAD_LIVING_CAPIZ_LAMP: 'decor_capiz', TRAD_KITCHEN_PALAYOK: 'decor_palayok',
  TRAD_KITCHEN_BAYONG: 'decor_bayong', TRAD_BEDROOM_BANIG: 'decor_banig', TRAD_BEDROOM_WOODEN_CHEST: 'decor_chest',
};

export const EMOTION_TEXTURE = (e: string) => `cue_${e}`;

export function makeGeneratedTextures(scene: Phaser.Scene) {
  // weather and effects
  draw(scene, 'fx_rain', 1, 6, (p) => p(0, 0, 1, 6, '#bfe3ff'));
  draw(scene, 'fx_drip', 1, 3, (p) => p(0, 0, 1, 3, '#9fd0ff'));
  draw(scene, 'fx_leaf', 3, 2, (p) => { p(0, 0, 3, 2, '#6f8f3a'); p(1, 0, 1, 1, '#8fb34a'); });
  draw(scene, 'fx_mote', 1, 1, (p) => p(0, 0, 1, 1, '#fff6d0'));
  draw(scene, 'fx_ripple', 8, 3, (p) => { p(1, 0, 6, 1, '#d8f0ff'); p(0, 1, 1, 1, '#d8f0ff'); p(7, 1, 1, 1, '#d8f0ff'); p(1, 2, 6, 1, '#d8f0ff'); });
  draw(scene, 'fx_debris', 6, 4, (p) => { p(0, 1, 6, 2, '#6b5236'); p(1, 0, 2, 1, '#8a6a46'); p(4, 3, 2, 1, '#4f3c28'); });
  draw(scene, 'fx_water', 16, 16, (p) => { p(0, 0, 16, 16, '#3f78b8'); p(2, 4, 5, 1, '#6aa0d8'); p(9, 11, 5, 1, '#6aa0d8'); });
  draw(scene, 'fx_glow', 64, 64, (p) => {
    for (let r = 32; r > 0; r -= 4) { const a = (1 - r / 32) * 0.35; p(32 - r, 32 - r, r * 2, r * 2, `rgba(255,240,190,${a.toFixed(2)})`); }
  });
  // props (16x16)
  draw(scene, 'prop_boards', 16, 16, (p) => { p(1, 3, 14, 3, '#9a6b3c'); p(1, 10, 14, 3, '#9a6b3c'); p(3, 3, 1, 3, '#5e3f22'); p(12, 10, 1, 3, '#5e3f22'); });
  draw(scene, 'prop_loose', 16, 16, (p) => { p(2, 9, 5, 4, '#7a8a96'); p(9, 6, 4, 7, '#b0703a'); p(5, 3, 3, 3, '#5aa05a'); });
  draw(scene, 'prop_tied', 16, 16, (p) => { p(2, 7, 12, 6, '#7a8a96'); p(2, 9, 12, 1, '#e8d080'); });
  draw(scene, 'prop_sandbags', 16, 16, (p) => { for (const [x, y] of [[0, 10], [5, 10], [10, 10], [2, 6], [8, 6]]) { p(x!, y!, 6, 4, '#c8b07a'); p(x!, y! + 3, 6, 1, '#8c7a50'); } });
  draw(scene, 'prop_boxes', 16, 16, (p) => { p(1, 8, 7, 6, '#b08a5a'); p(7, 3, 7, 6, '#c29a66'); p(4, 8, 1, 6, '#7a5e3a'); });
  draw(scene, 'prop_table', 16, 16, (p) => { p(1, 6, 14, 3, '#8a5a32'); p(2, 9, 2, 6, '#5e3f22'); p(12, 9, 2, 6, '#5e3f22'); });
  draw(scene, 'prop_table_light', 16, 16, (p) => { p(1, 6, 14, 3, '#8a5a32'); p(2, 9, 2, 6, '#5e3f22'); p(12, 9, 2, 6, '#5e3f22'); p(6, 3, 5, 3, '#e05561'); p(11, 3, 2, 3, '#fff2a0'); });
  draw(scene, 'prop_bag_partial', 8, 8, (p) => { p(0, 0, 8, 8, '#10141f'); p(1, 1, 6, 6, '#f2c14e'); p(1, 4, 6, 3, '#2b3550'); });
  draw(scene, 'prop_bag_ready', 8, 8, (p) => { p(0, 0, 8, 8, '#10141f'); p(1, 1, 6, 6, '#5fb36a'); p(2, 4, 1, 1, '#fff'); p(3, 5, 1, 1, '#fff'); p(4, 4, 1, 1, '#fff'); p(5, 3, 1, 1, '#fff'); });
  const decor: [string, string, string][] = [
    ['decor_photos', '#c9a227', '#e8e0c8'], ['decor_plant', '#3f8f4a', '#8a5a32'], ['decor_ricecooker', '#e8e8e8', '#e05561'],
    ['decor_fruit', '#e0a030', '#c84040'], ['decor_poster', '#6aa0d8', '#e8e0c8'], ['decor_lamp', '#fff2a0', '#4a4a4a'],
    ['decor_altar', '#8a5a32', '#f2c14e'], ['decor_capiz', '#f0e6d0', '#c9b48a'], ['decor_palayok', '#a0522d', '#5e2f16'],
    ['decor_bayong', '#c8a050', '#7a5a28'], ['decor_banig', '#d8c070', '#a04040'], ['decor_chest', '#6b4423', '#c9a227'],
  ];
  for (const [key, a, b] of decor) draw(scene, key, 12, 12, (p) => { p(1, 3, 10, 8, a); p(3, 5, 6, 2, b); p(1, 10, 10, 1, '#00000055'); });
  // NPC emotion bubbles (7x7)
  const cue: Record<string, [string, number[][]]> = {
    calm: ['#5fb36a', [[2, 3], [3, 4], [4, 3]]], worried: ['#f2c14e', [[2, 2], [3, 1], [4, 2], [4, 3], [3, 4], [3, 6]]],
    anxious: ['#d9734e', [[3, 1], [3, 2], [3, 3], [3, 4], [3, 6]]], determined: ['#9fd0ff', [[1, 4], [2, 3], [3, 2], [4, 3], [5, 4]]],
    relieved: ['#a8e6a0', [[1, 3], [2, 4], [3, 5], [4, 4], [5, 3]]], tired: ['#b8b8d0', [[1, 2], [2, 2], [3, 2], [2, 3], [1, 4], [2, 4], [3, 4]]],
  };
  for (const [e, [color, dots]] of Object.entries(cue)) draw(scene, EMOTION_TEXTURE(e), 7, 7, (p) => { p(0, 0, 7, 7, '#f4f1e8'); p(0, 0, 7, 1, '#10141f'); for (const [x, y] of dots) p(x!, y!, 1, 1, color); });
  // pets (12x10)
  draw(scene, 'pet_dog', 12, 10, (p) => { p(2, 3, 8, 4, '#a0703c'); p(8, 1, 3, 3, '#a0703c'); p(9, 2, 1, 1, '#10141f'); p(2, 7, 1, 3, '#7a5228'); p(8, 7, 1, 3, '#7a5228'); p(0, 3, 2, 1, '#a0703c'); });
  draw(scene, 'pet_cat', 12, 10, (p) => { p(2, 4, 7, 3, '#8a8a8a'); p(8, 2, 3, 3, '#8a8a8a'); p(8, 1, 1, 1, '#8a8a8a'); p(10, 1, 1, 1, '#8a8a8a'); p(9, 3, 1, 1, '#f2c14e'); p(0, 2, 2, 1, '#8a8a8a'); p(3, 7, 1, 2, '#6a6a6a'); p(7, 7, 1, 2, '#6a6a6a'); });
  draw(scene, 'pet_bird', 12, 10, (p) => { p(3, 3, 5, 4, '#e0c040'); p(7, 2, 3, 3, '#e0c040'); p(10, 3, 1, 1, '#d9734e'); p(8, 3, 1, 1, '#10141f'); p(1, 7, 10, 1, '#5e3f22'); });
  draw(scene, 'pet_other', 12, 10, (p) => { p(3, 4, 6, 4, '#c0a080'); p(4, 3, 4, 1, '#c0a080'); p(5, 5, 1, 1, '#10141f'); });
}
