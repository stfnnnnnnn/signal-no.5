// Event catalog EV01–EV16 (GD §10). The ENGINE selects the event, its variant and its ordered choices.
// Fallback text is reviewed static content (placeholder wording pending safety review, see
// SPEC_RECONCILIATION §3). `facts` are the only scenario facts the local AI may restate.
import type { EventId } from '../../shared/contracts/ids';
import type { GameState } from '../../shared/contracts/state';
import * as sel from '../selectors';
import type { Ctx } from './actions';

export interface Fallback { dialogue: string; description: string }

export interface EventDef {
  id: EventId;
  title: string;
  mandatory: boolean;
  /** Interaction trigger (first interaction opens the event); time triggers live in storm.ts. */
  interactables?: string[];
  eligible: (c: Ctx) => boolean;
  variant: (c: Ctx) => string;
  /** Ordered choices for the selected variant (engine-owned; filtered by applicability). */
  choices: (c: Ctx, variant: string) => string[];
  speaker: (c: Ctx) => string;
  fallback: Record<string, Fallback>;
  facts: (c: Ctx, variant: string) => string[];
}

const done = (s: GameState, eventId: EventId) => s.eventHistory.some((e) => e.eventId === eventId && e.resolvedWith !== null);
export const householdSpeaker = ({ p }: Ctx) => p.members.find((m) => m.visibleNpc)?.npcId ?? 'NPC_NEIGHBOR';
const narrator = () => 'NARRATOR';
const hour = (s: GameState) => Math.floor(s.clock.gameMinutes / sel.HOUR);
const landfallIn = (s: GameState) => Math.max(0, Math.round(sel.minutesToLandfall(s) / sel.HOUR));

export const EVENTS: EventDef[] = [
  { id: 'EV01', title: 'Initial advisory', mandatory: true, eligible: () => true,
    variant: ({ p }) => (sel.floodProne(p) ? 'EV01__FLOOD_PRONE' : 'EV01__DEFAULT'),
    choices: () => ['CHECK_ADVISORY', 'REVIEW_PLAN', 'DEFER'], speaker: narrator,
    fallback: {
      EV01__DEFAULT: { dialogue: 'A fictional typhoon advisory is in effect. The storm is expected in about two days.', description: 'The television shows a weather bulletin. The house is quiet.' },
      EV01__FLOOD_PRONE: { dialogue: 'A fictional typhoon advisory is in effect. Your area has flooded before, so the next two days matter.', description: 'Rain clouds gather on the horizon as the bulletin plays.' },
    },
    facts: ({ s }) => ['A fictional typhoon advisory has been issued.', `Landfall is scheduled in about ${landfallIn(s)} hours.`] },
  { id: 'EV02', title: 'Go-bag inspection', mandatory: false, interactables: ['ENTRANCE_BAG'],
    eligible: ({ s }) => !done(s, 'EV02') && sel.goBagStatus(s) !== 'ready',
    variant: ({ s }) => (sel.goBagStatus(s) === 'none' ? 'EV02__EMPTY' : 'EV02__PARTIAL'),
    choices: () => ['INSPECT_GO_BAG', 'PACK_GO_BAG', 'DEFER'], speaker: householdSpeaker,
    fallback: {
      EV02__EMPTY: { dialogue: 'Our go-bag is still empty. Should we start packing it?', description: 'An empty bag sits by the front door.' },
      EV02__PARTIAL: { dialogue: 'The go-bag has a few things in it, but not everything yet.', description: 'A half-packed bag waits by the door.' },
    },
    facts: ({ s }) => [`The go-bag is ${sel.goBagStatus(s)}.`] },
  { id: 'EV03', title: 'Household coordination', mandatory: false, interactables: ['NPC'],
    eligible: ({ s, p }) => sel.hasOthers(p) && !s.flags.FAMILY_MEETING_DONE && !done(s, 'EV03'),
    variant: ({ p }) => (sel.assistanceNeeded(p) ? 'EV03__ASSISTANCE' : 'EV03__DEFAULT'),
    choices: () => ['FAMILY_MEETING', 'ASSIGN_TASKS', 'ARRANGE_ASSISTANCE', 'DEFER'], speaker: householdSpeaker,
    fallback: {
      EV03__DEFAULT: { dialogue: 'We should agree on who does what before the storm arrives.', description: 'The household gathers in the living room.' },
      EV03__ASSISTANCE: { dialogue: 'Someone in our home will need help getting ready. Let’s plan for that together.', description: 'The household gathers in the living room.' },
    },
    facts: () => ['The household has not yet agreed on a plan.'] },
  { id: 'EV04', title: 'Supply gap', mandatory: true,
    eligible: ({ s, p }) => !done(s, 'EV04'),
    variant: ({ s, p }) => {
      if (sel.needsEssentialMedication(p) && !s.flags.MEDICATION_PACKED && sel.itemTotal(s, 'MEDICATION') === 0) return 'EV04__MEDICATION_SUPPLY_GAP';
      if (sel.hasInfants(p) && sel.itemTotal(s, 'CHILD_CARE_SUPPLIES') === 0) return 'EV04__CHILD_SUPPLIES_GAP';
      if (sel.goBagStatus(s) === 'ready' && sel.itemTotal(s, 'WATER') >= sel.waterRequirement(p)) return 'EV04__SUPPLIES_READY';
      return 'EV04__SUPPLY_BUDGET_GAP';
    },
    choices: (_c, v) => (v === 'EV04__SUPPLIES_READY' ? ['INSPECT_SUPPLIES', 'DEFER'] : ['INSPECT_SUPPLIES', 'SHOP_TRIP', 'PRIORITIZE_SUPPLIES', 'DEFER']),
    speaker: householdSpeaker,
    fallback: {
      EV04__SUPPLY_BUDGET_GAP: { dialogue: 'We are short on some supplies, and money is tight. What matters most?', description: 'The cabinet is only partly stocked.' },
      EV04__CHILD_SUPPLIES_GAP: { dialogue: 'We do not have enough supplies for the little one yet.', description: 'The cabinet is only partly stocked.' },
      EV04__MEDICATION_SUPPLY_GAP: { dialogue: 'The essential medication supply is running low. We should sort that out.', description: 'An almost empty container sits on the shelf.' },
      EV04__SUPPLIES_READY: { dialogue: 'It looks like our supplies are in good shape.', description: 'The shelves are neatly stocked.' },
    },
    facts: ({ s, p }) => [`Stored water: ${sel.itemTotal(s, 'WATER')} L of a ${sel.waterRequirement(p)} L target.`, `Cash available: ₱${s.cash}.`] },
  { id: 'EV05', title: 'Medical preparedness', mandatory: false, interactables: ['BEDROOM_MEDICATION'],
    eligible: ({ s, p }) => (sel.needsEssentialMedication(p) || sel.hasMedicalEquipment(p)) && !done(s, 'EV05') && !(s.flags.MEDICATION_PACKED && s.flags.MEDICAL_CONTINUITY_PLANNED),
    variant: ({ p }) => (sel.usesPoweredEquipment(p) ? 'EV05__POWERED_EQUIPMENT' : 'EV05__ESSENTIAL_SUPPLIES'),
    choices: () => ['REVIEW_MED_SUPPLIES', 'PACK_MEDICATION', 'ARRANGE_CONTINUITY', 'DEFER'], speaker: householdSpeaker,
    fallback: {
      EV05__ESSENTIAL_SUPPLIES: { dialogue: 'We should make sure essential supplies are ready to take with us.', description: 'The medication container sits on the bedroom shelf.' },
      EV05__POWERED_EQUIPMENT: { dialogue: 'Some equipment needs power. We should think about what happens if the electricity goes out.', description: 'A piece of equipment hums quietly in the bedroom.' },
    },
    facts: () => ['A household member relies on essential supplies.'] },
  { id: 'EV06', title: 'Updated warning', mandatory: true, eligible: () => true,
    variant: ({ s }) => (s.storm.landfallAccelerationHours > 0 ? 'EV06__ACCELERATED' : 'EV06__ON_SCHEDULE'),
    choices: () => ['READ_UPDATE', 'REASSESS_PLAN', 'DEFER'], speaker: narrator,
    fallback: {
      EV06__ON_SCHEDULE: { dialogue: 'Updated fictional advisory: the typhoon remains on its expected track.', description: 'Rain begins to tap against the windows.' },
      EV06__ACCELERATED: { dialogue: 'Updated fictional advisory: the typhoon is moving faster and will arrive sooner than expected.', description: 'Rain begins to tap against the windows.' },
    },
    facts: ({ s }) => [`Landfall is now expected in about ${landfallIn(s)} hours.`, s.storm.landfallAccelerationHours > 0 ? `Landfall moved ${s.storm.landfallAccelerationHours} hours earlier.` : 'Landfall timing is unchanged.'] },
  { id: 'EV07', title: 'Rumor', mandatory: true, eligible: () => true, variant: () => 'EV07__DAM_RUMOR',
    choices: () => ['VERIFY_RUMOR', 'IGNORE_RUMOR', 'FORWARD_RUMOR'], speaker: () => 'NPC_NEIGHBOR',
    fallback: { EV07__DAM_RUMOR: { dialogue: 'A message is going around saying a dam will be opened tonight. I don’t know who sent it.', description: 'A neighbor holds up a phone with a forwarded message.' } },
    facts: () => ['An unverified message is circulating.', 'The message has not come from an official source.'] },
  { id: 'EV08', title: 'Evacuation advisory', mandatory: true, eligible: () => true,
    variant: ({ s, p }) => (!sel.assistanceNeeded(p) ? 'EV08__DEFAULT' : s.flags.ASSISTANCE_ARRANGED ? 'EV08__ASSISTANCE_READY' : 'EV08__ASSISTANCE_UNPLANNED'),
    choices: ({ p }) => ['REVIEW_ADVISORY', 'PREPARE_TO_EVACUATE', 'FOLLOW_EVACUATION', ...(sel.assistanceNeeded(p) ? ['SEEK_ASSISTANCE'] : []), 'DELAY_EVACUATION'],
    speaker: narrator,
    fallback: {
      EV08__DEFAULT: { dialogue: 'Fictional advisory: an evacuation advisory has been issued for your area.', description: 'Heavy rain sweeps across the street.' },
      EV08__ASSISTANCE_READY: { dialogue: 'Fictional advisory: an evacuation advisory has been issued. Help for your household member is arranged.', description: 'Heavy rain sweeps across the street.' },
      EV08__ASSISTANCE_UNPLANNED: { dialogue: 'Fictional advisory: an evacuation advisory has been issued. A household member will need help to leave.', description: 'Heavy rain sweeps across the street.' },
    },
    facts: ({ s }) => ['An evacuation advisory has been issued for this fictional scenario.', `Landfall is expected in about ${landfallIn(s)} hours.`] },
  { id: 'EV09', title: 'Power interruption', mandatory: true, eligible: () => true,
    variant: ({ s }) => (sel.hasLighting(s) ? 'EV09__BACKUP_READY' : 'EV09__LIGHTING_GAP'),
    choices: ({ s }) => (sel.hasLighting(s) ? ['USE_FLASHLIGHT', 'USE_POWER_BANK', 'CHECK_HOUSEHOLD_NEEDS'] : ['CHECK_HOUSEHOLD_NEEDS', 'DEFER']),
    speaker: householdSpeaker,
    fallback: {
      EV09__BACKUP_READY: { dialogue: 'The power just went out. Good thing we have backup lighting.', description: 'The lights flicker and go dark.' },
      EV09__LIGHTING_GAP: { dialogue: 'The power is out and we have no flashlight. It is very dark in here.', description: 'The lights flicker and go dark.' },
    },
    facts: ({ s }) => ['The electricity is out.', sel.hasLighting(s) ? 'The household has backup lighting.' : 'The household has no backup lighting.'] },
  { id: 'EV10', title: 'Shelter hazard', mandatory: true, eligible: ({ s }) => s.evacuation.currentShelter === 'home',
    variant: ({ s }) => (s.environment.shelterCondition === 'unsafe' ? 'EV10__CRITICAL' : s.environment.floodSeverity === 'severe' || s.environment.floodSeverity === 'moderate' ? 'EV10__WATER_RISING'
      : !s.flags.LOOSE_ITEMS_SECURED ? 'EV10__LOOSE_OBJECTS' : 'EV10__STRONG_WIND'),
    choices: ({ s }) => [ 'MOVE_TO_SAFER_ROOM', 'ACCOUNT_MEMBERS', ...(s.environment.shelterCondition !== 'normal' ? ['SEEK_HELP'] : []), 'GO_OUTSIDE_TO_CHECK'],
    speaker: householdSpeaker,
    fallback: {
      EV10__CRITICAL: { dialogue: 'The house is not holding up well. We need help.', description: 'Wind howls and water seeps under the door.' },
      EV10__WATER_RISING: { dialogue: 'Water is coming in at the front of the house.', description: 'Water creeps across the floor near the entrance.' },
      EV10__LOOSE_OBJECTS: { dialogue: 'Something outside just slammed against the wall!', description: 'Objects clatter in the yard as the wind picks up.' },
      EV10__STRONG_WIND: { dialogue: 'The wind is very strong right now.', description: 'The windows rattle in their frames.' },
    },
    facts: ({ s }) => [`Flood level in this scenario: ${s.environment.floodSeverity}.`, `Wind: ${s.environment.windSeverity}.`] },
  { id: 'EV11', title: 'Evacuation arrival', mandatory: true, eligible: () => true,
    variant: ({ s }) => (s.flags.GO_BAG_BROUGHT ? 'EV11__WITH_SUPPLIES' : 'EV11__WITHOUT_SUPPLIES'),
    choices: () => ['ACCOUNT_MEMBERS', 'INSPECT_GO_BAG', 'CHECK_ADVISORY'], speaker: () => 'NPC_CENTER_STAFF',
    fallback: {
      EV11__WITH_SUPPLIES: { dialogue: 'Welcome. Please check in and make sure everyone in your household is here.', description: 'The evacuation center is crowded but calm.' },
      EV11__WITHOUT_SUPPLIES: { dialogue: 'Welcome. Please check in. Supplies here are limited.', description: 'The evacuation center is crowded but calm.' },
    },
    facts: ({ s }) => ['The household has reached the evacuation destination.', s.flags.GO_BAG_BROUGHT ? 'The household brought its go-bag.' : 'The household arrived without a go-bag.'] },
  { id: 'EV12', title: 'Household dilemma', mandatory: true, eligible: () => true,
    variant: ({ s, p }) => (sel.assistanceNeeded(p) && !s.flags.ASSISTANCE_ARRANGED ? 'EV12__ASSISTANCE' : sel.usesPoweredEquipment(p) ? 'EV12__POWERED_EQUIPMENT'
      : sel.hasPets(p) && !s.flags.PET_SUPPLIES_READY ? 'EV12__PET' : sel.hasInfants(p) && !s.flags.CHILD_SUPPLIES_READY ? 'EV12__CHILD' : 'EV12__NEIGHBOR'),
    choices: (_c, v) => (v === 'EV12__NEIGHBOR' ? ['HELP_NENA_PREPARE', 'CHECK_HOUSEHOLD_NEEDS', 'DEFER'] : ['HELP_WITH_NEED', 'REVIEW_NEEDS', 'DEFER']),
    speaker: householdSpeaker,
    fallback: {
      EV12__ASSISTANCE: { dialogue: 'If we have to leave, who will help the person who needs assistance?', description: 'The household looks at each other, thinking.' },
      EV12__POWERED_EQUIPMENT: { dialogue: 'What do we do about the equipment if the power stays out for a long time?', description: 'The household looks at each other, thinking.' },
      EV12__PET: { dialogue: 'What about our pet? We have not packed anything for them.', description: 'The pet watches from the corner.' },
      EV12__CHILD: { dialogue: 'Do we have what the little one needs if we have to leave?', description: 'The household looks at each other, thinking.' },
      EV12__NEIGHBOR: { dialogue: 'Aling Nena next door lives alone. She is asking if someone can help her get ready.', description: 'Aling Nena waves from across the fence.' },
    },
    facts: () => ['The household is discussing a need specific to its members.'] },
  { id: 'EV13', title: 'Household status', mandatory: true, eligible: () => true,
    variant: ({ s }) => (s.flags.MEMBERS_ACCOUNTED ? 'EV13__ACCOUNTED' : 'EV13__CHECK_NEEDED'),
    choices: () => ['ACCOUNT_MEMBERS', 'REVIEW_NEEDS', 'DEFER'], speaker: householdSpeaker,
    fallback: {
      EV13__ACCOUNTED: { dialogue: 'The worst of the storm has passed. Everyone is here.', description: 'The wind finally eases.' },
      EV13__CHECK_NEEDED: { dialogue: 'The worst of the storm has passed. Is everyone all right?', description: 'The wind finally eases.' },
    },
    facts: ({ s }) => ['The impact phase is ending.', `Property damage in this scenario: ${s.environment.propertyDamage}.`] },
  { id: 'EV14', title: 'Resource review', mandatory: true, eligible: () => true,
    variant: ({ s, p }) => (sel.itemTotal(s, 'WATER') >= sel.waterRequirement(p) && sel.itemTotal(s, 'FOOD') >= sel.foodRequirement(p) ? 'EV14__SUFFICIENT' : 'EV14__SHORTFALL'),
    choices: () => ['REVIEW_RESOURCES', 'DEFER'], speaker: householdSpeaker,
    fallback: {
      EV14__SUFFICIENT: { dialogue: 'Let’s see what we have left. It looks like enough for the next few days.', description: 'Day 1 of recovery. Puddles cover the ground.' },
      EV14__SHORTFALL: { dialogue: 'Let’s see what we have left. We may run short.', description: 'Day 1 of recovery. Puddles cover the ground.' },
    },
    facts: ({ s, p }) => [`Water left: ${sel.itemTotal(s, 'WATER')} L.`, `Food left: ${sel.itemTotal(s, 'FOOD')} person-days for ${p.size} people.`, s.environment.suppliesLost ? 'Some stored supplies were lost to water.' : 'Stored supplies were kept dry.'] },
  { id: 'EV15', title: 'Recovery update', mandatory: true, eligible: () => true, variant: () => 'EV15__DEFAULT',
    choices: () => ['VERIFY_GUIDANCE', 'PLAN_RECOVERY', 'DEFER'], speaker: narrator,
    fallback: { EV15__DEFAULT: { dialogue: 'Fictional update: recovery information is being shared by local officials.', description: 'Day 2 of recovery. Neighbors begin cleaning up.' } },
    facts: () => ['Officials are sharing recovery information in this fictional scenario.'] },
  { id: 'EV16', title: 'Final reflection', mandatory: true, eligible: () => true, variant: () => 'EV16__DEFAULT',
    choices: () => ['FINISH_REFLECTION'], speaker: narrator,
    fallback: { EV16__DEFAULT: { dialogue: 'The storm has passed. Let’s look back at the decisions your household made.', description: 'Day 3 of recovery. The sky is clear.' } },
    facts: () => ['The scenario is complete.'] },
];

export const EVENT_BY_ID: ReadonlyMap<EventId, EventDef> = new Map(EVENTS.map((e) => [e.id, e]));
export { hour };
