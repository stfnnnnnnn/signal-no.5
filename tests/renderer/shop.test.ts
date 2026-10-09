import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { buy, closeMenu, interactWith, openPanel } from '../../src/renderer/state/interactionController';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

beforeEach(() => {
  store.reset(); ui.reset(); store.newGame(sliceHousehold(), SLICE_SEED);
  store.dispatch((e) => e.resolveEvent('DEFER'));
});

describe('shop', () => {
  it('opens from the counter, paused for shopping, and resumes on close', () => {
    expect(store.dispatch((e) => e.executeAction('SHOP_TRIP')).ok).toBe(true);
    expect(store.state!.scene).toBe('SHOP');
    interactWith('SHOP_COUNTER', 'Shop counter');
    expect(ui.overlay.kind).toBe('shop');
    expect(store.state!.clock.pauseReasons).toContain('shop');
    closeMenu();
    expect(store.state!.clock.pauseReasons).not.toContain('shop');
  });
  it('buys at engine prices and shows engine errors verbatim', () => {
    store.dispatch((e) => e.executeAction('SHOP_TRIP'));
    const cash0 = store.state!.cash;
    const jug = store.engine.getShopCatalog().find((i) => i.shopItemId === 'WATER_JUG')!;
    expect(buy('WATER_JUG', 1)).toBe(true);
    expect(store.state!.cash).toBe(cash0 - jug.price);
    expect(buy('WATER_JUG', 99)).toBe(false);
    expect(ui.toasts.at(-1)?.kind).toBe('error');
  });
});

describe('panels', () => {
  it('inventory and objectives pause like menus and resume on close', () => {
    openPanel('inventory');
    expect(ui.overlay.kind).toBe('inventory');
    expect(store.state!.clock.pauseReasons).toContain('menu');
    closeMenu();
    expect(store.state!.clock.pauseReasons).toEqual([]);
    openPanel('objectives');
    expect(ui.overlay.kind).toBe('objectives');
    closeMenu();
    expect(store.state!.clock.pauseReasons).toEqual([]);
  });
});
