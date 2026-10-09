import { describe, expect, it } from 'vitest';
import { buildFromOnboarding } from '../src/core/household/onboarding';
import { createGame } from '../src/core/engine';
import { HouseholdProfile } from '../src/shared/contracts/household';
import { CustomOnboarding, MAX_HOUSEHOLD_SIZE, ONBOARDING_QUESTIONS, RandomOnboarding } from '../src/shared/contracts/onboarding';
import { buildHouseholdProfile } from '../src/core/household/buildProfile';
import { customFamily, customSolo, randomHousehold, zeroAges } from './fixtures/onboarding';
import { familySurvey } from './fixtures/households';

const ok = (r: ReturnType<typeof buildFromOnboarding>) => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.profile; };
const issueKeys = (r: ReturnType<typeof buildFromOnboarding>) => (r.ok ? [] : r.issues.map((i) => i.path.join('.')));

describe('Q0 configuration mode and question metadata', () => {
  it('exposes Q0, the 8 custom questions and the 4 random steps for the frontend', () => {
    expect(ONBOARDING_QUESTIONS.filter((q) => q.path === 'mode').map((q) => q.id)).toEqual(['Q0']);
    expect(ONBOARDING_QUESTIONS.filter((q) => q.path === 'custom' && !q.id.endsWith('b')).map((q) => q.id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']);
    expect(ONBOARDING_QUESTIONS.filter((q) => q.path === 'random').map((q) => q.id)).toEqual(['R1', 'R2', 'R3', 'R4']);
    expect(ONBOARDING_QUESTIONS.find((q) => q.id === 'Q1')!.choices!.map((c) => c.value)).toEqual(['singleStory', 'twoStory', 'multiStory']);
  });

  it('records the configuration mode on the profile', () => {
    expect(ok(buildFromOnboarding(customFamily(), 1)).configMode).toBe('custom');
    expect(ok(buildFromOnboarding(randomHousehold(), 1)).configMode).toBe('random');
  });
});

describe('custom household (8 questions)', () => {
  it('produces a complete, schema-valid profile', () => {
    const p = ok(buildFromOnboarding(customFamily(), 1));
    expect(HouseholdProfile.safeParse(p).success).toBe(true);
    expect(p.size).toBe(4);
    expect(p.members.map((m) => m.ageGroup).sort()).toEqual(['age36to59', 'age36to59', 'age5to12', 'age60plus'].sort());
  });

  it('maps housing type to floors on the fixed layout and rejects removed options', () => {
    expect(ok(buildFromOnboarding({ ...customSolo(), q1Housing: 'singleStory' }, 1)).housing.floors).toBe(1);
    expect(ok(buildFromOnboarding({ ...customSolo(), q1Housing: 'twoStory' }, 1)).housing.floors).toBe(2);
    expect(ok(buildFromOnboarding({ ...customSolo(), q1Housing: 'multiStory' }, 1)).housing.floors).toBe(3);
    expect(CustomOnboarding.safeParse({ ...customSolo(), q1Housing: 'apartment' }).success).toBe(false);
    expect(CustomOnboarding.safeParse({ ...customSolo(), q1Housing: 'condominium' }).success).toBe(false);
  });

  it('requires an exact size within the selected range', () => {
    const a = customFamily(); delete a.q2ExactSize;
    expect(issueKeys(buildFromOnboarding(a, 1))).toContain('q2ExactSize');
    expect(issueKeys(buildFromOnboarding({ ...customFamily(), q2ExactSize: 5 }, 1))).toContain('q2ExactSize');
  });

  it('requires the age counts to add up to the household size', () => {
    expect(issueKeys(buildFromOnboarding({ ...customFamily(), q3AgeCounts: { ...zeroAges, age36to59: 3 } }, 1))).toContain('q3AgeCounts');
  });

  it('supports a one-person household and the explicit maximum size', () => {
    expect(ok(buildFromOnboarding(customSolo(), 1)).size).toBe(1);
    const max = { ...customFamily(), q2SizeRange: '7+' as const, q2ExactSize: MAX_HOUSEHOLD_SIZE, q3AgeCounts: { ...zeroAges, age36to59: 2, age5to12: MAX_HOUSEHOLD_SIZE - 2 } };
    expect(ok(buildFromOnboarding(max, 1)).size).toBe(MAX_HOUSEHOLD_SIZE);
    expect(buildFromOnboarding({ ...max, q2ExactSize: MAX_HOUSEHOLD_SIZE + 1 }, 1).ok).toBe(false);
  });

  it('allows waterway + flood-prone together but keeps "neither"/"not sure" exclusive', () => {
    expect(ok(buildFromOnboarding(customFamily(), 1)).exposure).toBe('both');
    expect(ok(buildFromOnboarding({ ...customFamily(), q6Surroundings: ['waterway'] }, 1)).exposure).toBe('waterway');
    expect(ok(buildFromOnboarding({ ...customFamily(), q6Surroundings: ['floodProne'] }, 1)).exposure).toBe('floodProne');
    expect(ok(buildFromOnboarding(customSolo(), 1)).exposure).toBe('standard');
    expect(ok(buildFromOnboarding({ ...customSolo(), q6Surroundings: ['notSure'] }, 1)).exposure).toBe('unknown');
    expect(issueKeys(buildFromOnboarding({ ...customFamily(), q6Surroundings: ['neither', 'waterway'] }, 1))).toContain('q6Surroundings');
  });

  it('preserves unknown and undisclosed answers instead of converting them', () => {
    const p = ok(buildFromOnboarding({ ...customFamily(), q4Assistance: 'notSure', q5MedicalSupplies: 'preferNotToSay' }, 1));
    expect(p.assistance.required).toBe('unknown');
    expect(p.medical.essentialMedication).toBe('undisclosed');
    expect(ok(buildFromOnboarding({ ...customFamily(), q5MedicalSupplies: 'notSure' }, 1)).medical.essentialMedication).toBe('unknown');
    expect(ok(buildFromOnboarding(customSolo(), 1)).housing.roof).toBe('notSure');
  });

  it('enables pets and maps starting preparedness to a provisional profile', () => {
    const p = ok(buildFromOnboarding(customFamily(), 1));
    expect(p.pets.present).toBe(true);
    expect(p.preparedness.goBag).toBe('partial');
    expect(ok(buildFromOnboarding(customSolo(), 1)).preparedness.goBag).toBe('complete');
    expect(ok(buildFromOnboarding({ ...customSolo(), q8Preparedness: 'none' }, 1)).preparedness.goBag).toBe('none');
  });

  it('does not treat an unknown roof type as requiring roof work', () => {
    const r = createGame(customSolo(), { seed: 3 });
    if (!r.ok) throw new Error('setup');
    r.engine.resolveEvent('DEFER');
    expect(r.engine.getAvailableActions('UTILITY_LADDER').some((a) => a.actionId === 'SECURE_ROOF')).toBe(false);
  });

  it('defaults to the moderate budget and offers an explicit minimum-budget challenge', () => {
    expect(ok(buildFromOnboarding(customSolo(), 1)).budgetTier).toBe('moderate');
    expect(ok(buildFromOnboarding({ ...customSolo(), customization: { minimumBudgetChallenge: true } }, 1)).budgetTier).toBe('limited');
  });

  it('never infers assistance needs from age', () => {
    const p = ok(buildFromOnboarding({ ...customFamily(), q4Assistance: 'no' }, 1)); // includes an older adult
    expect(p.assistance.required).toBe('no');
  });
});

describe('random household (4 steps)', () => {
  it('generates an exact size within the range and counts the player in the total', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = ok(buildFromOnboarding(randomHousehold(), seed));
      expect(p.size).toBeGreaterThanOrEqual(3); expect(p.size).toBeLessThanOrEqual(4);
      expect(p.members).toHaveLength(p.size);
      expect(p.members.find((m) => m.isPlayer)!.ageGroup).toBe('age36to59');
    }
  });

  it('represents the selected age groups among the other members', () => {
    const p = ok(buildFromOnboarding(randomHousehold({ r1SizeRange: '5-6', r3OtherAgeGroups: ['age0to4', 'age60plus'] }), 7));
    const others = p.members.filter((m) => !m.isPlayer).map((m) => m.ageGroup);
    expect(others).toContain('age0to4'); expect(others).toContain('age60plus');
    expect(others.every((g) => g === 'age0to4' || g === 'age60plus')).toBe(true);
  });

  it('skips R3 for a one-person household and rejects R3 answers there', () => {
    expect(ok(buildFromOnboarding(randomHousehold({ r1SizeRange: '1', r3OtherAgeGroups: [] }), 1)).size).toBe(1);
    expect(RandomOnboarding.safeParse(randomHousehold({ r1SizeRange: '1', r3OtherAgeGroups: ['age5to12'] })).success).toBe(false);
  });

  it('adds an adult when an adolescent player would otherwise be the only carer of young children', () => {
    const p = ok(buildFromOnboarding(randomHousehold({ r2PlayerAge: 'age13to17', r3OtherAgeGroups: ['age0to4'] }), 3));
    expect(p.members.some((m) => ['age18to35', 'age36to59', 'age60plus'].includes(m.ageGroup))).toBe(true);
  });

  it('is reproducible from the seed and varies across seeds', () => {
    expect(buildFromOnboarding(randomHousehold({ r3OtherAgeGroups: ['surprise'] }), 42)).toEqual(buildFromOnboarding(randomHousehold({ r3OtherAgeGroups: ['surprise'] }), 42));
    const variants = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(ok(buildFromOnboarding(randomHousehold({ r3OtherAgeGroups: ['surprise'] }), s)).members.map((m) => m.ageGroup))));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('maps the scenario preference to difficulty and budget; defaults to surprise', () => {
    const hard = ok(buildFromOnboarding(randomHousehold({ r4Preference: 'challenging' }), 1));
    expect(hard.exposure).toBe('both'); expect(hard.budgetTier).toBe('limited');
    const bal = ok(buildFromOnboarding(randomHousehold({ r4Preference: 'balanced' }), 1));
    expect(['standard', 'waterway']).toContain(bal.exposure); expect(bal.budgetTier).toBe('moderate');
    expect(ok(buildFromOnboarding(randomHousehold(), 1)).scenarioPreference).toBe('surprise');
  });

  it('never generates diagnoses or condition categories', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) expect(ok(buildFromOnboarding(randomHousehold(), seed)).medical.conditionCategories).toEqual([]);
  });

  it('produces valid NPC configuration (≤3 visible, with npc IDs)', () => {
    const p = ok(buildFromOnboarding(randomHousehold({ r1SizeRange: '7+', r3OtherAgeGroups: ['surprise'] }), 9));
    const npcs = p.members.filter((m) => m.visibleNpc);
    expect(npcs.length).toBeLessThanOrEqual(3);
    expect(npcs.every((m) => m.npcId === `NPC_${m.id}`)).toBe(true);
  });
});

describe('engine entry and compatibility', () => {
  it('createGame accepts custom and random onboarding', () => {
    for (const input of [customFamily(), randomHousehold()]) {
      const r = createGame(input, { seed: 5 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.engine.getState().activeEvent?.eventId).toBe('EV01');
    }
  });

  it('returns INVALID_SURVEY issues for invalid onboarding', () => {
    const r = createGame({ ...customFamily(), q2ExactSize: 9 }, { seed: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_SURVEY');
  });

  it('still loads a saved profile from before onboarding v2', () => {
    const legacy = buildHouseholdProfile(familySurvey(), { seed: 1 });
    if (!legacy.ok) throw new Error('setup');
    const { configMode: _a, exposure: _b, scenarioPreference: _c, ...old } = legacy.profile as Record<string, unknown>;
    const parsed = HouseholdProfile.safeParse(old);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.configMode).toBe('custom');
  });
});
