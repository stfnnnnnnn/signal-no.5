import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStore } from '../../src/renderer/state/appStore';
import { continueSaved } from '../../src/renderer/services/continueGame';
import { narrateDebriefOnce, resetNarrationMemo } from '../../src/renderer/services/ai';
import { createGame } from '../../src/core/engine';
import { store } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import { playToEnd } from '../helpers';

afterEach(() => { vi.unstubAllGlobals(); resetNarrationMemo(); });

describe('continueSaved', () => {
  it('reports a corrupt save as invalid and stays on the title', async () => {
    vi.stubGlobal('window', { signal: { save: { read: async () => ({ nonsense: true }) } } });
    const app = new AppStore();
    expect(await continueSaved(app)).toBe('invalid');
    expect(app.screen).toBe('title');
  });
  it('reports a missing save', async () => {
    vi.stubGlobal('window', { signal: { save: { read: async () => null } } });
    expect(await continueSaved(new AppStore())).toBe('missing');
  });
  it('continues a valid save', async () => {
    store.reset(); store.newGame(sliceHousehold(), SLICE_SEED);
    const s = store.state!;
    vi.stubGlobal('window', { signal: { save: { read: async () => s } } });
    const app = new AppStore();
    expect(await continueSaved(app)).toBe('ok');
    expect(app.screen).toBe('game');
  });
});

describe('narrateDebriefOnce', () => {
  it('asks the model once per run, however often the debrief re-renders', async () => {
    const r = createGame(sliceHousehold(), { seed: SLICE_SEED }); if (!r.ok) throw 0; playToEnd(r.engine);
    const ev = r.engine.evaluate(); const s = r.engine.getState();
    const narrateDebrief = vi.fn(async () => ({ summary: 'Well done.', highlightFindingIds: [], source: 'ai' as const }));
    vi.stubGlobal('window', { signal: { ai: { narrateDebrief } } });
    const a = await narrateDebriefOnce(ev, s);
    const b = await narrateDebriefOnce(r.engine.evaluate(), { ...s });
    expect(narrateDebrief).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });
});
