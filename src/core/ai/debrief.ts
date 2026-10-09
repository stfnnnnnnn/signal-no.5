// Debrief narration: request built from the deterministic evaluation; output validated; reviewed fallback.
import { z } from 'zod';
import type { DebriefNarrationRequest } from '../../shared/contracts/ai';
import { DebriefNarration, type DebriefEvaluation } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import { BADGE_META } from '../content/badges';
import { FINDING_BY_ID } from '../content/findings';
import { checkNarration } from './guard';

const ENDING_LABEL = { handa: 'Handa', nakaraos: 'Nakaraos', nahirapan: 'Nahirapan' } as const;

export function buildDebriefRequest(ev: DebriefEvaluation, s: GameState): DebriefNarrationRequest {
  return {
    schemaVersion: 1, score: ev.score, ending: ENDING_LABEL[ev.ending],
    strengths: ev.strengths.map((id) => ({ id, text: FINDING_BY_ID.get(id)!.strength })),
    gaps: ev.gaps.map((id) => ({ id, text: FINDING_BY_ID.get(id)!.lesson })),
    badges: ev.badgeIds.map((id) => BADGE_META.get(id)!.name),
    householdSize: s.household.size,
  };
}

/** JSON Schema for constrained decoding of the narration. */
export function debriefJsonSchema(ev: DebriefEvaluation): unknown {
  const ids = [...ev.strengths, ...ev.gaps];
  const schema = z.object({
    summary: z.string().min(1).max(300),
    highlightFindingIds: ids.length ? z.array(z.enum(ids as [string, ...string[]])).max(3) : z.array(z.string()).max(0),
  }).strict();
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export type NarrationResult = { ok: true; narration: DebriefNarration } | { ok: false; reason: string };

export function validateDebriefNarration(ev: DebriefEvaluation, raw: string): NarrationResult {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return { ok: false, reason: 'invalid-json' }; }
  const parsed = DebriefNarration.safeParse(obj);
  if (!parsed.success) return { ok: false, reason: 'schema' };
  const known = new Set([...ev.strengths, ...ev.gaps]);
  if (parsed.data.highlightFindingIds.some((id) => !known.has(id))) return { ok: false, reason: 'unknown-finding' };
  const why = checkNarration(parsed.data.summary);
  if (why) return { ok: false, reason: `ungrounded:${why}` };
  return { ok: true, narration: parsed.data };
}

export function fallbackDebriefNarration(ev: DebriefEvaluation): DebriefNarration {
  const strength = ev.strengths[0] ? FINDING_BY_ID.get(ev.strengths[0])!.strength : '';
  const gap = ev.gaps[0] ? FINDING_BY_ID.get(ev.gaps[0])!.lesson : '';
  const summary = [`Your household finished the storm with a preparedness score of ${ev.score} (${ENDING_LABEL[ev.ending]}).`, strength, gap ? `Next time: ${gap}` : '']
    .filter(Boolean).join(' ').slice(0, 400);
  return { summary, highlightFindingIds: [ev.gaps[0], ev.strengths[0]].filter((x): x is string => !!x).slice(0, 2) };
}
