// Community assistance: B06 Bayanihan, A08 Whole Barangay, persistence and removal of the former neighbour NPC.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame, loadGame, type GameEngine } from '../src/core/engine';
import { ACTIONS } from '../src/core/content/actions';
import { COMMUNITY_ACTION_IDS, COMMUNITY_ASSISTANCE } from '../src/core/content/community';
import { EVENTS } from '../src/core/content/events';
import { INTERACTABLES } from '../src/core/content/interactables';
import { evaluateCommunityAssistance } from '../src/core/evaluation/community';
import { buildScenarioRequest, fallbackFromRequest } from '../src/core/ai/scenario';
import { applyRun, computeAchievements, summarizeRun } from '../src/core/evaluation/achievements';
import { FLAG_IDS } from '../src/shared/contracts/ids';
import { EMPTY_PROGRESS, ProgressFile, type RunSummary } from '../src/shared/contracts/progress';
import { migrateLegacyProgress } from '../src/core/migrations';
import { SaveStore } from '../src/main/persistence/saveStore';
import type { CustomOnboarding } from '../src/shared/contracts/onboarding';
import { customFamily, customSolo, randomHousehold } from './fixtures/onboarding';
import { playDiligently } from './diligent';
import { advanceTo, playToEnd } from './helpers';

const H = 60;
const solo = (): CustomOnboarding => ({
  schemaVersion: 1, mode: 'custom', q1Housing: 'singleStory', q2SizeRange: '1',
  q3AgeCounts: { age0to4: 0, age5to12: 0, age13to17: 0, age18to35: 1, age36to59: 0, age60plus: 0 },
  q4Assistance: 'no', q5MedicalSupplies: 'no', q6Surroundings: ['neither'], q7Pets: 'no', q8Preparedness: 'full',
  customization: { appearance: 'auto', minimumBudgetChallenge: false },
});
function game(seed = 5, input: Parameters<typeof createGame>[0] = solo()): GameEngine {
  const r = createGame(input, { seed });
  if (!r.ok) throw new Error(r.error.message);
  return r.engine;
}
const b06 = (e: GameEngine) => e.evaluate().badges.find((b) => b.id === 'B06')!;
const earnedEvents = (r: { ok: boolean; events?: { type: string }[] }) => (r.events ?? []).filter((x) => x.type === 'badgeEarned');

describe('Bayanihan (B06)', () => {
  it('sharing VERIFIED official information qualifies: decision recorded, badge returned and earned mid-run', () => {
    const e = game();
    e.resolveEvent('CHECK_ADVISORY');                                   // verified official information
    const r = e.executeAction('SHARE_VERIFIED_ADVISORY');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.decision?.actionId).toBe('SHARE_VERIFIED_ADVISORY');
    expect(r.state.decisionLog.at(-1)!.actionId).toBe('SHARE_VERIFIED_ADVISORY');
    expect(r.events).toContainEqual({ type: 'badgeEarned', badgeId: 'B06' });
    expect(b06(e).status).toBe('earned');
    expect(r.state.flags.VERIFIED_INFO_SHARED).toBe(true);
  });

  it('sharing is rejected before anything was verified, and nothing is recorded', () => {
    const e = game();
    e.resolveEvent('DEFER');
    const before = e.getState();
    const r = e.executeAction('SHARE_VERIFIED_ADVISORY');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reasons).toContain('Check official information first; only verified information should be shared.');
    expect(e.getState()).toEqual(before);
    expect(b06(e).status).toBe('eligible');
  });

  it('forwarding an unverified rumour does not qualify', () => {
    const e = game(5);                                                  // seed 5 includes the rumour event (EV07)
    advanceTo(e, 28 * H - 1, ['DEFER', 'IGNORE_RUMOR']);
    const forward = advanceTo(e, 28 * H + 1, ['FORWARD_RUMOR', 'DEFER']);
    expect(forward.flags.RUMOR_FORWARDED).toBe(true);
    expect(evaluateCommunityAssistance(forward).qualifying).toBeNull();
    expect(COMMUNITY_ACTION_IDS.has('FORWARD_RUMOR')).toBe(false);
  });

  it('merely reading an advisory (or visiting the barangay hall) does not qualify', () => {
    const e = game();
    e.resolveEvent('CHECK_ADVISORY');
    expect(e.executeAction('CHECK_BULLETIN').ok).toBe(true);
    expect(e.executeAction('BARANGAY_VISIT').ok).toBe(true);
    for (const id of ['CHECK_ADVISORY', 'CHECK_BULLETIN', 'READ_UPDATE', 'BARANGAY_VISIT', 'FORWARD_RUMOR']) expect(COMMUNITY_ACTION_IDS.has(id)).toBe(false);
    expect(b06(e).status).toBe('eligible');
  });

  it('a safe community preparedness action qualifies', () => {
    const e = game();
    e.resolveEvent('CHECK_ADVISORY');
    const r = e.executeAction('HELP_COMMUNITY_PREPARATION');
    expect(r.ok).toBe(true);
    expect(earnedEvents(r)).toHaveLength(1);
    expect(b06(e).status).toBe('earned');
    expect(evaluateCommunityAssistance(e.getState()).actionId).toBe('HELP_COMMUNITY_PREPARATION');
  });

  it('community work is rejected when it could not finish safely, and once conditions are unsafe', () => {
    const e = game();                                                   // seed 5: advisory and heavy rain at h40
    advanceTo(e, 40 * H - 30);
    const tooLate = e.executeAction('HELP_COMMUNITY_PREPARATION');
    expect(tooLate.ok).toBe(false);
    if (!tooLate.ok) expect(tooLate.error.reasons).toContain('Not enough time to finish safely before conditions worsen.');
    advanceTo(e, 41 * H);
    const unsafe = e.executeAction('HELP_COMMUNITY_PREPARATION');
    expect(unsafe.ok).toBe(false);
    if (!unsafe.ok) expect(unsafe.error.reasons!.join(' ')).toMatch(/no longer safe|evacuation advisory/);
    expect(e.getState().decisionLog.some((d) => d.actionId === 'HELP_COMMUNITY_PREPARATION')).toBe(false);
  });

  it('repeating assistance never duplicates the badge', () => {
    const e = game();
    e.resolveEvent('CHECK_ADVISORY');
    const first = e.executeAction('SHARE_VERIFIED_ADVISORY');
    const again = e.executeAction('SHARE_VERIFIED_ADVISORY');           // maxUses 1
    const other = e.executeAction('HELP_COMMUNITY_PREPARATION');        // qualifies too, but B06 is already earned
    expect(earnedEvents(first)).toHaveLength(1);
    expect(again.ok).toBe(false);
    expect(earnedEvents(other)).toHaveLength(0);
    const ev = e.evaluate();
    expect(ev.badges.filter((b) => b.id === 'B06')).toHaveLength(1);
    expect(ev.badgeIds.filter((id) => id === 'B06').length).toBeLessThanOrEqual(1);
  });

  it('no qualifying opportunity → Not Applicable; every supported configuration has an opportunity', () => {
    const s = game().getState();
    expect(evaluateCommunityAssistance(s, []).opportunity).toBe(false);
    const petOnly = [{ ...COMMUNITY_ASSISTANCE[0]!, actionId: 'PREPARE_PET_SUPPLIES' }]; // inapplicable without pets
    expect(evaluateCommunityAssistance(s, petOnly).opportunity).toBe(false);
    for (const input of [customFamily(), customSolo(), randomHousehold(), solo()]) {
      const g = game(9, input);
      expect(b06(g).status).not.toBe('notApplicable');
    }
  });

  it('declining optional assistance never costs Handa or score', () => {
    for (const input of [customSolo(), customFamily()]) {
      const helped = game(3, input);
      const declined = game(3, input);
      playDiligently(helped);
      playDiligently(declined, { community: false });
      const a = helped.evaluate();
      const b = declined.evaluate();
      expect(a.badges.find((x) => x.id === 'B06')!.status).toBe('earned');
      expect(b.badges.find((x) => x.id === 'B06')!.status).toBe('notEarned');
      expect(b.handa.earned).toBe(a.handa.earned);
      expect(b.score).toBeGreaterThanOrEqual(a.score);
      expect(b.handa.criticalCompetencies.map((c) => c.objectiveId)).not.toContain('O_COMMUNITY');
    }
  });
});

// ---------------- Whole Barangay (A08) ----------------
const T = (n: number) => new Date(Date.UTC(2026, 9, 10, 0, n)).toISOString();
const run = (i: number, helped = true): RunSummary => ({
  runId: `r${i}`, stormSeed: 1, configMode: 'random', exposure: 'standard', budgetTier: 'moderate', completedAt: T(i), score: 50,
  handaEarned: false, wellbeingPercent: 100, badgeIds: helped ? ['B06'] : [], lessonIds: [], rumorOpportunity: false, rumorForwarded: false,
  communityHelpCompleted: helped, communityHelpActionId: helped ? 'SHARE_VERIFIED_ADVISORY' : null,
});
const a08 = (p: typeof EMPTY_PROGRESS) => computeAchievements(p).find((a) => a.id === 'A08')!;

describe('Whole Barangay (A08)', () => {
  it('five qualifying completed runs unlock it; four do not; the same seed may repeat with distinct run IDs', () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 4; i++) p = applyRun(p, run(i), T(50 + i)).progress;
    expect(a08(p)).toMatchObject({ progress: 4, target: 5, unlocked: false });
    const fifth = applyRun(p, run(4), T(60));
    expect(fifth.newlyUnlocked).toContain('A08');
    expect(a08(fifth.progress)).toMatchObject({ progress: 5, unlocked: true, unlockedAt: T(60) });
  });

  it('duplicate run IDs count once; non-qualifying runs do not count', () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 6; i++) p = applyRun(p, run(0), T(i)).progress;
    p = applyRun(p, run(7, false), T(8)).progress;
    expect(a08(p).progress).toBe(1);
  });

  it('abandoned runs cannot be recorded', async () => {
    const e = game();
    e.resolveEvent('CHECK_ADVISORY');
    e.executeAction('SHARE_VERIFIED_ADVISORY');
    expect(() => summarizeRun(e.getState(), e.evaluate(), T(0))).toThrow(/not complete/);
    await expect(new SaveStore(mkdtempSync(join(tmpdir(), 'a08-'))).recordCompletedRun(e.getState())).rejects.toThrow();
  });

  it('is idempotent, unlocks once and keeps its timestamp', () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 5; i++) p = applyRun(p, run(i), T(10 + i)).progress;
    const again = applyRun(p, run(5), T(99));
    expect(again.newlyUnlocked).not.toContain('A08');
    expect(a08(again.progress).unlockedAt).toBe(T(14));
    expect(computeAchievements(again.progress)).toEqual(computeAchievements(again.progress));
  });

  it('a real completed run feeds A08 from the authoritative B06 result, and progress survives a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'a08-real-'));
    const e = game(2, customSolo());
    const final = playDiligently(e);
    expect(final.completed).toBe(true);
    const rec = await new SaveStore(dir).recordCompletedRun(final);
    expect(rec.achievements.find((a) => a.id === 'A08')!.progress).toBe(1);
    const stored = JSON.parse(readFileSync(join(dir, 'progress.json'), 'utf8'));
    expect(stored.schemaVersion).toBe(2);
    expect(stored.runs[0]).toMatchObject({ communityHelpCompleted: true, communityHelpActionId: 'SHARE_VERIFIED_ADVISORY' });
    const restarted = await new SaveStore(dir).readAchievements();   // new instance = app restart
    expect(restarted.find((a) => a.id === 'A08')!.progress).toBe(1);
    const repeat = await new SaveStore(dir).recordCompletedRun(final);
    expect(repeat.achievements.find((a) => a.id === 'A08')!.progress).toBe(1);
  });
});

// ---------------- Persistence and legacy data ----------------
describe('community assistance persistence', () => {
  it('community records survive save → load', async () => {
    const e = game();
    e.resolveEvent('CHECK_ADVISORY');
    e.executeAction('SHARE_VERIFIED_ADVISORY');
    const store = new SaveStore(mkdtempSync(join(tmpdir(), 'ca-save-')));
    await store.writeGame('slot-1', e.getState());
    const loaded = loadGame(await store.readGame('slot-1'));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(b06(loaded.engine).status).toBe('earned');
  });

  it('legacy saves with the removed neighbour flags/action load safely and keep their community help', () => {
    const e = game();
    e.resolveEvent('CHECK_ADVISORY');
    e.executeAction('HELP_COMMUNITY_PREPARATION');
    const legacy = JSON.parse(JSON.stringify(e.getState())
      .replaceAll('HELP_COMMUNITY_PREPARATION', 'HELP_NENA_PREPARE').replaceAll('"COMMUNITY_PREP_HELPED"', '"NENA_HELPED"'));
    legacy.flags.NENA_MET = true;
    legacy.counters.nenaHelpedAt = 60;
    const r = loadGame(legacy);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.engine.getState();
    expect(JSON.stringify(s)).not.toMatch(/NENA/);
    expect(s.flags.COMMUNITY_PREP_HELPED).toBe(true);
    expect(b06(r.engine).status).toBe('earned');
  });

  it('a v1 progress file migrates without losing unrelated achievements', async () => {
    const v1 = { schemaVersion: 1, plansViewed: ['r0'], unlocked: { A01: T(1), A10: T(2) },
      runs: [0, 1].map((i) => { const { communityHelpCompleted: _c, communityHelpActionId: _a, ...rest } = run(i); return { ...rest, nenaHelped: i === 0 }; }) };
    const p = ProgressFile.parse(migrateLegacyProgress(v1));
    expect(p.schemaVersion).toBe(2);
    expect(p.unlocked).toEqual({ A01: T(1), A10: T(2) });
    expect(p.runs.map((x) => x.communityHelpCompleted)).toEqual([true, false]);
    const dir = mkdtempSync(join(tmpdir(), 'ca-v1-'));
    writeFileSync(join(dir, 'progress.json'), JSON.stringify(v1));
    const ach = await new SaveStore(dir).readAchievements();
    expect(ach.find((a) => a.id === 'A08')!.progress).toBe(1);
    expect(ach.find((a) => a.id === 'A01')!.unlockedAt).toBe(T(1));
  });
});

// ---------------- Community context → AI narration ----------------
describe('community context for the local AI', () => {
  it('EV12 community variant gives generic, grounded facts and engine-owned choices', () => {
    const s = structuredClone(game().getState());
    s.activeEvent = { eventId: 'EV12', variantId: 'EV12__COMMUNITY', triggeredAtMinute: 32 * H, mandatory: true,
      actionIds: ['HELP_COMMUNITY_PREPARATION', 'SHARE_VERIFIED_ADVISORY', 'CHECK_HOUSEHOLD_NEEDS', 'DEFER'] };
    const req = buildScenarioRequest(s)!;
    expect(req.facts).toContain('Only verified official information should be shared.');
    expect(req.allowedActionIds).toEqual(s.activeEvent.actionIds);          // the AI must echo these exactly
    const fb = fallbackFromRequest(req, 'model-unavailable');
    expect(`${fb.dialogue} ${fb.description}`).not.toMatch(/nena/i);
    expect(fb.actionIds).toEqual(req.allowedActionIds);
  });
});

// ---------------- Removal of the former named neighbour ----------------
describe('former neighbour NPC removed', () => {
  it('no active action, interactable, flag, event variant, choice or fact references her', () => {
    const blob = JSON.stringify({ actions: ACTIONS.map((a) => [a.id, a.label, a.interactables]), interactables: INTERACTABLES, flags: FLAG_IDS });
    expect(blob).not.toMatch(/nena/i);
    const all = new Set(ACTIONS.map((a) => a.id));
    const s = game().getState();
    for (const ev of EVENTS) {
      for (const [variant, text] of Object.entries(ev.fallback)) {
        expect(`${variant} ${text.dialogue} ${text.description}`).not.toMatch(/nena/i);
        for (const id of ev.choices({ s, p: s.household }, variant)) expect(all.has(id)).toBe(true);     // no dangling choices
        expect(ev.facts({ s, p: s.household }, variant).join(' ')).not.toMatch(/nena/i);
      }
    }
  });

  it('no source file outside the save migration names her', () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(join(d, f.name)) : [join(d, f.name)]));
    for (const f of walk('src').filter((f) => !f.endsWith('migrations.ts'))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/nena/i);
  });
});
