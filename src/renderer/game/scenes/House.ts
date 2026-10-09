// The fixed house: tilemap + collision, the player (4 directions, 90 px/s), interactable objects,
// the proximity prompt, E/Space to interact, and the ONE place that advances game time (store.tick).
import Phaser from 'phaser';
import { store } from '../../state/engineStore';
import { ui } from '../../state/uiStore';
import { interactWith } from '../../state/interactionController';
import { ANCHORS, MAP_H, MAP_W, PLAYER_SPAWN, T, TILE, anchorSpriteRect, buildGrid, tileCenter } from '../layout';
import { nearestAnchor } from '../proximity';
import { acceptsInteractKey } from '../input';
import { CHARACTER_FRAMES, charKey, itemKey, type Dir, type SpriteBase } from '../assets';

const SPEED = 90;
type KeyName = 'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd';

export class House extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private base: SpriteBase = 'boy';
  private facing: Dir = 'down';
  private keys!: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private anchorPoints: { id: string; x: number; y: number }[] = [];
  private readonly labels = new Map<string, string>();

  constructor() { super('House'); }

  create() {
    const world = store.engine.getWorldConfig();
    const theme = world.theme === 'modern' ? 'modern' : 'traditional';
    const map = this.make.tilemap({ data: buildGrid(), tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage(`tiles_${theme}`, `tiles_${theme}`, TILE, TILE, 0, 0)!;
    const layer = map.createLayer(0, tiles, 0, 0)!;
    layer.setCollision([T.WALL]);

    const objects = this.physics.add.staticGroup();
    const present = new Set(world.interactables.map((i) => i.id));
    this.anchorPoints = []; this.labels.clear();
    for (const i of world.interactables) this.labels.set(i.id, i.label);
    for (const a of ANCHORS.filter((x) => present.has(x.id))) {
      const c = tileCenter(a.tx, a.ty);
      const r = anchorSpriteRect(a);
      this.add.image(r.x, r.y, a.sprite ? itemKey(a.sprite) : `ph_${a.id}`).setOrigin(0, 0).setDisplaySize(r.w, r.h).setDepth(c.y);
      // Collision is always exactly the anchor's tile, independent of how big the sprite is drawn.
      objects.add(this.add.zone(c.x, c.y, TILE, TILE));
      this.anchorPoints.push({ id: a.id, ...c });
    }

    const playerCfg = world.characters.find((c) => c.isPlayer);
    this.base = (playerCfg?.spriteBase ?? 'boy') as SpriteBase;
    this.makeAnims(this.base);
    const spawn = tileCenter(PLAYER_SPAWN.tx, PLAYER_SPAWN.ty);
    this.player = this.physics.add.sprite(spawn.x, spawn.y - 8, charKey(this.base), CHARACTER_FRAMES[this.base].idle.down[0]);
    this.player.body.setSize(12, 8).setOffset(10, 24);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.player, objects);

    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE).startFollow(this.player, true);
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as Record<KeyName, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-E', this.tryInteract, this);
    this.input.keyboard!.on('keydown-SPACE', this.tryInteract, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-E', this.tryInteract, this);
      this.input.keyboard?.off('keydown-SPACE', this.tryInteract, this);
      ui.setPrompt(null);
    });
  }

  override update(_t: number, delta: number) {
    store.tick(delta);
    const blocked = ui.isBlocking();
    let vx = 0, vy = 0;
    if (!blocked) {
      const k = this.keys;
      if (k.left.isDown || k.a.isDown) vx = -SPEED; else if (k.right.isDown || k.d.isDown) vx = SPEED;
      else if (k.up.isDown || k.w.isDown) vy = -SPEED; else if (k.down.isDown || k.s.isDown) vy = SPEED;
    }
    this.player.setVelocity(vx, vy);
    if (vx || vy) this.facing = vx < 0 ? 'left' : vx > 0 ? 'right' : vy < 0 ? 'up' : 'down';
    this.player.anims.play(`${this.base}_${vx || vy ? 'walk' : 'idle'}_${this.facing}`, true);
    this.player.setDepth(this.player.body.center.y);

    const near = blocked ? null : this.nearest();
    ui.setPrompt(near ? `E  ${this.labels.get(near) ?? near}` : null);
  }

  private nearest(): string | null {
    const c = this.player.body.center;
    return nearestAnchor(c.x, c.y, this.anchorPoints);
  }

  private tryInteract(event?: KeyboardEvent) {
    if (!acceptsInteractKey(event, ui.isBlocking())) return; // a held key must not re-fire interactions
    const id = this.nearest();
    if (id) interactWith(id, this.labels.get(id) ?? id);
  }

  private makeAnims(base: SpriteBase) {
    const f = CHARACTER_FRAMES[base];
    for (const kind of ['idle', 'walk'] as const) for (const dir of ['down', 'left', 'right', 'up'] as const) {
      const key = `${base}_${kind}_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(charKey(base), { frames: f[kind][dir] }), frameRate: kind === 'walk' ? 8 : 2, repeat: -1 });
    }
  }
}
