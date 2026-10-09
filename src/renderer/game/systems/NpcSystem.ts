// Household members (up to 3 visible NPCs), dependents and pets in the house. NPCs show the directive's
// animation/emotion cues; only visible NPCs are interactable (by npcId); there is no neighbour character.
import Phaser from 'phaser';
import type { NpcCue } from '../../../shared/contracts/scene';
import { CHARACTER_FRAMES, charKey, type SpriteBase } from '../assets';
import { NPC_SPAWNS, tileCenter } from '../layout';
import { tintFor } from '../palette';
import { EMOTION_TEXTURE } from '../textures';

interface Character { memberId: string; spriteBase: string; paletteId: string; isPlayer: boolean; visibleNpc: boolean; npcId: string | null; dependent: boolean }
interface Npc { id: string; base: SpriteBase; sprite: Phaser.GameObjects.Sprite; bubble: Phaser.GameObjects.Image; home: { x: number; y: number }; tween: Phaser.Tweens.Tween | null; cue: string }

export class NpcSystem {
  private readonly npcs: Npc[] = [];
  private readonly pets: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Places NPCs; `register` makes each one solid and interactable. */
  build(characters: Character[], clothingColor: string | null, petTypes: string[], petTile: { tx: number; ty: number } | null,
    register: (id: string, x: number, y: number) => void, makeAnims: (b: SpriteBase) => void) {
    const visible = characters.filter((c) => c.visibleNpc && c.npcId && !c.isPlayer).slice(0, NPC_SPAWNS.length);
    visible.forEach((c, i) => {
      const base = c.spriteBase as SpriteBase;
      makeAnims(base);
      const home = tileCenter(NPC_SPAWNS[i]!.tx, NPC_SPAWNS[i]!.ty);
      const sprite = this.scene.add.sprite(home.x, home.y - 8, charKey(base), CHARACTER_FRAMES[base].idle.down[0]).setDepth(home.y);
      const tint = tintFor(c.paletteId, clothingColor);
      if (tint !== null) sprite.setTint(tint);
      sprite.anims.play(`${base}_idle_down`, true);
      const bubble = this.scene.add.image(home.x + 7, home.y - 26, EMOTION_TEXTURE('calm')).setDepth(950).setVisible(false);
      register(c.npcId!, home.x, home.y);
      this.npcs.push({ id: c.npcId!, base, sprite, bubble, home, tween: null, cue: '' });
    });
    // Little ones are carried/minded by an adult: drawn small beside the first adult, never interactable.
    const dependents = characters.filter((c) => c.dependent);
    dependents.forEach((c, i) => {
      const anchor = this.npcs[0]?.home ?? tileCenter(NPC_SPAWNS[0]!.tx, NPC_SPAWNS[0]!.ty);
      const base = c.spriteBase as SpriteBase;
      this.scene.add.sprite(anchor.x + 12 + i * 8, anchor.y - 2, charKey(base), CHARACTER_FRAMES[base].idle.down[0]).setScale(0.6).setDepth(anchor.y + 1);
    });
    if (petTile) petTypes.forEach((t, i) => {
      const p = tileCenter(petTile.tx - 1 - i, petTile.ty + 1);
      const key = ['dog', 'cat', 'bird'].includes(t) ? `pet_${t}` : 'pet_other';
      const img = this.scene.add.image(p.x, p.y, key).setDepth(p.y);
      this.scene.tweens.add({ targets: img, y: p.y - 1, duration: 600 + i * 90, yoyo: true, repeat: -1 });
      this.pets.push(img);
    });
  }

  /** Apply the directive's cues for NPCs that are present (others are ignored). */
  applyCues(cues: NpcCue[]) {
    for (const n of this.npcs) {
      const c = cues.find((x) => x.npcId === n.id);
      const key = c ? `${c.animation}|${c.emotion}` : '';
      if (key === n.cue) continue;
      n.cue = key;
      n.tween?.remove(); n.tween = null;
      n.sprite.setPosition(n.home.x, n.home.y - 8).setAngle(0).setScale(1);
      n.bubble.setVisible(!!c);
      if (!c) { n.sprite.anims.play(`${n.base}_idle_down`, true); continue; }
      n.bubble.setTexture(EMOTION_TEXTURE(c.emotion)).setPosition(n.home.x + 7, n.home.y - 26);
      const s = this.scene;
      switch (c.animation) {
        case 'pacing':
          n.sprite.anims.play(`${n.base}_walk_right`, true);
          n.tween = s.tweens.add({ targets: [n.sprite, n.bubble], x: `+=12`, duration: 900, yoyo: true, repeat: -1, onYoyo: () => n.sprite.anims.play(`${n.base}_walk_left`, true), onRepeat: () => n.sprite.anims.play(`${n.base}_walk_right`, true) });
          break;
        case 'packing': case 'cleaning': case 'waving':
          n.sprite.anims.play(`${n.base}_idle_down`, true);
          n.tween = s.tweens.add({ targets: n.sprite, y: n.home.y - 10, duration: c.animation === 'waving' ? 250 : 450, yoyo: true, repeat: -1 });
          break;
        case 'lookingOutWindow': n.sprite.anims.play(`${n.base}_idle_up`, true); break;
        case 'sitting': n.sprite.anims.play(`${n.base}_idle_down`, true); n.sprite.setPosition(n.home.x, n.home.y - 5).setScale(1, 0.9); break;
        case 'huddled': n.sprite.anims.play(`${n.base}_idle_down`, true); n.sprite.setScale(0.92); break;
        case 'sleeping': n.sprite.anims.stop(); n.sprite.setAngle(90).setPosition(n.home.x, n.home.y - 2); break;
        default: n.sprite.anims.play(`${n.base}_idle_down`, true);
      }
    }
  }
}
