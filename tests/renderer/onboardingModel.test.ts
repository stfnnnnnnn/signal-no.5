import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/engine';
import { ONBOARDING_QUESTIONS } from '../../src/shared/contracts/onboarding';
import {
  ageTotal, answered, emptyCustom, emptyRandom, issuesByField, questionsFor, toCustomInput, toRandomInput, toggleChoice, visible,
  type CustomDraft,
} from '../../src/renderer/ui/onboarding/onboardingModel';

const q = (id: string) => ONBOARDING_QUESTIONS.find((x) => x.id === id)!;
const family = (): CustomDraft => ({
  ...emptyCustom(), q1Housing: 'singleStory', q2SizeRange: '3-4', q2ExactSize: 4,
  q3AgeCounts: { age0to4: 0, age5to12: 1, age13to17: 0, age18to35: 0, age36to59: 2, age60plus: 1 },
  q4Assistance: 'no', q5MedicalSupplies: 'notSure', q6Surroundings: ['waterway'], q7Pets: 'no', q8Preparedness: 'partial',
});

describe('onboarding questions come from the backend metadata', () => {
  it('custom path is Q1–Q8 with Q2b; random path is R1–R4; no apartment or condominium anywhere', () => {
    expect(questionsFor('custom').map((x) => x.id)).toEqual(['Q1', 'Q2', 'Q2b', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']);
    expect(questionsFor('random').map((x) => x.id)).toEqual(['R1', 'R2', 'R3', 'R4']);
    expect(JSON.stringify(ONBOARDING_QUESTIONS)).not.toMatch(/apartment|condo/i);
  });
});

describe('visibility and answers', () => {
  it('asks Q2b only for size ranges', () => {
    expect(visible(q('Q2b'), { ...emptyCustom(), q2SizeRange: '2' })).toBe(false);
    expect(visible(q('Q2b'), { ...emptyCustom(), q2SizeRange: '5-6' })).toBe(true);
  });
  it('hides R3 for a one-person household; R4 is optional', () => {
    expect(visible(q('R3'), { ...emptyRandom(), r1SizeRange: '1' })).toBe(false);
    expect(visible(q('R3'), { ...emptyRandom(), r1SizeRange: '3-4' })).toBe(true);
    expect(answered(q('R4'), emptyRandom())).toBe(true);
  });
  it('exclusive choices clear the others and are cleared by them', () => {
    const six = q('Q6');
    expect(toggleChoice(['waterway'], 'floodProne', six)).toEqual(['waterway', 'floodProne']);
    expect(toggleChoice(['waterway', 'floodProne'], 'neither', six)).toEqual(['neither']);
    expect(toggleChoice(['neither'], 'waterway', six)).toEqual(['waterway']);
    expect(toggleChoice(['waterway'], 'waterway', six)).toEqual([]);
  });
  it('totals the age counts', () => expect(ageTotal(family())).toBe(4));
});

describe('drafts become backend input', () => {
  it('a complete custom draft starts a real game', () => {
    const r = createGame(toCustomInput(family(), { theme: 'modern' }), { seed: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.engine.getProfile().theme).toBe('modern');
  });
  it('fixed-size ranges drop the exact size', () => {
    const d = { ...family(), q2SizeRange: '2' as const, q2ExactSize: 4, q3AgeCounts: { ...family().q3AgeCounts, age5to12: 0, age60plus: 0 } };
    const r = createGame(toCustomInput(d), { seed: 3 });
    expect(r.ok).toBe(true);
  });
  it('maps backend validation issues to their fields', () => {
    const r = createGame(toCustomInput({ ...family(), q2ExactSize: 3 }), { seed: 3 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(issuesByField(r.error.issues).q3AgeCounts).toMatch(/add up to 4/);
  });
  it('random: one person skips R3, an unanswered R4 uses the backend default', () => {
    const r = createGame(toRandomInput({ ...emptyRandom(), r1SizeRange: '1', r2PlayerAge: 'age18to35', r3OtherAgeGroups: ['age5to12'] }), { seed: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.engine.getProfile().size).toBe(1);
  });
  it('random with the same answers and seed gives the same household (re-roll changes the seed)', () => {
    const input = toRandomInput({ ...emptyRandom(), r1SizeRange: '3-4', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['surprise'] });
    const a = createGame(input, { seed: 9 }), b = createGame(input, { seed: 9 });
    expect(a.ok && b.ok && JSON.stringify(a.engine.getProfile().members) === JSON.stringify(b.engine.getProfile().members)).toBe(true);
  });
});
