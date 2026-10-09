// Evacuation timing and location consistency (fixes a household arriving after landfall being treated as home).
import { describe, expect, it } from 'vitest';
import { createGame, type GameEngine } from '../src/core/engine';
import { buildScenarioRequest } from '../src/core/ai/scenario';
import { mergeSceneSuggestion } from '../src/core/scene/directive';
import * as sel from '../src/core/selectors';
import { SceneAISuggestion } from '../src/shared/contracts/scene';
import type { CustomOnboarding } from '../src/shared/contracts/onboarding';
import { advanceTo, resolveFirst } from './helpers';

const H = 60;
const solo = (): CustomOnboarding => ({
  schemaVersion: 1, mode: 'custom', q1Housing: 'singleStory', q2SizeRange: '1',
  q3AgeCounts: { age0to4: 0, age5to12: 0, age13to17: 0, age18to35: 1, age36to59: 0, age60plus: 0 },
  q4Assistance: 'no', q5MedicalSupplies: 'no', q6Surroundings: ['neither'], q7Pets: 'no', q8Preparedness: 'full',
  customization: { appearance: 'auto', minimumBudgetChallenge: false },
});
function game(seed: number): GameEngine {
  const r = createGame(solo(), { seed });
  if (!r.ok) throw new Error(r.error.message);
  return r.engine;
}
// Seed 5: landfall h48, advisory h40, no road-closure event → route closes at the peak (h51).
// Seed 2: landfall h44, advisory h36, road-closure event → route closes at h42.
const OPEN_ROUTE = 5;
const CLOSING_ROUTE = 2;

/** No contradictory location may persist: checked after every step. */
function assertConsistent(e: GameEngine) {
  const s = e.getState();
  const where = sel.householdLocation(s);
  if (s.scene === 'HOME_IMPACT') expect(where).toBe('home');
  if (where === 'inTransit') expect(['STREET']).toContain(s.scene);
  if (where !== 'home') expect(s.activeEvent?.eventId).not.toBe('EV10');
  expect(e.getSceneDirective().sceneId).toBe(s.scene);
}
function skipThrough(e: GameEngine, untilMinute: number) {
  for (let i = 0; i < 50 && e.getState().clock.gameMinutes < untilMinute && !e.getState().completed; i++) {
    if (e.getState().activeEvent) resolveFirst(e, ['ACCOUNT_MEMBERS', 'MOVE_TO_SAFER_ROOM', 'CHECK_HOUSEHOLD_NEEDS', 'DEFER']);
    else e.skipToNextMilestone();
    assertConsistent(e);
  }
}

describe('evacuation timing', () => {
  it('departure well before landfall: arrives first, then sits out landfall at the center', () => {
    const e = game(OPEN_ROUTE);
    const L = e.getState().landfallMinute;
    advanceTo(e, L - 7 * H);
    expect(e.executeAction('FOLLOW_EVACUATION').ok).toBe(true);
    expect(sel.householdLocation(e.getState())).toBe('inTransit');
    skipThrough(e, L + 4 * H);
    const s = e.getState();
    expect(s.evacuation.arrivalAtMinute!).toBeLessThan(L);
    expect(sel.householdLocation(s)).toBe('evacuationCenter');
    expect(s.eventHistory.some((h) => h.eventId === 'EV10')).toBe(false);
  });

  it('departure close to landfall on a route that stays open: travels through landfall, never treated as home', () => {
    const e = game(OPEN_ROUTE);
    const L = e.getState().landfallMinute;
    advanceTo(e, L - H);
    const depart = e.executeAction('FOLLOW_EVACUATION');
    expect(depart.ok).toBe(true);
    const arrival = e.getState().evacuation.arrivalAtMinute!;
    expect(arrival).toBeGreaterThan(L);                       // arrives after landfall…
    expect(arrival).toBeLessThanOrEqual(sel.routeClosureMinute(e.getState())); // …but before the route closes

    e.skipToNextMilestone();                                  // LANDFALL
    let s = e.getState();
    expect(s.firedMilestones).toContain('LANDFALL');
    expect(s.phase).toBe('impact');
    expect(sel.householdLocation(s)).toBe('inTransit');
    expect(s.scene).toBe('STREET');                           // was HOME_IMPACT before the fix
    expect(s.environment.roadStatus).toBe('restricted');     // landfall alone does not close the route
    expect(e.getSceneDirective().sceneId).toBe('STREET');
    assertConsistent(e);

    skipThrough(e, L + 7 * H);
    s = e.getState();
    expect(s.evacuation.completed).toBe(true);
    expect(sel.householdLocation(s)).toBe('evacuationCenter');
    expect(s.eventHistory.some((h) => h.eventId === 'EV10')).toBe(false);  // no home hazard for a household that left
    expect(s.eventHistory.some((h) => h.eventId === 'EV11')).toBe(true);
    expect(s.environment.shelterCondition).toBe('normal');
    expect(s.player.wellbeingEvents).toEqual([]);
    expect(s.environment.roadStatus).toBe('closed');         // the route closes at the peak
  });

  it('rejects a departure that could not arrive before the route closes, and changes nothing', () => {
    const e = game(CLOSING_ROUTE);
    const L = e.getState().landfallMinute;
    expect(sel.routeClosureMinute(e.getState())).toBe(L - 2 * H);
    advanceTo(e, L - 3 * H);                                  // road not closed yet, but a 2 h trip would end after closure
    const before = e.getState();
    expect(before.environment.roadStatus).not.toBe('closed');
    const r = e.executeAction('FOLLOW_EVACUATION');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reasons?.join(' ')).toMatch(/Too late to travel safely/);
    expect(e.getState()).toEqual(before);
    expect(sel.householdLocation(e.getState())).toBe('home');
  });

  it('allows the same route earlier, when the whole trip fits before closure', () => {
    const e = game(CLOSING_ROUTE);
    const L = e.getState().landfallMinute;
    advanceTo(e, L - 5 * H);
    expect(e.executeAction('FOLLOW_EVACUATION').ok).toBe(true);
    expect(e.getState().evacuation.arrivalAtMinute!).toBeLessThanOrEqual(L - 2 * H);
  });

  it('a household that stayed home still faces home hazards (unchanged behaviour)', () => {
    const e = game(OPEN_ROUTE);
    const L = e.getState().landfallMinute;
    advanceTo(e, L);
    expect(e.getState().scene).toBe('HOME_IMPACT');
    skipThrough(e, L + 3 * H + 1);
    expect(e.getState().eventHistory.some((h) => h.eventId === 'EV10')).toBe(true);
  });

  it('AI cannot override location: scene suggestions cannot set the scene, and narration gets the in-transit fact', () => {
    const e = game(OPEN_ROUTE);
    const L = e.getState().landfallMinute;
    advanceTo(e, L - H);
    e.executeAction('FOLLOW_EVACUATION');
    e.skipToNextMilestone();
    const s = e.getState();
    expect(SceneAISuggestion.safeParse({ basisKey: 'x', sceneId: 'HOME_IMPACT' }).success).toBe(false);
    const base = e.getSceneDirective();
    expect(mergeSceneSuggestion(s, base, { basisKey: base.basisKey, extraEffects: [], decor: [], npcCues: [] }).sceneId).toBe('STREET');

    const withEvent = structuredClone(s);
    withEvent.activeEvent = { eventId: 'EV09', variantId: 'EV09__LIGHTING_GAP', triggeredAtMinute: s.clock.gameMinutes, mandatory: true, actionIds: ['CHECK_HOUSEHOLD_NEEDS', 'DEFER'] };
    expect(buildScenarioRequest(withEvent)!.facts).toContain('The household has left home and is travelling to the evacuation destination.');
    const atHome = structuredClone(game(OPEN_ROUTE).getState());
    atHome.activeEvent = withEvent.activeEvent;
    expect(buildScenarioRequest(atHome)!.facts.join(' ')).not.toMatch(/travelling/);
  });
});
