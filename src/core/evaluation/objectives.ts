// Preparedness objectives by competency (GD §14). Applicability depends on the household and on which
// authored events occurred — never on demographics or disclosed health (GS "Core Design Principle").
import type { CompetencyCategory } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import * as sel from '../selectors';

export interface Objective {
  id: string;
  category: CompetencyCategory;
  applicable: (s: GameState) => boolean;
  met: (s: GameState) => boolean;
  /** Finding reported as a strength when met and as a gap otherwise. */
  findingId: string;
}

export const CATEGORY_WEIGHTS: [CompetencyCategory, number][] = [
  ['emergencySupplies', 20], ['officialInformation', 20], ['householdCoordination', 15],
  ['evacuationPreparedness', 20], ['householdNeeds', 15], ['hazardAwareness', 10],
];

const f = (s: GameState, k: keyof GameState['flags']) => s.flags[k] === true;
const happened = (s: GameState, id: string) => s.eventHistory.some((h) => h.eventId === id);
const resolvedWith = (s: GameState, id: string) => s.eventHistory.filter((h) => h.eventId === id).map((h) => h.resolvedWith);
const always = () => true;
const c = (s: GameState, k: string) => s.counters[k] ?? 0;

export const OBJECTIVES: Objective[] = [
  // Water/food are judged as PREPARED stores when dangerous weather begins (evacuees carry only part of them).
  { id: 'O_WATER', category: 'emergencySupplies', applicable: always, met: (s) => c(s, 'hr_water') >= sel.waterRequirement(s.household), findingId: 'F_WATER' },
  { id: 'O_FOOD', category: 'emergencySupplies', applicable: always, met: (s) => c(s, 'hr_food') >= sel.foodRequirement(s.household), findingId: 'F_FOOD' },
  { id: 'O_GO_BAG', category: 'emergencySupplies', applicable: always, met: (s) => c(s, 'lf_goBagReady') === 1, findingId: 'F_GO_BAG' },
  { id: 'O_LIGHTING', category: 'emergencySupplies', applicable: always, met: (s) => c(s, 'lf_lighting') === 1, findingId: 'F_LIGHTING' },

  { id: 'O_BULLETIN', category: 'officialInformation', applicable: always, met: (s) => f(s, 'BULLETIN_CHECKED_EARLY'), findingId: 'F_BULLETIN' },
  { id: 'O_UPDATE', category: 'officialInformation', applicable: (s) => happened(s, 'EV06'), met: (s) => f(s, 'UPDATE_READ'), findingId: 'F_UPDATE' },
  { id: 'O_RUMOR', category: 'officialInformation', applicable: (s) => happened(s, 'EV07'), met: (s) => f(s, 'RUMOR_VERIFIED') && !f(s, 'RUMOR_FORWARDED'), findingId: 'F_RUMOR' },
  { id: 'O_POST_UPDATES', category: 'officialInformation', applicable: (s) => happened(s, 'EV15'), met: (s) => f(s, 'POST_STORM_UPDATES_CHECKED'), findingId: 'F_POST_UPDATES' },

  { id: 'O_FAMILY_MEETING', category: 'householdCoordination', applicable: (s) => sel.hasOthers(s.household), met: (s) => f(s, 'FAMILY_MEETING_DONE'), findingId: 'F_FAMILY_MEETING' },
  { id: 'O_COMMUNICATION', category: 'householdCoordination', applicable: always, met: (s) => f(s, 'COMMUNICATION_PLAN_READY'), findingId: 'F_COMMUNICATION' },
  { id: 'O_ACCOUNTED', category: 'householdCoordination', applicable: always, met: (s) => f(s, 'MEMBERS_ACCOUNTED'), findingId: 'F_ACCOUNTED' },

  { id: 'O_DESTINATION', category: 'evacuationPreparedness', applicable: always, met: (s) => f(s, 'EVACUATION_CENTER_KNOWN'), findingId: 'F_DESTINATION' },
  { id: 'O_ADVISORY_RESPONSE', category: 'evacuationPreparedness', applicable: (s) => s.environment.evacuationAdvisoryIssued, met: (s) => s.evacuation.completed, findingId: 'F_ADVISORY_RESPONSE' },
  { id: 'O_GO_BAG_BROUGHT', category: 'evacuationPreparedness', applicable: (s) => s.evacuation.departedAtMinute !== null, met: (s) => f(s, 'GO_BAG_BROUGHT'), findingId: 'F_GO_BAG_BROUGHT' },
  { id: 'O_DOCUMENTS', category: 'evacuationPreparedness', applicable: always, met: (s) => c(s, 'lf_documentsSafe') === 1, findingId: 'F_DOCUMENTS' },

  { id: 'O_MEDICATION', category: 'householdNeeds', applicable: (s) => sel.needsEssentialMedication(s.household) || sel.hasMedicalEquipment(s.household),
    met: (s) => f(s, 'MEDICATION_PACKED') || f(s, 'MEDICAL_CONTINUITY_PLANNED'), findingId: 'F_MEDICATION' },
  // Privacy-preserving: when the answer was unknown/undisclosed, checking the cabinet counts; packing is not required.
  { id: 'O_MEDICAL_CHECK', category: 'householdNeeds', applicable: (s) => s.household.medical.essentialMedication === 'unknown' || s.household.medical.essentialMedication === 'undisclosed',
    met: (s) => f(s, 'MEDICAL_SUPPLIES_CHECKED'), findingId: 'F_MEDICAL_CHECK' },
  { id: 'O_ASSISTANCE', category: 'householdNeeds', applicable: (s) => sel.assistanceNeeded(s.household), met: (s) => f(s, 'ASSISTANCE_ARRANGED'), findingId: 'F_ASSISTANCE' },
  { id: 'O_PETS', category: 'householdNeeds', applicable: (s) => sel.hasPets(s.household), met: (s) => f(s, 'PET_SUPPLIES_READY'), findingId: 'F_PETS' },
  { id: 'O_CHILD', category: 'householdNeeds', applicable: (s) => sel.hasInfants(s.household), met: (s) => f(s, 'CHILD_SUPPLIES_READY'), findingId: 'F_CHILD' },
  { id: 'O_POWERED_EQUIPMENT', category: 'householdNeeds', applicable: (s) => sel.usesPoweredEquipment(s.household),
    met: (s) => c(s, 'lf_powerBank') === 1 || f(s, 'MEDICAL_CONTINUITY_PLANNED'), findingId: 'F_POWERED_EQUIPMENT' },
  { id: 'O_WARNING_SUPPORT', category: 'householdNeeds', applicable: (s) => s.household.medical.warningAssistance === 'yes',
    met: (s) => f(s, 'FAMILY_MEETING_DONE') || f(s, 'COMMUNICATION_PLAN_READY'), findingId: 'F_WARNING_SUPPORT' },

  { id: 'O_HOME_SECURED', category: 'hazardAwareness', applicable: always,
    met: (s) => f(s, 'LOOSE_ITEMS_SECURED') || f(s, 'ROOF_SECURED') || c(s, 'windowsBoarded') > 0, findingId: 'F_HOME_SECURED' },
  { id: 'O_FLOOD_PREP', category: 'hazardAwareness', applicable: (s) => sel.floodProne(s.household), met: (s) => f(s, 'BELONGINGS_RAISED') || f(s, 'GATE_SANDBAGGED'), findingId: 'F_FLOOD_PREP' },
  { id: 'O_HAZARD_RESPONSE', category: 'hazardAwareness', applicable: (s) => happened(s, 'EV10'),
    met: (s) => resolvedWith(s, 'EV10').some((a) => a === 'MOVE_TO_SAFER_ROOM' || a === 'SEEK_HELP' || a === 'ACCOUNT_MEMBERS'), findingId: 'F_HAZARD_RESPONSE' },
  { id: 'O_NO_UNSAFE', category: 'hazardAwareness', applicable: always, met: (s) => !f(s, 'UNSAFE_ACTION_ATTEMPTED'), findingId: 'F_UNSAFE_ACTION' },
];
