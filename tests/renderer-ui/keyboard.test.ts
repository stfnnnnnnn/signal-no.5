// Keyboard safety (review finding): a key meant for the world must never commit a scored choice or repeat actions.
// Renders the real components with react-dom/server (no DOM library needed) and checks the House key filter.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { closeMenu, interactWith } from '../../src/renderer/state/interactionController';
import { EventDialog } from '../../src/renderer/ui/EventDialog';
import { InteractionMenu } from '../../src/renderer/ui/InteractionMenu';
import { acceptsInteractKey } from '../../src/renderer/game/input';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

beforeEach(() => { store.reset(); ui.close(); ui.toasts = []; store.newGame(sliceHousehold(), SLICE_SEED); });

describe('no pre-focused choices (Space/Enter cannot pick one by accident)', () => {
  it('event dialog: choices render without autofocus; the panel itself takes focus', () => {
    const html = renderToStaticMarkup(createElement(EventDialog));
    expect(html).toContain('Check the official advisory');
    expect(html).not.toMatch(/autofocus/i);
    expect(html).toMatch(/tabindex="-1"[^>]*role="dialog"/);
  });

  it('interaction menu: actions render without autofocus; the panel itself takes focus', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');
    const html = renderToStaticMarkup(createElement(InteractionMenu));
    expect(html).toContain('Check official information');
    expect(html).not.toMatch(/autofocus/i);
    expect(html).toMatch(/tabindex="-1"[^>]*role="dialog"/);
    closeMenu();
  });
});

describe('world interact key (E / Space)', () => {
  it('ignores auto-repeat from a held key', () => expect(acceptsInteractKey({ repeat: true }, false)).toBe(false));
  it('ignores the key while an overlay or event is open', () => expect(acceptsInteractKey({ repeat: false }, true)).toBe(false));
  it('accepts a fresh press in the world', () => expect(acceptsInteractKey({ repeat: false }, false)).toBe(true));
  it('blocks world input while an event is waiting for a choice', () => {
    expect(store.state!.activeEvent).not.toBeNull();
    expect(ui.isBlocking()).toBe(true);
    store.dispatch((e) => e.resolveEvent('DEFER'));
    expect(ui.isBlocking()).toBe(false);
  });
  it('leaves no menu pause after closing a menu', () => {
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');
    expect(store.state!.clock.pauseReasons).toContain('menu');
    closeMenu();
    expect(store.state!.clock.pauseReasons).toEqual([]);
  });
});
