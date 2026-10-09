import { memo, useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { makeConfig } from './config';

/** Mounts one Phaser game for the lifetime of the component (StrictMode-safe: destroy on cleanup). */
export const PhaserGame = memo(function PhaserGame() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const game = new Phaser.Game(makeConfig(host.current!));
    return () => game.destroy(true);
  }, []);
  return <div ref={host} className="world" />;
});
