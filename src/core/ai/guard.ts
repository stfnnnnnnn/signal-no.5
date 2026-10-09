// Grounding guard: deterministic checks that AI text does not assert facts the game never approved.
// Heuristic by nature: it rejects detectable violations and the adapter falls back to reviewed text.
import type { ItemId } from '../../shared/contracts/ids';

export interface GuardContext {
  livesAlone: boolean;
  /** Items the text may mention (inventory + items referenced by the offered actions). */
  allowedItems: ReadonlySet<ItemId>;
  /** Whether the text may mention an evacuation destination (only at arrival). */
  placesAllowed: boolean;
  /** The configured home; when given, text that describes a different dwelling is rejected. */
  home?: HomeFacts;
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
  return g.home ? checkHousing(text, g.home) : null;
}

/** Simpler guard for debrief narration (no inventory context). */
export function checkNarration(text: string, home?: HomeFacts): string | null {
  for (const [re, why] of ALWAYS_FORBIDDEN) if (why !== 'invented-resource' && re.test(text)) return why;
  return home ? checkHousing(text, home) : null;
}

// ---------- housing ----------
/** The player's home as configured: legacy survey type (onboarding v2 always 'detached') + floors (1, 2, 3 = three or more). */
export interface HomeFacts { type: string; floors: number }

/** Plain words for the configured home, given to the model and used in reviewed text. */
export function describeHome(h: HomeFacts): string {
  if (h.type === 'townhouse' || h.type === 'apartment' || h.type === 'condominium') return h.type;
  return h.floors <= 1 ? 'single-story house' : h.floors === 2 ? 'two-story house' : 'multi-story house';
}

const DWELLINGS: [RegExp, string][] = [
  [/\bapartments?\b/gi, 'apartment'], [/\bcondo(minium)?s?\b/gi, 'condominium'], [/\btown ?houses?\b/gi, 'townhouse'],
];
const ONE_FLOOR = /\b(single|one)[- ]?(stor(e)?y|level|floor)\b|\bbungalows?\b/gi;
const TWO_FLOORS = /\btwo[- ]?(stor(e)?y|level|floor)\b/gi;
const UPPER_FLOOR = /\bupstairs\b|\b(second|upper) floors?\b/gi;
const MULTI_FLOORS = /\b(three|multi|multiple)[- ]?(stor(e)?y|level|floor)s?\b|\bthird floor\b/gi;
/** A mention preceded by these words is about somewhere else ("a neighbour in the apartment block nearby"). */
const ELSEWHERE = /\b(neighbou?rs?'?s?|next door|nearby|across|other|another|someone|their)\b[^.!?]{0,30}$/i;
const nearbyAfter = (text: string, end: number) => /^[^.!?]{0,25}\b(nearby|next door|across the (street|road))\b/i.test(text.slice(end));

function aboutThisHome(text: string, m: RegExpExecArray): boolean {
  return !ELSEWHERE.test(text.slice(Math.max(0, m.index - 40), m.index)) && !nearbyAfter(text, m.index + m[0].length);
}
function firstHomeMention(text: string, re: RegExp): boolean {
  for (const m of text.matchAll(re)) if (aboutThisHome(text, m as RegExpExecArray)) return true;
  return false;
}

/**
 * Deterministic housing check: rejects text that calls the player's home a different kind of dwelling or gives it a
 * different number of floors. Mentions clearly about somewhere else (a neighbour's apartment block) are allowed.
 */
export function checkHousing(text: string, h: HomeFacts): string | null {
  for (const [re, kind] of DWELLINGS) if (kind !== h.type && firstHomeMention(text, re)) return `housing:${kind}`;
  const wrongFloors = h.floors <= 1 ? [TWO_FLOORS, UPPER_FLOOR, MULTI_FLOORS] : h.floors === 2 ? [ONE_FLOOR, MULTI_FLOORS] : [ONE_FLOOR, TWO_FLOORS];
  for (const re of wrongFloors) if (firstHomeMention(text, re)) return 'housing:floors';
  return null;
}
