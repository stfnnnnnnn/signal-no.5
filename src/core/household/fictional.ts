// Fictional household generation (HF Q3). Produces complete survey sections from a seed.
import { AGE_GROUPS, type AgeGroup } from '../../shared/contracts/ids';
import type { AgeGrid, ParsedSurvey, RandomizableField, SurveyResponses } from '../../shared/contracts/survey';
import { SIZE_RANGE_BOUNDS, type HouseholdSizeRange } from '../../shared/contracts/survey';
import { createRng, deriveSeed, type Rng } from '../rng';

type Section = Partial<ParsedSurvey>;

function emptyGrid(): AgeGrid {
  return Object.fromEntries(AGE_GROUPS.map((g) => [g, { male: 0, female: 0, unspecified: 0 }])) as AgeGrid;
}

export function composition(rng: Rng): Section {
  const range = rng.weighted<HouseholdSizeRange>([['1', 10], ['2', 15], ['3-4', 40], ['5-6', 25], ['7+', 10]]);
  const [lo, hi] = SIZE_RANGE_BOUNDS[range];
  const size = rng.int(lo, Math.min(hi, 8));
  const grid = emptyGrid();
  const add = (g: AgeGroup) => { const row = grid[g]; if (rng.chance(0.5)) row.male++; else row.female++; };
  add(rng.pick(['age18to35', 'age36to59'] as const)); // at least one adult
  for (let i = 1; i < size; i++) add(rng.weighted<AgeGroup>([['age0to4', 8], ['age5to12', 18], ['age13to17', 14], ['age18to35', 22], ['age36to59', 22], ['age60plus', 16]]));
  const assistance = rng.chance(0.3);
  const pets = rng.chance(0.4);
  return {
    q1HouseholdSize: range, q2AgeGrid: grid,
    q4Assistance: assistance ? 'yes' : 'no', ...(assistance ? { q4AssistanceCount: 1 } : {}),
    q5Pets: pets, q5PetTypes: pets ? [rng.pick(['dog', 'cat', 'bird'] as const)] : [],
  };
}

export function housing(rng: Rng): Section {
  return {
    q6Housing: rng.weighted([['detached', 40], ['townhouse', 20], ['apartment', 20], ['condominium', 8], ['informal', 12]] as const),
    q7Floors: rng.weighted([['1', 55], ['2', 35], ['3+', 10]] as const),
    q8Surroundings: rng.pick(['residential', 'coastal', 'waterway', 'lowLying', 'hillside'] as const),
    q9FloodHistory: rng.pick(['never', 'rarely', 'occasionally', 'frequently'] as const),
    q10Roof: rng.pick(['metal', 'concrete', 'tile', 'lightweight'] as const),
    q11Exits: rng.weighted([['multiple', 45], ['one', 45], ['none', 10]] as const),
  };
}

export function medical(rng: Rng): Section {
  const condition = rng.chance(0.3);
  const allergies = rng.chance(0.15);
  return {
    q12MedicalCondition: condition ? 'yes' : 'no',
    q13ConditionCategories: condition ? [rng.pick(['respiratory', 'cardiovascular', 'metabolic', 'musculoskeletal', 'hearing'] as const)] : [],
    q14EssentialMedication: condition && rng.chance(0.6) ? 'yes' : 'no',
    q15Allergies: allergies ? 'yes' : 'no',
    q15AllergyCategories: allergies ? [rng.pick(['food', 'environmental'] as const)] : [],
    q16Equipment: condition && rng.chance(0.3) ? [rng.pick(['mobilityAid', 'electricityDependent'] as const)] : ['none'],
    q17WarningAssistance: rng.chance(0.1) ? 'yes' : 'no',
  };
}

export function preparedness(rng: Rng): Section {
  const pool = ['water', 'food', 'flashlight', 'batteries', 'powerBank', 'radio', 'firstAidKit', 'hygiene', 'documentsWaterproof', 'emergencyCash', 'whistle', 'clothing'] as const;
  const supplies = pool.filter(() => rng.chance(0.4));
  return {
    q18GoBag: rng.weighted([['complete', 15], ['partial', 45], ['none', 40]] as const),
    q19Supplies: supplies.length ? [...supplies] : ['none'],
    q20EvacuationPlan: rng.pick(['yes', 'partial', 'no'] as const),
    q21EvacuationCenterKnown: rng.pick(['yes', 'no'] as const),
    q22CommunicationPlan: rng.pick(['yes', 'partial', 'no'] as const),
    q23WarningSources: [rng.pick(['tv', 'radio', 'socialMedia', 'sms'] as const)],
    q24BackupPower: rng.pick([['flashlight'], ['rechargeable'], ['none']] as const).slice(),
  };
}

const GENERATORS: Record<RandomizableField, (rng: Rng) => Section> = { composition, housing, medical, preparedness };

/**
 * Fill survey sections from the seed. "fictional" regenerates every section; "randomize" only the
 * listed ones. Player choice (Q25), theme (Q26) and budget are kept when the player supplied them.
 */
export function applyGeneration(input: SurveyResponses, parsed: ParsedSurvey, seed: number): SurveyResponses {
  const fields: RandomizableField[] = parsed.q3Mode === 'fictional'
    ? ['composition', 'housing', 'medical', 'preparedness']
    : parsed.q3Mode === 'randomize' ? parsed.q3RandomizeFields : [];
  let out: SurveyResponses = { ...input };
  for (const f of fields) out = { ...out, ...GENERATORS[f](createRng(deriveSeed(seed, `household:${f}`))) };
  const extras = createRng(deriveSeed(seed, 'household:extras'));
  if (parsed.q3Mode === 'fictional') {
    out.q26Theme ??= extras.pick(['modern', 'traditional'] as const);
    out.budgetTier ??= extras.pick(['limited', 'moderate', 'higher'] as const);
  }
  return out;
}
