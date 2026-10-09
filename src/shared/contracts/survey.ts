// Household Configuration Form (docs/specs/...Configuration_Form_Formatted.md): 26 questions.
// Raw survey answers; validated here, normalised into HouseholdProfile by src/core/household.
import { z } from 'zod';
import { AGE_GROUPS, AgeGroup, BudgetTier, ThemeId } from './ids';

const YesNoUnsure = z.enum(['yes', 'no', 'notSure', 'preferNotToSay']);
export type YesNoUnsure = z.infer<typeof YesNoUnsure>;

export const HouseholdSizeRange = z.enum(['1', '2', '3-4', '5-6', '7+']);
export type HouseholdSizeRange = z.infer<typeof HouseholdSizeRange>;
export const SIZE_RANGE_BOUNDS: Record<HouseholdSizeRange, [number, number]> = {
  '1': [1, 1], '2': [2, 2], '3-4': [3, 4], '5-6': [5, 6], '7+': [7, 20],
};

const Count = z.number().int().min(0).max(20);
export const AgeGridRow = z.object({ male: Count, female: Count, unspecified: Count.default(0) });
export const AgeGrid = z.object(Object.fromEntries(AGE_GROUPS.map((g) => [g, AgeGridRow])) as Record<AgeGroup, typeof AgeGridRow>);
export type AgeGrid = z.infer<typeof AgeGrid>;

export const HouseholdMode = z.enum(['actual', 'fictional', 'randomize']);
export type HouseholdMode = z.infer<typeof HouseholdMode>;
/** Survey sections that partial randomization ("randomize") may regenerate. */
export const RandomizableField = z.enum(['composition', 'housing', 'medical', 'preparedness']);
export type RandomizableField = z.infer<typeof RandomizableField>;

export const PetType = z.enum(['dog', 'cat', 'bird', 'other']);
export const HousingType = z.enum(['detached', 'townhouse', 'apartment', 'condominium', 'informal', 'other']);
export const Floors = z.enum(['1', '2', '3+']);
export const Surroundings = z.enum(['residential', 'coastal', 'waterway', 'lowLying', 'hillside', 'other', 'notSure']);
export const FloodHistory = z.enum(['never', 'rarely', 'occasionally', 'frequently', 'notSure']);
export const Roof = z.enum(['metal', 'concrete', 'tile', 'lightweight', 'other', 'notSure']);
export const Exits = z.enum(['multiple', 'one', 'none', 'notSure']);
export const ConditionCategory = z.enum(['respiratory', 'cardiovascular', 'metabolic', 'kidney', 'neurological', 'musculoskeletal', 'visual', 'hearing', 'cognitive', 'mentalHealth', 'other', 'preferNotToSpecify']);
export const AllergyCategory = z.enum(['food', 'medication', 'environmental', 'other', 'preferNotToSpecify']);
export const Equipment = z.enum(['mobilityAid', 'oxygen', 'electricityDependent', 'refrigerated', 'glucoseMonitoring', 'otherEquipment', 'none', 'notSure', 'preferNotToSay']);
export const GoBagAnswer = z.enum(['complete', 'partial', 'none', 'notSure']);
export const Supply = z.enum(['water', 'food', 'flashlight', 'batteries', 'powerBank', 'radio', 'firstAidKit', 'medications', 'hygiene', 'documentsWaterproof', 'emergencyCash', 'whistle', 'clothing', 'childCare', 'petSupplies', 'none', 'notSure']);
export const PlanAnswer = z.enum(['yes', 'partial', 'no', 'notSure']);
export const WarningSource = z.enum(['tv', 'radio', 'socialMedia', 'officialApps', 'sms', 'barangay', 'familyFriends', 'noConsistentSource']);
export const BackupPower = z.enum(['flashlight', 'rechargeable', 'generator', 'none', 'notSure']);
export const AppearanceChoice = z.enum(['auto', 'customColor', 'randomize']);

const OtherText = z.string().trim().max(40);

/**
 * Survey answers. For mode "fictional", only q3 (+ optional q25/q26/budget) is required; the
 * generator fills the rest. For "randomize", the listed sections are regenerated.
 */
export const SurveyResponses = z.object({
  schemaVersion: z.literal(1),
  q1HouseholdSize: HouseholdSizeRange.optional(),
  q2AgeGrid: AgeGrid.optional(),
  q3Mode: HouseholdMode,
  q3RandomizeFields: z.array(RandomizableField).default([]),
  q4Assistance: YesNoUnsure.optional(),
  q4AssistanceCount: Count.optional(),
  q5Pets: z.boolean().optional(),
  q5PetTypes: z.array(PetType).default([]),
  q5PetOther: OtherText.optional(),
  q6Housing: HousingType.optional(),
  q6HousingOther: OtherText.optional(),
  q7Floors: Floors.optional(),
  q8Surroundings: Surroundings.optional(),
  q8SurroundingsOther: OtherText.optional(),
  q9FloodHistory: FloodHistory.optional(),
  q10Roof: Roof.optional(),
  q11Exits: Exits.optional(),
  q12MedicalCondition: YesNoUnsure.optional(),
  q13ConditionCategories: z.array(ConditionCategory).default([]),
  q14EssentialMedication: YesNoUnsure.optional(),
  q15Allergies: YesNoUnsure.optional(),
  q15AllergyCategories: z.array(AllergyCategory).default([]),
  q16Equipment: z.array(Equipment).default([]),
  q17WarningAssistance: YesNoUnsure.optional(),
  q18GoBag: GoBagAnswer.optional(),
  q19Supplies: z.array(Supply).default([]),
  q20EvacuationPlan: PlanAnswer.optional(),
  q21EvacuationCenterKnown: z.enum(['yes', 'no', 'notSure']).optional(),
  q22CommunicationPlan: PlanAnswer.optional(),
  q23WarningSources: z.array(WarningSource).default([]),
  q24BackupPower: z.array(BackupPower).default([]),
  /** Q25: index into the generated roster (0-based); default = first adult, else first member. */
  q25PlayerMemberIndex: z.number().int().min(0).max(19).optional(),
  q25Appearance: AppearanceChoice.default('auto'),
  q25ClothingColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  q26Theme: ThemeId.optional(),
  /** Not a form question: fictional budget profile (GD §4). */
  budgetTier: BudgetTier.optional(),
});
export type SurveyResponses = z.input<typeof SurveyResponses>;
export type ParsedSurvey = z.output<typeof SurveyResponses>;

function exclusive<T extends string>(values: readonly T[], lone: readonly T[]): boolean {
  return !values.some((v) => lone.includes(v)) || values.length === 1;
}
function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function ageGridTotal(grid: AgeGrid): number {
  return AGE_GROUPS.reduce((n, g) => n + grid[g].male + grid[g].female + grid[g].unspecified, 0);
}

/** Validation for a complete (actual-mode, or post-generation) survey. */
export const CompleteSurvey = SurveyResponses.superRefine((s, ctx) => {
  const need = (key: keyof ParsedSurvey) => {
    if (s[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: 'required' });
  };
  (['q1HouseholdSize', 'q2AgeGrid', 'q4Assistance', 'q5Pets', 'q6Housing', 'q7Floors', 'q8Surroundings', 'q9FloodHistory',
    'q10Roof', 'q11Exits', 'q18GoBag', 'q20EvacuationPlan', 'q21EvacuationCenterKnown', 'q22CommunicationPlan', 'q26Theme'] as const).forEach(need);

  if (s.q1HouseholdSize && s.q2AgeGrid) {
    const total = ageGridTotal(s.q2AgeGrid);
    const [lo, hi] = SIZE_RANGE_BOUNDS[s.q1HouseholdSize];
    if (total < lo || total > hi) ctx.addIssue({ code: 'custom', path: ['q2AgeGrid'], message: `age-group total ${total} does not match household size ${s.q1HouseholdSize}` });
    if (s.q4Assistance === 'yes') {
      if (s.q4AssistanceCount === undefined || s.q4AssistanceCount < 1) ctx.addIssue({ code: 'custom', path: ['q4AssistanceCount'], message: 'required when assistance is needed (≥ 1)' });
      else if (s.q4AssistanceCount > total) ctx.addIssue({ code: 'custom', path: ['q4AssistanceCount'], message: 'cannot exceed household size' });
    }
    if (s.q25PlayerMemberIndex !== undefined && s.q25PlayerMemberIndex >= total) ctx.addIssue({ code: 'custom', path: ['q25PlayerMemberIndex'], message: 'not a household member' });
  }
  if (s.q4Assistance !== 'yes' && s.q4AssistanceCount) ctx.addIssue({ code: 'custom', path: ['q4AssistanceCount'], message: 'only allowed when assistance is "yes"' });
  if (s.q5Pets === true && s.q5PetTypes.length === 0) ctx.addIssue({ code: 'custom', path: ['q5PetTypes'], message: 'select at least one animal' });
  if (s.q5Pets !== true && s.q5PetTypes.length > 0) ctx.addIssue({ code: 'custom', path: ['q5PetTypes'], message: 'only allowed when pets are present' });
  if (s.q12MedicalCondition !== 'yes' && s.q13ConditionCategories.length > 0) ctx.addIssue({ code: 'custom', path: ['q13ConditionCategories'], message: 'only allowed when Q12 is "yes"' });
  if (s.q15Allergies !== 'yes' && s.q15AllergyCategories.length > 0) ctx.addIssue({ code: 'custom', path: ['q15AllergyCategories'], message: 'only allowed when Q15 is "yes"' });
  if (s.q25ClothingColor && s.q25Appearance !== 'customColor') ctx.addIssue({ code: 'custom', path: ['q25ClothingColor'], message: 'only allowed with customColor' });

  const lists: [keyof ParsedSurvey, readonly string[], readonly string[]][] = [
    ['q13ConditionCategories', s.q13ConditionCategories, ['preferNotToSpecify']],
    ['q15AllergyCategories', s.q15AllergyCategories, ['preferNotToSpecify']],
    ['q16Equipment', s.q16Equipment, ['none', 'notSure', 'preferNotToSay']],
    ['q19Supplies', s.q19Supplies, ['none', 'notSure']],
    ['q23WarningSources', s.q23WarningSources, ['noConsistentSource']],
    ['q24BackupPower', s.q24BackupPower, ['none', 'notSure']],
    ['q5PetTypes', s.q5PetTypes, []],
  ];
  for (const [key, values, lone] of lists) {
    if (!unique(values)) ctx.addIssue({ code: 'custom', path: [key], message: 'duplicate options' });
    if (!exclusive(values, lone)) ctx.addIssue({ code: 'custom', path: [key], message: `${lone.join('/')} cannot be combined with other options` });
  }
});
