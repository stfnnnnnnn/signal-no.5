// Which screen is shown, and the one place runs are started (new, replay, continue). Never holds game state.
import type { EngineError } from '../../core/engine';
import type { OnboardingInput } from '../../shared/contracts/onboarding';
import { clearScenarioCache } from '../services/ai';
import { store } from './engineStore';
import { ui } from './uiStore';
import type { Draft } from '../ui/onboarding/onboardingModel';

export type Screen = 'title' | 'mode' | 'custom' | 'random' | 'customize' | 'game' | 'debrief' | 'achievements' | 'settings';
type StartResult = { ok: true } | { ok: false; error: EngineError };

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export class AppStore {
  screen: Screen = 'title';
  /** Bumped for every run so the Phaser world remounts from scratch. */
  runKey = 0;
  version = 0;
  /** Answers carried from onboarding into the customization/review step. */
  setup: { mode: 'custom' | 'random'; draft: Draft; seed: number } | null = null;
  private readonly listeners = new Set<() => void>();

  go(screen: Screen) { this.screen = screen; this.emit(); }

  prepare(mode: 'custom' | 'random', draft: Draft, seed = newSeed()) { this.setup = { mode, draft, seed }; this.go('customize'); }
  reroll() { if (this.setup) { this.setup = { ...this.setup, seed: newSeed() }; this.emit(); } }

  startNew(input: OnboardingInput, seed: number): StartResult {
    return this.begin(() => store.newGame(input, seed));
  }

  /** Same household, new storm seed. */
  replay(seed = newSeed()): StartResult {
    const profile = store.state?.household;
    if (!profile) return { ok: false, error: { code: 'INVALID_SAVE', message: 'No household to replay.' } };
    return this.begin(() => store.startProfile(profile, seed));
  }

  continueFrom(saved: unknown): StartResult {
    return this.begin(() => {
      const r = store.load(saved);
      // Pauses owned by UI that no longer exists (panels, shop, window focus) must not survive a reload.
      if (r.ok) for (const reason of ['menu', 'shop', 'focusLost'] as const) if (store.state?.clock.pauseReasons.includes(reason)) store.dispatch((e) => e.resume(reason));
      return r;
    });
  }

  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  private begin(start: () => StartResult): StartResult {
    const r = start();
    if (!r.ok) return r;
    ui.reset();
    clearScenarioCache();
    this.setup = null; // the next "New household" starts from blank answers and a new seed
    this.runKey++;
    this.go('game');
    return r;
  }

  private emit() { this.version++; for (const l of this.listeners) l(); }
}

export const app = new AppStore();
