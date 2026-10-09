// IPC handlers. Every renderer payload is validated with Zod before use; nothing reaches spawn args or paths.
import { ipcMain } from 'electron';
import { z } from 'zod';
import { DebriefNarrationRequest, ScenarioAIRequest } from '../shared/contracts/ai';
import { DebriefEvaluation } from '../shared/contracts/debrief';
import { BadgeId } from '../shared/contracts/ids';
import { HouseholdProfile } from '../shared/contracts/household';
import { SceneAIRequest } from '../shared/contracts/scene';
import { GameState } from '../shared/contracts/state';
import { IPC, type AiStatus, type AppInfo } from '../shared/bridge';
import type { AIService } from './ai/aiService';
import type { SaveStore } from './persistence/saveStore';

const RunId = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/);
const Slot = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/);

export interface IpcDeps {
  ai: AIService;
  store: SaveStore;
  aiStatus: () => AiStatus;
  info: () => AppInfo;
}

export function registerIpc(d: IpcDeps) {
  ipcMain.handle(IPC.aiStatus, () => d.aiStatus());
  ipcMain.handle(IPC.aiGenerate, (_e, request: unknown, runId: unknown) =>
    d.ai.generateScenario(ScenarioAIRequest.parse(request), RunId.parse(runId)));
  ipcMain.handle(IPC.aiNarrate, (_e, evaluation: unknown, request: unknown) =>
    d.ai.narrateDebrief(DebriefEvaluation.parse(evaluation), DebriefNarrationRequest.parse(request)));
  ipcMain.handle(IPC.aiScene, (_e, request: unknown, runId: unknown) =>
    d.ai.suggestScene(SceneAIRequest.parse(request), RunId.parse(runId)));
  ipcMain.handle(IPC.saveWrite, (_e, slot: unknown, state: unknown) => d.store.writeGame(Slot.parse(slot), GameState.parse(state)));
  ipcMain.handle(IPC.saveRead, (_e, slot: unknown) => d.store.readGame(Slot.parse(slot)));
  ipcMain.handle(IPC.saveList, () => d.store.listGames());
  ipcMain.handle(IPC.saveRemove, (_e, slot: unknown) => d.store.deleteGame(Slot.parse(slot)));
  ipcMain.handle(IPC.badgesRead, () => d.store.readBadges());
  ipcMain.handle(IPC.badgesAdd, (_e, ids: unknown) => d.store.addBadges(z.array(BadgeId).parse(ids)));
  ipcMain.handle(IPC.achievementsRead, () => d.store.readAchievements());
  ipcMain.handle(IPC.achievementsRecordRun, (_e, state: unknown) => d.store.recordCompletedRun(GameState.parse(state)));
  ipcMain.handle(IPC.achievementsPlanViewed, (_e, runId: unknown) => d.store.markPlanViewed(RunId.parse(runId)));
  ipcMain.handle(IPC.profileWrite, (_e, p: unknown) => d.store.writeProfile(HouseholdProfile.parse(p)));
  ipcMain.handle(IPC.profileRead, () => d.store.readProfile());
  ipcMain.handle(IPC.profileRemove, () => d.store.deleteProfile());
  ipcMain.handle(IPC.appInfo, () => d.info());
}
