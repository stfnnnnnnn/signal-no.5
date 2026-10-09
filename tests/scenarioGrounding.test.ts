// AI narration must not contradict the deterministic scenario: structure of the home, hazards, location and timing.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createGame, type GameEngine } from '../src/core/engine';
import { buildScenarioRequest, validateScenarioResponse } from '../src/core/ai/scenario';
import { buildDebriefRequest, validateDebriefNarration } from '../src/core/ai/debrief';
import { buildPromptMessages } from '../src/core/ai/prompts';
import { evaluateRun } from '../src/core/evaluation/evaluate';
import { AIService } from '../src/main/ai/aiService';
import type { ScenarioAIRequest } from '../src/shared/contracts/ai';
import { customFamily } from './fixtures/onboarding';
import { advanceTo, playToEnd } from './helpers';

function game(): GameEngine {
  const r = createGame({ ...customFamily(), q1Housing: 'singleStory' }, { seed: 7 });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.engine;
}
const atStart = () => buildScenarioRequest(game().getState())!;
type Facts = Partial<ScenarioAIRequest['state']>;
const withState = (req: ScenarioAIRequest, f: Facts): ScenarioAIRequest => ({ ...req, state: { ...req.state, ...f } });
const reply = (req: ScenarioAIRequest, dialogue: string, description = 'Rain taps on the roof.') => JSON.stringify({
  schemaVersion: 1, eventId: req.eventId, variantId: req.allowedVariantIds[0], speaker: req.allowedSpeakers[0], dialogue, description, actionIds: req.allowedActionIds });
const verdict = (req: ScenarioAIRequest, dialogue: string, description?: string) => {
  const v = validateScenarioResponse(req, reply(req, dialogue, description));
  return v.ok ? 'ok' : `${v.reason}:${v.detail}`;
};

describe('the request only discloses what the player may know', () => {
  it('hides the landfall countdown until the engine reveals it', () => {
    const e = game();
    const opening = e.getState().activeEvent;
    const early = buildScenarioRequest(e.getState())!;
    expect(early.state.landfallRevealed).toBe(false);
    expect(early.state.hoursToLandfall).toBeNull();
    advanceTo(e, 24 * 60 + 30);                       // past the H24 update that reveals landfall
    const s = e.getState();
    expect(s.environment.landfallRevealed).toBe(true);
    const later = buildScenarioRequest({ ...s, activeEvent: opening })!; // any open event; only the state facts matter here
    expect(later.state.landfallRevealed).toBe(true);
    expect(later.state.hoursToLandfall).toBe(Math.round((s.landfallMinute - s.clock.gameMinutes) / 60));
  });
  it('carries flood severity and household location from the engine', () => {
    const r = atStart();
    expect(r.state.floodSeverity).toBe('none');
    expect(r.state.location).toBe('home');
  });
  it('tells the model the grounding rules', () => {
    const system = buildPromptMessages(atStart())[0]!.content;
    expect(system).toMatch(/hoursToLandfall is null/);
    expect(system).toMatch(/storm surge/i);
    expect(system).toMatch(/basement/i);
  });
});

describe('structural grounding', () => {
  const req = atStart();
  it('rejects a basement, attic or rooftop in the player’s home', () => {
    expect(verdict(req, 'Water may enter through the front door or basement.')).toBe('ungrounded:structure:basement');
    expect(verdict(req, 'Let’s store the bags in our attic.')).toBe('ungrounded:structure:attic');
    expect(verdict(req, 'We can wait on the rooftop if needed.')).toBe('ungrounded:structure:rooftop');
  });
  it('rejects extra floors for a single-story house (existing housing check still applies)', () => {
    expect(verdict(req, 'Carry the documents to the second floor.')).toBe('ungrounded:housing:floors');
  });
  it('allows another building’s basement and generic descriptions', () => {
    expect(verdict(req, 'The neighbour’s basement down the road flooded last year.')).toBe('ok');
    expect(verdict(req, 'The house sits low near the river; let’s keep an eye on the yard.')).toBe('ok');
  });
});

describe('hazard grounding', () => {
  const req = atStart();
  it('rejects storm surge claims about the household, allows general education', () => {
    expect(verdict(req, 'Storm surge may reach the first floor soon.')).toBe('ungrounded:hazard:storm-surge');
    expect(verdict(req, 'Rain is getting heavier.', 'Storm surge could flood our street.')).toBe('ungrounded:hazard:storm-surge');
    expect(verdict(req, 'Storm surge is a danger mainly for coastal towns, and learning about it helps.')).toBe('ok');
  });
  it('rejects indoor flooding before the engine reports any flood', () => {
    expect(verdict(req, 'Water is already inside the house.')).toBe('ungrounded:hazard:flooding');
    expect(verdict(req, 'The living room is flooded.')).toBe('ungrounded:hazard:flooding');
    expect(verdict(req, 'Water could rise quickly if the rain keeps up.')).toBe('ok');
  });
  it('allows flood descriptions once the engine reports flooding', () => {
    expect(verdict(withState(req, { floodSeverity: 'moderate' }), 'Water is already inside the house.')).toBe('ok');
  });
  it('rejects a power outage while electricity is available', () => {
    expect(verdict(req, 'The power is out, so we only have the phone light.')).toBe('ungrounded:hazard:power');
    expect(verdict(withState(req, { powerAvailable: false }), 'The power is out, so we only have the phone light.')).toBe('ok');
  });
  it('rejects claims that the household is trapped', () => {
    expect(verdict(req, 'We are trapped in the house by the water.')).toBe('ungrounded:hazard:trapped');
  });
  it('rejects describing the household at home once it has left', () => {
    expect(verdict(withState(req, { location: 'inTransit' }), 'We are still at home, watching the rain.')).toBe('ungrounded:location:inTransit');
    expect(verdict(withState(req, { location: 'evacuationCenter' }), 'Everyone is inside the house now.')).toBe('ungrounded:location:evacuationCenter');
    expect(verdict(req, 'We are at home, watching the rain.')).toBe('ok');
  });
});

describe('temporal grounding', () => {
  const hidden = atStart();
  it('rejects an invented landfall countdown while timing is hidden', () => {
    expect(verdict(hidden, 'The typhoon is coming in 40 hours.')).toBe('ungrounded:timing:hidden');
    expect(verdict(hidden, 'Water could rise in the next 48 hours.')).toBe('ungrounded:timing:hidden');
    expect(verdict(hidden, 'Landfall is in two days.')).toBe('ungrounded:timing:hidden');
  });
  it('allows non-specific timing', () => {
    expect(verdict(hidden, 'Conditions are expected to worsen; let’s get ready.')).toBe('ok');
  });
  it('once revealed, allows the true countdown and rejects a contradictory one', () => {
    const revealed = withState(hidden, { landfallRevealed: true, hoursToLandfall: 24 });
    expect(verdict(revealed, 'Landfall is about 24 hours away.')).toBe('ok');
    expect(verdict(revealed, 'Landfall is about 6 hours away.')).toBe('ungrounded:timing:contradiction');
  });
  it('rejects describing landfall as already happening before it has', () => {
    expect(verdict(hidden, 'The typhoon has made landfall over the town.')).toBe('ungrounded:timing:future-phase');
    expect(verdict(withState(hidden, { landfallRevealed: true, hoursToLandfall: 0 }), 'The rain grows heavier.')).toBe('ok');
  });
  it('NPC dialogue is checked like narration', () => {
    expect(verdict({ ...hidden, allowedSpeakers: ['NPC_M2'] }, 'Lola says the storm hits in 30 hours.')).toBe('ungrounded:timing:hidden');
  });
});

describe('debrief narration grounding', () => {
  const e = game();
  playToEnd(e);
  const ev = evaluateRun(e.getState());
  const req = buildDebriefRequest(ev, e.getState());
  const narr = (summary: string) => JSON.stringify({ summary, highlightFindingIds: [] });
  it('rejects invented structure and surge, accepts a grounded summary', () => {
    expect(validateDebriefNarration(ev, narr('You moved supplies to the basement in time.'), req.home)).toEqual({ ok: false, reason: 'ungrounded:structure:basement' });
    expect(validateDebriefNarration(ev, narr('You stayed calm when the storm surge reached your street.'), req.home)).toEqual({ ok: false, reason: 'ungrounded:hazard:storm-surge' });
    expect(validateDebriefNarration(ev, narr('You checked updates and kept everyone safe at home.'), req.home).ok).toBe(true);
  });
});

describe('fallback after a grounding rejection (real HTTP, fake model)', () => {
  let server: http.Server | null = null;
  afterEach(async () => { await new Promise<void>((r) => (server ? server.close(() => r()) : r())); server = null; });
  it('returns reviewed text with the exact action IDs', async () => {
    const req = atStart();
    server = http.createServer((_q, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: reply(req, 'The typhoon is coming in 40 hours.') } }] }));
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const ai = new AIService({ endpoint: () => ({ baseUrl: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, apiKey: 'k' }), timeoutMs: 2000, retries: 0 });
    const c = await ai.generateScenario(req, 'run-g');
    expect(c.source).toBe('fallback');
    expect(c.fallbackReason).toMatch(/timing:hidden/);
    expect(c.actionIds).toEqual(req.allowedActionIds);
  });
});
