// B01 Handa: the single authoritative evaluation (achievements reference this, never re-implement it).
import type { HandaResult } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import { wellbeingPercent } from '../wellbeing';
import { OBJECTIVES } from './objectives';
import { evaluateHouseholdSafety } from './badges';

/** Inclusive threshold on the raw (unrounded) player wellbeing percentage. */
export const HANDA_WELLBEING_THRESHOLD = 85;

/**
 * Critical competencies (explicit, from existing objectives). Each counts only when applicable to the household
 * and the run; optional objectives and other badges are not required.
 */
export const CRITICAL_OBJECTIVES = ['O_WATER', 'O_GO_BAG', 'O_BULLETIN', 'O_COMMUNICATION', 'O_ACCOUNTED', 'O_DESTINATION', 'O_ADVISORY_RESPONSE',
  'O_MEDICATION', 'O_ASSISTANCE', 'O_HAZARD_RESPONSE', 'O_NO_UNSAFE'] as const;

export function evaluateHanda(s: GameState): HandaResult {
  const pct = wellbeingPercent(s.player.wellbeing); // throws on an invalid maximum
  const criticalCompetencies = CRITICAL_OBJECTIVES.map((id) => {
    const o = OBJECTIVES.find((x) => x.id === id)!;
    const applicable = o.applicable(s);
    return { objectiveId: id, findingId: o.findingId, applicable, met: applicable ? o.met(s) : null };
  });
  const criticalGaps = criticalCompetencies.filter((c) => c.applicable && !c.met).map((c) => c.findingId);
  const safety = evaluateHouseholdSafety(s);
  const evacuationAndAssistanceMet = safety.status !== 'notEarned';
  const reasons: string[] = [];
  if (!s.completed) reasons.push('The typhoon scenario is not complete yet.');
  if (pct < HANDA_WELLBEING_THRESHOLD) reasons.push(`Player wellbeing ${pct}% is below the required ${HANDA_WELLBEING_THRESHOLD}%.`);
  for (const c of criticalCompetencies) if (c.applicable && !c.met) reasons.push(`Critical preparedness not met: ${c.objectiveId}.`);
  if (!evacuationAndAssistanceMet) reasons.push(...safety.reasons.map((r) => `Household safety: ${r}`));
  return {
    earned: s.completed && pct >= HANDA_WELLBEING_THRESHOLD && criticalGaps.length === 0 && evacuationAndAssistanceMet,
    runCompleted: s.completed,
    wellbeingPercent: pct,
    wellbeingThreshold: HANDA_WELLBEING_THRESHOLD,
    wellbeingMet: pct >= HANDA_WELLBEING_THRESHOLD,
    criticalCompetencies: criticalCompetencies.map(({ objectiveId, applicable, met }) => ({ objectiveId, applicable, met })),
    criticalGaps,
    evacuationAndAssistanceMet,
    exposure: s.storm.exposure,
    reasons,
  };
}
