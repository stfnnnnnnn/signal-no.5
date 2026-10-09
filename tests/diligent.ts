// A diligent, safe player policy used to prove Handa is attainable. Uses only public engine commands.
import type { GameEngine } from '../src/core/engine';
import type { ShopItemId } from '../src/shared/contracts/state';
import { playToEnd, resolveFirst } from './helpers';

export const SAFE_CHOICES = ['CHECK_ADVISORY', 'READ_UPDATE', 'VERIFY_RUMOR', 'FOLLOW_EVACUATION', 'ARRANGE_ASSISTANCE', 'SEEK_ASSISTANCE', 'PACK_MEDICATION',
  'ARRANGE_CONTINUITY', 'HELP_WITH_NEED', 'HELP_COMMUNITY_PREPARATION', 'SHARE_VERIFIED_ADVISORY', 'USE_FLASHLIGHT', 'MOVE_TO_SAFER_ROOM', 'ACCOUNT_MEMBERS', 'INSPECT_SUPPLIES', 'INSPECT_GO_BAG',
  'REVIEW_RESOURCES', 'VERIFY_GUIDANCE', 'FAMILY_MEETING', 'CHECK_HOUSEHOLD_NEEDS', 'REVIEW_ADVISORY', 'FINISH_REFLECTION'];

function act(e: GameEngine, id: string) {
  for (let i = 0; i < 20 && e.getState().activeEvent; i++) resolveFirst(e, SAFE_CHOICES);
  return e.executeAction(id).ok;
}

/** opts.community=false skips the optional Bayanihan actions (to prove declining them never costs Handa). */
export function prepareDiligently(e: GameEngine, opts: { community?: boolean } = {}) {
  const skip = opts.community === false ? new Set(['SHARE_VERIFIED_ADVISORY', 'HELP_COMMUNITY_PREPARATION']) : new Set<string>();
  if (e.getState().activeEvent?.eventId === 'EV01') e.resolveEvent('CHECK_ADVISORY');
  for (const id of ['PREPARE_COMMUNICATION', 'FAMILY_MEETING', 'ARRANGE_ASSISTANCE', 'CHECK_ESSENTIAL_SUPPLIES']) act(e, id);
  if (act(e, 'SHOP_TRIP')) {
    const p = e.getProfile();
    const s = e.getState();
    const have = (id: string) => (s.house[id as keyof typeof s.house] ?? 0) + (s.goBag[id as keyof typeof s.goBag] ?? 0);
    const wants: ShopItemId[] = [];
    if (!have('FIRST_AID_KIT')) wants.push('FIRST_AID_KIT');
    if (!have('HYGIENE_KIT')) wants.push('HYGIENE_KIT');
    if (!have('FLASHLIGHT') && !have('POWER_BANK')) wants.push('FLASHLIGHT');
    if (p.medical.essentialMedication === 'yes' && !have('MEDICATION')) wants.push('MEDICATION_REFILL');
    if (p.pets.present && !have('PET_SUPPLIES')) wants.push('PET_SUPPLIES');
    if (p.members.some((m) => m.ageGroup === 'age0to4') && !have('CHILD_CARE_SUPPLIES')) wants.push('CHILD_CARE_SUPPLIES');
    for (const w of wants) e.purchase(w, 1);
    for (let i = 0; i < 4 && have('FOOD') + 6 * i < 3 * p.size; i++) if (!e.purchase('FOOD_PACK', 1).ok) break;
    act(e, 'RETURN_HOME');
  }
  for (const id of ['PACK_GO_BAG', 'PACK_MEDICATION', 'PREPARE_PET_SUPPLIES', 'PREPARE_CHILD_SUPPLIES', 'FILL_CONTAINERS', 'FILL_CONTAINERS', 'FILL_DRUM',
    'PROTECT_DOCUMENTS', 'BARANGAY_VISIT', 'CHARGE_PHONE', 'CHARGE_POWER_BANK', 'SHARE_VERIFIED_ADVISORY', 'HELP_COMMUNITY_PREPARATION', 'GET_TOOLS',
    'BOARD_WINDOW', 'BOARD_WINDOW', 'BOARD_WINDOW', 'BOARD_WINDOW', 'SECURE_ROOF', 'SECURE_OBJECTS']) if (!skip.has(id)) act(e, id);
}

export function playDiligently(e: GameEngine, opts: { community?: boolean } = {}) {
  prepareDiligently(e, opts);
  const prefer = opts.community === false ? SAFE_CHOICES.filter((id) => id !== 'SHARE_VERIFIED_ADVISORY' && id !== 'HELP_COMMUNITY_PREPARATION') : SAFE_CHOICES;
  return playToEnd(e, prefer);
}
