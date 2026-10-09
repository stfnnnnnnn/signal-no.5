import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_CATALOG } from '../../src/core/content/achievements';
import { BADGE_CATALOG } from '../../src/core/content/badges';
import type { AchievementStatus } from '../../src/shared/contracts/progress';
import { achievementToasts, achievementsView, badgeGallery } from '../../src/renderer/ui/achievements/progressView';

const status = (id: string, over: Partial<AchievementStatus> = {}): AchievementStatus => {
  const m = ACHIEVEMENT_CATALOG.find((a) => a.id === id)!;
  return { ...m, progress: 0, target: 1, unlocked: false, unlockedAt: null, ...over };
};

describe('achievementsView', () => {
  it('lists all 10 achievements in catalog order with persisted progress', () => {
    const v = achievementsView(ACHIEVEMENT_CATALOG, [status('A08', { progress: 2, target: 5 }), status('A01', { progress: 1, unlocked: true, unlockedAt: '2026-10-10T04:00:00.000Z' })]);
    expect(v.map((a) => a.id)).toEqual(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']);
    expect(v.find((a) => a.id === 'A08')).toMatchObject({ progress: 2, target: 5, unlocked: false });
    expect(v.find((a) => a.id === 'A01')).toMatchObject({ unlocked: true, unlockedAt: '2026-10-10T04:00:00.000Z' });
  });
  it('shows everything locked when progress can’t be read (no bridge)', () => {
    const v = achievementsView(ACHIEVEMENT_CATALOG, []);
    expect(v.every((a) => !a.unlocked && a.progress === 0 && a.target === null)).toBe(true);
  });
});

describe('badgeGallery', () => {
  it('marks badges earned in any run, all 12 listed', () => {
    const g = badgeGallery(BADGE_CATALOG, ['B06', 'B02']);
    expect(g).toHaveLength(12);
    expect(g.filter((b) => b.earned).map((b) => b.id)).toEqual(['B02', 'B06']);
  });
});

describe('achievementToasts', () => {
  it('one toast per newly unlocked achievement, with its icon', () => {
    const all = [status('A01', { unlocked: true }), status('A08', { unlocked: true })];
    expect(achievementToasts(['A01', 'A08'], all)).toEqual([
      { kind: 'badge', title: 'Achievement unlocked: First Storm', body: all[0]!.description, icon: 'achievement_a01_first_storm' },
      { kind: 'badge', title: 'Achievement unlocked: Whole Barangay', body: all[1]!.description, icon: 'achievement_a08_whole_barangay' },
    ]);
    expect(achievementToasts([], all)).toEqual([]);
  });
});
