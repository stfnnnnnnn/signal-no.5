// Loads images by Vite URL and generates every texture the slice needs that has no art yet.
import Phaser from 'phaser';
import { ANCHORS, T, TILE } from '../layout';
import { CHARACTER_SHEETS, ITEM_URLS, charKey, itemKey, type SpriteBase } from '../assets';

/** Floor/wall colours per theme, indexed by T: [wall, kitchen, bedroom, utility, living, entrance]. Same geometry for both. */
export const THEME_TILES: Record<'modern' | 'traditional', string[]> = {
  traditional: ['#5a3a22', '#7fb89a', '#b07a45', '#8a8f99', '#c99a5e', '#9aa6b0'],
  modern: ['#3c4660', '#a9d6c1', '#d7b98a', '#9aa3ad', '#e6cf9f', '#b9c4cc'],
};
export const PLACEHOLDER_COLORS: Record<string, string> = {
  LIVING_TV: '#2e3440', KITCHEN_SINK: '#9fd0ff', UTILITY_TOOLS: '#d9734e', UTILITY_LADDER: '#c9a227', PET_AREA: '#e8a0b4', STAIRS: '#7a5230',
};

export class Boot extends Phaser.Scene {
  private readonly missing: string[] = [];
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
    for (const base of Object.keys(CHARACTER_SHEETS) as SpriteBase[]) if (!this.textures.exists(charKey(base))) this.makeBlock(charKey(base), '#ff00ff');
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
