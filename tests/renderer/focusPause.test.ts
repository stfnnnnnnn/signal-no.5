import { beforeEach, expect, it } from 'vitest';
import { store } from '../../src/renderer/state/engineStore';
import { bindFocusPause } from '../../src/renderer/state/focusPause';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

beforeEach(() => { store.reset(); store.newGame(sliceHousehold(), SLICE_SEED); store.dispatch((e) => e.resolveEvent('DEFER')); });

it('pauses game time while the window is unfocused and resumes on focus (blueprint §7)', () => {
  const win = new EventTarget();
  const unbind = bindFocusPause(win);
  win.dispatchEvent(new Event('blur'));
  expect(store.state!.clock.pauseReasons).toContain('focusLost');
  const m0 = store.state!.clock.gameMinutes;
  for (let i = 0; i < 100; i++) store.tick(1000);
  expect(store.state!.clock.gameMinutes).toBe(m0);
  win.dispatchEvent(new Event('focus'));
  expect(store.state!.clock.pauseReasons).not.toContain('focusLost');
  unbind();
  win.dispatchEvent(new Event('blur'));
  expect(store.state!.clock.pauseReasons).not.toContain('focusLost'); // listeners removed
});
