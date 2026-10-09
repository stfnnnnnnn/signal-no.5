import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildScenarioRequest } from '../../src/core/ai/scenario';
import type { ScenarioAIRequest } from '../../src/shared/contracts/ai';
import { clearScenarioCache, requestScenario, scenarioForCurrentEvent } from '../../src/renderer/services/ai';
import { EngineStore } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

function req() {
  const s = new EngineStore(); s.newGame(sliceHousehold(), SLICE_SEED);
  return { r: buildScenarioRequest(s.state!)!, runId: s.state!.runId, key: s.activeEventKey()! };
}
const aiReply = async (q: ScenarioAIRequest) => ({
  schemaVersion: 1, eventId: q.eventId, variantId: q.allowedVariantIds[0]!, speaker: 'NARRATOR', dialogue: 'x', description: 'y',
  actionIds: q.allowedActionIds, source: 'ai' as const,
});
afterEach(() => { clearScenarioCache(); vi.unstubAllGlobals(); });

describe('requestScenario', () => {
  it('falls back to reviewed text when there is no bridge', async () => {
    vi.stubGlobal('window', {});
    const { r, runId, key } = req();
    const c = await requestScenario(r, runId, key);
    expect(c.source).toBe('fallback');
    expect(c.actionIds).toEqual(r.allowedActionIds);
  });

  it('falls back when the bridge rejects', async () => {
    vi.stubGlobal('window', { signal: { ai: { generateScenario: () => Promise.reject(new Error('ipc')) } } });
    const { r, runId, key } = req();
    expect((await requestScenario(r, runId, key)).source).toBe('fallback');
  });

  it('calls the model once per event key', async () => {
    const gen = vi.fn(aiReply);
    vi.stubGlobal('window', { signal: { ai: { generateScenario: gen } } });
    const { r, runId, key } = req();
    await requestScenario(r, runId, key); await requestScenario(r, runId, key);
    expect(gen).toHaveBeenCalledTimes(1);
  });
});

describe('scenarioForCurrentEvent', () => {
  it('discards text that arrives after the active event changed', async () => {
    let resolveAi!: () => void;
    vi.stubGlobal('window', { signal: { ai: { generateScenario: (q: ScenarioAIRequest) => new Promise((ok) => { resolveAi = () => ok(aiReply(q)); }) } } });
    const { r, runId, key } = req();
    let current: string | null = key;
    const pending = scenarioForCurrentEvent(r, runId, key, () => current);
    current = 'EV02@480'; // the player resolved EV01 and another event opened before the model answered
    resolveAi();
    expect(await pending).toBeNull();
  });

  it('returns the text while the event is still open', async () => {
    vi.stubGlobal('window', { signal: { ai: { generateScenario: aiReply } } });
    const { r, runId, key } = req();
    expect((await scenarioForCurrentEvent(r, runId, key, () => key))?.source).toBe('ai');
  });
});
