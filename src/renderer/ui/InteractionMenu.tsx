import { useEffect } from 'react';
import { useUi } from '../state/hooks';
import { closeMenu, runMenuAction } from '../state/interactionController';

export function InteractionMenu() {
  const ui = useUi();
  const o = ui.overlay;
  useEffect(() => {
    if (o.kind === 'none') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [o.kind]);
  if (o.kind !== 'menu') return null;
  return (
    <div className="panel menu" role="dialog" aria-label={o.label}>
      <h2>{o.label}</h2>
      <ul>
        {o.actions.map((a, i) => (
          <li key={a.actionId}>
            <button disabled={!a.available} onClick={() => runMenuAction(a)} title={a.reasons.join(' ')} autoFocus={i === o.actions.findIndex((x) => x.available)}>
              <span>{a.unsafe && <span className="unsafe" aria-label="unsafe">⚠ </span>}{a.label}</span>
              <span className="cost">{a.kind === 'discovery' ? 'free' : `${a.timeCostMinutes} min`}</span>
            </button>
            {!a.available && a.reasons.length > 0 && <p className="reason">{a.reasons.join(' ')}</p>}
          </li>
        ))}
      </ul>
      <button className="ghost" onClick={closeMenu}>Close (Esc)</button>
    </div>
  );
}
