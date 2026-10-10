import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createGame } from '../../src/core/engine';
import { BADGE_CATALOG } from '../../src/core/content/badges';
import { store } from '../../src/renderer/state/engineStore';
import { Debrief } from '../../src/renderer/ui/debrief/Debrief';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import { playToEnd } from '../helpers';

it('debrief shows the score/ending and the Handa badge as separate cards, plus all 12 badges', () => {
  const r = createGame(sliceHousehold(), { seed: SLICE_SEED });
  if (!r.ok) throw new Error('game');
  playToEnd(r.engine);
  store.reset();
  expect(store.load(r.engine.getState()).ok).toBe(true);
  const ev = store.engine.evaluate();
  const h = renderToStaticMarkup(createElement(Debrief));
  expect(h).toContain(`${ev.score}<small>/100</small>`);
  expect(h).toMatch(/score-card[\s\S]*handa-card/);
  expect(h).toContain(`Handa badge: ${ev.handa.earned ? 'earned' : 'not earned'}`);
  for (const b of BADGE_CATALOG) expect(h).toContain(b.name);
  expect(h).toContain('Open my preparedness plan');
  expect(h).toContain('Play again with this household');
});
