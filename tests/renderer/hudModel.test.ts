import { beforeEach, describe, expect, it } from 'vitest';
import { hudModel, newWellbeingEvents, objectivesView } from '../../src/renderer/ui/hud/hudModel';
import { store } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import { advanceTo } from '../helpers';

beforeEach(() => { store.reset(); store.newGame(sliceHousehold(), SLICE_SEED); });

describe('hudModel', () => {
  it('shows engine values: clock, phase, speed, money, phone, go-bag, wellbeing', () => {
    const h = hudModel(store.state!, store.engine.getGoBagStatus());
    expect(h.clock).toBe('Day 1 · 00:00');
    expect(h.phase).toBe('Preparation');
    expect(h.speed).toBe(store.state!.clock.timeScale);
    expect(h.cash).toBe(store.state!.cash);
    expect(h.phone).toBe(store.state!.phoneBattery);
    expect(h.goBag).toMatch(/go-bag/i);
    expect(h.wellbeing).toEqual({ current: 100, max: 100, band: 'good' });
    expect(h.paused).toBe(true);                         // EV01 is waiting for a decision
  });
  it('shows no landfall countdown until the engine reveals it', () => {
    expect(hudModel(store.state!, 'none').countdownHours).toBeNull();
    advanceTo(store.engine, 24 * 60 + 30);
    const s = store.engine.getState();
    expect(hudModel(s, 'none').countdownHours).toBe(Math.round((s.landfallMinute - s.clock.gameMinutes) / 60));
  });
  it('lists warnings only from the engine environment', () => {
    const s = store.state!;
    expect(hudModel(s, 'none').warnings).toEqual(s.environment.officialAdvisoryIssued ? ['Typhoon advisory in effect (fictional)'] : []);
    const w = hudModel({ ...s, environment: { ...s.environment, powerAvailable: false, evacuationAdvisoryIssued: true } }, 'none').warnings;
    expect(w).toContain('Power is out');
    expect(w.some((x) => /evacuation advisory/i.test(x))).toBe(true);
  });
  it('bands wellbeing for the meter without computing any penalty', () => {
    const s = store.state!;
    const at = (current: number) => hudModel({ ...s, player: { ...s.player, wellbeing: { current, max: 100 } } }, 'none').wellbeing.band;
    expect([at(100), at(85), at(84), at(50), at(49)]).toEqual(['good', 'good', 'watch', 'watch', 'low']);
  });
});

describe('wellbeing reasons and objectives', () => {
  it('reports only the wellbeing events added since last time', () => {
    const s = store.state!;
    const ev = { ruleId: 'W_X', delta: -15, atMinute: 10, reason: 'Stayed home through a severe flood.' };
    expect(newWellbeingEvents(0, s)).toEqual([]);
    expect(newWellbeingEvents(0, { ...s, player: { ...s.player, wellbeingEvents: [ev] } })).toEqual([ev]);
    expect(newWellbeingEvents(1, { ...s, player: { ...s.player, wellbeingEvents: [ev] } })).toEqual([]);
  });
  it('lists the applicable objectives with backend checklist wording', () => {
    const list = objectivesView(store.state!);
    expect(list.length).toBeGreaterThan(3);
    expect(list.find((o) => o.id === 'O_BULLETIN')).toMatchObject({ met: false });
    expect(list.every((o) => o.text.length > 10)).toBe(true);
    store.dispatch((e) => e.resolveEvent('CHECK_ADVISORY'));
    expect(objectivesView(store.state!).find((o) => o.id === 'O_BULLETIN')?.met).toBe(true);
  });
});
