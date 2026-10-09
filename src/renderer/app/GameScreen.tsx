import { useEffect, useRef } from 'react';
import { PhaserGame } from '../game/PhaserGame';
import { store } from '../state/engineStore';
import { useApp, useEngineState, useUi } from '../state/hooks';
import { openPanel } from '../state/interactionController';
import { ui } from '../state/uiStore';
import { canContinue, newWellbeingEvents, stepSpeed } from '../ui/hud/hudModel';
import { Hud } from '../ui/Hud';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { InteractionMenu } from '../ui/InteractionMenu';
import { DiscoveryCard } from '../ui/DiscoveryCard';
import { EventDialog } from '../ui/EventDialog';
import { Panels } from '../ui/Panels';
import { useAutosave } from './useAutosave';

/** The playing screen: the Phaser world plus the React overlays. Remounted per run (key = runKey). */
export function GameScreen() {
  const app = useApp();
  const s = useEngineState();
  const overlay = useUi().overlay.kind;
  const seenWellbeing = useRef(store.state?.player.wellbeingEvents.length ?? 0);
  const save = useAutosave();

  useEffect(() => store.onEvents((events) => {
    if (events.some((e) => e.type === 'runCompleted')) app.go('debrief');
    if (events.some((e) => e.type === 'speedChanged' && e.reason === 'critical')) ui.toast({ kind: 'info', title: 'Time slowed to 1× for an important update' });
  }), [app]);
  useEffect(() => { if (s?.completed) app.go('debrief'); }, [app, s?.completed]);

  // One notice per wellbeing change, with the engine's reason (never computed here).
  useEffect(() => store.subscribe(() => {
    const st = store.state;
    if (!st) return;
    for (const w of newWellbeingEvents(seenWellbeing.current, st)) ui.toast({ kind: w.delta < 0 ? 'error' : 'info', title: `Wellbeing ${w.delta > 0 ? '+' : ''}${w.delta}`, body: w.reason });
    seenWellbeing.current = st.player.wellbeingEvents.length;
  }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || ui.isBlocking()) return;
      if (e.key === 'i' || e.key === 'I') openPanel('inventory');
      if (e.key === 'o' || e.key === 'O') openPanel('objectives');
      if ((e.key === ']' || e.key === '[') && store.state) {
        const next = stepSpeed(store.state.clock.timeScale, e.key === ']' ? 1 : -1);
        store.dispatch((en) => en.setSpeed(next));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const skip = () => {
    const r = store.dispatch((e) => e.skipToNextMilestone());
    if (!r.ok) ui.toast({ kind: 'error', title: r.error.message });
  };

  return (<>
    <PhaserGame />
    <Hud onSave={save} /><InteractionPrompt /><InteractionMenu /><DiscoveryCard /><Panels /><EventDialog />
    {s && canContinue(s) && overlay === 'none' && (
      <button className="continue" onClick={skip}>Continue to the next update</button>
    )}
  </>);
}
