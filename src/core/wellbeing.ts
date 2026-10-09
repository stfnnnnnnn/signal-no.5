// Player wellbeing rules: a fictional gameplay indicator (0–100), never a medical assessment.
// Only clearly defined unsafe decisions are penalised, and only when the engine verifies the conditions AND a
// safer alternative was available. No penalties for being outdoors, outages, lighting or exposure profiles.
import type { GameState, Wellbeing } from '../shared/contracts/state';
import * as sel from './selectors';

export interface WellbeingRule { id: string; delta: number; reason: string; saferAlternative: string }

export const WELLBEING_RULES: WellbeingRule[] = [
  { id: 'W_ADVISORY_IGNORED_SEVERE_FLOOD', delta: -15, reason: 'Stayed home after an applicable evacuation advisory, and the home flooded severely.',
    saferAlternative: 'Following the advisory (Leave for the evacuation destination) was available from the moment it was issued, before the route closed.' },
  { id: 'W_REMAINED_IN_UNSAFE_ROOM', delta: -10, reason: 'Stayed in a room the scenario marked as unsafe.',
    saferAlternative: '"Move everyone to the safest room" was offered in the same event.' },
];
const RULE = Object.fromEntries(WELLBEING_RULES.map((r) => [r.id, r])) as Record<string, WellbeingRule>;

/** Raw percentage, no rounding. Throws on an invalid maximum (the schema also rejects it). */
export function wellbeingPercent(w: Wellbeing): number {
  if (!(w.max > 0)) throw new Error('invalid wellbeing maximum');
  return (w.current / w.max) * 100;
}

function apply(s: GameState, ruleId: string) {
  if (s.player.wellbeingEvents.some((e) => e.ruleId === ruleId)) return; // once per run
  const r = RULE[ruleId]!;
  s.player.wellbeing.current = Math.max(0, s.player.wellbeing.current + r.delta);
  s.player.wellbeingEvents.push({ ruleId, delta: r.delta, atMinute: s.clock.gameMinutes, reason: r.reason });
}

/** At the storm peak (after the authored flood level is set). */
export function checkAtPeak(s: GameState) {
  const advisoryIgnored = s.environment.evacuationAdvisoryIssued && s.evacuation.departedAtMinute === null;
  if (advisoryIgnored && sel.householdLocation(s) === 'home' && s.environment.floodSeverity === 'severe') apply(s, 'W_ADVISORY_IGNORED_SEVERE_FLOOD');
}

/** After the player resolves the shelter-hazard event. */
export function checkShelterResolution(s: GameState, variantId: string, actionId: string, offered: string[]) {
  if (variantId === 'EV10__CRITICAL' && offered.includes('MOVE_TO_SAFER_ROOM') && actionId !== 'MOVE_TO_SAFER_ROOM') apply(s, 'W_REMAINED_IN_UNSAFE_ROOM');
}
