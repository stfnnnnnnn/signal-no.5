// Survey responses → validated HouseholdProfile v2 (+ roster). See docs/implementation/SURVEY_TO_GAMESTATE_MAPPING.md.
import type { AgeGroup, Sex, SpriteBase } from '../../shared/contracts/ids';
import type { HouseholdMember, HouseholdProfile } from '../../shared/contracts/household';
import { CompleteSurvey, SurveyResponses, type ParsedSurvey } from '../../shared/contracts/survey';
import { createRng, deriveSeed } from '../rng';
import { applyGeneration } from './fictional';

export interface ValidationIssue { path: (string | number)[]; message: string }
export type BuildResult = { ok: true; profile: HouseholdProfile } | { ok: false; issues: ValidationIssue[] };

const toIssues = (e: { issues: { path: PropertyKey[]; message: string }[] }): ValidationIssue[] =>
  e.issues.map((i) => ({ path: i.path.map((p) => (typeof p === 'number' ? p : String(p))), message: i.message }));

/** Roster order: adults first (default player = first adult), then teens, children, infants. */
const ROSTER_ORDER: AgeGroup[] = ['age36to59', 'age18to35', 'age60plus', 'age13to17', 'age5to12', 'age0to4'];
const isChild = (g: AgeGroup) => g === 'age0to4' || g === 'age5to12' || g === 'age13to17';
const MAX_VISIBLE_NPCS = 3;

const medicalTri = (v: string | undefined) => (v === 'yes' ? 'yes' : v === 'no' ? 'no' : v === 'preferNotToSay' ? 'undisclosed' : 'unknown') as 'yes' | 'no' | 'unknown' | 'undisclosed';
const tri = (v: string | undefined) => (v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'unknown') as 'yes' | 'no' | 'unknown';

function buildRoster(s: ParsedSurvey, seed: number): HouseholdMember[] {
  const rng = createRng(deriveSeed(seed, 'household:roster'));
  const grid = s.q2AgeGrid!;
  const members: HouseholdMember[] = [];
  for (const g of ROSTER_ORDER) {
    const row = grid[g];
    const sexes: Sex[] = [...Array(row.male).fill('male'), ...Array(row.female).fill('female'), ...Array(row.unspecified).fill('unspecified')];
    for (const sex of sexes) {
      const child = isChild(g);
      const presentation = sex === 'unspecified' ? (rng.chance(0.5) ? 'male' : 'female') : sex;
      const spriteBase: SpriteBase = child ? (presentation === 'male' ? 'boy' : 'girl') : (presentation === 'male' ? 'dad' : 'mom');
      const n = members.length + 1;
      members.push({
        id: `M${n}`, ageGroup: g, sex, spriteBase,
        clothingVariant: s.q25Appearance === 'randomize' ? rng.int(0, 3) : (n - 1) % 4,
        paletteId: `pal_${spriteBase}_${(n - 1) % 4}`,
        dependent: g === 'age0to4', isPlayer: false, visibleNpc: false, npcId: null,
      });
    }
  }
  const defaultPlayer = members.findIndex((m) => !isChild(m.ageGroup));
  const playerIdx = s.q25PlayerMemberIndex ?? (defaultPlayer >= 0 ? defaultPlayer : 0);
  const player = members[playerIdx]!;
  player.isPlayer = true;
  if (s.q25Appearance === 'customColor' && s.q25ClothingColor) player.paletteId = 'custom';
  let shown = 0;
  for (const m of members) {
    if (m.isPlayer || m.dependent || shown >= MAX_VISIBLE_NPCS) continue;
    m.visibleNpc = true; m.npcId = `NPC_${m.id}`; shown++;
  }
  return members;
}

export function buildHouseholdProfile(input: SurveyResponses, opts: { seed: number }): BuildResult {
  const first = SurveyResponses.safeParse(input);
  if (!first.success) return { ok: false, issues: toIssues(first.error) };
  const generated = applyGeneration(input, first.data, opts.seed);
  const checked = CompleteSurvey.safeParse(generated);
  if (!checked.success) return { ok: false, issues: toIssues(checked.error) };
  const s = checked.data;
  const members = buildRoster(s, opts.seed);
  const profile: HouseholdProfile = {
    schemaVersion: 2,
    mode: s.q3Mode,
    seed: opts.seed,
    size: members.length,
    members,
    playerMemberId: members.find((m) => m.isPlayer)!.id,
    assistance: { required: tri(s.q4Assistance), count: s.q4Assistance === 'yes' ? s.q4AssistanceCount ?? 1 : 0 },
    pets: { present: s.q5Pets === true, types: s.q5PetTypes },
    housing: {
      type: s.q6Housing!, floors: s.q7Floors === '1' ? 1 : s.q7Floors === '2' ? 2 : 3,
      surroundings: s.q8Surroundings!, floodHistory: s.q9FloodHistory!, roof: s.q10Roof!, exits: s.q11Exits!,
    },
    medical: {
      conditionPresent: medicalTri(s.q12MedicalCondition),
      conditionCategories: s.q13ConditionCategories,
      essentialMedication: medicalTri(s.q14EssentialMedication),
      allergies: medicalTri(s.q15Allergies),
      allergyCategories: s.q15AllergyCategories,
      equipment: s.q16Equipment,
      warningAssistance: medicalTri(s.q17WarningAssistance),
    },
    preparedness: {
      goBag: s.q18GoBag!, supplies: s.q19Supplies, evacuationPlan: s.q20EvacuationPlan!,
      evacuationCenterKnown: tri(s.q21EvacuationCenterKnown), communicationPlan: s.q22CommunicationPlan!,
      warningSources: s.q23WarningSources, backupPower: s.q24BackupPower,
    },
    theme: s.q26Theme!,
    budgetTier: s.budgetTier ?? 'moderate',
    appearance: { choice: s.q25Appearance, clothingColor: s.q25ClothingColor ?? null },
  };
  return { ok: true, profile };
}
