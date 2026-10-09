// Hard-coded household for the first playable slice (replaced by onboarding screens in M5).
import type { CustomOnboarding } from '../../shared/contracts/onboarding';

export const SLICE_SEED = 20261010;

export function sliceHousehold(): CustomOnboarding {
  return {
    schemaVersion: 1, mode: 'custom', q1Housing: 'singleStory', q2SizeRange: '3-4', q2ExactSize: 4,
    q3AgeCounts: { age0to4: 0, age5to12: 1, age13to17: 0, age18to35: 0, age36to59: 2, age60plus: 1 },
    q4Assistance: 'yes', q5MedicalSupplies: 'yes', q6Surroundings: ['waterway', 'floodProne'], q7Pets: 'yes', q8Preparedness: 'partial',
    customization: { theme: 'traditional' },
  };
}
