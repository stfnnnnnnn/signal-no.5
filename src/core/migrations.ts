// Save-compatibility shims applied to raw JSON before GameState validation (saves keep schemaVersion 2).
// Bayanihan revision: the former neighbour character (flags NENA_MET/NENA_HELPED, action HELP_NENA_PREPARE,
// variant EV12__NEIGHBOR) was replaced by generic community assistance. Helping her was a completed, safe
// community action before the advisory, so it maps to HELP_COMMUNITY_PREPARATION / COMMUNITY_PREP_HELPED;
// the conversation-only flag is dropped. Anything else is left untouched for the schema to judge.
type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const LEGACY_ACTION: Record<string, string> = { HELP_NENA_PREPARE: 'HELP_COMMUNITY_PREPARATION' };
const LEGACY_VARIANT: Record<string, string> = { EV12__NEIGHBOR: 'EV12__COMMUNITY' };

function migrateCounters(counters: unknown): unknown {
  if (!isObj(counters)) return counters;
  const { nenaHelpedAt: _at, 'uses:HELP_NENA_PREPARE': uses, 'uses:TALK_TO_NENA': _talk, ...rest } = counters;
  return uses === undefined ? rest : { ...rest, 'uses:HELP_COMMUNITY_PREPARATION': uses };
}
const migrateSnapshot = (snap: unknown) => (isObj(snap) ? { ...snap, flags: migrateFlags(snap.flags), counters: migrateCounters(snap.counters) } : snap);

function migrateFlags(flags: unknown): unknown {
  if (!isObj(flags) || !('NENA_MET' in flags || 'NENA_HELPED' in flags)) return flags;
  const { NENA_MET: _met, NENA_HELPED: helped, ...rest } = flags;
  return helped === true ? { ...rest, COMMUNITY_PREP_HELPED: true } : rest;
}
const action = (id: unknown) => (typeof id === 'string' ? LEGACY_ACTION[id] ?? id : id);
const variant = (id: unknown) => (typeof id === 'string' ? LEGACY_VARIANT[id] ?? id : id);

export function migrateLegacyGameState(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const s: Json = { ...raw, flags: migrateFlags(raw.flags), counters: migrateCounters(raw.counters) };
  if (Array.isArray(raw.decisionLog)) {
    s.decisionLog = raw.decisionLog.map((d) => (isObj(d) ? {
      ...d, actionId: action(d.actionId), variantId: variant(d.variantId),
      stateBefore: migrateSnapshot(d.stateBefore), stateAfter: migrateSnapshot(d.stateAfter),
    } : d));
  }
  if (Array.isArray(raw.eventHistory)) {
    s.eventHistory = raw.eventHistory.map((h) => (isObj(h) ? { ...h, variantId: variant(h.variantId), resolvedWith: action(h.resolvedWith) } : h));
  }
  if (isObj(raw.activeEvent)) {
    const ev = raw.activeEvent;
    s.activeEvent = { ...ev, variantId: variant(ev.variantId),
      actionIds: Array.isArray(ev.actionIds) && ev.variantId === 'EV12__NEIGHBOR'
        ? ['HELP_COMMUNITY_PREPARATION', 'SHARE_VERIFIED_ADVISORY', 'CHECK_HOUSEHOLD_NEEDS', 'DEFER'] : ev.actionIds };
  }
  return s;
}

/**
 * progress.json v1 → v2. v1 run summaries stored whether the former neighbour character was helped; that was a
 * completed, safe community action, so it becomes `communityHelpCompleted` and A08 progress is kept. Every other
 * run field, unlock timestamp and viewed plan is copied unchanged. Other versions pass through untouched.
 */
export function migrateLegacyProgress(raw: unknown): unknown {
  if (!isObj(raw) || raw.schemaVersion !== 1) return raw;
  const runs = Array.isArray(raw.runs) ? raw.runs.map((r) => {
    if (!isObj(r)) return r;
    const { nenaHelped, ...rest } = r;
    return { ...rest, communityHelpCompleted: nenaHelped === true, communityHelpActionId: null };
  }) : raw.runs;
  return { ...raw, schemaVersion: 2, runs };
}
