// Local-model adapter (main process). Pure Node: fetch to llama-server, constrained decoding, validation,
// bounded retry, timeout, per-run cache and a single in-flight request. Never mutates game state.
import { buildDebriefMessages, buildPromptMessages, type ChatMessage } from '../../core/ai/prompts';
import { debriefJsonSchema, fallbackDebriefNarration, validateDebriefNarration } from '../../core/ai/debrief';
import { fallbackFromRequest, scenarioResponseJsonSchema, validateScenarioResponse } from '../../core/ai/scenario';
import type { DebriefNarrationRequest, ScenarioAIRequest, ScenarioContent } from '../../shared/contracts/ai';
import type { DebriefEvaluation, DebriefNarration } from '../../shared/contracts/debrief';

export interface AIServiceOptions {
  /** Current endpoint, or null when the model server is not ready. */
  endpoint: () => { baseUrl: string; apiKey: string } | null;
  timeoutMs?: number;
  retries?: number;
  maxTokens?: number;
  temperature?: number;
}

export type NarrationOut = DebriefNarration & { source: 'ai' | 'fallback'; fallbackReason: string | null };

export class AIService {
  private readonly o: Required<Omit<AIServiceOptions, 'endpoint'>> & Pick<AIServiceOptions, 'endpoint'>;
  private cache = new Map<string, ScenarioContent>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(opts: AIServiceOptions) {
    this.o = { timeoutMs: 12_000, retries: 1, maxTokens: 220, temperature: 0.7, ...opts };
  }

  /** One request at a time (llama-server runs with a single slot). */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async chat(messages: ChatMessage[], schema: unknown, maxTokens: number): Promise<string> {
    const ep = this.o.endpoint();
    if (!ep) throw new Error('model-unavailable');
    const r = await fetch(`${ep.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(this.o.timeoutMs),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
      body: JSON.stringify({
        messages, temperature: this.o.temperature, top_p: 0.8, top_k: 20, max_tokens: maxTokens, cache_prompt: true,
        ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: 'response', schema } } } : {}),
      }),
    });
    if (!r.ok) throw new Error(`http-${r.status}`);
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? '';
  }

  generateScenario(req: ScenarioAIRequest, runId: string): Promise<ScenarioContent> {
    const key = `${runId}:${req.eventId}:${req.allowedVariantIds[0]}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    return this.serial(async () => {
      if (!this.o.endpoint()) return fallbackFromRequest(req, 'model-unavailable');
      let reason = 'unknown';
      for (let attempt = 0; attempt <= this.o.retries; attempt++) {
        try {
          const raw = await this.chat(buildPromptMessages(req), scenarioResponseJsonSchema(req), this.o.maxTokens);
          const v = validateScenarioResponse(req, raw);
          if (v.ok) { this.cache.set(key, v.content); return v.content; }
          reason = `${v.reason}:${v.detail}`.slice(0, 200);
        } catch (e) {
          reason = e instanceof Error ? (e.name === 'TimeoutError' || e.name === 'AbortError' ? 'timeout' : e.message) : String(e);
          if (reason === 'timeout' || reason === 'model-unavailable') break; // don't stack another full timeout
        }
      }
      return fallbackFromRequest(req, reason);
    });
  }

  narrateDebrief(ev: DebriefEvaluation, req: DebriefNarrationRequest): Promise<NarrationOut> {
    return this.serial(async () => {
      let reason = 'model-unavailable';
      if (this.o.endpoint()) {
        try {
          const raw = await this.chat(buildDebriefMessages(req), debriefJsonSchema(ev), 160);
          const v = validateDebriefNarration(ev, raw);
          if (v.ok) return { ...v.narration, source: 'ai' as const, fallbackReason: null };
          reason = v.reason;
        } catch (e) { reason = e instanceof Error ? e.message : String(e); }
      }
      return { ...fallbackDebriefNarration(ev), source: 'fallback' as const, fallbackReason: reason };
    });
  }

  /** One tiny request during the loading screen absorbs the first-request warm-up (measured ~20 s once). */
  warmUp(): Promise<{ ok: boolean; ms: number; error?: string }> {
    return this.serial(async () => {
      const t0 = Date.now();
      try {
        await this.chat([{ role: 'user', content: 'Reply with OK.' }], null, 4);
        return { ok: true, ms: Date.now() - t0 };
      } catch (e) { return { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) }; }
    });
  }

  clearCache(runId?: string) {
    if (!runId) { this.cache.clear(); return; }
    for (const k of this.cache.keys()) if (k.startsWith(`${runId}:`)) this.cache.delete(k);
  }
}
