import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { AIService } from '../../src/main/ai/aiService';
import { buildScenarioRequest } from '../../src/core/ai/scenario';
import { evaluateRun } from '../../src/core/evaluation/evaluate';
import { buildDebriefRequest } from '../../src/core/ai/debrief';
import { buildSceneAIRequest } from '../../src/core/scene/directive';
import type { ScenarioAIRequest } from '../../src/shared/contracts/ai';
import { aloneSurvey } from '../fixtures/households';
import { newGame, playToEnd } from '../helpers';

type Handler = (body: any, n: number) => { status?: number; delayMs?: number; content?: string };
let server: http.Server | null = null;
async function fakeModel(handler: Handler): Promise<{ url: string; calls: () => number; bodies: any[] }> {
  let n = 0; const bodies: any[] = [];
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      n++;
      const body = JSON.parse(raw || '{}'); bodies.push(body);
      const h = handler(body, n);
      setTimeout(() => {
        if (res.destroyed) return;
        res.writeHead(h.status ?? 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: h.content ?? '' } }], timings: { predicted_n: 50 } }));
      }, h.delayMs ?? 0);
    });
  });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, calls: () => n, bodies };
}
afterEach(async () => { await new Promise<void>((r) => (server ? server.close(() => r()) : r())); server = null; });

const req: ScenarioAIRequest = buildScenarioRequest(newGame(aloneSurvey()).getState())!;
const valid = (r: ScenarioAIRequest, dialogue = 'Let’s look at the bulletin together.') => JSON.stringify({
  schemaVersion: 1, eventId: r.eventId, variantId: r.allowedVariantIds[0], speaker: r.allowedSpeakers[0], dialogue,
  description: 'The television flickers in the living room.', actionIds: r.allowedActionIds });
const svc = (url: string | null, opts: Partial<ConstructorParameters<typeof AIService>[0]> = {}) =>
  new AIService({ endpoint: () => (url ? { baseUrl: url, apiKey: 'k' } : null), timeoutMs: 500, retries: 1, ...opts });

describe('AIService scenario generation', () => {
  it('returns validated AI content', async () => {
    const m = await fakeModel(() => ({ content: valid(req) }));
    const out = await svc(m.url).generateScenario(req, 'run1');
    expect(out.source).toBe('ai');
    expect(out.actionIds).toEqual(req.allowedActionIds);
  });

  it('sends the constrained-decoding schema, token cap and API key', async () => {
    const m = await fakeModel(() => ({ content: valid(req) }));
    await svc(m.url, { maxTokens: 220 }).generateScenario(req, 'run1');
    const b = m.bodies[0];
    expect(b.response_format.type).toBe('json_schema');
    expect(b.response_format.json_schema.schema.properties.variantId.const).toBe(req.allowedVariantIds[0]);
    expect(b.max_tokens).toBe(220);
  });

  it('retries once on invalid output, then falls back to reviewed text', async () => {
    const m = await fakeModel(() => ({ content: '{"not":"valid"' }));
    const out = await svc(m.url).generateScenario(req, 'run1');
    expect(m.calls()).toBe(2);
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toMatch(/invalid-json/);
    expect(out.actionIds).toEqual(req.allowedActionIds);
  });

  it('falls back on ungrounded content', async () => {
    const m = await fakeModel(() => ({ content: valid(req, 'The advisory says to head to the community center.') }));
    const out = await svc(m.url).generateScenario(req, 'run1');
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toMatch(/ungrounded/);
  });

  it('falls back on timeout without waiting for the slow model', async () => {
    const m = await fakeModel(() => ({ content: valid(req), delayMs: 3000 }));
    const t0 = Date.now();
    const out = await svc(m.url, { timeoutMs: 200, retries: 0 }).generateScenario(req, 'run1');
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toMatch(/timeout|abort/i);
  });

  it('falls back immediately when the model server is unavailable', async () => {
    const out = await svc(null).generateScenario(req, 'run1');
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toBe('model-unavailable');
  });

  it('falls back on HTTP errors', async () => {
    const m = await fakeModel(() => ({ status: 500, content: '' }));
    const out = await svc(m.url).generateScenario(req, 'run1');
    expect(out.source).toBe('fallback');
  });

  it('caches generated content per run, event and variant', async () => {
    const m = await fakeModel(() => ({ content: valid(req) }));
    const s = svc(m.url);
    await s.generateScenario(req, 'run1');
    await s.generateScenario(req, 'run1');
    expect(m.calls()).toBe(1);
    await s.generateScenario(req, 'run2');
    expect(m.calls()).toBe(2);
  });

  it('serialises requests (one model slot)', async () => {
    let inFlight = 0; let maxInFlight = 0;
    const m = await fakeModel(() => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); setTimeout(() => inFlight--, 50); return { content: valid(req), delayMs: 50 }; });
    const s = svc(m.url, { timeoutMs: 2000 });
    await Promise.all(['a', 'b', 'c'].map((run) => s.generateScenario(req, run)));
    expect(maxInFlight).toBe(1);
    expect(m.calls()).toBe(3);
  });
});

describe('AIService debrief narration', () => {
  const st = playToEnd(newGame(aloneSurvey()), ['DEFER', 'FINISH_REFLECTION']);
  const ev = evaluateRun(st);
  const dreq = buildDebriefRequest(ev, st);

  it('returns validated narration', async () => {
    const m = await fakeModel(() => ({ content: JSON.stringify({ summary: 'You learned a lot during this storm.', highlightFindingIds: ev.gaps.slice(0, 1) }) }));
    const out = await svc(m.url).narrateDebrief(ev, dreq);
    expect(out.source).toBe('ai');
  });

  it('falls back to the deterministic summary on invalid narration', async () => {
    const m = await fakeModel(() => ({ content: JSON.stringify({ summary: 'Call 0917 123 4567.', highlightFindingIds: [] }) }));
    const out = await svc(m.url).narrateDebrief(ev, dreq);
    expect(out.source).toBe('fallback');
    expect(out.summary).toContain(String(ev.score));
  });
});

describe('AIService scene suggestions', () => {
  const st = newGame(aloneSurvey()).getState();
  const sreq = buildSceneAIRequest(st);

  it('returns a validated suggestion and sends a constrained schema', async () => {
    const m = await fakeModel(() => ({ content: JSON.stringify({ basisKey: sreq.basisKey, mood: sreq.allowed.moods[0], extraEffects: sreq.allowed.extraEffects.slice(0, 1) }) }));
    const out = await svc(m.url).suggestScene(sreq, 'run1');
    expect(out).not.toBeNull();
    expect(out!.basisKey).toBe(sreq.basisKey);
    const schema = m.bodies[0].response_format.json_schema.schema;
    expect(schema.properties.basisKey.const).toBe(sreq.basisKey);
    expect(schema.properties.mood.enum).toEqual(sreq.allowed.moods);
  });

  it('returns null (deterministic fallback) for a suggestion that contradicts the state', async () => {
    const m = await fakeModel(() => ({ content: JSON.stringify({ basisKey: sreq.basisKey, lighting: 'outageDark' }) })); // power is on
    expect(await svc(m.url, { retries: 0 }).suggestScene(sreq, 'run1')).toBeNull();
  });

  it('returns null without a model and never throws', async () => {
    expect(await svc(null).suggestScene(sreq, 'run1')).toBeNull();
  });
});

describe('AIService warm-up', () => {
  it('sends one short request and reports success and duration', async () => {
    const m = await fakeModel(() => ({ content: 'ok' }));
    const r = await svc(m.url).warmUp();
    expect(r.ok).toBe(true);
    expect(m.bodies[0].max_tokens).toBeLessThanOrEqual(8);
  });
});
