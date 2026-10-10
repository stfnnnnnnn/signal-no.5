// The other engine scenes as small rooms: the community shop, the street (in transit), the evacuation centre.
import { ROOMS } from '../rooms';
import { WorldScene, type WorldMap } from './WorldScene';

abstract class RoomScene extends WorldScene {
  protected abstract readonly room: keyof typeof ROOMS;
  protected buildMap(): WorldMap {
    const r = ROOMS[this.room];
    return { grid: r.grid, tilesetKey: `tiles_room_${this.room}`, wallIndex: 0, spawn: r.spawn, renderer: { indoor: r.indoor } };
  }
  protected populate() {
    for (const a of ROOMS[this.room].anchors) {
      this.add.image(a.tx * 16 + 8, a.ty * 16 + 8, `ph_${a.id}`).setDepth(a.ty * 16 + 8);
      this.addAnchor(a.id, a.tx, a.ty);
    }
  }
}

export class Shop extends RoomScene { protected readonly room = 'Shop' as const; constructor() { super('Shop'); } }
export class Street extends RoomScene { protected readonly room = 'Street' as const; constructor() { super('Street'); } }
export class Evacuation extends RoomScene { protected readonly room = 'Evacuation' as const; constructor() { super('Evacuation'); } }
