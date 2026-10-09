import { PhaserGame } from '../game/PhaserGame';
import { Hud } from '../ui/Hud';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { InteractionMenu } from '../ui/InteractionMenu';
import { DiscoveryCard } from '../ui/DiscoveryCard';
import { EventDialog } from '../ui/EventDialog';

/** The playing screen: the Phaser world plus the React overlays. Remounted per run (key = runKey). */
export function GameScreen() {
  return (<>
    <PhaserGame />
    <Hud /><InteractionPrompt /><InteractionMenu /><DiscoveryCard /><EventDialog />
  </>);
}
