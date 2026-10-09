// Continue from the autosave slot; tells the title screen exactly what went wrong so it can offer a fix.
import type { AppStore } from '../state/appStore';
import { AUTO_SLOT } from './autosave';
import { readSave } from './persistence';

export async function continueSaved(app: AppStore): Promise<'ok' | 'missing' | 'invalid'> {
  const saved = await readSave(AUTO_SLOT);
  if (!saved) return 'missing';
  return app.continueFrom(saved).ok ? 'ok' : 'invalid';
}
