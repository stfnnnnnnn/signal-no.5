// Derived values (never stored). Rules here are deterministic and household-aware.
import type { ItemId } from '../shared/contracts/ids';
import type { HouseholdProfile } from '../shared/contracts/household';
import type { GameState } from '../shared/contracts/state';

export const HOUR = 60;

export const hasOthers = (p: HouseholdProfile) => p.size > 1;
export const assistanceNeeded = (p: HouseholdProfile) => p.assistance.required === 'yes';
export const hasPets = (p: HouseholdProfile) => p.pets.present;
export const needsEssentialMedication = (p: HouseholdProfile) => p.medical.essentialMedication === 'yes';
export const hasInfants = (p: HouseholdProfile) => p.members.some((m) => m.ageGroup === 'age0to4');
export const multiFloor = (p: HouseholdProfile) => p.housing.floors > 1;
export const isApartmentLike = (p: HouseholdProfile) => p.housing.type === 'apartment' || p.housing.type === 'condominium';
export const usesPoweredEquipment = (p: HouseholdProfile) => p.medical.equipment.some((e) => e === 'electricityDependent' || e === 'oxygen');
export const hasMedicalEquipment = (p: HouseholdProfile) => p.medical.equipment.some((e) => !['none', 'notSure', 'preferNotToSay'].includes(e));
export const floodProne = (p: HouseholdProfile) =>
  ['coastal', 'waterway', 'lowLying'].includes(p.housing.surroundings) || ['occasionally', 'frequently'].includes(p.housing.floodHistory);
/** Only a known non-concrete roof makes roof preparation applicable; an unknown roof is not assumed to need it. */
export const roofNeedsSecuring = (p: HouseholdProfile) => ['metal', 'lightweight', 'tile', 'other'].includes(p.housing.roof);

/** Workbook planning baselines (game assumptions, not prescriptions): 12 L and 3 person-days per member. */
export const waterRequirement = (p: HouseholdProfile) => 12 * p.size;
export const foodRequirement = (p: HouseholdProfile) => 3 * p.size;

export const itemTotal = (s: GameState, id: ItemId) => (s.house[id] ?? 0) + (s.goBag[id] ?? 0);
export const houseItem = (s: GameState, id: ItemId) => s.house[id] ?? 0;
export const hasLighting = (s: GameState) => itemTotal(s, 'FLASHLIGHT') > 0 || itemTotal(s, 'POWER_BANK') > 0;

/** Go-bag categories that apply to this household (GD §6 "evaluate applicable supplies"). */
export function goBagRequirements(p: HouseholdProfile): ItemId[][] {
  const req: ItemId[][] = [['WATER'], ['FOOD'], ['FLASHLIGHT', 'POWER_BANK'], ['FIRST_AID_KIT'], ['DOCUMENTS'], ['CLOTHES'], ['HYGIENE_KIT']];
  if (needsEssentialMedication(p)) req.push(['MEDICATION']);
  if (hasInfants(p)) req.push(['CHILD_CARE_SUPPLIES']);
  if (hasPets(p)) req.push(['PET_SUPPLIES']);
  return req;
}

export type GoBagStatus = 'none' | 'partial' | 'ready';
export function goBagStatus(s: GameState): GoBagStatus {
  const req = goBagRequirements(s.household);
  const met = req.filter((alts) => alts.some((id) => (s.goBag[id] ?? 0) > 0)).length;
  return met === 0 ? 'none' : met === req.length ? 'ready' : 'partial';
}
export function missingGoBagItems(s: GameState): ItemId[][] {
  return goBagRequirements(s.household).filter((alts) => !alts.some((id) => (s.goBag[id] ?? 0) > 0));
}

export const isOutdoorSafe = (s: GameState) =>
  (s.phase === 'preparation' || s.phase === 'warning') && s.environment.weatherState !== 'heavyRain' && s.environment.weatherState !== 'typhoon';
export const minutesToLandfall = (s: GameState) => s.landfallMinute - s.clock.gameMinutes;
export const inPreLandfall = (s: GameState) => s.clock.gameMinutes < s.landfallMinute;
/** Evacuation advisory minute (scheduled), or null when this storm has no advisory. */
export const advisoryMinute = (s: GameState) => (s.storm.evacuationAdvisoryEvent ? s.landfallMinute - (8 + (s.storm.advisoryLeadHours ?? 0)) * HOUR : null);
/** Heavy rain begins: outdoor work stops being safe. */
export const heavyRainMinute = (s: GameState) => s.landfallMinute - 8 * HOUR;
