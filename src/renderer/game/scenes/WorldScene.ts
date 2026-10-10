// Shared world behaviour: tilemap + wall collision, the player (4 directions, 90 px/s), interactable anchors,
// proximity prompt, E/Space to interact, directive rendering, routing to the scene the engine says we are in,
// and the ONE place that advances game time (store.tick).
import Phaser from 'phaser';
import { store } from '../../state/engineStore';
import { ui } from '../../state/uiStore';
import { interactWith } from '../../state/interactionController';
import { directives } from '../../state/directiveStore';
import { TILE, tileCenter } from '../layout';
import { nearestAnchor } from '../proximity';
import { acceptsInteractKey } from '../input';
import { phaserSceneFor, type WorldScene as WorldKey } from '../directive';
import { CHARACTER_FRAMES, charKey, type Dir, type SpriteBase } from '../assets';
import { tintFor } from '../palette';
import { SceneDirectiveRenderer, type RendererOptions } from '../systems/SceneDirectiveRenderer';
import { onSceneEnd } from '../sceneLifecycle';

const SPEED = 90;
type KeyName = 'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd';

export interface WorldMap { grid: number[][]; tilesetKey: string; wallIndex: number; spawn: { tx: number; ty: number }; renderer?: Partial<RendererOptions> }

export abstract class WorldScene extends Phaser.Scene {
  protected player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  protected objects!: Phaser.Physics.Arcade.StaticGroup;
  protected directiveView!: SceneDirectiveRenderer;
  private base: SpriteBase = 'boy';
  private facing: Dir = 'down';
  private keys!: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private anchorPoints: { id: string; x: number; y: number }[] = [];
  private readonly labels = new Map<string, string>();
  private leaving = false;

  constructor(key: WorldKey) { super(key); }

  protected abstract buildMap(): WorldMap;
  /** Interactables, NPCs, pets: called after the map, before the player. */
  protected abstract populate(): void;
  /** Called every frame after the player moved (NPC/pet animation). */
  protected tickWorld(_delta: number): void {}

  create() {
    this.leaving = false; this.anchorPoints = []; this.labels.clear();
    const m = this.buildMap();
    const map = this.make.tilemap({ data: m.grid, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage(m.tilesetKey, m.tilesetKey, TILE, TILE, 0, 0)!;
    const layer = map.createLayer(0, tiles, 0, 0)!;
    layer.setCollision([m.wallIndex]);
    const worldW = m.grid[0]!.length * TILE, worldH = m.grid.length * TILE;

    this.objects = this.physics.add.staticGroup();
    for (const i of store.engine.getWorldConfig().interactables) this.labels.set(i.id, i.label);
    this.populate();

    const playerCfg = store.engine.getWorldConfig().characters.find((c) => c.isPlayer);
    this.base = (playerCfg?.spriteBase ?? 'boy') as SpriteBase;
    this.makeAnims(this.base);
    const spawn = tileCenter(m.spawn.tx, m.spawn.ty);
    this.player = this.physics.add.sprite(spawn.x, spawn.y - 8, charKey(this.base), CHARACTER_FRAMES[this.base].idle.down[0]);
    this.player.body.setSize(12, 8).setOffset(10, 24);
    const tint = playerCfg ? tintFor(playerCfg.paletteId, store.engine.getProfile().appearance.clothingColor) : null;
    if (tint !== null) this.player.setTint(tint);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.player, this.objects);
    this.cameras.main.setBounds(0, 0, worldW, worldH).startFollow(this.player, true);

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as Record<KeyName, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-E', this.tryInteract, this);
    this.input.keyboard!.on('keydown-SPACE', this.tryInteract, this);

    this.directiveView = new SceneDirectiveRenderer(this, { worldW, worldH, ...m.renderer });
    const unsub = directives.subscribe(() => { if (directives.current) this.directiveView.apply(directives.current); });
    if (directives.current) { this.directiveView.enter(directives.current); this.directiveView.apply(directives.current); }

    onSceneEnd(this, () => {
      unsub();
      this.input.keyboard?.off('keydown-E', this.tryInteract, this);
      this.input.keyboard?.off('keydown-SPACE', this.tryInteract, this);
      ui.setPrompt(null);
    });
  }

  override update(_t: number, delta: number) {
    if (this.leaving) return;
    store.tick(delta);
    // Go wherever the engine says the household is (e.g. HOUSE -> STREET on departure; RESULTS is the React debrief).
    const target = store.state ? phaserSceneFor(store.state.scene) : null;
    if (target && target !== this.scene.key) { this.leaving = true; this.scene.start(target); return; }

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
    this.directiveView.follow(this.player.x, this.player.y);
    this.tickWorld(delta);

    const near = blocked ? null : this.nearest();
    ui.setPrompt(near ? `E  ${this.labels.get(near) ?? near}` : null);
  }

  /** Make a tile solid and interactable under `id` (sprites are drawn by the subclass). */
  protected addAnchor(id: string, tx: number, ty: number, label?: string) {
    const c = tileCenter(tx, ty);
    this.objects.add(this.add.zone(c.x, c.y, TILE, TILE));
    this.anchorPoints.push({ id, ...c });
    if (label) this.labels.set(id, label);
  }

  /** Interact by pixel position (for things that are not on the tile grid, e.g. NPCs). */
  protected addPoint(id: string, x: number, y: number, label: string) {
    this.anchorPoints.push({ id, x, y });
    this.labels.set(id, label);
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

  protected makeAnims(base: SpriteBase) {
    const f = CHARACTER_FRAMES[base];
    for (const kind of ['idle', 'walk'] as const) for (const dir of ['down', 'left', 'right', 'up'] as const) {
      const key = `${base}_${kind}_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(charKey(base), { frames: f[kind][dir] }), frameRate: kind === 'walk' ? 8 : 2, repeat: -1 });
    }
  }
}
