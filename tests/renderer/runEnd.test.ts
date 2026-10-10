import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core/engine';
import { finishRun } from '../../src/renderer/services/runEnd';
import { narrateDebriefSafe } from '../../src/renderer/services/ai';
import { resetPersistenceMemo } from '../../src/renderer/services/persistence';
import { ui } from '../../src/renderer/state/uiStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import { playToEnd } from '../helpers';

const done = () => { const r = createGame(sliceHousehold(), { seed: SLICE_SEED }); if (!r.ok) throw 0; playToEnd(r.engine); return r.engine; };
beforeEach(() => { ui.reset(); resetPersistenceMemo(); });
afterEach(() => vi.unstubAllGlobals());

describe('finishRun', () => {
  it('records the run, persists badges, toasts each unlock once, clears the autosave', async () => {
    const e = done();
    const ev = e.evaluate();
    const unlocked = { id: 'A01', name: 'First Storm', description: 'Complete your first full playthrough.', iconAssetId: 'achievement_a01_first_storm', progress: 1, target: 1, unlocked: true, unlockedAt: 'x' };
    const recordRun = vi.fn(async () => ({ achievements: [unlocked], newlyUnlocked: ['A01'] }));
    const add = vi.fn(async (ids: string[]) => ids);
    const remove = vi.fn(async () => {});
    vi.stubGlobal('window', { signal: { achievements: { recordRun }, badges: { add }, save: { remove } } });
    await finishRun(e.getState(), ev);
    await finishRun(e.getState(), ev);                       // debrief re-rendered
    expect(recordRun).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(ev.badgeIds);
    expect(remove).toHaveBeenCalledWith('auto');
    expect(ui.toasts.filter((t) => t.title === 'Achievement unlocked: First Storm')).toHaveLength(1);
  });
});

describe('narrateDebriefSafe', () => {
  it('uses reviewed narration when there is no bridge or it fails', async () => {
    const e = done(); const ev = e.evaluate();
    vi.stubGlobal('window', {});
    expect((await narrateDebriefSafe(ev, e.getState())).source).toBe('fallback');
    vi.stubGlobal('window', { signal: { ai: { narrateDebrief: () => Promise.reject(new Error('ipc')) } } });
    const n = await narrateDebriefSafe(ev, e.getState());
    expect(n.source).toBe('fallback');
    expect(n.summary.length).toBeGreaterThan(10);
  });
});
