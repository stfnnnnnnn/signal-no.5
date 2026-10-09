// What the HUD shows, derived only from engine state (no rules computed here).
import type { GameState } from '../../../shared/contracts/state';

/** Blueprint §7: after landfall/departure, a Continue button skips to the next milestone when nothing is waiting. */
export const canContinue = (s: GameState) => !s.completed && !s.activeEvent && ['evacuation', 'impact', 'aftermath'].includes(s.phase);
