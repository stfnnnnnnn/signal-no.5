import { useEffect, useMemo, useRef, useState } from 'react';
import type { DebriefNarration } from '../../../shared/contracts/debrief';
import { ICON_URLS } from '../../game/assets';
import { narrateDebriefOnce } from '../../services/ai';
import { markPlanViewedOnce } from '../../services/persistence';
import { finishRun } from '../../services/runEnd';
import { store } from '../../state/engineStore';
import { useApp } from '../../state/hooks';
import { debriefModel } from './debriefModel';
import { openAtTop } from '../scroll';

const OBJ_MARK = { met: '■', notMet: '□', notApplicable: '–' } as const;
const time = (m: number) => `Day ${Math.floor(m / 1440) + 1}, ${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

export function Debrief() {
  const app = useApp();
  // The finished run, captured once: later state churn (focus pause/resume) must not rebuild the debrief.
  const [state] = useState(() => store.state);
  const ev = useMemo(() => (state ? store.engine.evaluate() : null), [state]);
  const [narration, setNarration] = useState<(DebriefNarration & { source: 'ai' | 'fallback' }) | null>(null);
  const [guide, setGuide] = useState(false);
  const top = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!state || !ev) return;
    let live = true;
    void finishRun(state, ev);
    void narrateDebriefOnce(ev, state).then((n) => { if (live) setNarration(n); });
    return () => { live = false; };
  }, [state, ev]);
  useEffect(() => { if (guide && state) void markPlanViewedOnce(state.runId); }, [guide, state]);
  // Both views open at the top (distinct keys stop React reusing the scrolled <section>).
  useEffect(() => { openAtTop(top.current); }, [guide]);

  if (!state || !ev) return <main className="screen"><section className="panel onboarding"><h2>No finished run to show.</h2><button onClick={() => app.go('title')}>Back to title</button></section></main>;
  const m = debriefModel(ev);

  if (guide) return (
    <main className="screen">
      <section key="guide" ref={top} tabIndex={-1} className="panel onboarding wide guide" aria-labelledby="guide">
        <h2 id="guide">Your preparedness plan</h2>
        <p className="hint">Built from this household and this storm. General guidance for learning: always follow official advisories and your local evacuation plan.</p>
        <h3>Checklist</h3>
        <ul className="checklist plan">{m.guide.checklist.map((c) => <li key={c}><span aria-hidden="true">□</span> {c}</li>)}</ul>
        <h3>What to remember</h3>
        <ul className="lessons">{m.guide.lessons.map((l) => <li key={l}>{l}</li>)}</ul>
        <div className="row-actions">
          <button className="ghost" onClick={() => window.print()}>Print</button>
          <button onClick={() => setGuide(false)}>Back to the debrief</button>
        </div>
      </section>
    </main>
  );

  return (
    <main className="screen">
      <section key="debrief" ref={top} tabIndex={-1} className="panel onboarding wide debrief" aria-labelledby="debrief">
        <h2 id="debrief">After the storm</h2>
        <div className="debrief-top">
          <div className="score-card">
            <span className="score">{m.score}<small>/100</small></span>
            <strong>{m.ending.label}</strong>
            <p>{m.ending.text}</p>
          </div>
          <div className={`handa-card ${m.handa.earned ? 'earned' : ''}`}>
            <img src={ICON_URLS.badge_b01_handa} alt="" width={56} height={56} />
            <div>
              <strong>Handa badge: {m.handa.earned ? 'earned' : 'not earned'}</strong>
              <p>Wellbeing {m.handa.wellbeing.percent}% (needs {m.handa.wellbeing.threshold}%) {m.handa.wellbeing.met ? '■' : '□'}</p>
              <ul className="handa-list">
                {m.handa.objectives.map((o) => <li key={o.id} className={o.status}><span aria-hidden="true">{OBJ_MARK[o.status]}</span> {o.text}{o.status === 'notApplicable' && ' (not applicable)'}</li>)}
                <li className={m.handa.evacuationAndAssistanceMet ? 'met' : 'notMet'}><span aria-hidden="true">{m.handa.evacuationAndAssistanceMet ? '■' : '□'}</span> Evacuation and assistance needs handled safely</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="narration">
          {narration ? (<>
            {narration.source === 'ai' && <span className="tag">AI-personalized</span>}
            <p>{narration.summary}</p>
          </>) : <p className="loading" aria-busy="true">Summarising your storm…</p>}
        </div>

        <h3>How each area went</h3>
        <ul className="categories">{m.categories.map((c) => <li key={c.id}><span>{c.label}</span><meter min={0} max={100} value={c.percent} /> <b>{c.percent}%</b></li>)}</ul>

        <div className="two-col">
          <div><h3>What went well</h3><ul className="lessons">{m.strengths.map((s) => <li key={s}>{s}</li>)}</ul>{m.strengths.length === 0 && <p className="hint">Nothing yet — the plan below is a good start.</p>}</div>
          <div><h3>What to do next time</h3><ul className="lessons gaps">{m.gaps.map((g) => <li key={g}>{g}</li>)}</ul>{m.gaps.length === 0 && <p className="hint">No gaps this time.</p>}</div>
        </div>

        <h3>Badges this storm</h3>
        <ul className="badge-grid debrief-badges">
          {m.badges.map((b) => (
            <li key={b.id} className={`tone-${b.tone} ${b.status === 'earned' ? 'earned' : ''}`} title={b.reasons.join(' ') || b.hint}>
              <img src={ICON_URLS[b.icon]} alt="" width={48} height={48} />
              <span>{b.name}</span><small>{b.label}</small>
            </li>
          ))}
        </ul>

        <details className="timeline">
          <summary>What you did, hour by hour ({m.timeline.length} decisions)</summary>
          <ol>{m.timeline.map((t) => <li key={t.seq}><span>{time(t.atMinute)}</span> {t.label}</li>)}</ol>
        </details>

        <div className="row-actions">
          <button onClick={() => setGuide(true)}>Open my preparedness plan</button>
          <button className="ghost" onClick={() => app.go('achievements')}>Achievements</button>
          <button className="ghost" onClick={() => app.go('mode')}>New household</button>
          <button onClick={() => app.replay()}>Play again with this household</button>
          <button className="ghost" onClick={() => app.go('title')}>Title</button>
        </div>
      </section>
    </main>
  );
}
