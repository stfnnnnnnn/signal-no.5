// Bookkeeping when a run completes: persist the run's badges, record it for achievements (the main process
// re-evaluates), announce each newly unlocked achievement once, and drop the autosave of the finished run.
import type { DebriefEvaluation } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import { ui } from '../state/uiStore';
import { achievementToasts } from '../ui/achievements/progressView';
import { AUTO_SLOT } from './autosave';
import { recordRunOnce, removeSave } from './persistence';

const announced = new Set<string>();

export async function finishRun(state: GameState, ev: DebriefEvaluation): Promise<void> {
  const r = await recordRunOnce(state, ev.badgeIds);
  if (announced.has(state.runId)) return;
  announced.add(state.runId);
  await removeSave(AUTO_SLOT);
  if (r) for (const t of achievementToasts(r.newlyUnlocked, r.achievements)) ui.toast(t);
}
