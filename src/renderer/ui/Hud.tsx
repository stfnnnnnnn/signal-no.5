import { useEffect, useState } from 'react';
import { TIME_SCALES } from '../../shared/contracts/ids';
import { getAiStatus, onAiStatus } from '../services/ai';
import { store } from '../state/engineStore';
import { useThrottledEngineState } from '../state/hooks';
import { openPanel } from '../state/interactionController';
import { ui } from '../state/uiStore';
import { hudModel } from './hud/hudModel';

export function Hud({ onSave }: { onSave?: () => void }) {
  const s = useThrottledEngineState();
  const [ai, setAi] = useState(getAiStatus());
  useEffect(() => onAiStatus(setAi), []);
  if (!s) return null;
  const h = hudModel(s, store.engine.getGoBagStatus());
  const setSpeed = (x: number) => { const r = store.dispatch((e) => e.setSpeed(x)); if (!r.ok) ui.toast({ kind: 'error', title: r.error.message }); };
  return (
    <header className="hud">
      <div className="hud-row">
        <span className="clock">{h.clock}</span>
        <span className="phase">{h.phase}</span>
        {h.countdownHours !== null && <span className="countdown">Landfall in about {h.countdownHours} h</span>}
        <div className="speeds" role="group" aria-label="Game speed">
          {TIME_SCALES.map((x) => (
            <button key={x} className={x === h.speed ? 'speed on' : 'speed'} aria-pressed={x === h.speed} onClick={() => setSpeed(x)}>{x}×</button>
          ))}
        </div>
        {h.paused && <span className="paused">Paused</span>}
        <span className={`ai ai-${ai}`}>{ai === 'unavailable' ? 'AI offline: reviewed text' : `AI ${ai}`}</span>
      </div>
      <div className="hud-row">
        <span className={`wellbeing band-${h.wellbeing.band}`} title="Your character's wellbeing (fictional gameplay indicator)">
          Wellbeing <meter min={0} max={h.wellbeing.max} low={50} high={85} optimum={100} value={h.wellbeing.current} /> {h.wellbeing.current}/{h.wellbeing.max}
        </span>
        <span>₱{h.cash.toLocaleString()}</span>
        <span>Phone {h.phone}%</span>
        <span>{h.goBag}</span>
        <button className="hud-btn" onClick={() => openPanel('inventory')}>Supplies (I)</button>
        <button className="hud-btn" onClick={() => openPanel('objectives')}>Checklist (O)</button>
        {onSave && <button className="hud-btn" onClick={onSave}>Save</button>}
      </div>
      {h.warnings.length > 0 && <div className="warnings" role="status">{h.warnings.map((w) => <span key={w}>{w}</span>)}</div>}
    </header>
  );
}
