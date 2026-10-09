// Shared identifier catalogs. Naming conventions follow project_context.md §15.
import { z } from 'zod';

export const AGE_GROUPS = ['age0to4', 'age5to12', 'age13to17', 'age18to35', 'age36to59', 'age60plus'] as const;
export const AgeGroup = z.enum(AGE_GROUPS);
export type AgeGroup = z.infer<typeof AgeGroup>;

export const Sex = z.enum(['male', 'female', 'unspecified']);
export type Sex = z.infer<typeof Sex>;

export const SpriteBase = z.enum(['boy', 'girl', 'mom', 'dad']);
export type SpriteBase = z.infer<typeof SpriteBase>;

export const ThemeId = z.enum(['modern', 'traditional']);
export type ThemeId = z.infer<typeof ThemeId>;

export const BudgetTier = z.enum(['limited', 'moderate', 'higher']);
export type BudgetTier = z.infer<typeof BudgetTier>;

export const GamePhase = z.enum(['setup', 'preparation', 'warning', 'evacuation', 'impact', 'aftermath', 'debrief', 'complete']);
export type GamePhase = z.infer<typeof GamePhase>;

export const SceneId = z.enum(['TITLE', 'ONBOARDING', 'CUSTOMIZATION', 'HOUSE', 'SHOP', 'EVACUATION', 'HOME_IMPACT', 'AFTERMATH', 'RESULTS', 'STREET', 'BARANGAY']);
export type SceneId = z.infer<typeof SceneId>;

export const TIME_SCALES = [1, 2, 4, 8, 16, 32] as const;
export const TimeScale = z.union(TIME_SCALES.map((n) => z.literal(n)) as unknown as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>, z.ZodLiteral<16>, z.ZodLiteral<32>]);
export type TimeScale = (typeof TIME_SCALES)[number];

// Items. WATER is counted in liters, FOOD in person-days; everything else in units.
export const ITEM_IDS = [
  'WATER', 'FOOD', 'FLASHLIGHT', 'BATTERIES', 'POWER_BANK', 'RADIO', 'FIRST_AID_KIT', 'MEDICATION',
  'HYGIENE_KIT', 'DOCUMENTS', 'EMERGENCY_CASH', 'WHISTLE', 'CLOTHES', 'CHILD_CARE_SUPPLIES', 'PET_SUPPLIES',
  'TOOLS', 'FUEL', 'SANDBAGS', 'PHONE',
] as const;
export const ItemId = z.enum(ITEM_IDS);
export type ItemId = z.infer<typeof ItemId>;

export const FLAG_IDS = [
  'TOOLS_RETRIEVED', 'ROOF_SECURED', 'LOOSE_ITEMS_SECURED', 'GATE_SANDBAGGED', 'DOCUMENTS_PROTECTED',
  'BELONGINGS_RAISED', 'SUPPLIES_STORED_SAFELY', 'FAMILY_MEETING_DONE', 'COMMUNICATION_PLAN_READY',
  'MEETING_POINT_KNOWN', 'EVACUATION_PLAN_READY', 'EVACUATION_CENTER_KNOWN', 'BULLETIN_CHECKED',
  'BULLETIN_CHECKED_EARLY', 'UPDATE_READ', 'MEDICATION_PACKED', 'MEDICAL_CONTINUITY_PLANNED',
  'ASSISTANCE_ARRANGED', 'PET_SUPPLIES_READY', 'CHILD_SUPPLIES_READY', 'RUMOR_VERIFIED', 'RUMOR_FORWARDED',
  'MEMBERS_ACCOUNTED', 'POST_STORM_UPDATES_CHECKED', 'BARANGAY_VISITED', 'ADVISORY_REVIEWED',
  'PREPARED_TO_EVACUATE', 'UNSAFE_ACTION_ATTEMPTED', 'BOUGHT_AFTER_PRICE_INCREASE', 'GO_BAG_BROUGHT',
  'RESOURCES_REVIEWED', 'RECOVERY_PLANNED', 'REFLECTION_DONE', 'BACKUP_LIGHTING_USED',
  'MEDICAL_SUPPLIES_CHECKED', 'POWER_BANK_CHARGED', 'NENA_MET', 'NENA_HELPED',
] as const;
export const FlagId = z.enum(FLAG_IDS);
export type FlagId = z.infer<typeof FlagId>;

export const EVENT_IDS = ['EV01', 'EV02', 'EV03', 'EV04', 'EV05', 'EV06', 'EV07', 'EV08', 'EV09', 'EV10', 'EV11', 'EV12', 'EV13', 'EV14', 'EV15', 'EV16'] as const;
export const EventId = z.enum(EVENT_IDS);
export type EventId = z.infer<typeof EventId>;

/** Revised 12-badge catalog (supersedes GD §15 B01–B10; see SPEC_RECONCILIATION R17). */
export const BADGE_IDS = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12'] as const;
export const BadgeId = z.enum(BADGE_IDS);
export type BadgeId = z.infer<typeof BadgeId>;

export const NPC_PREFIX = 'NPC_';
/** Action IDs: SCREAMING_SNAKE, verb first. Defined in src/core/content/actions.ts. */
export const ActionId = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
export type ActionId = string;
