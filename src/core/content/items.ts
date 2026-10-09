// Item catalog (static). Quantities: WATER in liters, FOOD in person-days, others in units.
import type { ItemId } from '../../shared/contracts/ids';

export const ITEM_LABELS: Record<ItemId, string> = {
  WATER: 'Drinking water (L)', FOOD: 'Food (person-days)', FLASHLIGHT: 'Flashlight', BATTERIES: 'Batteries',
  POWER_BANK: 'Power bank', RADIO: 'Battery-powered radio', FIRST_AID_KIT: 'First-aid kit', MEDICATION: 'Essential medication supply',
  HYGIENE_KIT: 'Hygiene kit', DOCUMENTS: 'Important documents', EMERGENCY_CASH: 'Emergency cash', WHISTLE: 'Whistle',
  CLOTHES: 'Extra clothing', CHILD_CARE_SUPPLIES: 'Child-care supplies', PET_SUPPLIES: 'Pet supplies', TOOLS: 'Tools',
  FUEL: 'Fuel', SANDBAGS: 'Sandbags', PHONE: 'Mobile phone',
};

/** Items that can go into the go-bag (PACK_GO_BAG packs these when available at home). */
export const PACKABLE_ITEMS: ItemId[] = [
  'WATER', 'FOOD', 'FLASHLIGHT', 'BATTERIES', 'POWER_BANK', 'RADIO', 'FIRST_AID_KIT', 'MEDICATION', 'HYGIENE_KIT',
  'DOCUMENTS', 'EMERGENCY_CASH', 'WHISTLE', 'CLOTHES', 'CHILD_CARE_SUPPLIES', 'PET_SUPPLIES',
];
