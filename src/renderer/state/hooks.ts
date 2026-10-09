import { useEffect, useState, useSyncExternalStore } from 'react';
import { store } from './engineStore';
import { ui, type UiStore } from './uiStore';
import { app, type AppStore } from './appStore';

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

const getAppVersion = () => app.version;
export function useApp(): AppStore {
  useSyncExternalStore((l) => app.subscribe(l), getAppVersion, getAppVersion);
  return app;
}

/** Engine state re-rendered at most every `ms` (blueprint §7: HUD ≈ 4 Hz; the engine ticks 10x a second). */
export function useThrottledEngineState(ms = 250) {
  const [state, setState] = useState(() => store.state);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = store.subscribe(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; setState(store.state); }, ms);
    });
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [ms]);
  return state;
}
