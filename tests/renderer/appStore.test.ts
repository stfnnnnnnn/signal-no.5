import { beforeEach, describe, expect, it } from 'vitest';
import { AppStore } from '../../src/renderer/state/appStore';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { interactWith } from '../../src/renderer/state/interactionController';
import { badgeToasts } from '../../src/renderer/ui/badgeToasts';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

let app: AppStore;
beforeEach(() => { store.reset(); ui.reset(); app = new AppStore(); });

describe('AppStore', () => {
  it('starts on the title screen and navigates', () => {
    expect(app.screen).toBe('title');
    app.go('mode');
    expect(app.screen).toBe('mode');
  });

  it('starts a run from onboarding input and enters the game with a fresh world', () => {
    const r = app.startNew(sliceHousehold(), SLICE_SEED);
    expect(r.ok).toBe(true);
    expect(app.screen).toBe('game');
    expect(app.runKey).toBe(1);
    expect(store.state!.activeEvent?.eventId).toBe('EV01');
  });

  it('reports backend validation errors without leaving the form', () => {
    app.go('custom');
    const r = app.startNew({ ...sliceHousehold(), q2ExactSize: 9 }, SLICE_SEED);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.issues?.some((i) => i.path[0] === 'q2ExactSize')).toBe(true);
    expect(app.screen).toBe('custom');
  });

  it('a second run leaves nothing behind: no menu, pause, toasts or old state; listeners not duplicated', () => {
    let toasts = 0;
    store.onEvents((e) => { toasts += badgeToasts(e, store.engine.getBadgeCatalog()).length; });
    app.startNew(sliceHousehold(), SLICE_SEED);
    const firstRun = store.state!.runId;
    store.dispatch((e) => e.resolveEvent('DEFER'));
    interactWith('LIVING_PHONE', 'Phone');           // menu open + 'menu' pause
    ui.toast({ kind: 'info', title: 'old' });
    expect(ui.overlay.kind).toBe('menu');

    app.replay();                                    // same household, new seed
    expect(app.runKey).toBe(2);
    expect(store.state!.runId).not.toBe(firstRun);
    expect(store.state!.household.size).toBe(4);
    expect(ui.overlay.kind).toBe('none');
    expect(ui.toasts).toEqual([]);
    expect(store.state!.clock.pauseReasons).not.toContain('menu');

    store.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    store.dispatch((e) => e.executeAction('SHARE_VERIFIED_ADVISORY'));
    expect(toasts).toBe(1);                          // one listener, one toast
  });

  it('loads a saved game and rejects an invalid save without crashing', () => {
    app.startNew(sliceHousehold(), SLICE_SEED);
    const saved = store.state!;
    app.go('title');
    expect(app.continueFrom(saved).ok).toBe(true);
    expect(app.screen).toBe('game');
    expect(store.state!.runId).toBe(saved.runId);
    app.go('title');
    const bad = app.continueFrom({ nonsense: true });
    expect(bad.ok).toBe(false);
    expect(app.screen).toBe('title');
  });
});
