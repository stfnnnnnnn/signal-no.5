// Onboarding form state: pure helpers over the backend's ONBOARDING_QUESTIONS metadata. Validation is the backend's
// (createGame error.issues); this module only shapes drafts and decides which question is shown.
import {
  ONBOARDING_QUESTIONS, SIZE_BOUNDS, type AgeCounts, type CustomOnboarding, type QuestionDef, type RandomOnboarding, type SizeRange,
} from '../../../shared/contracts/onboarding';

type Custom = CustomOnboarding;
type Random = RandomOnboarding;
export type Customization = NonNullable<Custom['customization']>;

export interface CustomDraft {
  q1Housing?: Custom['q1Housing']; q2SizeRange?: SizeRange; q2ExactSize?: number; q3AgeCounts: AgeCounts;
  q4Assistance?: Custom['q4Assistance']; q5MedicalSupplies?: Custom['q5MedicalSupplies']; q6Surroundings: string[];
  q7Pets?: Custom['q7Pets']; q8Preparedness?: Custom['q8Preparedness'];
}
export interface RandomDraft { r1SizeRange?: SizeRange; r2PlayerAge?: Random['r2PlayerAge']; r3OtherAgeGroups: string[]; r4Preference?: string }
export type Draft = CustomDraft | RandomDraft;

const ZERO_AGES: AgeCounts = { age0to4: 0, age5to12: 0, age13to17: 0, age18to35: 0, age36to59: 0, age60plus: 0 };
export const emptyCustom = (): CustomDraft => ({ q3AgeCounts: { ...ZERO_AGES }, q6Surroundings: [] });
export const emptyRandom = (): RandomDraft => ({ r3OtherAgeGroups: [] });

export const questionsFor = (path: 'custom' | 'random') => ONBOARDING_QUESTIONS.filter((q) => q.path === path);
const field = (d: Draft, name: string) => (d as unknown as Record<string, unknown>)[name];
const isRange = (r: unknown) => r === '3-4' || r === '5-6' || r === '7+';

/** The two conditional questions (QuestionDef.visibleWhen): Q2b for size ranges, R3 unless the household is one person. */
export function visible(q: QuestionDef, d: Draft): boolean {
  if (q.id === 'Q2b') return isRange(field(d, 'q2SizeRange'));
  if (q.id === 'R3') return field(d, 'r1SizeRange') !== undefined && field(d, 'r1SizeRange') !== '1';
  return true;
}

export const ageTotal = (d: CustomDraft) => Object.values(d.q3AgeCounts).reduce((n, c) => n + c, 0);
export function householdSize(d: CustomDraft): number | undefined {
  if (!d.q2SizeRange) return undefined;
  const [lo, hi] = SIZE_BOUNDS[d.q2SizeRange];
  return lo === hi ? lo : d.q2ExactSize;
}

/** Enough is answered to move on (the backend still validates everything at the end). */
export function answered(q: QuestionDef, d: Draft): boolean {
  if (q.optional) return true;
  const v = field(d, q.field);
  if (q.kind === 'multi') return Array.isArray(v) && v.length > 0;
  if (q.kind === 'counters') return ageTotal(d as CustomDraft) > 0;
  return v !== undefined && v !== '';
}

/** Multi-select honouring `exclusive` choices (e.g. "Neither", "Not sure", "Surprise me"). */
export function toggleChoice(selected: string[], value: string, q: QuestionDef): string[] {
  if (selected.includes(value)) return selected.filter((v) => v !== value);
  const exclusive = new Set((q.choices ?? []).filter((c) => c.exclusive).map((c) => c.value));
  if (exclusive.has(value)) return [value];
  return [...selected.filter((v) => !exclusive.has(v)), value];
}

export function toCustomInput(d: CustomDraft, customization: Partial<Customization> = {}): Custom {
  return {
    schemaVersion: 1, mode: 'custom',
    q1Housing: d.q1Housing!, q2SizeRange: d.q2SizeRange!, ...(isRange(d.q2SizeRange) ? { q2ExactSize: d.q2ExactSize } : {}),
    q3AgeCounts: d.q3AgeCounts, q4Assistance: d.q4Assistance!, q5MedicalSupplies: d.q5MedicalSupplies!,
    q6Surroundings: d.q6Surroundings as Custom['q6Surroundings'], q7Pets: d.q7Pets!, q8Preparedness: d.q8Preparedness!,
    customization: { appearance: 'auto', minimumBudgetChallenge: false, ...customization },
  };
}

export function toRandomInput(d: RandomDraft, customization: Partial<Customization> = {}): Random {
  return {
    schemaVersion: 1, mode: 'random', r1SizeRange: d.r1SizeRange!, r2PlayerAge: d.r2PlayerAge!,
    r3OtherAgeGroups: (d.r1SizeRange === '1' ? [] : d.r3OtherAgeGroups) as Random['r3OtherAgeGroups'],
    ...(d.r4Preference ? { r4Preference: d.r4Preference as Random['r4Preference'] } : {}),
    customization: { appearance: 'auto', minimumBudgetChallenge: false, ...customization },
  };
}

/** Backend validation issues keyed by their first path segment (the question's field). */
export function issuesByField(issues?: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues ?? []) { const k = String(i.path[0] ?? ''); out[k] ??= i.message; }
  return out;
}
