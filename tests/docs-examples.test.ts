// Executable versions of the code examples in docs/frontend/FRONTEND_IMPLEMENTATION_BLUEPRINT.md §6.
// If an example in the docs changes, change it here too — this file keeps the docs honest.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame, type CommandResult, type EngineEvent, type GameEngine } from '../src/core/engine';
import { buildScenarioRequest, fallbackFromRequest } from '../src/core/ai/scenario';
import { buildDebriefRequest, fallbackDebriefNarration } from '../src/core/ai/debrief';
import { buildSceneAIRequest, mergeSceneSuggestion } from '../src/core/scene/directive';
import { missingGoBagItems, waterRequirement } from '../src/core/selectors';
import { ONBOARDING_QUESTIONS, type CustomOnboarding, type RandomOnboarding } from '../src/shared/contracts/onboarding';
import { SaveStore } from '../src/main/persistence/saveStore';
import { playDiligently } from './diligent';

const DUMP = process.env.SIGNAL_DOC_DUMP; // set to a folder to write example payloads for the docs

describe('blueprint §6 examples', () => {
  it('6.1 configuration → HouseholdProfile → game initialisation', () => {
    // Q0 choice drives which questions to render
    const custom = ONBOARDING_QUESTIONS.filter((q) => q.path === 'custom');
    expect(custom.map((q) => q.id)).toEqual(['Q1', 'Q2', 'Q2b', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']);

    const answers: CustomOnboarding = {
      schemaVersion: 1, mode: 'custom', q1Housing: 'twoStory', q2SizeRange: '3-4', q2ExactSize: 3,
      q3AgeCounts: { age0to4: 0, age5to12: 1, age13to17: 0, age18to35: 0, age36to59: 2, age60plus: 0 },
      q4Assistance: 'no', q5MedicalSupplies: 'notSure', q6Surroundings: ['waterway'], q7Pets: 'yes', q8Preparedness: 'partial',
      customization: { theme: 'traditional' },
    };
    const r = createGame(answers, { seed: 20261010 });
    if (!r.ok) throw new Error(r.error.message);
    const engine: GameEngine = r.engine;
    const profile = engine.getProfile();
    expect(profile).toMatchObject({ configMode: 'custom', exposure: 'waterway', theme: 'traditional', size: 3 });
    expect(r.events.some((e) => e.type === 'eventTriggered' && e.eventId === 'EV01')).toBe(true);

    const world = engine.getWorldConfig();
    expect(world.interactables.map((i) => i.id)).toContain('LIVING_PHONE'); // community assistance: SHARE_VERIFIED_ADVISORY
    expect(world.interactables.map((i) => i.id)).toContain('BEDROOM_MEDICATION'); // medical answer "not sure"

    const bad = createGame({ ...answers, q2ExactSize: 7 }, { seed: 1 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.issues!.map((i) => i.path[0])).toContain('q2ExactSize');

    const random: RandomOnboarding = { schemaVersion: 1, mode: 'random', r1SizeRange: '1', r2PlayerAge: 'age18to35', r3OtherAgeGroups: [] };
    expect(createGame(random, { seed: 5 }).ok).toBe(true);
    if (DUMP) writeFileSync(join(DUMP, 'profile.json'), JSON.stringify({ answers, profile: { ...profile, members: profile.members.slice(0, 2) }, world: { ...world, interactables: world.interactables.slice(0, 3) } }, null, 2));
  });

  it('6.2 event dialog → AI request → choices → resolve', async () => {
    const r = createGame({ schemaVersion: 1, mode: 'random', r1SizeRange: '3-4', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['surprise'] }, { seed: 7 });
    if (!r.ok) throw new Error('setup');
    const engine = r.engine;
    const st = engine.getState();
    const req = buildScenarioRequest(st)!;                          // engine-chosen event/variant/actions + approved facts
    const content = fallbackFromRequest(req, 'model-unavailable');  // what window.signal.ai.generateScenario resolves with offline
    expect(content.actionIds).toEqual(st.activeEvent!.actionIds);
    const choices = engine.getEventChoices();                       // render these buttons in this order
    const res: CommandResult = engine.resolveEvent(choices.find((c) => c.available)!.actionId);
    expect(res.ok).toBe(true);
    if (DUMP) writeFileSync(join(DUMP, 'event.json'), JSON.stringify({ request: req, content, choices }, null, 2));
  });

  it('6.3 interaction → action → state update → scene directive', () => {
    const r = createGame({ schemaVersion: 1, mode: 'random', r1SizeRange: '2', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['age60plus'] }, { seed: 3 });
    if (!r.ok) throw new Error('setup');
    const engine = r.engine;
    engine.resolveEvent('CHECK_ADVISORY');
    const before = engine.getSceneDirective();

    const near = engine.interact('ENTRANCE_BAG');                  // player pressed E at the go-bag
    if (!near.ok) throw new Error(near.error.message);
    const actions = near.events.some((e) => e.type === 'eventTriggered') ? engine.getEventChoices() : near.actions;
    expect(actions.find((a) => a.actionId === 'INSPECT_GO_BAG')?.kind ?? 'discovery').toBe('discovery');
    const missing = missingGoBagItems(engine.getState());           // discovery UI copy (no game time used)
    expect(Array.isArray(missing)).toBe(true);

    if (engine.getState().activeEvent) engine.resolveEvent('DEFER');
    const tools = engine.executeAction('GET_TOOLS');
    const board = engine.executeAction('BOARD_WINDOW');
    expect(tools.ok && board.ok).toBe(true);
    if (board.ok) expect(board.events.map((e: EngineEvent) => e.type)).toContain('actionCompleted');

    const after = engine.getSceneDirective();                       // recompute after prop-changing actions
    expect(before.props).toContainEqual({ anchor: 'WINDOW', variant: 'WINDOW_PLAIN' });
    expect(after.props).toContainEqual({ anchor: 'WINDOW', variant: 'WINDOW_BOARDED' });
    const sreq = buildSceneAIRequest(engine.getState());
    const merged = mergeSceneSuggestion(engine.getState(), after, null);  // window.signal.ai.suggestScene → null offline
    expect(merged).toEqual(after);
    expect(waterRequirement(engine.getProfile())).toBe(24);
    if (DUMP) writeFileSync(join(DUMP, 'scene.json'), JSON.stringify({ directive: after, sceneAIRequest: sreq }, null, 2));
  });

  it('6.4 run completion → evaluation → debrief → achievements', async () => {
    const r = createGame({ schemaVersion: 1, mode: 'custom', q1Housing: 'singleStory', q2SizeRange: '1', q3AgeCounts: { age0to4: 0, age5to12: 0, age13to17: 0, age18to35: 1, age36to59: 0, age60plus: 0 },
      q4Assistance: 'no', q5MedicalSupplies: 'no', q6Surroundings: ['neither'], q7Pets: 'no', q8Preparedness: 'full' }, { seed: 2 });
    if (!r.ok) throw new Error('setup');
    const final = playDiligently(r.engine);
    expect(final.completed).toBe(true);
    const ev = r.engine.evaluate();
    expect(ev.badges).toHaveLength(12);
    expect(ev.handa.wellbeingThreshold).toBe(85);
    const narration = fallbackDebriefNarration(ev);                // what narrateDebrief resolves with offline
    expect(buildDebriefRequest(ev, final).score).toBe(ev.score);
    const store = new SaveStore(mkdtempSync(join(tmpdir(), 'doc-')));  // main-process side of achievements.recordRun
    const rec = await store.recordCompletedRun(final);
    const viewed = await store.markPlanViewed(final.runId);        // achievements.markPlanViewed when the plan is shown
    expect(rec.newlyUnlocked).toContain('A01');
    expect(viewed.find((a) => a.id === 'A10')!.unlocked).toBe(true);
    if (DUMP) writeFileSync(join(DUMP, 'debrief.json'), JSON.stringify({ evaluation: { ...ev, timeline: ev.timeline.slice(0, 3), categories: ev.categories.slice(0, 2) }, narration, recordRun: { newlyUnlocked: rec.newlyUnlocked, achievements: rec.achievements.slice(0, 3) } }, null, 2));
  });
});
