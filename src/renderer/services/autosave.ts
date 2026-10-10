// Saving the run in the engine's own GameState format through window.signal.save (no separate save format).
// Autosave on every phase change; a finished run is not saved as something to continue.
import type { EngineEvent } from '../../core/engine';
import type { GameState } from '../../shared/contracts/state';
import { store } from '../state/engineStore';
import { ui } from '../state/uiStore';

export const AUTO_SLOT = 'auto';
type Write = (slot: string, state: GameState) => Promise<boolean>;

export function createAutosaver(write: Write) {
  const saveState = async (s: GameState | null) => (s && !s.completed ? write(AUTO_SLOT, s) : false);
  return {
    async onEvents(events: EngineEvent[], state: GameState | null = store.state) {
      if (events.some((e) => e.type === 'phaseChanged')) await saveState(state);
    },
    async saveNow(): Promise<boolean> {
      const ok = await saveState(store.state);
      ui.toast(ok ? { kind: 'info', title: 'Game saved' } : { kind: 'error', title: 'Couldn’t save', body: 'Keep playing; try again in a moment.' });
      return ok;
    },
  };
}
