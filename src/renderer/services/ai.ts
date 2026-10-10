// The renderer's only door to local AI (window.signal.ai). Always resolves; gameplay never waits on it.
import { fallbackFromRequest } from '../../core/ai/scenario';
import { buildDebriefRequest, fallbackDebriefNarration } from '../../core/ai/debrief';
import type { DebriefEvaluation, DebriefNarration } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import type { AiStatus } from '../../shared/bridge';
import type { ScenarioAIRequest, ScenarioContent } from '../../shared/contracts/ai';
import type { SceneAIRequest, SceneAISuggestion } from '../../shared/contracts/scene';

const cache = new Map<string, Promise<ScenarioContent>>();
const bridge = () => (typeof window !== 'undefined' ? window.signal : undefined);

/**
 * AI text for one event occurrence (`key` = eventId@triggeredAtMinute), fallback on any failure. Concurrent calls
 * share one request; only AI results stay cached, so a fallback (e.g. model not ready yet) can be retried later.
 */
export function requestScenario(req: ScenarioAIRequest, runId: string, key: string): Promise<ScenarioContent> {
  const k = `${runId}:${key}`;
  let p = cache.get(k);
  if (!p) {
    const ai = bridge()?.ai;
    p = ai ? ai.generateScenario(req, runId).catch(() => fallbackFromRequest(req, 'bridge-error'))
      : Promise.resolve(fallbackFromRequest(req, 'no-bridge'));
    cache.set(k, p);
    void p.then((c) => { if (c.source !== 'ai' && cache.get(k) === p) cache.delete(k); });
  }
  return p;
}

/** Like requestScenario, but resolves null when the active event changed while the model was generating (stale text). */
export async function scenarioForCurrentEvent(req: ScenarioAIRequest, runId: string, key: string, currentKey: () => string | null): Promise<ScenarioContent | null> {
  const c = await requestScenario(req, runId, key);
  return currentKey() === key ? c : null;
}

/** The only fallback worth retrying: the model was not ready yet (cold start). Invalid output is never retried. */
const RETRY_WHEN_READY = 'model-unavailable';

/**
 * Narration for the open event, never blocking play: shows whatever arrives first (reviewed fallback on a cold
 * start), then, if that fallback was only because the model was still starting, asks once more when the model
 * reports `ready` and shows the AI text if this event is still open. Returns a cancel function.
 */
export function narrateEvent(req: ScenarioAIRequest, runId: string, key: string, currentKey: () => string | null,
  onContent: (c: ScenarioContent) => void): () => void {
  let live = true;
  let unsubscribe: (() => void) | null = null;
  const stopListening = () => { unsubscribe?.(); unsubscribe = null; };
  const retry = () => {
    stopListening();
    if (!live || currentKey() !== key) return;
    void scenarioForCurrentEvent(req, runId, key, currentKey).then((c) => { if (live && c?.source === 'ai') onContent(c); });
  };
  void scenarioForCurrentEvent(req, runId, key, currentKey).then((c) => {
    if (!live || !c) return;
    onContent(c);
    const ai = bridge()?.ai;
    if (!ai || c.source !== 'fallback' || c.fallbackReason !== RETRY_WHEN_READY) return;
    unsubscribe = ai.onStatus((s) => { if (s === 'ready') retry(); else if (s === 'unavailable' || s === 'stopped') stopListening(); });
    void ai.status().then((s) => { if (s === 'ready' && unsubscribe) retry(); }, () => {}); // became ready meanwhile
  });
  return () => { live = false; stopListening(); };
}

export function clearScenarioCache() { cache.clear(); }

const narrations = new Map<string, Promise<DebriefNarration & { source: 'ai' | 'fallback' }>>();

/** One narration per run: re-renders of the debrief never ask the model again or change the text. */
export function narrateDebriefOnce(ev: DebriefEvaluation, state: GameState) {
  let p = narrations.get(state.runId);
  if (!p) { p = narrateDebriefSafe(ev, state); narrations.set(state.runId, p); }
  return p;
}
export function resetNarrationMemo() { narrations.clear(); }

/** Debrief narration (AI-worded, validated in main) or the reviewed fallback; never rejects. */
export async function narrateDebriefSafe(ev: DebriefEvaluation, state: GameState): Promise<DebriefNarration & { source: 'ai' | 'fallback' }> {
  const ai = bridge()?.ai;
  if (ai) { try { return await ai.narrateDebrief(ev, buildDebriefRequest(ev, state)); } catch { /* reviewed text below */ } }
  return { ...fallbackDebriefNarration(ev), source: 'fallback' };
}

/** Optional atmospheric variation; null (keep the deterministic directive) on any failure or without a bridge. */
export async function requestSceneSuggestion(req: SceneAIRequest, runId: string): Promise<SceneAISuggestion | null> {
  const ai = bridge()?.ai;
  if (!ai) return null;
  try { return await ai.suggestScene(req, runId); } catch { return null; }
}

let status: AiStatus = bridge() ? 'starting' : 'unavailable';
const statusListeners = new Set<(s: AiStatus) => void>();
const setStatus = (s: AiStatus) => { status = s; for (const l of statusListeners) l(s); };
const b = bridge();
if (b) { b.ai.status().then(setStatus).catch(() => setStatus('unavailable')); b.ai.onStatus(setStatus); }

export const getAiStatus = () => status;
export function onAiStatus(cb: (s: AiStatus) => void) { statusListeners.add(cb); return () => { statusListeners.delete(cb); }; }
