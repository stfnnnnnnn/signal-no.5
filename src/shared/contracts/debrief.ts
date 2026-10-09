// DebriefEvaluation (deterministic, engine-computed) and DebriefNarration (AI wording only).
// Preserves the project_context.md §15 field names; adds score, categories and ending (GD §14).
import { z } from 'zod';
import { BadgeId } from './ids';

export const CompetencyCategory = z.enum(['emergencySupplies', 'officialInformation', 'householdCoordination', 'evacuationPreparedness', 'householdNeeds', 'hazardAwareness']);
export type CompetencyCategory = z.infer<typeof CompetencyCategory>;

export const Ending = z.enum(['handa', 'nakaraos', 'nahirapan']);
export type Ending = z.infer<typeof Ending>;

export const FindingId = z.string().regex(/^F_[A-Z0-9_]+$/);

export const BadgeStatus = z.enum(['eligible', 'earned', 'notEarned', 'notApplicable']);
export const BadgeResult = z.object({ id: BadgeId, status: BadgeStatus, reasons: z.array(z.string()) });
export type BadgeResult = z.infer<typeof BadgeResult>;

/** B01 Handa breakdown (badge; distinct from the score-based `ending`). */
export const HandaResult = z.object({
  earned: z.boolean(),
  runCompleted: z.boolean(),
  wellbeingPercent: z.number(),
  wellbeingThreshold: z.literal(85),
  wellbeingMet: z.boolean(),
  criticalCompetencies: z.array(z.object({ objectiveId: z.string(), applicable: z.boolean(), met: z.boolean().nullable() })),
  criticalGaps: z.array(FindingId),
  evacuationAndAssistanceMet: z.boolean(),
  exposure: z.string(),
  reasons: z.array(z.string()),
});
export type HandaResult = z.infer<typeof HandaResult>;

export const DebriefEvaluation = z.object({
  schemaVersion: z.literal(2),
  score: z.number().int().min(0).max(100),
  ending: Ending,
  /** Authored Na-rescue narrative outcome; independent of the score (GD §14). */
  rescueOutcome: z.boolean(),
  categories: z.array(z.object({
    category: CompetencyCategory, weight: z.number(), earned: z.number(), included: z.boolean(),
    objectives: z.array(z.object({ id: z.string(), met: z.boolean() })),
  })),
  timeline: z.array(z.object({ seq: z.number(), atMinute: z.number(), eventId: z.string().nullable(), actionId: z.string(), label: z.string() })),
  strengths: z.array(FindingId),
  gaps: z.array(FindingId),
  learningPoints: z.array(z.object({ findingId: FindingId, safetyRuleId: z.string().nullable(), text: z.string() })),
  checklistItems: z.array(z.object({ id: z.string(), text: z.string() })),
  /** Earned badges only (convenience). */
  badgeIds: z.array(BadgeId),
  /** Status of all 12 badges with reasons. */
  badges: z.array(BadgeResult),
  handa: HandaResult,
  /** Lesson cards unlocked this run: findings for every objective that applied (met or not). */
  lessonIds: z.array(FindingId),
});
export type DebriefEvaluation = z.infer<typeof DebriefEvaluation>;

export const DebriefNarration = z.object({
  summary: z.string().min(1).max(400),
  highlightFindingIds: z.array(FindingId).max(4),
});
export type DebriefNarration = z.infer<typeof DebriefNarration>;
