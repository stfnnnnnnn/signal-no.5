import { describe, expect, it } from 'vitest';
import { buildSceneDirective, buildSceneAIRequest, mergeSceneSuggestion, validateSceneSuggestion } from '../src/core/scene/directive';
import { loadGame, type GameEngine } from '../src/core/engine';
import { SceneDirective } from '../src/shared/contracts/scene';
import type { GameState } from '../src/shared/contracts/state';
import { aloneSurvey, familySurvey } from './fixtures/households';
import { newGame, resolveFirst } from './helpers';

/** Advance at 32× (auto-resolving events) until pred(state). */
function until(e: GameEngine, pred: (s: GameState) => boolean, prefer = ['DEFER']) {
  for (let i = 0; i < 5000 && !pred(e.getState()); i++) {
    const s = e.getState();
    if (s.activeEvent) { resolveFirst(e, prefer); continue; }
    if (['impact', 'aftermath', 'evacuation'].includes(s.phase)) { e.skipToNextMilestone(); continue; }
    e.setSpeed(32); e.tick(2_000);
  }
  return e.getState();
}
function withState(e: GameEngine, patch: (s: GameState) => void): GameState {
  const s = e.getState(); patch(s);
  const r = loadGame(s); if (!r.ok) throw new Error('bad state');
  return r.engine.getState();
}

describe('deterministic scene directive', () => {
  it('is schema-valid and uses the current scene', () => {
    const st = newGame().getState();
    const d = buildSceneDirective(st);
    expect(SceneDirective.safeParse(d).success).toBe(true);
    expect(d.sceneId).toBe('HOUSE');
    expect(d.source).toBe('deterministic');
  });

  it('changes weather across storm phases', () => {
    const e = newGame(aloneSurvey()); e.resolveEvent('DEFER');
    expect(buildSceneDirective(e.getState()).weather.preset).toBe('clear');
    const warn = until(e, (s) => s.phase === 'warning');
    expect(buildSceneDirective(warn).weather.preset).toBe('rain');
    const impact = until(e, (s) => s.phase === 'impact');
    const di = buildSceneDirective(impact);
    expect(di.weather.preset).toBe('typhoon');
    expect(di.weather.rain).toBe('torrential');
    const after = until(e, (s) => s.phase === 'aftermath');
    expect(buildSceneDirective(after).weather.preset).toBe('clearingSky');
  });

  it('never shows electric lighting during a power outage', () => {
    const base = newGame();
    for (const lit of [true, false]) {
      const st = withState(base, (s) => {
        s.environment.powerAvailable = false; s.environment.weatherState = 'heavyRain';
        if (!lit) { delete s.house.FLASHLIGHT; delete s.goBag.FLASHLIGHT; delete s.house.POWER_BANK; delete s.goBag.POWER_BANK; }
      });
      const d = buildSceneDirective(st);
      expect(d.lighting).toBe(lit ? 'outageFlashlight' : 'outageDark');
      expect(d.effects).not.toContain('FLICKERING_LIGHTS');
    }
  });

  it('uses the approved flood overlay equal to the engine flood severity, and none indoors at the shop', () => {
    const base = newGame();
    for (const sev of ['none', 'low', 'moderate', 'severe'] as const) {
      const d = buildSceneDirective(withState(base, (s) => { s.environment.floodSeverity = sev; }));
      expect(d.flood).toBe(sev);
      if (sev !== 'none') expect(d.effects).toContain('FLOOD_RIPPLES');
    }
    expect(buildSceneDirective(withState(base, (s) => { s.scene = 'SHOP'; s.environment.floodSeverity = 'low'; })).flood).toBe('none');
  });

  it('reflects player preparation with state-derived props', () => {
    const e = newGame(familySurvey()); e.resolveEvent('DEFER');
    expect(buildSceneDirective(e.getState()).props).toContainEqual({ anchor: 'WINDOW', variant: 'WINDOW_PLAIN' });
    e.executeAction('GET_TOOLS'); e.executeAction('BOARD_WINDOW'); e.executeAction('SECURE_OBJECTS');
    const d = buildSceneDirective(e.getState());
    expect(d.props).toContainEqual({ anchor: 'WINDOW', variant: 'WINDOW_BOARDED' });
    expect(d.props).toContainEqual({ anchor: 'YARD', variant: 'YARD_SECURED' });
  });

  it('gives cues only to visible household NPCs with valid animations', () => {
    const st = newGame(familySurvey()).getState();
    const visible = st.household.members.filter((m) => m.visibleNpc).map((m) => m.npcId);
    const d = buildSceneDirective(st);
    expect(d.npcCues.map((c) => c.npcId).sort()).toEqual([...visible].sort());
    expect(buildSceneDirective(newGame(aloneSurvey()).getState()).npcCues).toEqual([]);
  });

  it('is deterministic and safe to apply repeatedly (no state mutation)', () => {
    const st = newGame().getState();
    const copy = structuredClone(st);
    const a = buildSceneDirective(st);
    const b = buildSceneDirective(st);
    expect(a).toEqual(b);
    expect(st).toEqual(copy);
  });
});

describe('engine convenience', () => {
  it('exposes the deterministic directive for the current state', () => {
    const e = newGame();
    expect(e.getSceneDirective()).toEqual(buildSceneDirective(e.getState()));
  });
});

describe('AI scene suggestions', () => {
  const darkState = () => withState(newGame(familySurvey()), (s) => { s.environment.powerAvailable = false; s.environment.weatherState = 'typhoon'; s.phase = 'impact'; s.scene = 'HOME_IMPACT'; });

  it('offers only options consistent with the state', () => {
    const st = darkState();
    const req = buildSceneAIRequest(st);
    expect(req.allowed.lighting.every((l) => l.startsWith('outage'))).toBe(true);
    expect(req.allowed.extraEffects).not.toContain('SUNBEAMS');
    expect(req.allowed.decor.flatMap((d) => d.variants).every((v) => v.startsWith('TRAD_'))).toBe(true); // traditional theme
  });

  it('merges a valid suggestion without overriding mandatory fields', () => {
    const st = darkState();
    const base = buildSceneDirective(st);
    const req = buildSceneAIRequest(st);
    const npc = req.allowed.npcIds[0]!;
    const sugg = validateSceneSuggestion(req, JSON.stringify({ basisKey: req.basisKey, lighting: req.allowed.lighting[0], extraEffects: ['LIGHTNING_FLASH'],
      decor: [{ anchor: 'LIVING_DECOR', variant: 'TRAD_LIVING_ALTAR' }], npcCues: [{ npcId: npc, animation: 'huddled', emotion: 'anxious' }], mood: 'tense' }));
    expect(sugg.ok).toBe(true);
    if (!sugg.ok) return;
    const merged = mergeSceneSuggestion(st, base, sugg.suggestion);
    expect(merged.source).toBe('ai-merged');
    expect(merged.weather).toEqual(base.weather);
    expect(merged.flood).toBe(base.flood);
    const decorAnchors = ['LIVING_DECOR', 'KITCHEN_DECOR', 'BEDROOM_DECOR'];
    for (const p of base.props.filter((x) => !decorAnchors.includes(x.anchor))) expect(merged.props).toContainEqual(p); // mandatory props survive
    expect(merged.props).toContainEqual({ anchor: 'LIVING_DECOR', variant: 'TRAD_LIVING_ALTAR' });
    expect(merged.props.filter((x) => x.anchor === 'LIVING_DECOR')).toHaveLength(1);
    for (const fx of base.effects) expect(merged.effects).toContain(fx);
    expect(merged.effects).toContain('LIGHTNING_FLASH');
    expect(merged.npcCues.find((c) => c.npcId === npc)).toEqual({ npcId: npc, animation: 'huddled', emotion: 'anxious' });
    expect(SceneDirective.safeParse(merged).success).toBe(true);
  });

  it.each([
    ['electric lighting during an outage', { lighting: 'daylight' }],
    ['an unknown effect ID', { extraEffects: ['DRAGON_FIRE'] }],
    ['an attempt to change the flood overlay', { flood: 'none' }],
    ['decor from the other theme', { decor: [{ anchor: 'LIVING_DECOR', variant: 'MODERN_LIVING_PLANTS' }] }],
    ['a cue for an NPC who is not in the scene', { npcCues: [{ npcId: 'NPC_STRANGER', animation: 'waving', emotion: 'calm' }] }],
    ['sunbeams during a typhoon', { extraEffects: ['SUNBEAMS'] }],
  ])('rejects %s', (_n, extra) => {
    const st = darkState();
    const req = buildSceneAIRequest(st);
    const r = validateSceneSuggestion(req, JSON.stringify({ basisKey: req.basisKey, ...extra }));
    expect(r.ok).toBe(false);
  });

  it('rejects invalid JSON', () => {
    const req = buildSceneAIRequest(darkState());
    expect(validateSceneSuggestion(req, '{"basisKey":').ok).toBe(false);
  });

  it('discards a stale suggestion when the state changed while waiting', () => {
    const e = newGame(aloneSurvey()); e.resolveEvent('DEFER');
    const before = e.getState();
    const req = buildSceneAIRequest(before);
    const sugg = validateSceneSuggestion(req, JSON.stringify({ basisKey: req.basisKey, mood: 'uneasy' }));
    if (!sugg.ok) throw new Error('setup');
    const later = until(e, (s) => s.phase === 'warning'); // weather changed
    const merged = mergeSceneSuggestion(later, buildSceneDirective(later), sugg.suggestion);
    expect(merged).toEqual(buildSceneDirective(later));
  });

  it('is idempotent: merging the same suggestion twice gives the same directive', () => {
    const st = darkState();
    const base = buildSceneDirective(st);
    const req = buildSceneAIRequest(st);
    const r = validateSceneSuggestion(req, JSON.stringify({ basisKey: req.basisKey, extraEffects: ['MIST'], mood: 'tense' }));
    if (!r.ok) throw new Error('setup');
    const once = mergeSceneSuggestion(st, base, r.suggestion);
    expect(mergeSceneSuggestion(st, once, r.suggestion)).toEqual(once);
  });

  it('falls back to the deterministic directive when there is no suggestion', () => {
    const st = darkState();
    expect(mergeSceneSuggestion(st, buildSceneDirective(st), null)).toEqual(buildSceneDirective(st));
  });
});
