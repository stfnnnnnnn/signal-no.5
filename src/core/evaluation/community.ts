// Community-assistance evaluation (authoritative input to B06 Bayanihan and the A08 run summary).
// Qualifying = a COMPLETED decision (rejected commands never reach the decision log) for an allowlisted action,
// finished by that action's safety deadline. Merely reading an advisory, forwarding a rumour or visiting the
// barangay hall are not on the allowlist and never qualify.
import type { DecisionRecord, GameState } from '../../shared/contracts/state';
import { ACTION_BY_ID } from '../content/actions';
import { COMMUNITY_ASSISTANCE, type CommunityAssistanceDef } from '../content/community';

export interface CommunityAssistanceResult {
  /** At least one allowlisted action exists for this household (otherwise B06 is not applicable). */
  opportunity: boolean;
  /** The first qualifying completed decision, if any. */
  qualifying: DecisionRecord | null;
  actionId: string | null;
}

export function evaluateCommunityAssistance(s: GameState, registry: readonly CommunityAssistanceDef[] = COMMUNITY_ASSISTANCE): CommunityAssistanceResult {
  const c = { s, p: s.household };
  const offered = registry.filter((d) => {
    const def = ACTION_BY_ID.get(d.actionId);
    return def !== undefined && (!def.applicable || def.applicable(c));
  });
  const qualifying = s.decisionLog.find((r) => {
    const d = offered.find((x) => x.actionId === r.actionId);
    return d !== undefined && r.tick + r.timeCostMinutes <= d.deadlineMinute(s);
  }) ?? null;
  return { opportunity: offered.length > 0, qualifying: qualifying ? structuredClone(qualifying) : null, actionId: qualifying?.actionId ?? null };
}
