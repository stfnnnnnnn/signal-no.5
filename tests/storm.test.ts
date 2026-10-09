import { describe, expect, it } from 'vitest';
import { createGame, loadGame, type GameEngine } from '../src/core/engine';
import type { EventId } from '../src/shared/contracts/ids';
import type { GameState } from '../src/shared/contracts/state';
import type { SurveyResponses } from '../src/shared/contracts/survey';
import { aloneSurvey, familySurvey } from './fixtures/households';
import { newGame, playToEnd, resolveFirst } from './helpers';

const H = 60;

/** Advance (auto-resolving other events with `prefer`) until `eventId` is the active event. */
function runUntil(e: GameEngine, eventId: EventId, prefer: string[] = ['DEFER']): boolean {
  for (let i = 0; i < 5000; i++) {
    const s = e.getState();
    if (s.completed) return false;
    if (s.activeEvent?.eventId === eventId) return true;
    if (s.activeEvent) { resolveFirst(e, prefer); continue; }
    if (['impact', 'aftermath', 'evacuation'].includes(s.phase)) { e.skipToNextMilestone(); continue; }
    e.setSpeed(32); e.tick(60_000);
  }
  return false;
}

function seedWith(s: SurveyResponses, pred: (st: GameState) => boolean): GameEngine {
  for (let seed = 1; seed < 200; seed++) {
    const r = createGame(s, { seed });
    if (r.ok && pred(r.engine.getState())) return r.engine;
  }
  throw new Error('no seed matches');
}

/** Rebuild an engine from a modified copy of its state (test-only scenario setup). */
function withState(e: GameEngine, patch: (s: GameState) => void): GameEngine {
  const s = e.getState(); patch(s);
  const r = loadGame(s);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.engine;
}

describe('engine-selected variants', () => {
  it('selects the medication gap for a household that needs essential medication but has none', () => {
    const e = newGame(familySurvey());
    expect(runUntil(e, 'EV04')).toBe(true);
    expect(e.getState().activeEvent!.variantId).toBe('EV04__MEDICATION_SUPPLY_GAP');
  });

  it('selects backup-ready vs lighting-gap for the power interruption', () => {
    const lit = seedWith(aloneSurvey(), (s) => s.storm.powerOutageEvent);
    expect(runUntil(lit, 'EV09')).toBe(true);
    expect(lit.getState().activeEvent!.variantId).toBe('EV09__BACKUP_READY');
    const dark = aloneSurvey(); dark.q19Supplies = ['water', 'food']; dark.q24BackupPower = ['none'];
    const d = seedWith(dark, (s) => s.storm.powerOutageEvent);
    expect(runUntil(d, 'EV09')).toBe(true);
    expect(d.getState().activeEvent!.variantId).toBe('EV09__LIGHTING_GAP');
    expect(d.getState().activeEvent!.actionIds).not.toContain('USE_FLASHLIGHT');
  });

  it('gives the same evacuation advisory different variants and choices for contrasting households', () => {
    const fam = seedWith(familySurvey(), (s) => s.storm.evacuationAdvisoryEvent);
    const alone = seedWith(aloneSurvey(), (s) => s.storm.evacuationAdvisoryEvent);
    expect(runUntil(fam, 'EV08')).toBe(true);
    expect(runUntil(alone, 'EV08')).toBe(true);
    const f = fam.getState().activeEvent!; const a = alone.getState().activeEvent!;
    expect(f.variantId).toBe('EV08__ASSISTANCE_UNPLANNED');
    expect(a.variantId).toBe('EV08__DEFAULT');
    expect(f.actionIds).toContain('SEEK_ASSISTANCE');
    expect(a.actionIds).not.toContain('SEEK_ASSISTANCE');
  });
});

describe('evacuation branching', () => {
  it('blocks departure until assistance is arranged for a household that needs it', () => {
    const e = seedWith(familySurvey(), (s) => s.storm.evacuationAdvisoryEvent);
    runUntil(e, 'EV08');
    const follow = e.getEventChoices().find((c) => c.actionId === 'FOLLOW_EVACUATION')!;
    expect(follow.available).toBe(false);
    expect(follow.reasons.join(' ')).toMatch(/assistance/i);
  });

  it('completes an evacuation: departure, travel time, arrival event, shelter at the center', () => {
    const e = seedWith(familySurvey(), (s) => s.storm.evacuationAdvisoryEvent);
    runUntil(e, 'EV08');
    expect(e.resolveEvent('SEEK_ASSISTANCE').ok).toBe(true); // arranges help, destination becomes known
    if (e.getState().activeEvent) resolveFirst(e, ['DEFER']);
    const depart = e.executeAction('FOLLOW_EVACUATION');
    expect(depart.ok).toBe(true);
    const st = e.getState();
    expect(st.phase).toBe('evacuation');
    expect(st.evacuation.arrivalAtMinute! - st.evacuation.departedAtMinute!).toBe(3 * H); // 2 h + 1 h assistance
    expect(runUntil(e, 'EV11')).toBe(true);
    const at = e.getState();
    expect(at.evacuation.currentShelter).toBe('evacuationCenter');
    expect(at.scene).toBe('EVACUATION');
    const done = playToEnd(e, ['ACCOUNT_MEMBERS', 'DEFER']);
    expect(done.eventHistory.some((h) => h.eventId === 'EV10')).toBe(false); // home-only hazard
  });

  it('adds travel time when the destination is unknown', () => {
    const e = seedWith(aloneSurvey(), (s) => s.storm.evacuationAdvisoryEvent);
    const unknown = withState(e, (s) => { s.evacuation.destinationKnown = false; s.flags.EVACUATION_CENTER_KNOWN = false; });
    runUntil(unknown, 'EV08');
    expect(unknown.resolveEvent('FOLLOW_EVACUATION').ok).toBe(true);
    const st = unknown.getState();
    expect(st.evacuation.arrivalAtMinute! - st.evacuation.departedAtMinute!).toBe(3.5 * H);
  });

  it('does not allow departure after the route has closed', () => {
    const e = seedWith(aloneSurvey(), (s) => s.storm.evacuationAdvisoryEvent && s.storm.roadClosureEvent);
    runUntil(e, 'EV08');
    e.resolveEvent('DELAY_EVACUATION');
    for (let i = 0; i < 400 && e.getState().environment.roadStatus !== 'closed'; i++) {
      if (e.getState().activeEvent) { resolveFirst(e, ['DEFER', 'DELAY_EVACUATION']); continue; }
      e.setSpeed(32); e.tick(1_000);
    }
    if (e.getState().activeEvent) resolveFirst(e, ['DEFER']);
    const r = e.executeAction('FOLLOW_EVACUATION');
    expect(r.ok).toBe(false);
  });

  it('shelters at home and faces the hazard event when no advisory is issued', () => {
    const e = seedWith(aloneSurvey(), (s) => !s.storm.evacuationAdvisoryEvent);
    expect(runUntil(e, 'EV10')).toBe(true);
    expect(e.getState().scene).toBe('HOME_IMPACT');
    expect(e.getState().evacuation.currentShelter).toBe('home');
  });
});

describe('impact and aftermath', () => {
  it('halves stored water and food when a single-floor home floods without raised storage', () => {
    const base = seedWith(familySurvey(), () => true);
    const e = withState(base, (s) => { s.storm.peakFloodSeverity = 'severe'; s.storm.evacuationAdvisoryEvent = false; s.house.WATER = 40; s.house.FOOD = 10; });
    runUntil(e, 'EV13', ['DEFER']);
    const st = e.getState();
    expect(st.environment.suppliesLost).toBe(true);
    expect(st.house.WATER).toBe(20);
    expect(st.house.FOOD).toBe(5);
  });

  it('keeps stored supplies when belongings were raised', () => {
    const base = seedWith(familySurvey(), () => true);
    const e = withState(base, (s) => { s.storm.peakFloodSeverity = 'severe'; s.storm.evacuationAdvisoryEvent = false; s.house.WATER = 40; s.flags.SUPPLIES_STORED_SAFELY = true; s.flags.BELONGINGS_RAISED = true; });
    runUntil(e, 'EV13', ['DEFER']);
    expect(e.getState().environment.suppliesLost).toBe(false);
    expect(e.getState().house.WATER).toBe(40);
  });

  it('records an unsafe choice without rewarding it', () => {
    const e = seedWith(aloneSurvey(), (s) => !s.storm.evacuationAdvisoryEvent);
    runUntil(e, 'EV10');
    expect(e.getEventChoices().find((c) => c.actionId === 'GO_OUTSIDE_TO_CHECK')!.unsafe).toBe(true);
    e.resolveEvent('GO_OUTSIDE_TO_CHECK');
    expect(e.getState().flags.UNSAFE_ACTION_ATTEMPTED).toBe(true);
  });

  it('marks the authored rescue outcome when an unsafe shelter seeks help', () => {
    const base = seedWith(familySurvey(), () => true);
    const e = withState(base, (s) => { s.storm.peakFloodSeverity = 'severe'; s.storm.peakWindSeverity = 'severe'; s.storm.evacuationAdvisoryEvent = false; });
    runUntil(e, 'EV10');
    expect(e.getState().environment.shelterCondition).toBe('unsafe');
    expect(e.getState().activeEvent!.variantId).toBe('EV10__CRITICAL');
    e.resolveEvent('SEEK_HELP');
    expect(e.getState().evacuation.rescueOutcome).toBe(true);
  });

  it('runs a three-day aftermath and ends in the debrief', () => {
    const e = newGame();
    const st = playToEnd(e, ['DEFER']);
    const order = st.eventHistory.map((h) => h.eventId).filter((id) => ['EV13', 'EV14', 'EV15', 'EV16'].includes(id));
    expect(order).toEqual(['EV13', 'EV14', 'EV15', 'EV16']);
    expect(st.aftermathDay).toBe(3);
    expect(st.phase).toBe('debrief');
    expect(st.scene).toBe('RESULTS');
    expect(st.completed).toBe(true);
  });

  it('rejects commands after the run is complete', () => {
    const e = newGame();
    playToEnd(e, ['DEFER']);
    const r = e.executeAction('INSPECT_SUPPLIES');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('GAME_OVER');
  });
});
