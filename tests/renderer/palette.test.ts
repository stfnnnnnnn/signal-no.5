import { expect, it } from 'vitest';
import { tintFor } from '../../src/renderer/game/palette';

it('maps palette variants to tints; variant 0 keeps the original art', () => {
  expect(tintFor('pal_dad_0', null)).toBeNull();
  expect(tintFor('pal_mom_1', null)).toBe(0xb8d8ff);
  expect(tintFor('pal_boy_3', null)).toBe(0xc8f0b0);
});
it('uses the chosen clothing colour for a custom palette', () => {
  expect(tintFor('custom', '#ff8800')).toBe(0xff8800);
  expect(tintFor('custom', null)).toBeNull();
});
