import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/engine';
import { buildScenarioRequest, fallbackContent } from '../src/core/ai/scenario';
import { buildSceneDirective } from '../src/core/scene/directive';
import { SaveStore } from '../src/main/persistence/saveStore';
import { DebriefEvaluation } from '../src/shared/contracts/debrief';
import { customFamily, randomHousehold } from './fixtures/onboarding';
import { playDiligently } from './diligent';

describe('end-to-end: onboarding → gameplay → badges → achievements', () => {
  it.each([['custom', customFamily()], ['random', randomHousehold({ r4Preference: 'challenging' })]] as const)('%s household', async (_n, input) => {
    const r = createGame(input, { seed: 3 });
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    const e = r.engine;
    // Profile → state → AI context (minimised, engine-owned choices)
    const req = buildScenarioRequest(e.getState())!;
    expect(req.allowedActionIds).toEqual(e.getState().activeEvent!.actionIds);
    expect(JSON.stringify(req)).not.toMatch(/medical|wellbeing/i);
    // AI content never mutates state
    const before = e.getState();
    fallbackContent(before, 'test');
    expect(e.getState()).toEqual(before);
    // Action → consequence → scene directive
    e.resolveEvent('CHECK_ADVISORY');
    e.executeAction('GET_TOOLS'); e.executeAction('BOARD_WINDOW');
    expect(buildSceneDirective(e.getState()).props).toContainEqual({ anchor: 'WINDOW', variant: 'WINDOW_BOARDED' });
    // Full run → deterministic evaluation (badges, Handa, lessons)
    const end = playDiligently(e);
    const ev = e.evaluate();
    expect(DebriefEvaluation.safeParse(ev).success).toBe(true);
    expect(ev.badges.map((b) => b.id)).toEqual(['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12']);
    expect(ev.badges.every((b) => b.status !== 'eligible')).toBe(true);
    // Completed run → achievements (main re-evaluates)
    const store = new SaveStore(mkdtempSync(join(tmpdir(), 'signalno5-e2e-')));
    const rec = await store.recordCompletedRun(end);
    expect(rec.newlyUnlocked).toContain('A01');
    expect(rec.achievements.find((a) => a.id === 'A09')!.unlocked).toBe(input.mode === 'custom');
    expect(await store.readBadges()).toEqual(expect.arrayContaining(ev.badgeIds));
  });

  it('exposes badge and achievement catalogs for the UI', () => {
    const r = createGame(customFamily(), { seed: 1 }); if (!r.ok) throw new Error('setup');
    expect(r.engine.getBadgeCatalog()).toHaveLength(12);
    expect(r.engine.getAchievementCatalog()).toHaveLength(10);
  });
});
