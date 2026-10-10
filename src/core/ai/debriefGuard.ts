// Debrief narration vs the engine's evaluation: rejects AFFIRMATIVE claims that contradict the score, ending,
// Handa result, wellbeing, the household's outcome, or a finding the evaluation lists as a gap. Advice and
// lessons ("next time…", "make sure…", "keep…") are not claims and stay allowed.
import type { DebriefEvaluation } from '../../shared/contracts/debrief';

const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
/** Wording that turns a sentence into advice, a lesson or a negation rather than a claim about this run. */
const NOT_A_CLAIM = /\b(next time|consider|try|could|should|would|remember|keep|make sure|need|needs|helps?|more|improve|work on|missing|lacked|without|no|not|never|before the next|ahead of)\b/i;

/** How a gap finding is described when someone claims it was done. Findings without an entry are not checked. */
const GAP_TOPICS: Record<string, RegExp> = {
  F_WATER: /\b(drinking water|water (supply|stores?|containers?)|stored (enough |plenty of )?(drinking )?water)\b/i,
  F_FOOD: /\b(ready-to-eat|food (supply|stores?)|enough food)\b/i,
  F_GO_BAG: /\bgo-?bag (was |is )?(complete|packed|ready)\b|\bpacked (the|your|a) go-?bag\b/i,
  F_LIGHTING: /\b(backup lighting|flashlight|power bank)\b/i,
  F_BULLETIN: /\b(official (information|updates?|advisor(y|ies))|bulletin)\b/i,
  F_COMMUNICATION: /\b(communication( plan)?|contacts|meeting point)\b/i,
  F_FAMILY_MEETING: /\b((family|household) plan|agreed on a plan)\b/i,
  F_ACCOUNTED: /\baccounted for\b/i,
  F_DESTINATION: /\b(knew where to go|evacuation (destination|cent(er|re)) (was|is) known)\b/i,
  F_DOCUMENTS: /\b(documents)\b/i,
  F_MEDICATION: /\b(medication|medicines?)\b/i,
  F_PETS: /\bpets?\b/i,
  F_CHILD: /\bchild-?care\b/i,
  F_HOME_SECURED: /\b(secured (your|the) home|boarded|windows (were|are) (secured|boarded))\b/i,
  F_FLOOD_PREP: /\b(prepared for flood(ing)?|belongings (higher|raised)|raised (your|the) belongings)\b/i,
  F_ASSISTANCE: /\barranged help\b/i,
};

/** An ending stated as the run's result ("a Nakaraos result", "ending: Handa"); "Handa badge/threshold" is not an ending. */
const ENDING_CLAIM = /\b(handa|nakaraos|nahirapan)\s+(result|ending|outcome)\b|\b(ending|result|outcome)\b[^.!?]{0,20}?\b(handa|nakaraos|nahirapan)\b/gi;
const EVACUATED_CLAIM = /\b(you|your household|the household|everyone)\s+(evacuated|left (early|in time|for the evacuation)|reached the evacuation)/i;
const STAYED_CLAIM = /\b(you|your household|the household|everyone)\s+(stayed (at )?home|sheltered at home|sheltered in place)\b/i;

export function checkDebriefConsistency(text: string, ev: DebriefEvaluation): string | null {
  // Score: any number given as the score / out of 100 must be the engine's score.
  for (const m of text.matchAll(/\bscore\b[^.!?\d]{0,24}(\d{1,3})\b|\b(\d{1,3})\s*(?:\/\s*100|out of 100)\b/gi)) {
    if (Number(m[1] ?? m[2]) !== ev.score) return 'debrief:score';
  }
  // Ending label (the badge "Handa" is checked separately).
  for (const m of text.matchAll(ENDING_CLAIM)) if ((m[1] ?? m[4])!.toLowerCase() !== ev.ending) return 'debrief:ending';
  const evacuated = ev.timeline.some((t) => t.actionId === 'FOLLOW_EVACUATION');
  const strengthTopics = ev.strengths.map((id) => GAP_TOPICS[id]).filter((re): re is RegExp => !!re);

  for (const s of sentencesOf(text)) {
    const claim = !NOT_A_CLAIM.test(s);
    if (claim && /\b(earned|got|won|received)\b[^.!?]{0,20}\bhanda badge\b/i.test(s) && !ev.handa.earned) return 'debrief:handa';
    // Wellbeing: a stated percentage must match; "perfect/full" only if it really was 100%.
    for (const m of s.matchAll(/\bwellbeing\b[^.!?\d]{0,30}(\d{1,3})\s*%/gi)) if (Number(m[1]) !== Math.round(ev.handa.wellbeingPercent)) return 'debrief:wellbeing';
    if (/\bwellbeing\b[^.!?]{0,30}\b(perfect|full|untouched|maximum)\b/i.test(s) && ev.handa.wellbeingPercent < 100) return 'debrief:wellbeing';
    if (claim && EVACUATED_CLAIM.test(s) && !evacuated) return 'debrief:outcome';
    if (claim && STAYED_CLAIM.test(s) && evacuated) return 'debrief:outcome';
    if (!claim) continue;
    for (const id of ev.gaps) {
      const re = GAP_TOPICS[id];
      // Skip topics a strength also covers (e.g. a go-bag gap while "took the go-bag" is a strength).
      if (re && re.test(s) && !strengthTopics.some((st) => st.source === re.source)) return `debrief:gap:${id}`;
    }
  }
  return null;
}
