import type { SurveyResponses } from '../../src/shared/contracts/survey';

const emptyGrid = () => ({
  age0to4: { male: 0, female: 0, unspecified: 0 },
  age5to12: { male: 0, female: 0, unspecified: 0 },
  age13to17: { male: 0, female: 0, unspecified: 0 },
  age18to35: { male: 0, female: 0, unspecified: 0 },
  age36to59: { male: 0, female: 0, unspecified: 0 },
  age60plus: { male: 0, female: 0, unspecified: 0 },
});

/** Profile B: four-member household, assistance needed, pet, low-lying, partial go-bag, limited budget. */
export function familySurvey(): SurveyResponses {
  const g = emptyGrid();
  g.age36to59.female = 1;
  g.age36to59.male = 1;
  g.age5to12.male = 1;
  g.age60plus.female = 1;
  return {
    schemaVersion: 1,
    q1HouseholdSize: '3-4', q2AgeGrid: g, q3Mode: 'actual',
    q4Assistance: 'yes', q4AssistanceCount: 1,
    q5Pets: true, q5PetTypes: ['dog'],
    q6Housing: 'detached', q7Floors: '1', q8Surroundings: 'lowLying', q9FloodHistory: 'occasionally',
    q10Roof: 'metal', q11Exits: 'one',
    q12MedicalCondition: 'yes', q13ConditionCategories: ['cardiovascular'],
    q14EssentialMedication: 'yes', q15Allergies: 'no', q16Equipment: ['none'], q17WarningAssistance: 'no',
    q18GoBag: 'partial', q19Supplies: ['water', 'flashlight'],
    q20EvacuationPlan: 'partial', q21EvacuationCenterKnown: 'no', q22CommunicationPlan: 'no',
    q23WarningSources: ['tv', 'socialMedia'], q24BackupPower: ['flashlight'],
    q25PlayerMemberIndex: 0, q26Theme: 'traditional', budgetTier: 'limited',
  };
}

/** Profile A: one adult in an apartment, well prepared, higher budget. */
export function aloneSurvey(): SurveyResponses {
  const g = emptyGrid();
  g.age18to35.female = 1;
  return {
    schemaVersion: 1,
    q1HouseholdSize: '1', q2AgeGrid: g, q3Mode: 'actual',
    q4Assistance: 'no', q5Pets: false,
    q6Housing: 'apartment', q7Floors: '1', q8Surroundings: 'residential', q9FloodHistory: 'never',
    q10Roof: 'concrete', q11Exits: 'multiple',
    q12MedicalCondition: 'no', q14EssentialMedication: 'no', q15Allergies: 'no', q16Equipment: ['none'], q17WarningAssistance: 'no',
    q18GoBag: 'complete',
    q19Supplies: ['water', 'food', 'flashlight', 'batteries', 'powerBank', 'radio', 'firstAidKit', 'hygiene', 'documentsWaterproof', 'emergencyCash', 'whistle', 'clothing'],
    q20EvacuationPlan: 'yes', q21EvacuationCenterKnown: 'yes', q22CommunicationPlan: 'yes',
    q23WarningSources: ['officialApps', 'sms'], q24BackupPower: ['rechargeable'],
    q26Theme: 'modern', budgetTier: 'higher',
  };
}

export { emptyGrid };
