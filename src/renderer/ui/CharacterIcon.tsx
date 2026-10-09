import { CHARACTER_SHEETS, type SpriteBase } from '../game/assets';

/** The first (front idle) frame of a character sheet, drawn at 2x with crisp pixels. */
export function CharacterIcon({ base, size = 48, tint }: { base: SpriteBase; size?: number; tint?: string | null }) {
  const scale = size / 32;
  return (
    <span className="char-icon" aria-hidden="true" style={{ width: size, height: size }}>
      <span style={{ backgroundImage: `url(${CHARACTER_SHEETS[base]})`, backgroundSize: `${256 * scale}px ${128 * scale}px`, width: size, height: size }} />
      {tint && <span className="char-tint" style={{ background: tint, width: size, height: size, WebkitMaskImage: `url(${CHARACTER_SHEETS[base]})`, maskImage: `url(${CHARACTER_SHEETS[base]})`, WebkitMaskSize: `${256 * scale}px ${128 * scale}px`, maskSize: `${256 * scale}px ${128 * scale}px` }} />}
    </span>
  );
}
