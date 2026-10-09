// Cross-run achievement catalog A01–A10 (display metadata). Rules: src/core/evaluation/achievements.ts.
import type { AchievementId } from '../../shared/contracts/progress';

export interface AchievementMeta { id: AchievementId; name: string; description: string; iconAssetId: string }

export const ACHIEVEMENT_CATALOG: AchievementMeta[] = [
  { id: 'A01', name: 'First Storm', description: 'Complete your first full playthrough.', iconAssetId: 'achievement_a01_first_storm' },
  { id: 'A02', name: 'Natuto', description: 'Score higher than in an earlier completed run.', iconAssetId: 'achievement_a02_natuto' },
  { id: 'A03', name: 'Lesson Collector', description: 'Unlock every lesson card.', iconAssetId: 'achievement_a03_lesson_collector' },
  { id: 'A04', name: 'Signal Master', description: 'Earn Handa under the highest environmental exposure.', iconAssetId: 'achievement_a04_signal_master' },
  { id: 'A05', name: 'Kapos Pero Handa', description: 'Earn Handa with the smallest starting budget.', iconAssetId: 'achievement_a05_kapos_pero_handa' },
  { id: 'A06', name: 'Storm Chaser', description: 'Complete five different storms.', iconAssetId: 'achievement_a06_storm_chaser' },
  { id: 'A07', name: 'No Rumor Spreader', description: 'Finish five runs with a rumour without sharing it.', iconAssetId: 'achievement_a07_no_rumor_spreader' },
  { id: 'A08', name: 'Whole Barangay', description: 'Complete a Bayanihan community-assistance action in five different completed runs.', iconAssetId: 'achievement_a08_whole_barangay' },
  { id: 'A09', name: 'My Real Home', description: 'Complete a run using Customize My Household.', iconAssetId: 'achievement_a09_my_real_home' },
  { id: 'A10', name: 'Plan in Hand', description: 'View your personalised preparedness plan after a run.', iconAssetId: 'achievement_a10_plan_in_hand' },
];
