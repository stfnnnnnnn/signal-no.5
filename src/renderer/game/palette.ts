// Clothing variants: the art has one outfit per character, so the backend's 4 palette variants are colour tints.
const VARIANT_TINTS = [null, 0xb8d8ff, 0xffd29a, 0xc8f0b0] as const;

/** Phaser tint for a member's paletteId (`pal_<base>_<0..3>` or `custom`), or null for the original colours. */
export function tintFor(paletteId: string, clothingColor: string | null): number | null {
  if (paletteId === 'custom') return clothingColor && /^#[0-9a-f]{6}$/i.test(clothingColor) ? parseInt(clothingColor.slice(1), 16) : null;
  const n = Number(paletteId.split('_').pop());
  return VARIANT_TINTS[Number.isInteger(n) ? n % 4 : 0] ?? null;
}
