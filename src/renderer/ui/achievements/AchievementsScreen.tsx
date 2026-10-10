import { useEffect, useRef, useState } from 'react';
import { openAtTop } from '../scroll';
import { ACHIEVEMENT_CATALOG } from '../../../core/content/achievements';
import { BADGE_CATALOG } from '../../../core/content/badges';
import type { AchievementStatus } from '../../../shared/contracts/progress';
import { ICON_URLS } from '../../game/assets';
import { readAchievements, readEarnedBadges } from '../../services/persistence';
import { useApp } from '../../state/hooks';
import { achievementsView, badgeGallery } from './progressView';

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function AchievementsScreen() {
  const app = useApp();
  const [statuses, setStatuses] = useState<AchievementStatus[]>([]);
  const [earned, setEarned] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { openAtTop(panel.current); }, []);
  useEffect(() => {
    let live = true;
    void Promise.all([readAchievements(), readEarnedBadges()]).then(([a, b]) => { if (live) { setStatuses(a); setEarned(b); setLoaded(true); } });
    return () => { live = false; };
  }, []);
  const rows = achievementsView(ACHIEVEMENT_CATALOG, statuses);
  const badges = badgeGallery(BADGE_CATALOG, earned);
  const unlocked = rows.filter((r) => r.unlocked).length;

  return (
    <main className="screen">
      <section ref={panel} tabIndex={-1} className="panel onboarding wide progress-screen" aria-labelledby="ach">
        <h2 id="ach">Achievements</h2>
        <p className="hint">{loaded ? `${unlocked} of ${rows.length} unlocked across all your storms.` : 'Loading your progress…'}</p>
        <ul className="achievements">
          {rows.map((r) => (
            <li key={r.id} className={r.unlocked ? 'unlocked' : ''}>
              <img src={ICON_URLS[r.iconAssetId]} alt="" width={48} height={48} />
              <div>
                <strong>{r.name}</strong>
                <p>{r.description}</p>
                {r.unlocked && r.unlockedAt ? <p className="when">Unlocked {when(r.unlockedAt)}</p>
                  : r.target !== null && r.target > 1 ? (<>
                    <progress max={r.target} value={r.progress} aria-label={`${r.name} progress`} /> <span className="when">{r.progress} of {r.target}</span>
                  </>) : <p className="when">Not yet unlocked</p>}
              </div>
            </li>
          ))}
        </ul>
        <h3>Badges</h3>
        <p className="hint">Earned in at least one completed storm. Each run's debrief shows why a badge was or wasn't earned.</p>
        <ul className="badge-grid">
          {badges.map((b) => (
            <li key={b.id} className={b.earned ? 'earned' : ''} title={b.earned ? b.description : b.hint}>
              <img src={ICON_URLS[b.iconAssetId]} alt="" width={56} height={56} />
              <span>{b.name}</span>
            </li>
          ))}
        </ul>
        <button onClick={() => app.go('title')}>Back to title</button>
      </section>
    </main>
  );
}
