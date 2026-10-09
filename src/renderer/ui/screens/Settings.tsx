import { useState } from 'react';
import { useApp } from '../../state/hooks';
import { applySettings, loadSettings, saveSettings, TEXT_SCALES, type Settings as S } from '../../state/settings';

const SIZE_LABEL = ['Normal', 'Large', 'Larger'];

export function Settings() {
  const app = useApp();
  const [s, setS] = useState<S>(loadSettings);
  const update = (patch: Partial<S>) => setS((x) => { const n = { ...x, ...patch }; saveSettings(n); applySettings(n); return n; });
  return (
    <main className="screen">
      <section className="panel onboarding" aria-labelledby="settings">
        <h2 id="settings">Settings</h2>
        <div className="options">
          <fieldset>
            <legend>Sound</legend>
            <label>Volume <input type="range" min={0} max={100} value={s.volume} onChange={(e) => update({ volume: Number(e.target.value) })} /> {s.volume}</label>
            <label><input type="checkbox" checked={s.muted} onChange={(e) => update({ muted: e.target.checked })} /> Mute all sound</label>
            <p className="hint">This build has no sound files yet; your choice is kept for when it does.</p>
          </fieldset>
          <fieldset>
            <legend>Text size</legend>
            {TEXT_SCALES.map((t, i) => (
              <label key={t}><input type="radio" name="text" checked={s.textScale === t} onChange={() => update({ textScale: t })} /> {SIZE_LABEL[i]}</label>
            ))}
          </fieldset>
        </div>
        <button onClick={() => app.go('title')} autoFocus>Back to title</button>
      </section>
    </main>
  );
}
