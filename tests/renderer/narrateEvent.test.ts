// EV01 on a cold start: reviewed fallback at once, AI narration once the local model is ready (blueprint §7, §8).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildScenarioRequest, fallbackFromRequest } from '../../src/core/ai/scenario';
import type { AiStatus } from '../../src/shared/bridge';
import type { ScenarioAIRequest, ScenarioContent } from '../../src/shared/contracts/ai';
import { clearScenarioCache, narrateEvent } from '../../src/renderer/services/ai';
import { EngineStore } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

const flush = () => new Promise((r) => setTimeout(r, 0));
const aiText = (q: ScenarioAIRequest): ScenarioContent => ({
  schemaVersion: 1, eventId: q.eventId, variantId: q.allowedVariantIds[0]!, speaker: 'NARRATOR', dialogue: 'AI words', description: 'AI scene',
  actionIds: q.allowedActionIds, source: 'ai', fallbackReason: null,
});

/** A fake window.signal whose model readiness the test controls, like the real main process. */
function fakeBridge(initial: AiStatus, onReady: (q: ScenarioAIRequest) => ScenarioContent = aiText) {
  let status = initial;
  const listeners = new Set<(s: AiStatus) => void>();
  const generateScenario = vi.fn(async (q: ScenarioAIRequest) => (status === 'ready' ? onReady(q) : fallbackFromRequest(q, 'model-unavailable')));
  vi.stubGlobal('window', { signal: { ai: {
    status: async () => status,
    onStatus: (cb: (s: AiStatus) => void) => { listeners.add(cb); return () => listeners.delete(cb); },
    generateScenario,
  } } });
  return { generateScenario, set: (s: AiStatus) => { status = s; for (const l of [...listeners]) l(s); }, listeners };
}

function ev01() {
  const s = new EngineStore(); s.newGame(sliceHousehold(), SLICE_SEED);
  return { s, req: buildScenarioRequest(s.state!)!, runId: s.state!.runId, key: s.activeEventKey()! };
}

afterEach(() => { clearScenarioCache(); vi.unstubAllGlobals(); });

describe('narrateEvent (cold start)', () => {
  it('shows reviewed fallback immediately, then AI narration once the model becomes ready', async () => {
    const b = fakeBridge('starting');
    const { s, req, runId, key } = ev01();
    const shown: ScenarioContent[] = [];
    narrateEvent(req, runId, key, () => s.activeEventKey(), (c) => shown.push(c));
    await flush();
    expect(shown.map((c) => c.source)).toEqual(['fallback']);       // nothing waits for the model
    b.set('warming'); await flush();
    expect(shown).toHaveLength(1);
    b.set('ready'); await flush(); await flush();
    expect(shown.map((c) => c.source)).toEqual(['fallback', 'ai']);
    expect(shown[1]!.actionIds).toEqual(req.allowedActionIds);       // choices unchanged
    expect(b.generateScenario).toHaveBeenCalledTimes(2);
  });

  it('asks the model only once more, however many ready notifications arrive', async () => {
    const b = fakeBridge('starting');
    const { s, req, runId, key } = ev01();
    narrateEvent(req, runId, key, () => s.activeEventKey(), () => {});
    await flush();
    b.set('ready'); b.set('ready'); b.set('ready'); await flush(); await flush();
    expect(b.generateScenario).toHaveBeenCalledTimes(2);
    expect(b.listeners.size).toBe(0);                                 // stopped listening
  });

  it('discards AI text that arrives after the player has moved on to another event', async () => {
    const b = fakeBridge('starting');
    const { s, req, runId, key } = ev01();
    const shown: ScenarioContent[] = [];
    narrateEvent(req, runId, key, () => s.activeEventKey(), (c) => shown.push(c));
    await flush();
    s.dispatch((e) => e.resolveEvent('DEFER'));                       // EV01 closed before the model was ready
    b.set('ready'); await flush(); await flush();
    expect(shown.map((c) => c.source)).toEqual(['fallback']);
  });

  it('keeps the fallback when the model never becomes ready', async () => {
    const b = fakeBridge('starting');
    const { s, req, runId, key } = ev01();
    const shown: ScenarioContent[] = [];
    narrateEvent(req, runId, key, () => s.activeEventKey(), (c) => shown.push(c));
    await flush();
    b.set('unavailable'); await flush();
    expect(shown.map((c) => c.source)).toEqual(['fallback']);
    expect(b.generateScenario).toHaveBeenCalledTimes(1);
  });

  it('keeps the fallback when the retried AI output is rejected by validation (no further retries)', async () => {
    const b = fakeBridge('starting', (q) => fallbackFromRequest(q, 'ungrounded:housing'));
    const { s, req, runId, key } = ev01();
    const shown: ScenarioContent[] = [];
    narrateEvent(req, runId, key, () => s.activeEventKey(), (c) => shown.push(c));
    await flush();
    b.set('ready'); await flush(); await flush();
    b.set('ready'); await flush();
    expect(shown.map((c) => c.source)).toEqual(['fallback']);
    expect(b.generateScenario).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the model is already ready (the first answer stands)', async () => {
    const b = fakeBridge('ready');
    const { s, req, runId, key } = ev01();
    const shown: ScenarioContent[] = [];
    narrateEvent(req, runId, key, () => s.activeEventKey(), (c) => shown.push(c));
    await flush(); await flush();
    expect(shown.map((c) => c.source)).toEqual(['ai']);
    expect(b.generateScenario).toHaveBeenCalledTimes(1);
  });

  it('never changes game state: same event, same decisions, no duplicate processing', async () => {
    const b = fakeBridge('starting');
    const { s, req, runId, key } = ev01();
    const before = s.state!;
    narrateEvent(req, runId, key, () => s.activeEventKey(), () => {});
    b.set('ready'); await flush(); await flush();
    expect(s.state).toBe(before);
    expect(s.activeEventKey()).toBe(key);
  });

  it('stops all work when cancelled (dialog closed or unmounted)', async () => {
    const b = fakeBridge('starting');
    const { s, req, runId, key } = ev01();
    const shown: ScenarioContent[] = [];
    const cancel = narrateEvent(req, runId, key, () => s.activeEventKey(), (c) => shown.push(c));
    await flush();
    cancel();
    b.set('ready'); await flush(); await flush();
    expect(shown).toHaveLength(1);
    expect(b.generateScenario).toHaveBeenCalledTimes(1);
  });
});
