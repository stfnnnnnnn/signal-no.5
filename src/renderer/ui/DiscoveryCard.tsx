import { useUi } from '../state/hooks';
import { closeMenu } from '../state/interactionController';

export function DiscoveryCard() {
  const ui = useUi();
  const o = ui.overlay;
  if (o.kind !== 'discovery') return null;
  return (
    <div className="panel menu" role="dialog" aria-label={o.title}>
      <h2>{o.title}</h2>
      {o.lines.map((l, i) => <p key={i}>{l}</p>)}
      <button className="ghost" onClick={closeMenu} autoFocus>OK</button>
    </div>
  );
}
