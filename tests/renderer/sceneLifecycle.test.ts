import { describe, expect, it, vi } from 'vitest';
import { onSceneEnd } from '../../src/renderer/game/sceneLifecycle';

function fakeEvents() {
  const handlers = new Map<string, (() => void)[]>();
  return {
    once(ev: string, fn: () => void) { handlers.set(ev, [...(handlers.get(ev) ?? []), fn]); },
    emit(ev: string) { const fns = handlers.get(ev) ?? []; handlers.delete(ev); for (const f of fns) f(); },
  };
}

describe('onSceneEnd', () => {
  it('cleans up when the scene is destroyed with the game (DESTROY without SHUTDOWN)', () => {
    const events = fakeEvents(); const cleanup = vi.fn();
    onSceneEnd({ events }, cleanup);
    events.emit('destroy');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
  it('cleans up once when a scene switch shuts it down and it is later destroyed', () => {
    const events = fakeEvents(); const cleanup = vi.fn();
    onSceneEnd({ events }, cleanup);
    events.emit('shutdown'); events.emit('destroy');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
