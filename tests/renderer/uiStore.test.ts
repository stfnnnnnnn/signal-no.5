import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiStore } from '../../src/renderer/state/uiStore';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('toast expiry', () => {
  it('expires each toast on its own timer, unaffected by other toasts arriving or leaving', () => {
    const ui = new UiStore();
    ui.toast({ kind: 'badge', title: 'Badge earned: Bayanihan' }); // 6 s
    vi.advanceTimersByTime(3000);
    ui.toast({ kind: 'info', title: 'Share' });                     // 3.5 s
    vi.advanceTimersByTime(3000);                                   // t = 6 s
    expect(ui.toasts.map((t) => t.title)).toEqual(['Share']);
    vi.advanceTimersByTime(500);                                    // t = 6.5 s
    expect(ui.toasts).toEqual([]);
  });

  it('still expires toasts that arrive faster than they expire', () => {
    const ui = new UiStore();
    for (let i = 0; i < 10; i++) { ui.toast({ kind: 'info', title: `t${i}` }); vi.advanceTimersByTime(1000); }
    vi.advanceTimersByTime(3500);
    expect(ui.toasts).toEqual([]);
  });
});
