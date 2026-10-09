// Deterministic PRNG (mulberry32). All randomness in the simulation flows through seeded streams
// so a run is reproducible from its seed.
export interface Rng {
  next(): number; // [0, 1)
  int(min: number, maxInclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty list');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of entries) { r -= w; if (r < 0) return v; }
      return entries[entries.length - 1]![0];
    },
  };
  return rng;
}

/** Derive an independent sub-stream seed (e.g. "household", "storm") from a base seed. */
export function deriveSeed(seed: number, label: string): number {
  let h = 2166136261 ^ (seed >>> 0);
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 16777619);
  return h >>> 0;
}
