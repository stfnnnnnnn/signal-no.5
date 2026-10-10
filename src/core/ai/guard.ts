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
  /** Scenario facts; when given, hazard, location and timing claims are checked against them. */
  scene?: ScenarioFacts;
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
  return (g.home ? checkHousing(text, g.home) : null) ?? checkStructure(text) ?? checkHazards(text, g.scene) ?? (g.scene ? checkTiming(text, g.scene) : null);
}

/** Simpler guard for debrief narration (no inventory context). */
export function checkNarration(text: string, home?: HomeFacts): string | null {
  for (const [re, why] of ALWAYS_FORBIDDEN) if (why !== 'invented-resource' && re.test(text)) return why;
  return (home ? checkHousing(text, home) : null) ?? checkStructure(text) ?? checkHazards(text);
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

// ---------- scenario: structure, hazards, location, timing ----------
/** Deterministic scenario facts the narration must not contradict (all taken from the AI request). */
export interface ScenarioFacts {
  landfallRevealed: boolean;
  /** Hours until landfall, or null while the game keeps the timing hidden from the player. */
  hoursToLandfall: number | null;
  /** Engine flood severity ('none' | 'low' | 'moderate' | 'severe'), or undefined when unknown (older requests). */
  floodSeverity?: string;
  powerAvailable: boolean;
  location: 'home' | 'inTransit' | 'evacuationCenter';
}

const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
/** The sentence is about this household or this place (as opposed to general education or somewhere else). */
const HOUSEHOLD_REF = /\b(our|your)\s+(house|home|street|yard|room|area|neighbou?rhood|family|floor|place)\b|\b(the|this)\s+(house|home|street|yard|first floor)\b|\bhere\b|\b(we|you)('re| are| were)\b|\bat home\b/i;
const aboutHousehold = (sentence: string) => HOUSEHOLD_REF.test(sentence) && !ELSEWHERE.test(sentence.slice(0, sentence.search(HOUSEHOLD_REF) + 40));

/** Parts no supported home has (every home is a single-, two- or multi-story house on the fixed floor plan). */
const STRUCTURES: [RegExp, string][] = [
  [/\bbasements?\b/gi, 'basement'], [/\b(attics?|lofts?)\b/gi, 'attic'], [/\broof ?top\b/gi, 'rooftop'], // plural 'rooftops' = the neighbourhood
  [/\b(storm )?cellars?\b|\bbunkers?\b|\bsafe ?rooms?\b|\bpanic rooms?\b/gi, 'shelter-room'],
];
export function checkStructure(text: string): string | null {
  for (const [re, kind] of STRUCTURES) if (firstHomeMention(text, re)) return `structure:${kind}`;
  return null;
}

const SURGE = /\bstorm surges?\b/i;
/** A direct statement that someone here IS trapped (not education, not 'nobody was trapped'). */
const TRAPPED = /\b(we|you|everyone|they|the family|the household)('re| are| were| was| is| got|'ve been| have been)\s+(now\s+|still\s+)?(trapped|stranded)\b/i;
/** Hypothetical or conditional wording before a claim makes it not a claim about now. */
const HYPOTHETICAL = /\b(if|in case|what if|could|might|may|would|unless|before|whether)\b/i;
const assertedNow = (s: string, re: RegExp) => { const m = re.exec(s); return !!m && !HYPOTHETICAL.test(s.slice(0, m.index)); };
const FLOODED_NOW = [
  /\b(water|floodwaters?|flood ?water)s? (is|are|has|have) (already |now )?(inside|in the (house|home|living room|kitchen|bedroom)|entered|coming in(to)?|seeping in)\b/i,
  /\b(house|home|living room|kitchen|bedroom|floor|street|yard|room)s? (is|are) (already |now )?(flooded|flooding|under ?water)\b/i,
  /\bwe('re| are) (flooded|under ?water)\b/i,
];
const POWER_OUT = /\b(power|electricity|lights?)('s| is| are| has| have| went)( (already|now|just))?( gone)? (out|off|down|cut)\b/i;
const AT_HOME = /\b(we('re| are)|you('re| are)|everyone('s| is)|the family is)( still)? (at home|inside the house|in the house|home)\b/i;

/** Claims about the household's current situation must match the engine (general education is allowed). */
export function checkHazards(text: string, f?: ScenarioFacts): string | null {
  for (const s of sentencesOf(text)) {
    if (SURGE.test(s) && aboutHousehold(s)) return 'hazard:storm-surge'; // the game has no storm surge
    if (TRAPPED.test(s)) return 'hazard:trapped';                          // the game never traps the household
    if (!f) continue;
    if (f.floodSeverity === 'none' && FLOODED_NOW.some((re) => assertedNow(s, re))) return 'hazard:flooding';
    if (f.powerAvailable && assertedNow(s, POWER_OUT)) return 'hazard:power';
    if (f.location !== 'home' && AT_HOME.test(s)) return `location:${f.location}`;
  }
  return null;
}

const STORM_CONTEXT = /\b(typhoon|storm|landfall|rain|water|flood\w*|winds?|hits?|strikes?|arriv\w*|coming|comes|rises?|reach\w*)\b/i;
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twelve: 12, 'twenty-four': 24, 'twenty four': 24, 'forty-eight': 48, 'forty eight': 48 };
const NUM = String.raw`(\d{1,3}|one|two|three|four|five|six|twelve|twenty[- ]four|forty[- ]eight)`;
/** Only time anchored to the storm's arrival ('in 40 hours', '24 hours away'); not durations ('for 3 days', 'since', 'ago'). */
const COUNTDOWN = new RegExp(String.raw`\b(?:in|within|about|around|roughly|nearly|under|next)\s+(?:the\s+next\s+|about\s+|around\s+)?` + NUM
  + String.raw`\s+(?:more\s+)?(hours?|hrs?|days?)\b|\b` + NUM + String.raw`\s+(hours?|hrs?|days?)\s+(?:away|until|left|to go|from now)\b`, 'gi');
const LANDFALL_HAPPENED = /\b(has|have|had) (already |now |just )?(made landfall|hit|struck|arrived)\b|\bis (now |already )?(hitting|making landfall)\b/i;

/** No countdown while timing is hidden; once revealed it must match; landfall can't be narrated before it happens. */
export function checkTiming(text: string, f: ScenarioFacts): string | null {
  const beforeLandfall = f.hoursToLandfall === null || f.hoursToLandfall > 0;
  for (const s of sentencesOf(text)) {
    if (!STORM_CONTEXT.test(s)) continue;
    if (beforeLandfall && /\b(typhoon|storm)\b/i.test(s) && LANDFALL_HAPPENED.test(s)) return 'timing:future-phase';
    for (const m of s.matchAll(COUNTDOWN)) {
      const after = s.slice(m.index! + m[0].length, m.index! + m[0].length + 12);
      if (/\b(since|ago)\b/i.test(after)) continue;                    // elapsed time, not a countdown
      if (!f.landfallRevealed || f.hoursToLandfall === null) return 'timing:hidden';
      if (f.hoursToLandfall <= 0) continue;                             // after landfall there is no countdown to contradict
      const word = (m[1] ?? m[3])!, unit = (m[2] ?? m[4])!;
      const n = Number(word) || WORD_NUMBERS[word.toLowerCase()] || 0;
      const hours = /^day/i.test(unit) ? n * 24 : n;
      if (Math.abs(hours - f.hoursToLandfall) > Math.max(3, f.hoursToLandfall * 0.15)) return 'timing:contradiction';
    }
  }
  return null;
}
