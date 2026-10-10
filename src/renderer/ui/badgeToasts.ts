import type { BadgeMeta } from '../../core/content/badges';
import type { EngineEvent } from '../../core/engine';
import type { Toast } from '../state/uiStore';

/** One toast per badgeEarned engine event (never inferred from re-renders). `icon` is the backend iconAssetId. */
export function badgeToasts(events: EngineEvent[], catalog: BadgeMeta[]): Omit<Toast, 'id'>[] {
  return events.flatMap((e) => {
    if (e.type !== 'badgeEarned') return [];
    const m = catalog.find((b) => b.id === e.badgeId);
    return [{ kind: 'badge' as const, title: `Badge earned: ${m?.name ?? e.badgeId}`, body: m?.description, icon: m?.iconAssetId }];
  });
}
