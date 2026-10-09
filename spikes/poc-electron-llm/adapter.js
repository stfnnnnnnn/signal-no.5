// THROWAWAY spike. AI adapter: per-request Zod schema -> JSON Schema -> constrained request -> Zod validation -> fallback.
const { z } = require('zod');

// Subset of project_context.md §15, enough for the spike.
const ScenarioAIRequest = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  phase: z.enum(['calm', 'preparation', 'escalation', 'decision', 'resolution', 'debrief']),
  household: z.object({
    homeType: z.enum(['singleStory', 'multiStory', 'apartment', 'preferNotToSay']),
    occupants: z.enum(['alone', 'withOthers']),
    assistanceNeeded: z.enum(['yes', 'no', 'preferNotToSay']),
    essentialSupplies: z.enum(['yes', 'no', 'preferNotToSay']),
    goBagStatus: z.enum(['ready', 'partial', 'notReady', 'unsure']),
  }),
  state: z.object({ tick: z.number().int(), tickBudget: z.number().int(), flags: z.record(z.string(), z.boolean()), inventory: z.array(z.string()) }),
  recentDecisions: z.array(z.object({ eventId: z.string(), actionId: z.string() })).max(5),
  allowedVariantIds: z.array(z.string()).min(1),
  allowedActionIds: z.array(z.string()).min(1),
  allowedSpeakers: z.array(z.string()).min(1),
  limits: z.object({ dialogueMaxChars: z.number().int().positive(), descriptionMaxChars: z.number().int().positive() }),
});

// Approved P1/P2: the engine selects the variant (exactly one allowed) and owns the action list.
// actionIds must equal allowedActionIds exactly (same items, same order): a tuple of literals,
// which becomes prefixItems/const in JSON Schema and is enforced by both the grammar and Zod.
function responseSchemaFor(req) {
  const variant = req.allowedVariantIds.length === 1 ? z.literal(req.allowedVariantIds[0]) : z.enum(req.allowedVariantIds);
  return z.object({
    schemaVersion: z.literal(1),
    eventId: z.literal(req.eventId),
    variantId: variant,
    speaker: z.enum(req.allowedSpeakers),
    dialogue: z.string().min(1).max(req.limits.dialogueMaxChars),
    description: z.string().min(1).max(req.limits.descriptionMaxChars),
    actionIds: z.tuple(req.allowedActionIds.map((a) => z.literal(a))),
  }).strict();
}

// llama.cpp's schema converter rejects boolean `items` (Zod emits `items:false` for tuples, measured HTTP 400).
// prefixItems + minItems = maxItems already pin the tuple, so dropping it loses nothing.
function toLlamaSchema(node) {
  if (Array.isArray(node)) return node.map(toLlamaSchema);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === '$schema') continue;
    if (k === 'items' && typeof v === 'boolean') continue;
    out[k] = toLlamaSchema(v);
  }
  return out;
}

const BLOCKLIST = [/https?:\/\//i, /www\./i, /\b\d{3,}[-\s]?\d{3,}\b/, /\bsignal (no\.?|number)\s*\d/i, /\bguarantee/i, /\bsafe to\b/i, /\bdosage\b|\bmg\b/i];

function validate(req, raw) {
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'invalid-json' }; }
  const parsed = responseSchemaFor(req).safeParse(obj);
  if (!parsed.success) return { ok: false, reason: 'schema', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  if (parsed.data.actionIds.join('|') !== req.allowedActionIds.join('|')) return { ok: false, reason: 'actionIds-not-exact' };
  const text = `${parsed.data.dialogue} ${parsed.data.description}`;
  const hit = BLOCKLIST.find((re) => re.test(text));
  if (hit) return { ok: false, reason: 'blocklist', pattern: String(hit) };
  return { ok: true, data: parsed.data };
}

const SYSTEM = 'You are the narrator and NPC voice for an educational typhoon-preparedness game set in the Philippines. ' +
  'The game has already chosen the event and its variant (allowedVariantIds has exactly one entry; the variant name describes the situation). ' +
  'Write a short, calm, in-character NPC line (dialogue) and a one-sentence scene description that fit this variant, the household profile, ' +
  'the current state flags, inventory and recent decisions. Mention only people and items consistent with the household and inventory. ' +
  'Do not invent warnings, signal levels, phone numbers, websites, places, medical instructions or safety rules, and do not tell the player what to do. ' +
  'Return JSON only: schemaVersion, eventId, variantId (copy the given one), speaker, dialogue (<=170 chars), description (<=140 chars), ' +
  'actionIds (copy allowedActionIds exactly, same order).';

function fallbackFor(req) {  // stands in for the event's reviewed fallback text
  return { schemaVersion: 1, eventId: req.eventId, variantId: req.allowedVariantIds[0], speaker: req.allowedSpeakers[0],
    dialogue: 'We should talk about how everyone will get ready before the weather gets worse.',
    description: 'Your household gathers in the living room.', actionIds: [...req.allowedActionIds] };
}

const INJECT = {
  badjson: () => '{"schemaVersion": 1, "eventId": ',
  unknownAction: (raw) => { const o = JSON.parse(raw); o.actionIds = ['RUN_INTO_FLOODWATER']; return JSON.stringify(o); },
  overlength: (raw) => { const o = JSON.parse(raw); o.dialogue = 'x'.repeat(500); return JSON.stringify(o); },
  duplicate: (raw) => { const o = JSON.parse(raw); o.actionIds = [o.actionIds[0], o.actionIds[0]]; return JSON.stringify(o); },
};

async function generate(server, reqInput, { inject = null, timeoutMs = 8000 } = {}) {
  const req = ScenarioAIRequest.parse(reqInput);  // renderer input is untrusted
  const t0 = Date.now();
  const jsonSchema = toLlamaSchema(z.toJSONSchema(responseSchemaFor(req)));
  let raw = null, meta = {};
  if (server.status === 'ready') {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await fetch(`http://127.0.0.1:${server.port}/v1/chat/completions`, {
          method: 'POST', signal: AbortSignal.timeout(timeoutMs),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${server.apiKey}` },
          body: JSON.stringify({
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(req) }],
            temperature: 0.7, top_p: 0.8, top_k: 20, max_tokens: 300, cache_prompt: false,
            response_format: { type: 'json_schema', json_schema: { name: 'ScenarioAIResponse', schema: jsonSchema } },
          }),
        });
        if (!r.ok) { meta = { attempt, httpStatus: r.status, body: (await r.text()).slice(0, 300) }; continue; }
        const j = await r.json();
        raw = j.choices[0].message.content; meta = { attempt, timings: j.timings };
        if (inject && INJECT[inject]) raw = INJECT[inject](raw);
        const v = validate(req, raw);
        if (v.ok) return { content: { ...v.data, source: 'ai' }, ms: Date.now() - t0, meta };
        meta.rejected = v;
        if (inject) break;  // injected faults are deterministic; don't retry
      } catch (e) { meta = { attempt, error: String(e) }; }
    }
  } else { meta = { serverStatus: server.status }; }
  return { content: { ...fallbackFor(req), source: 'fallback' }, ms: Date.now() - t0, meta };
}

module.exports = { generate, validate, responseSchemaFor, ScenarioAIRequest, INJECT };
