# Frontend ↔ Backend Contracts

The full API reference (engine calls, `window.signal`, types, errors, gaps) is **[docs/frontend/FRONTEND_BACKEND_INTEGRATION.md](../frontend/FRONTEND_BACKEND_INTEGRATION.md)**. This file documents the **scene directive contract** and the asset IDs the frontend must provide. The authoritative types are in the code: `src/shared/contracts/*.ts`, `src/shared/bridge.ts`, `src/core/engine.ts`.

## Scene directives (AI-directed environmental variation)

A `SceneDirective` (`src/shared/contracts/scene.ts`) tells the Phaser frontend **how to present** the current scene:
- weather appearance and intensity, rain and wind;
- lighting, the approved flood overlay and environmental effects;
- prop variants (state-derived and decorative);
- NPC animation and emotion cues;
- ambient audio, mood and the transition preset.

The frontend renders it using existing assets. **Nothing is generated at runtime.** No raster assets, tilemaps, floor plans or scene code.

### Authority

| Decided by the deterministic engine (never overridden) | May be varied by the local AI (validated) |
|---|---|
| Weather preset, rain and wind levels (from `environment.weatherState`/`windSeverity`) | Lighting, **only** among the state-consistent options (e.g. `gloomy` ↔ `stormDark`; never electric light during an outage) |
| Flood overlay = `environment.floodSeverity` (outdoor/house scenes; `none` in SHOP/EVACUATION) | Extra effects from the allowed list (e.g. `LIGHTNING_FLASH`, `MIST`; `SUNBEAMS` only in clear weather) |
| Power-outage lighting (`outageFlashlight` if the household has a flashlight or power bank, else `outageDark`) | Decorative props for the household's theme (modern / traditional) |
| State-derived props: boarded windows, secured yard, sandbags, raised belongings, flashlight on the table, go-bag state | NPC animation and emotion cues for NPCs actually in the scene (phase-appropriate) |
| Mandatory effects (rain streaks, debris in strong wind, flood ripples, aftermath puddles and debris), transition, NPC identities | Ambient audio and mood among allowed presets |

### Runtime flow

```ts
import { buildSceneAIRequest, mergeSceneSuggestion } from '../core/scene/directive';

let scene = engine.getSceneDirective();                       // sync, deterministic: apply immediately
applyScene(scene);                                             // idempotent: applying the same directive twice is a no-op
const req = buildSceneAIRequest(engine.getState());            // the allowed options for exactly this state
window.signal.ai.suggestScene(req, engine.getState().runId)    // async, optional, ~5 s on the GTX 1650 Ti; never blocks gameplay
  .then((s) => { scene = mergeSceneSuggestion(engine.getState(), engine.getSceneDirective(), s); applyScene(scene); });
```

- `suggestScene` **always resolves**: a validated `SceneAISuggestion`, or `null` (no model, timeout, or an invalid or inconsistent answer).
- `mergeSceneSuggestion(state, base, suggestion)` re-checks the suggestion against the **current** state. If the state changed while waiting (a different `basisKey`) or anything is inconsistent, it returns the deterministic directive. It never mutates `GameState`.
- **When to recompute:** after any result with `sceneChanged`, `phaseChanged` or `milestone`, or after actions that change props (board windows, secure objects, sandbag, raise belongings, pack the go-bag). Recomputing is cheap.

### Schema

```ts
SceneDirective = {
  schemaVersion: 1, sceneId: SceneId, basisKey: string,
  weather: { preset: WeatherPreset; rain: RainLevel; wind: WindLevel },
  lighting: LightingPreset, flood: FloodOverlay, effects: EffectId[],
  props: { anchor: PropAnchor; variant: PropVariantId }[], npcCues: { npcId; animation: NpcAnimation; emotion: NpcEmotion }[],
  audio: AudioPreset, mood: Mood, transition: TransitionPreset, source: 'deterministic' | 'ai-merged',
}   // .strict(): unknown keys and unknown IDs are rejected
```

### Asset IDs the frontend must provide

| Enum | Values |
|---|---|
| `WeatherPreset` | `clear, overcast, rain, heavyRain, typhoon, clearingSky` |
| `RainLevel` / `WindLevel` | `none, light, moderate, heavy, torrential` / `calm, breezy, gusty, strong, violent` |
| `LightingPreset` | `daylight, overcast, gloomy, stormDark, outageDark, outageFlashlight, evacuationCenter, shopInterior, morningAfter` |
| `FloodOverlay` | `none, low, moderate, severe` |
| `EffectId` | `RAIN_STREAKS, WINDOW_DRIPS, WIND_DEBRIS, TREE_SWAY, LIGHTNING_FLASH, MIST, PUDDLES, FLOOD_RIPPLES, FLICKERING_LIGHTS, DEBRIS_AFTERMATH, SUNBEAMS, DUST_MOTES` |
| `PropAnchor` | `WINDOW, YARD, ENTRANCE, STAIRS, LIVING_TABLE, GO_BAG_SPOT, LIVING_DECOR, KITCHEN_DECOR, BEDROOM_DECOR` |
| `PropVariantId` (state-derived) | `WINDOW_PLAIN/BOARDED, YARD_LOOSE_ITEMS/SECURED, ENTRANCE_PLAIN/SANDBAGS, STAIRS_PLAIN/RAISED_BELONGINGS, LIVING_TABLE_EMPTY/FLASHLIGHT, GO_BAG_EMPTY/PARTIAL/READY` |
| `PropVariantId` (decor, modern) | `MODERN_LIVING_PHOTOS, MODERN_LIVING_PLANTS, MODERN_KITCHEN_RICE_COOKER, MODERN_KITCHEN_FRUIT_BOWL, MODERN_BEDROOM_POSTERS, MODERN_BEDROOM_DESK_LAMP` |
| `PropVariantId` (decor, traditional) | `TRAD_LIVING_ALTAR, TRAD_LIVING_CAPIZ_LAMP, TRAD_KITCHEN_PALAYOK, TRAD_KITCHEN_BAYONG, TRAD_BEDROOM_BANIG, TRAD_BEDROOM_WOODEN_CHEST` |
| `NpcAnimation` | `idle, pacing, packing, sitting, lookingOutWindow, huddled, waving, cleaning, sleeping` |
| `NpcEmotion` | `calm, worried, anxious, determined, relieved, tired` |
| `AudioPreset` | `dayAmbience, lightRainRoof, heavyRainRoof, typhoonWind, outageStormMuffled, evacuationCenterCrowd, shopChatter, aftermathDrips` |
| `Mood` | `calm, uneasy, tense, urgent, somber, hopeful` |
| `TransitionPreset` | `none, fade, rainWipe, flashToBlack` |

Props appear only in the house scenes (`HOUSE`, `HOME_IMPACT`, `AFTERMATH`). NPC cues apply in `HOUSE`, `HOME_IMPACT`, `AFTERMATH` and `EVACUATION`. The rules live in `src/core/scene/directive.ts` and are tested in `tests/scene.test.ts`.

### Measured (2026-10-09, Qwen3-4B, GTX 1650 Ti, via `--self-test`)
2/2 real suggestions passed validation and merged (decor matched the theme; cues only for in-scene NPCs), taking 4.9–5.9 s each.
