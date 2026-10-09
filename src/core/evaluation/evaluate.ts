// Deterministic preparedness evaluation (GD §14 + revised badges): score, ending, findings, checklist,
// badges (B01 Handa via evaluateHanda) and lesson cards. No AI input.
import type { BadgeResult, DebriefEvaluation } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import { ACTION_BY_ID } from '../content/actions';
import { FINDING_BY_ID } from '../content/findings';
import { evaluateBadges } from './badges';
import { evaluateHanda } from './handa';
import { CATEGORY_WEIGHTS, OBJECTIVES } from './objectives';

/** Score-based endings (independent of the Handa badge). */
export const ENDING_THRESHOLDS = { handa: 85, nakaraos: 60 } as const;

export function evaluateRun(s: GameState): DebriefEvaluation {
  const results = new Map<string, boolean | null>();
  for (const o of OBJECTIVES) results.set(o.id, o.applicable(s) ? o.met(s) : null);

  const categories = CATEGORY_WEIGHTS.map(([category, weight]) => {
    const objectives = OBJECTIVES.filter((o) => o.category === category && results.get(o.id) !== null).map((o) => ({ id: o.id, met: results.get(o.id) === true }));
    const included = objectives.length > 0;
    const earned = included ? (weight * objectives.filter((o) => o.met).length) / objectives.length : 0;
    return { category, weight, earned: Math.round(earned * 100) / 100, included, objectives };
  });
  // Non-applicable categories are excluded and the remaining weights renormalised to 100.
  const totalWeight = categories.filter((c) => c.included).reduce((n, c) => n + c.weight, 0);
  const totalEarned = categories.reduce((n, c) => n + c.earned, 0);
  const score = totalWeight ? Math.round((100 * totalEarned) / totalWeight) : 0;
  const ending = score >= ENDING_THRESHOLDS.handa ? 'handa' : score >= ENDING_THRESHOLDS.nakaraos ? 'nakaraos' : 'nahirapan';

  const strengths: string[] = [];
  const gaps: string[] = [];
  for (const o of OBJECTIVES) {
    const r = results.get(o.id);
    if (r === true) strengths.push(o.findingId); else if (r === false) gaps.push(o.findingId);
  }
  if (s.flags.BOUGHT_AFTER_PRICE_INCREASE) gaps.push('F_LATE_PURCHASE');
  const learningPoints = gaps.map((id) => { const d = FINDING_BY_ID.get(id)!; return { findingId: id, safetyRuleId: d.safetyRuleId, text: d.lesson }; });
  const checklistItems = gaps.map((id) => ({ id: `C_${id.slice(2)}`, text: FINDING_BY_ID.get(id)!.checklist }));

  const handa = evaluateHanda(s);
  const b01: BadgeResult = !s.completed ? { id: 'B01', status: 'eligible', reasons: [] } : { id: 'B01', status: handa.earned ? 'earned' : 'notEarned', reasons: handa.reasons };
  const badges = [b01, ...evaluateBadges(s)];

  return {
    schemaVersion: 2, score, ending, rescueOutcome: s.evacuation.rescueOutcome, categories,
    timeline: s.decisionLog.map((d) => ({ seq: d.seq, atMinute: d.tick, eventId: d.eventId, actionId: d.actionId, label: ACTION_BY_ID.get(d.actionId)?.label ?? d.actionId })),
    strengths, gaps, learningPoints, checklistItems,
    badgeIds: badges.filter((b) => b.status === 'earned').map((b) => b.id),
    badges, handa,
    lessonIds: [...strengths, ...gaps].filter((id, i, a) => a.indexOf(id) === i),
  };
}
