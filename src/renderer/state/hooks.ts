import { useSyncExternalStore } from 'react';
import { store } from './engineStore';
import { ui, type UiStore } from './uiStore';

// The same getter serves as the server snapshot, so components also render with react-dom/server (tests).
const getState = () => store.state;
const getUiVersion = () => ui.version;

export function useEngineState() {
  return useSyncExternalStore((l) => store.subscribe(l), getState, getState);
}

export function useUi(): UiStore {
  useSyncExternalStore((l) => ui.subscribe(l), getUiVersion, getUiVersion);
  return ui;
}
