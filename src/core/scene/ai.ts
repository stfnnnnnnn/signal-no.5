// Prompt + constrained-decoding schema for optional AI scene variations. The schema's enums are exactly the
// request's allowed sets, so the model can only produce state-consistent IDs; validateSceneSuggestion re-checks.
import { z } from 'zod';
import type { SceneAIRequest } from '../../shared/contracts/scene';
import { toLlamaSchema } from '../ai/scenario';
import type { ChatMessage } from '../ai/prompts';

const enumOrNone = (values: readonly string[]) => (values.length ? z.enum(values as [string, ...string[]]) : z.never());

export function sceneSuggestionJsonSchema(req: SceneAIRequest): unknown {
  const a = req.allowed;
  const decorVariants = [...new Set(a.decor.flatMap((d) => d.variants))];
  const schema = z.object({
    basisKey: z.literal(req.basisKey),
    lighting: z.enum(a.lighting as [string, ...string[]]).optional(),
    extraEffects: a.extraEffects.length ? z.array(enumOrNone(a.extraEffects)).max(3).optional() : z.array(z.string()).max(0).optional(),
    decor: a.decor.length ? z.array(z.object({ anchor: enumOrNone(a.decor.map((d) => d.anchor)), variant: enumOrNone(decorVariants) }).strict()).max(3).optional() : z.array(z.string()).max(0).optional(),
    npcCues: a.npcIds.length ? z.array(z.object({ npcId: enumOrNone(a.npcIds), animation: enumOrNone(a.animations), emotion: enumOrNone(a.emotions) }).strict()).max(3).optional() : z.array(z.string()).max(0).optional(),
    audio: z.enum(a.audio as [string, ...string[]]).optional(),
    mood: z.enum(a.moods as [string, ...string[]]).optional(),
  }).strict();
  return toLlamaSchema(z.toJSONSchema(schema));
}

const SYSTEM = [
  'You choose atmospheric presentation for one scene of an educational 8-bit typhoon-preparedness game.',
  'The game has already fixed the weather, flood level, power state and required props. Choose only optional variations',
  'from the "allowed" lists that fit the context and mood (for example a gloomier lighting option, an extra weather effect,',
  'decor that suits the home theme, and calm or worried NPC cues). Keep it subtle; leave fields out if unsure.',
  'Reply with JSON only: {"basisKey" (copy it), optional "lighting", "extraEffects", "decor", "npcCues", "audio", "mood"}.',
].join('\n');

export function buildScenePromptMessages(req: SceneAIRequest): ChatMessage[] {
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(req) }];
}
