// Interactable objects on the fixed layouts (GD §5). The frontend places sprites at these IDs;
// the backend decides which actions each one offers. 'NPC' is a virtual ID used for any household NPC.
import type { SceneId } from '../../shared/contracts/ids';
import type { HouseholdProfile } from '../../shared/contracts/household';
import * as sel from '../selectors';

export interface InteractableDef {
  id: string;
  scene: SceneId;
  area: 'livingRoom' | 'kitchen' | 'bedroom' | 'utility' | 'entrance' | 'stairs' | 'windows' | 'shop' | 'evacuation';
  label: string;
  /** Present only for some households (e.g. pet area). */
  present?: (p: HouseholdProfile) => boolean;
}

export const HOUSE_LAYOUT_ID = 'house_fixed_v1';

export const INTERACTABLES: InteractableDef[] = [
  { id: 'LIVING_TV', scene: 'HOUSE', area: 'livingRoom', label: 'Television' },
  { id: 'LIVING_PHONE', scene: 'HOUSE', area: 'livingRoom', label: 'Phone' },
  { id: 'LIVING_RADIO', scene: 'HOUSE', area: 'livingRoom', label: 'Radio' },
  { id: 'KITCHEN_CABINET', scene: 'HOUSE', area: 'kitchen', label: 'Food cabinet' },
  { id: 'KITCHEN_SINK', scene: 'HOUSE', area: 'kitchen', label: 'Sink' },
  { id: 'BEDROOM_CLOTHES', scene: 'HOUSE', area: 'bedroom', label: 'Clothes cabinet' },
  { id: 'BEDROOM_DOCUMENTS', scene: 'HOUSE', area: 'bedroom', label: 'Documents drawer' },
  { id: 'BEDROOM_MEDICATION', scene: 'HOUSE', area: 'bedroom', label: 'Medicine cabinet',
    // Also present when the answer was unknown/undisclosed: never assume medication is unnecessary.
    present: (p) => p.medical.essentialMedication !== 'no' || sel.hasMedicalEquipment(p) },
  { id: 'UTILITY_TOOLS', scene: 'HOUSE', area: 'utility', label: 'Toolbox' },
  { id: 'UTILITY_SHELF', scene: 'HOUSE', area: 'utility', label: 'Supply shelf' },
  { id: 'UTILITY_DRUM', scene: 'HOUSE', area: 'utility', label: 'Water drum' },
  { id: 'UTILITY_LADDER', scene: 'HOUSE', area: 'utility', label: 'Ladder' },
  { id: 'PET_AREA', scene: 'HOUSE', area: 'utility', label: 'Pet corner', present: (p) => sel.hasPets(p) },
  { id: 'ENTRANCE_DOOR', scene: 'HOUSE', area: 'entrance', label: 'Front door' },
  { id: 'ENTRANCE_BAG', scene: 'HOUSE', area: 'entrance', label: 'Go-bag' },
  { id: 'STAIRS', scene: 'HOUSE', area: 'stairs', label: 'Stairs / high shelf' },
  { id: 'WINDOW', scene: 'HOUSE', area: 'windows', label: 'Windows' },
  { id: 'SHOP_COUNTER', scene: 'SHOP', area: 'shop', label: 'Shop counter' },
  { id: 'SHOP_EXIT', scene: 'SHOP', area: 'shop', label: 'Shop exit' },
];

export const INTERACTABLE_BY_ID: ReadonlyMap<string, InteractableDef> = new Map(INTERACTABLES.map((i) => [i.id, i]));
