import { useApp } from '../../state/hooks';

// Replaced in M9 (this session).
export function Debrief() {
  const app = useApp();
  return <main className="screen"><section className="panel onboarding"><h2>Run complete</h2><button onClick={() => app.go('title')}>Back to title</button></section></main>;
}
