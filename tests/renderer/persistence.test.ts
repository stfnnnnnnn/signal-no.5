import { afterEach, describe, expect, it, vi } from 'vitest';
import { listSaves, markPlanViewedOnce, readSave, recordRunOnce, resetPersistenceMemo, writeSave } from '../../src/renderer/services/persistence';
import { EngineStore } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

afterEach(() => { vi.unstubAllGlobals(); resetPersistenceMemo(); });
const state = () => { const s = new EngineStore(); s.newGame(sliceHousehold(), SLICE_SEED); return s.state!; };

describe('persistence service', () => {
  it('records a run and persists badges once, however often the debrief asks', async () => {
    const recordRun = vi.fn(async () => ({ achievements: [], newlyUnlocked: ['A01'] }));
    const add = vi.fn(async (ids: string[]) => ids);
    vi.stubGlobal('window', { signal: { achievements: { recordRun }, badges: { add } } });
    const s = state();
    const [a, b] = await Promise.all([recordRunOnce(s, ['B06']), recordRunOnce(s, ['B06'])]);
    await recordRunOnce(s, ['B06']);
    expect(recordRun).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(['B06']);
    expect(a?.newlyUnlocked).toEqual(['A01']);
    expect(b).toBe(a);
  });
  it('marks the plan viewed once per run', async () => {
    const markPlanViewed = vi.fn(async () => []);
    vi.stubGlobal('window', { signal: { achievements: { markPlanViewed } } });
    await markPlanViewedOnce('run-1'); await markPlanViewedOnce('run-1');
    expect(markPlanViewed).toHaveBeenCalledTimes(1);
  });
  it('degrades to "nothing saved" without a bridge or when the bridge fails', async () => {
    vi.stubGlobal('window', {});
    expect(await listSaves()).toEqual([]);
    expect(await readSave('auto')).toBeNull();
    expect(await writeSave('auto', state())).toBe(false);
    vi.stubGlobal('window', { signal: { save: { read: () => Promise.reject(new Error('disk')), write: () => Promise.reject(new Error('disk')), list: () => Promise.reject(new Error('disk')) } } });
    expect(await readSave('auto')).toBeNull();
    expect(await writeSave('auto', state())).toBe(false);
    expect(await listSaves()).toEqual([]);
  });
});
