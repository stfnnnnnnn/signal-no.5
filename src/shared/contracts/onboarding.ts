// Onboarding v2: Q0 configuration mode + 8-question custom path or 4-step random path.
// Both produce a HouseholdProfile (v2, extended). Replaces the 26-question form for new games; the legacy
// SurveyResponses path remains supported for compatibility (deprecated).
import { z } from 'zod';
import { AgeGroup, ThemeId } from './ids';

export const MAX_HOUSEHOLD_SIZE = 10;
export const ConfigMode = z.enum(['custom', 'random']);
export type ConfigMode = z.infer<typeof ConfigMode>;

export const SizeRange = z.enum(['1', '2', '3-4', '5-6', '7+']);
export type SizeRange = z.infer<typeof SizeRange>;
export const SIZE_BOUNDS: Record<SizeRange, [number, number]> = { '1': [1, 1], '2': [2, 2], '3-4': [3, 4], '5-6': [5, 6], '7+': [7, MAX_HOUSEHOLD_SIZE] };

const Answer4 = z.enum(['yes', 'no', 'notSure', 'preferNotToSay']);
export const Exposure = z.enum(['standard', 'waterway', 'floodProne', 'both', 'unknown']);
export type Exposure = z.infer<typeof Exposure>;
export const ScenarioPreference = z.enum(['surprise', 'balanced', 'challenging']);
export type ScenarioPreference = z.infer<typeof ScenarioPreference>;

const Count = z.number().int().min(0).max(MAX_HOUSEHOLD_SIZE);
export const AgeCounts = z.object({ age0to4: Count, age5to12: Count, age13to17: Count, age18to35: Count, age36to59: Count, age60plus: Count }).strict();
export type AgeCounts = z.infer<typeof AgeCounts>;

/** Customisation shown after onboarding (not counted as questions). */
export const Customization = z.object({
  theme: ThemeId.optional(),
  playerMemberIndex: z.number().int().min(0).max(MAX_HOUSEHOLD_SIZE - 1).optional(),
  appearance: z.enum(['auto', 'customColor', 'randomize']).default('auto'),
  clothingColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Explicit challenge option: the smallest starting budget (₱800). Default budget is moderate. */
  minimumBudgetChallenge: z.boolean().default(false),
}).strict();

export const CustomOnboarding = z.object({
  schemaVersion: z.literal(1),
  mode: z.literal('custom'),
  q1Housing: z.enum(['singleStory', 'twoStory', 'multiStory']),
  q2SizeRange: SizeRange,
  /** Required for ranges (3–4, 5–6, 7+); must lie within the range. */
  q2ExactSize: z.number().int().min(1).max(MAX_HOUSEHOLD_SIZE).optional(),
  q3AgeCounts: AgeCounts,
  q4Assistance: Answer4,
  q5MedicalSupplies: Answer4,
  q6Surroundings: z.array(z.enum(['waterway', 'floodProne', 'neither', 'notSure'])).min(1),
  q7Pets: z.enum(['yes', 'no', 'preferNotToSay']),
  q8Preparedness: z.enum(['full', 'partial', 'none', 'notSure']),
  customization: Customization.default({ appearance: 'auto', minimumBudgetChallenge: false }),
}).strict().superRefine((a, ctx) => {
  const [lo, hi] = SIZE_BOUNDS[a.q2SizeRange];
  const size = lo === hi ? lo : a.q2ExactSize;
  if (size === undefined) ctx.addIssue({ code: 'custom', path: ['q2ExactSize'], message: 'exact household size required for this range' });
  else if (size < lo || size > hi) ctx.addIssue({ code: 'custom', path: ['q2ExactSize'], message: `must be between ${lo} and ${hi}` });
  const total = Object.values(a.q3AgeCounts).reduce((n, c) => n + c, 0);
  if (size !== undefined && total !== size) ctx.addIssue({ code: 'custom', path: ['q3AgeCounts'], message: `age groups add up to ${total}, household size is ${size}` });
  const s = a.q6Surroundings;
  if (new Set(s).size !== s.length) ctx.addIssue({ code: 'custom', path: ['q6Surroundings'], message: 'duplicate options' });
  if ((s.includes('neither') || s.includes('notSure')) && s.length > 1) ctx.addIssue({ code: 'custom', path: ['q6Surroundings'], message: '"Neither" and "Not sure" cannot be combined with other options' });
  const pi = a.customization.playerMemberIndex;
  if (pi !== undefined && size !== undefined && pi >= size) ctx.addIssue({ code: 'custom', path: ['customization', 'playerMemberIndex'], message: 'not a household member' });
  if (a.customization.clothingColor && a.customization.appearance !== 'customColor') ctx.addIssue({ code: 'custom', path: ['customization', 'clothingColor'], message: 'only with customColor' });
});
export type CustomOnboarding = z.input<typeof CustomOnboarding>;

export const PlayerAgeGroup = z.enum(['age13to17', 'age18to35', 'age36to59', 'age60plus']);
export const RandomOnboarding = z.object({
  schemaVersion: z.literal(1),
  mode: z.literal('random'),
  r1SizeRange: SizeRange,
  r2PlayerAge: PlayerAgeGroup,
  /** Skipped (empty) for one-person households. 'surprise' lets the generator choose. */
  r3OtherAgeGroups: z.array(z.union([AgeGroup, z.literal('surprise')])).default([]),
  r4Preference: ScenarioPreference.default('surprise'),
  customization: Customization.default({ appearance: 'auto', minimumBudgetChallenge: false }),
}).strict().superRefine((a, ctx) => {
  const r3 = a.r3OtherAgeGroups;
  if (a.r1SizeRange === '1' && r3.length > 0) ctx.addIssue({ code: 'custom', path: ['r3OtherAgeGroups'], message: 'skip for a one-person household' });
  if (a.r1SizeRange !== '1' && r3.length === 0) ctx.addIssue({ code: 'custom', path: ['r3OtherAgeGroups'], message: 'choose at least one age group (or "surprise")' });
  if (r3.includes('surprise') && r3.length > 1) ctx.addIssue({ code: 'custom', path: ['r3OtherAgeGroups'], message: '"Surprise me" cannot be combined with other options' });
  if (new Set(r3).size !== r3.length) ctx.addIssue({ code: 'custom', path: ['r3OtherAgeGroups'], message: 'duplicate options' });
});
export type RandomOnboarding = z.input<typeof RandomOnboarding>;

export const OnboardingInput = z.union([CustomOnboarding, RandomOnboarding]);
export type OnboardingInput = CustomOnboarding | RandomOnboarding;

// ---------- Question metadata for the frontend (render from data) ----------
export interface QuestionChoice { value: string; label: string; detail?: string; exclusive?: boolean }
export interface QuestionDef {
  id: string; path: 'mode' | 'custom' | 'random'; field: string; text: string;
  kind: 'single' | 'multi' | 'counters' | 'number'; choices?: QuestionChoice[];
  optional?: boolean; visibleWhen?: string; validation?: string;
}

const SIZE_CHOICES: QuestionChoice[] = [
  { value: '1', label: '1 person' }, { value: '2', label: '2 people' }, { value: '3-4', label: '3–4 people' },
  { value: '5-6', label: '5–6 people' }, { value: '7+', label: `7 or more people (up to ${MAX_HOUSEHOLD_SIZE})` },
];
const AGE_CHOICES: QuestionChoice[] = [
  { value: 'age0to4', label: 'Infants and toddlers (0–4)' }, { value: 'age5to12', label: 'Children (5–12)' },
  { value: 'age13to17', label: 'Adolescents (13–17)' }, { value: 'age18to35', label: 'Young adults (18–35)' },
  { value: 'age36to59', label: 'Middle-aged adults (36–59)' }, { value: 'age60plus', label: 'Older adults (60+)' },
];
const YN4: QuestionChoice[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'notSure', label: 'Not sure' }, { value: 'preferNotToSay', label: 'Prefer not to say' }];

export const ONBOARDING_QUESTIONS: QuestionDef[] = [
  { id: 'Q0', path: 'mode', field: 'mode', text: 'How would you like to set up your household?', kind: 'single', choices: [
    { value: 'custom', label: 'Customize My Household', detail: 'Create a typhoon preparedness experience based on your selected household, living environment, and preparedness circumstances.' },
    { value: 'random', label: 'Randomize My Household', detail: 'Generate a fictional household and environment while allowing you to establish basic household composition and age groups.' }] },
  { id: 'Q1', path: 'custom', field: 'q1Housing', text: 'What type of house best represents your household?', kind: 'single', choices: [
    { value: 'singleStory', label: 'Single-story house' }, { value: 'twoStory', label: 'Two-story house' }, { value: 'multiStory', label: 'Multi-story house (three or more floors)' }] },
  { id: 'Q2', path: 'custom', field: 'q2SizeRange', text: 'How many people live in your household, including yourself?', kind: 'single', choices: SIZE_CHOICES },
  { id: 'Q2b', path: 'custom', field: 'q2ExactSize', text: 'Exactly how many?', kind: 'number', visibleWhen: 'q2SizeRange in [3-4, 5-6, 7+]', validation: 'within the selected range' },
  { id: 'Q3', path: 'custom', field: 'q3AgeCounts', text: 'How many household members belong to each age group?', kind: 'counters', choices: AGE_CHOICES, validation: 'counts must add up to the household size' },
  { id: 'Q4', path: 'custom', field: 'q4Assistance', text: 'Does anyone in your household require additional assistance during evacuation?', kind: 'single', choices: YN4 },
  { id: 'Q5', path: 'custom', field: 'q5MedicalSupplies', text: 'Does anyone in your household need essential medication or medical supplies during emergencies?', kind: 'single', choices: YN4 },
  { id: 'Q6', path: 'custom', field: 'q6Surroundings', text: "Which of the following describes your home's surroundings?", kind: 'multi', choices: [
    { value: 'waterway', label: 'Near a river, creek, or other waterway' }, { value: 'floodProne', label: 'Low-lying or flood-prone area' },
    { value: 'neither', label: 'Neither of the above', exclusive: true }, { value: 'notSure', label: 'Not sure', exclusive: true }] },
  { id: 'Q7', path: 'custom', field: 'q7Pets', text: 'Does your household have pets that need to be included in an evacuation plan?', kind: 'single', choices: [
    { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'preferNotToSay', label: 'Prefer not to say' }] },
  { id: 'Q8', path: 'custom', field: 'q8Preparedness', text: "How would you describe your household's current emergency preparedness?", kind: 'single', choices: [
    { value: 'full', label: 'Fully prepared', detail: 'We have an emergency kit and household emergency plan.' },
    { value: 'partial', label: 'Partially prepared', detail: 'We have some supplies or plans, but not everything.' },
    { value: 'none', label: 'Not yet prepared', detail: 'We have not prepared an emergency kit or plan.' },
    { value: 'notSure', label: 'Not sure', detail: "I don't know our current preparedness status." }] },
  { id: 'R1', path: 'random', field: 'r1SizeRange', text: 'How many people should live in your generated household, including your character?', kind: 'single', choices: SIZE_CHOICES },
  { id: 'R2', path: 'random', field: 'r2PlayerAge', text: 'Which age group should your playable character belong to?', kind: 'single', choices: AGE_CHOICES.slice(2) },
  { id: 'R3', path: 'random', field: 'r3OtherAgeGroups', text: 'Which age groups should be represented among the other household members?', kind: 'multi', visibleWhen: 'r1SizeRange != 1',
    choices: [...AGE_CHOICES, { value: 'surprise', label: 'Surprise me', exclusive: true }] },
  { id: 'R4', path: 'random', field: 'r4Preference', text: 'What kind of fictional household scenario would you like?', kind: 'single', optional: true, choices: [
    { value: 'surprise', label: 'Surprise Me' }, { value: 'balanced', label: 'Balanced Challenge' }, { value: 'challenging', label: 'Challenging Scenario' }] },
];
