import { beforeEach, describe, expect, it } from 'vitest';
import { EngineStore, TICK_INTERVAL_MS } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import type { EngineEvent } from '../../src/core/engine';

let s: EngineStore;
let events: EngineEvent[];
beforeEach(() => {
  s = new EngineStore(); events = [];
  s.onEvents((e) => events.push(...e));
  const r = s.newGame(sliceHousehold(), SLICE_SEED);
  expect(r.ok).toBe(true);
});

describe('EngineStore', () => {
  it('emits the opening events and exposes a stable active event key', () => {
    expect(events.some((e) => e.type === 'eventTriggered' && e.eventId === 'EV01')).toBe(true);
    expect(s.activeEventKey()).toMatch(/^EV01@\d+$/);
  });

  it('drives createGame → resolveEvent → executeAction headlessly', () => {
    const r = s.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    expect(r.ok).toBe(true);
    expect(s.state!.activeEvent).toBeNull();
    const before = s.state!.house.WATER ?? 0;
    expect(s.dispatch((e) => e.executeAction('FILL_CONTAINERS')).ok).toBe(true);
    expect(s.state!.house.WATER ?? 0).toBeGreaterThan(before);
  });

  it('leaves state unchanged and notifies nobody on a rejected command', () => {
    let notified = 0; s.subscribe(() => notified++);
    const prev = s.state;
    const r = s.dispatch((e) => e.executeAction('SHARE_VERIFIED_ADVISORY'));
    expect(r.ok).toBe(false);
    expect(s.state).toBe(prev);
    expect(notified).toBe(0);
  });

  it('accumulates frame deltas and ticks the engine at most every 100 ms', () => {
    s.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    const m0 = s.state!.clock.gameMinutes;
    s.tick(TICK_INTERVAL_MS / 2);
    expect(s.state!.clock.gameMinutes).toBe(m0);
    for (let i = 0; i < 120; i++) s.tick(1000); // 120 s real at 1× = 30 game minutes
    expect(s.state!.clock.gameMinutes).toBeGreaterThan(m0);
  });

  it('emits badgeEarned B06 exactly once for the Bayanihan slice', () => {
    s.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    events = [];
    expect(s.dispatch((e) => e.executeAction('SHARE_VERIFIED_ADVISORY')).ok).toBe(true); // CHECK_ADVISORY already verified
    expect(s.dispatch((e) => e.executeAction('SHARE_VERIFIED_ADVISORY')).ok).toBe(false); // once per run
    expect(events.filter((e) => e.type === 'badgeEarned')).toEqual([{ type: 'badgeEarned', badgeId: 'B06' }]);
  });
});
