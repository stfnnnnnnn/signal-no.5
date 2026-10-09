// THROWAWAY spike. Renderer: no Node, talks only through window.signal.
const $ = (id) => document.getElementById(id);
const setStatus = (s) => { $('status').textContent = s; };
window.signal.ai.onStatus(setStatus);
window.signal.ai.status().then(setStatus);

function show(label, r) {
  const c = r.content;
  const div = document.createElement('div');
  div.className = `card ${c.source}`;
  div.innerHTML = `<div><b></b> <span class="tag"></span> <small></small></div><p class="d"></p><p class="s"></p><div class="a"></div>`;
  div.querySelector('b').textContent = label;
  div.querySelector('.tag').textContent = c.source === 'ai' ? 'AI-personalized' : 'Reviewed fallback';
  div.querySelector('small').textContent = `${r.ms} ms${r.meta && r.meta.rejected ? ` · rejected: ${r.meta.rejected.reason}` : ''}`;
  div.querySelector('.d').textContent = `${c.speaker}: “${c.dialogue}”`;
  div.querySelector('.s').textContent = c.description;
  div.querySelector('.a').textContent = `Actions: ${c.actionIds.join(', ')}`;
  $('out').prepend(div);
}

async function run(inject = null) {
  const fx = await window.signal.ai.fixture();
  const r = await window.signal.ai.generate(fx, inject);
  show(inject ? `inject:${inject}` : 'generate', r);
  return r;
}

$('gen').onclick = () => run();
document.querySelectorAll('[data-inject]').forEach((b) => { b.onclick = () => run(b.dataset.inject); });

// Used by --poc-auto: real generation x3, then each injected fault once.
window.__pocRunAll = async () => {
  for (let i = 0; i < 3; i++) await run();
  for (const k of ['badjson', 'unknownAction', 'overlength', 'duplicate']) await run(k);
  return true;
};
