import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/engine';
import { GameState } from '../src/shared/contracts/state';
import { aloneSurvey, familySurvey } from './fixtures/households';

const start = (s = familySurvey(), seed = 11) => {
  const r = createGame(s, { seed });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.engine;
};

describe('initial game state', () => {
  it('produces a schema-valid GameState at hour 0 in the house during preparation', () => {
    const st = start().getState();
    expect(GameState.safeParse(st).success).toBe(true);
    expect(st.phase).toBe('preparation');
    expect(st.scene).toBe('HOUSE');
    expect(st.clock.gameMinutes).toBe(0);
    expect(st.clock.timeScale).toBe(1);
  });

  it('opens the initial advisory event (EV01) as a mandatory event that pauses the clock', () => {
    const st = start().getState();
    expect(st.activeEvent?.eventId).toBe('EV01');
    expect(st.activeEvent?.mandatory).toBe(true);
    expect(st.clock.pauseReasons).toContain('decision');
  });

  it('sets starting cash from the fictional budget tier', () => {
    expect(start(familySurvey()).getState().cash).toBe(800);
    expect(start(aloneSurvey()).getState().cash).toBe(3000);
    const m = aloneSurvey(); delete m.budgetTier;
    expect(start(m).getState().cash).toBe(1500);
  });

  it('derives starting water and food from household size and declared supplies', () => {
    const fam = start(familySurvey()).getState(); // water declared, food not; 4 members
    expect((fam.house.WATER ?? 0) + (fam.goBag.WATER ?? 0)).toBe(12);
    expect((fam.house.FOOD ?? 0) + (fam.goBag.FOOD ?? 0)).toBe(4);
    const alone = start(aloneSurvey()).getState(); // water and food declared; 1 member
    expect((alone.house.FOOD ?? 0) + (alone.goBag.FOOD ?? 0)).toBe(3);
  });

  it('starts the phone at 55% battery and always includes the phone and documents', () => {
    const st = start().getState();
    expect(st.phoneBattery).toBe(55);
    expect(st.house.PHONE).toBe(1);
    expect((st.house.DOCUMENTS ?? 0) + (st.goBag.DOCUMENTS ?? 0)).toBe(1);
  });

  it('maps declared plans to preparedness flags', () => {
    const alone = start(aloneSurvey()).getState();
    expect(alone.flags.COMMUNICATION_PLAN_READY).toBe(true);
    expect(alone.flags.EVACUATION_CENTER_KNOWN).toBe(true);
    expect(alone.flags.DOCUMENTS_PROTECTED).toBe(true);
    const fam = start(familySurvey()).getState();
    expect(fam.flags.COMMUNICATION_PLAN_READY ?? false).toBe(false);
    expect(fam.flags.EVACUATION_CENTER_KNOWN ?? false).toBe(false);
  });

  it('packs a complete go-bag for a "complete" answer and none for "none"', () => {
    const alone = start(aloneSurvey()).getState();
    expect(Object.keys(alone.goBag).length).toBeGreaterThan(4);
    const s = aloneSurvey(); s.q18GoBag = 'none';
    expect(Object.keys(start(s).getState().goBag)).toHaveLength(0);
  });

  it('gives flood-prone households a more severe authored flood than inland ones', () => {
    const order = ['none', 'low', 'moderate', 'severe'];
    const fam = start(familySurvey()).getState().storm.peakFloodSeverity;
    const alone = start(aloneSurvey()).getState().storm.peakFloodSeverity;
    expect(order.indexOf(fam)).toBeGreaterThan(order.indexOf(alone));
  });

  it('is deterministic for the same survey and seed', () => {
    const a = start(familySurvey(), 5).getState();
    const b = start(familySurvey(), 5).getState();
    expect({ ...a, runId: '' }).toEqual({ ...b, runId: '' });
  });

  it('produces different starting conditions for contrasting households', () => {
    const fam = start(familySurvey()).getState();
    const alone = start(aloneSurvey()).getState();
    expect(fam.cash).not.toBe(alone.cash);
    expect(fam.household.members.length).not.toBe(alone.household.members.length);
    expect(JSON.stringify(fam.goBag)).not.toBe(JSON.stringify(alone.goBag));
  });

  it('returns validation issues instead of a game for an invalid survey', () => {
    const s = familySurvey(); s.q1HouseholdSize = '1';
    const r = createGame(s, { seed: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_SURVEY');
  });
});
