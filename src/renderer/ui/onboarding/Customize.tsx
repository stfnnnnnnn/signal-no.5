import { useMemo, useState } from 'react';
import { createGame } from '../../../core/engine';
import { describeHome } from '../../../core/ai/guard';
import { ONBOARDING_QUESTIONS } from '../../../shared/contracts/onboarding';
import type { SpriteBase } from '../../game/assets';
import { tintFor } from '../../game/palette';
import { useApp } from '../../state/hooks';
import { CharacterIcon } from '../CharacterIcon';
import { issuesByField, toCustomInput, toRandomInput, type Customization, type CustomDraft, type RandomDraft } from './onboardingModel';

const AGE_LABEL = Object.fromEntries((ONBOARDING_QUESTIONS.find((q) => q.id === 'Q3')!.choices ?? []).map((c) => [c.value, c.label]));
const EXPOSURE_LABEL: Record<string, string> = {
  standard: 'Typical neighbourhood', waterway: 'Near a waterway', floodProne: 'Low-lying, flood-prone area',
  both: 'Near a waterway in a flood-prone area', unknown: 'Unknown surroundings',
};
const BUDGET_LABEL: Record<string, string> = { limited: 'Limited', moderate: 'Moderate', higher: 'Comfortable' };
const hex = (n: number | null) => (n === null ? null : `#${n.toString(16).padStart(6, '0')}`);

export function Customize() {
  const app = useApp();
  const setup = app.setup!;
  const [c, setC] = useState<Partial<Customization>>({ appearance: 'auto', minimumBudgetChallenge: false });
  const [error, setError] = useState<string | null>(null);
  const input = useMemo(() => (setup.mode === 'custom' ? toCustomInput(setup.draft as CustomDraft, c) : toRandomInput(setup.draft as RandomDraft, c)), [setup, c]);
  const preview = useMemo(() => createGame(input, { seed: setup.seed }), [input, setup.seed]);
  const update = (patch: Partial<Customization>) => { setError(null); setC((x) => ({ ...x, ...patch })); };

  if (!preview.ok) {
    const issues = issuesByField(preview.error.issues);
    return (
      <main className="screen">
        <section className="panel onboarding">
          <h2>Some answers need another look</h2>
          <ul className="issues">{Object.entries(issues).map(([f, m]) => <li key={f}>{m}</li>)}</ul>
          <div className="row-actions">
            <button onClick={() => app.go(setup.mode)} autoFocus>Change my answers</button>
            {c.playerMemberIndex !== undefined && <button className="ghost" onClick={() => update({ playerMemberIndex: undefined })}>Reset character choice</button>}
          </div>
        </section>
      </main>
    );
  }

  const profile = preview.engine.getProfile();
  const cash = preview.engine.getState().cash;
  const start = () => { const r = app.startNew(input, setup.seed); if (!r.ok) setError(r.error.message); };

  return (
    <main className="screen">
      <section className="panel onboarding wide">
        <h2>Your household</h2>
        <div className="review">
          <div>
            <h3>Who lives here</h3>
            <ul className="roster">
              {profile.members.map((m, i) => (
                <li key={m.id}>
                  <button className={m.isPlayer ? 'member on' : 'member'} aria-pressed={m.isPlayer} disabled={m.dependent}
                    onClick={() => update({ playerMemberIndex: i })} title={m.dependent ? 'Little ones are cared for by others' : 'Play as this person'}>
                    <CharacterIcon base={m.spriteBase as SpriteBase} tint={hex(tintFor(m.paletteId, profile.appearance.clothingColor))} />
                    <span>{AGE_LABEL[m.ageGroup] ?? m.ageGroup}{m.isPlayer ? ' (you)' : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="hint">Select a person to play as them.</p>
          </div>
          <dl className="facts">
            <dt>Home</dt><dd>{describeHome(profile.housing)}</dd>
            <dt>Surroundings</dt><dd>{EXPOSURE_LABEL[profile.exposure] ?? profile.exposure} <em>(fictional)</em></dd>
            <dt>Starting money</dt><dd>₱{cash.toLocaleString()} · {BUDGET_LABEL[profile.budgetTier] ?? profile.budgetTier}</dd>
          </dl>
        </div>

        <h3>Look and feel</h3>
        <div className="options">
          <fieldset>
            <legend>House style</legend>
            {(['traditional', 'modern'] as const).map((t) => (
              <label key={t}><input type="radio" name="theme" checked={profile.theme === t} onChange={() => update({ theme: t })} /> {t === 'modern' ? 'Modern Filipino' : 'Traditional Filipino'}</label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Clothing</legend>
            <label><input type="radio" name="appearance" checked={(c.appearance ?? 'auto') === 'auto'} onChange={() => update({ appearance: 'auto', clothingColor: undefined })} /> As generated</label>
            <label><input type="radio" name="appearance" checked={c.appearance === 'randomize'} onChange={() => update({ appearance: 'randomize', clothingColor: undefined })} /> Mix it up</label>
            <label><input type="radio" name="appearance" checked={c.appearance === 'customColor'} onChange={() => update({ appearance: 'customColor', clothingColor: c.clothingColor ?? '#4f7fd8' })} /> My colour
              {c.appearance === 'customColor' && <input type="color" aria-label="Clothing colour" value={c.clothingColor ?? '#4f7fd8'} onChange={(e) => update({ clothingColor: e.target.value })} />}
            </label>
          </fieldset>
          <fieldset>
            <legend>Challenge</legend>
            <label><input type="checkbox" checked={!!c.minimumBudgetChallenge} onChange={(e) => update({ minimumBudgetChallenge: e.target.checked })} /> Start with the smallest budget (₱800)</label>
          </fieldset>
        </div>

        {error && <p className="reason" role="alert">{error}</p>}
        <div className="row-actions">
          <button className="ghost" onClick={() => app.go(setup.mode)}>Change answers</button>
          {setup.mode === 'random' && <button className="ghost" onClick={() => app.reroll()}>Generate another household</button>}
          <button onClick={start} autoFocus>Start the storm</button>
        </div>
      </section>
    </main>
  );
}
