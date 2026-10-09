// What the HUD shows, derived only from engine state (no rules computed here).
import { FINDING_BY_ID } from '../../../core/content/findings';
import { OBJECTIVES } from '../../../core/evaluation/objectives';
import { TIME_SCALES } from '../../../shared/contracts/ids';
import type { GameState } from '../../../shared/contracts/state';
import { formatClock } from '../format';

const PHASE: Record<string, string> = {
  setup: 'Getting ready', preparation: 'Preparation', warning: 'Warning', evacuation: 'Evacuation',
  impact: 'Typhoon landfall', aftermath: 'Aftermath', debrief: 'Debrief', complete: 'Complete',
};
const GO_BAG: Record<string, string> = { none: 'Go-bag empty', partial: 'Go-bag partly packed', ready: 'Go-bag ready' };

export type WellbeingBand = 'good' | 'watch' | 'low';
export interface HudModel {
  clock: string; phase: string; speed: number; paused: boolean; countdownHours: number | null; warnings: string[];
  cash: number; phone: number; goBag: string; wellbeing: { current: number; max: number; band: WellbeingBand };
}

export function hudModel(s: GameState, goBag: string): HudModel {
  const env = s.environment;
  const warnings = [
    env.evacuationAdvisoryIssued && 'Evacuation advisory issued (fictional)',
    !env.evacuationAdvisoryIssued && env.officialAdvisoryIssued && 'Typhoon advisory in effect (fictional)',
    !env.powerAvailable && 'Power is out',
    env.roadStatus === 'closed' ? 'Road closed' : env.roadStatus === 'restricted' && 'Road restricted',
    !env.shopOpen && 'Shop closed',
  ].filter((w): w is string => typeof w === 'string');
  const pct = (s.player.wellbeing.current / s.player.wellbeing.max) * 100;
  const minutesLeft = s.landfallMinute - s.clock.gameMinutes;
  return {
    clock: formatClock(s.clock.gameMinutes), phase: PHASE[s.phase] ?? s.phase, speed: s.clock.timeScale,
    paused: s.clock.pauseReasons.length > 0,
    countdownHours: env.landfallRevealed && minutesLeft > 0 ? Math.round(minutesLeft / 60) : null,
    warnings, cash: s.cash, phone: s.phoneBattery, goBag: GO_BAG[goBag] ?? goBag,
    wellbeing: { current: s.player.wellbeing.current, max: s.player.wellbeing.max, band: pct >= 85 ? 'good' : pct >= 50 ? 'watch' : 'low' },
  };
}

/** Wellbeing changes the player has not been told about yet (the engine appends; we only read). */
export const newWellbeingEvents = (seen: number, s: GameState) => s.player.wellbeingEvents.slice(seen);

/** The run's applicable objectives, worded with the backend's checklist text. */
export function objectivesView(s: GameState): { id: string; text: string; met: boolean }[] {
  return OBJECTIVES.filter((o) => o.applicable(s)).map((o) => ({ id: o.id, text: FINDING_BY_ID.get(o.findingId)?.checklist ?? o.id, met: o.met(s) }));
}

/** Next faster (+1) or slower (-1) engine time scale, clamped to the ends ([ and ] keys). */
export function stepSpeed(current: number, dir: 1 | -1): number {
  const i = TIME_SCALES.indexOf(current as (typeof TIME_SCALES)[number]);
  return TIME_SCALES[Math.max(0, Math.min(TIME_SCALES.length - 1, (i < 0 ? 0 : i) + dir))]!;
}

/** Blueprint §7: after landfall/departure, a Continue button skips to the next milestone when nothing is waiting. */
export const canContinue = (s: GameState) => !s.completed && !s.activeEvent && ['evacuation', 'impact', 'aftermath'].includes(s.phase);
