// The debrief, shaped from the engine's DebriefEvaluation only (score, ending, Handa, badges, findings, guide).
import { BADGE_CATALOG } from '../../../core/content/badges';
import { FINDING_BY_ID } from '../../../core/content/findings';
import { OBJECTIVES } from '../../../core/evaluation/objectives';
import type { DebriefEvaluation } from '../../../shared/contracts/debrief';

const ENDING: Record<string, { label: string; text: string }> = {
  handa: { label: 'Handa', text: 'Your household was well prepared for this storm.' },
  nakaraos: { label: 'Nakaraos', text: 'Your household got through, with some gaps to work on.' },
  nahirapan: { label: 'Nahirapan', text: 'This storm was hard on your household. The lessons below show what would help most.' },
};
const CATEGORY: Record<string, string> = {
  emergencySupplies: 'Emergency supplies', officialInformation: 'Official information', householdCoordination: 'Household coordination',
  evacuationPreparedness: 'Evacuation preparedness', householdNeeds: 'Household needs', hazardAwareness: 'Hazard awareness',
};
const BADGE_STATUS: Record<string, { label: string; tone: 'good' | 'neutral' | 'muted' }> = {
  earned: { label: 'Earned', tone: 'good' }, eligible: { label: 'Within reach', tone: 'neutral' },
  notEarned: { label: 'Not earned this time', tone: 'muted' }, notApplicable: { label: 'Not applicable to this run', tone: 'neutral' },
};
const objectiveText = (id: string) => {
  const o = OBJECTIVES.find((x) => x.id === id);
  return (o && FINDING_BY_ID.get(o.findingId)?.checklist) ?? id;
};

export function debriefModel(ev: DebriefEvaluation) {
  return {
    score: ev.score,
    ending: ENDING[ev.ending] ?? { label: ev.ending, text: '' },
    handa: {
      earned: ev.handa.earned,
      wellbeing: { percent: ev.handa.wellbeingPercent, threshold: ev.handa.wellbeingThreshold, met: ev.handa.wellbeingMet },
      objectives: ev.handa.criticalCompetencies.map((c) => ({
        id: c.objectiveId, text: objectiveText(c.objectiveId),
        status: !c.applicable ? 'notApplicable' as const : c.met ? 'met' as const : 'notMet' as const,
      })),
      evacuationAndAssistanceMet: ev.handa.evacuationAndAssistanceMet,
      reasons: ev.handa.reasons,
    },
    categories: ev.categories.filter((c) => c.included).map((c) => ({
      id: c.category, label: CATEGORY[c.category] ?? c.category, percent: c.weight > 0 ? Math.round((c.earned / c.weight) * 100) : 0,
    })),
    strengths: ev.strengths.map((id) => FINDING_BY_ID.get(id)?.strength ?? id),
    gaps: ev.gaps.map((id) => FINDING_BY_ID.get(id)?.lesson ?? id),
    badges: ev.badges.map((b) => {
      const meta = BADGE_CATALOG.find((m) => m.id === b.id);
      const st = BADGE_STATUS[b.status] ?? { label: b.status, tone: 'neutral' as const };
      return { id: b.id, name: meta?.name ?? b.id, icon: meta?.iconAssetId ?? '', status: b.status, label: st.label, tone: st.tone, reasons: b.reasons, hint: meta?.hint ?? '' };
    }),
    timeline: ev.timeline,
    guide: { checklist: ev.checklistItems.map((c) => c.text), lessons: ev.learningPoints.map((l) => l.text) },
  };
}
export type DebriefView = ReturnType<typeof debriefModel>;
