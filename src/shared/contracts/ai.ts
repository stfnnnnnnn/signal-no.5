// AI boundary contracts. ScenarioAIResponse keeps its v1 shape (project_context.md §15) with the approved
// P1/P2 tightening: variantId must echo the engine's single variant; actionIds must equal allowedActionIds exactly.
// ScenarioAIRequest v2 carries a MINIMISED household summary (no medical categories, no sex).
import { z } from 'zod';
import { EventId } from './ids';

export const AIMemberSummary = z.object({ npcId: z.string(), role: z.enum(['adult', 'older adult', 'teen', 'child', 'toddler']) });

export const ScenarioAIRequest = z.object({
  schemaVersion: z.literal(2),
  eventId: EventId,
  phase: z.string(),
  household: z.object({
    size: z.number().int(),
    livesAlone: z.boolean(),
    visibleMembers: z.array(AIMemberSummary),
    hasDependents: z.boolean(),
    assistanceNeeded: z.boolean(),
    pets: z.array(z.string()),
    homeType: z.string(),
    floors: z.number().int(),
    /** Plain-words home ("single-story house"); the only way the AI may describe the player's home. Optional (additive). */
    homeDescription: z.string().optional(),
    theme: z.string(),
  }),
  state: z.object({
    /** null while the game keeps landfall timing hidden from the player (environment.landfallRevealed). */
    hoursToLandfall: z.number().nullable(),
    landfallRevealed: z.boolean().optional(),
    floodSeverity: z.string().optional(),
    location: z.enum(['home', 'inTransit', 'evacuationCenter']).optional(),
    weather: z.string(),
    powerAvailable: z.boolean(),
    goBag: z.string(),
    availableItems: z.array(z.string()),
    unavailableItems: z.array(z.string()),
  }),
  /** Approved scenario facts: the only factual claims the AI may restate. */
  facts: z.array(z.string()),
  recentDecisions: z.array(z.string()).max(5),
  allowedVariantIds: z.array(z.string()).length(1),
  allowedActionIds: z.array(z.string()).min(1),
  allowedSpeakers: z.array(z.string()).min(1),
  limits: z.object({ dialogueMaxChars: z.number().int(), descriptionMaxChars: z.number().int() }),
});
export type ScenarioAIRequest = z.infer<typeof ScenarioAIRequest>;

export const ScenarioAIResponse = z.object({
  schemaVersion: z.literal(1),
  eventId: EventId,
  variantId: z.string(),
  speaker: z.string(),
  dialogue: z.string().min(1),
  description: z.string().min(1),
  actionIds: z.array(z.string()),
}).strict();
export type ScenarioAIResponse = z.infer<typeof ScenarioAIResponse>;

export const ScenarioContent = ScenarioAIResponse.extend({
  source: z.enum(['ai', 'fallback']),
  /** Why fallback was used (diagnostics only; never shown as gameplay). */
  fallbackReason: z.string().nullable(),
});
export type ScenarioContent = z.infer<typeof ScenarioContent>;

export const DebriefNarrationRequest = z.object({
  schemaVersion: z.literal(1),
  score: z.number(),
  ending: z.string(),
  strengths: z.array(z.object({ id: z.string(), text: z.string() })),
  gaps: z.array(z.object({ id: z.string(), text: z.string() })),
  badges: z.array(z.string()),
  householdSize: z.number().int(),
  /** The configured home, so narration can be checked against it. Optional (additive). */
  home: z.object({ type: z.string(), floors: z.number().int(), description: z.string() }).optional(),
});
export type DebriefNarrationRequest = z.infer<typeof DebriefNarrationRequest>;
