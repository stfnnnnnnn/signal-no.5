// The ONLY API the renderer gets (window.signal), exposed by src/preload via contextBridge.
// The deterministic engine (src/core) runs in the renderer; the main process owns the model and files.
import type { DebriefNarrationRequest, ScenarioAIRequest, ScenarioContent } from './contracts/ai';
import type { DebriefEvaluation, DebriefNarration } from './contracts/debrief';
import type { HouseholdProfile } from './contracts/household';
import type { SceneAIRequest, SceneAISuggestion } from './contracts/scene';
import type { AchievementStatus } from './contracts/progress';
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
    /** Optional scene variation; null = keep the deterministic directive. Merge with mergeSceneSuggestion(). */
    suggestScene(request: SceneAIRequest, runId: string): Promise<SceneAISuggestion | null>;
  };
  save: {
    write(slot: string, state: GameState): Promise<void>;
    read(slot: string): Promise<GameState | null>;
    list(): Promise<string[]>;
    remove(slot: string): Promise<void>;
  };
  badges: { read(): Promise<string[]>; add(ids: string[]): Promise<string[]> };
  achievements: {
    read(): Promise<AchievementStatus[]>;
    /** Record a COMPLETED run (main re-evaluates it). Idempotent per runId. */
    recordRun(state: GameState): Promise<{ achievements: AchievementStatus[]; newlyUnlocked: string[] }>;
    markPlanViewed(runId: string): Promise<AchievementStatus[]>;
  };
  profile: { write(p: HouseholdProfile): Promise<void>; read(): Promise<HouseholdProfile | null>; remove(): Promise<void> };
  app: { info(): Promise<AppInfo> };
}

declare global {
  interface Window { signal: SignalBridge }
}

export const IPC = {
  aiStatus: 'ai:status', aiStatusChanged: 'ai:status-changed', aiGenerate: 'ai:generateScenario', aiNarrate: 'ai:narrateDebrief', aiScene: 'ai:suggestScene',
  saveWrite: 'save:write', saveRead: 'save:read', saveList: 'save:list', saveRemove: 'save:remove',
  badgesRead: 'badges:read', badgesAdd: 'badges:add',
  achievementsRead: 'achievements:read', achievementsRecordRun: 'achievements:recordRun', achievementsPlanViewed: 'achievements:planViewed',
  profileWrite: 'profile:write', profileRead: 'profile:read', profileRemove: 'profile:remove',
  appInfo: 'app:info',
} as const;
