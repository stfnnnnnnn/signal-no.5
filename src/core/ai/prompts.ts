// Prompt templates. Compact by design (~350–600 tokens): only the request JSON, never the design docs.
import type { DebriefNarrationRequest, ScenarioAIRequest } from '../../shared/contracts/ai';

export interface ChatMessage { role: 'system' | 'user'; content: string }

const SCENARIO_SYSTEM = [
  'You write short in-character lines for an educational 8-bit typhoon-preparedness game set in a fictional Filipino community.',
  'The game has already chosen the event, its variant and the player choices. Write content that fits them.',
  'Rules:',
  '- Use only the facts, household members and items given. Mention no other people, places, items, organisations or services.',
  '- Never state forecasts, warning levels, advisory contents, evacuation destinations, phone numbers, websites, medical instructions or safety guarantees.',
  '- Do not tell the player what to do; the choices are shown separately.',
  '- Timing: if state.hoursToLandfall is null the timing is unknown; never give hours or days until landfall, say conditions are expected to worsen. Never describe landfall as having happened before it has.',
  '- Describe flooding, power and where the household is only as given in state (floodSeverity, powerAvailable, location). Never mention storm surge, a basement, attic, rooftop or safe room, and never say anyone is trapped.',
  '- The home of the player is exactly household.homeDescription. Call it that, or simply "home" or "house". Never call it an apartment, condominium or townhouse unless that is the homeDescription, and never give it a different number of floors.',
  '- Calm, empathetic, plain English. Dialogue at most 170 characters; description at most 140 characters, one sentence.',
  'Reply with JSON only: {"schemaVersion":1,"eventId","variantId" (copy it),"speaker" (one of allowedSpeakers),"dialogue","description","actionIds" (copy allowedActionIds exactly, same order)}.',
].join('\n');

export function buildPromptMessages(req: ScenarioAIRequest): ChatMessage[] {
  return [
    { role: 'system', content: SCENARIO_SYSTEM },
    { role: 'user', content: JSON.stringify(req) },
  ];
}

const DEBRIEF_SYSTEM = [
  'You summarise a finished run of an educational typhoon-preparedness game for the player, warmly and briefly.',
  'Use only the strengths and gaps given; do not add advice, numbers, places, phone numbers, websites or medical instructions.',
  'If you mention the home, use only home.description (or simply "home").',
  'Reply with JSON only: {"summary": at most 300 characters, "highlightFindingIds": up to 3 ids taken from the given strengths or gaps}.',
].join('\n');

export function buildDebriefMessages(req: DebriefNarrationRequest): ChatMessage[] {
  return [
    { role: 'system', content: DEBRIEF_SYSTEM },
    { role: 'user', content: JSON.stringify(req) },
  ];
}
