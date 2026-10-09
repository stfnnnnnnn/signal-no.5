import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyRun, computeAchievements, markPlanViewed, summarizeRun, TOTAL_LESSONS } from '../src/core/evaluation/achievements';
import { ACHIEVEMENT_CATALOG } from '../src/core/content/achievements';
import { evaluateRun } from '../src/core/evaluation/evaluate';
import { createGame } from '../src/core/engine';
import { SaveStore } from '../src/main/persistence/saveStore';
import { EMPTY_PROGRESS, type ProgressFile, type RunSummary } from '../src/shared/contracts/progress';
import type { GameState } from '../src/shared/contracts/state';
import { customSolo, randomHousehold } from './fixtures/onboarding';
import { playDiligently } from './diligent';
import { playToEnd } from './helpers';

const T = (n: number) => new Date(Date.UTC(2026, 9, 10, 0, n)).toISOString();
const run = (over: Partial<RunSummary> = {}, i = 0): RunSummary => ({
  runId: `r${i}`, stormSeed: i, configMode: 'random', exposure: 'standard', budgetTier: 'moderate', completedAt: T(i), score: 50,
  handaEarned: false, wellbeingPercent: 100, badgeIds: [], lessonIds: [], rumorOpportunity: false, rumorForwarded: false, communityHelpCompleted: false, communityHelpActionId: null, ...over,
});
const status = (p: ProgressFile, id: string) => computeAchievements(p).find((a) => a.id === id)!;
const addAll = (runs: RunSummary[]) => runs.reduce((p, r, i) => applyRun(p, r, T(100 + i)).progress, EMPTY_PROGRESS);

describe('achievement catalog', () => {
  it('defines A01–A10 with icons', () => {
    expect(ACHIEVEMENT_CATALOG.map((a) => [a.id, a.name])).toEqual([['A01', 'First Storm'], ['A02', 'Natuto'], ['A03', 'Lesson Collector'], ['A04', 'Signal Master'],
      ['A05', 'Kapos Pero Handa'], ['A06', 'Storm Chaser'], ['A07', 'No Rumor Spreader'], ['A08', 'Whole Barangay'], ['A09', 'My Real Home'], ['A10', 'Plan in Hand']]);
    expect(ACHIEVEMENT_CATALOG.every((a) => /^achievement_a\d\d_/.test(a.iconAssetId))).toBe(true);
  });
});

describe('achievement rules', () => {
  it('A01 First Storm after one completed run', () => {
    expect(status(EMPTY_PROGRESS, 'A01')).toMatchObject({ progress: 0, target: 1, unlocked: false });
    expect(status(addAll([run()]), 'A01').unlocked).toBe(true);
  });

  it('A02 Natuto needs a later run that scores higher than an earlier one', () => {
    expect(status(addAll([run({ score: 70 }, 0), run({ score: 60 }, 1)]), 'A02').unlocked).toBe(false);
    expect(status(addAll([run({ score: 60 }, 0), run({ score: 70 }, 1)]), 'A02').unlocked).toBe(true);
  });

  it('A03 Lesson Collector counts unique lesson IDs only', () => {
    const half = Array.from({ length: TOTAL_LESSONS - 1 }, (_, i) => `F_L${i}`);
    expect(TOTAL_LESSONS).toBeGreaterThan(20);
    const p = addAll([run({ lessonIds: half }, 0), run({ lessonIds: half }, 1)]);
    expect(status(p, 'A03')).toMatchObject({ progress: half.length, target: TOTAL_LESSONS, unlocked: false });
  });

  it('A04 Signal Master needs Handa under the highest exposure (references the stored Handa result)', () => {
    expect(status(addAll([run({ handaEarned: true, exposure: 'floodProne' })]), 'A04').unlocked).toBe(false);
    expect(status(addAll([run({ handaEarned: false, exposure: 'both' })]), 'A04').unlocked).toBe(false);
    expect(status(addAll([run({ handaEarned: true, exposure: 'both' })]), 'A04').unlocked).toBe(true);
  });

  it('A05 Kapos Pero Handa needs Handa on the smallest budget', () => {
    expect(status(addAll([run({ handaEarned: true, budgetTier: 'moderate' })]), 'A05').unlocked).toBe(false);
    expect(status(addAll([run({ handaEarned: true, budgetTier: 'limited' })]), 'A05').unlocked).toBe(true);
  });

  it('A06 Storm Chaser counts distinct storm seeds (repeats do not count)', () => {
    const repeats = addAll([0, 1, 2, 3].map((i) => run({ stormSeed: 7 }, i)));
    expect(status(repeats, 'A06').progress).toBe(1);
    expect(status(addAll([0, 1, 2, 3, 4].map((i) => run({ stormSeed: i }, i))), 'A06').unlocked).toBe(true);
  });

  it('A07 No Rumor Spreader needs five qualifying runs with a rumour and no sharing', () => {
    const runs = [0, 1, 2, 3].map((i) => run({ rumorOpportunity: true }, i));
    runs.push(run({ rumorOpportunity: false }, 4), run({ rumorOpportunity: true, rumorForwarded: true }, 5));
    expect(status(addAll(runs), 'A07')).toMatchObject({ progress: 4, unlocked: false });
    expect(status(addAll([...runs, run({ rumorOpportunity: true }, 6)]), 'A07').unlocked).toBe(true);
  });

  it('A08 Whole Barangay needs community assistance in five distinct completed runs', () => {
    expect(status(addAll([0, 1, 2, 3, 4].map((i) => run({ communityHelpCompleted: true, communityHelpActionId: 'SHARE_VERIFIED_ADVISORY' }, i))), 'A08').unlocked).toBe(true);
    expect(status(addAll([0, 1, 2, 3].map((i) => run({ communityHelpCompleted: true, communityHelpActionId: 'SHARE_VERIFIED_ADVISORY' }, i))), 'A08').unlocked).toBe(false);
  });

  it('A09 My Real Home needs a completed custom-mode run', () => {
    expect(status(addAll([run({ configMode: 'random' })]), 'A09').unlocked).toBe(false);
    expect(status(addAll([run({ configMode: 'custom' })]), 'A09').unlocked).toBe(true);
  });

  it('A10 Plan in Hand needs the plan summary viewed for a recorded run', () => {
    const p = addAll([run({}, 0)]);
    expect(markPlanViewed(p, 'unknown-run', T(9)).progress.plansViewed).toEqual([]);
    expect(status(markPlanViewed(p, 'r0', T(9)).progress, 'A10').unlocked).toBe(true);
  });

  it('ignores duplicate runs and unlocks each achievement once with a stable timestamp', () => {
    const once = applyRun(EMPTY_PROGRESS, run({}, 0), T(1));
    expect(once.newlyUnlocked).toContain('A01');
    const again = applyRun(once.progress, run({}, 0), T(2));
    expect(again.progress.runs).toHaveLength(1);
    expect(again.newlyUnlocked).toEqual([]);
    expect(again.progress.unlocked.A01).toBe(T(1));
  });
});

describe('run summaries from real runs', () => {
  it('summarises a completed run from the deterministic evaluation, without personal data', () => {
    const r = createGame(customSolo(), { seed: 2 }); if (!r.ok) throw new Error('setup');
    const st = playDiligently(r.engine);
    const ev = evaluateRun(st);
    const s = summarizeRun(st, ev, T(5));
    expect(s).toMatchObject({ runId: st.runId, stormSeed: st.storm.stormSeed, configMode: 'custom', score: ev.score, handaEarned: ev.handa.earned });
    expect(JSON.stringify(s)).not.toMatch(/medical|assistance|members|age/i);
  });

  it('rejects abandoned (incomplete) runs', () => {
    const r = createGame(randomHousehold(), { seed: 2 }); if (!r.ok) throw new Error('setup');
    const st = r.engine.getState();
    expect(() => summarizeRun(st, evaluateRun(st), T(5))).toThrow(/not complete/i);
  });
});

describe('persistence (SaveStore)', () => {
  const completed = (seed: number, input = customSolo()): GameState => {
    const r = createGame(input, { seed }); if (!r.ok) throw new Error('setup');
    return playToEnd(r.engine, ['DEFER', 'FINISH_REFLECTION']);
  };

  it('records a completed run, survives a restart, and does not double-count', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'signalno5-progress-'));
    const st = completed(3);
    const first = await new SaveStore(dir).recordCompletedRun(st);
    expect(first.newlyUnlocked).toEqual(expect.arrayContaining(['A01', 'A09']));
    const store2 = new SaveStore(dir); // "restart"
    const again = await store2.recordCompletedRun(st);
    expect(again.newlyUnlocked).toEqual([]);
    expect((await store2.readProgress()).runs).toHaveLength(1);
    expect(again.achievements.find((a) => a.id === 'A01')!.unlocked).toBe(true);
    expect(await store2.readBadges()).toEqual(expect.arrayContaining(evaluateRun(st).badgeIds));
  });

  it('refuses to record an abandoned run', async () => {
    const r = createGame(customSolo(), { seed: 3 }); if (!r.ok) throw new Error('setup');
    await expect(new SaveStore(mkdtempSync(join(tmpdir(), 'p-'))).recordCompletedRun(r.engine.getState())).rejects.toThrow(/not complete/i);
  });

  it('marks the plan as viewed only for a recorded run', async () => {
    const store = new SaveStore(mkdtempSync(join(tmpdir(), 'p-')));
    const st = completed(4);
    await store.recordCompletedRun(st);
    const a = await store.markPlanViewed(st.runId);
    expect(a.find((x) => x.id === 'A10')!.unlocked).toBe(true);
  });

  it('resets badge files from the previous schema version (old B01–B10 meanings)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'p-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'badges.json'), JSON.stringify({ schemaVersion: 1, badgeIds: ['B01', 'B09'] }));
    expect(await new SaveStore(dir).readBadges()).toEqual([]);
  });
});
