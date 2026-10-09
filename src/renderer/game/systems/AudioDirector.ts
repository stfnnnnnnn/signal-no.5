// Ambient audio follows the directive's AudioPreset; one-shots follow engine events. This build ships no sound
// files, so the director only tracks what *would* play (one ambient loop at a time) and never errors or blocks.
import { loadSettings } from '../../state/settings';

class AudioDirector {
  current: string | null = null;
  readonly played: string[] = [];

  /** Switch the ambient loop only when the key changes (re-applying a directive must not restart it). */
  ambient(key: string) {
    if (key === this.current) return;
    this.current = key;
    if (!loadSettings().muted) console.debug(`[audio] ambient → ${key} (no audio file in this build)`);
  }

  oneShot(key: string) {
    this.played.push(key);
    if (this.played.length > 50) this.played.shift();
  }
}

export const audio = new AudioDirector();
