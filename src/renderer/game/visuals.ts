// How each SceneDirective level looks. Pure tables, so the rules (e.g. no electric light in an outage) are testable.
import type { LightingPreset, SceneDirective } from '../../shared/contracts/scene';

type FloodOverlay = SceneDirective['flood'];

export interface LightingLook { color: number; alpha: number; electric: boolean; flashlight: boolean }
const LOOK: Record<LightingPreset, LightingLook> = {
  daylight: { color: 0x000000, alpha: 0, electric: false, flashlight: false },
  overcast: { color: 0x30405a, alpha: 0.14, electric: false, flashlight: false },
  gloomy: { color: 0x202a40, alpha: 0.28, electric: true, flashlight: false },
  stormDark: { color: 0x0a1020, alpha: 0.42, electric: true, flashlight: false },
  outageDark: { color: 0x000000, alpha: 0.62, electric: false, flashlight: false },
  outageFlashlight: { color: 0x000000, alpha: 0.55, electric: false, flashlight: true },
  evacuationCenter: { color: 0xfff0c0, alpha: 0.08, electric: true, flashlight: false },
  shopInterior: { color: 0xffe0a0, alpha: 0.06, electric: true, flashlight: false },
  morningAfter: { color: 0xffd8a0, alpha: 0.12, electric: false, flashlight: false },
};
export const lightingLook = (p: LightingPreset): LightingLook => LOOK[p];

const RAIN: Record<string, number> = { none: 0, light: 40, moderate: 110, heavy: 220, torrential: 380 };
/** Rain drops per second on screen. */
export const rainRate = (level: string) => RAIN[level] ?? 0;

const WIND: Record<string, number> = { calm: 0, breezy: 20, gusty: 55, strong: 95, violent: 150 };
/** Sideways drift (px/s) for rain and debris. */
export const windDrift = (level: string) => WIND[level] ?? 0;

const FLOOD: Record<FloodOverlay, number> = { none: 0, low: 0.18, moderate: 0.32, severe: 0.48 };
/** Opacity of the water layer over the floor. */
export const floodAlpha = (f: FloodOverlay) => FLOOD[f];
