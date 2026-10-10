// Achievements and badge gallery: backend catalogs + persisted status (window.signal); nothing is evaluated here.
import type { AchievementMeta } from '../../../core/content/achievements';
import type { BadgeMeta } from '../../../core/content/badges';
import type { AchievementStatus } from '../../../shared/contracts/progress';
import type { Toast } from '../../state/uiStore';

export interface AchievementRow extends AchievementMeta { progress: number; target: number | null; unlocked: boolean; unlockedAt: string | null }

export function achievementsView(catalog: AchievementMeta[], statuses: AchievementStatus[]): AchievementRow[] {
  return catalog.map((m) => {
    const s = statuses.find((x) => x.id === m.id);
    return { ...m, progress: s?.progress ?? 0, target: s?.target ?? null, unlocked: s?.unlocked ?? false, unlockedAt: s?.unlockedAt ?? null };
  });
}

/** All 12 badges; `earned` = earned in any completed run (persisted by the backend). */
export const badgeGallery = (catalog: BadgeMeta[], earnedEver: string[]) => catalog.map((b) => ({ ...b, earned: earnedEver.includes(b.id) }));

export function achievementToasts(newlyUnlocked: string[], statuses: AchievementStatus[]): Omit<Toast, 'id'>[] {
  return newlyUnlocked.flatMap((id) => {
    const s = statuses.find((x) => x.id === id);
    return s ? [{ kind: 'badge' as const, title: `Achievement unlocked: ${s.name}`, body: s.description, icon: s.iconAssetId }] : [];
  });
}
