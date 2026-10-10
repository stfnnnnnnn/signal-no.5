import { useEffect, useState } from 'react';
import { getAiStatus, onAiStatus } from '../../services/ai';
import { listSaves, removeSave } from '../../services/persistence';
import { continueSaved } from '../../services/continueGame';
import { useApp } from '../../state/hooks';
import { ui } from '../../state/uiStore';
import logo from '../../assets/ui/logo.png';

export function Title() {
  const app = useApp();
  const [hasSave, setHasSave] = useState(false);
  const [ai, setAi] = useState(getAiStatus());
  useEffect(() => onAiStatus(setAi), []);
  useEffect(() => { let live = true; void listSaves().then((s) => { if (live) setHasSave(s.includes('auto')); }); return () => { live = false; }; }, []);

  const [badSave, setBadSave] = useState(false);
  const resume = async () => {
    const r = await continueSaved(app);
    if (r === 'missing') { setHasSave(false); ui.toast({ kind: 'error', title: 'There is no saved game to continue.' }); }
    if (r === 'invalid') setBadSave(true);
  };
  const deleteSave = async () => { await removeSave('auto'); setBadSave(false); setHasSave(false); };

  return (
    <main className="title-screen">
      <div className="rain" aria-hidden="true" />
      <div className="title-block">
        <h1><img className="title-logo" src={logo} alt="Signal No. 5" width={960} height={455} /></h1>
        <p className="tagline">A typhoon is coming. Get your household ready.</p>
      </div>
      <nav className="title-menu" aria-label="Main menu">
        <button onClick={() => app.go('mode')} autoFocus>New game</button>
        {hasSave && !badSave && <button onClick={() => void resume()}>Continue</button>}
        {badSave && (
          <div className="bad-save" role="alert">
            <p>This save can’t be loaded. It may be from an older version or damaged.</p>
            <button onClick={() => void deleteSave()}>Delete the save</button>
          </div>
        )}
        <button onClick={() => app.go('achievements')}>Achievements</button>
        <button onClick={() => app.go('settings')}>Settings</button>
        <button onClick={() => window.close()}>Exit</button>
      </nav>
      <p className={`title-ai ai-${ai}`}>
        {ai === 'ready' ? 'Local AI ready' : ai === 'unavailable' ? 'Local AI offline: the game uses reviewed text' : 'Local AI is starting…'}
      </p>
      <p className="fine">A fictional storm for learning. In a real emergency, follow official advisories.</p>
    </main>
  );
}
