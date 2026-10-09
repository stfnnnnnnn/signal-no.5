import { describe, expect, it } from 'vitest';
import { createGame, loadGame, REAL_MS_PER_GAME_HOUR } from '../src/core/engine';
import { TIME_SCALES } from '../src/shared/contracts/ids';
import { aloneSurvey, familySurvey } from './fixtures/households';
import { minutes, newGame, playToEnd, resolveFirst } from './helpers';

const H = 60;

describe('hybrid clock', () => {
  it('advances one game hour per 240 real seconds at 1×', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.tick(REAL_MS_PER_GAME_HOUR);
    expect(minutes(e)).toBe(60);
  });

  it.each(TIME_SCALES)('scales ambient time at %i×', (scale) => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.setSpeed(scale);
    e.tick(60_000); // one real minute
    expect(minutes(e)).toBeCloseTo(15 * scale, 6);
  });

  it('rejects unsupported speeds', () => {
    const e = newGame();
    const r = e.setSpeed(3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_SPEED');
  });

  it('charges fixed action costs exactly, regardless of speed', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.setSpeed(32);
    e.executeAction('RAISE_BELONGINGS');
    expect(minutes(e)).toBe(120);
  });

  it('does not advance while paused, and resumes afterwards', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.pause('menu');
    e.tick(REAL_MS_PER_GAME_HOUR);
    expect(minutes(e)).toBe(0);
    e.resume('menu');
    e.tick(REAL_MS_PER_GAME_HOUR);
    expect(minutes(e)).toBe(60);
  });

  it('does not advance while the AI is loading (frontend pauses with "loading")', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.pause('loading');
    e.setSpeed(32);
    e.tick(10 * 60_000);
    expect(minutes(e)).toBe(0);
  });

  it('does not advance while an event is open', () => {
    const e = newGame();
    e.tick(REAL_MS_PER_GAME_HOUR);
    expect(minutes(e)).toBe(0);
    expect(e.resume('decision').ok).toBe(false);
  });
});

describe('milestones and scheduling', () => {
  it('stops exactly at a mandatory milestone even at 32× and pauses for it', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.setSpeed(32);
    e.tick(10 * 60_000); // would be 80 game hours
    expect(minutes(e)).toBe(8 * H);
    expect(e.getState().activeEvent?.eventId).toBe('EV02');
    e.tick(60_000);
    expect(minutes(e)).toBe(8 * H);
  });

  it('processes several due milestones one at a time in chronological order', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.setSpeed(32);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      e.tick(30 * 60_000);
      const ev = e.getState().activeEvent!;
      seen.push(`${ev.eventId}@${ev.triggeredAtMinute / H}`);
      resolveFirst(e, ['DEFER']);
    }
    expect(seen).toEqual(['EV02@8', 'EV03@12', 'EV04@16', 'EV05@20']);
  });

  it('processes a milestone crossed during a long action after the action completes', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    e.tick((7.5 * REAL_MS_PER_GAME_HOUR)); // 07:30
    expect(minutes(e)).toBe(7.5 * H);
    const r = e.executeAction('RAISE_BELONGINGS'); // 2 h → 09:30
    expect(r.ok).toBe(true);
    expect(minutes(e)).toBe(9.5 * H);
    expect(e.getState().activeEvent?.eventId).toBe('EV02');
    if (r.ok) expect(r.events.map((x) => x.type)).toEqual(['actionCompleted', 'milestone', 'eventTriggered']);
  });

  it('skips an event that is no longer eligible when its milestone fires', () => {
    const e = newGame(aloneSurvey()); // alone: EV03 (household coordination) never applies
    playToEnd(e, ['DEFER']);
    expect(e.getState().eventHistory.some((h) => h.eventId === 'EV03')).toBe(false);
  });

  it('never skips mandatory events across a whole run at 32×', () => {
    const e = newGame();
    const st = playToEnd(e, ['DEFER']);
    const fired = st.eventHistory.map((h) => h.eventId);
    for (const id of ['EV01', 'EV04', 'EV06', 'EV12', 'EV13', 'EV14', 'EV15', 'EV16']) expect(fired).toContain(id);
    const times = st.eventHistory.map((h) => h.atMinute);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(st.completed).toBe(true);
  });

  it('stops ambient time at landfall (critical) and resets the speed to 1×', () => {
    const e = newGame(aloneSurvey());
    e.resolveEvent('DEFER');
    for (let i = 0; i < 500 && !e.getState().firedMilestones.includes('LANDFALL'); i++) {
      if (e.getState().activeEvent) { resolveFirst(e, ['DEFER']); continue; }
      e.setSpeed(32);
      e.tick(10 * 60_000); // 80 game hours per tick: would overshoot landfall without the stop
    }
    const st = e.getState();
    expect(st.clock.gameMinutes).toBe(st.landfallMinute);
    expect(st.clock.timeScale).toBe(1);
    expect(st.phase).toBe('impact');
  });

  it('moves landfall-relative milestones earlier when landfall accelerates', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const r = createGame(familySurvey(), { seed });
      if (!r.ok) continue;
      const st = r.engine.getState();
      if (st.storm.landfallAccelerationHours !== 8) continue;
      found = true;
      expect(st.landfallMinute).toBe(40 * H);
      const done = playToEnd(r.engine, ['DEFER']);
      const landfallAt = done.eventHistory.find((h) => h.eventId === 'EV10' || h.eventId === 'EV11')?.atMinute ?? Infinity;
      expect(landfallAt).toBeGreaterThanOrEqual(40 * H);
      expect(landfallAt).toBeLessThanOrEqual(43 * H);
      if (done.storm.evacuationAdvisoryEvent) expect(done.eventHistory.find((h) => h.eventId === 'EV08')!.atMinute).toBe(32 * H);
    }
    expect(found).toBe(true);
  });

  it('moves to the warning phase at hour 24 and to impact at landfall', () => {
    const e = newGame();
    const phases = new Set<string>();
    for (let i = 0; i < 3000 && !e.getState().completed; i++) {
      const s = e.getState();
      phases.add(s.phase);
      if (s.activeEvent) { resolveFirst(e, ['DEFER']); continue; }
      if (['impact', 'aftermath', 'evacuation'].includes(s.phase)) { e.skipToNextMilestone(); continue; }
      e.setSpeed(32); e.tick(60_000);
    }
    expect([...phases]).toEqual(expect.arrayContaining(['preparation', 'warning', 'impact', 'aftermath']));
  });
});

describe('save and load', () => {
  it('restores the clock and continues identically after a JSON round-trip', () => {
    const a = newGame(); a.resolveEvent('DEFER');
    a.setSpeed(4); a.tick(5 * 60_000);
    const saved = JSON.parse(JSON.stringify(a.getState()));
    const loaded = loadGame(saved);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    const b = loaded.engine;
    expect(b.getState().clock).toEqual(a.getState().clock);
    a.tick(60_000); b.tick(60_000);
    expect(b.getState()).toEqual(a.getState());
  });

  it('rejects corrupted save data', () => {
    const r = loadGame({ schemaVersion: 2, phase: 'nonsense' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_SAVE');
  });
});
