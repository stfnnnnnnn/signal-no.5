// Vite-imported asset URLs (bundled as files or data: URIs, so they load under the production CSP).
import boy from '../assets/sprites/boy.png';
import girl from '../assets/sprites/girl.png';
import mom from '../assets/sprites/mom.png';
import dad from '../assets/sprites/dad.png';
import characters from '../assets/sprites/characters.json';

export type SpriteBase = 'boy' | 'girl' | 'mom' | 'dad';
export type Dir = 'down' | 'left' | 'right' | 'up';
export const CHARACTER_SHEETS: Record<SpriteBase, string> = { boy, girl, mom, dad };
export const CHARACTER_FRAMES = characters as Record<SpriteBase, { idle: Record<Dir, number[]>; walk: Record<Dir, number[]> }>;

const fileName = (p: string) => p.split('/').pop()!.replace('.png', '');
const itemUrls = import.meta.glob('../assets/items/*.png', { eager: true, import: 'default' }) as Record<string, string>;
export const ITEM_URLS: Record<string, string> = Object.fromEntries(Object.entries(itemUrls).map(([p, url]) => [fileName(p), url]));

const badgeUrls = import.meta.glob('../assets/badges/*.png', { eager: true, import: 'default' }) as Record<string, string>;
/** Keyed by backend iconAssetId (e.g. badge_b06_bayanihan). */
export const ICON_URLS: Record<string, string> = Object.fromEntries(Object.entries(badgeUrls).map(([p, url]) => [fileName(p), url]));

export const charKey = (b: SpriteBase) => `char_${b}`;
export const itemKey = (name: string) => `item_${name}`;
