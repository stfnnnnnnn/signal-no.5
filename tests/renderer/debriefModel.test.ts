import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/engine';
import { debriefModel } from '../../src/renderer/ui/debrief/debriefModel';
import { sliceHousehold, SLICE_SEED } from '../../src/renderer/app/sliceHousehold';
import { playToEnd } from '../helpers';
import { playDiligently } from '../diligent';

function finished(diligent = false) {
  const r = createGame(sliceHousehold(), { seed: SLICE_SEED });
  if (!r.ok) throw new Error('game');
  if (diligent) playDiligently(r.engine); else playToEnd(r.engine);
  return r.engine;
}

describe('debriefModel', () => {
  const e = finished();
  const ev = e.evaluate();
  const m = debriefModel(ev);

  it('keeps the score-based ending separate from the Handa badge', () => {
    expect(m.score).toBe(ev.score);
    expect(['Handa', 'Nakaraos', 'Nahirapan']).toContain(m.ending.label);
    expect(m.handa.earned).toBe(ev.handa.earned);
    expect(m.handa.wellbeing).toEqual({ percent: ev.handa.wellbeingPercent, threshold: 85, met: ev.handa.wellbeingMet });
  });
  it('words critical objectives with backend checklist text, not-applicable ones marked as such', () => {
    expect(m.handa.objectives.length).toBe(ev.handa.criticalCompetencies.length);
    for (const o of m.handa.objectives) expect(o.text.length).toBeGreaterThan(10);
    const na = m.handa.objectives.filter((o) => o.status === 'notApplicable');
    expect(na.length).toBe(ev.handa.criticalCompetencies.filter((c) => !c.applicable).length);
  });
  it('lists all 12 badges with their engine status; not applicable is neutral', () => {
    expect(m.badges).toHaveLength(12);
    for (const b of m.badges) expect(['earned', 'eligible', 'notEarned', 'notApplicable']).toContain(b.status);
    expect(m.badges.find((b) => b.status === 'notApplicable')?.tone ?? 'neutral').toBe('neutral');
  });
  it('shows strengths and gaps in backend wording and the personalised guide', () => {
    expect(m.strengths.length + m.gaps.length).toBeGreaterThan(0);
    expect(m.guide.checklist).toEqual(ev.checklistItems.map((c) => c.text));
    expect(m.guide.lessons).toEqual(ev.learningPoints.map((l) => l.text));
    expect(m.categories.every((c) => c.percent >= 0 && c.percent <= 100)).toBe(true);
  });
  it('a diligent run can earn Handa (badge) while the ending is reported on its own', () => {
    const d = debriefModel(finished(true).evaluate());
    expect(typeof d.handa.earned).toBe('boolean');
    expect(d.ending.label.length).toBeGreaterThan(0);
  });
});
