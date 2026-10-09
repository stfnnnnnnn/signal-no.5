import { useEffect } from 'react';
import { ICON_URLS } from '../game/assets';
import { useUi } from '../state/hooks';

export function Toasts() {
  const ui = useUi();
  useEffect(() => {
    const timers = ui.toasts.map((t) => setTimeout(() => ui.dismiss(t.id), t.kind === 'badge' ? 6000 : 3500));
    return () => timers.forEach(clearTimeout);
  }, [ui, ui.toasts]);
  return (
    <div className="toasts" aria-live="polite">
      {ui.toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.icon && ICON_URLS[t.icon] && <img src={ICON_URLS[t.icon]} alt="" width={48} height={48} />}
          <div><strong>{t.title}</strong>{t.body && <p>{t.body}</p>}</div>
        </div>
      ))}
    </div>
  );
}
