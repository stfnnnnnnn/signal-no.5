import { describe, expect, it } from 'vitest';
import { canContinue } from '../../src/renderer/ui/hud/hudModel';
import { store } from '../../src/renderer/state/engineStore';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';

describe('Continue (skip to the next milestone)', () => {
  it('is offered only after preparation, with no event open and the run not finished', () => {
    store.reset(); store.newGame(sliceHousehold(), SLICE_SEED);
    const s = store.state!;
    expect(canContinue(s)).toBe(false);                                        // preparation + EV01 open
    expect(canContinue({ ...s, phase: 'impact', activeEvent: null })).toBe(true);
    expect(canContinue({ ...s, phase: 'aftermath', activeEvent: s.activeEvent })).toBe(false);
    expect(canContinue({ ...s, phase: 'evacuation', activeEvent: null, completed: true })).toBe(false);
  });
});
