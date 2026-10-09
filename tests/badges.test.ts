import { describe, expect, it } from 'vitest';
import { createGame, type GameEngine } from '../src/core/engine';
import { evaluateRun } from '../src/core/evaluation/evaluate';
import { evaluateHanda, HANDA_WELLBEING_THRESHOLD, CRITICAL_OBJECTIVES } from '../src/core/evaluation/handa';
import { evaluateBadges } from '../src/core/evaluation/badges';
import { BADGE_CATALOG } from '../src/core/content/badges';
import { validateDebriefNarration } from '../src/core/ai/debrief';
import type { GameState } from '../src/shared/contracts/state';
import type { Exposure } from '../src/shared/contracts/onboarding';
import { customFamily, customSolo } from './fixtures/onboarding';
import { playDiligently } from './diligent';
import { playToEnd } from './helpers';

const SURR: Record<Exposure, ('waterway' | 'floodProne' | 'neither' | 'notSure')[]> = { standard: ['neither'], waterway: ['waterway'], floodProne: ['floodProne'], both: ['waterway', 'floodProne'], unknown: ['notSure'] };
function game(input: Parameters<typeof createGame>[0], seed: number): GameEngine {
  const r = createGame(input, { seed }); if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.engine;
}
/** First seed whose diligent run earns Handa (proves attainability). */
function qualifying(input: Parameters<typeof createGame>[0]): GameState {
  for (let seed = 1; seed <= 12; seed++) {
    const st = playDiligently(game(input, seed));
    if (evaluateHanda(st).earned) return st;
  }
  throw new Error('Handa not attainable for this configuration');
}
const withWellbeing = (st: GameState, current: number, max = 100): GameState => ({ ...st, player: { ...st.player, wellbeing: { current, max } } });
const badge = (st: GameState, id: string) => evaluateBadges(st).find((b) => b.id === id)!;

const base = qualifying(customSolo());

describe('Handa (B01): mandatory boundary tests', () => {
  it.each([[100, true], [90, true], [85, true], [84.99, false], [80, false]])('completed run, all requirements met, wellbeing %d%% → earned=%s', (wb, earned) => {
    const h = evaluateHanda(withWellbeing(base, wb));
    expect(h.earned).toBe(earned);
    expect(h.wellbeingPercent).toBe(wb);
    expect(h.wellbeingThreshold).toBe(HANDA_WELLBEING_THRESHOLD);
    expect(h.wellbeingMet).toBe(wb >= 85);
  });

  it('6: 100% wellbeing but an unresolved critical gap → not earned', () => {
    const st = structuredClone(base); st.flags.COMMUNICATION_PLAN_READY = false; st.flags.MEETING_POINT_KNOWN = false;
    const h = evaluateHanda(st);
    expect(h.earned).toBe(false);
    expect(h.criticalGaps).toContain('F_COMMUNICATION');
  });

  it('7: exactly 85% but a missing applicable critical competency → not earned', () => {
    const st = withWellbeing(structuredClone(base), 85); st.flags.EVACUATION_CENTER_KNOWN = false;
    const h = evaluateHanda(st);
    expect(h.earned).toBe(false);
    expect(h.criticalCompetencies.find((c) => c.objectiveId === 'O_DESTINATION')).toMatchObject({ applicable: true, met: false });
  });

  it('8: incomplete run at 100% → not earned', () => {
    const st = { ...base, completed: false };
    expect(evaluateHanda(st).earned).toBe(false);
    expect(evaluateHanda(st).reasons.join(' ')).toMatch(/not complete/i);
  });

  it('9: uses the player\'s wellbeing only; household safety is judged by the evacuation/assistance rules (B08)', () => {
    const fam = qualifying(customFamily());
    const h = evaluateHanda(withWellbeing(fam, 85));
    expect(h.earned).toBe(true);
    expect(fam.household.members.every((m) => !('wellbeing' in m))).toBe(true);
    const unaccounted = structuredClone(fam); unaccounted.flags.MEMBERS_ACCOUNTED = false;
    const h2 = evaluateHanda(unaccounted);
    expect(h2.earned).toBe(false);
    expect(h2.evacuationAndAssistanceMet).toBe(false);
  });

  it('11: an invalid maximum wellbeing is rejected', () => {
    expect(() => evaluateHanda(withWellbeing(base, 0, 0))).toThrow();
  });

  it('12: repeated evaluation is idempotent (one badge, same result)', () => {
    const a = evaluateRun(base); const b = evaluateRun(structuredClone(base));
    expect(a).toEqual(b);
    expect(a.badgeIds.filter((x) => x === 'B01')).toHaveLength(1);
  });

  it('13: a UI-rounded "85%" is not enough when the underlying value is below 85', () => {
    const st = withWellbeing(base, 84.6); // Math.round → 85 in a UI
    expect(Math.round(evaluateHanda(st).wellbeingPercent)).toBe(85);
    expect(evaluateHanda(st).earned).toBe(false);
  });

  it('14: AI narration claiming Handa cannot change the deterministic result', () => {
    const st = withWellbeing(base, 80);
    const ev = evaluateRun(st);
    const v = validateDebriefNarration(ev, JSON.stringify({ summary: 'Congratulations, you earned the Handa badge!', highlightFindingIds: [] }));
    expect(ev.handa.earned).toBe(false);
    expect(ev.badgeIds).not.toContain('B01');
    expect(evaluateRun(st)).toEqual(ev); // evaluation takes no AI input
    void v;
  });

  it('15: an inapplicable optional competency does not block Handa', () => {
    expect(base.household.size).toBe(1);
    expect(badge(base, 'B08').status).toBe('notApplicable'); // nobody to account for
    expect(badge(base, 'B04').status).toBe('notApplicable'); // no medication need
    expect(evaluateHanda(base).earned).toBe(true);
  });

  it('defines the critical competency set explicitly from existing objectives', () => {
    expect(CRITICAL_OBJECTIVES).toEqual(['O_WATER', 'O_GO_BAG', 'O_BULLETIN', 'O_COMMUNICATION', 'O_ACCOUNTED', 'O_DESTINATION', 'O_ADVISORY_RESPONSE', 'O_MEDICATION', 'O_ASSISTANCE', 'O_HAZARD_RESPONSE', 'O_NO_UNSAFE']);
  });

  it('keeps the score ending independent of the badge', () => {
    const ev = evaluateRun(withWellbeing(base, 50));
    expect(ev.handa.earned).toBe(false);
    expect(ev.ending).toBe(ev.score >= 85 ? 'handa' : ev.score >= 60 ? 'nakaraos' : 'nahirapan');
  });
});

describe('10: Handa is attainable under every environmental exposure profile', () => {
  it.each(['standard', 'waterway', 'floodProne', 'both', 'unknown'] as const)('%s', (exposure) => {
    const st = qualifying({ ...customSolo(), q6Surroundings: SURR[exposure] });
    expect(st.storm.exposure).toBe(exposure);
    expect(evaluateHanda(withWellbeing(st, 85)).earned).toBe(true);
  });

  it('a larger household with assistance, medication and a pet can earn it under the hardest profile', () => {
    const st = qualifying(customFamily()); // both, assistance yes, medication yes, pet
    expect(st.storm.exposure).toBe('both');
    expect(evaluateHanda(st).earned).toBe(true);
  });
});

describe('other badges (B02–B12)', () => {
  it('has the revised 12-badge catalog with icon asset IDs', () => {
    expect(BADGE_CATALOG.map((b) => [b.id, b.name])).toEqual([['B01', 'Handa'], ['B02', 'Go-Bag Ready'], ['B03', 'Tubig Muna'], ['B04', 'Botika Run'], ['B05', 'Fact Checker'],
      ['B06', 'Bayanihan'], ['B07', 'Maagang Lumikas'], ['B08', 'Walang Maiiwan'], ['B09', 'Bintana Boss'], ['B10', 'Bubong Secured'], ['B11', 'Family Plan'], ['B12', 'Powered Up']]);
    expect(BADGE_CATALOG.every((b) => /^badge_b\d\d_/.test(b.iconAssetId))).toBe(true);
  });

  it('reports "eligible" (in progress) before the run completes', () => {
    const e = game(customSolo(), 1);
    expect(evaluateBadges(e.getState()).find((b) => b.id === 'B02')!.status).toBe('eligible');
  });

  const careless = playToEnd(game(customFamily(), 2), ['DEFER', 'IGNORE_RUMOR', 'FORWARD_RUMOR', 'DELAY_EVACUATION', 'GO_OUTSIDE_TO_CHECK', 'FINISH_REFLECTION']);
  const fam = qualifying(customFamily());

  it.each(['B02', 'B03', 'B06', 'B07', 'B08', 'B11', 'B12'])('%s: earned by diligent play, not by careless play', (id) => {
    expect(badge(fam, id).status).toBe('earned');
    expect(badge(careless, id).status).toBe('notEarned');
  });

  it('B04: earned when an established medication need is met; not applicable otherwise', () => {
    expect(badge(fam, 'B04').status).toBe('earned');
    expect(badge(careless, 'B04').status).toBe('notEarned');
    for (const q5 of ['no', 'notSure', 'preferNotToSay'] as const) {
      const st = playToEnd(game({ ...customFamily(), q5MedicalSupplies: q5 }, 2), ['DEFER', 'FINISH_REFLECTION']);
      expect(badge(st, 'B04').status).toBe('notApplicable');
    }
  });

  it('B04: panic buying (more than one refill) does not earn it', () => {
    const st = structuredClone(fam); st.shop.purchases.push({ shopItemId: 'MEDICATION_REFILL', quantity: 2, unitPrice: 350, atMinute: 100 });
    expect(badge(st, 'B04').status).toBe('notEarned');
  });

  it('B05: requires verifying a rumour; not applicable without one', () => {
    const withRumor = [fam, careless].filter((s) => s.eventHistory.some((h) => h.eventId === 'EV07'));
    for (const s of withRumor) expect(badge(s, 'B05').status).toBe(s === fam ? 'earned' : 'notEarned');
    const noRumor = structuredClone(fam); noRumor.eventHistory = noRumor.eventHistory.filter((h) => h.eventId !== 'EV07');
    expect(badge(noRumor, 'B05').status).toBe('notApplicable');
  });

  it('B07: not applicable when no advisory was issued (sheltering was appropriate)', () => {
    const st = structuredClone(base); st.environment.evacuationAdvisoryIssued = false;
    expect(badge(st, 'B07').status).toBe('notApplicable');
  });

  it('B09/B10: require the applicable windows/roof before heavy rain; roof N/A when unknown', () => {
    expect(badge(fam, 'B09').status).toBe('earned');
    const late = structuredClone(fam); late.counters.hr_windows = 1;
    expect(badge(late, 'B09').status).toBe('notEarned');
    expect(badge(fam, 'B10').status).toBe('notApplicable'); // custom roof is "not sure"
    const metal = structuredClone(fam); metal.household.housing.roof = 'metal'; metal.counters.hr_roof = 1;
    expect(badge(metal, 'B10').status).toBe('earned');
    metal.counters.hr_roof = 0;
    expect(badge(metal, 'B10').status).toBe('notEarned');
  });

  it('B12: lighting plus a charged phone or charged power bank at landfall', () => {
    const st = structuredClone(fam); st.counters.lf_lighting = 0;
    expect(badge(st, 'B12').status).toBe('notEarned');
  });

  it('every badge evaluation is idempotent', () => {
    expect(evaluateBadges(fam)).toEqual(evaluateBadges(structuredClone(fam)));
  });
});
