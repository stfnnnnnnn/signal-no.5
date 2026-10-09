import { useState } from 'react';
import { MAX_HOUSEHOLD_SIZE, SIZE_BOUNDS, type QuestionDef } from '../../../shared/contracts/onboarding';
import { useApp } from '../../state/hooks';
import {
  ageTotal, answered, emptyCustom, emptyRandom, householdSize, questionsFor, toggleChoice, visible,
  type CustomDraft, type Draft, type RandomDraft,
} from './onboardingModel';

/** One question per step, rendered from the backend's ONBOARDING_QUESTIONS. Validation happens at "Review". */
export function OnboardingFlow({ path }: { path: 'custom' | 'random' }) {
  const app = useApp();
  const [draft, setDraft] = useState<Draft>(() => (app.setup?.mode === path ? app.setup.draft : path === 'custom' ? emptyCustom() : emptyRandom()));
  const steps = questionsFor(path).filter((q) => visible(q, draft));
  const [index, setIndex] = useState(0);
  const step = Math.min(index, steps.length - 1);
  const q = steps[step]!;
  const set = (field: string, value: unknown) => setDraft((d) => ({ ...d, [field]: value }));
  const next = () => (step === steps.length - 1 ? app.prepare(path, draft, app.setup?.seed) : setIndex(step + 1));
  const back = () => (step === 0 ? app.go('mode') : setIndex(step - 1));

  return (
    <main className="screen">
      <section className="panel onboarding" aria-labelledby="question">
        <p className="progress" aria-label={`Question ${step + 1} of ${steps.length}`}>
          {steps.map((s, i) => <i key={s.id} className={i < step ? 'done' : i === step ? 'now' : ''} />)}
        </p>
        <h2 id="question">{q.text}</h2>
        {q.optional && <p className="hint">Optional. Skip it and the game chooses for you.</p>}
        <QuestionView q={q} draft={draft} set={set} />
        <div className="row-actions">
          <button className="ghost" onClick={back}>Back</button>
          <button onClick={next} disabled={!answered(q, draft)}>{step === steps.length - 1 ? 'Review household' : 'Next'}</button>
        </div>
      </section>
    </main>
  );
}

function QuestionView({ q, draft, set }: { q: QuestionDef; draft: Draft; set: (f: string, v: unknown) => void }) {
  const value = (draft as unknown as Record<string, unknown>)[q.field];
  if (q.kind === 'single') {
    return (
      <div className="choices" role="radiogroup" aria-label={q.text}>
        {q.choices!.map((c) => (
          <button key={c.value} role="radio" aria-checked={value === c.value} className={value === c.value ? 'choice on' : 'choice'} onClick={() => set(q.field, c.value)}>
            <strong>{c.label}</strong>{c.detail && <span>{c.detail}</span>}
          </button>
        ))}
      </div>
    );
  }
  if (q.kind === 'multi') {
    const selected = (value as string[]) ?? [];
    return (
      <div className="choices" role="group" aria-label={q.text}>
        <p className="hint">Choose all that apply.</p>
        {q.choices!.map((c) => (
          <button key={c.value} role="checkbox" aria-checked={selected.includes(c.value)} className={selected.includes(c.value) ? 'choice on' : 'choice'} onClick={() => set(q.field, toggleChoice(selected, c.value, q))}>
            <strong>{c.label}</strong>
          </button>
        ))}
      </div>
    );
  }
  if (q.kind === 'number') {
    const d = draft as CustomDraft;
    const [lo, hi] = d.q2SizeRange ? SIZE_BOUNDS[d.q2SizeRange] : [1, MAX_HOUSEHOLD_SIZE];
    return (
      <label className="number-field">
        <span>Between {lo} and {hi}</span>
        <input type="number" min={lo} max={hi} value={d.q2ExactSize ?? ''} autoFocus
          onChange={(e) => set('q2ExactSize', e.target.value === '' ? undefined : Number(e.target.value))} />
      </label>
    );
  }
  // counters (Q3 age groups)
  const d = draft as CustomDraft;
  const size = householdSize(d);
  const total = ageTotal(d);
  return (
    <div className="counters">
      {q.choices!.map((c) => {
        const n = d.q3AgeCounts[c.value as keyof CustomDraft['q3AgeCounts']];
        const change = (delta: number) => set('q3AgeCounts', { ...d.q3AgeCounts, [c.value]: Math.max(0, Math.min(MAX_HOUSEHOLD_SIZE, n + delta)) });
        return (
          <div key={c.value} className="counter">
            <span>{c.label}</span>
            <button className="step" aria-label={`Fewer ${c.label}`} onClick={() => change(-1)} disabled={n === 0}>−</button>
            <output aria-live="polite">{n}</output>
            <button className="step" aria-label={`More ${c.label}`} onClick={() => change(1)}>+</button>
          </div>
        );
      })}
      <p className={size !== undefined && total !== size ? 'hint warn' : 'hint'} aria-live="polite">
        {total} of {size ?? '?'} household members counted
      </p>
    </div>
  );
}

export type { RandomDraft };
