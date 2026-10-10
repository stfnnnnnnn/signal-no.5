// The first playable vertical slice end to end, through the same functions the UI calls (blueprint §6.5).
import { beforeEach, expect, it } from 'vitest';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { closeMenu, interactWith, runMenuAction } from '../../src/renderer/state/interactionController';
import { badgeToasts } from '../../src/renderer/ui/badgeToasts';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import type { EngineEvent } from '../../src/core/engine';

beforeEach(() => { store.reset(); ui.close(); ui.toasts = []; });

const option = (id: string) => (ui.overlay.kind === 'menu' ? ui.overlay.actions.find((a) => a.actionId === id) : undefined);

it('phone → check bulletin → share → exactly one Bayanihan toast; B06 earned by the engine; play continues', () => {
  const seen: EngineEvent[] = [];
  store.newGame(sliceHousehold(), SLICE_SEED);
  store.onEvents((e) => { seen.push(...e); for (const t of badgeToasts(e, store.engine.getBadgeCatalog())) ui.toast(t); });
  expect(store.dispatch((e) => e.resolveEvent('DEFER')).ok).toBe(true); // close EV01 without verifying anything

  interactWith('LIVING_PHONE', 'Phone');
  expect(option('SHARE_VERIFIED_ADVISORY')!.available).toBe(false);
  expect(runMenuAction(option('CHECK_BULLETIN')!)!.ok).toBe(true);

  interactWith('LIVING_PHONE', 'Phone');
  expect(runMenuAction(option('SHARE_VERIFIED_ADVISORY')!)!.ok).toBe(true);

  interactWith('LIVING_PHONE', 'Phone'); // once per run: now unavailable
  expect(option('SHARE_VERIFIED_ADVISORY')!.available).toBe(false);

  const badges = ui.toasts.filter((t) => t.kind === 'badge');
  expect(badges).toHaveLength(1);
  expect(badges[0]).toMatchObject({ title: 'Badge earned: Bayanihan', icon: 'badge_b06_bayanihan' });
  expect(seen.filter((e) => e.type === 'badgeEarned')).toHaveLength(1);
  expect(store.engine.evaluate().badges.find((b) => b.id === 'B06')!.status).toBe('earned');
  expect(store.state!.decisionLog.map((d) => d.actionId)).toEqual(expect.arrayContaining(['CHECK_BULLETIN', 'SHARE_VERIFIED_ADVISORY']));

  expect(store.state!.clock.pauseReasons).toEqual(['menu']); // the open menu is the only thing holding time
  closeMenu();
  const m0 = store.state!.clock.gameMinutes; // gameplay continues: time advances again
  for (let i = 0; i < 100; i++) store.tick(1000);
  expect(store.state!.clock.gameMinutes).toBeGreaterThan(m0);
});

it('maps only badgeEarned events to toasts', () => {
  store.newGame(sliceHousehold(), SLICE_SEED);
  const cat = store.engine.getBadgeCatalog();
  expect(badgeToasts([{ type: 'runCompleted' }, { type: 'milestone', id: 'H8_REMINDER', minute: 480 }], cat)).toEqual([]);
  expect(badgeToasts([{ type: 'badgeEarned', badgeId: 'B06' }], cat)).toHaveLength(1);
});
