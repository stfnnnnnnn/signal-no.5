// Scenario context builder, constrained-decoding schema, response validation and fallback.
// Pure functions: used by the Electron main-process adapter and testable without a model.
import { z } from 'zod';
import { ITEM_IDS, type ItemId } from '../../shared/contracts/ids';
import { ScenarioAIResponse, type ScenarioAIRequest, type ScenarioContent } from '../../shared/contracts/ai';
import type { GameState } from '../../shared/contracts/state';
import { ACTION_BY_ID } from '../content/actions';
import { EVENT_BY_ID } from '../content/events';
import { ITEM_LABELS } from '../content/items';
import * as sel from '../selectors';
import { checkGrounding, describeHome } from './guard';

export const DIALOGUE_MAX = 200;
export const DESCRIPTION_MAX = 160;

const ROLE = { age0to4: 'toddler', age5to12: 'child', age13to17: 'teen', age18to35: 'adult', age36to59: 'adult', age60plus: 'older adult' } as const;
/** Items an action may legitimately bring up in dialogue. */
const ACTION_ITEMS: Record<string, ItemId[]> = { USE_FLASHLIGHT: ['FLASHLIGHT'], USE_POWER_BANK: ['POWER_BANK'], GET_TOOLS: ['TOOLS'], SANDBAG_GATE: ['SANDBAGS'] };
const LABEL_TO_ITEM = new Map(Object.entries(ITEM_LABELS).map(([id, label]) => [label, id as ItemId]));

export function buildScenarioRequest(s: GameState): ScenarioAIRequest | null {
  const ev = s.activeEvent;
  if (!ev) return null;
  const def = EVENT_BY_ID.get(ev.eventId)!;
  const c = { s, p: s.household };
  const p = s.household;
  const available = ITEM_IDS.filter((id) => sel.itemTotal(s, id) > 0);
  return {
    schemaVersion: 2,
    eventId: ev.eventId,
    phase: s.phase,
    household: {
      size: p.size, livesAlone: p.size === 1,
      visibleMembers: p.members.filter((m) => m.visibleNpc && m.npcId).map((m) => ({ npcId: m.npcId!, role: ROLE[m.ageGroup] })),
      hasDependents: p.members.some((m) => m.dependent), assistanceNeeded: sel.assistanceNeeded(p), pets: p.pets.types,
      homeType: p.housing.type, floors: p.housing.floors, homeDescription: describeHome(p.housing), theme: p.theme,
    },
    state: {
      hoursToLandfall: Math.round(sel.minutesToLandfall(s) / sel.HOUR), weather: s.environment.weatherState,
      powerAvailable: s.environment.powerAvailable, goBag: sel.goBagStatus(s),
      availableItems: available.map((id) => ITEM_LABELS[id]),
      unavailableItems: ITEM_IDS.filter((id) => !available.includes(id) && id !== 'SANDBAGS' && id !== 'FUEL').map((id) => ITEM_LABELS[id]),
    },
    // Location is authoritative: a household on the road must not be narrated as being at home.
    facts: [...def.facts(c, ev.variantId), ...(sel.householdLocation(s) === 'inTransit' ? ['The household has left home and is travelling to the evacuation destination.'] : [])],
    recentDecisions: s.decisionLog.slice(-5).map((d) => ACTION_BY_ID.get(d.actionId)?.label ?? d.actionId),
    allowedVariantIds: [ev.variantId],
    allowedActionIds: [...ev.actionIds],
    allowedSpeakers: [def.speaker(c)],
    limits: { dialogueMaxChars: DIALOGUE_MAX, descriptionMaxChars: DESCRIPTION_MAX },
  };
}

/** Zod schema used for validation (actions: allowed IDs and exact length; exact order checked separately). */
function validationSchema(req: ScenarioAIRequest) {
  return z.object({
    schemaVersion: z.literal(1),
    eventId: z.literal(req.eventId),
    variantId: z.literal(req.allowedVariantIds[0]!),
    speaker: z.enum(req.allowedSpeakers as [string, ...string[]]),
    dialogue: z.string().min(1).max(req.limits.dialogueMaxChars),
    description: z.string().min(1).max(req.limits.descriptionMaxChars),
    actionIds: z.array(z.enum(req.allowedActionIds as [string, ...string[]])).length(req.allowedActionIds.length),
  }).strict();
}

/** JSON Schema for llama-server constrained decoding: variant const + exact action tuple. */
export function scenarioResponseJsonSchema(req: ScenarioAIRequest): unknown {
  const decode = z.object({
    schemaVersion: z.literal(1),
    eventId: z.literal(req.eventId),
    variantId: z.literal(req.allowedVariantIds[0]!),
    speaker: z.enum(req.allowedSpeakers as [string, ...string[]]),
    dialogue: z.string().min(1).max(req.limits.dialogueMaxChars),
    description: z.string().min(1).max(req.limits.descriptionMaxChars),
    actionIds: z.tuple(req.allowedActionIds.map((a) => z.literal(a)) as [z.ZodLiteral<string>, ...z.ZodLiteral<string>[]]),
  }).strict();
  return toLlamaSchema(z.toJSONSchema(decode));
}

/** llama.cpp rejects boolean `items` (Zod emits `items:false` for tuples; measured HTTP 400). */
export function toLlamaSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toLlamaSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === '$schema') continue;
    if (k === 'items' && typeof v === 'boolean') continue;
    out[k] = toLlamaSchema(v);
  }
  return out;
}

export type ValidationResult = { ok: true; content: ScenarioContent } | { ok: false; reason: 'invalid-json' | 'schema' | 'actions-altered' | 'ungrounded'; detail: string };

export function validateScenarioResponse(req: ScenarioAIRequest, raw: string): ValidationResult {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'invalid-json', detail: String(e) }; }
  const parsed = validationSchema(req).safeParse(obj);
  if (!parsed.success) return { ok: false, reason: 'schema', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  const r = parsed.data;
  if (r.actionIds.join('|') !== req.allowedActionIds.join('|')) return { ok: false, reason: 'actions-altered', detail: r.actionIds.join(',') };
  const allowedItems = new Set<ItemId>(req.state.availableItems.map((l) => LABEL_TO_ITEM.get(l)).filter((x): x is ItemId => !!x));
  for (const a of req.allowedActionIds) for (const it of ACTION_ITEMS[a] ?? []) allowedItems.add(it);
  const why = checkGrounding(`${r.dialogue} ${r.description}`, {
    livesAlone: req.household.livesAlone, allowedItems, placesAllowed: req.eventId === 'EV11',
    home: { type: req.household.homeType, floors: req.household.floors },
  });
  if (why) return { ok: false, reason: 'ungrounded', detail: why };
  const content = ScenarioAIResponse.parse(r);
  return { ok: true, content: { ...content, source: 'ai', fallbackReason: null } };
}

/** Reviewed fallback reconstructed from the request alone (the main process has no GameState). */
export function fallbackFromRequest(req: ScenarioAIRequest, reason: string): ScenarioContent {
  const def = EVENT_BY_ID.get(req.eventId)!;
  const variantId = req.allowedVariantIds[0]!;
  const fb = def.fallback[variantId] ?? Object.values(def.fallback)[0]!;
  return {
    schemaVersion: 1, eventId: req.eventId, variantId, speaker: req.allowedSpeakers[0]!,
    dialogue: fb.dialogue, description: fb.description, actionIds: [...req.allowedActionIds], source: 'fallback', fallbackReason: reason,
  };
}

/** Reviewed static content for the active event (used on timeout, invalid output, or no model). */
export function fallbackContent(s: GameState, reason: string): ScenarioContent {
  const ev = s.activeEvent;
  if (!ev) throw new Error('no active event');
  const def = EVENT_BY_ID.get(ev.eventId)!;
  const fb = def.fallback[ev.variantId] ?? Object.values(def.fallback)[0]!;
  return {
    schemaVersion: 1, eventId: ev.eventId, variantId: ev.variantId, speaker: def.speaker({ s, p: s.household }),
    dialogue: fb.dialogue, description: fb.description, actionIds: [...ev.actionIds], source: 'fallback', fallbackReason: reason,
  };
}
