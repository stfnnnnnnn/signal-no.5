export const INTERACT_RADIUS = 24;

/** Closest anchor within `radius` px of (x, y), or null. */
export function nearestAnchor(x: number, y: number, anchors: { id: string; x: number; y: number }[], radius = INTERACT_RADIUS): string | null {
  let best: string | null = null, bestD = radius * radius;
  for (const a of anchors) {
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d <= bestD) { bestD = d; best = a.id; }
  }
  return best;
}
