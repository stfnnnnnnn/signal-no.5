// SceneDirective: renderer-facing presentation contract (weather, lighting, flood overlay, effects, props,
// NPC cues, audio, mood, transition). Every value is a known preset/asset ID the frontend must provide.
// Mandatory fields are derived deterministically from GameState; the AI may only add approved variations.
import { z } from 'zod';
import { SceneId } from './ids';

export const WeatherPreset = z.enum(['clear', 'overcast', 'rain', 'heavyRain', 'typhoon', 'clearingSky']);
export const RainLevel = z.enum(['none', 'light', 'moderate', 'heavy', 'torrential']);
export const WindLevel = z.enum(['calm', 'breezy', 'gusty', 'strong', 'violent']);
export const LightingPreset = z.enum(['daylight', 'overcast', 'gloomy', 'stormDark', 'outageDark', 'outageFlashlight', 'evacuationCenter', 'shopInterior', 'morningAfter']);
export const FloodOverlay = z.enum(['none', 'low', 'moderate', 'severe']);
export const EffectId = z.enum(['RAIN_STREAKS', 'WINDOW_DRIPS', 'WIND_DEBRIS', 'TREE_SWAY', 'LIGHTNING_FLASH', 'MIST', 'PUDDLES', 'FLOOD_RIPPLES', 'FLICKERING_LIGHTS', 'DEBRIS_AFTERMATH', 'SUNBEAMS', 'DUST_MOTES']);
export const PropAnchor = z.enum(['WINDOW', 'YARD', 'ENTRANCE', 'STAIRS', 'LIVING_TABLE', 'GO_BAG_SPOT', 'LIVING_DECOR', 'KITCHEN_DECOR', 'BEDROOM_DECOR']);
export const PropVariantId = z.enum([
  // state-derived (mandatory)
  'WINDOW_PLAIN', 'WINDOW_BOARDED', 'YARD_LOOSE_ITEMS', 'YARD_SECURED', 'ENTRANCE_PLAIN', 'ENTRANCE_SANDBAGS',
  'STAIRS_PLAIN', 'STAIRS_RAISED_BELONGINGS', 'LIVING_TABLE_EMPTY', 'LIVING_TABLE_FLASHLIGHT',
  'GO_BAG_EMPTY', 'GO_BAG_PARTIAL', 'GO_BAG_READY',
  // decorative (AI may choose among the theme's options)
  'MODERN_LIVING_PHOTOS', 'MODERN_LIVING_PLANTS', 'MODERN_KITCHEN_RICE_COOKER', 'MODERN_KITCHEN_FRUIT_BOWL', 'MODERN_BEDROOM_POSTERS', 'MODERN_BEDROOM_DESK_LAMP',
  'TRAD_LIVING_ALTAR', 'TRAD_LIVING_CAPIZ_LAMP', 'TRAD_KITCHEN_PALAYOK', 'TRAD_KITCHEN_BAYONG', 'TRAD_BEDROOM_BANIG', 'TRAD_BEDROOM_WOODEN_CHEST',
]);
export const NpcAnimation = z.enum(['idle', 'pacing', 'packing', 'sitting', 'lookingOutWindow', 'huddled', 'waving', 'cleaning', 'sleeping']);
export const NpcEmotion = z.enum(['calm', 'worried', 'anxious', 'determined', 'relieved', 'tired']);
export const AudioPreset = z.enum(['dayAmbience', 'lightRainRoof', 'heavyRainRoof', 'typhoonWind', 'outageStormMuffled', 'evacuationCenterCrowd', 'shopChatter', 'aftermathDrips']);
export const Mood = z.enum(['calm', 'uneasy', 'tense', 'urgent', 'somber', 'hopeful']);
export const TransitionPreset = z.enum(['none', 'fade', 'rainWipe', 'flashToBlack']);

export type LightingPreset = z.infer<typeof LightingPreset>;
export type EffectId = z.infer<typeof EffectId>;
export type PropVariantId = z.infer<typeof PropVariantId>;
export type PropAnchor = z.infer<typeof PropAnchor>;

export const PropPlacement = z.object({ anchor: PropAnchor, variant: PropVariantId }).strict();
export const NpcCue = z.object({ npcId: z.string().regex(/^NPC_[A-Z0-9_]+$/), animation: NpcAnimation, emotion: NpcEmotion }).strict();
export type NpcCue = z.infer<typeof NpcCue>;

export const SceneDirective = z.object({
  schemaVersion: z.literal(1),
  sceneId: SceneId,
  /** Identifies the authoritative conditions this directive was built for (used to discard stale AI suggestions). */
  basisKey: z.string(),
  weather: z.object({ preset: WeatherPreset, rain: RainLevel, wind: WindLevel }).strict(),
  lighting: LightingPreset,
  flood: FloodOverlay,
  effects: z.array(EffectId),
  props: z.array(PropPlacement),
  npcCues: z.array(NpcCue),
  audio: AudioPreset,
  mood: Mood,
  transition: TransitionPreset,
  source: z.enum(['deterministic', 'ai-merged']),
}).strict();
export type SceneDirective = z.infer<typeof SceneDirective>;

/** What the AI may choose from for this exact state (sent to the model and used to validate its answer). */
export const SceneAIRequest = z.object({
  schemaVersion: z.literal(1),
  sceneId: SceneId,
  basisKey: z.string(),
  context: z.object({ phase: z.string(), weather: WeatherPreset, powerAvailable: z.boolean(), flood: FloodOverlay, theme: z.string(), householdSize: z.number().int(), mood: Mood }),
  allowed: z.object({
    lighting: z.array(LightingPreset).min(1),
    extraEffects: z.array(EffectId),
    decor: z.array(z.object({ anchor: PropAnchor, variants: z.array(PropVariantId).min(1) })),
    npcIds: z.array(z.string()),
    animations: z.array(NpcAnimation).min(1),
    emotions: z.array(NpcEmotion).min(1),
    audio: z.array(AudioPreset).min(1),
    moods: z.array(Mood).min(1),
  }),
});
export type SceneAIRequest = z.infer<typeof SceneAIRequest>;

/** The AI's answer: only optional variations. Mandatory fields (weather, flood, required props/effects) are absent by design. */
export const SceneAISuggestion = z.object({
  basisKey: z.string(),
  lighting: LightingPreset.optional(),
  extraEffects: z.array(EffectId).max(3).default([]),
  decor: z.array(PropPlacement).max(3).default([]),
  npcCues: z.array(NpcCue).max(3).default([]),
  audio: AudioPreset.optional(),
  mood: Mood.optional(),
}).strict();
export type SceneAISuggestion = z.infer<typeof SceneAISuggestion>;
