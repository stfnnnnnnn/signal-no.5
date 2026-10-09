import { useApp } from '../../state/hooks';

// Replaced in M8 (this session).
export function AchievementsScreen() {
  const app = useApp();
  return <main className="screen"><section className="panel onboarding"><h2>Achievements</h2><button onClick={() => app.go('title')}>Back to title</button></section></main>;
}
