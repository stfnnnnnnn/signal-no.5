// house_fixed_v1: the one fixed floor plan (frontend-owned, gap G3). Tile coordinates, 16 px tiles.
// Geometry and collision are identical for every theme; themes only swap tile colours.
export const TILE = 16;
export const MAP_W = 30;
export const MAP_H = 18;

export enum T { WALL = 0, KITCHEN = 1, BEDROOM = 2, UTILITY = 3, LIVING = 4, ENTRANCE = 5 }

interface Room { floor: T; x: number; y: number; w: number; h: number }
const ROOMS: Room[] = [
  { floor: T.KITCHEN, x: 1, y: 1, w: 10, h: 6 },
  { floor: T.BEDROOM, x: 12, y: 1, w: 17, h: 6 },
  { floor: T.UTILITY, x: 1, y: 8, w: 10, h: 9 },
  { floor: T.LIVING, x: 12, y: 8, w: 11, h: 9 },
  { floor: T.ENTRANCE, x: 24, y: 8, w: 5, h: 9 },
];
// Door openings carved through interior walls, with the floor of the room they open into.
const DOORS: { tx: number; ty: number; floor: T }[] = [
  { tx: 5, ty: 7, floor: T.UTILITY }, { tx: 6, ty: 7, floor: T.UTILITY },       // kitchen ↔ utility
  { tx: 11, ty: 3, floor: T.KITCHEN }, { tx: 11, ty: 4, floor: T.KITCHEN },     // kitchen ↔ bedroom
  { tx: 16, ty: 7, floor: T.LIVING }, { tx: 17, ty: 7, floor: T.LIVING },       // bedroom ↔ living
  { tx: 11, ty: 12, floor: T.LIVING }, { tx: 11, ty: 13, floor: T.LIVING },     // utility ↔ living
  { tx: 23, ty: 11, floor: T.ENTRANCE }, { tx: 23, ty: 12, floor: T.ENTRANCE }, // living ↔ entrance
];

export interface Anchor { id: string; tx: number; ty: number; sprite: string | null; size: 16 | 32 }
/** One per HOUSE interactable (src/core/content/interactables.ts). `sprite` = items/<name>.png, null = generated placeholder. */
export const ANCHORS: Anchor[] = [
  { id: 'LIVING_TV', tx: 20, ty: 8, sprite: null, size: 16 },
  { id: 'LIVING_PHONE', tx: 20, ty: 14, sprite: 'phone', size: 16 },
  { id: 'LIVING_RADIO', tx: 13, ty: 9, sprite: 'radio', size: 16 },
  { id: 'KITCHEN_CABINET', tx: 2, ty: 1, sprite: 'cupboard', size: 32 },
  { id: 'KITCHEN_SINK', tx: 6, ty: 1, sprite: null, size: 16 },
  { id: 'BEDROOM_CLOTHES', tx: 14, ty: 1, sprite: 'drawers', size: 32 },
  { id: 'BEDROOM_DOCUMENTS', tx: 20, ty: 1, sprite: 'document', size: 16 },
  { id: 'BEDROOM_MEDICATION', tx: 24, ty: 1, sprite: 'medicines', size: 16 },
  { id: 'UTILITY_TOOLS', tx: 1, ty: 9, sprite: null, size: 16 },
  { id: 'UTILITY_SHELF', tx: 1, ty: 12, sprite: 'shelf', size: 32 },
  { id: 'UTILITY_DRUM', tx: 4, ty: 16, sprite: 'water', size: 16 },
  { id: 'UTILITY_LADDER', tx: 8, ty: 16, sprite: null, size: 16 },
  { id: 'PET_AREA', tx: 9, ty: 9, sprite: null, size: 16 },
  { id: 'ENTRANCE_DOOR', tx: 26, ty: 17, sprite: 'door', size: 16 }, // wall-mounted: stays within the wall tile
  { id: 'ENTRANCE_BAG', tx: 28, ty: 9, sprite: 'bag', size: 16 },
  { id: 'STAIRS', tx: 28, ty: 15, sprite: null, size: 16 },
  { id: 'WINDOW', tx: 17, ty: 17, sprite: 'window', size: 16 },        // wall-mounted: stays within the wall tile
];

export const PLAYER_SPAWN = { tx: 17, ty: 12 };
export const NPC_SPAWNS = [{ tx: 14, ty: 15 }, { tx: 21, ty: 11 }, { tx: 25, ty: 13 }];

export function buildGrid(): T[][] {
  const g: T[][] = Array.from({ length: MAP_H }, () => Array<T>(MAP_W).fill(T.WALL));
  for (const r of ROOMS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y]![x] = r.floor;
  for (const d of DOORS) g[d.ty]![d.tx] = d.floor;
  return g;
}

/** Walls plus the tiles occupied by interactable objects. */
export function solidTiles(grid: T[][], anchors: Anchor[] = ANCHORS): boolean[][] {
  const s = grid.map((row) => row.map((t) => t === T.WALL));
  for (const a of anchors) s[a.ty]![a.tx] = true;
  return s;
}

export const tileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

/** Where an anchor's sprite is drawn (px): centred on its tile, standing on the tile's bottom edge. */
export function anchorSpriteRect(a: Anchor): { x: number; y: number; w: number; h: number } {
  return { x: a.tx * TILE + (TILE - a.size) / 2, y: (a.ty + 1) * TILE - a.size, w: a.size, h: a.size };
}

/** Where SceneDirective props are drawn in the house (visual only: props never change collision). */
export const PROP_ANCHORS: Record<import('../../shared/contracts/scene').PropAnchor, { tx: number; ty: number }> = {
  WINDOW: { tx: 17, ty: 17 }, YARD: { tx: 25, ty: 15 }, ENTRANCE: { tx: 26, ty: 17 }, STAIRS: { tx: 27, ty: 15 },
  LIVING_TABLE: { tx: 15, ty: 10 }, GO_BAG_SPOT: { tx: 28, ty: 9 },
  LIVING_DECOR: { tx: 12, ty: 8 }, KITCHEN_DECOR: { tx: 9, ty: 1 }, BEDROOM_DECOR: { tx: 27, ty: 1 },
};
