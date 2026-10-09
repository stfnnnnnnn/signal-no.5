// Onboarding v2 → HouseholdProfile. Both paths are converted into the established survey shape and built by
// buildHouseholdProfile (one validation/roster implementation), then annotated with mode, exposure and preference.
import { AGE_GROUPS, type AgeGroup } from '../../shared/contracts/ids';
import type { HouseholdProfile } from '../../shared/contracts/household';
import {
  CustomOnboarding, RandomOnboarding, SIZE_BOUNDS, type Exposure, type OnboardingInput, type ScenarioPreference,
} from '../../shared/contracts/onboarding';
import type { AgeGrid, SurveyResponses } from '../../shared/contracts/survey';
import { createRng, deriveSeed } from '../rng';
import { assignPlayer, buildHouseholdProfile, type BuildResult, type ValidationIssue } from './buildProfile';
import { housing as genHousing, medical as genMedical, preparedness as genPreparedness } from './fictional';

const toIssues = (e: { issues: { path: PropertyKey[]; message: string }[] }): ValidationIssue[] =>
  e.issues.map((i) => ({ path: i.path.map((p) => (typeof p === 'number' ? p : String(p))), message: i.message }));

function gridFromCounts(counts: Record<AgeGroup, number>): AgeGrid {
  return Object.fromEntries(AGE_GROUPS.map((g) => [g, { male: 0, female: 0, unspecified: counts[g] ?? 0 }])) as AgeGrid;
}
const sizeRangeOf = (n: number): SurveyResponses['q1HouseholdSize'] => (n === 1 ? '1' : n === 2 ? '2' : n <= 4 ? '3-4' : n <= 6 ? '5-6' : '7+');
const ADULTS: AgeGroup[] = ['age18to35', 'age36to59', 'age60plus'];

function exposureFromSurroundings(s: string[]): Exposure {
  if (s.includes('notSure')) return 'unknown';
  const w = s.includes('waterway'); const f = s.includes('floodProne');
  return w && f ? 'both' : w ? 'waterway' : f ? 'floodProne' : 'standard';
}
const SURROUNDINGS_FOR: Record<Exposure, SurveyResponses['q8Surroundings']> = { standard: 'residential', waterway: 'waterway', floodProne: 'lowLying', both: 'lowLying', unknown: 'notSure' };

/** Q8 → provisional starting resources/plans. Actual scoring always comes from in-game state. */
function preparednessAnswers(q8: 'full' | 'partial' | 'none' | 'notSure'): Partial<SurveyResponses> {
  switch (q8) {
    case 'full': return { q18GoBag: 'complete', q19Supplies: ['water', 'food', 'flashlight', 'batteries', 'radio', 'firstAidKit', 'hygiene', 'documentsWaterproof', 'clothing'],
      q20EvacuationPlan: 'yes', q21EvacuationCenterKnown: 'yes', q22CommunicationPlan: 'yes', q24BackupPower: ['flashlight'] };
    case 'partial': return { q18GoBag: 'partial', q19Supplies: ['water', 'flashlight'], q20EvacuationPlan: 'partial', q21EvacuationCenterKnown: 'no', q22CommunicationPlan: 'partial', q24BackupPower: ['flashlight'] };
    case 'none': return { q18GoBag: 'none', q19Supplies: ['none'], q20EvacuationPlan: 'no', q21EvacuationCenterKnown: 'no', q22CommunicationPlan: 'no', q24BackupPower: ['none'] };
    default: return { q18GoBag: 'notSure', q19Supplies: ['notSure'], q20EvacuationPlan: 'notSure', q21EvacuationCenterKnown: 'notSure', q22CommunicationPlan: 'notSure', q24BackupPower: ['notSure'] };
  }
}

function finish(survey: SurveyResponses, seed: number, extra: Pick<HouseholdProfile, 'configMode' | 'exposure' | 'scenarioPreference'>, playerAge?: AgeGroup): BuildResult {
  const built = buildHouseholdProfile(survey, { seed });
  if (!built.ok) return built;
  let profile: HouseholdProfile = { ...built.profile, ...extra, mode: extra.configMode === 'random' ? 'fictional' : 'actual' };
  if (playerAge) {
    const m = profile.members.find((x) => x.ageGroup === playerAge);
    if (m) profile = assignPlayer(profile, m.id);
  }
  return { ok: true, profile };
}

function fromCustom(a: ReturnType<typeof CustomOnboarding.parse>, seed: number): BuildResult {
  const [lo, hi] = SIZE_BOUNDS[a.q2SizeRange];
  const size = lo === hi ? lo : a.q2ExactSize!;
  const exposure = exposureFromSurroundings(a.q6Surroundings);
  const c = a.customization;
  const survey: SurveyResponses = {
    schemaVersion: 1, q3Mode: 'actual',
    q1HouseholdSize: sizeRangeOf(size), q2AgeGrid: gridFromCounts(a.q3AgeCounts),
    q4Assistance: a.q4Assistance, ...(a.q4Assistance === 'yes' ? { q4AssistanceCount: 1 } : {}),
    q5Pets: a.q7Pets === 'yes', q5PetTypes: a.q7Pets === 'yes' ? ['other'] : [],
    q6Housing: 'detached', q7Floors: a.q1Housing === 'singleStory' ? '1' : a.q1Housing === 'twoStory' ? '2' : '3+',
    q8Surroundings: SURROUNDINGS_FOR[exposure], q9FloodHistory: 'notSure', q10Roof: 'notSure', q11Exits: 'one',
    q14EssentialMedication: a.q5MedicalSupplies, q16Equipment: [],
    ...preparednessAnswers(a.q8Preparedness),
    q25PlayerMemberIndex: c.playerMemberIndex, q25Appearance: c.appearance, q25ClothingColor: c.clothingColor,
    q26Theme: c.theme ?? createRng(deriveSeed(seed, 'onboarding:theme')).pick(['modern', 'traditional'] as const),
    budgetTier: c.minimumBudgetChallenge ? 'limited' : 'moderate',
  };
  return finish(survey, seed, { configMode: 'custom', exposure, scenarioPreference: null });
}

function fromRandom(a: ReturnType<typeof RandomOnboarding.parse>, seed: number): BuildResult {
  const rng = createRng(deriveSeed(seed, 'onboarding:random'));
  const [lo, hi] = SIZE_BOUNDS[a.r1SizeRange];
  const size = rng.int(lo, hi);
  const counts = Object.fromEntries(AGE_GROUPS.map((g) => [g, 0])) as Record<AgeGroup, number>;
  counts[a.r2PlayerAge]++;
  const others = size - 1;
  const chosen = a.r3OtherAgeGroups.filter((g): g is AgeGroup => g !== 'surprise');
  if (chosen.length > others) return { ok: false, issues: [{ path: ['r3OtherAgeGroups'], message: `choose at most ${others} age group(s) for this household size` }] };
  const pool: AgeGroup[] = chosen.length ? chosen : [...AGE_GROUPS];
  const slots: AgeGroup[] = [...chosen];
  while (slots.length < others) slots.push(chosen.length ? rng.pick(pool) : rng.weighted<AgeGroup>([['age0to4', 8], ['age5to12', 18], ['age13to17', 14], ['age18to35', 22], ['age36to59', 22], ['age60plus', 16]]));
  // Compatibility: young children are never left with only an adolescent player and no adult.
  const hasAdult = ADULTS.includes(a.r2PlayerAge) || slots.some((g) => ADULTS.includes(g));
  if (!hasAdult && slots.some((g) => g === 'age0to4' || g === 'age5to12')) {
    const i = slots.findIndex((g) => g === 'age13to17') >= 0 ? slots.findIndex((g) => g === 'age13to17') : slots.length - 1;
    slots[i] = 'age18to35';
  }
  for (const g of slots) counts[g]++;

  const pref: ScenarioPreference = a.r4Preference;
  const prng = createRng(deriveSeed(seed, 'onboarding:preference'));
  const exposure: Exposure = pref === 'challenging' ? 'both' : pref === 'balanced' ? prng.pick(['standard', 'waterway'] as const)
    : prng.weighted<Exposure>([['standard', 30], ['waterway', 20], ['floodProne', 20], ['both', 15], ['unknown', 15]]);
  const budgetTier = a.customization.minimumBudgetChallenge || pref === 'challenging' ? 'limited' : pref === 'balanced' ? 'moderate' : prng.pick(['limited', 'moderate', 'higher'] as const);
  const h = genHousing(createRng(deriveSeed(seed, 'household:housing')));
  const m = genMedical(createRng(deriveSeed(seed, 'household:medical')));
  const prep = genPreparedness(createRng(deriveSeed(seed, 'household:preparedness')));
  const assistance = prng.chance(size > 1 ? 0.35 : 0.15);
  const pets = prng.chance(0.4);
  // q3Mode 'actual': every field is already generated here; the legacy builder must not regenerate sections.
  const survey: SurveyResponses = {
    schemaVersion: 1, q3Mode: 'actual',
    q1HouseholdSize: sizeRangeOf(size), q2AgeGrid: gridFromCounts(counts),
    q4Assistance: assistance ? 'yes' : 'no', ...(assistance ? { q4AssistanceCount: 1 } : {}),
    q5Pets: pets, q5PetTypes: pets ? [prng.pick(['dog', 'cat', 'bird'] as const)] : [],
    q6Housing: 'detached', q7Floors: h.q7Floors, q8Surroundings: SURROUNDINGS_FOR[exposure], q9FloodHistory: 'notSure', q10Roof: h.q10Roof, q11Exits: h.q11Exits,
    // No diagnoses or condition categories are ever generated.
    q14EssentialMedication: m.q14EssentialMedication, q16Equipment: m.q16Equipment,
    ...prep,
    ...(pref === 'challenging' ? { q18GoBag: prng.pick(['none', 'partial'] as const) } : pref === 'balanced' ? { q18GoBag: 'partial' as const } : {}),
    q25Appearance: a.customization.appearance, q25ClothingColor: a.customization.clothingColor,
    q26Theme: a.customization.theme ?? prng.pick(['modern', 'traditional'] as const),
    budgetTier,
  };
  return finish(survey, seed, { configMode: 'random', exposure, scenarioPreference: pref }, a.r2PlayerAge);
}

export function buildFromOnboarding(input: OnboardingInput, seed: number): BuildResult {
  if ((input as { mode?: string }).mode === 'custom') {
    const p = CustomOnboarding.safeParse(input);
    return p.success ? fromCustom(p.data, seed) : { ok: false, issues: toIssues(p.error) };
  }
  const p = RandomOnboarding.safeParse(input);
  return p.success ? fromRandom(p.data, seed) : { ok: false, issues: toIssues(p.error) };
}

export const isOnboardingInput = (x: unknown): x is OnboardingInput =>
  !!x && typeof x === 'object' && ((x as { mode?: unknown }).mode === 'custom' || (x as { mode?: unknown }).mode === 'random');
