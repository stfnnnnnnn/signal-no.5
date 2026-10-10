// The renderer's ONLY game state: one GameEngine per run. React and Phaser read from here and send commands here.
import { createGame, loadGame, startRun, type CommandResult, type EngineError, type EngineEvent, type GameEngine } from '../../core/engine';
import type { HouseholdProfile } from '../../shared/contracts/household';
import type { OnboardingInput } from '../../shared/contracts/onboarding';
import type { GameState } from '../../shared/contracts/state';

export type InteractResult = ReturnType<GameEngine['interact']>;
export const TICK_INTERVAL_MS = 100;

export class EngineStore {
  private eng: GameEngine | null = null;
  private st: GameState | null = null;
  private tickAcc = 0;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(events: EngineEvent[]) => void>();

  get state(): GameState | null { return this.st; }
  get engine(): GameEngine {
    if (!this.eng) throw new Error('No game in progress');
    return this.eng;
  }

  newGame(input: OnboardingInput, seed: number): { ok: true } | { ok: false; error: EngineError } {
    const r = createGame(input, { seed });
    if (!r.ok) return r;
    this.eng = r.engine; this.tickAcc = 0;
    this.apply(r.engine.getState(), r.events);
    return { ok: true };
  }

  /** Same household, new storm (replay). */
  startProfile(profile: HouseholdProfile, seed: number): { ok: true } {
    const r = startRun(profile, { seed });
    this.eng = r.engine; this.tickAcc = 0;
    this.apply(r.engine.getState(), r.events);
    return { ok: true };
  }

  /** Resume a saved GameState (validated and migrated by the engine). */
  load(raw: unknown): { ok: true } | { ok: false; error: EngineError } {
    const r = loadGame(raw);
    if (!r.ok) return r;
    this.eng = r.engine; this.tickAcc = 0;
    this.apply(r.engine.getState(), []);
    return { ok: true };
  }

  dispatch(fn: (e: GameEngine) => CommandResult): CommandResult {
    const r = fn(this.engine);
    if (r.ok) this.apply(r.state, r.events);
    return r;
  }

  interact(id: string): InteractResult {
    const r = this.engine.interact(id);
    if (r.ok) this.apply(r.state, r.events);
    return r;
  }

  /** Called once per Phaser frame; advances the engine about every TICK_INTERVAL_MS of real time. */
  tick(deltaMs: number): void {
    if (!this.eng) return;
    this.tickAcc += deltaMs;
    if (this.tickAcc < TICK_INTERVAL_MS) return;
    const ms = this.tickAcc; this.tickAcc = 0;
    this.dispatch((e) => e.tick(ms));
  }

  activeEventKey(): string | null {
    const ev = this.st?.activeEvent;
    return ev ? `${ev.eventId}@${ev.triggeredAtMinute}` : null;
  }

  subscribe(l: () => void): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  onEvents(l: (events: EngineEvent[]) => void): () => void { this.eventListeners.add(l); return () => { this.eventListeners.delete(l); }; }

  reset(): void { this.eng = null; this.st = null; this.tickAcc = 0; this.listeners.clear(); this.eventListeners.clear(); }

  private apply(state: GameState, events: EngineEvent[]): void {
    this.st = state;
    for (const l of this.listeners) l();
    if (events.length) for (const l of this.eventListeners) l(events);
  }
}

export const store = new EngineStore();
