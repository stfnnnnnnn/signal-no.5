// AI text must describe the player's home as the household profile says (onboarding Q1: single/two/multi-story house).
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createGame } from '../src/core/engine';
import { buildScenarioRequest, validateScenarioResponse } from '../src/core/ai/scenario';
import { buildDebriefRequest, validateDebriefNarration } from '../src/core/ai/debrief';
import { buildPromptMessages } from '../src/core/ai/prompts';
import { checkHousing, describeHome } from '../src/core/ai/guard';
import { evaluateRun } from '../src/core/evaluation/evaluate';
import { AIService } from '../src/main/ai/aiService';
import type { ScenarioAIRequest } from '../src/shared/contracts/ai';
import { customFamily } from './fixtures/onboarding';
import { playToEnd } from './helpers';

type Q1 = 'singleStory' | 'twoStory' | 'multiStory';
function game(q1: Q1) {
  const r = createGame({ ...customFamily(), q1Housing: q1 }, { seed: 7 });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.engine;
}
const requestFor = (q1: Q1) => buildScenarioRequest(game(q1).getState())!;
const reply = (req: ScenarioAIRequest, dialogue: string, description = 'Rain taps on the roof.') => JSON.stringify({
  schemaVersion: 1, eventId: req.eventId, variantId: req.allowedVariantIds[0], speaker: req.allowedSpeakers[0], dialogue, description, actionIds: req.allowedActionIds });
const verdict = (req: ScenarioAIRequest, dialogue: string, description?: string) => {
  const v = validateScenarioResponse(req, reply(req, dialogue, description));
  return v.ok ? 'ok' : `${v.reason}:${v.detail}`;
};

describe('the AI request describes the home in plain words', () => {
  it.each([['singleStory', 'single-story house', 1], ['twoStory', 'two-story house', 2], ['multiStory', 'multi-story house', 3]] as const)(
    '%s → "%s"', (q1, description, floors) => {
      const r = requestFor(q1);
      expect(r.household.homeDescription).toBe(description);
      expect(r.household.floors).toBe(floors);
    });
  it('tells the model to use only that description', () => {
    const system = buildPromptMessages(requestFor('singleStory'))[0]!.content;
    expect(system).toMatch(/homeDescription/);
    expect(system).toMatch(/apartment/i);
  });
});

describe('scenario validation rejects contradictory housing', () => {
  const single = requestFor('singleStory');
  it('accepts a correct single-story description and a generic "home"', () => {
    expect(verdict(single, 'Our single-story house sits low; let’s keep an eye on the yard.')).toBe('ok');
    expect(verdict(single, 'Let’s make sure everyone at home is ready.')).toBe('ok');
  });
  it('rejects "your apartment" for a single-story house (dialogue)', () => {
    expect(verdict(single, 'Your apartment is on a flood-prone street.')).toBe('ungrounded:housing:apartment');
  });
  it('rejects a townhouse description in the narration (description field)', () => {
    expect(verdict(single, 'Rain is getting heavier.', 'Water pools outside the townhouse door.')).toBe('ungrounded:housing:townhouse');
  });
  it('rejects condominium and upstairs talk for a one-floor home', () => {
    expect(verdict(single, 'The condo hallway is dark.')).toBe('ungrounded:housing:condominium');
    expect(verdict(single, 'Let’s carry the bags upstairs.')).toBe('ungrounded:housing:floors');
  });
  it('allows unrelated mentions that are not the player’s home', () => {
    expect(verdict(single, 'A neighbour in the apartment block nearby waved from a window.')).toBe('ok');
  });
  it('accepts correct two-story and multi-story descriptions and rejects a wrong floor count', () => {
    const two = requestFor('twoStory'), multi = requestFor('multiStory');
    expect(verdict(two, 'Let’s move the documents upstairs in our two-story house.')).toBe('ok');
    expect(verdict(two, 'Our single-story home could flood fast.')).toBe('ungrounded:housing:floors');
    expect(verdict(multi, 'The multi-story house has room on the upper floors.')).toBe('ok');
    expect(verdict(multi, 'Our bungalow is close to the creek.')).toBe('ungrounded:housing:floors');
  });
  it('still respects a legacy apartment household (its own type is not a contradiction)', () => {
    expect(checkHousing('Your apartment is on the second floor.', { type: 'apartment', floors: 2 })).toBeNull();
    expect(checkHousing('Your townhouse is on the second floor.', { type: 'apartment', floors: 2 })).toBe('housing:townhouse');
  });
  it('describes every supported home', () => {
    expect([1, 2, 3].map((floors) => describeHome({ type: 'detached', floors }))).toEqual(['single-story house', 'two-story house', 'multi-story house']);
  });
});

describe('debrief narration rejects contradictory housing', () => {
  const e = game('singleStory');
  playToEnd(e);
  const ev = evaluateRun(e.getState());
  const req = buildDebriefRequest(ev, e.getState());
  const narr = (summary: string) => JSON.stringify({ summary, highlightFindingIds: [] });
  it('carries the home facts', () => expect(req.home).toEqual({ type: 'detached', floors: 1, description: 'single-story house' }));
  it('rejects an apartment, accepts the house', () => {
    expect(validateDebriefNarration(ev, narr('You kept your apartment ready for the storm.'), req.home)).toEqual({ ok: false, reason: 'ungrounded:housing:apartment' });
    expect(validateDebriefNarration(ev, narr('You kept your single-story home ready for the storm.'), req.home).ok).toBe(true);
  });
});

describe('fallback after a housing rejection (real HTTP, fake model)', () => {
  let server: http.Server | null = null;
  afterEach(async () => { await new Promise<void>((r) => (server ? server.close(() => r()) : r())); server = null; });
  it('returns reviewed text with the exact action IDs when the model calls a house an apartment', async () => {
    const req = requestFor('singleStory');
    server = http.createServer((_q, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: reply(req, 'Your apartment may flood.') } }] }));
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const ai = new AIService({ endpoint: () => ({ baseUrl: url, apiKey: 'k' }), timeoutMs: 2000, retries: 0 });
    const c = await ai.generateScenario(req, 'run-h');
    expect(c.source).toBe('fallback');
    expect(c.fallbackReason).toMatch(/housing:apartment/);
    expect(c.actionIds).toEqual(req.allowedActionIds);
  });
});
