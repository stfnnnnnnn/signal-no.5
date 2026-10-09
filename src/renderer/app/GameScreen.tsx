import { useEffect } from 'react';
import { PhaserGame } from '../game/PhaserGame';
import { store } from '../state/engineStore';
import { useApp, useEngineState } from '../state/hooks';
import { ui } from '../state/uiStore';
import { canContinue } from '../ui/hud/hudModel';
import { Hud } from '../ui/Hud';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { InteractionMenu } from '../ui/InteractionMenu';
import { DiscoveryCard } from '../ui/DiscoveryCard';
import { EventDialog } from '../ui/EventDialog';

/** The playing screen: the Phaser world plus the React overlays. Remounted per run (key = runKey). */
export function GameScreen() {
  const app = useApp();
  const s = useEngineState();
  useEffect(() => store.onEvents((events) => { if (events.some((e) => e.type === 'runCompleted')) app.go('debrief'); }), [app]);
  useEffect(() => { if (s?.completed) app.go('debrief'); }, [app, s?.completed]);

  const skip = () => {
    const r = store.dispatch((e) => e.skipToNextMilestone());
    if (!r.ok) ui.toast({ kind: 'error', title: r.error.message });
  };

  return (<>
    <PhaserGame />
    <Hud /><InteractionPrompt /><InteractionMenu /><DiscoveryCard /><EventDialog />
    {s && canContinue(s) && ui.overlay.kind === 'none' && (
      <button className="continue" onClick={skip}>Continue to the next update</button>
    )}
  </>);
}
