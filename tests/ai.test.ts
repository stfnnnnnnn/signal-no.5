import { describe, expect, it } from 'vitest';
import { buildScenarioRequest, fallbackContent, scenarioResponseJsonSchema, validateScenarioResponse } from '../src/core/ai/scenario';
import { buildPromptMessages } from '../src/core/ai/prompts';
import { buildDebriefRequest, fallbackDebriefNarration, validateDebriefNarration } from '../src/core/ai/debrief';
import { evaluateRun } from '../src/core/evaluation/evaluate';
import { ScenarioAIRequest, type ScenarioAIRequest as Req } from '../src/shared/contracts/ai';
import type { GameEngine } from '../src/core/engine';
import { aloneSurvey, familySurvey } from './fixtures/households';
import { newGame, playToEnd } from './helpers';

function reqFor(e: GameEngine): Req {
  const r = buildScenarioRequest(e.getState());
  if (!r) throw new Error('no active event');
  return r;
}
function good(req: Req, over: Record<string, unknown> = {}) {
  return JSON.stringify({ schemaVersion: 1, eventId: req.eventId, variantId: req.allowedVariantIds[0], speaker: req.allowedSpeakers[0],
    dialogue: 'Let’s look at what the bulletin says together.', description: 'The television flickers in the living room.', actionIds: req.allowedActionIds, ...over });
}

describe('scenario request (context builder)', () => {
  it('is built from the active event with the engine variant and exact actions', () => {
    const e = newGame();
    const req = reqFor(e);
    const ev = e.getState().activeEvent!;
    expect(ScenarioAIRequest.safeParse(req).success).toBe(true);
    expect(req.eventId).toBe(ev.eventId);
    expect(req.allowedVariantIds).toEqual([ev.variantId]);
    expect(req.allowedActionIds).toEqual(ev.actionIds);
    expect(req.facts.length).toBeGreaterThan(0);
  });

  it('returns null when there is no active event', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    expect(buildScenarioRequest(e.getState())).toBeNull();
  });

  it('minimises sensitive household data', () => {
    const json = JSON.stringify(reqFor(newGame(familySurvey())));
    expect(json).not.toMatch(/cardiovascular|medical|condition|female|male/i);
  });

  it('lists available and unavailable items from the actual inventory', () => {
    const req = reqFor(newGame(aloneSurvey()));
    expect(req.state.availableItems).toContain('Flashlight');
    expect(req.state.unavailableItems).toContain('Tools');
  });

  it('differs between contrasting households for the same event', () => {
    const a = reqFor(newGame(aloneSurvey()));
    const b = reqFor(newGame(familySurvey()));
    expect(a.household.livesAlone).toBe(true);
    expect(b.household.livesAlone).toBe(false);
    expect(a.allowedVariantIds).not.toEqual(b.allowedVariantIds);
  });
});

describe('constrained decoding schema', () => {
  it('pins the variant and the exact action tuple without boolean "items"', () => {
    const req = reqFor(newGame());
    const js = scenarioResponseJsonSchema(req) as { properties: Record<string, Record<string, unknown>> };
    expect(js.properties.variantId!.const).toBe(req.allowedVariantIds[0]);
    expect((js.properties.actionIds!.prefixItems as unknown[]).length).toBe(req.allowedActionIds.length);
    expect(JSON.stringify(js)).not.toMatch(/"items":(true|false)/);
    expect(JSON.stringify(js)).not.toContain('$schema');
  });
});

describe('response validation and grounding', () => {
  const e = newGame(aloneSurvey());
  const req = reqFor(e);

  it('accepts a grounded, schema-valid response', () => {
    const r = validateScenarioResponse(req, good(req));
    expect(r.ok).toBe(true);
  });

  it.each([
    ['invalid JSON', '{"schemaVersion":1,', 'invalid-json'],
    ['wrong variant', null, 'schema'],
    ['reordered actions', null, 'actions-altered'],
    ['added action', null, 'schema'],
    ['over-length dialogue', null, 'schema'],
  ])('rejects %s', (name, raw, reason) => {
    const body = raw ?? (name === 'wrong variant' ? good(req, { variantId: 'EV01__SOMETHING_ELSE' })
      : name === 'reordered actions' ? good(req, { actionIds: [...req.allowedActionIds].reverse() })
      : name === 'added action' ? good(req, { actionIds: [...req.allowedActionIds, 'RUN_INTO_FLOODWATER'] })
      : good(req, { dialogue: 'x'.repeat(201) }));
    const r = validateScenarioResponse(req, body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });

  it.each([
    ['an invented evacuation instruction and place', 'The advisory says to head to the community center if the typhoon hits soon.'],
    ['an invented forecast', 'Hey, I just checked the forecast—no typhoon today, but keep an eye out.'],
    ['a signal level', 'They raised it to Signal No. 4 an hour ago.'],
    ['a hotline number', 'Call 0917 123 4567 if you need help.'],
    ['a website', 'Check www.example.com for updates.'],
    ['medical instructions', 'Take two tablets of your medicine every four hours.'],
    ['a safety guarantee', 'Stay inside and you are guaranteed to be fine.'],
    ['family members for a person living alone', 'Mom is packing the kitchen supplies.'],
    ['an item the household does not have', 'Grab the generator from the garage.'],
  ])('rejects %s', (_name, dialogue) => {
    const r = validateScenarioResponse(req, good(req, { dialogue }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('ungrounded');
  });

  it('does not flag the phone battery as the Batteries item (false positive seen in benchmark output)', () => {
    const fam = reqFor(newGame(familySurvey())); // this household has no batteries
    expect(fam.state.availableItems).not.toContain('Batteries');
    expect(validateScenarioResponse(fam, good(fam, { dialogue: 'Let’s conserve the phone battery for now.' })).ok).toBe(true);
    expect(validateScenarioResponse(fam, good(fam, { dialogue: 'Put spare batteries in the bag.' })).ok).toBe(false);
  });

  it('does not flag checking a forecast without stating one (false positive seen in benchmark output)', () => {
    expect(validateScenarioResponse(req, good(req, { dialogue: 'We should check the weather forecast together.' })).ok).toBe(true);
  });

  it('allows mentioning items the household has', () => {
    const r = validateScenarioResponse(req, good(req, { dialogue: 'Good thing your flashlight is ready.' }));
    expect(r.ok).toBe(true);
  });

  it('produces reviewed fallback content with the engine variant and actions', () => {
    const fb = fallbackContent(e.getState(), 'timeout');
    expect(fb.source).toBe('fallback');
    expect(fb.variantId).toBe(req.allowedVariantIds[0]);
    expect(fb.actionIds).toEqual(req.allowedActionIds);
    expect(fb.fallbackReason).toBe('timeout');
  });
});

describe('prompts', () => {
  it('builds a compact system + user message pair containing the facts and JSON-only instruction', () => {
    const req = reqFor(newGame());
    const msgs = buildPromptMessages(req);
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user']);
    expect(msgs[0]!.content).toMatch(/JSON/);
    expect(msgs[1]!.content).toContain(req.facts[0]!);
    expect(msgs.map((m) => m.content).join('').length).toBeLessThan(4000);
  });
});

describe('debrief narration', () => {
  const st = playToEnd(newGame(aloneSurvey()), ['DEFER', 'FINISH_REFLECTION']);
  const ev = evaluateRun(st);
  const req = buildDebriefRequest(ev, st);

  it('is built only from evaluated findings', () => {
    expect(req.gaps.map((g) => g.id)).toEqual(ev.gaps);
    expect(req.score).toBe(ev.score);
  });

  it('accepts narration that highlights known findings', () => {
    const r = validateDebriefNarration(ev, JSON.stringify({ summary: 'You finished the storm with a clear sense of what to improve next time.', highlightFindingIds: ev.gaps.slice(0, 2) }));
    expect(r.ok).toBe(true);
  });

  it('rejects narration that cites unknown findings or invents guidance', () => {
    expect(validateDebriefNarration(ev, JSON.stringify({ summary: 'Well done.', highlightFindingIds: ['F_NOT_REAL'] })).ok).toBe(false);
    expect(validateDebriefNarration(ev, JSON.stringify({ summary: 'Next time call 0917 123 4567.', highlightFindingIds: [] })).ok).toBe(false);
  });

  it('has a deterministic fallback', () => {
    expect(fallbackDebriefNarration(ev)).toEqual(fallbackDebriefNarration(ev));
    expect(fallbackDebriefNarration(ev).summary.length).toBeLessThanOrEqual(400);
  });
});
