// Debrief narration must not contradict the engine's evaluation (score, ending, findings, wellbeing, outcome).
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createGame } from '../src/core/engine';
import { buildDebriefRequest, validateDebriefNarration } from '../src/core/ai/debrief';
import { AIService } from '../src/main/ai/aiService';
import type { DebriefEvaluation } from '../src/shared/contracts/debrief';
import { customFamily } from './fixtures/onboarding';
import { playToEnd } from './helpers';

function evaluation(): DebriefEvaluation {
  const r = createGame(customFamily(), { seed: 7 });
  if (!r.ok) throw new Error('game');
  playToEnd(r.engine);
  return r.engine.evaluate();
}
/** A fixed evaluation: score 47 (Nahirapan), communication + water are gaps, family meeting a strength, stayed home. */
const base = evaluation();
const ev: DebriefEvaluation = {
  ...base, score: 47, ending: 'nahirapan',
  strengths: ['F_FAMILY_MEETING', 'F_BULLETIN'], gaps: ['F_COMMUNICATION', 'F_WATER', 'F_GO_BAG'],
  handa: { ...base.handa, earned: false, wellbeingPercent: 85 },
  timeline: base.timeline.filter((t) => t.actionId !== 'FOLLOW_EVACUATION'),
};
const say = (summary: string, e: DebriefEvaluation = ev) => {
  const v = validateDebriefNarration(e, JSON.stringify({ summary, highlightFindingIds: [] }));
  return v.ok ? 'ok' : v.reason;
};

describe('debrief narration contradictions are rejected', () => {
  it('claims a gap as done (the real run-A sentence)', () => {
    expect(say('You stayed calm and checked updates. Plan includes evacuation readiness and family communication.')).toBe('ungrounded:debrief:gap:F_COMMUNICATION');
    expect(say('You stored plenty of drinking water for everyone.')).toBe('ungrounded:debrief:gap:F_WATER');
  });
  it('states the wrong score or ending', () => {
    expect(say('You finished with a preparedness score of 82.')).toBe('ungrounded:debrief:score');
    expect(say('A strong Nakaraos result for your household.')).toBe('ungrounded:debrief:ending');
  });
  it('claims the Handa badge or full wellbeing when the engine says otherwise', () => {
    expect(say('You earned the Handa badge this time.')).toBe('ungrounded:debrief:handa');
    expect(say('Your wellbeing stayed perfect throughout.')).toBe('ungrounded:debrief:wellbeing');
    expect(say('Your wellbeing ended at 100%.')).toBe('ungrounded:debrief:wellbeing');
  });
  it('describes the wrong household outcome', () => {
    expect(say('You evacuated early and reached the evacuation center safely.')).toBe('ungrounded:debrief:outcome');
    const left: DebriefEvaluation = { ...ev, timeline: [...ev.timeline, { seq: 99, atMinute: 2000, eventId: 'EV08', actionId: 'FOLLOW_EVACUATION', label: 'Leave' }] };
    expect(say('You stayed home and sheltered through the storm.', left)).toBe('ungrounded:debrief:outcome');
  });
});

describe('valid personalised narration passes', () => {
  it.each([
    'You stayed calm and checked official updates early, and your household agreed on a plan.',
    'Your score was 47, a Nahirapan result. Next time, set a communication plan and store more drinking water.',
    'Remember to keep enough drinking water and a packed go-bag ready before the next storm.',
    'Your wellbeing ended at 85%, right at the Handa threshold.',
    'You sheltered at home and kept everyone together.',
    'Agreeing on contacts and a meeting point helps every household; make sure yours does next time.',
  ])('%s', (text) => expect(say(text)).toBe('ok'));
});

describe('the request carries the facts; contradictions fall back to reviewed text', () => {
  let server: http.Server | null = null;
  afterEach(async () => { await new Promise<void>((r) => (server ? server.close(() => r()) : r())); server = null; });
  it('fallback narration when the model contradicts the gaps', async () => {
    server = http.createServer((_q, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'You set a communication plan and stored water.', highlightFindingIds: [] }) } }] }));
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const ai = new AIService({ endpoint: () => ({ baseUrl: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, apiKey: 'k' }), timeoutMs: 2000, retries: 0 });
    const r = createGame(customFamily(), { seed: 7 }); if (!r.ok) throw 0; playToEnd(r.engine);
    const n = await ai.narrateDebrief(ev, buildDebriefRequest(ev, r.engine.getState()));
    expect(n.source).toBe('fallback');
    expect(n.fallbackReason).toMatch(/debrief:gap/);
  });
});
