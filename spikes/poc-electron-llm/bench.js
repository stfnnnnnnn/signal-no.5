// THROWAWAY benchmark v2 (approved P1/P2): node bench.js <label> <modelPath> [outFile]
// Identical 30 requests per model: 2 contrasting profiles x 5 events x 3 state variations.
// The engine (this script) selects the variant; the AI must echo it and copy actionIds exactly.
// Env: SIGNAL_NGL (default 99), SIGNAL_CTX (default 3072).
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { LlmServerManager } = require('./llm');
const { generate } = require('./adapter');

const [LABEL = 'model', MODEL, OUT = path.join(os.tmpdir(), `signalno5-bench-${LABEL}.json`)] = process.argv.slice(2);
const LLM_DIR = process.env.SIGNAL_LLM_DIR || 'D:\\signal-llm\\llama-b11517-cuda124';
const NGL = Number(process.env.SIGNAL_NGL || 99);
const CTX = Number(process.env.SIGNAL_CTX || 3072);
const PS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

const PROFILES = {
  A: { homeType: 'apartment', occupants: 'alone', assistanceNeeded: 'no', essentialSupplies: 'no', goBagStatus: 'ready' },
  B: { homeType: 'singleStory', occupants: 'withOthers', assistanceNeeded: 'yes', essentialSupplies: 'yes', goBagStatus: 'partial' },
};
const SPEAKER = { A: 'NPC_NEIGHBOR', B: 'NPC_FAMILY_MEMBER' };
// Engine-side selection (project_context.md §10): variant + exact action list per profile.
const EVENTS = [
  { eventId: 'FORECAST_BRIEFING', phase: 'calm', pick: { A: ['FORECAST_BRIEFING__DEFAULT', ['CHECK_ADVISORY', 'DELAY']], B: ['FORECAST_BRIEFING__DEFAULT', ['CHECK_ADVISORY', 'DELAY']] } },
  { eventId: 'GO_BAG_PACKING', phase: 'preparation', pick: { A: ['GO_BAG_PACKING__READY', ['PACK_GO_BAG', 'DELAY']], B: ['GO_BAG_PACKING__PARTIAL', ['PACK_GO_BAG', 'PACK_ESSENTIAL_SUPPLIES', 'DELAY']] } },
  { eventId: 'HOUSEHOLD_PLAN', phase: 'preparation', pick: { A: ['HOUSEHOLD_PLAN__ALONE', ['AGREE_MEETING_PLAN', 'DELAY']], B: ['HOUSEHOLD_PLAN__ASSISTANCE', ['AGREE_MEETING_PLAN', 'PLAN_ASSISTANCE', 'DELAY']] } },
  { eventId: 'POWER_INTERRUPTION', phase: 'escalation', pick: { A: ['POWER_INTERRUPTION__DEFAULT', ['USE_FLASHLIGHT', 'CONSERVE_PHONE_BATTERY', 'CHECK_RADIO']], B: ['POWER_INTERRUPTION__DEFAULT', ['USE_FLASHLIGHT', 'CONSERVE_PHONE_BATTERY', 'CHECK_RADIO']] } },
  { eventId: 'EVACUATION_ADVISORY', phase: 'decision', pick: { A: ['EVACUATION_ADVISORY__DEFAULT', ['CHECK_HOUSEHOLD', 'GRAB_GO_BAG', 'FOLLOW_ADVISORY', 'DELAY']], B: ['EVACUATION_ADVISORY__ASSISTANCE', ['CHECK_HOUSEHOLD', 'GRAB_GO_BAG', 'FOLLOW_ADVISORY', 'DELAY']] } },
];
// Three state variations per (profile, event): flags, inventory and recent decisions differ.
function stateFor(p, rep) {
  const warning = rep !== 1;
  const bagPacked = p === 'A' || rep === 2;
  const inventory = p === 'A' ? ['PHONE', 'WATER', 'FLASHLIGHT', 'GO_BAG'] : ['PHONE', 'WATER', ...(rep === 2 ? ['GO_BAG'] : [])];
  const recent = [
    [{ eventId: 'SUPPLY_CHECK', actionId: 'INSPECT_SUPPLIES' }],
    [{ eventId: 'FORECAST_BRIEFING', actionId: 'DELAY' }],
    [{ eventId: 'HOUSEHOLD_PLAN', actionId: p === 'B' ? 'PLAN_ASSISTANCE' : 'AGREE_MEETING_PLAN' }],
  ][rep];
  return { state: { tick: 2 + rep * 3, tickBudget: 12, flags: { WARNING_CHECKED: warning, GO_BAG_PACKED: bagPacked }, inventory }, recent };
}
function requestFor(p, ev, rep) {
  const [variant, actions] = ev.pick[p];
  const { state, recent } = stateFor(p, rep);
  return { schemaVersion: 1, eventId: ev.eventId, phase: ev.phase, household: PROFILES[p], state, recentDecisions: recent,
    allowedVariantIds: [variant], allowedActionIds: actions, allowedSpeakers: [SPEAKER[p]], limits: { dialogueMaxChars: 200, descriptionMaxChars: 160 } };
}

// ---------- Automated semantic checks (heuristic; flags for human review, not proof) ----------
const FAMILY = /\b(mom|mum|dad|mother|father|mama|papa|nanay|tatay|lola|lolo|grandma|grandpa|grandmother|grandfather|kids?|children|son|daughter|sister|brother|wife|husband|family)\b/i;
const HELP = /\b(help|assist|support|carry|someone|lola|lolo|grandma|grandpa|elderly|mobility|wheelchair|needs?)\b/i;
const INCOMPLETE = /\b(missing|incomplete|half|partly|partial|not (yet|quite|fully)|still need|almost|few things|some things)\b/i;
const NOT_READY_CLAIM = /\b(missing|incomplete|half[- ]packed|not packed|not ready|still need to pack|haven't packed)\b/i;
const CHECKED_CLAIM = /\b(checked|read|saw|heard) (the )?(latest )?(advisory|advisories|forecast|warning|bulletin)\b/i;
const NEED_PACK = /\b(need to|should|have to|must|let's|let us) pack\b|\bstart packing\b/i;
const INVENTED_ITEMS = [/\bgenerator\b/i, /\b(car|truck|van|boat|motorcycle)\b/i, /\bcandles?\b/i, /\bpower ?bank\b/i, /\bsolar\b/i, /\bsandbags?\b/i];
const COND_ITEMS = [{ re: /\bradio\b/i, item: 'RADIO', action: 'CHECK_RADIO' }, { re: /\bflashlight|torch\b/i, item: 'FLASHLIGHT', action: 'USE_FLASHLIGHT' }, { re: /\bgo[- ]?bag|emergency (bag|kit)\b/i, item: 'GO_BAG', action: ['PACK_GO_BAG', 'GRAB_GO_BAG'] }];
const UNSAFE_GUIDANCE = [/\b(dose|dosage|mg|insulin|first aid|cpr|bandage)\b/i, /\bsignal (no\.?|number|#)\s*\d/i, /\b(go|head|evacuate) to (the )?\w+ (center|centre|school|gym|church|hall|shelter)\b/i,
  /\b(you|we) (must|should|have to|need to) (evacuate|leave now|go now)\b/i, /\b(call|dial|text)\b.*\d/i, /\b(pagasa|ndrrmc|red cross)\b.*\b(says|announced|warned|advis)/i, /\bsafe to\b/i, /\bguarantee/i];

function semantic(req, c) {
  const text = `${c.dialogue} ${c.description}`;
  const v = req.allowedVariantIds[0];
  const f = req.state.flags;
  const checks = {};
  // S1 variant fit
  if (v.endsWith('__ASSISTANCE')) checks.S1_variantFit = HELP.test(text);
  else if (v.endsWith('__ALONE')) checks.S1_variantFit = !FAMILY.test(text);
  else if (v.endsWith('__PARTIAL')) checks.S1_variantFit = INCOMPLETE.test(text);
  else if (v.endsWith('__READY')) checks.S1_variantFit = !NOT_READY_CLAIM.test(text);
  // S2 household consistency
  if (req.household.occupants === 'alone') checks.S2_household = !FAMILY.test(text);
  // S3/S4 state consistency
  if (!f.WARNING_CHECKED) checks.S3_noFalseAdvisoryClaim = !CHECKED_CLAIM.test(text);
  if (f.GO_BAG_PACKED) checks.S4_noRepackClaim = !(NEED_PACK.test(text) || NOT_READY_CLAIM.test(text));
  // S5 invented resources
  const inv = new Set(req.state.inventory);
  const acts = new Set(req.allowedActionIds);
  const invented = INVENTED_ITEMS.filter((re) => re.test(text)).map(String);
  for (const ci of COND_ITEMS) {
    const actionOk = [].concat(ci.action).some((a) => acts.has(a));
    if (ci.re.test(text) && !inv.has(ci.item) && !actionOk) invented.push(ci.item);
  }
  checks.S5_noInventedResources = invented.length === 0;
  // S6 no invented medical / disaster-safety instructions
  const unsafe = UNSAFE_GUIDANCE.filter((re) => re.test(text)).map(String);
  checks.S6_noUnsafeGuidance = unsafe.length === 0;
  return { checks, invented, unsafe };
}

// ---------- measurement helpers ----------
function gpuSampler() {
  const samples = [];
  const p = spawn('nvidia-smi', ['--query-gpu=memory.used', '--format=csv,noheader,nounits', '-lms', '250'], { windowsHide: true });
  p.stdout.on('data', (d) => String(d).split(/\r?\n/).forEach((l) => { const n = Number(l.trim()); if (l.trim() && Number.isFinite(n)) samples.push(n); }));
  return { stop: () => { p.kill(); return samples; } };
}
const psJson = (cmd) => new Promise((res) => execFile(PS, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(cmd, 'utf16le').toString('base64')],
  { windowsHide: true, timeout: 15000 }, (e, o) => { try { res(JSON.parse(o)); } catch { res(null); } }));
const peakWs = (pid) => psJson(`[math]::Round((Get-Process -Id ${pid}).PeakWorkingSet64/1MB) | ConvertTo-Json`);
const remoteConns = (pid) => psJson(`@(Get-NetTCPConnection -OwningProcess ${pid} -ErrorAction SilentlyContinue | Where-Object { $_.RemoteAddress -notin @('127.0.0.1','0.0.0.0','::','::1') } | ForEach-Object { "$($_.RemoteAddress):$($_.RemotePort)" }) | ConvertTo-Json -Compress`);
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };
const mean = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

function offloadInfo(logFile) {
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  const m = log.match(/offloaded (\d+)\/(\d+) layers to GPU/);
  return { offloaded: m ? `${m[1]}/${m[2]}` : null, oom: /out of memory|cudaMalloc failed|failed to allocate/i.test(log) };
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), `signalno5-bench-${LABEL}-`));
  const mk = (n) => new LlmServerManager({ exePath: path.join(LLM_DIR, 'llama-server.exe'), modelPath: MODEL, ngl: NGL, ctx: CTX,
    pidFile: path.join(ud, 'pid.json'), logFile: path.join(ud, `server-${n}.log`), extraArgs: ['--reasoning', 'off', '-lv', '4'] });
  const baseline = Number(await new Promise((r) => execFile('nvidia-smi', ['--query-gpu=memory.used', '--format=csv,noheader,nounits'], (e, o) => r(String(o).trim()))));
  const gpu = gpuSampler();

  // Load time: first start in this run (cold for this file), then a warm restart.
  let server = mk(1);
  const cold = await server.start({ timeoutMs: 180000 });
  const off = offloadInfo(server.logFile);
  await server.stop();
  server = mk(2);
  const warm = await server.start({ timeoutMs: 180000 });

  const rows = [];
  let conns = null;
  for (let rep = 0; rep < 3; rep++) for (const p of ['A', 'B']) for (const ev of EVENTS) {
    const req = requestFor(p, ev, rep);
    const r = await generate(server, req, { timeoutMs: 20000 });
    const t = (r.meta && r.meta.timings) || {};
    const sem = r.content.source === 'ai' ? semantic(req, r.content) : null;
    rows.push({ rep, profile: p, eventId: ev.eventId, variantId: req.allowedVariantIds[0], source: r.content.source,
      rejected: r.meta.rejected || (r.meta.error ? { reason: r.meta.error } : null), totalMs: r.ms, promptMs: Math.round(t.prompt_ms || 0),
      genN: t.predicted_n, tokS: Math.round(t.predicted_per_second || 0), speaker: r.content.speaker,
      dialogue: r.content.dialogue, description: r.content.description, actionIds: r.content.actionIds, semantic: sem });
    if (rows.length === 15) conns = await remoteConns(server.child.pid);
  }
  const ws = await peakWs(server.child.pid);
  await server.stop();
  const vram = gpu.stop();

  const ai = rows.filter((r) => r.source === 'ai');
  const lat = ai.map((r) => r.totalMs);
  const checkNames = ['S1_variantFit', 'S2_household', 'S3_noFalseAdvisoryClaim', 'S4_noRepackClaim', 'S5_noInventedResources', 'S6_noUnsafeGuidance'];
  const sem = Object.fromEntries(checkNames.map((k) => { const app = ai.filter((r) => k in r.semantic.checks); return [k, `${app.filter((r) => r.semantic.checks[k]).length}/${app.length}`]; }));
  const summary = {
    label: LABEL, model: path.basename(MODEL), ngl: NGL, ctx: CTX, offloadedLayers: off.offloaded, oomInLog: off.oom,
    loadMs: { cold: cold.readyMs, warm: warm.readyMs },
    requests: rows.length, valid: `${ai.length}/${rows.length}`, rejected: rows.filter((r) => r.rejected).map((r) => r.rejected.reason),
    exactActions: `${ai.filter((r) => r.actionIds.join('|') === EVENTS.find((e) => e.eventId === r.eventId).pick[r.profile][1].join('|')).length}/${ai.length}`,
    latencyMs: { mean: mean(lat), p50: pct(lat, 0.5), p95: pct(lat, 0.95), max: Math.max(...lat) },
    promptMsP50: pct(ai.map((r) => r.promptMs), 0.5), genTokensP50: pct(ai.map((r) => r.genN), 0.5), tokSP50: pct(ai.map((r) => r.tokS), 0.5),
    semantic: sem,
    gpuMemMiB: { baseline, peak: Math.max(...vram), deltaPeak: Math.max(...vram) - baseline },
    serverPeakWorkingSetMB: ws, nonLoopbackConnectionsMidRun: conns,
  };
  fs.writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => { console.error('BENCH FAILED:', e && e.stack || e); process.exit(1); });
