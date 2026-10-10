// Scrolling screens (achievements, debrief, preparedness plan) always open at the top.
export function openAtTop(el: { scrollTop: number; focus(opts?: FocusOptions): void } | null): void {
  if (!el) return;
  el.scrollTop = 0;
  el.focus({ preventScroll: true });
}
