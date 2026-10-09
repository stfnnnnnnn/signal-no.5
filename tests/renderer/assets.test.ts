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
