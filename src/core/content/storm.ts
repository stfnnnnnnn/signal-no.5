// Storm configuration and milestone timeline (GD §9). Authored, seed-varied, never "forecast".
import type { EventId } from '../../shared/contracts/ids';
import type { HouseholdProfile } from '../../shared/contracts/household';
import type { GameState, Severity, StormConfig } from '../../shared/contracts/state';
import { createRng, deriveSeed } from '../rng';
import * as sel from '../selectors';
import { checkAtPeak } from '../wellbeing';

export const DEFAULT_LANDFALL_HOUR = 48;
const SEVERITY: Severity[] = ['none', 'low', 'moderate', 'severe'];

/**
 * Environmental difficulty profiles (fictional training conditions, never real flood-risk predictions).
 * Deterministic per exposure; only flood-prone varies between moderate and severe by seed.
 */
export const EXPOSURE_PROFILES: Record<HouseholdProfile['exposure'], { peak: Severity[]; onsetHours: number; risingAtHours: number | null; advisoryLeadHours: number; alwaysAdvisory: boolean; fictional: true; description: string }> = {
  standard: { peak: ['low'], onsetHours: 0, risingAtHours: null, advisoryLeadHours: 0, alwaysAdvisory: false, fictional: true, description: 'Standard exposure (fictional): minor flooding at landfall.' },
  waterway: { peak: ['moderate'], onsetHours: 4, risingAtHours: null, advisoryLeadHours: 2, alwaysAdvisory: true, fictional: true, description: 'Near a waterway (fictional): earlier flood complications and an earlier advisory.' },
  floodProne: { peak: ['moderate', 'severe'], onsetHours: 6, risingAtHours: 2, advisoryLeadHours: 2, alwaysAdvisory: true, fictional: true, description: 'Low-lying (fictional): faster flood escalation and an earlier advisory.' },
  both: { peak: ['severe'], onsetHours: 6, risingAtHours: 2, advisoryLeadHours: 4, alwaysAdvisory: true, fictional: true, description: 'Waterway and low-lying (fictional): highest supported difficulty, earliest advisory.' },
  unknown: { peak: ['moderate'], onsetHours: 0, risingAtHours: null, advisoryLeadHours: 0, alwaysAdvisory: false, fictional: true, description: 'Unknown exposure (fictional default profile): moderate flooding at the storm peak.' },
};

export function createStormConfig(p: HouseholdProfile, seed: number): StormConfig {
  const rng = createRng(deriveSeed(seed, 'storm'));
  const profile = EXPOSURE_PROFILES[p.exposure];
  const flood = createRng(deriveSeed(seed, 'storm:flood')).pick(profile.peak);
  return {
    stormSeed: seed,
    landfallAccelerationHours: rng.pick([0, 4, 8] as const),
    powerOutageEvent: rng.chance(0.85),
    roadClosureEvent: rng.chance(0.6),
    shopClosureEvent: true,
    // Always authored for flood-related exposure; otherwise when flooding is moderate+, or in about half of runs.
    evacuationAdvisoryEvent: profile.alwaysAdvisory || flood === 'moderate' || flood === 'severe' || rng.chance(0.5),
    misinformationEvent: rng.chance(0.7),
    peakFloodSeverity: flood,
    peakWindSeverity: rng.pick(['moderate', 'severe'] as const),
    exposure: p.exposure,
    floodOnsetHoursBeforeLandfall: profile.onsetHours,
    advisoryLeadHours: profile.advisoryLeadHours,
  };
}

export interface Milestone {
  id: string;
  minute: number;
  /** Mandatory event to raise (if eligible at fire time). */
  eventId?: EventId;
  /** Resets the speed to 1× (GD §3 critical phase). */
  critical?: boolean;
  apply?: (s: GameState) => void;
}

/** Timeline for the current state. Milestones relative to landfall move when landfall accelerates. */
export function milestones(s: GameState): Milestone[] {
  const H = sel.HOUR;
  const L = s.landfallMinute;
  const st = s.storm;
  const list: Milestone[] = [
    { id: 'H0_ADVISORY', minute: 0, eventId: 'EV01', apply: (x) => { x.environment.officialAdvisoryIssued = true; } },
    { id: 'H8_REMINDER', minute: 8 * H, eventId: 'EV02' },
    { id: 'H12_COORDINATION', minute: 12 * H, eventId: 'EV03' },
    { id: 'H16_SUPPLY', minute: 16 * H, eventId: 'EV04' },
    { id: 'H20_MEDICAL', minute: 20 * H, eventId: 'EV05' },
    { id: 'H24_UPDATE', minute: 24 * H, eventId: 'EV06', apply: (x) => { x.environment.landfallRevealed = true; x.environment.weatherState = 'rain'; if (x.phase === 'preparation') x.phase = 'warning'; } },
    { id: 'H32_DILEMMA', minute: 32 * H, eventId: 'EV12' },
  ];
  if (st.misinformationEvent) list.push({ id: 'H28_RUMOR', minute: 28 * H, eventId: 'EV07' });
  const advisoryAt = L - (8 + (st.advisoryLeadHours ?? 0)) * H;
  if (st.evacuationAdvisoryEvent) list.push({ id: 'EVAC_ADVISORY', minute: advisoryAt, eventId: 'EV08', critical: true,
    apply: (x) => { recordDeadlineSnapshot(x); x.environment.evacuationAdvisoryIssued = true; } });
  list.push({ id: 'HEAVY_RAIN', minute: L - 8 * H, apply: (x) => { if (!x.storm.evacuationAdvisoryEvent) recordDeadlineSnapshot(x); x.environment.weatherState = 'heavyRain'; } });
  const ep = EXPOSURE_PROFILES[st.exposure ?? 'unknown'];
  const peakRank = SEVERITY.indexOf(st.peakFloodSeverity);
  if (st.floodOnsetHoursBeforeLandfall > 0 && peakRank >= 1) list.push({ id: 'FLOOD_ONSET', minute: L - st.floodOnsetHoursBeforeLandfall * H,
    apply: (x) => { if (x.environment.floodSeverity === 'none') x.environment.floodSeverity = 'low'; } });
  if (ep.risingAtHours !== null && peakRank >= 2) list.push({ id: 'FLOOD_RISING', minute: L - ep.risingAtHours * H,
    apply: (x) => { if (SEVERITY.indexOf(x.environment.floodSeverity) < 2) x.environment.floodSeverity = 'moderate'; } });
  if (st.shopClosureEvent) list.push({ id: 'SHOP_CLOSURE', minute: L - 6 * H, apply: (x) => { x.environment.shopOpen = false; } });
  if (st.powerOutageEvent) list.push({ id: 'POWER_OUTAGE', minute: L - 4 * H, eventId: 'EV09', apply: (x) => { x.environment.powerAvailable = false; } });
  if (st.roadClosureEvent) {
    list.push({ id: 'ROAD_RESTRICTED', minute: L - 4 * H, apply: (x) => { if (x.environment.roadStatus === 'open') x.environment.roadStatus = 'restricted'; } });
    list.push({ id: 'ROAD_CLOSED', minute: L - 2 * H, apply: (x) => { x.environment.roadStatus = 'closed'; } });
  }
  list.push(
    { id: 'LANDFALL', minute: L, critical: true, apply: (x) => {
      recordLandfallSnapshot(x);
      x.environment.weatherState = 'typhoon';
      x.environment.windSeverity = 'moderate';
      x.environment.roadStatus = 'closed';
      x.environment.shopOpen = false;
      if (x.environment.floodSeverity === 'none' && st.peakFloodSeverity !== 'none') x.environment.floodSeverity = 'low';
      x.phase = 'impact';
      x.scene = x.evacuation.currentShelter === 'home' ? 'HOME_IMPACT' : 'EVACUATION';
    } },
    { id: 'PEAK', minute: L + 3 * H, eventId: 'EV10', critical: true, apply: (x) => applyPeak(x) },
    { id: 'IMPACT_END', minute: L + 6 * H, eventId: 'EV13', apply: (x) => applyImpactEnd(x) },
    { id: 'AFTERMATH_DAY1', minute: L + 12 * H, eventId: 'EV14', apply: (x) => { x.phase = 'aftermath'; x.scene = 'AFTERMATH'; x.aftermathDay = 1; x.environment.weatherState = 'clear'; } },
    { id: 'AFTERMATH_DAY2', minute: L + 36 * H, eventId: 'EV15', apply: (x) => { x.aftermathDay = 2; x.environment.floodSeverity = 'none'; } },
    { id: 'AFTERMATH_DAY3', minute: L + 60 * H, eventId: 'EV16', apply: (x) => { x.aftermathDay = 3; x.environment.powerAvailable = true; x.environment.tapWaterAvailable = true; } },
  );
  if (s.evacuation.arrivalAtMinute !== null) list.push({ id: 'EVAC_ARRIVAL', minute: s.evacuation.arrivalAtMinute, eventId: 'EV11', apply: (x) => {
    x.evacuation.completed = true; x.evacuation.currentShelter = 'evacuationCenter'; x.scene = 'EVACUATION';
  } });
  return list.sort((a, b) => a.minute - b.minute || PRIORITY(a) - PRIORITY(b));
}

/** Tie-break for milestones at the same minute: advisory > evacuation > hazard > dilemma > reminder. */
const PRIORITY = (m: Milestone) => (m.eventId ? ({ EV01: 0, EV06: 0, EV08: 1, EV11: 1, EV09: 2, EV10: 2, EV13: 2, EV07: 3, EV12: 3 } as Record<string, number>)[m.eventId] ?? 4 : -1);

/** Preparation deadline (advisory, or heavy rain when no advisory): snapshot for timing-based badges. */
function recordDeadlineSnapshot(s: GameState) {
  if (s.counters.pd_recorded) return;
  s.counters.pd_recorded = 1;
  s.counters.pd_minute = s.clock.gameMinutes;
  s.counters.pd_goBagReady = sel.goBagStatus(s) === 'ready' ? 1 : 0;
  s.counters.pd_windows = s.counters.windowsBoarded ?? 0;
  s.counters.pd_roof = s.flags.ROOF_SECURED ? 1 : 0;
}

/** What the household actually has when the storm arrives (evacuees only have their go-bag). Used by scoring. */
function recordLandfallSnapshot(s: GameState) {
  const left = s.evacuation.departedAtMinute !== null;
  const have = (id: 'WATER' | 'FOOD' | 'FLASHLIGHT' | 'POWER_BANK' | 'DOCUMENTS') => (left ? s.goBag[id] ?? 0 : sel.itemTotal(s, id));
  s.counters.lf_water = have('WATER');
  s.counters.lf_food = have('FOOD');
  s.counters.lf_lighting = have('FLASHLIGHT') + have('POWER_BANK') > 0 ? 1 : 0;
  s.counters.lf_powerBank = have('POWER_BANK') > 0 ? 1 : 0;
  s.counters.lf_goBagReady = sel.goBagStatus(s) === 'ready' ? 1 : 0;
  s.counters.lf_documentsSafe = s.flags.DOCUMENTS_PROTECTED || (s.goBag.DOCUMENTS ?? 0) > 0 ? 1 : 0;
}

function applyPeak(s: GameState) {
  const env = s.environment;
  env.floodSeverity = s.storm.peakFloodSeverity;
  env.windSeverity = s.storm.peakWindSeverity;
  if (env.floodSeverity === 'moderate' || env.floodSeverity === 'severe') env.tapWaterAvailable = false;
  if (s.evacuation.currentShelter === 'home') {
    const p = s.household;
    const roofWeak = sel.roofNeedsSecuring(p) && !s.flags.ROOF_SECURED && env.windSeverity === 'severe';
    const floodBad = env.floodSeverity === 'severe' && p.housing.floors === 1;
    env.shelterCondition = roofWeak && floodBad ? 'unsafe' : roofWeak || floodBad ? 'compromised' : 'normal';
  }
  checkAtPeak(s);
}

/** Authored property and supply outcomes (GS §13 as categories; no numeric thresholds). */
function applyImpactEnd(s: GameState) {
  const env = s.environment;
  const p = s.household;
  const severeWind = env.windSeverity === 'severe';
  const boarded = s.counters.windowsBoarded ?? 0;
  env.windowDamage = severeWind && boarded < 2 ? (boarded === 0 ? 'major' : 'minor') : 'none';
  env.roofDamage = severeWind && sel.roofNeedsSecuring(p) && !s.flags.ROOF_SECURED ? 'minor' : 'none';
  const wet = env.floodSeverity === 'moderate' || env.floodSeverity === 'severe';
  const floodGuarded = s.flags.BELONGINGS_RAISED || s.flags.GATE_SANDBAGGED || p.housing.floors > 1;
  env.suppliesLost = wet && !s.flags.SUPPLIES_STORED_SAFELY && p.housing.floors === 1;
  if (env.suppliesLost) {
    for (const id of ['WATER', 'FOOD'] as const) { const q = s.house[id] ?? 0; if (q > 0) s.house[id] = Math.floor(q / 2); }
  }
  env.documentsLost = wet && !s.flags.DOCUMENTS_PROTECTED && (s.goBag.DOCUMENTS ?? 0) === 0 && !floodGuarded;
  const damageScore = (env.windowDamage === 'major' ? 2 : env.windowDamage === 'minor' ? 1 : 0) + (env.roofDamage !== 'none' ? 1 : 0) + (wet && !floodGuarded ? 2 : 0);
  env.propertyDamage = damageScore >= 3 ? 'major' : damageScore >= 1 ? 'minor' : 'none';
  env.weatherState = 'rain';
}
