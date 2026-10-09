// Public backend API for the frontend (synchronous, deterministic). See docs/implementation/FRONTEND_BACKEND_CONTRACTS.md.
// The engine is the single authority over state; the frontend renders `getState()` and sends commands.
import { TIME_SCALES, type EventId, type TimeScale } from '../shared/contracts/ids';
import type { HouseholdProfile } from '../shared/contracts/household';
import { GameState, type ActiveEvent, type DecisionRecord, type PauseReason, type ShopItemId, type StateSnapshot } from '../shared/contracts/state';
import type { SurveyResponses } from '../shared/contracts/survey';
import { ACTION_BY_ID, ACTIONS, type ActionDef, type Ctx } from './content/actions';
import { EVENT_BY_ID } from './content/events';
import { INTERACTABLE_BY_ID, INTERACTABLES } from './content/interactables';
import { SHOP_CONFIG, SHOP_ITEM_BY_ID } from './content/shop';
import { milestones } from './content/storm';
import { buildHouseholdProfile, type ValidationIssue } from './household/buildProfile';
import { buildFromOnboarding, isOnboardingInput } from './household/onboarding';
import type { OnboardingInput } from '../shared/contracts/onboarding';
import { createInitialState } from './init/initialState';
import { deriveSeed } from './rng';
import { buildSceneDirective } from './scene/directive';
import type { SceneDirective } from '../shared/contracts/scene';
import * as sel from './selectors';

// ---------- public types ----------
export type ErrorCode =
  | 'INVALID_SURVEY' | 'UNKNOWN_ACTION' | 'ACTION_UNAVAILABLE' | 'EVENT_PENDING' | 'NO_ACTIVE_EVENT' | 'NOT_A_CHOICE'
  | 'GAME_OVER' | 'INVALID_SPEED' | 'UNKNOWN_ITEM' | 'OUT_OF_STOCK' | 'INSUFFICIENT_FUNDS' | 'NOT_IN_SHOP' | 'INVALID_QUANTITY'
  | 'INVALID_SAVE' | 'UNKNOWN_INTERACTABLE';
export interface EngineError { code: ErrorCode; message: string; reasons?: string[]; issues?: ValidationIssue[] }

export type EngineEvent =
  | { type: 'actionCompleted'; actionId: string; decisionSeq: number }
  | { type: 'eventTriggered'; eventId: EventId; variantId: string; mandatory: boolean }
  | { type: 'eventResolved'; eventId: EventId; actionId: string }
  | { type: 'milestone'; id: string; minute: number }
  | { type: 'phaseChanged'; from: GameState['phase']; to: GameState['phase'] }
  | { type: 'sceneChanged'; from: GameState['scene']; to: GameState['scene'] }
  | { type: 'speedChanged'; timeScale: TimeScale; reason: 'player' | 'critical' }
  | { type: 'purchaseCompleted'; shopItemId: ShopItemId; quantity: number; total: number }
  | { type: 'runCompleted' };

export type CommandResult = { ok: true; state: GameState; events: EngineEvent[]; decision?: DecisionRecord } | { ok: false; error: EngineError };

export interface ActionOption {
  actionId: string; label: string; timeCostMinutes: number; available: boolean; reasons: string[]; unsafe: boolean;
}

export interface ShopCatalogEntry {
  shopItemId: ShopItemId; label: string; basePrice: number; price: number; stock: number;
  grants: { item: import('../shared/contracts/ids').ItemId; quantity: number }; affordable: boolean;
}

/** Real milliseconds per simulated hour at 1× (GD §3: 240 s). */
export const REAL_MS_PER_GAME_HOUR = 240_000;

const fail = (code: ErrorCode, message: string, extra: Partial<EngineError> = {}): { ok: false; error: EngineError } => ({ ok: false, error: { code, message, ...extra } });

function snapshot(s: GameState): StateSnapshot {
  return structuredClone({ gameMinutes: s.clock.gameMinutes, cash: s.cash, phoneBattery: s.phoneBattery, house: s.house, goBag: s.goBag, flags: s.flags, counters: s.counters });
}

const usesKey = (id: string) => `uses:${id}`;

export function evaluateAction(def: ActionDef, c: Ctx): { applicable: boolean; reasons: string[] } {
  if (def.applicable && !def.applicable(c)) return { applicable: false, reasons: ['Not applicable to this household.'] };
  const reasons = def.requires.filter((r) => !r.test(c)).map((r) => r.reason);
  const max = typeof def.maxUses === 'function' ? def.maxUses(c) : def.maxUses;
  if (max !== undefined && (c.s.counters[usesKey(def.id)] ?? 0) >= max) reasons.push('Already done as many times as possible.');
  return { applicable: true, reasons };
}

export class GameEngine {
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  /** A deep copy; mutating it never affects the engine. */
  getState(): GameState { return structuredClone(this.state); }
  getProfile(): HouseholdProfile { return structuredClone(this.state.household); }
  getGoBagStatus(): sel.GoBagStatus { return sel.goBagStatus(this.state); }

  // ---------- queries ----------
  getAvailableActions(interactableId?: string): ActionOption[] {
    const c: Ctx = { s: this.state, p: this.state.household };
    const key = interactableId?.startsWith('NPC_') ? 'NPC' : interactableId;
    if (key && key !== 'NPC') {
      const it = INTERACTABLE_BY_ID.get(key);
      if (!it || it.scene !== this.state.scene || (it.present && !it.present(c.p))) return [];
    }
    const out: ActionOption[] = [];
    for (const def of ACTIONS) {
      if (def.scope === 'event') continue;
      if (key ? !def.interactables.includes(key) : !def.interactables.some((i) => (i === 'NPC' ? this.state.scene === 'HOUSE' : INTERACTABLE_BY_ID.get(i)?.scene === this.state.scene))) continue;
      const ev = evaluateAction(def, c);
      if (!ev.applicable) continue;
      out.push({ actionId: def.id, label: def.label, timeCostMinutes: def.timeCostMinutes, available: ev.reasons.length === 0 && !this.state.activeEvent, reasons: this.state.activeEvent ? ['Respond to the current event first.', ...ev.reasons] : ev.reasons, unsafe: !!def.unsafe });
    }
    return out;
  }

  /** Choices for the active event, in engine order, with availability. */
  getEventChoices(): ActionOption[] {
    const ev = this.state.activeEvent;
    if (!ev) return [];
    const c: Ctx = { s: this.state, p: this.state.household };
    return ev.actionIds.map((id) => {
      const def = ACTION_BY_ID.get(id)!;
      const r = evaluateAction(def, c);
      return { actionId: id, label: def.label, timeCostMinutes: def.timeCostMinutes, available: r.reasons.length === 0, reasons: r.reasons, unsafe: !!def.unsafe };
    });
  }

  /** World configuration for the frontend: fixed layout, theme, characters, interactables present. */
  getWorldConfig() {
    const p = this.state.household;
    return {
      layoutId: 'house_fixed_v1', theme: p.theme,
      characters: p.members.map((m) => ({ memberId: m.id, spriteBase: m.spriteBase, clothingVariant: m.clothingVariant, paletteId: m.paletteId, isPlayer: m.isPlayer, visibleNpc: m.visibleNpc, npcId: m.npcId, dependent: m.dependent })),
      interactables: INTERACTABLES.filter((i) => !i.present || i.present(p)).map((i) => ({ id: i.id, scene: i.scene, area: i.area, label: i.label })),
      pets: p.pets.types,
    };
  }

  // ---------- commands ----------
  /** Player interaction with an object or NPC: opens an eligible interaction event, otherwise lists actions. */
  interact(interactableId: string): { ok: true; state: GameState; events: EngineEvent[]; actions: ActionOption[] } | { ok: false; error: EngineError } {
    const key = interactableId.startsWith('NPC_') ? 'NPC' : interactableId;
    if (key !== 'NPC' && !INTERACTABLE_BY_ID.has(key)) return fail('UNKNOWN_INTERACTABLE', `Unknown interactable ${interactableId}`);
    if (this.state.activeEvent) return fail('EVENT_PENDING', 'Respond to the current event first.');
    const events: EngineEvent[] = [];
    const draft = structuredClone(this.state);
    const c: Ctx = { s: draft, p: draft.household };
    for (const def of EVENT_BY_ID.values()) {
      if (def.interactables?.includes(key) && !draft.eventHistory.some((h) => h.eventId === def.id) && def.eligible(c)) {
        this.activate(draft, def.id, events);
        this.state = draft;
        return { ok: true, state: this.getState(), events, actions: [] };
      }
    }
    return { ok: true, state: this.getState(), events, actions: this.getAvailableActions(interactableId) };
  }

  executeAction(actionId: string): CommandResult {
    const def = ACTION_BY_ID.get(actionId);
    if (!def) return fail('UNKNOWN_ACTION', `Unknown action ${actionId}`);
    if (this.state.completed || this.state.phase === 'debrief') return fail('GAME_OVER', 'The run is over.');
    if (this.state.activeEvent) return fail('EVENT_PENDING', 'Respond to the current event first.');
    if (def.scope === 'event') return fail('ACTION_UNAVAILABLE', 'This choice is only available during its event.', { reasons: ['event-only'] });
    const r = evaluateAction(def, { s: this.state, p: this.state.household });
    if (!r.applicable || r.reasons.length) return fail('ACTION_UNAVAILABLE', `${def.label} is not available.`, { reasons: r.reasons });
    return this.perform(def, null);
  }

  resolveEvent(actionId: string): CommandResult {
    const ev = this.state.activeEvent;
    if (!ev) return fail('NO_ACTIVE_EVENT', 'There is no event to respond to.');
    if (!ev.actionIds.includes(actionId)) return fail('NOT_A_CHOICE', `${actionId} is not a choice for ${ev.eventId}.`);
    const def = ACTION_BY_ID.get(actionId)!;
    const r = evaluateAction(def, { s: this.state, p: this.state.household });
    if (r.reasons.length) return fail('ACTION_UNAVAILABLE', `${def.label} is not available.`, { reasons: r.reasons });
    return this.perform(def, ev);
  }

  /** Advance ambient time by real elapsed milliseconds (paused clocks do not move). */
  tick(realMs: number): CommandResult {
    if (!(realMs >= 0)) return fail('INVALID_QUANTITY', 'realMs must be ≥ 0');
    const s = this.state;
    if (s.completed || s.phase === 'debrief' || s.activeEvent || s.clock.pauseReasons.length > 0) return { ok: true, state: this.getState(), events: [] };
    const draft = structuredClone(s);
    const events: EngineEvent[] = [];
    const target = draft.clock.gameMinutes + (realMs * draft.clock.timeScale * 60) / REAL_MS_PER_GAME_HOUR;
    this.advanceTo(draft, target, events, true);
    this.state = draft;
    return { ok: true, state: this.getState(), events };
  }

  setSpeed(timeScale: number): CommandResult {
    if (!(TIME_SCALES as readonly number[]).includes(timeScale)) return fail('INVALID_SPEED', `Speed must be one of ${TIME_SCALES.join(', ')}`);
    this.state = { ...this.state, clock: { ...this.state.clock, timeScale: timeScale as TimeScale } };
    return { ok: true, state: this.getState(), events: [{ type: 'speedChanged', timeScale: timeScale as TimeScale, reason: 'player' }] };
  }

  pause(reason: PauseReason): CommandResult {
    if (!this.state.clock.pauseReasons.includes(reason)) this.state = { ...this.state, clock: { ...this.state.clock, pauseReasons: [...this.state.clock.pauseReasons, reason] } };
    return { ok: true, state: this.getState(), events: [] };
  }

  resume(reason: PauseReason): CommandResult {
    if (reason === 'decision' && this.state.activeEvent) return fail('EVENT_PENDING', 'Respond to the current event first.');
    this.state = { ...this.state, clock: { ...this.state.clock, pauseReasons: this.state.clock.pauseReasons.filter((r) => r !== reason) } };
    return { ok: true, state: this.getState(), events: [] };
  }

  /** Atomic purchase at the community shop (GD §7). No state change on any failure. */
  purchase(shopItemId: ShopItemId, quantity = 1): CommandResult {
    const s = this.state;
    if (s.activeEvent) return fail('EVENT_PENDING', 'Respond to the current event first.');
    if (s.scene !== 'SHOP') return fail('NOT_IN_SHOP', 'You are not at the shop.');
    const item = SHOP_ITEM_BY_ID.get(shopItemId);
    if (!item || s.shop.stock[shopItemId] === undefined) return fail('UNKNOWN_ITEM', `The shop does not sell ${shopItemId}.`);
    if (!Number.isInteger(quantity) || quantity < 1) return fail('INVALID_QUANTITY', 'Quantity must be a positive whole number.');
    const stock = s.shop.stock[shopItemId] ?? 0;
    if (stock < quantity) return fail('OUT_OF_STOCK', `Only ${stock} left.`);
    const unitPrice = this.priceOf(shopItemId);
    const total = unitPrice * quantity;
    if (s.cash < total) return fail('INSUFFICIENT_FUNDS', `You need ₱${total} but have ₱${s.cash}.`);
    const draft = structuredClone(s);
    draft.cash -= total;
    draft.shop.stock[shopItemId] = stock - quantity;
    draft.shop.totalSpent += total;
    draft.shop.purchases.push({ shopItemId, quantity, unitPrice, atMinute: draft.clock.gameMinutes });
    draft.house[item.grants.item] = (draft.house[item.grants.item] ?? 0) + item.grants.quantity * quantity;
    if (unitPrice > item.price) draft.flags.BOUGHT_AFTER_PRICE_INCREASE = true;
    this.state = draft;
    return { ok: true, state: this.getState(), events: [{ type: 'purchaseCompleted', shopItemId, quantity, total }] };
  }

  /** Deterministic scene presentation for the current state (weather, lighting, flood, props, cues, audio). */
  getSceneDirective(): SceneDirective { return buildSceneDirective(this.state); }

  /** Shop catalog for the purchase UI: only items stocked for this household, with current prices. */
  getShopCatalog(): ShopCatalogEntry[] {
    const s = this.state;
    return [...SHOP_ITEM_BY_ID.values()].filter((i) => s.shop.stock[i.id] !== undefined).map((i) => {
      const price = this.priceOf(i.id);
      return { shopItemId: i.id, label: i.label, basePrice: i.price, price, stock: s.shop.stock[i.id] ?? 0, grants: { ...i.grants }, affordable: s.cash >= price };
    });
  }

  priceOf(shopItemId: ShopItemId): number {
    const base = SHOP_ITEM_BY_ID.get(shopItemId)?.price ?? 0;
    const late = SHOP_CONFIG.latePriceEnabled && this.state.clock.gameMinutes >= SHOP_CONFIG.latePriceFromHour * sel.HOUR;
    return late ? Math.round(base * SHOP_CONFIG.latePriceMultiplier) : base;
  }

  /** Impact/aftermath only: jump the clock to the next milestone instead of waiting. */
  skipToNextMilestone(): CommandResult {
    const s = this.state;
    if (s.activeEvent) return fail('EVENT_PENDING', 'Respond to the current event first.');
    if (!['impact', 'aftermath', 'evacuation'].includes(s.phase)) return fail('ACTION_UNAVAILABLE', 'Skipping time is only available after landfall or while travelling.');
    const next = milestones(s).find((m) => !s.firedMilestones.includes(m.id));
    if (!next) return { ok: true, state: this.getState(), events: [] };
    const draft = structuredClone(s);
    const events: EngineEvent[] = [];
    this.advanceTo(draft, Math.max(draft.clock.gameMinutes, next.minute), events, true);
    this.state = draft;
    return { ok: true, state: this.getState(), events };
  }

  // ---------- internals ----------
  private perform(def: ActionDef, ev: ActiveEvent | null): CommandResult {
    const draft = structuredClone(this.state);
    const events: EngineEvent[] = [];
    const before = snapshot(draft);
    const startMinute = draft.clock.gameMinutes;
    const phaseBefore = draft.phase;
    const sceneBefore = draft.scene;
    def.effect({ s: draft, p: draft.household });
    draft.counters[usesKey(def.id)] = (draft.counters[usesKey(def.id)] ?? 0) + 1;
    draft.clock.gameMinutes = startMinute + def.timeCostMinutes;
    const decision: DecisionRecord = {
      seq: draft.decisionLog.length + 1, eventId: ev?.eventId ?? null, variantId: ev?.variantId ?? null, actionId: def.id,
      tick: startMinute, timeCostMinutes: def.timeCostMinutes, stateBefore: before, stateAfter: snapshot(draft),
      safetyRuleId: def.safetyRuleId ?? null, objectiveIds: def.objectiveIds ?? [],
    };
    draft.decisionLog.push(decision);
    events.push({ type: 'actionCompleted', actionId: def.id, decisionSeq: decision.seq });
    if (ev) {
      const h = [...draft.eventHistory].reverse().find((x) => x.eventId === ev.eventId && x.resolvedWith === null);
      if (h) h.resolvedWith = def.id;
      draft.activeEvent = null;
      draft.clock.pauseReasons = draft.clock.pauseReasons.filter((r) => r !== 'decision');
      events.push({ type: 'eventResolved', eventId: ev.eventId, actionId: def.id });
      if (ev.eventId === 'EV16') { draft.phase = 'debrief'; draft.scene = 'RESULTS'; draft.completed = true; events.push({ type: 'runCompleted' }); }
    }
    if (draft.phase !== phaseBefore) events.push({ type: 'phaseChanged', from: phaseBefore, to: draft.phase });
    if (draft.scene !== sceneBefore) events.push({ type: 'sceneChanged', from: sceneBefore, to: draft.scene });
    // Fixed costs are charged in full; milestones crossed during the action are processed in order afterwards.
    if (!draft.completed) {
      this.processDue(draft, events);
      this.activateNext(draft, events);
    }
    this.state = draft;
    return { ok: true, state: this.getState(), events, decision: structuredClone(decision) };
  }

  /** Ambient advance: stops exactly at the first milestone that raises an event (GD §3). */
  private advanceTo(s: GameState, target: number, events: EngineEvent[], ambient: boolean) {
    while (!s.activeEvent) {
      const next = milestones(s).find((m) => !s.firedMilestones.includes(m.id));
      if (!next || next.minute > target) { s.clock.gameMinutes = Math.max(s.clock.gameMinutes, target); break; }
      s.clock.gameMinutes = Math.max(s.clock.gameMinutes, next.minute);
      const critical = this.processDue(s, events);
      this.activateNext(s, events);
      // Critical milestones (evacuation advisory, landfall, peak) end the ambient step so they are never skipped over.
      if (ambient && (s.activeEvent || critical)) break;
    }
  }

  /** Fire every milestone due at or before the current minute, chronologically. Returns true if any was critical. */
  processDue(s: GameState, events: EngineEvent[]): boolean {
    let critical = false;
    for (;;) {
      const due = milestones(s).find((m) => !s.firedMilestones.includes(m.id) && m.minute <= s.clock.gameMinutes);
      if (!due) return critical;
      if (due.critical) critical = true;
      const phaseBefore = s.phase;
      const sceneBefore = s.scene;
      s.firedMilestones.push(due.id);
      due.apply?.(s);
      events.push({ type: 'milestone', id: due.id, minute: due.minute });
      if (due.critical && s.clock.timeScale !== 1) { s.clock.timeScale = 1; events.push({ type: 'speedChanged', timeScale: 1, reason: 'critical' }); }
      if (s.phase !== phaseBefore) events.push({ type: 'phaseChanged', from: phaseBefore, to: s.phase });
      if (s.scene !== sceneBefore) events.push({ type: 'sceneChanged', from: sceneBefore, to: s.scene });
      if (due.eventId) s.pendingEvents.push({ eventId: due.eventId, dueMinute: due.minute });
    }
  }

  private activateNext(s: GameState, events: EngineEvent[]) {
    while (!s.activeEvent && s.pendingEvents.length) {
      const next = s.pendingEvents.shift()!;
      const def = EVENT_BY_ID.get(next.eventId)!;
      if (def.eligible({ s, p: s.household })) this.activate(s, next.eventId, events);
    }
  }

  private activate(s: GameState, eventId: EventId, events: EngineEvent[]) {
    const def = EVENT_BY_ID.get(eventId)!;
    const c: Ctx = { s, p: s.household };
    const variantId = def.variant(c);
    const actionIds = def.choices(c, variantId).filter((id) => {
      const a = ACTION_BY_ID.get(id);
      return a && (!a.applicable || a.applicable(c));
    });
    s.activeEvent = { eventId, variantId, triggeredAtMinute: s.clock.gameMinutes, mandatory: def.mandatory, actionIds };
    s.eventHistory.push({ eventId, variantId, atMinute: s.clock.gameMinutes, resolvedWith: null });
    if (!s.clock.pauseReasons.includes('decision')) s.clock.pauseReasons.push('decision');
    events.push({ type: 'eventTriggered', eventId, variantId, mandatory: def.mandatory });
  }

  /** Called once after construction to raise milestones due at minute 0 (EV01). */
  start(): EngineEvent[] {
    const draft = structuredClone(this.state);
    const events: EngineEvent[] = [];
    this.processDue(draft, events);
    this.activateNext(draft, events);
    this.state = draft;
    return events;
  }
}

export interface CreateOptions { seed: number; runId?: string }

/**
 * Start a new game from onboarding v2 (custom 8 questions or random 4 steps) or, deprecated, the legacy
 * 26-question SurveyResponses.
 */
export function createGame(responses: OnboardingInput | SurveyResponses, opts: CreateOptions): { ok: true; engine: GameEngine; events: EngineEvent[] } | { ok: false; error: EngineError } {
  const seed = deriveSeed(opts.seed, 'profile');
  const built = isOnboardingInput(responses) ? buildFromOnboarding(responses, seed) : buildHouseholdProfile(responses, { seed });
  if (!built.ok) return fail('INVALID_SURVEY', 'The household survey has invalid or missing answers.', { issues: built.issues });
  return startRun(built.profile, opts);
}

/** Start a run from an existing profile (used by replay). */
export function startRun(profile: HouseholdProfile, opts: CreateOptions): { ok: true; engine: GameEngine; events: EngineEvent[] } {
  const runId = opts.runId ?? `run-${opts.seed.toString(36)}-${Date.now().toString(36)}`;
  const engine = new GameEngine(createInitialState(profile, opts.seed, runId));
  const events = engine.start();
  return { ok: true, engine, events };
}

export function loadGame(raw: unknown): { ok: true; engine: GameEngine } | { ok: false; error: EngineError } {
  const parsed = GameState.safeParse(raw);
  if (!parsed.success) return fail('INVALID_SAVE', 'The save data is not valid.', { issues: parsed.error.issues.map((i) => ({ path: i.path.map(String), message: i.message })) });
  return { ok: true, engine: new GameEngine(parsed.data) };
}
