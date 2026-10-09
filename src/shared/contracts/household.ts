// HouseholdProfile schemaVersion 2 (SPEC_RECONCILIATION R13): normalised from the 26-question survey.
// Persistent across replays (optionally). Contains no free-text medical detail.
import { z } from 'zod';
import { AgeGroup, BudgetTier, Sex, SpriteBase, ThemeId } from './ids';
import {
  AllergyCategory, BackupPower, ConditionCategory, Equipment, Exits, FloodHistory, GoBagAnswer, HousingType,
  HouseholdMode, PetType, PlanAnswer, Roof, Supply, Surroundings, WarningSource,
} from './survey';

export const MemberId = z.string().regex(/^M\d{1,2}$/);
export type MemberId = string;

export const HouseholdMember = z.object({
  id: MemberId,
  ageGroup: AgeGroup,
  sex: Sex,
  spriteBase: SpriteBase,
  clothingVariant: z.number().int().min(0).max(7),
  paletteId: z.string(),
  /** Infants/toddlers are represented as dependents, not as walking NPCs. */
  dependent: z.boolean(),
  isPlayer: z.boolean(),
  /** At most 3 non-player members are visible NPCs (GD §4). */
  visibleNpc: z.boolean(),
  npcId: z.string().nullable(),
});
export type HouseholdMember = z.infer<typeof HouseholdMember>;

const Tri = z.enum(['yes', 'no', 'unknown']);

export const HouseholdProfile = z.object({
  schemaVersion: z.literal(2),
  mode: HouseholdMode,
  seed: z.number().int(),
  size: z.number().int().min(1).max(20),
  members: z.array(HouseholdMember).min(1),
  playerMemberId: MemberId,
  assistance: z.object({ required: Tri, count: z.number().int().min(0) }),
  pets: z.object({ present: z.boolean(), types: z.array(PetType) }),
  housing: z.object({ type: HousingType, floors: z.union([z.literal(1), z.literal(2), z.literal(3)]), surroundings: Surroundings, floodHistory: FloodHistory, roof: Roof, exits: Exits }),
  medical: z.object({
    /** 'undisclosed' = prefer not to say. Never penalised (GD §14). */
    conditionPresent: z.enum(['yes', 'no', 'unknown', 'undisclosed']),
    conditionCategories: z.array(ConditionCategory),
    essentialMedication: z.enum(['yes', 'no', 'unknown', 'undisclosed']),
    allergies: z.enum(['yes', 'no', 'unknown', 'undisclosed']),
    allergyCategories: z.array(AllergyCategory),
    equipment: z.array(Equipment),
    warningAssistance: z.enum(['yes', 'no', 'unknown', 'undisclosed']),
  }),
  preparedness: z.object({
    goBag: GoBagAnswer,
    supplies: z.array(Supply),
    evacuationPlan: PlanAnswer,
    evacuationCenterKnown: Tri,
    communicationPlan: PlanAnswer,
    warningSources: z.array(WarningSource),
    backupPower: z.array(BackupPower),
  }),
  theme: ThemeId,
  budgetTier: BudgetTier,
  appearance: z.object({ choice: z.enum(['auto', 'customColor', 'randomize']), clothingColor: z.string().nullable() }),
  /** Onboarding v2 (defaults keep older saved profiles loadable). */
  configMode: z.enum(['custom', 'random']).default('custom'),
  /** Fictional environmental exposure driving storm difficulty (never a real flood-risk prediction). */
  exposure: z.enum(['standard', 'waterway', 'floodProne', 'both', 'unknown']).default('unknown'),
  scenarioPreference: z.enum(['surprise', 'balanced', 'challenging']).nullable().default(null),
});
export type HouseholdProfile = z.infer<typeof HouseholdProfile>;
