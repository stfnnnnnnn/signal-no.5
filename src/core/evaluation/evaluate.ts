// Deterministic preparedness evaluation (GD §14–15): score, ending, findings, checklist, badges.
import type { DebriefEvaluation } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import { ACTION_BY_ID } from '../content/actions';
import { BADGES, type BadgeContext } from '../content/badges';
import { FINDING_BY_ID } from '../content/findings';
import { CATEGORY_WEIGHTS, OBJECTIVES } from './objectives';

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

  const ctx: BadgeContext = {
    state: s,
    met: (id) => results.get(id) ?? null,
    categoryRatio: (k) => { const c = categories.find((x) => x.category === k)!; return c.included ? c.earned / c.weight : null; },
  };
  const badgeIds = BADGES.filter((b) => b.earned(ctx)).map((b) => b.id);

  return {
    schemaVersion: 2, score, ending, rescueOutcome: s.evacuation.rescueOutcome, categories,
    timeline: s.decisionLog.map((d) => ({ seq: d.seq, atMinute: d.tick, eventId: d.eventId, actionId: d.actionId, label: ACTION_BY_ID.get(d.actionId)?.label ?? d.actionId })),
    strengths, gaps, learningPoints, checklistItems, badgeIds,
  };
}
