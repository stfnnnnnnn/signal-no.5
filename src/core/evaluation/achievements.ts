// Cross-run achievements: pure functions over completed-run summaries. Handa-dependent achievements read the
// stored result of evaluateHanda (handaEarned) and never re-implement Handa's rules.
import type { DebriefEvaluation } from '../../shared/contracts/debrief';
import { ACHIEVEMENT_IDS, type AchievementId, type AchievementStatus, type ProgressFile, type RunSummary } from '../../shared/contracts/progress';
import type { GameState } from '../../shared/contracts/state';
import { ACHIEVEMENT_CATALOG } from '../content/achievements';
import { evaluateCommunityAssistance } from './community';
import { OBJECTIVES } from './objectives';

/** Lesson cards = one per objective finding (the late-purchase lesson needs a mistake, so it is not required). */
export const LESSON_IDS = [...new Set(OBJECTIVES.map((o) => o.findingId))];
export const TOTAL_LESSONS = LESSON_IDS.length;

export function summarizeRun(s: GameState, ev: DebriefEvaluation, completedAt: string): RunSummary {
  if (!s.completed) throw new Error('Run is not complete; abandoned runs are not recorded.');
  return {
    runId: s.runId, stormSeed: s.storm.stormSeed, configMode: s.household.configMode, exposure: s.storm.exposure, budgetTier: s.household.budgetTier,
    completedAt, score: ev.score, handaEarned: ev.handa.earned, wellbeingPercent: ev.handa.wellbeingPercent, badgeIds: ev.badgeIds,
    lessonIds: ev.lessonIds.filter((id) => LESSON_IDS.includes(id)),
    rumorOpportunity: s.eventHistory.some((h) => h.eventId === 'EV07'), rumorForwarded: s.flags.RUMOR_FORWARDED === true,
    // A08 consumes the authoritative B06 result; the action ID comes from the same community evaluation.
    communityHelpCompleted: ev.badges.some((b) => b.id === 'B06' && b.status === 'earned'),
    communityHelpActionId: evaluateCommunityAssistance(s).actionId,
  };
}

function progressOf(p: ProgressFile): Record<AchievementId, [number, number]> {
  const runs = [...p.runs].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const improved = runs.some((r, j) => runs.slice(0, j).some((e) => r.score > e.score));
  const lessons = new Set(runs.flatMap((r) => r.lessonIds));
  const count = (pred: (r: RunSummary) => boolean) => runs.filter(pred).length;
  const recorded = new Set(runs.map((r) => r.runId));
  return {
    A01: [Math.min(1, runs.length), 1],
    A02: [improved ? 1 : 0, 1],
    A03: [lessons.size, TOTAL_LESSONS],
    A04: [Math.min(1, count((r) => r.handaEarned && r.exposure === 'both')), 1],
    A05: [Math.min(1, count((r) => r.handaEarned && r.budgetTier === 'limited')), 1],
    A06: [new Set(runs.map((r) => r.stormSeed)).size, 5],
    A07: [count((r) => r.rumorOpportunity && !r.rumorForwarded), 5],
    A08: [count((r) => r.communityHelpCompleted), 5],
    A09: [Math.min(1, count((r) => r.configMode === 'custom')), 1],
    A10: [Math.min(1, p.plansViewed.filter((id) => recorded.has(id)).length), 1],
  };
}

export function computeAchievements(p: ProgressFile): AchievementStatus[] {
  const prog = progressOf(p);
  return ACHIEVEMENT_CATALOG.map((m) => {
    const [progress, target] = prog[m.id];
    const unlockedAt = p.unlocked[m.id] ?? null;
    return { ...m, progress: Math.min(progress, target), target, unlocked: unlockedAt !== null || progress >= target, unlockedAt };
  });
}

/** Stamp newly reached achievements once; earlier timestamps are never changed. */
function stamp(p: ProgressFile, now: string): { progress: ProgressFile; newlyUnlocked: AchievementId[] } {
  const prog = progressOf(p);
  const unlocked = { ...p.unlocked };
  const newlyUnlocked: AchievementId[] = [];
  for (const id of ACHIEVEMENT_IDS) if (!unlocked[id] && prog[id][0] >= prog[id][1]) { unlocked[id] = now; newlyUnlocked.push(id); }
  return { progress: { ...p, unlocked }, newlyUnlocked };
}

/** Idempotent: a run ID already recorded is ignored. */
export function applyRun(p: ProgressFile, run: RunSummary, now: string) {
  if (p.runs.some((r) => r.runId === run.runId)) return { progress: p, newlyUnlocked: [] as AchievementId[] };
  return stamp({ ...p, runs: [...p.runs, run] }, now);
}

export function markPlanViewed(p: ProgressFile, runId: string, now: string) {
  if (!p.runs.some((r) => r.runId === runId) || p.plansViewed.includes(runId)) return { progress: p, newlyUnlocked: [] as AchievementId[] };
  return stamp({ ...p, plansViewed: [...p.plansViewed, runId] }, now);
}
