// GameState schemaVersion 2: run-specific, authoritative simulation state (owned by src/core).
// Static content (actions, events, items, badges) is NOT stored here; see src/core/content.
import { z } from 'zod';
import { ActionId, BadgeId, EventId, FlagId, GamePhase, ItemId, SceneId, TimeScale } from './ids';
import { HouseholdProfile } from './household';

export const ItemCounts = z.partialRecord(ItemId, z.number().min(0));
export type ItemCounts = z.infer<typeof ItemCounts>;

export const PauseReason = z.enum(['menu', 'dialogue', 'loading', 'focusLost', 'decision', 'shop', 'external']);
export type PauseReason = z.infer<typeof PauseReason>;

export const ClockState = z.object({
  gameMinutes: z.number().min(0),
  timeScale: TimeScale,
  pauseReasons: z.array(PauseReason),
});
export type ClockState = z.infer<typeof ClockState>;

export const Severity = z.enum(['none', 'low', 'moderate', 'severe']);
export type Severity = z.infer<typeof Severity>;

export const StormConfig = z.object({
  stormSeed: z.number().int(),
  landfallAccelerationHours: z.union([z.literal(0), z.literal(4), z.literal(8)]),
  powerOutageEvent: z.boolean(),
  roadClosureEvent: z.boolean(),
  shopClosureEvent: z.boolean(),
  evacuationAdvisoryEvent: z.boolean(),
  misinformationEvent: z.boolean(),
  /** Authored peak flood severity for this household's scenario tags (SPEC_RECONCILIATION R4). */
  peakFloodSeverity: Severity,
  peakWindSeverity: z.enum(['low', 'moderate', 'severe']),
});
export type StormConfig = z.infer<typeof StormConfig>;

export const EnvironmentState = z.object({
  weatherState: z.enum(['clear', 'rain', 'heavyRain', 'typhoon']),
  windSeverity: z.enum(['low', 'moderate', 'severe']),
  floodSeverity: Severity,
  powerAvailable: z.boolean(),
  tapWaterAvailable: z.boolean(),
  roadStatus: z.enum(['open', 'restricted', 'closed']),
  shopOpen: z.boolean(),
  officialAdvisoryIssued: z.boolean(),
  evacuationAdvisoryIssued: z.boolean(),
  landfallRevealed: z.boolean(),
  shelterCondition: z.enum(['normal', 'compromised', 'unsafe']),
  windowDamage: z.enum(['none', 'minor', 'major']),
  roofDamage: z.enum(['none', 'minor', 'major']),
  propertyDamage: z.enum(['none', 'minor', 'major']),
  suppliesLost: z.boolean(),
  documentsLost: z.boolean(),
});
export type EnvironmentState = z.infer<typeof EnvironmentState>;

export const EvacuationState = z.object({
  decision: z.enum(['pending', 'comply', 'delay', 'decline', 'seekAssistance']),
  destinationKnown: z.boolean(),
  transportAvailable: z.boolean(),
  departedAtMinute: z.number().nullable(),
  arrivalAtMinute: z.number().nullable(),
  completed: z.boolean(),
  currentShelter: z.enum(['home', 'evacuationCenter']),
  rescueOutcome: z.boolean(),
});
export type EvacuationState = z.infer<typeof EvacuationState>;

export const ShopItemId = z.enum(['WATER_JUG', 'FOOD_PACK', 'MEDICATION_REFILL', 'FLASHLIGHT', 'POWER_BANK', 'FIRST_AID_KIT', 'TOOLS', 'RADIO', 'FUEL', 'BATTERIES', 'HYGIENE_KIT', 'PET_SUPPLIES', 'CHILD_CARE_SUPPLIES', 'SANDBAGS']);
export type ShopItemId = z.infer<typeof ShopItemId>;

export const ShopState = z.object({
  stock: z.partialRecord(ShopItemId, z.number().int().min(0)),
  visitCount: z.number().int().min(0),
  totalSpent: z.number().min(0),
  purchases: z.array(z.object({ shopItemId: ShopItemId, quantity: z.number().int().min(1), unitPrice: z.number(), atMinute: z.number() })),
});
export type ShopState = z.infer<typeof ShopState>;

export const StateSnapshot = z.object({
  gameMinutes: z.number(),
  cash: z.number(),
  phoneBattery: z.number(),
  house: ItemCounts,
  goBag: ItemCounts,
  flags: z.partialRecord(FlagId, z.boolean()),
  counters: z.record(z.string(), z.number()),
});
export type StateSnapshot = z.infer<typeof StateSnapshot>;

export const DecisionRecord = z.object({
  seq: z.number().int(),
  eventId: EventId.nullable(),
  variantId: z.string().nullable(),
  actionId: ActionId,
  /** Simulated minute when the action started. */
  tick: z.number(),
  timeCostMinutes: z.number(),
  stateBefore: StateSnapshot,
  stateAfter: StateSnapshot,
  safetyRuleId: z.string().nullable(),
  objectiveIds: z.array(z.string()),
});
export type DecisionRecord = z.infer<typeof DecisionRecord>;

export const ActiveEvent = z.object({
  eventId: EventId,
  variantId: z.string(),
  triggeredAtMinute: z.number(),
  mandatory: z.boolean(),
  /** Engine-owned, ordered, immutable choices for this event instance. */
  actionIds: z.array(ActionId).min(1),
});
export type ActiveEvent = z.infer<typeof ActiveEvent>;

export const GameState = z.object({
  schemaVersion: z.literal(2),
  runId: z.string(),
  seed: z.number().int(),
  phase: GamePhase,
  scene: SceneId,
  clock: ClockState,
  landfallMinute: z.number(),
  household: HouseholdProfile,
  cash: z.number().min(0),
  phoneBattery: z.number().min(0).max(100),
  house: ItemCounts,
  goBag: ItemCounts,
  flags: z.partialRecord(FlagId, z.boolean()),
  counters: z.record(z.string(), z.number()),
  storm: StormConfig,
  environment: EnvironmentState,
  evacuation: EvacuationState,
  shop: ShopState,
  aftermathDay: z.number().int().min(0).max(3),
  activeEvent: ActiveEvent.nullable(),
  /** Events that became due and wait to be shown (chronological, then priority). */
  pendingEvents: z.array(z.object({ eventId: EventId, dueMinute: z.number() })),
  firedMilestones: z.array(z.string()),
  eventHistory: z.array(z.object({ eventId: EventId, variantId: z.string(), atMinute: z.number(), resolvedWith: ActionId.nullable() })),
  decisionLog: z.array(DecisionRecord),
  earnedBadges: z.array(BadgeId),
  completed: z.boolean(),
});
export type GameState = z.infer<typeof GameState>;
