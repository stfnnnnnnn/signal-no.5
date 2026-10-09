import { describe, expect, it } from 'vitest';
import { createGame, type GameEngine } from '../src/core/engine';
import { buildSceneDirective } from '../src/core/scene/directive';
import { EXPOSURE_PROFILES } from '../src/core/content/storm';
import type { GameState } from '../src/shared/contracts/state';
import type { Exposure } from '../src/shared/contracts/onboarding';
import { customSolo } from './fixtures/onboarding';
import { resolveFirst } from './helpers';

const H = 60;
const SURROUNDINGS: Record<Exposure, ('waterway' | 'floodProne' | 'neither' | 'notSure')[]> = {
  standard: ['neither'], waterway: ['waterway'], floodProne: ['floodProne'], both: ['waterway', 'floodProne'], unknown: ['notSure'],
};
function game(exposure: Exposure, seed = 4): GameEngine {
  const r = createGame({ ...customSolo(), q6Surroundings: SURROUNDINGS[exposure] }, { seed });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.engine;
}
function until(e: GameEngine, pred: (s: GameState) => boolean) {
  for (let i = 0; i < 5000 && !pred(e.getState()); i++) {
    const s = e.getState();
    if (s.activeEvent) { resolveFirst(e, ['DEFER', 'DELAY_EVACUATION']); continue; }
    if (['impact', 'aftermath', 'evacuation'].includes(s.phase)) { e.skipToNextMilestone(); continue; }
    e.setSpeed(32); e.tick(1_000);
  }
  return e.getState();
}

describe('environmental exposure profiles', () => {
  it.each([
    ['standard', ['low'], 0, 0],
    ['waterway', ['moderate'], 4, 2],
    ['floodProne', ['moderate', 'severe'], 6, 2],
    ['both', ['severe'], 6, 4],
    ['unknown', ['moderate'], 0, 0],
  ] as const)('%s → peak %j, flood onset %i h before landfall, advisory %i h earlier', (exposure, peaks, onset, lead) => {
    const st = game(exposure).getState();
    expect(st.storm.exposure).toBe(exposure);
    expect(peaks).toContain(st.storm.peakFloodSeverity);
    expect(st.storm.floodOnsetHoursBeforeLandfall).toBe(onset);
    expect(st.storm.advisoryLeadHours).toBe(lead);
    expect(EXPOSURE_PROFILES[exposure].fictional).toBe(true);
  });

  it('always issues an evacuation advisory for waterway, flood-prone and combined exposure', () => {
    for (const exposure of ['waterway', 'floodProne', 'both'] as const)
      for (const seed of [1, 2, 3, 4, 5]) expect(game(exposure, seed).getState().storm.evacuationAdvisoryEvent).toBe(true);
  });

  it('issues the advisory earlier under higher exposure', () => {
    const at = (x: Exposure) => { const e = game(x); const s = until(e, (st) => st.environment.evacuationAdvisoryIssued); return s.landfallMinute - s.clock.gameMinutes; };
    expect(at('both')).toBeGreaterThan(at('waterway'));
    expect(at('waterway')).toBeGreaterThan(8 * H - 1);
  });

  it('starts flooding before landfall for flood-related exposure, and not for standard', () => {
    const early = (x: Exposure) => { const e = game(x); const s = until(e, (st) => st.environment.floodSeverity !== 'none' || st.phase === 'impact'); return s.landfallMinute - s.clock.gameMinutes; };
    expect(early('both')).toBe(6 * H);
    expect(early('floodProne')).toBe(6 * H);
    expect(early('waterway')).toBe(4 * H);
    expect(early('standard')).toBe(0);
  });

  it('escalates faster for combined exposure (moderate from landfall −2 h)', () => {
    const e = game('both');
    let risingAt: number | null = null;
    for (let i = 0; i < 5000 && risingAt === null; i++) {
      const s = e.getState();
      const r = s.activeEvent ? e.resolveEvent(e.getEventChoices().find((c) => c.available)!.actionId) : (e.setSpeed(32), e.tick(1_000));
      if (r.ok) for (const ev of r.events) if (ev.type === 'milestone' && ev.id === 'FLOOD_RISING') risingAt = ev.minute;
    }
    const st = e.getState();
    expect(risingAt).toBe(st.landfallMinute - 2 * H);
    expect(st.environment.floodSeverity).toBe('moderate');
  });

  it('keeps the scene flood overlay synchronised with the engine during early flooding', () => {
    const e = game('both');
    const s = until(e, (st) => st.environment.floodSeverity === 'low');
    expect(buildSceneDirective(s).flood).toBe('low');
  });

  it('keeps exposure separate from preparedness scoring inputs (fictional profile, not a prediction)', () => {
    for (const x of Object.keys(EXPOSURE_PROFILES) as Exposure[]) expect(EXPOSURE_PROFILES[x].description).toMatch(/fictional/i);
  });
});
