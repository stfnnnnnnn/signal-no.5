import { expect, it } from 'vitest';
import { formatClock } from '../../src/renderer/ui/format';

it('formats day and time from game minutes', () => {
  expect(formatClock(0)).toBe('Day 1 · 00:00');
  expect(formatClock(1440 + 6 * 60 + 5)).toBe('Day 2 · 06:05');
  expect(formatClock(90.7)).toBe('Day 1 · 01:30');
});
