// Badges B01–B10 (GD §15). Deterministic; unlocked from evaluated objectives, never by the AI.
import type { BadgeId } from '../../shared/contracts/ids';
import type { GameState } from '../../shared/contracts/state';

export interface BadgeContext {
  state: GameState;
  met: (objectiveId: string) => boolean | null; // null = not applicable
  categoryRatio: (category: string) => number | null; // earned / weight, null = excluded
}

export interface BadgeDef { id: BadgeId; name: string; description: string; hint: string; earned: (c: BadgeContext) => boolean }

const yes = (v: boolean | null) => v === true;
const okOrNa = (v: boolean | null) => v !== false;
const happened = (s: GameState, id: string) => s.eventHistory.some((h) => h.eventId === id);

export const BADGES: BadgeDef[] = [
  { id: 'B01', name: 'Handa ang Bag!', description: 'Completed the go-bag before the storm.', hint: 'Pack every essential the household needs.', earned: (c) => yes(c.met('O_GO_BAG')) },
  { id: 'B02', name: 'Tubig at Pagkain', description: 'Had enough water and food for the household.', hint: 'Store water and food for everyone.', earned: (c) => yes(c.met('O_WATER')) && yes(c.met('O_FOOD')) },
  { id: 'B03', name: 'Balitang Beripikado', description: 'Relied on verified information.', hint: 'Check official sources and verify messages before sharing.',
    earned: (c) => (happened(c.state, 'EV07') ? yes(c.met('O_RUMOR')) : yes(c.met('O_BULLETIN')) && okOrNa(c.met('O_UPDATE'))) },
  { id: 'B04', name: 'Pamilyang Handa', description: 'Coordinated the whole household.', hint: 'Agree on a plan and roles with everyone.',
    earned: (c) => okOrNa(c.met('O_FAMILY_MEETING')) && yes(c.met('O_COMMUNICATION')) && yes(c.met('O_ACCOUNTED')) },
  { id: 'B05', name: 'Ligtas na Dokumento', description: 'Protected important documents.', hint: 'Waterproof your documents or pack them.', earned: (c) => yes(c.met('O_DOCUMENTS')) },
  { id: 'B06', name: 'May Plano Tayo', description: 'Set a communication plan.', hint: 'Agree on contacts and a meeting point.', earned: (c) => yes(c.met('O_COMMUNICATION')) },
  { id: 'B07', name: 'Walang Maiiwan', description: 'Accounted for every household member.', hint: 'Check on everyone after the storm.', earned: (c) => yes(c.met('O_ACCOUNTED')) },
  { id: 'B08', name: 'Handa sa Dilim', description: 'Prepared and used backup lighting.', hint: 'Keep a flashlight or power bank ready.',
    earned: (c) => yes(c.met('O_LIGHTING')) && (!happened(c.state, 'EV09') || c.state.flags.BACKUP_LIGHTING_USED === true) },
  { id: 'B09', name: 'Tamang Desisyon', description: 'Responded appropriately to official guidance.', hint: 'Follow advisories in time and stay safe during the storm.',
    earned: (c) => okOrNa(c.met('O_ADVISORY_RESPONSE')) && okOrNa(c.met('O_HAZARD_RESPONSE')) && yes(c.met('O_NO_UNSAFE')) && (c.met('O_ADVISORY_RESPONSE') !== null || c.met('O_HAZARD_RESPONSE') !== null) },
  { id: 'B10', name: 'Signal No. 5 Master', description: 'Demonstrated every applicable core competency.', hint: 'Score at least 75% in every applicable competency.',
    earned: (c) => ['emergencySupplies', 'officialInformation', 'householdCoordination', 'evacuationPreparedness', 'householdNeeds', 'hazardAwareness']
      .every((k) => { const r = c.categoryRatio(k); return r === null || r >= 0.75; }) && yes(c.met('O_NO_UNSAFE')) },
];
