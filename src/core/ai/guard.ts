// Grounding guard: deterministic checks that AI text does not assert facts the game never approved.
// Heuristic by nature: it rejects detectable violations and the adapter falls back to reviewed text.
import type { ItemId } from '../../shared/contracts/ids';

export interface GuardContext {
  livesAlone: boolean;
  /** Items the text may mention (inventory + items referenced by the offered actions). */
  allowedItems: ReadonlySet<ItemId>;
  /** Whether the text may mention an evacuation destination (only at arrival). */
  placesAllowed: boolean;
}

const ALWAYS_FORBIDDEN: [RegExp, string][] = [
  [/https?:\/\/|www\.|\.(com|ph|org|gov)\b/i, 'url'],
  [/\b\d{3,4}[\s-]?\d{3}[\s-]?\d{3,4}\b|\b(911|117|143)\b/, 'phone-number'],
  [/\bsignal\s*(no\.?|number|#|level)?\s*\d/i, 'signal-level'],
  [/\bcategory\s*\d/i, 'storm-category'],
  [/\bguarantee|\bsafe to\b|\bperfectly safe\b|\bnothing (bad )?will happen\b/i, 'safety-guarantee'],
  [/\b(tablets?|pills?|dose|dosage|\d+\s?mg|insulin|inhaler|every \d+ hours|first aid steps|cpr)\b/i, 'medical-instruction'],
  // Stating forecast content. Mentioning "the forecast" (e.g. "check the forecast") is allowed.
  [/\b(forecast (says|said|shows|showed|is|was|calls)|no typhoon|not expected to|will (hit|make landfall|weaken|strengthen|pass)|expected to (hit|arrive|weaken|strengthen|pass)|wind speeds?|km\/h|kph)\b/i, 'forecast-claim'],
  // Asserting what an official source says ("the advisory says to…", "officials said that…"); merely mentioning it is fine.
  [/\b(advisory|bulletin|officials?|authorities|pagasa|ndrrmc|barangay|government)\b[^.!?]{0,20}\b(says?|said|told|announced|warned|recommends?|ordered|wants)\s*(\b(to|that|we|you|us|everyone|people|residents)\b|:)/i, 'advisory-claim'],
  [/\b(you|we|everyone) (must|should|have to|need to) (evacuate|leave( now)?|go to)\b/i, 'instruction'],
  [/\b(generator|candles?|car|truck|van|boat|motorcycle|tricycle|jeepney)\b/i, 'invented-resource'],
];
const PLACES = /\b(community|evacuation) cent(er|re)\b|\bshelter\b|\bbarangay hall\b|\bschool\b|\bgym(nasium)?\b|\bchurch\b|\bcovered court\b|\bmunicipal hall\b/i;
const FAMILY = /\b(mom|mum|dad|mother|father|mama|papa|nanay|tatay|lola|lolo|grandma|grandpa|kids?|children|son|daughter|sister|brother|wife|husband|family)\b/i;
const ITEM_WORDS: [RegExp, ItemId][] = [
  [/\bflashlights?\b|\btorch\b/i, 'FLASHLIGHT'], [/\bradios?\b/i, 'RADIO'], [/\bpower ?banks?\b/i, 'POWER_BANK'],
  // "batteries"/"spare battery" = the Batteries item; "phone battery" is the phone's own charge.
  [/\bfirst[- ]aid\b/i, 'FIRST_AID_KIT'], [/\bbatteries\b|\bspare batter(y|ies)\b/i, 'BATTERIES'], [/\bsandbags?\b/i, 'SANDBAGS'],
  [/\btool(s|box)\b/i, 'TOOLS'], [/\bfuel\b/i, 'FUEL'], [/\bwhistle\b/i, 'WHISTLE'],
];

export function checkGrounding(text: string, g: GuardContext): string | null {
  for (const [re, why] of ALWAYS_FORBIDDEN) if (re.test(text)) return why;
  if (!g.placesAllowed && PLACES.test(text)) return 'invented-place';
  if (g.livesAlone && FAMILY.test(text)) return 'invented-household-member';
  for (const [re, item] of ITEM_WORDS) if (re.test(text) && !g.allowedItems.has(item)) return `unavailable-item:${item}`;
  return null;
}

/** Simpler guard for debrief narration (no inventory context). */
export function checkNarration(text: string): string | null {
  for (const [re, why] of ALWAYS_FORBIDDEN) if (why !== 'invented-resource' && re.test(text)) return why;
  return null;
}
