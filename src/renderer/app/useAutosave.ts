import { useEffect, useMemo } from 'react';
import { createAutosaver } from '../services/autosave';
import { writeSave } from '../services/persistence';
import { store } from '../state/engineStore';

/** Autosave on phase changes while the game screen is up; returns the manual "Save" action. */
export function useAutosave() {
  const saver = useMemo(() => createAutosaver(writeSave), []);
  useEffect(() => store.onEvents((events) => { void saver.onEvents(events); }), [saver]);
  return () => { void saver.saveNow(); };
}
