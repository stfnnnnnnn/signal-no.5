// BACKEND DEV HARNESS (not the game UI). Exercises the real engine + window.signal bridge end to end
// so the backend can be verified in the packaged app before the frontend lands. Frontend replaces this file.
import '../shared/bridge';
import { buildScenarioRequest } from '../core/ai/scenario';
import { buildDebriefRequest } from '../core/ai/debrief';
import { createGame, type GameEngine } from '../core/engine';
import { evaluateRun } from '../core/evaluation/evaluate';

const $ = (id: string) => document.getElementById(id)!;
const el = (tag: string, text = '', cls = '') => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };

let engine: GameEngine;
let shownEvent = '';

function newRun(mode: 'fictional' | 'actual' = 'fictional') {
  const r = createGame({ schemaVersion: 1, q3Mode: mode, q26Theme: 'traditional' }, { seed: Math.floor(Math.random() * 1e9) });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  engine = r.engine; shownEvent = '';
  render();
}

async function showEvent() {
  const st = engine.getState();
  const ev = st.activeEvent;
  const box = $('event');
  if (!ev) { box.textContent = 'No active event.'; return; }
  const key = `${ev.eventId}@${ev.triggeredAtMinute}`;
  if (key === shownEvent) return;
  shownEvent = key;
  box.textContent = `${ev.eventId} (${ev.variantId}) — generating…`;
  const req = buildScenarioRequest(st)!;
  const t0 = performance.now();
  const content = await window.signal.ai.generateScenario(req, st.runId);
  box.replaceChildren(
    el('div', `${ev.eventId} · ${ev.variantId} · ${Math.round(performance.now() - t0)} ms `),
    el('span', content.source === 'ai' ? 'AI-personalized' : `Reviewed fallback (${content.fallbackReason})`, `tag ${content.source}`),
    el('p', `${content.speaker}: “${content.dialogue}”`), el('p', content.description),
  );
  for (const c of engine.getEventChoices()) {
    const b = el('button', `${c.label}${c.unsafe ? ' ⚠' : ''}`) as HTMLButtonElement;
    b.disabled = !c.available; b.title = c.reasons.join(' ');
    b.onclick = () => { engine.resolveEvent(c.actionId); render(); };
    box.append(b);
  }
}

async function render() {
  const st = engine.getState();
  $('state').textContent = JSON.stringify({ hour: +(st.clock.gameMinutes / 60).toFixed(2), speed: st.clock.timeScale, phase: st.phase, scene: st.scene,
    cash: st.cash, phone: st.phoneBattery, goBag: engine.getGoBagStatus(), house: st.house, bag: st.goBag, env: st.environment, members: st.household.members.length }, null, 1);
  const acts = $('actions');
  acts.replaceChildren();
  for (const a of engine.getAvailableActions()) {
    const b = el('button', `${a.label} (${a.timeCostMinutes}m)`) as HTMLButtonElement;
    b.disabled = !a.available; b.title = a.reasons.join(' ');
    b.onclick = () => { engine.executeAction(a.actionId); render(); };
    acts.append(b);
  }
  if (st.scene === 'SHOP') for (const id of ['WATER_JUG', 'FOOD_PACK', 'FLASHLIGHT'] as const) {
    const b = el('button', `Buy ${id} ₱${engine.priceOf(id)}`); b.onclick = () => { engine.purchase(id, 1); render(); }; acts.append(b);
  }
  if (st.completed) return showDebrief();
  await showEvent();
}

async function showDebrief() {
  const st = engine.getState();
  const ev = evaluateRun(st);
  const n = await window.signal.ai.narrateDebrief(ev, buildDebriefRequest(ev, st));
  await window.signal.badges.add(ev.badgeIds);
  $('debrief').replaceChildren(el('h2', `Score ${ev.score} · ${ev.ending}${ev.rescueOutcome ? ' · Na-rescue' : ''}`),
    el('span', n.source === 'ai' ? 'AI-personalized' : 'Reviewed fallback', `tag ${n.source}`), el('p', n.summary),
    el('pre', `Badges: ${ev.badgeIds.join(', ')}\nGaps: ${ev.gaps.join(', ')}`));
}

function controls() {
  const c = $('controls');
  const add = (label: string, fn: () => void) => { const b = el('button', label); b.onclick = fn; c.append(b); };
  add('New fictional household', () => newRun());
  for (const s of [1, 4, 32]) add(`${s}×`, () => { engine.setSpeed(s); render(); });
  add('Skip (after landfall)', () => { engine.skipToNextMilestone(); render(); });
  add('Save', () => void window.signal.save.write('slot-1', engine.getState()));
}

window.signal.ai.onStatus((s) => { $('ai').textContent = s; });
window.signal.ai.status().then((s) => { $('ai').textContent = s; });
window.signal.app.info().then((i) => { $('info').textContent = `${i.runtime} · model ${i.modelFile ?? 'none'} · ${i.packaged ? 'packaged' : 'dev'}`; });
controls();
newRun();
let last = performance.now();
setInterval(() => { const now = performance.now(); const r = engine.tick(now - last); last = now; if (r.ok && r.events.length) void render(); }, 250);
