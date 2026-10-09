// Badge catalog B01–B12 (display metadata). Supersedes GD §15 B01–B10 (see SPEC_RECONCILIATION R17).
// Unlock rules live in src/core/evaluation/badges.ts (B01 Handa: src/core/evaluation/handa.ts).
import type { BadgeId } from '../../shared/contracts/ids';

export interface BadgeMeta { id: BadgeId; name: string; competency: string; description: string; hint: string; iconAssetId: string }

export const BADGE_CATALOG: BadgeMeta[] = [
  { id: 'B01', name: 'Handa', competency: 'Comprehensive household preparedness and responsible typhoon decisions', iconAssetId: 'badge_b01_handa',
    description: 'Finished the typhoon with at least 85% wellbeing and every applicable critical preparedness requirement met.', hint: 'Prepare every critical need, follow official advice, keep everyone accounted for and stay safe.' },
  { id: 'B02', name: 'Go-Bag Ready', competency: 'Emergency kit', iconAssetId: 'badge_b02_go_bag_ready',
    description: 'Packed every applicable go-bag category before the preparation deadline.', hint: 'Pack the go-bag before the evacuation advisory (or heavy rain).' },
  { id: 'B03', name: 'Tubig Muna', competency: 'Drinking water', iconAssetId: 'badge_b03_tubig_muna',
    description: 'Stored three days of drinking water for the whole household before the water supply was interrupted.', hint: 'Store 12 L per household member early.' },
  { id: 'B04', name: 'Botika Run', competency: 'Essential medication and supplies', iconAssetId: 'badge_b04_botika_run',
    description: 'Prepared the essential medication or supplies the household needs before the storm, without over-buying.', hint: 'Check the medicine cabinet, get one refill if needed, and pack it.' },
  { id: 'B05', name: 'Fact Checker', competency: 'Verified information', iconAssetId: 'badge_b05_fact_checker',
    description: 'Verified a rumour with an official source before acting on or sharing it.', hint: 'Verify unconfirmed messages; never forward them.' },
  { id: 'B06', name: 'Bayanihan', competency: 'Helping neighbours safely', iconAssetId: 'badge_b06_bayanihan',
    description: 'Helped Aling Nena get ready and register for official assistance before the advisory.', hint: 'Visit Aling Nena early, while it is still safe outside.' },
  { id: 'B07', name: 'Maagang Lumikas', competency: 'Timely evacuation', iconAssetId: 'badge_b07_maagang_lumikas',
    description: 'Followed the evacuation advisory and left before the route became unsafe.', hint: 'When an advisory is issued, leave early with your go-bag.' },
  { id: 'B08', name: 'Walang Maiiwan', competency: 'Household accountability', iconAssetId: 'badge_b08_walang_maiiwan',
    description: 'Accounted for everyone, arranged needed assistance, prepared for pets, and evacuated together when advised.', hint: 'Arrange help early and check on every household member.' },
  { id: 'B09', name: 'Bintana Boss', competency: 'Window protection', iconAssetId: 'badge_b09_bintana_boss',
    description: 'Protected the applicable windows before dangerous weather began.', hint: 'Get tools and prepare windows before heavy rain.' },
  { id: 'B10', name: 'Bubong Secured', competency: 'Safe roof preparation', iconAssetId: 'badge_b10_bubong_secured',
    description: 'Completed safe roof preparation before dangerous winds began.', hint: 'Arrange roof preparation early; never on the roof in a storm.' },
  { id: 'B11', name: 'Family Plan', competency: 'Household plan', iconAssetId: 'badge_b11_family_plan',
    description: 'Set a meeting point, identified the evacuation center, and coordinated the household.', hint: 'Agree on a meeting point and find out where to evacuate.' },
  { id: 'B12', name: 'Powered Up', competency: 'Communication and lighting', iconAssetId: 'badge_b12_powered_up',
    description: 'Reached landfall with working light and a charged phone or charged power bank.', hint: 'Charge the phone and power bank and keep a light ready.' },
];

export const BADGE_META: ReadonlyMap<string, BadgeMeta> = new Map(BADGE_CATALOG.map((b) => [b.id, b]));
