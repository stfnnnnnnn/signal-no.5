import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { closeMenu, interactWith, runMenuAction } from '../../src/renderer/state/interactionController';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

const menu = () => (ui.overlay.kind === 'menu' ? ui.overlay : null);

beforeEach(() => {
  store.reset(); ui.close(); ui.toasts = [];
  expect(store.newGame(sliceHousehold(), SLICE_SEED).ok).toBe(true);
});

describe('interaction controller', () => {
  it('shows the engine message instead of a menu while an event is pending', () => {
    interactWith('LIVING_PHONE', 'Phone');
    expect(ui.overlay.kind).toBe('none');
    expect(ui.toasts.at(-1)).toMatchObject({ kind: 'error', title: 'Respond to the current event first.' });
  });

  it('opens the phone menu, pauses for the menu, and keeps sharing disabled with the engine reason until verified', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');
    expect(ui.overlay.kind).toBe('menu');
    expect(store.state!.clock.pauseReasons).toContain('menu');
    const share = menu()!.actions.find((a) => a.actionId === 'SHARE_VERIFIED_ADVISORY')!;
    expect(share.available).toBe(false);
    expect(share.reasons.join(' ')).toMatch(/official information/i);
    expect(runMenuAction(share)).toBeNull();
  });

  it('runs CHECK_BULLETIN then SHARE_VERIFIED_ADVISORY from refreshed menus', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');
    expect(runMenuAction(menu()!.actions.find((a) => a.actionId === 'CHECK_BULLETIN')!)!.ok).toBe(true);
    expect(ui.overlay.kind).toBe('none');
    expect(store.state!.clock.pauseReasons).not.toContain('menu');
    interactWith('LIVING_PHONE', 'Phone');
    const share = menu()!.actions.find((a) => a.actionId === 'SHARE_VERIFIED_ADVISORY')!;
    expect(share.available).toBe(true);
    expect(runMenuAction(share)!.ok).toBe(true);
  });

  it('runs discovery actions without spending time and shows a card', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    const m0 = store.state!.clock.gameMinutes;
    interactWith('KITCHEN_CABINET', 'Food cabinet');
    runMenuAction(menu()!.actions.find((a) => a.actionId === 'INSPECT_SUPPLIES')!);
    expect(ui.overlay.kind).toBe('discovery');
    expect(store.state!.clock.gameMinutes).toBe(m0);
    closeMenu();
    expect(ui.overlay.kind).toBe('none');
  });

  it('leaves no menu pause behind when the menu is closed without acting', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');
    closeMenu();
    expect(store.state!.clock.pauseReasons).not.toContain('menu');
  });
});
