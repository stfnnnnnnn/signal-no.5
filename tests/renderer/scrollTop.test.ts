import { expect, it, vi } from 'vitest';
import { openAtTop } from '../../src/renderer/ui/scroll';

it('opens a scrolling panel at the top and focuses it without scrolling', () => {
  const el = { scrollTop: 640, focus: vi.fn() };
  openAtTop(el);
  expect(el.scrollTop).toBe(0);
  expect(el.focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(() => openAtTop(null)).not.toThrow();
});
