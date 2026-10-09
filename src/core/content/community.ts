// Community assistance (B06 Bayanihan, A08 Whole Barangay): the allowlist of qualifying actions.
// Each entry reuses an ordinary action definition (actions.ts); this file only says which actions count and by
// when they must be finished. Rejected attempts never reach the decision log, so only completed actions qualify.
// The AI never decides qualification.
import type { GameState } from '../../shared/contracts/state';
import * as sel from '../selectors';

export type CommunityCategory = 'verifiedInformation' | 'communityPreparation';

export interface CommunityAssistanceDef {
  actionId: string;
  category: CommunityCategory;
  /** Latest simulated minute by which the action must be finished to stay safe. */
  deadlineMinute: (s: GameState) => number;
  deadlineLabel: string;
}

/** Outdoor community work ends at the advisory (households follow it) or at heavy rain, whichever is first. */
export const communityPreparationDeadline = (s: GameState) => Math.min(sel.heavyRainMinute(s), sel.advisoryMinute(s) ?? Infinity);

export const COMMUNITY_ASSISTANCE: CommunityAssistanceDef[] = [
  { actionId: 'SHARE_VERIFIED_ADVISORY', category: 'verifiedInformation', deadlineMinute: (s) => s.landfallMinute, deadlineLabel: 'before landfall' },
  { actionId: 'HELP_COMMUNITY_PREPARATION', category: 'communityPreparation', deadlineMinute: communityPreparationDeadline,
    deadlineLabel: 'before heavy rain or the evacuation advisory' },
];

export const COMMUNITY_ACTION_IDS: ReadonlySet<string> = new Set(COMMUNITY_ASSISTANCE.map((d) => d.actionId));

/** Deadline of a registered community action (used by its action requirement so the two never disagree). */
export function communityDeadline(actionId: string): (s: GameState) => number {
  const d = COMMUNITY_ASSISTANCE.find((x) => x.actionId === actionId);
  if (!d) throw new Error(`${actionId} is not a community-assistance action`);
  return d.deadlineMinute;
}
