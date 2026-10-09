import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneAIRequest, SceneDirective } from '../../src/shared/contracts/scene';
import { addedEffects, directiveChanged, phaserSceneFor } from '../../src/renderer/game/directive';
import { DirectiveStore } from '../../src/renderer/state/directiveStore';
import { store } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

const base = (): SceneDirective => {
  store.reset(); store.newGame(sliceHousehold(), SLICE_SEED);
  return store.engine.getSceneDirective();
};

describe('directive helpers', () => {
  it('detects real changes only', () => {
    const d = base();
    expect(directiveChanged(null, d)).toBe(true);
    expect(directiveChanged(d, structuredClone(d))).toBe(false);
    expect(directiveChanged(d, { ...d, lighting: 'stormDark' })).toBe(true);
  });
  it('reports one-shot effects only when newly added', () => {
    const d = base();
    const withFlash = { ...d, effects: [...d.effects, 'LIGHTNING_FLASH' as const] };
    expect(addedEffects(d, withFlash)).toEqual(['LIGHTNING_FLASH']);
    expect(addedEffects(withFlash, structuredClone(withFlash))).toEqual([]);
  });
  it('routes engine scenes to world scenes; RESULTS has no world', () => {
    expect(['HOUSE', 'HOME_IMPACT', 'AFTERMATH'].map((s) => phaserSceneFor(s as never))).toEqual(['House', 'House', 'House']);
    expect(phaserSceneFor('SHOP')).toBe('Shop');
    expect(phaserSceneFor('STREET')).toBe('Street');
    expect(phaserSceneFor('EVACUATION')).toBe('Evacuation');
    expect(phaserSceneFor('RESULTS')).toBeNull();
  });
});

describe('DirectiveStore', () => {
  let ds: DirectiveStore;
  let suggestScene: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    suggestScene = vi.fn(async (_r: SceneAIRequest) => null);
    vi.stubGlobal('window', { signal: { ai: { suggestScene } } });
    store.reset(); ds = new DirectiveStore(); ds.attach();
    store.newGame(sliceHousehold(), SLICE_SEED);
  });
  afterEach(() => { ds.detach(); vi.unstubAllGlobals(); });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('has the deterministic directive as soon as a run starts', () => {
    expect(ds.current?.sceneId).toBe('HOUSE');
    expect(ds.current?.source).toBe('deterministic');
  });
  it('re-applies only when the directive actually changes (ticks do not restart visuals)', () => {
    let emits = 0; ds.subscribe(() => emits++);
    store.dispatch((e) => e.resolveEvent('DEFER'));
    for (let i = 0; i < 20; i++) store.tick(1000);
    expect(emits).toBe(0);
    store.dispatch((e) => e.executeAction('GET_TOOLS'));
    store.dispatch((e) => e.executeAction('BOARD_WINDOW'));
    expect(ds.current!.props).toContainEqual({ anchor: 'WINDOW', variant: 'WINDOW_BOARDED' });
    expect(emits).toBe(1);
  });
  it('asks the AI once per basis and keeps the deterministic directive when it suggests nothing', async () => {
    await flush();
    store.dispatch((e) => e.resolveEvent('DEFER'));
    await flush();
    expect(suggestScene).toHaveBeenCalledTimes(1);
    expect(ds.current!.source).toBe('deterministic');
  });
  it('merges a valid AI suggestion for the current basis', async () => {
    const req = suggestScene.mock.calls[0]?.[0] as SceneAIRequest;
    ds.detach(); store.reset();
    suggestScene = vi.fn(async (r: SceneAIRequest) => ({ basisKey: r.basisKey, mood: r.allowed.moods[0], extraEffects: [], decor: [], npcCues: [] }));
    vi.stubGlobal('window', { signal: { ai: { suggestScene } } });
    ds = new DirectiveStore(); ds.attach(); store.newGame(sliceHousehold(), SLICE_SEED);
    await flush(); await flush();
    expect(req?.basisKey ?? 'x').toBeTruthy();
    expect(ds.current!.source).toBe('ai-merged');
  });
});
