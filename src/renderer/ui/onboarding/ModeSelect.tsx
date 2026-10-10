import { ONBOARDING_QUESTIONS } from '../../../shared/contracts/onboarding';
import { useApp } from '../../state/hooks';

const Q0 = ONBOARDING_QUESTIONS.find((q) => q.id === 'Q0')!;

export function ModeSelect() {
  const app = useApp();
  return (
    <main className="screen">
      <section className="panel onboarding" aria-labelledby="q0">
        <h2 id="q0">{Q0.text}</h2>
        <div className="mode-cards">
          {Q0.choices!.map((c, i) => (
            <button key={c.value} className="mode-card" autoFocus={i === 0} onClick={() => app.go(c.value === 'custom' ? 'custom' : 'random')}>
              <strong>{c.label}</strong>
              <span>{c.detail}</span>
            </button>
          ))}
        </div>
        <button className="ghost" onClick={() => app.go('title')}>Back to title</button>
      </section>
    </main>
  );
}
