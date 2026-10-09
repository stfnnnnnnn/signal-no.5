import { useState } from 'react';
import { store } from '../state/engineStore';
import { sliceHousehold, SLICE_SEED } from './sliceHousehold';
import { PhaserGame } from '../game/PhaserGame';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { InteractionMenu } from '../ui/InteractionMenu';
import { DiscoveryCard } from '../ui/DiscoveryCard';

export function App() {
  const [ready] = useState(() => store.state !== null || store.newGame(sliceHousehold(), SLICE_SEED).ok);
  if (!ready) return <div className="boot">Could not start the game.</div>;
  return (<>
    <PhaserGame />
    <InteractionPrompt /><InteractionMenu /><DiscoveryCard />
  </>);
}
