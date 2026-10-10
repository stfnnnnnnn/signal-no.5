// The current SceneDirective: deterministic from the engine, optionally varied by a validated AI suggestion
// (one request per basisKey). Recomputed only after results that can change it; listeners hear real changes only.
import type { EngineEvent } from '../../core/engine';
import { buildSceneAIRequest, mergeSceneSuggestion } from '../../core/scene/directive';
import type { SceneAISuggestion, SceneDirective } from '../../shared/contracts/scene';
import { directiveChanged } from '../game/directive';
import { requestSceneSuggestion } from '../services/ai';
import { store } from './engineStore';

const REFRESH_ON = new Set<EngineEvent['type']>(['sceneChanged', 'phaseChanged', 'milestone', 'purchaseCompleted', 'actionCompleted', 'eventResolved']);

export class DirectiveStore {
  current: SceneDirective | null = null;
  version = 0;
  private runId: string | null = null;
  private readonly suggestions = new Map<string, SceneAISuggestion | null>();
  private readonly requested = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private unbind: (() => void)[] = [];

  attach(): void {
    this.unbind.push(store.onEvents((events) => { if (events.some((e) => REFRESH_ON.has(e.type))) this.refresh(); }));
    this.unbind.push(store.subscribe(() => { if (store.state && store.state.runId !== this.runId) this.newRun(); }));
    if (store.state) this.newRun();
  }
  detach(): void { for (const u of this.unbind.splice(0)) u(); }
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  refresh(): void {
    const s = store.state;
    if (!s) return;
    const base = store.engine.getSceneDirective();
    const sugg = this.suggestions.get(base.basisKey);
    const next = sugg ? mergeSceneSuggestion(s, this.current ?? base, sugg) : base;
    if (directiveChanged(this.current, next)) { this.current = next; this.version++; for (const l of this.listeners) l(); }
    if (!this.requested.has(base.basisKey)) this.ask(base.basisKey);
  }

  private newRun() {
    this.runId = store.state!.runId; this.current = null; this.suggestions.clear(); this.requested.clear();
    this.refresh();
  }

  private ask(basisKey: string) {
    this.requested.add(basisKey);
    const s = store.state!;
    const runId = s.runId;
    void requestSceneSuggestion(buildSceneAIRequest(s), runId).then((sugg) => {
      if (store.state?.runId !== runId) return;
      this.suggestions.set(basisKey, sugg);
      if (sugg) this.refresh(); // mergeSceneSuggestion re-validates against the current state
    });
  }
}

export const directives = new DirectiveStore();
