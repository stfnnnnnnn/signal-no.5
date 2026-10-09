import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { House } from './scenes/House';
import { Evacuation, Shop, Street } from './scenes/Rooms';

export const BASE_W = 384;
export const BASE_H = 216;

export function makeConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: BASE_W, height: BASE_H, backgroundColor: '#10141f',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: false } },
    // Production CSP: no blob: images, no XHR (connect-src 'none'), no WebAudio needed yet.
    loader: { imageLoadType: 'HTMLImageElement' },
    audio: { disableWebAudio: true, noAudio: true },
    input: { keyboard: { target: window } },
    scene: [Boot, House, Shop, Street, Evacuation],
  };
}
