import { useEffect, useRef, useState } from 'react';
import { buildScenarioRequest } from '../../core/ai/scenario';
import { EVENT_BY_ID } from '../../core/content/events';
import type { ScenarioContent } from '../../shared/contracts/ai';
import { scenarioForCurrentEvent } from '../services/ai';
import { store } from '../state/engineStore';
import { useEngineState } from '../state/hooks';
import { ui } from '../state/uiStore';
import { speakerLabel } from './format';

export function EventDialog() {
  const state = useEngineState();
  const ev = state?.activeEvent ?? null;
  const key = ev ? `${ev.eventId}@${ev.triggeredAtMinute}` : null;
  const [content, setContent] = useState<{ key: string; c: ScenarioContent } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Focus the panel, not a choice: a key held or pressed for the world must never commit a scored decision.
  useEffect(() => { panel.current?.focus(); }, [key]);

  useEffect(() => { // once per event occurrence (blueprint §7)
    const st = store.state;
    if (!key || !st) return;
    const req = buildScenarioRequest(st);
    if (!req) return;
    let live = true;
    void scenarioForCurrentEvent(req, st.runId, key, () => store.activeEventKey()).then((c) => { if (live && c) setContent({ key, c }); });
    return () => { live = false; };
  }, [key]);

  if (!ev || !key) return null;
  const c = content?.key === key ? content.c : null; // never show text that belongs to another event
  const choices = store.engine.getEventChoices();
  const title = EVENT_BY_ID.get(ev.eventId)?.title ?? ev.eventId;
  const choose = (id: string) => {
    const r = store.dispatch((e) => e.resolveEvent(id));
    if (!r.ok) ui.toast({ kind: 'error', title: r.error.message, body: r.error.reasons?.join(' ') });
  };
  return (
    <div ref={panel} tabIndex={-1} className="panel event" role="dialog" aria-label={title}>
      <h2>{title} {c?.source === 'ai' && <span className="tag">AI-personalized</span>}</h2>
      {c ? (<>
        <p className="speaker">{speakerLabel(c.speaker)}</p>
        <p className="dialogue">{c.dialogue}</p>
        <p className="desc">{c.description}</p>
      </>) : <p className="loading" aria-busy="true">The scene is taking shape…</p>}
      <ul>
        {choices.map((a) => (
          <li key={a.actionId}>
            <button disabled={!a.available} onClick={() => choose(a.actionId)} title={a.reasons.join(' ')}>
              <span>{a.unsafe && <span className="unsafe" aria-label="unsafe">⚠ </span>}{a.label}</span>
              <span className="cost">{a.timeCostMinutes ? `${a.timeCostMinutes} min` : ''}</span>
            </button>
            {!a.available && a.reasons.length > 0 && <p className="reason">{a.reasons.join(' ')}</p>}
          </li>
        ))}
      </ul>
      <p className="fine">Fictional scenario for learning. In a real emergency, follow official advisories.</p>
    </div>
  );
}
