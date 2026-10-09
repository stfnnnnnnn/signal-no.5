import { describe, expect, it } from 'vitest';
import { loadGame, type GameEngine } from '../src/core/engine';
import { wellbeingPercent, WELLBEING_RULES } from '../src/core/wellbeing';
import { GameState } from '../src/shared/contracts/state';
import { aloneSurvey, familySurvey } from './fixtures/households';
import { newGame, resolveFirst } from './helpers';

function withState(e: GameEngine, patch: (s: GameState) => void): GameEngine {
  const s = e.getState(); patch(s);
  const r = loadGame(s); if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.engine;
}
function runUntil(e: GameEngine, id: string, prefer: string[]) {
  for (let i = 0; i < 5000; i++) {
    const s = e.getState();
    if (s.completed) return false;
    if (s.activeEvent?.eventId === id) return true;
    if (s.activeEvent) { resolveFirst(e, prefer); continue; }
    if (['impact', 'aftermath', 'evacuation'].includes(s.phase)) { e.skipToNextMilestone(); continue; }
    e.setSpeed(32); e.tick(60_000);
  }
  return false;
}
const wb = (e: GameEngine) => e.getState().player.wellbeing;

describe('player wellbeing', () => {
  it('starts at 100/100 for the player only', () => {
    const st = newGame().getState();
    expect(st.player.wellbeing).toEqual({ current: 100, max: 100 });
    expect(st.household.members.every((m) => !('wellbeing' in m))).toBe(true);
  });

  it('defines exactly the two approved penalties', () => {
    expect(WELLBEING_RULES.map((r) => [r.id, r.delta])).toEqual([['W_ADVISORY_IGNORED_SEVERE_FLOOD', -15], ['W_REMAINED_IN_UNSAFE_ROOM', -10]]);
  });

  it('applies −15 when an applicable advisory was ignored and the home floods severely', () => {
    const e = withState(newGame(familySurvey()), (s) => { s.storm.evacuationAdvisoryEvent = true; s.storm.peakFloodSeverity = 'severe'; });
    runUntil(e, 'EV10', ['DEFER', 'DELAY_EVACUATION']);
    expect(wb(e).current).toBe(85);
    expect(e.getState().player.wellbeingEvents[0]).toMatchObject({ ruleId: 'W_ADVISORY_IGNORED_SEVERE_FLOOD', delta: -15 });
  });

  it('does not apply it without an advisory, without severe flooding, or after evacuating', () => {
    const noAdvisory = withState(newGame(familySurvey()), (s) => { s.storm.evacuationAdvisoryEvent = false; s.storm.peakFloodSeverity = 'severe'; });
    runUntil(noAdvisory, 'EV10', ['DEFER']);
    expect(wb(noAdvisory).current).toBe(100);
    const moderate = withState(newGame(familySurvey()), (s) => { s.storm.evacuationAdvisoryEvent = true; s.storm.peakFloodSeverity = 'moderate'; });
    runUntil(moderate, 'EV10', ['DEFER', 'DELAY_EVACUATION']);
    expect(wb(moderate).current).toBe(100);
    const evac = withState(newGame(aloneSurvey()), (s) => { s.storm.evacuationAdvisoryEvent = true; s.storm.peakFloodSeverity = 'severe'; });
    runUntil(evac, 'EV08', ['DEFER']);
    evac.resolveEvent('FOLLOW_EVACUATION');
    runUntil(evac, 'EV13', ['ACCOUNT_MEMBERS', 'DEFER']);
    expect(wb(evac).current).toBe(100);
  });

  it('applies −10 when the player stays in an explicitly unsafe room although moving was offered', () => {
    const e = withState(newGame(familySurvey()), (s) => { s.storm.evacuationAdvisoryEvent = false; s.storm.peakFloodSeverity = 'severe'; s.storm.peakWindSeverity = 'severe'; });
    runUntil(e, 'EV10', ['DEFER']);
    expect(e.getState().activeEvent!.variantId).toBe('EV10__CRITICAL');
    expect(e.getEventChoices().some((c) => c.actionId === 'MOVE_TO_SAFER_ROOM' && c.available)).toBe(true);
    e.resolveEvent('ACCOUNT_MEMBERS');
    expect(wb(e).current).toBe(90);
  });

  it('does not penalise moving to the safer room, outdoors exposure, outages or high-exposure homes', () => {
    const e = withState(newGame(familySurvey()), (s) => { s.storm.evacuationAdvisoryEvent = false; s.storm.peakFloodSeverity = 'severe'; s.storm.peakWindSeverity = 'severe'; s.storm.powerOutageEvent = true; s.storm.exposure = 'both'; });
    runUntil(e, 'EV10', ['DEFER', 'CHECK_HOUSEHOLD_NEEDS']);
    e.resolveEvent('MOVE_TO_SAFER_ROOM');
    expect(wb(e).current).toBe(100);
  });

  it('applies each penalty at most once and never below zero', () => {
    const e = withState(newGame(familySurvey()), (s) => { s.player.wellbeing.current = 5; s.storm.evacuationAdvisoryEvent = true; s.storm.peakFloodSeverity = 'severe'; s.storm.peakWindSeverity = 'severe'; });
    runUntil(e, 'EV10', ['DEFER', 'DELAY_EVACUATION']);
    e.resolveEvent('ACCOUNT_MEMBERS');
    runUntil(e, 'EV16', ['DEFER']);
    expect(wb(e).current).toBe(0);
    expect(e.getState().player.wellbeingEvents.map((x) => x.ruleId)).toEqual(['W_ADVISORY_IGNORED_SEVERE_FLOOD', 'W_REMAINED_IN_UNSAFE_ROOM']);
  });

  it('computes the percentage from raw values without rounding', () => {
    expect(wellbeingPercent({ current: 84.99, max: 100 })).toBe(84.99);
    expect(wellbeingPercent({ current: 17, max: 20 })).toBe(85);
  });

  it('rejects an invalid maximum', () => {
    const st = newGame().getState();
    expect(GameState.safeParse({ ...st, player: { ...st.player, wellbeing: { current: 0, max: 0 } } }).success).toBe(false);
    expect(GameState.safeParse({ ...st, player: { ...st.player, wellbeing: { current: 120, max: 100 } } }).success).toBe(false);
    expect(() => wellbeingPercent({ current: 1, max: 0 })).toThrow();
  });

  it('loads saves from before wellbeing existed with full wellbeing', () => {
    const { player: _p, ...old } = newGame().getState() as Record<string, unknown>;
    const r = loadGame(old);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.engine.getState().player.wellbeing).toEqual({ current: 100, max: 100 });
  });
});
