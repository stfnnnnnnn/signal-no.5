// The ONLY API the renderer gets (window.signal), exposed by src/preload via contextBridge.
// The deterministic engine (src/core) runs in the renderer; the main process owns the model and files.
import type { DebriefNarrationRequest, ScenarioAIRequest, ScenarioContent } from './contracts/ai';
import type { DebriefEvaluation, DebriefNarration } from './contracts/debrief';
import type { HouseholdProfile } from './contracts/household';
import type { GameState } from './contracts/state';

export type AiStatus = 'starting' | 'warming' | 'ready' | 'unavailable' | 'stopped';

export interface AppInfo {
  version: string;
  packaged: boolean;
  modelFile: string | null;
  runtime: string;
  aiStatus: AiStatus;
  inferenceDevice: 'local';
}

export interface SignalBridge {
  ai: {
    status(): Promise<AiStatus>;
    onStatus(cb: (s: AiStatus) => void): () => void;
    /** Always resolves: AI content (`source:'ai'`) or reviewed fallback (`source:'fallback'`). */
    generateScenario(request: ScenarioAIRequest, runId: string): Promise<ScenarioContent>;
    narrateDebrief(evaluation: DebriefEvaluation, request: DebriefNarrationRequest): Promise<DebriefNarration & { source: 'ai' | 'fallback' }>;
  };
  save: {
    write(slot: string, state: GameState): Promise<void>;
    read(slot: string): Promise<GameState | null>;
    list(): Promise<string[]>;
    remove(slot: string): Promise<void>;
  };
  badges: { read(): Promise<string[]>; add(ids: string[]): Promise<string[]> };
  profile: { write(p: HouseholdProfile): Promise<void>; read(): Promise<HouseholdProfile | null>; remove(): Promise<void> };
  app: { info(): Promise<AppInfo> };
}

declare global {
  interface Window { signal: SignalBridge }
}

export const IPC = {
  aiStatus: 'ai:status', aiStatusChanged: 'ai:status-changed', aiGenerate: 'ai:generateScenario', aiNarrate: 'ai:narrateDebrief',
  saveWrite: 'save:write', saveRead: 'save:read', saveList: 'save:list', saveRemove: 'save:remove',
  badgesRead: 'badges:read', badgesAdd: 'badges:add',
  profileWrite: 'profile:write', profileRead: 'profile:read', profileRemove: 'profile:remove',
  appInfo: 'app:info',
} as const;
