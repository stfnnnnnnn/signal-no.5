// The renderer's only door to local AI (window.signal.ai). Always resolves; gameplay never waits on it.
import { fallbackFromRequest } from '../../core/ai/scenario';
import type { AiStatus } from '../../shared/bridge';
import type { ScenarioAIRequest, ScenarioContent } from '../../shared/contracts/ai';

const cache = new Map<string, Promise<ScenarioContent>>();
const bridge = () => (typeof window !== 'undefined' ? window.signal : undefined);

/** AI text for one event occurrence (`key` = eventId@triggeredAtMinute); one model call per key, fallback on any failure. */
export function requestScenario(req: ScenarioAIRequest, runId: string, key: string): Promise<ScenarioContent> {
  const k = `${runId}:${key}`;
  let p = cache.get(k);
  if (!p) {
    const ai = bridge()?.ai;
    p = ai ? ai.generateScenario(req, runId).catch(() => fallbackFromRequest(req, 'bridge-error'))
      : Promise.resolve(fallbackFromRequest(req, 'no-bridge'));
    cache.set(k, p);
  }
  return p;
}

/** Like requestScenario, but resolves null when the active event changed while the model was generating (stale text). */
export async function scenarioForCurrentEvent(req: ScenarioAIRequest, runId: string, key: string, currentKey: () => string | null): Promise<ScenarioContent | null> {
  const c = await requestScenario(req, runId, key);
  return currentKey() === key ? c : null;
}

export function clearScenarioCache() { cache.clear(); }

let status: AiStatus = bridge() ? 'starting' : 'unavailable';
const statusListeners = new Set<(s: AiStatus) => void>();
const setStatus = (s: AiStatus) => { status = s; for (const l of statusListeners) l(s); };
const b = bridge();
if (b) { b.ai.status().then(setStatus).catch(() => setStatus('unavailable')); b.ai.onStatus(setStatus); }

export const getAiStatus = () => status;
export function onAiStatus(cb: (s: AiStatus) => void) { statusListeners.add(cb); return () => { statusListeners.delete(cb); }; }
