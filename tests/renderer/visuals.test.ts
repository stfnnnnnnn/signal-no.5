import { describe, expect, it } from 'vitest';
import { FloodOverlay, LightingPreset, RainLevel, WindLevel } from '../../src/shared/contracts/scene';
import { floodAlpha, lightingLook, rainRate, windDrift } from '../../src/renderer/game/visuals';

describe('directive visuals', () => {
  it('has a look for every lighting preset; outages never show electric light', () => {
    for (const p of LightingPreset.options) expect(lightingLook(p).alpha).toBeGreaterThanOrEqual(0);
    expect(lightingLook('daylight').alpha).toBe(0);
    for (const p of ['outageDark', 'outageFlashlight'] as const) expect(lightingLook(p).electric).toBe(false);
    expect(lightingLook('outageFlashlight').flashlight).toBe(true);
    expect(lightingLook('outageDark').alpha).toBeGreaterThan(lightingLook('stormDark').alpha);
  });
  it('rain, wind and flood grow with the engine level', () => {
    const rates = RainLevel.options.map(rainRate);
    expect(rates[0]).toBe(0);
    expect(rates).toEqual([...rates].sort((a, b) => a! - b!));
    const drift = WindLevel.options.map(windDrift);
    expect(drift).toEqual([...drift].sort((a, b) => a! - b!));
    const flood = FloodOverlay.options.map(floodAlpha);
    expect(flood[0]).toBe(0);
    expect(flood).toEqual([...flood].sort((a, b) => a! - b!));
  });
});

import { weatherOverlay } from '../../src/renderer/game/visuals';
import { ROOMS } from '../../src/renderer/game/rooms';
describe('indoor weather', () => {
  it('draws no falling rain, wind debris or mist indoors; outdoors follows the engine level', () => {
    expect(weatherOverlay('heavy', 'strong', true)).toEqual({ rainRate: 0, debris: false, mist: false });
    expect(weatherOverlay('heavy', 'strong', false)).toEqual({ rainRate: rainRate('heavy'), debris: true, mist: true });
    expect(weatherOverlay('none', 'calm', false)).toEqual({ rainRate: 0, debris: false, mist: false });
  });
  it('the shop and evacuation centre are indoor rooms; the street is outdoors', () => {
    expect(ROOMS.Shop.indoor).toBe(true);
    expect(ROOMS.Evacuation.indoor).toBe(true);
    expect(ROOMS.Street.indoor).toBe(false);
  });
});
