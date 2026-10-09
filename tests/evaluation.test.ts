import { describe, expect, it } from 'vitest';
import { evaluateRun } from '../src/core/evaluation/evaluate';
import { BADGE_CATALOG } from '../src/core/content/badges';
import { DebriefEvaluation } from '../src/shared/contracts/debrief';
import type { GameState } from '../src/shared/contracts/state';
import { aloneSurvey, familySurvey } from './fixtures/households';
import { newGame, playToEnd } from './helpers';

/** A diligent player: prefers protective, informed choices and prepares before each event. */
const GOOD = ['CHECK_ADVISORY', 'READ_UPDATE', 'VERIFY_RUMOR', 'PACK_GO_BAG', 'FAMILY_MEETING', 'ARRANGE_ASSISTANCE', 'PACK_MEDICATION',
  'ARRANGE_CONTINUITY', 'SEEK_ASSISTANCE', 'FOLLOW_EVACUATION', 'USE_FLASHLIGHT', 'HELP_WITH_NEED', 'MOVE_TO_SAFER_ROOM', 'ACCOUNT_MEMBERS',
  'REVIEW_RESOURCES', 'VERIFY_GUIDANCE', 'FINISH_REFLECTION'];
const CARELESS = ['DEFER', 'IGNORE_RUMOR', 'FORWARD_RUMOR', 'DELAY_EVACUATION', 'GO_OUTSIDE_TO_CHECK', 'FINISH_REFLECTION'];

function prepared(s = aloneSurvey()): GameState {
  const e = newGame(s);
  e.resolveEvent('CHECK_ADVISORY');
  for (const a of ['PREPARE_COMMUNICATION', 'PROTECT_DOCUMENTS', 'FILL_CONTAINERS', 'FILL_CONTAINERS', 'SECURE_OBJECTS', 'PACK_GO_BAG', 'CHECK_ESSENTIAL_SUPPLIES']) e.executeAction(a);
  return playToEnd(e, GOOD);
}
const careless = (s = aloneSurvey()) => playToEnd(newGame(s), CARELESS);

describe('preparedness evaluation', () => {
  it('produces a schema-valid DebriefEvaluation', () => {
    expect(DebriefEvaluation.safeParse(evaluateRun(prepared())).success).toBe(true);
  });

  it('uses the six weighted competency categories (20/20/15/20/15/10)', () => {
    const ev = evaluateRun(prepared());
    expect(ev.categories.map((c) => [c.category, c.weight])).toEqual([
      ['emergencySupplies', 20], ['officialInformation', 20], ['householdCoordination', 15],
      ['evacuationPreparedness', 20], ['householdNeeds', 15], ['hazardAwareness', 10],
    ]);
  });

  it('scores informed preparation above careless play', () => {
    expect(evaluateRun(prepared()).score).toBeGreaterThan(evaluateRun(careless()).score + 30);
  });

  it('maps score bands to endings', () => {
    const good = evaluateRun(prepared());
    const bad = evaluateRun(careless());
    expect(good.score >= 85 ? 'handa' : good.score >= 60 ? 'nakaraos' : 'nahirapan').toBe(good.ending);
    expect(bad.ending).toBe('nahirapan');
  });

  it('excludes household-specific needs when none apply instead of penalising', () => {
    const ev = evaluateRun(prepared(aloneSurvey()));
    const needs = ev.categories.find((c) => c.category === 'householdNeeds')!;
    expect(needs.included).toBe(false);
    expect(needs.objectives).toHaveLength(0);
  });

  it('does not penalise undisclosed medical information when the privacy-preserving check is done', () => {
    const s = aloneSurvey(); s.q12MedicalCondition = 'preferNotToSay'; s.q14EssentialMedication = 'preferNotToSay';
    const a = evaluateRun(prepared(aloneSurvey()));
    const b = evaluateRun(prepared(s));
    expect(b.score).toBe(a.score);
  });

  it('includes applicable household needs for households that have them', () => {
    const ev = evaluateRun(playToEnd(newGame(familySurvey()), GOOD));
    const ids = ev.categories.find((c) => c.category === 'householdNeeds')!.objectives.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['O_MEDICATION', 'O_ASSISTANCE', 'O_PETS']));
  });

  it('turns unmet objectives into gaps with lessons and checklist items', () => {
    const ev = evaluateRun(careless());
    expect(ev.gaps.length).toBeGreaterThan(3);
    expect(ev.learningPoints.length).toBeGreaterThanOrEqual(ev.gaps.length);
    expect(ev.checklistItems.length).toBeGreaterThan(0);
    expect(ev.gaps).toContain('F_UNSAFE_ACTION');
  });

  it('reports a decision timeline traced to the decision log', () => {
    const st = prepared();
    const ev = evaluateRun(st);
    expect(ev.timeline).toHaveLength(st.decisionLog.length);
    expect(ev.timeline[0]!.actionId).toBe(st.decisionLog[0]!.actionId);
  });

  it('is deterministic', () => {
    const st = prepared();
    expect(evaluateRun(st)).toEqual(evaluateRun(structuredClone(st)));
  });
});

describe('badges', () => {
  it('defines the revised badges B01–B12', () => {
    expect(BADGE_CATALOG.map((b) => b.id)).toEqual(['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12']);
    expect(BADGE_CATALOG[0]!.name).toBe('Handa');
  });

  it('awards badges deterministically for demonstrated competencies', () => {
    const ev = evaluateRun(prepared());
    expect(ev.badgeIds).toEqual(expect.arrayContaining(['B02', 'B03', 'B11']));
  });

  it('awards fewer badges to careless play', () => {
    expect(evaluateRun(careless()).badgeIds.length).toBeLessThan(evaluateRun(prepared()).badgeIds.length);
  });

  it('never awards a badge for an unsafe choice', () => {
    const ev = evaluateRun(careless());
    expect(ev.badgeIds).not.toContain('B01');
    expect(ev.badgeIds).not.toContain('B06');
  });
});
