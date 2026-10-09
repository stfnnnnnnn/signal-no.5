import { useUi } from '../state/hooks';

export function InteractionPrompt() {
  const ui = useUi();
  return ui.prompt ? <div className="prompt" role="status">{ui.prompt}</div> : null;
}
