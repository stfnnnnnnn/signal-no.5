import { describe, expect, it } from 'vitest';
import { buildHouseholdProfile } from '../src/core/household/buildProfile';
import { HouseholdProfile } from '../src/shared/contracts/household';
import { aloneSurvey, emptyGrid, familySurvey } from './fixtures/households';

const issuesAt = (r: ReturnType<typeof buildHouseholdProfile>, key: string) =>
  r.ok ? [] : r.issues.filter((i) => i.path[0] === key);

describe('survey validation', () => {
  it('accepts a complete actual-household survey and returns a valid v2 profile', () => {
    const r = buildHouseholdProfile(familySurvey(), { seed: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(HouseholdProfile.safeParse(r.profile).success).toBe(true);
  });

  it('rejects an age grid whose total does not match the household-size range', () => {
    const s = familySurvey();
    s.q1HouseholdSize = '2';
    const r = buildHouseholdProfile(s, { seed: 1 });
    expect(r.ok).toBe(false);
    expect(issuesAt(r, 'q2AgeGrid')).toHaveLength(1);
  });

  it('rejects an assistance count larger than the household', () => {
    const s = familySurvey();
    s.q4AssistanceCount = 5;
    expect(issuesAt(buildHouseholdProfile(s, { seed: 1 }), 'q4AssistanceCount')).toHaveLength(1);
  });

  it('rejects exclusive options combined with others', () => {
    const s = familySurvey();
    s.q16Equipment = ['none', 'mobilityAid'];
    expect(issuesAt(buildHouseholdProfile(s, { seed: 1 }), 'q16Equipment')).toHaveLength(1);
  });

  it('rejects condition categories unless Q12 is yes', () => {
    const s = familySurvey();
    s.q12MedicalCondition = 'no';
    expect(issuesAt(buildHouseholdProfile(s, { seed: 1 }), 'q13ConditionCategories')).toHaveLength(1);
  });

  it('rejects a missing required answer in actual mode', () => {
    const s = familySurvey();
    delete s.q7Floors;
    expect(issuesAt(buildHouseholdProfile(s, { seed: 1 }), 'q7Floors')).toHaveLength(1);
  });
});

describe('household roster', () => {
  it('derives the exact size and one member per person from the age grid', () => {
    const r = buildHouseholdProfile(familySurvey(), { seed: 1 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.size).toBe(4);
    expect(r.profile.members).toHaveLength(4);
    expect(new Set(r.profile.members.map((m) => m.id)).size).toBe(4);
  });

  it('maps age and sex to the four sprite templates', () => {
    const r = buildHouseholdProfile(familySurvey(), { seed: 1 });
    if (!r.ok) throw new Error('expected ok');
    const sprites = r.profile.members.map((m) => `${m.ageGroup}:${m.sex}:${m.spriteBase}`).sort();
    expect(sprites).toEqual(['age36to59:female:mom', 'age36to59:male:dad', 'age5to12:male:boy', 'age60plus:female:mom'].sort());
  });

  it('marks the selected player and makes at most three other non-dependent members visible NPCs', () => {
    const r = buildHouseholdProfile(familySurvey(), { seed: 1 });
    if (!r.ok) throw new Error('expected ok');
    const players = r.profile.members.filter((m) => m.isPlayer);
    expect(players).toHaveLength(1);
    expect(r.profile.playerMemberId).toBe(players[0]!.id);
    const npcs = r.profile.members.filter((m) => m.visibleNpc);
    expect(npcs.length).toBe(3);
    expect(npcs.every((m) => !m.isPlayer && m.npcId === `NPC_${m.id}`)).toBe(true);
  });

  it('caps visible NPCs at three and represents infants as dependents', () => {
    const s = familySurvey();
    const g = emptyGrid();
    g.age36to59.female = 2; g.age36to59.male = 2; g.age18to35.male = 1; g.age0to4.unspecified = 1;
    s.q1HouseholdSize = '5-6'; s.q2AgeGrid = g;
    const r = buildHouseholdProfile(s, { seed: 3 });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.profile.members.filter((m) => m.visibleNpc)).toHaveLength(3);
    const infant = r.profile.members.find((m) => m.ageGroup === 'age0to4')!;
    expect(infant.dependent).toBe(true);
    expect(infant.visibleNpc).toBe(false);
  });

  it('assigns an unspecified-sex child a child sprite deterministically from the seed', () => {
    const s = aloneSurvey();
    const g = emptyGrid();
    g.age18to35.female = 1; g.age5to12.unspecified = 1;
    s.q1HouseholdSize = '2'; s.q2AgeGrid = g;
    const a = buildHouseholdProfile(s, { seed: 7 });
    const b = buildHouseholdProfile(s, { seed: 7 });
    if (!a.ok || !b.ok) throw new Error('expected ok');
    const child = a.profile.members.find((m) => m.ageGroup === 'age5to12')!;
    expect(['boy', 'girl']).toContain(child.spriteBase);
    expect(b.profile.members.find((m) => m.ageGroup === 'age5to12')!.spriteBase).toBe(child.spriteBase);
  });
});

describe('normalisation', () => {
  it('maps "prefer not to say" medical answers to undisclosed and "not sure" to unknown', () => {
    const s = familySurvey();
    s.q14EssentialMedication = 'preferNotToSay';
    s.q17WarningAssistance = 'notSure';
    const r = buildHouseholdProfile(s, { seed: 1 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.medical.essentialMedication).toBe('undisclosed');
    expect(r.profile.medical.warningAssistance).toBe('unknown');
  });

  it('defaults budget to moderate when not provided', () => {
    const s = aloneSurvey();
    delete s.budgetTier;
    const r = buildHouseholdProfile(s, { seed: 1 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.budgetTier).toBe('moderate');
  });
});

describe('fictional and randomised households', () => {
  it('generates a complete valid profile from only the mode answer', () => {
    const r = buildHouseholdProfile({ schemaVersion: 1, q3Mode: 'fictional' }, { seed: 42 });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(HouseholdProfile.safeParse(r.profile).success).toBe(true);
    expect(r.profile.members).toHaveLength(r.profile.size);
    expect(r.profile.mode).toBe('fictional');
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = buildHouseholdProfile({ schemaVersion: 1, q3Mode: 'fictional' }, { seed: 42 });
    const b = buildHouseholdProfile({ schemaVersion: 1, q3Mode: 'fictional' }, { seed: 42 });
    expect(a).toEqual(b);
    const variants = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const r = buildHouseholdProfile({ schemaVersion: 1, q3Mode: 'fictional' }, { seed });
      return r.ok ? JSON.stringify([r.profile.size, r.profile.housing, r.profile.preparedness.goBag]) : 'err';
    }));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('partial randomisation regenerates only the selected sections', () => {
    const s = familySurvey();
    s.q3Mode = 'randomize';
    s.q3RandomizeFields = ['housing'];
    const r = buildHouseholdProfile(s, { seed: 9 });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.profile.size).toBe(4);
    expect(r.profile.pets.types).toEqual(['dog']);
    expect(r.profile.preparedness.goBag).toBe('partial');
    expect(r.profile.mode).toBe('randomize');
  });

  it('keeps the chosen theme and player choice in fictional mode', () => {
    const r = buildHouseholdProfile({ schemaVersion: 1, q3Mode: 'fictional', q26Theme: 'traditional', q25PlayerMemberIndex: 0 }, { seed: 5 });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.profile.theme).toBe('traditional');
    expect(r.profile.members[0]!.isPlayer).toBe(true);
  });
});
