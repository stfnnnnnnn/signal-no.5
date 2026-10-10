import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosaver } from '../../src/renderer/services/autosave';
import { store } from '../../src/renderer/state/engineStore';
import { ui } from '../../src/renderer/state/uiStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

beforeEach(() => { store.reset(); ui.reset(); store.newGame(sliceHousehold(), SLICE_SEED); });

describe('autosave', () => {
  it('writes the engine state to the auto slot on every phase change, not on other events', async () => {
    const write = vi.fn(async () => true);
    const a = createAutosaver(write);
    await a.onEvents([{ type: 'milestone', id: 'H8_REMINDER', minute: 480 }]);
    expect(write).not.toHaveBeenCalled();
    await a.onEvents([{ type: 'phaseChanged', from: 'preparation', to: 'warning' }]);
    expect(write).toHaveBeenCalledWith('auto', store.state);
  });
  it('a manual save confirms, a failed save says so and play continues', async () => {
    const ok = createAutosaver(async () => true);
    expect(await ok.saveNow()).toBe(true);
    expect(ui.toasts.at(-1)).toMatchObject({ kind: 'info', title: 'Game saved' });
    const bad = createAutosaver(async () => false);
    expect(await bad.saveNow()).toBe(false);
    expect(ui.toasts.at(-1)).toMatchObject({ kind: 'error', title: 'Couldn’t save' });
  });
  it('does not save a finished run as something to continue', async () => {
    const write = vi.fn(async () => true);
    const a = createAutosaver(write);
    store.state!.completed; // state is read at save time
    const done = { ...store.state!, completed: true };
    await a.onEvents([{ type: 'phaseChanged', from: 'aftermath', to: 'debrief' }], done);
    expect(write).not.toHaveBeenCalled();
  });
});
