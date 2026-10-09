// The fixed house (house_fixed_v1): interactable objects, household NPCs, pets and prop anchors.
// Movement, collision, interaction, time and directive rendering come from WorldScene.
import { store } from '../../state/engineStore';
import { directives } from '../../state/directiveStore';
import { ANCHORS, PLAYER_SPAWN, PROP_ANCHORS, T, anchorSpriteRect, buildGrid, tileCenter } from '../layout';
import { itemKey } from '../assets';
import { NpcSystem } from '../systems/NpcSystem';
import { WorldScene, type WorldMap } from './WorldScene';

export class House extends WorldScene {
  private npcs!: NpcSystem;
  private lastCues = '';

  constructor() { super('House'); }

  protected buildMap(): WorldMap {
    const theme = store.engine.getWorldConfig().theme === 'modern' ? 'modern' : 'traditional';
    const win = tileCenter(PROP_ANCHORS.WINDOW.tx, PROP_ANCHORS.WINDOW.ty);
    return { grid: buildGrid(), tilesetKey: `tiles_${theme}`, wallIndex: T.WALL, spawn: PLAYER_SPAWN, renderer: { propAnchors: PROP_ANCHORS, dripAt: { x: win.x, y: win.y - 10 } } };
  }

  protected populate() {
    const world = store.engine.getWorldConfig();
    const present = new Set(world.interactables.map((i) => i.id));
    for (const a of ANCHORS.filter((x) => present.has(x.id))) {
      const c = tileCenter(a.tx, a.ty);
      const r = anchorSpriteRect(a);
      this.add.image(r.x, r.y, a.sprite ? itemKey(a.sprite) : `ph_${a.id}`).setOrigin(0, 0).setDisplaySize(r.w, r.h).setDepth(c.y);
      this.addAnchor(a.id, a.tx, a.ty); // collision is exactly the anchor's tile
    }
    this.npcs = new NpcSystem(this);
    const pet = ANCHORS.find((a) => a.id === 'PET_AREA' && present.has(a.id)) ?? null;
    this.npcs.build(world.characters, store.engine.getProfile().appearance.clothingColor, world.pets, pet,
      (id, x, y) => this.addPoint(id, x, y, 'Household member'), (b) => this.makeAnims(b));
    this.lastCues = '';
  }

  protected override tickWorld() {
    const cues = directives.current?.npcCues ?? [];
    const key = JSON.stringify(cues);
    if (key !== this.lastCues) { this.lastCues = key; this.npcs.applyCues(cues); }
  }
}
