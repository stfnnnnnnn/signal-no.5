// Draws a SceneDirective: lighting, rain, wind debris, flood water, effects, props and transitions.
// apply() only touches what changed; one-shot effects (lightning) fire only when newly added.
import Phaser from 'phaser';
import type { PropAnchor, SceneDirective } from '../../../shared/contracts/scene';
import { addedEffects, directiveChanged } from '../directive';
import { TILE } from '../layout';
import { PROP_TEXTURE } from '../textures';
import { floodAlpha, lightingLook, rainRate, windDrift } from '../visuals';
import { audio } from './AudioDirector';

export interface RendererOptions { worldW: number; worldH: number; propAnchors?: Partial<Record<PropAnchor, { tx: number; ty: number }>>; dripAt?: { x: number; y: number } }

export class SceneDirectiveRenderer {
  private current: SceneDirective | null = null;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly water: Phaser.GameObjects.TileSprite;
  private readonly rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly drips: Phaser.GameObjects.Particles.ParticleEmitter | null;
  private readonly motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly mist: Phaser.GameObjects.Rectangle;
  private readonly props = new Map<PropAnchor, Phaser.GameObjects.Image>();
  private flicker: Phaser.Tweens.Tween | null = null;
  private ripple: Phaser.Tweens.Tween | null = null;
  private readonly debrisPieces: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly o: RendererOptions) {
    const cam = scene.cameras.main;
    this.water = scene.add.tileSprite(0, 0, o.worldW, o.worldH, 'fx_water').setOrigin(0, 0).setDepth(1).setAlpha(0);
    this.mist = scene.add.rectangle(0, 0, cam.width, cam.height, 0xdfe8f0, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(899);
    this.shade = scene.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(900);
    this.glow = scene.add.image(0, 0, 'fx_glow').setDepth(901).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setScale(1.6);
    this.rain = scene.add.particles(0, -8, 'fx_rain', {
      x: { min: -40, max: cam.width + 40 }, lifespan: 900, speedY: { min: 260, max: 320 }, alpha: { start: 0.7, end: 0.2 }, emitting: false,
    }).setScrollFactor(0).setDepth(902);
    this.debris = scene.add.particles(-10, 0, 'fx_leaf', {
      y: { min: 0, max: cam.height }, lifespan: 4000, speedY: { min: -10, max: 25 }, rotate: { min: 0, max: 360 }, emitting: false,
    }).setScrollFactor(0).setDepth(902);
    this.motes = scene.add.particles(0, 0, 'fx_mote', {
      x: { min: 0, max: cam.width }, y: { min: 0, max: cam.height }, lifespan: 3000, speedY: { min: -6, max: 6 }, speedX: { min: -6, max: 6 }, alpha: { start: 0.8, end: 0 }, emitting: false,
    }).setScrollFactor(0).setDepth(898);
    this.drips = o.dripAt ? scene.add.particles(o.dripAt.x, o.dripAt.y, 'fx_drip', { x: { min: -6, max: 6 }, lifespan: 500, speedY: 60, frequency: 220, emitting: false }).setDepth(30) : null;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.flicker?.remove(); this.ripple?.remove(); });
  }

  /** Called every frame: keeps the flashlight glow on the player. */
  follow(x: number, y: number) { if (this.glow.visible) this.glow.setPosition(x, y); }

  apply(d: SceneDirective) {
    if (!directiveChanged(this.current, d)) return;
    const prev = this.current;
    this.current = d;

    // Lighting (outage presets never show electric light: no flicker, dark shade; flashlight = a carried glow).
    const look = lightingLook(d.lighting);
    this.shade.setFillStyle(look.color, look.alpha);
    this.glow.setVisible(look.flashlight);

    // Rain and wind.
    const rate = rainRate(d.weather.rain), drift = windDrift(d.weather.wind);
    this.rain.speedX = drift;
    if (rate > 0) { this.rain.frequency = 1000 / rate; this.rain.quantity = 1; this.rain.start(); } else this.rain.stop();
    const fx = new Set(d.effects);
    if (fx.has('WIND_DEBRIS') || fx.has('TREE_SWAY')) { this.debris.speedX = { min: 40 + drift, max: 80 + drift } as never; this.debris.frequency = 400; this.debris.start(); } else this.debris.stop();

    // Flood water over the floor (never over the player, who is drawn above it).
    this.water.setAlpha(floodAlpha(d.flood));
    this.ripple?.remove(); this.ripple = null;
    if (d.flood !== 'none' && (fx.has('FLOOD_RIPPLES') || fx.has('PUDDLES'))) {
      this.ripple = this.scene.tweens.add({ targets: this.water, tilePositionX: 16, duration: 1600, repeat: -1 });
    }

    // Other effects.
    if (this.drips) { if (fx.has('WINDOW_DRIPS')) this.drips.start(); else this.drips.stop(); }
    this.mist.setAlpha(fx.has('MIST') ? 0.12 : 0);
    if (fx.has('DUST_MOTES') || fx.has('SUNBEAMS')) { this.motes.frequency = fx.has('SUNBEAMS') ? 120 : 400; this.motes.start(); } else this.motes.stop();
    this.flicker?.remove(); this.flicker = null;
    if (fx.has('FLICKERING_LIGHTS') && look.electric) {
      this.flicker = this.scene.tweens.add({ targets: this.shade, alpha: { from: look.alpha, to: Math.min(0.85, look.alpha + 0.2) }, duration: 120, yoyo: true, repeat: -1, repeatDelay: 900 });
    }
    this.setDebris(fx.has('DEBRIS_AFTERMATH'));
    for (const e of addedEffects(prev, d)) if (e === 'LIGHTNING_FLASH') { this.scene.cameras.main.flash(160, 230, 240, 255); audio.oneShot('sfx_thunder'); }

    // Props at their anchors (visual only).
    if (this.o.propAnchors) for (const p of d.props) this.setProp(p.anchor, PROP_TEXTURE[p.variant] ?? null);

    audio.ambient(d.audio);
    document.documentElement.dataset.mood = d.mood;
  }

  /** Scene entry transition from the directive (only when the scene starts). */
  enter(d: SceneDirective) {
    const cam = this.scene.cameras.main;
    if (d.transition === 'fade') cam.fadeIn(450, 16, 20, 31);
    else if (d.transition === 'rainWipe') cam.fadeIn(700, 40, 70, 110);
    else if (d.transition === 'flashToBlack') { cam.flash(120, 255, 255, 255); cam.fadeIn(600, 0, 0, 0); }
  }

  private setProp(anchor: PropAnchor, texture: string | null) {
    const pos = this.o.propAnchors?.[anchor];
    if (!pos) return;
    let img = this.props.get(anchor);
    if (!texture) { img?.setVisible(false); return; }
    const x = pos.tx * TILE + TILE / 2, y = pos.ty * TILE + TILE / 2;
    if (!img) { img = this.scene.add.image(x, y, texture).setDepth(y + 1); this.props.set(anchor, img); }
    img.setTexture(texture).setVisible(true);
    if (anchor === 'GO_BAG_SPOT') img.setPosition(x + 6, y - 7).setDepth(y + 2); // a small status badge on the go-bag
  }

  private setDebris(on: boolean) {
    if (on && this.debrisPieces.length === 0) {
      const rnd = new Phaser.Math.RandomDataGenerator(['aftermath']);
      for (let i = 0; i < 14; i++) this.debrisPieces.push(this.scene.add.image(rnd.between(24, this.o.worldW - 24), rnd.between(24, this.o.worldH - 24), 'fx_debris').setDepth(2).setAngle(rnd.between(0, 180)));
    }
    for (const p of this.debrisPieces) p.setVisible(on);
  }
}
