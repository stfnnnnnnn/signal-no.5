// Blueprint §7: game time stops while the window is unfocused. Returns the unbind function.
import { store } from './engineStore';

export function bindFocusPause(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>): () => void {
  const onBlur = () => { if (store.state) store.dispatch((e) => e.pause('focusLost')); };
  const onFocus = () => { if (store.state?.clock.pauseReasons.includes('focusLost')) store.dispatch((e) => e.resume('focusLost')); };
  target.addEventListener('blur', onBlur);
  target.addEventListener('focus', onFocus);
  return () => { target.removeEventListener('blur', onBlur); target.removeEventListener('focus', onFocus); };
}
