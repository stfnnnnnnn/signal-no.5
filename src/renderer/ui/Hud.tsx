import { useEffect, useState } from 'react';
import { getAiStatus, onAiStatus } from '../services/ai';
import { useEngineState } from '../state/hooks';
import { formatClock } from './format';

export function Hud() {
  const s = useEngineState();
  const [ai, setAi] = useState(getAiStatus());
  useEffect(() => onAiStatus(setAi), []);
  if (!s) return null;
  return (
    <div className="hud">
      <span>{formatClock(s.clock.gameMinutes)}</span>
      <span className="phase">{s.phase}</span>
      <span>Wellbeing {s.player.wellbeing.current}/{s.player.wellbeing.max}</span>
      <span className={`ai ai-${ai}`}>{ai === 'unavailable' ? 'AI offline: using reviewed text' : `AI ${ai}`}</span>
    </div>
  );
}
