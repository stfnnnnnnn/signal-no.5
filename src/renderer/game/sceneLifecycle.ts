// A scene ends either by SHUTDOWN (switching scenes) or DESTROY (the whole game is destroyed, e.g. leaving for
// the debrief; Phaser then emits only DESTROY). Cleanup must run on whichever comes first, exactly once.
interface SceneLike { events: { once(event: string, fn: () => void): unknown } }

export function onSceneEnd(scene: SceneLike, cleanup: () => void): void {
  let done = false;
  const run = () => { if (!done) { done = true; cleanup(); } };
  scene.events.once('shutdown', run);
  scene.events.once('destroy', run);
}
