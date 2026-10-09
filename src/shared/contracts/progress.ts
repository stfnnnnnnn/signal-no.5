// Cross-run progress (achievements). Stored locally in <userData>/data/progress.json. Contains NO household,
// medical or personal details: only per-run gameplay summaries.
import { z } from 'zod';
import { BadgeId } from './ids';

export const ACHIEVEMENT_IDS = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10'] as const;
export const AchievementId = z.enum(ACHIEVEMENT_IDS);
export type AchievementId = z.infer<typeof AchievementId>;

export const RunSummary = z.object({
  runId: z.string(),
  stormSeed: z.number().int(),
  configMode: z.enum(['custom', 'random']),
  exposure: z.enum(['standard', 'waterway', 'floodProne', 'both', 'unknown']),
  budgetTier: z.enum(['limited', 'moderate', 'higher']),
  completedAt: z.string(),
  score: z.number().int().min(0).max(100),
  /** From the authoritative evaluateHanda (never recomputed by achievements). */
  handaEarned: z.boolean(),
  wellbeingPercent: z.number(),
  badgeIds: z.array(BadgeId),
  lessonIds: z.array(z.string()),
  rumorOpportunity: z.boolean(),
  rumorForwarded: z.boolean(),
  nenaHelped: z.boolean(),
});
export type RunSummary = z.infer<typeof RunSummary>;

export const ProgressFile = z.object({
  schemaVersion: z.literal(1),
  runs: z.array(RunSummary),
  plansViewed: z.array(z.string()),
  unlocked: z.partialRecord(AchievementId, z.string()),
});
export type ProgressFile = z.infer<typeof ProgressFile>;
export const EMPTY_PROGRESS: ProgressFile = { schemaVersion: 1, runs: [], plansViewed: [], unlocked: {} };

export const AchievementStatus = z.object({
  id: AchievementId, name: z.string(), description: z.string(), iconAssetId: z.string(),
  progress: z.number().int().min(0), target: z.number().int().min(1), unlocked: z.boolean(), unlockedAt: z.string().nullable(),
});
export type AchievementStatus = z.infer<typeof AchievementStatus>;
