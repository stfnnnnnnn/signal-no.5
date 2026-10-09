// HouseholdProfile → initial GameState (GD §4, GS §6). See SURVEY_TO_GAMESTATE_MAPPING.md.
import type { FlagId, ItemId } from '../../shared/contracts/ids';
import type { HouseholdProfile } from '../../shared/contracts/household';
import type { GameState, ItemCounts } from '../../shared/contracts/state';
import { PACKABLE_ITEMS } from '../content/items';
import { SHOP_ITEMS } from '../content/shop';
import { createStormConfig, DEFAULT_LANDFALL_HOUR } from '../content/storm';
import { HOUR } from '../selectors';

export const STARTING_CASH = { limited: 800, moderate: 1500, higher: 3000 } as const;
export const STARTING_PHONE_BATTERY = 55;

const SUPPLY_TO_ITEM: Partial<Record<string, ItemId>> = {
  flashlight: 'FLASHLIGHT', batteries: 'BATTERIES', powerBank: 'POWER_BANK', radio: 'RADIO', firstAidKit: 'FIRST_AID_KIT',
  medications: 'MEDICATION', hygiene: 'HYGIENE_KIT', emergencyCash: 'EMERGENCY_CASH', whistle: 'WHISTLE',
  childCare: 'CHILD_CARE_SUPPLIES', petSupplies: 'PET_SUPPLIES',
};

function startingItems(p: HouseholdProfile): ItemCounts {
  const supplies = new Set<string>(p.preparedness.supplies);
  const items: ItemCounts = {
    WATER: supplies.has('water') ? 12 : 6,
    FOOD: (supplies.has('food') ? 3 : 1) * p.size,
    DOCUMENTS: 1, PHONE: 1, CLOTHES: 1,
  };
  for (const [supply, item] of Object.entries(SUPPLY_TO_ITEM)) if (supplies.has(supply) && item) items[item] = 1;
  if (p.preparedness.backupPower.includes('flashlight')) items.FLASHLIGHT = 1;
  if (p.preparedness.backupPower.includes('rechargeable')) items.POWER_BANK = 1;
  if (supplies.has('clothing')) items.CLOTHES = 2;
  return items;
}

/** Initial go-bag from Q18: complete = all available essentials, partial = every other one, otherwise empty. */
function splitGoBag(p: HouseholdProfile, items: ItemCounts): { house: ItemCounts; goBag: ItemCounts } {
  const house = { ...items };
  const goBag: ItemCounts = {};
  const present = PACKABLE_ITEMS.filter((id) => (house[id] ?? 0) > 0);
  const chosen = p.preparedness.goBag === 'complete' ? present : p.preparedness.goBag === 'partial' ? present.filter((_, i) => i % 2 === 0) : [];
  for (const id of chosen) {
    const q = id === 'WATER' ? Math.min(house.WATER ?? 0, 3 * p.size) : id === 'FOOD' ? Math.min(house.FOOD ?? 0, p.size) : 1;
    goBag[id] = q;
    const left = (house[id] ?? 0) - q;
    if (left > 0) house[id] = left; else delete house[id];
  }
  return { house, goBag };
}

export function createInitialState(p: HouseholdProfile, seed: number, runId: string): GameState {
  const storm = createStormConfig(p, seed);
  const { house, goBag } = splitGoBag(p, startingItems(p));
  const flags: Partial<Record<FlagId, boolean>> = {};
  const on = (f: FlagId, cond: boolean) => { if (cond) flags[f] = true; };
  on('COMMUNICATION_PLAN_READY', p.preparedness.communicationPlan === 'yes');
  on('MEETING_POINT_KNOWN', p.preparedness.communicationPlan === 'yes');
  on('EVACUATION_PLAN_READY', p.preparedness.evacuationPlan === 'yes');
  on('EVACUATION_CENTER_KNOWN', p.preparedness.evacuationCenterKnown === 'yes');
  on('DOCUMENTS_PROTECTED', p.preparedness.supplies.includes('documentsWaterproof'));
  on('MEDICATION_PACKED', (goBag.MEDICATION ?? 0) > 0);
  on('PET_SUPPLIES_READY', (goBag.PET_SUPPLIES ?? 0) > 0);
  on('CHILD_SUPPLIES_READY', (goBag.CHILD_CARE_SUPPLIES ?? 0) > 0);

  const stock: GameState['shop']['stock'] = {};
  for (const item of SHOP_ITEMS) if (!item.offered || item.offered(p)) stock[item.id] = item.initialStock;

  return {
    schemaVersion: 2,
    runId,
    seed,
    phase: 'preparation',
    scene: 'HOUSE',
    clock: { gameMinutes: 0, timeScale: 1, pauseReasons: [] },
    landfallMinute: (DEFAULT_LANDFALL_HOUR - storm.landfallAccelerationHours) * HOUR,
    household: p,
    cash: STARTING_CASH[p.budgetTier],
    phoneBattery: STARTING_PHONE_BATTERY,
    house,
    goBag,
    flags,
    counters: {},
    storm,
    environment: {
      weatherState: 'clear', windSeverity: 'low', floodSeverity: 'none', powerAvailable: true, tapWaterAvailable: true,
      roadStatus: 'open', shopOpen: true, officialAdvisoryIssued: false, evacuationAdvisoryIssued: false, landfallRevealed: false,
      shelterCondition: 'normal', windowDamage: 'none', roofDamage: 'none', propertyDamage: 'none', suppliesLost: false, documentsLost: false,
    },
    evacuation: {
      decision: 'pending', destinationKnown: p.preparedness.evacuationCenterKnown === 'yes', transportAvailable: false,
      departedAtMinute: null, arrivalAtMinute: null, completed: false, currentShelter: 'home', rescueOutcome: false,
    },
    shop: { stock, visitCount: 0, totalSpent: 0, purchases: [] },
    aftermathDay: 0,
    activeEvent: null,
    pendingEvents: [],
    firedMilestones: [],
    eventHistory: [],
    decisionLog: [],
    earnedBadges: [],
    completed: false,
  };
}
