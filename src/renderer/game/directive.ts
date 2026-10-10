// Pure SceneDirective helpers: change detection, one-shot effects, and which world scene shows an engine scene.
import type { SceneId } from '../../shared/contracts/ids';
import type { EffectId, SceneDirective } from '../../shared/contracts/scene';

export type WorldScene = 'House' | 'Shop' | 'Street' | 'Evacuation';

/** Applying the same directive twice must be a no-op (blueprint §7). */
export function directiveChanged(prev: SceneDirective | null, next: SceneDirective): boolean {
  return !prev || JSON.stringify(prev) !== JSON.stringify(next);
}

/** Effects present in `next` but not in `prev` (one-shots such as LIGHTNING_FLASH fire only then). */
export function addedEffects(prev: SceneDirective | null, next: SceneDirective): EffectId[] {
  const had = new Set(prev?.effects ?? []);
  return next.effects.filter((e) => !had.has(e));
}

/** HOME_IMPACT and AFTERMATH are the house with a storm/recovery look; RESULTS is the React debrief. */
export function phaserSceneFor(scene: SceneId): WorldScene | null {
  switch (scene) {
    case 'HOUSE': case 'HOME_IMPACT': case 'AFTERMATH': return 'House';
    case 'SHOP': return 'Shop';
    case 'STREET': return 'Street';
    case 'EVACUATION': return 'Evacuation';
    default: return null;
  }
}
