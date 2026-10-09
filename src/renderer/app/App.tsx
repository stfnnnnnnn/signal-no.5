import { useEffect } from 'react';
import { store } from '../state/engineStore';
import { ui } from '../state/uiStore';
import { useApp } from '../state/hooks';
import { bindFocusPause } from '../state/focusPause';
import { GameScreen } from './GameScreen';
import { Title } from '../ui/screens/Title';
import { ModeSelect } from '../ui/onboarding/ModeSelect';
import { OnboardingFlow } from '../ui/onboarding/OnboardingFlow';
import { Customize } from '../ui/onboarding/Customize';
import { AchievementsScreen } from '../ui/achievements/AchievementsScreen';
import { Settings } from '../ui/screens/Settings';
import { Debrief } from '../ui/debrief/Debrief';
import { Toasts } from '../ui/Toasts';
import { badgeToasts } from '../ui/badgeToasts';

export function App() {
  const app = useApp();
  // Returning the unsubscribe keeps exactly one listener under StrictMode's mount/unmount/mount.
  useEffect(() => store.onEvents((events) => {
    for (const t of badgeToasts(events, store.engine.getBadgeCatalog())) ui.toast(t);
  }), []);
  useEffect(() => bindFocusPause(window), []);

  return (<>
    {app.screen === 'title' && <Title />}
    {app.screen === 'mode' && <ModeSelect />}
    {(app.screen === 'custom' || app.screen === 'random') && <OnboardingFlow key={app.screen} path={app.screen} />}
    {app.screen === 'customize' && app.setup && <Customize key={app.setup.seed} />}
    {app.screen === 'game' && <GameScreen key={app.runKey} />}
    {app.screen === 'debrief' && <Debrief key={app.runKey} />}
    {app.screen === 'achievements' && <AchievementsScreen />}
    {app.screen === 'settings' && <Settings />}
    <Toasts />
  </>);
}
