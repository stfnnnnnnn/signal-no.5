import { describe, expect, it } from 'vitest';
import { createGame, type GameEngine } from '../src/core/engine';
import { aloneSurvey, familySurvey } from './fixtures/households';

function ready(s = familySurvey(), seed = 11): GameEngine {
  const r = createGame(s, { seed });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  const e = r.engine;
  const res = e.resolveEvent('CHECK_ADVISORY'); // close EV01
  if (!res.ok) throw new Error(JSON.stringify(res.error));
  return e;
}
const water = (e: GameEngine) => (e.getState().house.WATER ?? 0) + (e.getState().goBag.WATER ?? 0);

describe('action eligibility', () => {
  it('lists the actions for an interactable with availability and reasons', () => {
    const e = ready();
    const list = e.getAvailableActions('KITCHEN_SINK');
    expect(list.map((a) => a.actionId)).toEqual(['FILL_CONTAINERS']);
    expect(list[0]!.available).toBe(true);
    expect(list[0]!.timeCostMinutes).toBe(30);
  });

  it('reports a missing prerequisite with a reason', () => {
    const e = ready();
    const board = e.getAvailableActions('WINDOW').find((a) => a.actionId === 'BOARD_WINDOW')!;
    expect(board.available).toBe(false);
    expect(board.reasons.join(' ')).toMatch(/tools/i);
  });

  it('hides household-specific actions that do not apply', () => {
    const alone = ready(aloneSurvey());
    expect(alone.getAvailableActions().some((a) => a.actionId === 'ARRANGE_ASSISTANCE')).toBe(false);
    expect(ready().getAvailableActions().some((a) => a.actionId === 'ARRANGE_ASSISTANCE')).toBe(true);
  });

  it('blocks free actions while a mandatory event is open', () => {
    const r = createGame(familySurvey(), { seed: 11 });
    if (!r.ok) throw new Error('setup');
    const res = r.engine.executeAction('FILL_CONTAINERS');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('EVENT_PENDING');
  });
});

describe('action execution', () => {
  it('applies deterministic consequences and the fixed time cost', () => {
    const e = ready();
    const before = water(e);
    const t0 = e.getState().clock.gameMinutes;
    const res = e.executeAction('FILL_CONTAINERS');
    expect(res.ok).toBe(true);
    expect(water(e)).toBe(before + 15);
    expect(e.getState().clock.gameMinutes).toBe(t0 + 30);
  });

  it('records a DecisionRecord with before/after snapshots', () => {
    const e = ready();
    const res = e.executeAction('FILL_CONTAINERS');
    if (!res.ok) throw new Error('expected ok');
    const rec = e.getState().decisionLog.at(-1)!;
    expect(rec.actionId).toBe('FILL_CONTAINERS');
    expect(rec.eventId).toBeNull();
    expect(rec.timeCostMinutes).toBe(30);
    expect((rec.stateAfter.house.WATER ?? 0) - (rec.stateBefore.house.WATER ?? 0)).toBe(15);
    expect(res.decision).toEqual(rec);
  });

  it('enforces use limits without corrupting state', () => {
    const e = ready();
    e.executeAction('FILL_CONTAINERS');
    e.executeAction('FILL_CONTAINERS');
    const snapshot = structuredClone(e.getState());
    const res = e.executeAction('FILL_CONTAINERS');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('ACTION_UNAVAILABLE');
    expect(e.getState()).toEqual(snapshot);
  });

  it('rejects unknown actions without changing state', () => {
    const e = ready();
    const snapshot = structuredClone(e.getState());
    const res = e.executeAction('LAUNCH_ROCKET');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN_ACTION');
    expect(e.getState()).toEqual(snapshot);
  });

  it('unlocks dependent actions after their prerequisite', () => {
    const e = ready();
    expect(e.executeAction('BOARD_WINDOW').ok).toBe(false);
    expect(e.executeAction('GET_TOOLS').ok).toBe(true);
    expect(e.executeAction('BOARD_WINDOW').ok).toBe(true);
    expect(e.getState().counters.windowsBoarded).toBe(1);
  });

  it('charges the phone to full', () => {
    const e = ready();
    expect(e.executeAction('CHARGE_PHONE').ok).toBe(true);
    expect(e.getState().phoneBattery).toBe(100);
  });

  it('packs available portable essentials into the go-bag', () => {
    const e = ready();
    expect(e.getGoBagStatus()).not.toBe('ready');
    const res = e.executeAction('PACK_GO_BAG');
    expect(res.ok).toBe(true);
    expect(e.getState().goBag.FLASHLIGHT).toBe(1);
    expect(e.getState().house.FLASHLIGHT ?? 0).toBe(0);
  });

  it('returns the updated state and emitted engine events', () => {
    const e = ready();
    const res = e.executeAction('PROTECT_DOCUMENTS');
    if (!res.ok) throw new Error('expected ok');
    expect(res.state.flags.DOCUMENTS_PROTECTED).toBe(true);
    expect(res.events.some((ev) => ev.type === 'actionCompleted')).toBe(true);
  });
});
