// Deterministic badge evaluation (B02–B12; B01 via handa.ts). Status: eligible (in progress) · earned ·
// notEarned · notApplicable. Uses only authoritative state, milestone snapshots and the decision log.
import type { BadgeId } from '../../shared/contracts/ids';
import type { BadgeResult } from '../../shared/contracts/debrief';
import type { GameState } from '../../shared/contracts/state';
import * as sel from '../selectors';

type Check = { applicable: boolean; earned: boolean; reasons: string[] };
const f = (s: GameState, k: keyof GameState['flags']) => s.flags[k] === true;
const c = (s: GameState, k: string) => s.counters[k] ?? 0;
const happened = (s: GameState, id: string) => s.eventHistory.some((h) => h.eventId === id);
const H = sel.HOUR;
const need = (cond: boolean, reason: string, out: string[]) => { if (!cond) out.push(reason); return cond; };
function check(applicable: boolean, conds: [boolean, string][]): Check {
  const reasons: string[] = [];
  const earned = applicable && conds.map(([ok, r]) => need(ok, r, reasons)).every(Boolean);
  return { applicable, earned, reasons: applicable ? reasons : ['Not applicable to this household or run.'] };
}

export const requiredWindows = (s: GameState) => (s.household.housing.floors === 1 ? 2 : s.household.housing.floors === 2 ? 3 : 4);
const advisoryMinute = (s: GameState) => s.landfallMinute - (8 + (s.storm.advisoryLeadHours ?? 0)) * H;
const routeClosesAt = (s: GameState) => (s.storm.roadClosureEvent ? s.landfallMinute - 2 * H : s.landfallMinute);

/** B08 rules: also referenced by Handa's evacuation/household-assistance requirement. */
export function evaluateHouseholdSafety(s: GameState): BadgeResult {
  const p = s.household;
  const applicable = p.size > 1 || p.pets.present || sel.assistanceNeeded(p);
  const r = check(applicable, [
    [f(s, 'MEMBERS_ACCOUNTED'), 'Not every household member was accounted for.'],
    [!sel.assistanceNeeded(p) || f(s, 'ASSISTANCE_ARRANGED'), 'Help for the member who needs assistance was not arranged.'],
    [!p.pets.present || f(s, 'PET_SUPPLIES_READY'), 'Pet evacuation supplies were not prepared.'],
    [!s.environment.evacuationAdvisoryIssued || s.evacuation.completed, 'The household did not evacuate together after the advisory.'],
  ]);
  return toResult('B08', s, r);
}

function toResult(id: BadgeId, s: GameState, r: Check): BadgeResult {
  if (!r.applicable) return { id, status: 'notApplicable', reasons: r.reasons };
  if (!s.completed) return { id, status: 'eligible', reasons: [] };
  return { id, status: r.earned ? 'earned' : 'notEarned', reasons: r.reasons };
}

const RULES: Record<Exclude<BadgeId, 'B01' | 'B08'>, (s: GameState) => Check> = {
  B02: (s) => check(true, [[c(s, 'pd_goBagReady') === 1, 'The go-bag was not complete by the preparation deadline.']]),
  B03: (s) => check(true, [[c(s, 'hr_water') >= sel.waterRequirement(s.household), `Less than ${sel.waterRequirement(s.household)} L of drinking water was stored before the water supply was interrupted.`]]),
  B04: (s) => {
    const refills = s.shop.purchases.filter((x) => x.shopItemId === 'MEDICATION_REFILL').reduce((n, x) => n + x.quantity, 0);
    return check(sel.needsEssentialMedication(s.household), [
      [c(s, 'lf_medPacked') === 1, 'Essential medication or supplies were not prepared before the storm.'],
      [refills <= 1, 'More medication was bought than the household needed.'],
    ]);
  },
  B05: (s) => check(!s.completed || happened(s, 'EV07'), [[f(s, 'RUMOR_VERIFIED'), 'The rumour was not verified with an official source.'], [!f(s, 'RUMOR_FORWARDED'), 'An unverified rumour was shared.']]),
  B06: (s) => check(true, [
    [f(s, 'NENA_HELPED'), 'Aling Nena was not helped to get ready.'],
    [f(s, 'NENA_HELPED') && c(s, 'nenaHelpedAt') <= (s.storm.evacuationAdvisoryEvent ? advisoryMinute(s) : s.landfallMinute - 8 * H), 'Help came too late.'],
    [!f(s, 'UNSAFE_ACTION_ATTEMPTED'), 'An unsafe action was taken.'],
  ]),
  B07: (s) => check(!s.completed || s.environment.evacuationAdvisoryIssued, [
    [s.evacuation.completed, 'The household did not reach the evacuation destination.'],
    [s.evacuation.departedAtMinute !== null && s.evacuation.departedAtMinute <= routeClosesAt(s), 'The household left after the route became unsafe.'],
  ]),
  B09: (s) => check(true, [[c(s, 'hr_windows') >= requiredWindows(s), `Fewer than ${requiredWindows(s)} windows were protected before heavy rain.`]]),
  B10: (s) => check(sel.roofNeedsSecuring(s.household), [[c(s, 'hr_roof') === 1, 'Roof preparation was not completed before dangerous winds.']]),
  B11: (s) => check(true, [
    [f(s, 'MEETING_POINT_KNOWN'), 'No household meeting point was set.'],
    [f(s, 'EVACUATION_CENTER_KNOWN'), 'The designated evacuation center was not identified.'],
    [!sel.hasOthers(s.household) || f(s, 'FAMILY_MEETING_DONE'), 'The household plan was not discussed with everyone.'],
  ]),
  B12: (s) => check(true, [
    [c(s, 'lf_lighting') === 1, 'No working emergency light at landfall.'],
    [c(s, 'lf_phone') >= 80 || c(s, 'lf_powerBankCharged') === 1, 'Neither a charged phone (≥ 80%) nor a charged power bank at landfall.'],
  ]),
};

/** All badges except B01 (Handa is attached by evaluateRun from evaluateHanda). Idempotent and pure. */
export function evaluateBadges(s: GameState): BadgeResult[] {
  const out: BadgeResult[] = [];
  for (const id of ['B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12'] as const) {
    out.push(id === 'B08' ? evaluateHouseholdSafety(s) : toResult(id, s, RULES[id](s)));
  }
  return out;
}
