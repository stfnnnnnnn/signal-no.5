// Community shop catalog (GD §7, GS §8). Fictional prices in PHP.
import type { ItemId } from '../../shared/contracts/ids';
import type { HouseholdProfile } from '../../shared/contracts/household';
import type { ShopItemId } from '../../shared/contracts/state';
import * as sel from '../selectors';

export interface ShopItemDef {
  id: ShopItemId;
  label: string;
  price: number;
  grants: { item: ItemId; quantity: number };
  initialStock: number;
  /** Only stocked for households that need it. */
  offered?: (p: HouseholdProfile) => boolean;
}

export const SHOP_CONFIG = {
  /** GD §7 / SPEC_RECONCILIATION R7: optional workbook rule, default on. */
  latePriceEnabled: true,
  latePriceFromHour: 24,
  latePriceMultiplier: 1.5,
} as const;

export const SHOP_ITEMS: ShopItemDef[] = [
  { id: 'WATER_JUG', label: 'Water jug (20 L)', price: 100, grants: { item: 'WATER', quantity: 20 }, initialStock: 6 },
  { id: 'FOOD_PACK', label: 'Food pack (6 person-days)', price: 280, grants: { item: 'FOOD', quantity: 6 }, initialStock: 6 },
  { id: 'MEDICATION_REFILL', label: 'Prescribed medication refill', price: 350, grants: { item: 'MEDICATION', quantity: 1 }, initialStock: 3,
    offered: (p) => sel.needsEssentialMedication(p) || sel.hasMedicalEquipment(p) },
  { id: 'FLASHLIGHT', label: 'Flashlight', price: 120, grants: { item: 'FLASHLIGHT', quantity: 1 }, initialStock: 3 },
  { id: 'POWER_BANK', label: 'Power bank', price: 450, grants: { item: 'POWER_BANK', quantity: 1 }, initialStock: 3 },
  { id: 'FIRST_AID_KIT', label: 'First-aid kit', price: 200, grants: { item: 'FIRST_AID_KIT', quantity: 1 }, initialStock: 3 },
  { id: 'TOOLS', label: 'Tools', price: 250, grants: { item: 'TOOLS', quantity: 1 }, initialStock: 3 },
  { id: 'RADIO', label: 'Battery-powered radio', price: 250, grants: { item: 'RADIO', quantity: 1 }, initialStock: 3 },
  { id: 'FUEL', label: 'Fuel', price: 150, grants: { item: 'FUEL', quantity: 1 }, initialStock: 3 },
  { id: 'BATTERIES', label: 'Batteries', price: 80, grants: { item: 'BATTERIES', quantity: 1 }, initialStock: 3 },
  { id: 'HYGIENE_KIT', label: 'Hygiene kit', price: 150, grants: { item: 'HYGIENE_KIT', quantity: 1 }, initialStock: 3 },
  { id: 'PET_SUPPLIES', label: 'Pet supplies', price: 180, grants: { item: 'PET_SUPPLIES', quantity: 1 }, initialStock: 3, offered: (p) => sel.hasPets(p) },
  { id: 'CHILD_CARE_SUPPLIES', label: 'Child-care supplies', price: 220, grants: { item: 'CHILD_CARE_SUPPLIES', quantity: 1 }, initialStock: 3, offered: (p) => sel.hasInfants(p) },
  { id: 'SANDBAGS', label: 'Sandbags', price: 120, grants: { item: 'SANDBAGS', quantity: 1 }, initialStock: 3, offered: (p) => !sel.isApartmentLike(p) },
];

export const SHOP_ITEM_BY_ID: ReadonlyMap<ShopItemId, ShopItemDef> = new Map(SHOP_ITEMS.map((i) => [i.id, i]));
