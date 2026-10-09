import { useSyncExternalStore } from 'react';
import { store } from './engineStore';
import { ui, type UiStore } from './uiStore';

export function useEngineState() {
  return useSyncExternalStore((l) => store.subscribe(l), () => store.state);
}

export function useUi(): UiStore {
  useSyncExternalStore((l) => ui.subscribe(l), () => ui.version);
  return ui;
}
