// Educational findings (lessons + checklist). PLACEHOLDER WORDING pending review against PAGASA / NDRRMC-OCD /
// Philippine Red Cross material (project_context.md §11). Text is general preparedness guidance, never
// individual medical or emergency orders. The AI may only rephrase these, never add to them.
export interface FindingDef {
  id: string;
  safetyRuleId: string | null;
  strength: string;
  lesson: string;
  checklist: string;
}

export const FINDINGS: FindingDef[] = [
  { id: 'F_WATER', safetyRuleId: 'SR_STORE_WATER', strength: 'You stored enough drinking water for the household.', lesson: 'Store drinking water early, while tap water is still available.', checklist: 'Store drinking water for every household member for several days.' },
  { id: 'F_FOOD', safetyRuleId: 'SR_FOOD_SUPPLY', strength: 'You had enough ready-to-eat food.', lesson: 'Keep ready-to-eat food that does not need cooking.', checklist: 'Keep ready-to-eat, nonperishable food for several days.' },
  { id: 'F_GO_BAG', safetyRuleId: 'SR_GO_BAG', strength: 'Your go-bag was complete before the storm.', lesson: 'A packed go-bag saves time when you need to leave quickly.', checklist: 'Pack a go-bag with water, food, light, first aid, documents, clothing and hygiene items.' },
  { id: 'F_LIGHTING', safetyRuleId: 'SR_SAFE_LIGHTING', strength: 'You had backup lighting ready.', lesson: 'Power interruptions are common during typhoons; keep a flashlight or power bank ready.', checklist: 'Keep a flashlight with spare batteries or a charged power bank.' },
  { id: 'F_BULLETIN', safetyRuleId: 'SR_OFFICIAL_INFORMATION', strength: 'You checked official information early.', lesson: 'Check official advisories early and regularly.', checklist: 'Know where to find official typhoon advisories.' },
  { id: 'F_UPDATE', safetyRuleId: 'SR_OFFICIAL_INFORMATION', strength: 'You read the updated advisory.', lesson: 'Storm timing can change; read each update.', checklist: 'Follow updates as the storm approaches.' },
  { id: 'F_RUMOR', safetyRuleId: 'SR_VERIFY_INFORMATION', strength: 'You verified a rumor before acting on it.', lesson: 'Verify messages with official sources before acting or sharing them.', checklist: 'Verify messages with official sources before sharing.' },
  { id: 'F_POST_UPDATES', safetyRuleId: 'SR_OFFICIAL_INFORMATION', strength: 'You checked official updates after the storm.', lesson: 'Hazards can remain after a storm; follow official recovery updates.', checklist: 'Check official updates before returning to normal activities.' },
  { id: 'F_FAMILY_MEETING', safetyRuleId: 'SR_HOUSEHOLD_PLAN', strength: 'Your household agreed on a plan.', lesson: 'Agree on roles and a plan with your household before the storm.', checklist: 'Hold a household meeting to agree on the plan.' },
  { id: 'F_COMMUNICATION', safetyRuleId: 'SR_COMMUNICATION', strength: 'You set a communication plan.', lesson: 'Agree on how to reach each other and where to meet if separated.', checklist: 'Agree on contacts and a meeting point.' },
  { id: 'F_ACCOUNTED', safetyRuleId: 'SR_ACCOUNT_MEMBERS', strength: 'You made sure everyone was accounted for.', lesson: 'Check that every household member is safe and accounted for.', checklist: 'Account for every household member after the storm.' },
  { id: 'F_DESTINATION', safetyRuleId: 'SR_KNOW_DESTINATION', strength: 'You knew where to go if asked to evacuate.', lesson: 'Know your designated evacuation destination before you need it.', checklist: 'Find out where your designated evacuation center is.' },
  { id: 'F_ADVISORY_RESPONSE', safetyRuleId: 'SR_FOLLOW_OFFICIAL_ADVISORY', strength: 'You followed the evacuation advisory in time.', lesson: 'Follow official evacuation advisories early, before routes become unsafe.', checklist: 'Plan how your household will leave when an advisory is issued.' },
  { id: 'F_GO_BAG_BROUGHT', safetyRuleId: 'SR_GO_BAG', strength: 'You took the go-bag when you left.', lesson: 'Take your go-bag when you evacuate.', checklist: 'Keep the go-bag near the exit.' },
  { id: 'F_DOCUMENTS', safetyRuleId: 'SR_PROTECT_DOCUMENTS', strength: 'Your important documents were protected.', lesson: 'Keep important documents in waterproof storage.', checklist: 'Put important documents in waterproof storage.' },
  { id: 'F_MEDICATION', safetyRuleId: 'SR_MEDICATION_CONTINUITY', strength: 'You prepared essential supplies for a household member.', lesson: 'Prepare essential medication and supplies ahead of time; ask a health professional about continuity.', checklist: 'Prepare essential medication and supplies to take with you.' },
  { id: 'F_ASSISTANCE', safetyRuleId: 'SR_ASSISTANCE', strength: 'You arranged help for a household member who needs assistance.', lesson: 'Arrange help early for anyone who needs assistance to move or prepare.', checklist: 'Arrange who will help household members who need assistance.' },
  { id: 'F_PETS', safetyRuleId: 'SR_PETS', strength: 'You prepared supplies for your pet.', lesson: 'Include pets in your plan and pack their supplies.', checklist: 'Pack food and supplies for your pets.' },
  { id: 'F_CHILD', safetyRuleId: 'SR_CHILD_SUPPLIES', strength: 'You prepared child-care supplies.', lesson: 'Young children need their own supplies in the go-bag.', checklist: 'Pack child-care supplies.' },
  { id: 'F_POWERED_EQUIPMENT', safetyRuleId: 'SR_MEDICATION_CONTINUITY', strength: 'You planned for equipment that needs power.', lesson: 'Plan ahead for equipment that depends on electricity.', checklist: 'Plan backup power for essential equipment.' },
  { id: 'F_WARNING_SUPPORT', safetyRuleId: 'SR_COMMUNICATION', strength: 'You made sure warnings would reach everyone.', lesson: 'Make sure household members who need help receiving warnings will get them.', checklist: 'Agree on how warnings will reach every household member.' },
  { id: 'F_HOME_SECURED', safetyRuleId: 'SR_SECURE_HOME_EARLY', strength: 'You secured your home before the storm.', lesson: 'Secure loose items and windows early, while it is still safe outside.', checklist: 'Secure loose outdoor items before strong winds arrive.' },
  { id: 'F_FLOOD_PREP', safetyRuleId: 'SR_RAISE_BELONGINGS', strength: 'You prepared for flooding.', lesson: 'In flood-prone areas, move belongings and supplies higher in advance.', checklist: 'Move supplies and belongings to a higher place.' },
  { id: 'F_HAZARD_RESPONSE', safetyRuleId: 'SR_SHELTER_IN_PLACE', strength: 'You responded calmly to a hazard at home.', lesson: 'Stay indoors in the safest room and seek official help if needed.', checklist: 'Choose the safest room in your home in advance.' },
  { id: 'F_UNSAFE_ACTION', safetyRuleId: 'SR_STAY_INDOORS', strength: 'You avoided going outside during the storm.', lesson: 'Do not go outside during a typhoon to check on conditions.', checklist: 'Stay indoors during the storm.' },
  { id: 'F_LATE_PURCHASE', safetyRuleId: 'SR_PREPARE_EARLY', strength: '', lesson: 'Prices and availability can get worse as a storm gets closer; buy supplies early.', checklist: 'Buy essential supplies early.' },
];

export const FINDING_BY_ID: ReadonlyMap<string, FindingDef> = new Map(FINDINGS.map((x) => [x.id, x]));
