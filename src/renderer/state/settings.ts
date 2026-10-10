// Player settings (volume, mute, text size): a per-viewer convenience in localStorage (no backend store, gap G5).
// Every access is guarded: blocked or corrupt storage just means the defaults.
export interface Settings { volume: number; muted: boolean; textScale: number }
export const DEFAULT_SETTINGS: Settings = { volume: 70, muted: false, textScale: 1 };
export const TEXT_SCALES = [1, 1.125, 1.25] as const;
const KEY = 'signalno5.settings';

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (!raw) return { ...DEFAULT_SETTINGS };
    const ok = typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 100 && typeof raw.muted === 'boolean'
      && TEXT_SCALES.includes(raw.textScale as (typeof TEXT_SCALES)[number]);
    return ok ? { volume: raw.volume!, muted: raw.muted!, textScale: raw.textScale! } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* settings just won't persist */ }
}

/** Apply the text size to the whole UI. */
export function applySettings(s: Settings): void {
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--ui-scale', String(s.textScale));
}
