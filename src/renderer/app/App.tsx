import { useEffect, useState } from 'react';
import { store } from '../state/engineStore';
import { ui } from '../state/uiStore';
import { PhaserGame } from '../game/PhaserGame';
import { Hud } from '../ui/Hud';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { InteractionMenu } from '../ui/InteractionMenu';
import { DiscoveryCard } from '../ui/DiscoveryCard';
import { EventDialog } from '../ui/EventDialog';
import { Toasts } from '../ui/Toasts';
import { badgeToasts } from '../ui/badgeToasts';
import { sliceHousehold, SLICE_SEED } from './sliceHousehold';

export function App() {
  const [ready] = useState(() => store.state !== null || store.newGame(sliceHousehold(), SLICE_SEED).ok);
  // Returning the unsubscribe keeps exactly one listener under StrictMode's mount/unmount/mount.
  useEffect(() => store.onEvents((events) => {
    for (const t of badgeToasts(events, store.engine.getBadgeCatalog())) ui.toast(t);
  }), []);
  if (!ready) return <div className="boot">Could not start the game.</div>;
  return (<>
    <PhaserGame />
    <Hud /><InteractionPrompt /><InteractionMenu /><DiscoveryCard /><EventDialog /><Toasts />
  </>);
}
