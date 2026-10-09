// Small fixed rooms for the other engine scenes (shop, street in transit, evacuation centre). 0 = wall.
import { TILE } from './layout';

export interface RoomLayout {
  grid: number[][];
  spawn: { tx: number; ty: number };
  anchors: { id: string; tx: number; ty: number }[];
  /** Tile colours: index 0 wall, 1 floor, 2 accent floor. */
  colors: [string, string, string];
}

function room(w: number, h: number, accent: (x: number, y: number) => boolean): number[][] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) =>
    (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? 0 : accent(x, y) ? 2 : 1));
}

export const ROOMS: Record<'Shop' | 'Street' | 'Evacuation', RoomLayout> = {
  // Community shop: counter at the back, exit in the front wall.
  Shop: {
    grid: room(16, 10, (x, y) => y <= 2 && x >= 3 && x <= 12), spawn: { tx: 8, ty: 7 },
    anchors: [{ id: 'SHOP_COUNTER', tx: 8, ty: 2 }, { id: 'SHOP_EXIT', tx: 8, ty: 9 }],
    colors: ['#4a3b2a', '#c9b48a', '#a8916a'],
  },
  // Road to the evacuation destination (in transit): a wet road between kerbs.
  Street: {
    grid: room(30, 10, (_x, y) => y >= 4 && y <= 5), spawn: { tx: 3, ty: 5 }, anchors: [],
    colors: ['#3a4048', '#6b737d', '#e0d27a'],
  },
  // Evacuation centre: a hall with rows of sleeping mats.
  Evacuation: {
    grid: room(22, 13, (x, y) => y % 3 === 0 && x % 4 !== 0), spawn: { tx: 11, ty: 10 }, anchors: [],
    colors: ['#3d4a5c', '#b9b29c', '#6f8fb0'],
  },
};

export const roomSize = (r: RoomLayout) => ({ w: r.grid[0]!.length * TILE, h: r.grid.length * TILE });
