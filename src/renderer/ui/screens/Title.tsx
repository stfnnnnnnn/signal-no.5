import { useEffect, useState } from 'react';
import { getAiStatus, onAiStatus } from '../../services/ai';
import { listSaves, readSave } from '../../services/persistence';
import { useApp } from '../../state/hooks';
import { ui } from '../../state/uiStore';

/** The storm-signal "5" drawn as a pixel grid (5 columns x 7 rows). */
const FIVE = ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'];

export function Title() {
  const app = useApp();
  const [hasSave, setHasSave] = useState(false);
  const [ai, setAi] = useState(getAiStatus());
  useEffect(() => onAiStatus(setAi), []);
  useEffect(() => { let live = true; void listSaves().then((s) => { if (live) setHasSave(s.includes('auto')); }); return () => { live = false; }; }, []);

  const resume = async () => {
    const saved = await readSave('auto');
    const r = saved ? app.continueFrom(saved) : { ok: false as const };
    if (!r.ok) ui.toast({ kind: 'error', title: 'This save can’t be loaded.', body: 'Start a new game; the old save stays until you overwrite it.' });
  };

  return (
    <main className="title-screen">
      <div className="rain" aria-hidden="true" />
      <div className="title-block">
        <div className="signal-five" aria-hidden="true">
          {FIVE.map((row, y) => row.split('').map((c, x) => <i key={`${x}-${y}`} className={c === '#' ? 'on' : ''} />))}
        </div>
        <div>
          <h1>Signal No. 5</h1>
          <p className="tagline">A typhoon is coming. Get your household ready.</p>
        </div>
      </div>
      <nav className="title-menu" aria-label="Main menu">
        <button onClick={() => app.go('mode')} autoFocus>New game</button>
        {hasSave && <button onClick={() => void resume()}>Continue</button>}
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
