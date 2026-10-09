import { useState } from 'react';
import { store } from '../state/engineStore';
import { sliceHousehold, SLICE_SEED } from './sliceHousehold';
import { PhaserGame } from '../game/PhaserGame';

export function App() {
  const [ready] = useState(() => store.state !== null || store.newGame(sliceHousehold(), SLICE_SEED).ok);
  return ready ? <PhaserGame /> : <div className="boot">Could not start the game.</div>;
}
