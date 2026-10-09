// The renderer's door to local files (window.signal save/badges/achievements/profile). Never throws: a missing bridge
// or a failed call degrades to "nothing saved" so the game keeps running.
import type { AchievementStatus } from '../../shared/contracts/progress';
import type { GameState } from '../../shared/contracts/state';

const bridge = () => (typeof window !== 'undefined' ? window.signal : undefined);

export async function listSaves(): Promise<string[]> {
  try { return (await bridge()?.save.list()) ?? []; } catch { return []; }
}
export async function readSave(slot: string): Promise<GameState | null> {
  try { return (await bridge()?.save.read(slot)) ?? null; } catch { return null; }
}
/** Resolves true when written. */
export async function writeSave(slot: string, state: GameState): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  try { await b.save.write(slot, state); return true; } catch { return false; }
}
export async function removeSave(slot: string): Promise<void> {
  try { await bridge()?.save.remove(slot); } catch { /* nothing to remove */ }
}

export async function readEarnedBadges(): Promise<string[]> {
  try { return (await bridge()?.badges.read()) ?? []; } catch { return []; }
}
export async function readAchievements(): Promise<AchievementStatus[]> {
  try { return (await bridge()?.achievements.read()) ?? []; } catch { return []; }
}

// Run-end bookkeeping happens once per run, however often the debrief renders.
const recorded = new Map<string, Promise<{ achievements: AchievementStatus[]; newlyUnlocked: string[] } | null>>();
const planViewed = new Set<string>();

/** Persist the run's earned badges and record the completed run for achievements (main re-evaluates it). */
export function recordRunOnce(state: GameState, badgeIds: string[]) {
  let p = recorded.get(state.runId);
  if (!p) {
    const b = bridge();
    p = b ? (async () => {
      try { await b.badges.add(badgeIds); } catch { /* badges stay in this run's debrief */ }
      try { return await b.achievements.recordRun(state); } catch { return null; }
    })() : Promise.resolve(null);
    recorded.set(state.runId, p);
  }
  return p;
}

export async function markPlanViewedOnce(runId: string): Promise<AchievementStatus[] | null> {
  if (planViewed.has(runId)) return null;
  planViewed.add(runId);
  try { return (await bridge()?.achievements.markPlanViewed(runId)) ?? null; } catch { return null; }
}

/** Tests only. */
export function resetPersistenceMemo() { recorded.clear(); planViewed.clear(); }
