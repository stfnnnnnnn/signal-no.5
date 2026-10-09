// Action registry (GD §8 preparation actions + event choices). Static, engine-owned content.
// Time costs are fixed simulated minutes and never scale with the clock speed (GD §3).
// safetyRuleId links an action to reviewed guidance (placeholder IDs pending content review).
import type { FlagId, ItemId } from '../../shared/contracts/ids';
import type { HouseholdProfile } from '../../shared/contracts/household';
import type { GameState } from '../../shared/contracts/state';
import * as sel from '../selectors';
import { communityDeadline } from './community';
import { PACKABLE_ITEMS } from './items';

export interface Ctx { s: GameState; p: HouseholdProfile }
export interface Requirement { test: (c: Ctx) => boolean; reason: string }

export interface ActionDef {
  id: string;
  label: string;
  /** 'world' actions are offered at interactables; 'event' actions only as event choices. */
  scope: 'world' | 'event' | 'both';
  interactables: string[];
  timeCostMinutes: number;
  /** Hidden entirely when false (household-specific). */
  applicable?: (c: Ctx) => boolean;
  requires: Requirement[];
  maxUses?: number | ((c: Ctx) => number);
  effect: (c: Ctx) => void;
  objectiveIds?: string[];
  safetyRuleId?: string;
  /** Deliberately unsafe choice offered for learning; never rewarded (debrief explains). */
  unsafe?: boolean;
  /**
   * discovery: reveals information, 0 game minutes, never pauses the clock; preparation: changes resources/flags
   * at a fixed cost; conversation: short contextual talk. Default preparation.
   */
  kind?: 'discovery' | 'preparation' | 'conversation';
}

const flag = (s: GameState, f: FlagId) => s.flags[f] === true;
const set = (s: GameState, ...fs: FlagId[]) => { for (const f of fs) s.flags[f] = true; };
const add = (bag: GameState['house'], id: ItemId, n: number) => { bag[id] = (bag[id] ?? 0) + n; };
const take = (bag: GameState['house'], id: ItemId, n: number) => {
  const left = (bag[id] ?? 0) - n;
  if (left > 0) bag[id] = left; else delete bag[id];
};
const bump = (s: GameState, key: string, n = 1) => { s.counters[key] = (s.counters[key] ?? 0) + n; };
const moveToBag = (s: GameState, id: ItemId, n: number) => {
  const q = Math.min(n, s.house[id] ?? 0);
  if (q > 0) { take(s.house, id, q); add(s.goBag, id, q); }
};

const not = (f: FlagId, reason: string): Requirement => ({ test: ({ s }) => !flag(s, f), reason });
const needItem = (id: ItemId, reason: string): Requirement => ({ test: ({ s }) => sel.itemTotal(s, id) > 0, reason });
const inHouse = (id: ItemId, reason: string): Requirement => ({ test: ({ s }) => sel.houseItem(s, id) > 0, reason });
const outdoorSafe: Requirement = { test: ({ s }) => sel.isOutdoorSafe(s), reason: 'Conditions outside are no longer safe for this task.' };
const atScene = (scene: GameState['scene']): Requirement => ({ test: ({ s }) => s.scene === scene, reason: `Only available in ${scene}.` });
const preLandfall: Requirement = { test: ({ s }) => sel.inPreLandfall(s), reason: 'Not possible after landfall.' };
const tap: Requirement = { test: ({ s }) => s.environment.tapWaterAvailable, reason: 'Tap water is not available.' };
const power: Requirement = { test: ({ s }) => s.environment.powerAvailable, reason: 'There is no electricity.' };
/** The action (of the given fixed cost) must be finished by the deadline, not merely started before it. */
const finishBy = (deadline: (s: GameState) => number, minutes: number, reason: string): Requirement => ({ test: ({ s }) => s.clock.gameMinutes + minutes <= deadline(s), reason });

function checkInformation({ s }: Ctx) {
  set(s, 'BULLETIN_CHECKED');
  if (s.clock.gameMinutes < 24 * sel.HOUR) set(s, 'BULLETIN_CHECKED_EARLY');
  if (s.environment.landfallRevealed) set(s, 'UPDATE_READ');
  if (s.environment.evacuationAdvisoryIssued) { set(s, 'EVACUATION_CENTER_KNOWN'); s.evacuation.destinationKnown = true; }
  if (s.phase === 'aftermath') set(s, 'POST_STORM_UPDATES_CHECKED');
  if (!s.environment.powerAvailable) s.phoneBattery = Math.max(0, s.phoneBattery - 5);
}

function packGoBag({ s, p }: Ctx) {
  for (const id of PACKABLE_ITEMS) {
    if (id === 'WATER') moveToBag(s, 'WATER', Math.max(0, 3 * p.size - (s.goBag.WATER ?? 0)));
    else if (id === 'FOOD') moveToBag(s, 'FOOD', Math.max(0, p.size - (s.goBag.FOOD ?? 0)));
    else if ((s.goBag[id] ?? 0) === 0) moveToBag(s, id, 1);
  }
  if ((s.goBag.MEDICATION ?? 0) > 0) set(s, 'MEDICATION_PACKED');
  if ((s.goBag.PET_SUPPLIES ?? 0) > 0) set(s, 'PET_SUPPLIES_READY');
  if ((s.goBag.CHILD_CARE_SUPPLIES ?? 0) > 0) set(s, 'CHILD_SUPPLIES_READY');
}

/** Travel time to the evacuation destination (GS §12, age-based penalty deprecated: R4). */
export function evacuationTravelMinutes(s: GameState, p: HouseholdProfile): number {
  let m = 2 * sel.HOUR;
  if (!s.evacuation.destinationKnown) m += 90;
  if (sel.assistanceNeeded(p)) m += sel.HOUR;
  return m;
}

const evacuationOpen: Requirement[] = [
  { test: ({ s }) => s.environment.evacuationAdvisoryIssued, reason: 'No evacuation advisory has been issued for your area.' },
  { test: ({ s }) => s.evacuation.departedAtMinute === null, reason: 'Your household has already left.' },
  preLandfall,
  { test: ({ s }) => s.environment.roadStatus !== 'closed', reason: 'The route is closed. Seek official assistance instead.' },
  // The whole trip must fit before the scheduled route closure (not just the departure): no arriving on a closed road.
  { test: ({ s, p }) => s.clock.gameMinutes + evacuationTravelMinutes(s, p) <= sel.routeClosureMinute(s),
    reason: 'Too late to travel safely: the route is expected to close before you would arrive. Stay indoors in the safest room and follow official instructions.' },
  { test: ({ s, p }) => !sel.assistanceNeeded(p) || flag(s, 'ASSISTANCE_ARRANGED'), reason: 'Arrange help for the household member who needs assistance first.' },
];

export const ACTIONS: ActionDef[] = [
  // ---- GD §8 preparation actions -------------------------------------------------------------
  { id: 'GET_TOOLS', label: 'Retrieve tools', scope: 'world', interactables: ['UTILITY_TOOLS'], timeCostMinutes: 15, maxUses: 1,
    requires: [atScene('HOUSE')], effect: ({ s }) => { set(s, 'TOOLS_RETRIEVED'); if (sel.houseItem(s, 'TOOLS') === 0) add(s.house, 'TOOLS', 1); } },
  { id: 'BOARD_WINDOW', label: 'Prepare a window', scope: 'world', interactables: ['WINDOW'], timeCostMinutes: 90, maxUses: 4,
    requires: [needItem('TOOLS', 'You need tools first.'), outdoorSafe], effect: ({ s }) => bump(s, 'windowsBoarded'), objectiveIds: ['O_HOME_SECURED'], safetyRuleId: 'SR_SECURE_HOME_EARLY' },
  { id: 'SECURE_ROOF', label: 'Arrange safe roof preparation', scope: 'world', interactables: ['UTILITY_LADDER'], timeCostMinutes: 180, maxUses: 1,
    applicable: ({ p }) => sel.roofNeedsSecuring(p), requires: [needItem('TOOLS', 'You need tools first.'), outdoorSafe],
    effect: ({ s }) => set(s, 'ROOF_SECURED'), objectiveIds: ['O_HOME_SECURED'], safetyRuleId: 'SR_SECURE_HOME_EARLY' },
  { id: 'SECURE_OBJECTS', label: 'Secure loose items', scope: 'world', interactables: ['WINDOW', 'ENTRANCE_DOOR'], timeCostMinutes: 30, maxUses: 1,
    requires: [outdoorSafe], effect: ({ s }) => set(s, 'LOOSE_ITEMS_SECURED'), objectiveIds: ['O_HOME_SECURED'], safetyRuleId: 'SR_SECURE_HOME_EARLY' },
  { id: 'FILL_CONTAINERS', label: 'Fill water containers', scope: 'world', interactables: ['KITCHEN_SINK'], timeCostMinutes: 30, maxUses: 2,
    requires: [tap], effect: ({ s }) => add(s.house, 'WATER', 15), objectiveIds: ['O_WATER'], safetyRuleId: 'SR_STORE_WATER' },
  { id: 'FILL_DRUM', label: 'Fill the water drum', scope: 'world', interactables: ['UTILITY_DRUM'], timeCostMinutes: 60, maxUses: 1,
    requires: [tap], effect: ({ s }) => add(s.house, 'WATER', 60), objectiveIds: ['O_WATER'], safetyRuleId: 'SR_STORE_WATER' },
  { id: 'PACK_GO_BAG', label: 'Pack the go-bag', scope: 'both', interactables: ['ENTRANCE_BAG', 'BEDROOM_CLOTHES'], timeCostMinutes: 90,
    requires: [{ test: ({ s }) => PACKABLE_ITEMS.some((id) => sel.houseItem(s, id) > 0 && (id === 'WATER' || id === 'FOOD' || (s.goBag[id] ?? 0) === 0)), reason: 'Nothing left to pack.' }, preLandfall],
    effect: packGoBag, objectiveIds: ['O_GO_BAG'], safetyRuleId: 'SR_GO_BAG' },
  { id: 'CHARGE_PHONE', label: 'Charge the phone', scope: 'world', interactables: ['LIVING_PHONE'], timeCostMinutes: 120,
    requires: [power, { test: ({ s }) => s.phoneBattery < 100, reason: 'The phone is already full.' }], effect: ({ s }) => { s.phoneBattery = 100; } },
  { id: 'PROTECT_DOCUMENTS', label: 'Waterproof important documents', scope: 'world', interactables: ['BEDROOM_DOCUMENTS'], timeCostMinutes: 30,
    requires: [not('DOCUMENTS_PROTECTED', 'Documents are already protected.'), needItem('DOCUMENTS', 'No documents found.')],
    effect: ({ s }) => set(s, 'DOCUMENTS_PROTECTED'), objectiveIds: ['O_DOCUMENTS'], safetyRuleId: 'SR_PROTECT_DOCUMENTS' },
  { id: 'RAISE_BELONGINGS', label: 'Move belongings and supplies higher', scope: 'world', interactables: ['STAIRS'], timeCostMinutes: 120,
    requires: [not('BELONGINGS_RAISED', 'Belongings are already raised.'), preLandfall], effect: ({ s }) => set(s, 'BELONGINGS_RAISED', 'SUPPLIES_STORED_SAFELY'),
    objectiveIds: ['O_FLOOD_PREP'], safetyRuleId: 'SR_RAISE_BELONGINGS' },
  { id: 'FAMILY_MEETING', label: 'Discuss the household plan', scope: 'both', interactables: ['NPC'], timeCostMinutes: 30,
    applicable: ({ p }) => sel.hasOthers(p), requires: [not('FAMILY_MEETING_DONE', 'You already discussed the plan.')],
    effect: ({ s }) => set(s, 'FAMILY_MEETING_DONE', 'MEETING_POINT_KNOWN'), objectiveIds: ['O_FAMILY_MEETING'], safetyRuleId: 'SR_HOUSEHOLD_PLAN' },
  { id: 'CHECK_BULLETIN', label: 'Check official information', scope: 'world', interactables: ['LIVING_TV', 'LIVING_RADIO', 'LIVING_PHONE'], timeCostMinutes: 30,
    requires: [{ test: ({ s }) => s.environment.powerAvailable || s.phoneBattery >= 10 || sel.itemTotal(s, 'RADIO') > 0, reason: 'No working source of information.' }],
    effect: checkInformation, objectiveIds: ['O_BULLETIN'], safetyRuleId: 'SR_OFFICIAL_INFORMATION' },
  { id: 'SANDBAG_GATE', label: 'Prepare the gate with sandbags', scope: 'world', interactables: ['ENTRANCE_DOOR'], timeCostMinutes: 90, maxUses: 1,
    applicable: ({ p }) => !sel.isApartmentLike(p), requires: [needItem('SANDBAGS', 'You need sandbags (available at the shop).'), outdoorSafe],
    effect: ({ s }) => { set(s, 'GATE_SANDBAGGED'); take(s.house, 'SANDBAGS', 1); }, objectiveIds: ['O_FLOOD_PREP'], safetyRuleId: 'SR_FLOOD_PREP' },
  { id: 'SHOP_TRIP', label: 'Go to the community shop', scope: 'both', interactables: ['ENTRANCE_DOOR'], timeCostMinutes: 60,
    requires: [atScene('HOUSE'), { test: ({ s }) => s.environment.shopOpen, reason: 'The shop is closed.' },
      { test: ({ s }) => s.environment.roadStatus === 'open', reason: 'The road is not open.' },
      { test: ({ s }) => !s.environment.evacuationAdvisoryIssued, reason: 'Nonessential trips are unavailable under the evacuation advisory.' }, outdoorSafe],
    effect: ({ s }) => { s.scene = 'SHOP'; s.shop.visitCount++; } },
  { id: 'RETURN_HOME', label: 'Return home', scope: 'world', interactables: ['SHOP_EXIT'], timeCostMinutes: 60,
    requires: [atScene('SHOP')], effect: ({ s }) => { s.scene = 'HOUSE'; } },
  { id: 'BARANGAY_VISIT', label: 'Visit the barangay hall', scope: 'world', interactables: ['ENTRANCE_DOOR'], timeCostMinutes: 90, maxUses: 1,
    requires: [atScene('HOUSE'), { test: ({ s }) => s.environment.roadStatus !== 'closed', reason: 'The road is closed.' }, outdoorSafe],
    effect: ({ s }) => { set(s, 'BARANGAY_VISITED', 'EVACUATION_CENTER_KNOWN'); s.evacuation.destinationKnown = true; }, objectiveIds: ['O_DESTINATION'], safetyRuleId: 'SR_KNOW_DESTINATION' },
  { id: 'PACK_MEDICATION', label: 'Prepare essential medication and supplies', scope: 'both', interactables: ['BEDROOM_MEDICATION'], timeCostMinutes: 30,
    applicable: ({ p }) => sel.needsEssentialMedication(p) || sel.hasMedicalEquipment(p),
    requires: [not('MEDICATION_PACKED', 'Already prepared.'), inHouse('MEDICATION', 'No medication supply at home (a refill is available at the shop).')],
    effect: ({ s }) => { moveToBag(s, 'MEDICATION', 1); set(s, 'MEDICATION_PACKED'); }, objectiveIds: ['O_MEDICATION'], safetyRuleId: 'SR_MEDICATION_CONTINUITY' },
  { id: 'PREPARE_PET_SUPPLIES', label: 'Organise pet supplies', scope: 'both', interactables: ['PET_AREA'], timeCostMinutes: 30,
    applicable: ({ p }) => sel.hasPets(p), requires: [not('PET_SUPPLIES_READY', 'Already prepared.'), inHouse('PET_SUPPLIES', 'No pet supplies at home (available at the shop).')],
    effect: ({ s }) => { moveToBag(s, 'PET_SUPPLIES', 1); set(s, 'PET_SUPPLIES_READY'); }, objectiveIds: ['O_PETS'], safetyRuleId: 'SR_PETS' },
  { id: 'PREPARE_CHILD_SUPPLIES', label: 'Prepare child-care supplies', scope: 'both', interactables: ['BEDROOM_CLOTHES'], timeCostMinutes: 30,
    applicable: ({ p }) => sel.hasInfants(p), requires: [not('CHILD_SUPPLIES_READY', 'Already prepared.'), inHouse('CHILD_CARE_SUPPLIES', 'No child-care supplies at home (available at the shop).')],
    effect: ({ s }) => { moveToBag(s, 'CHILD_CARE_SUPPLIES', 1); set(s, 'CHILD_SUPPLIES_READY'); }, objectiveIds: ['O_CHILD'], safetyRuleId: 'SR_CHILD_SUPPLIES' },
  { id: 'ARRANGE_ASSISTANCE', label: 'Coordinate help for a household member', scope: 'both', interactables: ['NPC', 'LIVING_PHONE'], timeCostMinutes: 60,
    applicable: ({ p }) => sel.assistanceNeeded(p), requires: [not('ASSISTANCE_ARRANGED', 'Help is already arranged.')],
    effect: ({ s }) => set(s, 'ASSISTANCE_ARRANGED'), objectiveIds: ['O_ASSISTANCE'], safetyRuleId: 'SR_ASSISTANCE' },
  { id: 'PREPARE_COMMUNICATION', label: 'Set a communication plan', scope: 'world', interactables: ['LIVING_PHONE'], timeCostMinutes: 30,
    requires: [not('COMMUNICATION_PLAN_READY', 'A communication plan is already set.')],
    effect: ({ s }) => set(s, 'COMMUNICATION_PLAN_READY', 'MEETING_POINT_KNOWN'), objectiveIds: ['O_COMMUNICATION'], safetyRuleId: 'SR_COMMUNICATION' },
  { id: 'INSPECT_SUPPLIES', label: 'Inspect supplies', scope: 'both', interactables: ['KITCHEN_CABINET', 'UTILITY_SHELF', 'KITCHEN_SINK'], timeCostMinutes: 0, kind: 'discovery',
    requires: [], effect: ({ s }) => bump(s, 'suppliesInspected') },
  { id: 'INSPECT_GO_BAG', label: 'Inspect the go-bag', scope: 'both', interactables: ['ENTRANCE_BAG'], timeCostMinutes: 0, kind: 'discovery',
    requires: [], effect: ({ s }) => bump(s, 'goBagInspected') },
  { id: 'CHECK_ESSENTIAL_SUPPLIES', label: 'Check the medicine cabinet', scope: 'both', interactables: ['BEDROOM_MEDICATION'], timeCostMinutes: 0, kind: 'discovery',
    applicable: ({ p }) => p.medical.essentialMedication !== 'no' || sel.hasMedicalEquipment(p), requires: [],
    effect: ({ s }) => set(s, 'MEDICAL_SUPPLIES_CHECKED'), objectiveIds: ['O_MEDICAL_CHECK'], safetyRuleId: 'SR_MEDICATION_CONTINUITY' },
  { id: 'CHARGE_POWER_BANK', label: 'Charge the power bank', scope: 'world', interactables: ['LIVING_PHONE'], timeCostMinutes: 60,
    requires: [power, needItem('POWER_BANK', 'You have no power bank (available at the shop).'), not('POWER_BANK_CHARGED', 'The power bank is already charged.')],
    effect: ({ s }) => set(s, 'POWER_BANK_CHARGED') },
  // ---- Community assistance (B06 Bayanihan; allowlist in community.ts) ----------------------------
  { id: 'SHARE_VERIFIED_ADVISORY', label: 'Share the verified official advisory with neighbours', scope: 'both', interactables: ['LIVING_PHONE'], timeCostMinutes: 15, maxUses: 1,
    requires: [{ test: ({ s }) => flag(s, 'BULLETIN_CHECKED'), reason: 'Check official information first; only verified information should be shared.' },
      { test: ({ s }) => s.environment.powerAvailable || s.phoneBattery >= 10, reason: 'The phone battery is too low.' },
      finishBy(communityDeadline('SHARE_VERIFIED_ADVISORY'), 15, 'It is too late to send updates now; keep the phone for your household.')],
    effect: ({ s }) => { set(s, 'VERIFIED_INFO_SHARED'); if (!s.environment.powerAvailable) s.phoneBattery = Math.max(0, s.phoneBattery - 5); },
    safetyRuleId: 'SR_SHARE_VERIFIED_INFORMATION' },
  { id: 'HELP_COMMUNITY_PREPARATION', label: 'Help neighbours with the community preparedness activity', scope: 'both', interactables: ['ENTRANCE_DOOR'], timeCostMinutes: 60, maxUses: 1,
    requires: [atScene('HOUSE'), outdoorSafe, { test: ({ s }) => !s.environment.evacuationAdvisoryIssued, reason: 'Follow the evacuation advisory now; community activities have stopped.' },
      { test: ({ s }) => s.environment.roadStatus !== 'closed', reason: 'The road is closed.' },
      finishBy(communityDeadline('HELP_COMMUNITY_PREPARATION'), 60, 'Not enough time to finish safely before conditions worsen.')],
    effect: ({ s }) => set(s, 'COMMUNITY_PREP_HELPED'), safetyRuleId: 'SR_HELP_COMMUNITY_SAFELY' },
  { id: 'FOLLOW_EVACUATION', label: 'Leave for the evacuation destination', scope: 'both', interactables: ['ENTRANCE_DOOR'], timeCostMinutes: 0,
    requires: evacuationOpen, effect: ({ s, p }) => {
      s.evacuation.decision = 'comply';
      s.evacuation.departedAtMinute = s.clock.gameMinutes;
      s.evacuation.arrivalAtMinute = s.clock.gameMinutes + evacuationTravelMinutes(s, p);
      if (sel.goBagStatus(s) !== 'none') set(s, 'GO_BAG_BROUGHT');
      s.phase = 'evacuation';
      s.scene = 'STREET';
    }, objectiveIds: ['O_ADVISORY_RESPONSE'], safetyRuleId: 'SR_FOLLOW_OFFICIAL_ADVISORY' },

  // ---- Event choices --------------------------------------------------------------------------
  { id: 'CHECK_ADVISORY', label: 'Check the official advisory', scope: 'event', interactables: [], timeCostMinutes: 30, requires: [], effect: checkInformation, objectiveIds: ['O_BULLETIN'], safetyRuleId: 'SR_OFFICIAL_INFORMATION' },
  { id: 'REVIEW_PLAN', label: 'Review the household plan', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [], effect: ({ s }) => bump(s, 'planReviewed') },
  { id: 'DEFER', label: 'Not now', scope: 'event', interactables: [], timeCostMinutes: 0, requires: [], effect: ({ s }) => bump(s, 'deferrals') },
  { id: 'ASSIGN_TASKS', label: 'Assign preparation tasks', scope: 'event', interactables: [], timeCostMinutes: 30, applicable: ({ p }) => sel.hasOthers(p), requires: [],
    effect: ({ s }) => { set(s, 'FAMILY_MEETING_DONE'); bump(s, 'tasksAssigned'); }, objectiveIds: ['O_FAMILY_MEETING'], safetyRuleId: 'SR_HOUSEHOLD_PLAN' },
  { id: 'PRIORITIZE_SUPPLIES', label: 'Prioritise what is missing', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [], effect: ({ s }) => bump(s, 'suppliesPrioritized') },
  { id: 'REVIEW_MED_SUPPLIES', label: 'Review essential supplies', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [], effect: ({ s }) => bump(s, 'medicalReviewed') },
  { id: 'ARRANGE_CONTINUITY', label: 'Plan how essential supplies continue', scope: 'event', interactables: [], timeCostMinutes: 30, requires: [],
    effect: ({ s }) => set(s, 'MEDICAL_CONTINUITY_PLANNED'), objectiveIds: ['O_MEDICATION'], safetyRuleId: 'SR_MEDICATION_CONTINUITY' },
  { id: 'READ_UPDATE', label: 'Read the updated advisory', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [],
    effect: (c) => { checkInformation(c); set(c.s, 'UPDATE_READ'); }, objectiveIds: ['O_UPDATE'], safetyRuleId: 'SR_OFFICIAL_INFORMATION' },
  { id: 'REASSESS_PLAN', label: 'Reassess the plan', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [], effect: ({ s }) => bump(s, 'planReassessed') },
  { id: 'VERIFY_RUMOR', label: 'Verify with an official source', scope: 'event', interactables: [], timeCostMinutes: 30, requires: [],
    effect: ({ s }) => set(s, 'RUMOR_VERIFIED'), objectiveIds: ['O_RUMOR'], safetyRuleId: 'SR_VERIFY_INFORMATION' },
  { id: 'IGNORE_RUMOR', label: 'Ignore the message', scope: 'event', interactables: [], timeCostMinutes: 0, requires: [], effect: ({ s }) => bump(s, 'rumorIgnored') },
  { id: 'FORWARD_RUMOR', label: 'Forward the message', scope: 'event', interactables: [], timeCostMinutes: 5, requires: [], unsafe: true,
    effect: ({ s }) => set(s, 'RUMOR_FORWARDED'), safetyRuleId: 'SR_VERIFY_INFORMATION' },
  { id: 'REVIEW_ADVISORY', label: 'Review the evacuation advisory', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [],
    effect: (c) => { checkInformation(c); set(c.s, 'ADVISORY_REVIEWED'); }, objectiveIds: ['O_ADVISORY_RESPONSE'], safetyRuleId: 'SR_FOLLOW_OFFICIAL_ADVISORY' },
  { id: 'PREPARE_TO_EVACUATE', label: 'Prepare to leave', scope: 'event', interactables: [], timeCostMinutes: 60, requires: [preLandfall],
    effect: (c) => { set(c.s, 'PREPARED_TO_EVACUATE'); packGoBag(c); }, objectiveIds: ['O_ADVISORY_RESPONSE', 'O_GO_BAG'], safetyRuleId: 'SR_FOLLOW_OFFICIAL_ADVISORY' },
  { id: 'DELAY_EVACUATION', label: 'Wait for now', scope: 'event', interactables: [], timeCostMinutes: 0, requires: [],
    effect: ({ s }) => { s.evacuation.decision = 'delay'; bump(s, 'evacuationDelays'); } },
  { id: 'SEEK_ASSISTANCE', label: 'Ask officials for assistance', scope: 'event', interactables: [], timeCostMinutes: 30, requires: [],
    effect: ({ s, p }) => { s.evacuation.decision = 'seekAssistance'; if (sel.assistanceNeeded(p)) set(s, 'ASSISTANCE_ARRANGED'); set(s, 'EVACUATION_CENTER_KNOWN'); s.evacuation.destinationKnown = true; },
    objectiveIds: ['O_ASSISTANCE', 'O_DESTINATION'], safetyRuleId: 'SR_ASSISTANCE' },
  { id: 'USE_FLASHLIGHT', label: 'Use backup lighting', scope: 'event', interactables: [], timeCostMinutes: 5,
    requires: [{ test: ({ s }) => sel.hasLighting(s), reason: 'You have no flashlight or power bank.' }], effect: ({ s }) => set(s, 'BACKUP_LIGHTING_USED'), objectiveIds: ['O_LIGHTING'], safetyRuleId: 'SR_SAFE_LIGHTING' },
  { id: 'USE_POWER_BANK', label: 'Charge the phone from the power bank', scope: 'event', interactables: [], timeCostMinutes: 10,
    requires: [needItem('POWER_BANK', 'You have no power bank.')], effect: ({ s }) => { s.phoneBattery = Math.min(100, s.phoneBattery + 40); } },
  { id: 'CHECK_HOUSEHOLD_NEEDS', label: 'Check on everyone’s needs', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [], effect: ({ s }) => bump(s, 'needsChecked') },
  { id: 'MOVE_TO_SAFER_ROOM', label: 'Move everyone to the safest room', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [],
    effect: ({ s }) => bump(s, 'saferRoom'), objectiveIds: ['O_HAZARD_RESPONSE'], safetyRuleId: 'SR_SHELTER_IN_PLACE' },
  { id: 'ACCOUNT_MEMBERS', label: 'Account for every household member', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [],
    effect: ({ s }) => set(s, 'MEMBERS_ACCOUNTED'), objectiveIds: ['O_ACCOUNTED'], safetyRuleId: 'SR_ACCOUNT_MEMBERS' },
  { id: 'SEEK_HELP', label: 'Call for official help', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [],
    effect: ({ s }) => { bump(s, 'helpRequested'); if (s.environment.shelterCondition === 'unsafe') s.evacuation.rescueOutcome = true; }, objectiveIds: ['O_HAZARD_RESPONSE'], safetyRuleId: 'SR_SEEK_HELP' },
  { id: 'GO_OUTSIDE_TO_CHECK', label: 'Go outside to look', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [], unsafe: true,
    effect: ({ s }) => set(s, 'UNSAFE_ACTION_ATTEMPTED'), safetyRuleId: 'SR_STAY_INDOORS' },
  { id: 'HELP_WITH_NEED', label: 'Make a plan for this need', scope: 'event', interactables: [], timeCostMinutes: 30, requires: [],
    effect: ({ s, p }) => {
      if (sel.assistanceNeeded(p)) set(s, 'ASSISTANCE_ARRANGED');
      if (sel.hasPets(p) && sel.houseItem(s, 'PET_SUPPLIES') > 0) { moveToBag(s, 'PET_SUPPLIES', 1); set(s, 'PET_SUPPLIES_READY'); }
      if (sel.usesPoweredEquipment(p)) set(s, 'MEDICAL_CONTINUITY_PLANNED');
      bump(s, 'dilemmaHandled');
    }, objectiveIds: ['O_ASSISTANCE', 'O_PETS', 'O_MEDICATION'], safetyRuleId: 'SR_HOUSEHOLD_NEEDS' },
  { id: 'REVIEW_NEEDS', label: 'Review household needs', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [], effect: ({ s }) => bump(s, 'needsReviewed') },
  { id: 'REVIEW_RESOURCES', label: 'Review water, food and supplies', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [],
    effect: ({ s }) => set(s, 'RESOURCES_REVIEWED'), objectiveIds: ['O_RECOVERY'] },
  { id: 'VERIFY_GUIDANCE', label: 'Check official recovery updates', scope: 'event', interactables: [], timeCostMinutes: 15, requires: [],
    effect: (c) => { checkInformation(c); set(c.s, 'POST_STORM_UPDATES_CHECKED'); }, objectiveIds: ['O_POST_UPDATES'], safetyRuleId: 'SR_OFFICIAL_INFORMATION' },
  { id: 'PLAN_RECOVERY', label: 'Plan recovery priorities', scope: 'event', interactables: [], timeCostMinutes: 30, requires: [],
    effect: ({ s }) => set(s, 'RECOVERY_PLANNED'), objectiveIds: ['O_RECOVERY'] },
  { id: 'FINISH_REFLECTION', label: 'Review and finish', scope: 'event', interactables: [], timeCostMinutes: 0, requires: [],
    effect: ({ s }) => set(s, 'REFLECTION_DONE') },
];

export const ACTION_BY_ID: ReadonlyMap<string, ActionDef> = new Map(ACTIONS.map((a) => [a.id, a]));
