// Scene directives: deterministic presentation derived from authoritative state, plus optional, validated
// AI variations. Pure functions; never mutate GameState. See docs/frontend/FRONTEND_BACKEND_INTEGRATION.md §19.
import type { SceneId } from '../../shared/contracts/ids';
import {
  EffectId as EffectEnum, SceneAISuggestion, type EffectId, type LightingPreset, type NpcCue, type PropAnchor,
  type PropVariantId, type SceneAIRequest, type SceneDirective,
} from '../../shared/contracts/scene';
import type { GameState } from '../../shared/contracts/state';
import * as sel from '../selectors';

type Weather = SceneDirective['weather'];
type Animation = NpcCue['animation'];
type Emotion = NpcCue['emotion'];
type Audio = SceneDirective['audio'];
type Mood = SceneDirective['mood'];

const HOUSE_SCENES: SceneId[] = ['HOUSE', 'HOME_IMPACT', 'AFTERMATH'];
const OUTDOOR_FLOOD_SCENES: SceneId[] = ['HOUSE', 'HOME_IMPACT', 'AFTERMATH', 'STREET'];
const NPC_SCENES: SceneId[] = ['HOUSE', 'HOME_IMPACT', 'AFTERMATH', 'EVACUATION'];

export const DECOR_OPTIONS: Record<'modern' | 'traditional', Partial<Record<PropAnchor, PropVariantId[]>>> = {
  modern: {
    LIVING_DECOR: ['MODERN_LIVING_PHOTOS', 'MODERN_LIVING_PLANTS'],
    KITCHEN_DECOR: ['MODERN_KITCHEN_RICE_COOKER', 'MODERN_KITCHEN_FRUIT_BOWL'],
    BEDROOM_DECOR: ['MODERN_BEDROOM_POSTERS', 'MODERN_BEDROOM_DESK_LAMP'],
  },
  traditional: {
    LIVING_DECOR: ['TRAD_LIVING_ALTAR', 'TRAD_LIVING_CAPIZ_LAMP'],
    KITCHEN_DECOR: ['TRAD_KITCHEN_PALAYOK', 'TRAD_KITCHEN_BAYONG'],
    BEDROOM_DECOR: ['TRAD_BEDROOM_BANIG', 'TRAD_BEDROOM_WOODEN_CHEST'],
  },
};

function weatherOf(s: GameState): Weather {
  const w = s.environment.weatherState;
  const wind = s.environment.windSeverity;
  if (w === 'typhoon') return { preset: 'typhoon', rain: 'torrential', wind: wind === 'severe' ? 'violent' : 'strong' };
  if (w === 'heavyRain') return { preset: 'heavyRain', rain: 'heavy', wind: 'gusty' };
  if (w === 'rain') return { preset: 'rain', rain: 'moderate', wind: 'breezy' };
  return s.phase === 'aftermath' ? { preset: 'clearingSky', rain: 'none', wind: 'calm' } : { preset: 'clear', rain: 'none', wind: 'calm' };
}

/** Lighting presets consistent with the state; the first is the deterministic default. */
function allowedLighting(s: GameState, weather: Weather): LightingPreset[] {
  if (s.scene === 'SHOP') return ['shopInterior'];
  if (s.scene === 'EVACUATION') return ['evacuationCenter'];
  if (!s.environment.powerAvailable) return sel.hasLighting(s) ? ['outageFlashlight', 'outageDark'] : ['outageDark'];
  switch (weather.preset) {
    case 'typhoon': return ['stormDark', 'gloomy'];
    case 'heavyRain': return ['gloomy', 'stormDark'];
    case 'rain': return ['overcast', 'gloomy'];
    case 'clearingSky': return ['morningAfter', 'daylight'];
    default: return ['daylight', 'overcast'];
  }
}

function mandatoryEffects(s: GameState, weather: Weather, flood: SceneDirective['flood']): EffectId[] {
  const fx = new Set<EffectId>();
  if (weather.rain !== 'none') { fx.add('RAIN_STREAKS'); if (HOUSE_SCENES.includes(s.scene)) fx.add('WINDOW_DRIPS'); }
  if (weather.wind === 'gusty' || weather.wind === 'strong' || weather.wind === 'violent') fx.add('TREE_SWAY');
  if (weather.wind === 'strong' || weather.wind === 'violent') fx.add('WIND_DEBRIS');
  if (flood !== 'none') fx.add('FLOOD_RIPPLES');
  if (s.phase === 'aftermath') { fx.add('PUDDLES'); if (s.environment.propertyDamage !== 'none') fx.add('DEBRIS_AFTERMATH'); }
  return canonicalEffects([...fx]);
}

function optionalEffects(s: GameState, weather: Weather, mandatory: EffectId[]): EffectId[] {
  const out: EffectId[] = [];
  if (weather.preset === 'typhoon' || weather.preset === 'heavyRain') out.push('LIGHTNING_FLASH', 'MIST');
  if (weather.preset === 'rain') out.push('MIST');
  if (s.environment.powerAvailable && (weather.preset === 'typhoon' || weather.preset === 'heavyRain') && s.scene !== 'EVACUATION') out.push('FLICKERING_LIGHTS');
  if ((weather.preset === 'clear' || weather.preset === 'clearingSky') && s.environment.powerAvailable) out.push('SUNBEAMS', 'DUST_MOTES');
  if (weather.preset === 'clearingSky' && !s.environment.powerAvailable) out.push('SUNBEAMS');
  return canonicalEffects(out.filter((e) => !mandatory.includes(e)));
}

const EFFECT_ORDER = EffectEnum.options;
const canonicalEffects = (list: EffectId[]) => EFFECT_ORDER.filter((e) => list.includes(e));

function mandatoryProps(s: GameState): SceneDirective['props'] {
  if (!HOUSE_SCENES.includes(s.scene)) return [];
  const bag = sel.goBagStatus(s);
  return [
    { anchor: 'WINDOW', variant: (s.counters.windowsBoarded ?? 0) > 0 ? 'WINDOW_BOARDED' : 'WINDOW_PLAIN' },
    { anchor: 'YARD', variant: s.flags.LOOSE_ITEMS_SECURED ? 'YARD_SECURED' : 'YARD_LOOSE_ITEMS' },
    { anchor: 'ENTRANCE', variant: s.flags.GATE_SANDBAGGED ? 'ENTRANCE_SANDBAGS' : 'ENTRANCE_PLAIN' },
    { anchor: 'STAIRS', variant: s.flags.BELONGINGS_RAISED ? 'STAIRS_RAISED_BELONGINGS' : 'STAIRS_PLAIN' },
    { anchor: 'LIVING_TABLE', variant: sel.hasLighting(s) ? 'LIVING_TABLE_FLASHLIGHT' : 'LIVING_TABLE_EMPTY' },
    { anchor: 'GO_BAG_SPOT', variant: bag === 'ready' ? 'GO_BAG_READY' : bag === 'partial' ? 'GO_BAG_PARTIAL' : 'GO_BAG_EMPTY' },
  ];
}

function defaultDecor(s: GameState): SceneDirective['props'] {
  if (!HOUSE_SCENES.includes(s.scene)) return [];
  const opts = DECOR_OPTIONS[s.household.theme];
  return (Object.entries(opts) as [PropAnchor, PropVariantId[]][]).map(([anchor, variants], i) => ({ anchor, variant: variants[(s.seed + i) % variants.length]! }));
}

const PHASE_CUES: Record<string, { animations: Animation[]; emotions: Emotion[] }> = {
  preparation: { animations: ['idle', 'packing', 'sitting', 'waving', 'lookingOutWindow'], emotions: ['calm', 'determined', 'worried'] },
  warning: { animations: ['pacing', 'packing', 'lookingOutWindow', 'idle', 'sitting'], emotions: ['worried', 'determined', 'anxious', 'calm'] },
  evacuation: { animations: ['sitting', 'idle', 'sleeping', 'huddled'], emotions: ['tired', 'worried', 'relieved', 'calm'] },
  impact: { animations: ['huddled', 'sitting', 'pacing'], emotions: ['anxious', 'worried', 'determined'] },
  aftermath: { animations: ['cleaning', 'idle', 'sitting', 'waving'], emotions: ['tired', 'relieved', 'calm', 'determined'] },
};
const cuesFor = (s: GameState) => PHASE_CUES[s.phase] ?? PHASE_CUES.preparation!;

function sceneNpcIds(s: GameState): string[] {
  if (!NPC_SCENES.includes(s.scene)) return [];
  return s.household.members.filter((m) => m.visibleNpc && m.npcId).map((m) => m.npcId!);
}

function allowedAudio(s: GameState, weather: Weather): Audio[] {
  if (s.scene === 'SHOP') return ['shopChatter'];
  if (s.scene === 'EVACUATION') return ['evacuationCenterCrowd'];
  const base: Audio = weather.preset === 'typhoon' ? 'typhoonWind' : weather.preset === 'heavyRain' ? 'heavyRainRoof' : weather.preset === 'rain' ? 'lightRainRoof'
    : weather.preset === 'clearingSky' ? 'aftermathDrips' : 'dayAmbience';
  const out: Audio[] = [base];
  if (!s.environment.powerAvailable && weather.rain !== 'none') out.push('outageStormMuffled');
  if (weather.preset === 'clearingSky') out.push('dayAmbience');
  return out;
}

function allowedMoods(s: GameState): Mood[] {
  if (s.phase === 'aftermath') return s.aftermathDay >= 3 ? ['hopeful', 'calm', 'somber'] : ['somber', 'hopeful', 'calm'];
  if (s.phase === 'impact') return s.environment.shelterCondition === 'unsafe' ? ['urgent', 'tense'] : ['tense', 'urgent', 'somber'];
  if (s.environment.evacuationAdvisoryIssued || s.phase === 'evacuation') return ['urgent', 'tense'];
  if (s.phase === 'warning') return ['uneasy', 'tense'];
  return ['calm', 'uneasy', 'hopeful'];
}

const TRANSITION: Partial<Record<SceneId, SceneDirective['transition']>> = { SHOP: 'fade', STREET: 'rainWipe', EVACUATION: 'fade', HOME_IMPACT: 'flashToBlack', AFTERMATH: 'fade', RESULTS: 'fade' };

/** Key of every state input that affects what is allowed. A suggestion built for another key is stale. */
export function sceneBasisKey(s: GameState): string {
  const w = weatherOf(s);
  return [s.runId, s.scene, s.phase, w.preset, w.wind, s.environment.powerAvailable, s.environment.floodSeverity, sel.hasLighting(s),
    s.household.theme, s.aftermathDay, s.environment.evacuationAdvisoryIssued, s.environment.shelterCondition, sceneNpcIds(s).join('+')].join('|');
}

/** Mandatory, deterministic scene configuration for the current state. Pure and idempotent. */
export function buildSceneDirective(s: GameState): SceneDirective {
  const weather = weatherOf(s);
  const flood = OUTDOOR_FLOOD_SCENES.includes(s.scene) ? s.environment.floodSeverity : 'none';
  const cue = cuesFor(s);
  return {
    schemaVersion: 1,
    sceneId: s.scene,
    basisKey: sceneBasisKey(s),
    weather,
    lighting: allowedLighting(s, weather)[0]!,
    flood,
    effects: mandatoryEffects(s, weather, flood),
    props: [...mandatoryProps(s), ...defaultDecor(s)],
    npcCues: sceneNpcIds(s).map((npcId) => ({ npcId, animation: cue.animations[0]!, emotion: cue.emotions[0]! })),
    audio: allowedAudio(s, weather)[0]!,
    mood: allowedMoods(s)[0]!,
    transition: TRANSITION[s.scene] ?? 'none',
    source: 'deterministic',
  };
}

/** The options the AI may choose from for this exact state. */
export function buildSceneAIRequest(s: GameState): SceneAIRequest {
  const base = buildSceneDirective(s);
  const cue = cuesFor(s);
  const decor = HOUSE_SCENES.includes(s.scene) ? (Object.entries(DECOR_OPTIONS[s.household.theme]) as [PropAnchor, PropVariantId[]][]).map(([anchor, variants]) => ({ anchor, variants })) : [];
  return {
    schemaVersion: 1, sceneId: s.scene, basisKey: base.basisKey,
    context: { phase: s.phase, weather: base.weather.preset, powerAvailable: s.environment.powerAvailable, flood: base.flood, theme: s.household.theme, householdSize: s.household.size, mood: base.mood },
    allowed: {
      lighting: allowedLighting(s, base.weather), extraEffects: optionalEffects(s, base.weather, base.effects), decor,
      npcIds: sceneNpcIds(s), animations: cue.animations, emotions: cue.emotions, audio: allowedAudio(s, base.weather), moods: allowedMoods(s),
    },
  };
}

export type SceneSuggestionResult = { ok: true; suggestion: SceneAISuggestion } | { ok: false; reason: string };

/** Strict validation: schema (unknown keys/IDs rejected), basis key, and membership in this state's allowed sets. */
export function validateSceneSuggestion(req: SceneAIRequest, raw: string | unknown): SceneSuggestionResult {
  let obj: unknown = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { return { ok: false, reason: 'invalid-json' }; } }
  const parsed = SceneAISuggestion.safeParse(obj);
  if (!parsed.success) return { ok: false, reason: `schema:${parsed.error.issues.map((i) => i.path.join('.') || i.message).join(',')}` };
  const g = parsed.data;
  const a = req.allowed;
  if (g.basisKey !== req.basisKey) return { ok: false, reason: 'stale-basis' };
  if (g.lighting && !a.lighting.includes(g.lighting)) return { ok: false, reason: `lighting-inconsistent:${g.lighting}` };
  const badFx = g.extraEffects.find((e) => !a.extraEffects.includes(e));
  if (badFx) return { ok: false, reason: `effect-not-allowed:${badFx}` };
  for (const d of g.decor) {
    if (!a.decor.find((x) => x.anchor === d.anchor)?.variants.includes(d.variant)) return { ok: false, reason: `decor-not-allowed:${d.anchor}=${d.variant}` };
  }
  for (const c of g.npcCues) {
    if (!a.npcIds.includes(c.npcId)) return { ok: false, reason: `npc-not-in-scene:${c.npcId}` };
    if (!a.animations.includes(c.animation) || !a.emotions.includes(c.emotion)) return { ok: false, reason: `cue-not-allowed:${c.animation}/${c.emotion}` };
  }
  if (g.audio && !a.audio.includes(g.audio)) return { ok: false, reason: `audio-not-allowed:${g.audio}` };
  if (g.mood && !a.moods.includes(g.mood)) return { ok: false, reason: `mood-not-allowed:${g.mood}` };
  if (new Set(g.npcCues.map((c) => c.npcId)).size !== g.npcCues.length || new Set(g.decor.map((d) => d.anchor)).size !== g.decor.length) return { ok: false, reason: 'duplicates' };
  return { ok: true, suggestion: g };
}

/**
 * Merge an AI suggestion over the deterministic directive. Re-validates against the CURRENT state (the
 * suggestion may be stale after an async wait); mandatory fields are never overridden. Idempotent.
 */
export function mergeSceneSuggestion(s: GameState, base: SceneDirective, suggestion: SceneAISuggestion | null): SceneDirective {
  const fresh = buildSceneDirective(s);
  if (!suggestion) return fresh;
  const check = validateSceneSuggestion(buildSceneAIRequest(s), suggestion);
  if (!check.ok) return fresh;
  const g = check.suggestion;
  // Earlier accepted variations carry over only if `base` was built for the same conditions.
  const start = base.basisKey === fresh.basisKey ? base : fresh;
  const allowedExtra = new Set(optionalEffects(s, fresh.weather, fresh.effects));
  const pickDecor = (anchor: PropAnchor) => g.decor.find((d) => d.anchor === anchor) ?? start.props.find((d) => d.anchor === anchor);
  return {
    ...fresh,
    lighting: g.lighting ?? start.lighting,
    effects: canonicalEffects([...fresh.effects, ...start.effects.filter((e) => allowedExtra.has(e)), ...g.extraEffects]),
    props: fresh.props.map((p) => (isDecor(p.anchor) ? pickDecor(p.anchor) ?? p : p)), // mandatory props always come from state
    npcCues: fresh.npcCues.map((c) => g.npcCues.find((x) => x.npcId === c.npcId) ?? start.npcCues.find((x) => x.npcId === c.npcId) ?? c),
    audio: g.audio ?? start.audio,
    mood: g.mood ?? start.mood,
    source: 'ai-merged',
  };
}

const isDecor = (a: PropAnchor) => a === 'LIVING_DECOR' || a === 'KITCHEN_DECOR' || a === 'BEDROOM_DECOR';
