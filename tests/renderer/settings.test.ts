import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../src/renderer/state/settings';

afterEach(() => vi.unstubAllGlobals());

describe('settings (localStorage, per viewer)', () => {
  it('round-trips saved settings', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    saveSettings({ volume: 40, muted: true, textScale: 1.25 });
    expect(loadSettings()).toEqual({ volume: 40, muted: true, textScale: 1.25 });
  });
  it('falls back to defaults when storage throws or holds junk', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings({ ...DEFAULT_SETTINGS, muted: true })).not.toThrow();
    vi.stubGlobal('localStorage', { getItem: () => '{"volume":"loud","textScale":9}', setItem: () => {} });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
