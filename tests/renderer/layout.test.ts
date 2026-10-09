import { describe, expect, it } from 'vitest';
import { INTERACTABLES } from '../../src/core/content/interactables';
import { anchorSpriteRect, ANCHORS, buildGrid, MAP_H, MAP_W, NPC_SPAWNS, PLAYER_SPAWN, solidTiles, T, TILE, tileCenter } from '../../src/renderer/game/layout';
import { INTERACT_RADIUS, nearestAnchor } from '../../src/renderer/game/proximity';

const grid = buildGrid();
const solid = solidTiles(grid, ANCHORS);

function reachable(): boolean[][] {
  const seen = grid.map((r) => r.map(() => false));
  const q = [[PLAYER_SPAWN.tx, PLAYER_SPAWN.ty]];
  seen[PLAYER_SPAWN.ty]![PLAYER_SPAWN.tx] = true;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x! + dx!, ny = y! + dy!;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || seen[ny]![nx] || solid[ny]![nx]) continue;
      seen[ny]![nx] = true; q.push([nx, ny]);
    }
  }
  return seen;
}

describe('house_fixed_v1 layout', () => {
  it('is a closed 30×18 grid', () => {
    expect(grid.length).toBe(MAP_H);
    expect(grid.every((r) => r.length === MAP_W)).toBe(true);
    for (let x = 0; x < MAP_W; x++) { expect(grid[0]![x]).toBe(T.WALL); expect(grid[MAP_H - 1]![x]).toBe(T.WALL); }
    for (let y = 0; y < MAP_H; y++) { expect(grid[y]![0]).toBe(T.WALL); expect(grid[y]![MAP_W - 1]).toBe(T.WALL); }
  });

  it('has exactly one anchor for every HOUSE interactable id', () => {
    const ids = INTERACTABLES.filter((i) => i.scene === 'HOUSE').map((i) => i.id).sort();
    expect(ANCHORS.map((a) => a.id).sort()).toEqual(ids);
  });

  it('lets the player reach a tile beside every anchor and every NPC spawn', () => {
    const seen = reachable();
    for (const a of ANCHORS) {
      const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[a.ty + dy!]?.[a.tx + dx!]);
      expect(ok, a.id).toBe(true);
    }
    for (const n of NPC_SPAWNS) expect(seen[n.ty]![n.tx]).toBe(true);
  });

  it('finds the phone from an adjacent tile and nothing from the room centre far away', () => {
    const pts = ANCHORS.map((a) => ({ id: a.id, ...tileCenter(a.tx, a.ty) }));
    const phone = ANCHORS.find((a) => a.id === 'LIVING_PHONE')!;
    const beside = tileCenter(phone.tx - 1, phone.ty);
    expect(nearestAnchor(beside.x, beside.y, pts)).toBe('LIVING_PHONE');
    expect(nearestAnchor(beside.x - 3 * INTERACT_RADIUS, beside.y, pts)).not.toBe('LIVING_PHONE');
  });

  it('draws wall-mounted objects only over wall tiles, never over the walkway', () => {
    for (const a of ANCHORS.filter((x) => grid[x.ty]![x.tx] === T.WALL)) {
      const r = anchorSpriteRect(a);
      for (let y = Math.floor(r.y / TILE); y < Math.ceil((r.y + r.h) / TILE); y++)
        for (let x = Math.floor(r.x / TILE); x < Math.ceil((r.x + r.w) / TILE); x++)
          expect(grid[y]?.[x] ?? T.WALL, `${a.id} covers (${x},${y})`).toBe(T.WALL);
    }
  });

  it('stands floor objects on their own tile: sprite bottom = tile bottom, centred on the tile', () => {
    for (const a of ANCHORS) {
      const r = anchorSpriteRect(a);
      expect(r.y + r.h).toBe((a.ty + 1) * TILE);
      expect(r.x + r.w / 2).toBe(a.tx * TILE + TILE / 2);
    }
  });
});
