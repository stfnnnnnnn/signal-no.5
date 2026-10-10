import { describe, expect, it } from 'vitest';
import { PropAnchor } from '../../src/shared/contracts/scene';
import { INTERACTABLES } from '../../src/core/content/interactables';
import { buildGrid, MAP_H, MAP_W, PROP_ANCHORS, T } from '../../src/renderer/game/layout';
import { ROOMS, type RoomLayout } from '../../src/renderer/game/rooms';

describe('house prop anchors', () => {
  it('places every PropAnchor inside the house map, on floor or wall', () => {
    const g = buildGrid();
    for (const a of PropAnchor.options) {
      const p = PROP_ANCHORS[a];
      expect(p, a).toBeDefined();
      expect(p.tx >= 0 && p.tx < MAP_W && p.ty >= 0 && p.ty < MAP_H, a).toBe(true);
      expect([T.WALL, T.KITCHEN, T.BEDROOM, T.UTILITY, T.LIVING, T.ENTRANCE]).toContain(g[p.ty]![p.tx]);
    }
  });
});

function reachableFrom(room: RoomLayout) {
  const seen = room.grid.map((r) => r.map(() => false));
  const solid = room.grid.map((r) => r.map((t) => t === 0));
  for (const a of room.anchors) solid[a.ty]![a.tx] = true;
  const q = [[room.spawn.tx, room.spawn.ty]]; seen[room.spawn.ty]![room.spawn.tx] = true;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x! + dx!, ny = y! + dy!;
      if (ny < 0 || ny >= room.grid.length || nx < 0 || nx >= room.grid[0]!.length || seen[ny]![nx] || solid[ny]![nx]) continue;
      seen[ny]![nx] = true; q.push([nx, ny]);
    }
  }
  return seen;
}

describe('shop, street and evacuation-centre rooms', () => {
  it('the shop has every SHOP interactable, each reachable from the spawn', () => {
    const shop = ROOMS.Shop;
    const ids = INTERACTABLES.filter((i) => i.scene === 'SHOP').map((i) => i.id).sort();
    expect(shop.anchors.map((a) => a.id).sort()).toEqual(ids);
    const seen = reachableFrom(shop);
    for (const a of shop.anchors) expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[a.ty + dy!]?.[a.tx + dx!]), a.id).toBe(true);
  });
  it('street and evacuation centre are closed rooms with a walkable spawn', () => {
    for (const room of [ROOMS.Street, ROOMS.Evacuation]) {
      const w = room.grid[0]!.length;
      expect(room.grid[0]!.every((t) => t === 0) && room.grid.at(-1)!.every((t) => t === 0)).toBe(true);
      expect(room.grid.every((r) => r.length === w && r[0] === 0 && r[w - 1] === 0)).toBe(true);
      expect(room.grid[room.spawn.ty]![room.spawn.tx]).not.toBe(0);
    }
  });
});
