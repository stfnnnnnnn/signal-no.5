import type { CustomOnboarding, RandomOnboarding } from '../../src/shared/contracts/onboarding';

const zero = { age0to4: 0, age5to12: 0, age13to17: 0, age18to35: 0, age36to59: 0, age60plus: 0 };

/** Four people, flood-prone + waterway, assistance and medical supplies needed, a pet, partly prepared. */
export function customFamily(): CustomOnboarding {
  return {
    schemaVersion: 1, mode: 'custom', q1Housing: 'singleStory', q2SizeRange: '3-4', q2ExactSize: 4,
    q3AgeCounts: { ...zero, age5to12: 1, age36to59: 2, age60plus: 1 },
    q4Assistance: 'yes', q5MedicalSupplies: 'yes', q6Surroundings: ['waterway', 'floodProne'], q7Pets: 'yes', q8Preparedness: 'partial',
    customization: { theme: 'traditional' },
  };
}

/** One adult, neither surrounding, fully prepared. */
export function customSolo(): CustomOnboarding {
  return {
    schemaVersion: 1, mode: 'custom', q1Housing: 'twoStory', q2SizeRange: '1', q3AgeCounts: { ...zero, age18to35: 1 },
    q4Assistance: 'no', q5MedicalSupplies: 'no', q6Surroundings: ['neither'], q7Pets: 'no', q8Preparedness: 'full', customization: { theme: 'modern' },
  };
}

export function randomHousehold(over: Partial<RandomOnboarding> = {}): RandomOnboarding {
  return { schemaVersion: 1, mode: 'random', r1SizeRange: '3-4', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['age5to12', 'age60plus'], ...over };
}

export { zero as zeroAges };
