import { createGame, type GameEngine } from '../src/core/engine';
import type { SurveyResponses } from '../src/shared/contracts/survey';
import { familySurvey } from './fixtures/households';

export function newGame(s: SurveyResponses = familySurvey(), seed = 11): GameEngine {
  const r = createGame(s, { seed });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.engine;
}

/** Resolve the open event with the first available choice (or a named preference). */
export function resolveFirst(e: GameEngine, prefer: string[] = []): string {
  const choices = e.getEventChoices();
  const pick = prefer.find((p) => choices.some((c) => c.actionId === p && c.available)) ?? choices.find((c) => c.available)?.actionId;
  if (!pick) throw new Error(`no available choice for ${e.getState().activeEvent?.eventId}`);
  const r = e.resolveEvent(pick);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return pick;
}

/** Drive the run to completion: ambient ticks at 32×, auto-resolving events, skipping time after landfall. */
export function playToEnd(e: GameEngine, prefer: string[] = [], maxSteps = 5000) {
  for (let i = 0; i < maxSteps && !e.getState().completed; i++) {
    const s = e.getState();
    if (s.activeEvent) { resolveFirst(e, prefer); continue; }
    if (['impact', 'aftermath', 'evacuation'].includes(s.phase)) { e.skipToNextMilestone(); continue; }
    if (s.clock.timeScale !== 32) e.setSpeed(32);
    e.tick(60_000);
  }
  return e.getState();
}

export const minutes = (e: GameEngine) => e.getState().clock.gameMinutes;
