// Phonodeck: start-up state, invites, saving, the model calls, cost meter and retrieval.
// Plain scripts that share one global scope (no build step); index.html loads them in order: prompts, experiences, core, engine, voice, curator, ui.

const $ = id => document.getElementById(id);
const KEY = 'holodeck.v2';
// Google Gemini through its OpenAI-compatible endpoint. "Test connection" lists the models a key can really use and swaps in available ones if a default is missing.
const GEMINI = { base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.1-pro-preview', cheap: 'gemini-3.8-flash', embed: 'gemini-embedding-2-preview',
  models: ['gemini-3.1-pro-preview', 'gemini-3.8-flash'], ttsModel: 'gemini-3.8-flash-lite-tts', ttsBackup: 'gemini-3.8-flash-tts', cheapLite: 'gemini-3.1-flash-lite', prices: '2,12,0.75,3.75,6',   // Google's paid prices, Oct 2026 (the 3.8 models double on Jan 1, 2027)
  cacheRate: 0.1 };   // Google bills input served from its cache at a tenth of the normal input price
const RETIRED = { model: ['gemini-2.5-pro'], cheap: ['gemini-2.5-flash'], embed: ['gemini-embedding-001'] };   // saved values matching these are upgraded to the new defaults
const BIBLE_EVERY = 10;
// Tunable prompt sizes (Settings > Story & cost). Smaller = cheaper and faster; larger = more continuity in the prompt.
const TUNE = { recent: 8, chapters: 6, recall: 6 };
const tune = k => +S()['tune_' + k] || TUNE[k];
const RECENT_N = () => tune('recent');
let db = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('holodeck.v1') || '{"settings":{},"adventures":{},"current":""}');
db.settings = db.settings || {}; db.adventures = db.adventures || {};
// A previous version could switch to other AI providers and to Spanish. Return to Gemini (restoring its key if another provider was selected) and English.
(function backToGemini(s) {
  if (s.prov && s.prov !== 'gemini') { const g = (s.provs || {}).gemini || {}; ['key', 'model', 'cheap', 'embed', 'ttsVoice', 'ttsModel', 'prices', 'freeTier'].forEach(k => { if (g[k] !== undefined) s[k] = g[k]; else delete s[k]; }); }
  ['model', 'cheap', 'embed', 'ttsModel'].forEach(k => { if (s[k] && !/^gemini/.test(s[k])) delete s[k]; });
  ['prov', 'provs', 'base', 'lang', 'voiceEs'].forEach(k => delete s[k]);
})(db.settings);
Object.keys(RETIRED).forEach(k => { if (RETIRED[k].includes(db.settings[k])) db.settings[k] = GEMINI[k]; });
let busy = false;
const S = () => db.settings;
const A = () => db.adventures[db.current];
// ---------------- Invites: a guest plays on the host's Gemini key through the invite server (the api folder, on Vercel) ----------------
// A link ending in ?invite=CODE stores the code in this browser. Guests never see a key, get the default models and voice, and spend a
// dollar allowance that the game shows as minutes. A key of your own (Settings > Connection) always wins over an invite.
const INVITE_KEY = 'holodeck.invite';
(function takeInvite() {
  const q = new URLSearchParams(location.search), c = q.get('invite'); if (!c) return;
  try { localStorage.setItem(INVITE_KEY, c.trim().toUpperCase()); } catch (e) {}
  q.delete('invite'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);   // keeps the code out of bookmarks
})();
const inviteCode = () => { try { return localStorage.getItem(INVITE_KEY) || ''; } catch (e) { return ''; } };
const guest = () => !!inviteCode() && !S().key && !S().fake;
const hasKey = () => !!S().key || guest();
let inviteInfo = null;   // { name, minutesLeft, status } from the invite server
const QUOTA_MSG = 'Your current invite quota is complete. Thank you for playing! If you would like more time, ask the person who invited you.';
const INVITE_OFF_MSG = 'This invite is not active right now. Ask the person who invited you for a new link.';
const inviteLine = () => !inviteInfo ? '' : inviteInfo.status !== 'active' ? INVITE_OFF_MSG : inviteInfo.minutesLeft > 0 ? 'About ' + inviteInfo.minutesLeft + ' minute' + (inviteInfo.minutesLeft === 1 ? '' : 's') + ' left on your invite' : 'Your current invite quota is complete.';
function inviteNote(r) {   // every answer from the invite server says about how many minutes are left
  const m = r.headers.get('x-invite-minutes'); if (m !== null && inviteInfo && inviteInfo.status === 'active') { inviteInfo.minutesLeft = +m; showUsage(); }
}
async function inviteError(r) {   // 402: the allowance, the invite or the monthly ceiling is used up; 403: the code is not valid
  let o = {}; try { o = await r.json(); } catch (e) {}
  const off = r.status === 403 || o.reason === 'paused';
  if (inviteInfo) { if (off) inviteInfo.status = 'off'; else inviteInfo.minutesLeft = 0; showUsage(); }
  const e = new Error(off ? INVITE_OFF_MSG : QUOTA_MSG); e.quota = true; return e;
}
async function loadInvite() {
  if (!guest()) return;
  try { const r = await fetch('/api/invite?code=' + encodeURIComponent(inviteCode()), { cache: 'no-store' });
    inviteInfo = r.ok ? await r.json() : r.status === 403 ? { status: 'off', minutesLeft: 0 } : null;
  } catch (e) { inviteInfo = null; }
  showUsage(); guestWelcomeText();
}
const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
const norm = a => { a.places = a.places || {}; a.edges = a.edges || []; a.beats = a.beats || []; a.events = a.events || []; a.lore = a.lore || {}; a.transcript = a.transcript || []; a.location = a.location || ''; a.chunks = a.chunks || []; a.emb = a.emb || {}; a.summarizedUpTo = a.summarizedUpTo || 0; return a; };
Object.values(db.adventures).forEach(norm);

// ---------------- persistence: localStorage + optional folder of files ----------------
let dirH = null, writeTimer = null; const dirty = new Set();
function persist(name) {
  name = name || db.current; if (name) { dirty.add(name); if (db.adventures[name]) db.adventures[name].updated = Date.now(); }
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert('Browser storage is full. Export a backup and delete old adventures.'); }
  if (dirH) { clearTimeout(writeTimer); writeTimer = setTimeout(writeDir, 400); }
}
const fileName = n => n.replace(/[^a-z0-9 _-]/gi, '_') + '.json';
const fsOK = () => 'showDirectoryPicker' in window;
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('holodeck', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(k) { const d = await idb(); return new Promise(res => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
async function idbSet(k, v) { const d = await idb(); return new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); }); }
function dirStatus(m) { $('dirStatus').textContent = m; }
async function writeDir() {
  if (!dirH) return;
  try {
    if (await dirH.queryPermission({ mode: 'readwrite' }) !== 'granted') { $('reconBtn').style.display = ''; dirStatus('Folder "' + dirH.name + '" needs permission: click Reconnect.'); return; }
    for (const n of [...dirty]) {
      if (!db.adventures[n]) { try { await dirH.removeEntry(fileName(n)); } catch (e) {} dirty.delete(n); continue; }
      const fh = await dirH.getFileHandle(fileName(n), { create: true });
      const w = await fh.createWritable(); await w.write(JSON.stringify({ name: n, adventure: db.adventures[n] }, null, 1)); await w.close(); dirty.delete(n);
    }
    dirStatus('Saving to folder "' + dirH.name + '". Last saved ' + new Date().toLocaleTimeString() + '.');
  } catch (e) { dirStatus('Folder save failed: ' + e.message); }
}
async function loadDir() {
  let n = 0;
  for await (const [name, h] of dirH.entries()) {
    if (h.kind !== 'file' || !name.endsWith('.json')) continue;
    try { const o = JSON.parse(await (await h.getFile()).text()); if (o.name && o.adventure) { db.adventures[o.name] = norm(o.adventure); n++; } } catch (e) {}
  }
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
  dirStatus('Loaded ' + n + ' adventure(s) from "' + dirH.name + '".'); refresh(); renderStart();
}
async function initDir() {
  if (!fsOK()) { dirStatus('This browser cannot link a folder. Use Export / Import instead.'); $('dirBtn').disabled = true; return; }
  try { dirH = await idbGet('dir'); } catch (e) { dirH = null; }
  if (dirH) {
    if (await dirH.queryPermission({ mode: 'readwrite' }) === 'granted') { await loadDir(); Object.keys(db.adventures).forEach(n => dirty.add(n)); await writeDir(); }
    else { $('reconBtn').style.display = ''; dirStatus('Folder "' + dirH.name + '" needs permission: click Reconnect.'); }
  }
}
$('dirBtn').onclick = async () => {
  try {
    dirH = await showDirectoryPicker({ mode: 'readwrite' }); await idbSet('dir', dirH);
    await loadDir(); Object.keys(db.adventures).forEach(n => dirty.add(n)); await writeDir();
  } catch (e) { if (e.name !== 'AbortError') dirStatus('Could not link folder: ' + e.message); }
};
$('reconBtn').onclick = async () => {
  try { if (await dirH.requestPermission({ mode: 'readwrite' }) === 'granted') { $('reconBtn').style.display = 'none'; await loadDir(); Object.keys(db.adventures).forEach(n => dirty.add(n)); await writeDir(); } }
  catch (e) { dirStatus('Reconnect failed: ' + e.message); }
};

// ---------------- LLM ----------------
async function llmError(r, what) {   // plain-English explanation for the most common failures
  if (guest() && (r.status === 402 || r.status === 403)) return inviteError(r);
  const body = (await r.text()).slice(0, 250), hint = {
    400: 'The request was rejected.', 401: 'The API key was not accepted. Check it in Settings > Connection.', 403: 'The key is not allowed to use "' + what + '". Press Test connection in Settings > Connection.',
    404: '"' + what + '" was not found (preview models get renamed or retired). Press Test connection in Settings > Connection and pick an available model.',
    429: 'Rate limit or daily quota reached. Wait a bit, or lower the voice and memory settings.',
    503: 'Google\'s service is busy right now. Wait a moment and try again.' }[r.status];
  return new Error((hint ? hint + ' (HTTP ' + r.status + ') ' : 'LLM error ' + r.status + ': ') + body);
}
const cheapModel = () => guest() ? GEMINI.cheap : S().cheap || GEMINI.cheap;   // guests always get the default models
const storyModel = () => guest() ? GEMINI.model : S().freeTier ? cheapModel() : (S().model || GEMINI.model);
const headers = () => guest() ? { 'Content-Type': 'application/json', 'x-invite': inviteCode() } : { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S().key };
const apiUrl = p => guest() ? '/api/gemini?p=' + p : GEMINI.base + (p === 'chat' ? '/chat/completions' : '/embeddings');   // guests go through the invite server
function netFetch(url, opts) {   // an unreachable endpoint throws a bare "Failed to fetch"; say what probably happened
  return fetch(url, opts).then(r => { if (guest()) inviteNote(r); return r; }, e => { throw new Error('Could not reach ' + (guest() ? 'the phonodeck server' : 'Google') + ' (' + e.message + '). Check your internet connection.'); });
}
// One request. o: { stream, effort (thinking), usage (ask for token counts in the stream), kind (the call's tag; the invite server refuses new story turns once an allowance is used) }
function llmFetch(model, messages, o) {
  const body = { model, messages };
  if (o.stream) body.stream = true;
  if (o.effort) body.reasoning_effort = o.effort;
  if (o.stream && o.usage) body.stream_options = { include_usage: true };
  const h = headers(); if (guest() && o.kind) h['x-holo-kind'] = o.kind;
  return netFetch(apiUrl('chat'), { method: 'POST', headers: h, body: JSON.stringify(body) });
}
// Tries the richest request first, then plainer ones if the endpoint rejects a parameter (HTTP 400). Rejected shapes are remembered in this
// browser for a day (keyed by model and shape, not by the call's tag), so each one costs a single 400 rather than one per tag on every page load.
const SHAPE_KEY = 'phonodeck.badShape', SHAPE_DAYS = 1;   // short, so a 400 that was really about something else does not stick for long
const badShape = (() => { try { const o = JSON.parse(localStorage.getItem(SHAPE_KEY) || '{}'), now = Date.now(); return new Map(Object.entries(o).filter(([, t]) => now - t < SHAPE_DAYS * 864e5)); } catch (e) { return new Map(); } })();
async function tryVariants(model, variants, messages) {
  let r = null;
  for (const v of variants) {
    const { kind, ...shape } = v, sig = model + '|' + JSON.stringify(shape);
    if (badShape.has(sig) && v !== variants[variants.length - 1]) continue;
    r = await llmFetch(model, messages, v); if (r.status !== 400) break;
    badShape.set(sig, Date.now()); try { localStorage.setItem(SHAPE_KEY, JSON.stringify(Object.fromEntries(badShape))); } catch (e) {}
    console.warn('request rejected (400) with', v, '- retrying with a plainer request');
  }
  return r;
}
// ---------------- Free-tier keys ----------------
// A free key looks exactly like a paid one, but Google refuses models outside the free tier (Pro-class models) with HTTP 429 and a message
// naming "free_tier" with "limit: 0". When that happens to the story model, the app remembers it (settings.freeTier) and uses the cheap model
// for the story too. Paid keys never trigger this, so they keep the better defaults. Changing the key or story model, or Test connection, re-checks.
const isTierRefusal = body => /free_tier/i.test(body) && /limit:\s*0\b/.test(body);
const retryAfter = (r, body) => { const m = /retry in ([\d.]+)\s*s/i.exec(body) || /"retryDelay":\s*"([\d.]+)s"/.exec(body); return m ? +m[1] : +r.headers.get('retry-after') || 0; };
const sleep = ms => new Promise(res => setTimeout(res, ms));
let pendingNotice = '';
function notice(t) {   // a system line in the story; held until the story is on screen if the curator is still open
  if (A() && !$('curator').classList.contains('on')) addMsg('sys', t); else { pendingNotice = t; $('curMsg').textContent = t; }
}
function goFree(model) {
  if (S().freeTier) return;
  db.settings.freeTier = true; persist(); keyStatus(); freeGate();   // the warning blocks until they pick a new key or continue anyway
  notice('Your API key has no billing set up, so Google refuses "' + model + '" and the story now uses "' + cheapModel() + '" instead. Set up billing for your key\'s Google project, then press Test connection in Settings > Connection.');
}
// Runs a request; on a free-tier refusal of the story model, switches to the cheap model; on a short rate limit, waits once and retries.
async function quotaRetry(model, big, run) {
  let r = await run(model);
  if (r.status !== 429) return { r, model };
  const body = await r.clone().text();
  if (big && model !== cheapModel() && isTierRefusal(body)) { goFree(model); model = cheapModel(); r = await run(model); }
  else { const w = retryAfter(r, body); if (w > 0 && w <= 30) { if (big) holoStage = 'rate limited; retrying in ' + Math.ceil(w) + 's'; await sleep(w * 1000 + 250); r = await run(model); } }
  return { r, model };
}
async function probeTier() {   // one tiny request to the story model; returns a sentence for the status line
  if (S().fake || !S().key) return '';
  const model = S().model || GEMINI.model;
  try {
    const r = await llmFetch(model, [{ role: 'user', content: 'Reply with the single word OK.' }], {});
    if (r.ok) { if (S().freeTier) { delete db.settings.freeTier; delete db.settings.freeOk; persist(); keyStatus(); } return 'Your key can use the story model "' + model + '".'; }
    const body = await r.text();
    if (r.status === 429 && isTierRefusal(body)) { goFree(model); return 'This key has no billing set up: "' + model + '" is refused, so the story will use "' + cheapModel() + '" until you set up billing.'; }
    return 'The story model "' + model + '" answered HTTP ' + r.status + '.';
  } catch (e) { return ''; }
}
async function chat(tag, messages) {
  if (S().fake) return fake(tag, messages);
  if (!hasKey()) throw new Error('Set your API key in Settings (or enable offline test mode).');
  const bigModel = tag === 'gm' || tag === 'final' || tag === 'photo' || (tag === 'plan' && S().notesModel === 'story' && !guest());   // GM notes run on the cheap model unless Settings says otherwise
  const eff = tag === 'gm' ? '' : tag === 'plan' || tag === 'final' || tag === 'photo' ? 'low' : 'minimal';   // background calls do not need deep thinking
  const variants = (eff === 'minimal' ? [{ effort: eff }, { effort: 'low' }, {}] : eff ? [{ effort: eff }, {}] : [{}]).map(v => Object.assign(v, { kind: tag }));   // a model that refuses "minimal" still gets light thinking, not its slow, costly default
  let { r, model } = await quotaRetry(bigModel ? storyModel() : cheapModel(), bigModel, m => tryVariants(m, variants, messages));
  // The cheap model is out of quota or unavailable: background calls (suggestions, memory) borrow the story model rather than fail silently.
  if (!r.ok && !bigModel && [404, 429, 503].includes(r.status) && storyModel() !== model) { console.warn('cheap model "' + model + '" answered HTTP ' + r.status + '; using the story model for "' + tag + '"'); model = storyModel(); r = await tryVariants(model, variants, messages); }
  if (!r.ok) throw await llmError(r, model);
  const j = await r.json(); recordUsage(tag, j.usage, bigModel && !S().freeTier);
  return j.choices[0].message.content;
}
// ---------------- Usage meter: tokens and estimated cost, stored per adventure ----------------
// kind: gm | plan | extract | bible | voice. "big" = billed at the story-model price, otherwise the cheap-model price. c = input served from Google's cache.
function recordUsage(kind, u, big, audioSec) {
  const a = A(); if (!a) return;
  const t = a.usage = a.usage || {}, k = t[kind] = t[kind] || { n: 0, i: 0, o: 0, th: 0, s: 0, big: !!big };
  k.n++; k.big = !!big; k.s += audioSec || 0;
  if (u) { const inn = u.prompt_tokens || 0, out = Math.max(u.completion_tokens || 0, (u.total_tokens || 0) - inn), th = out - (u.completion_tokens || 0); k.i += inn; k.o += out; k.th += Math.max(th, (u.completion_tokens_details && u.completion_tokens_details.reasoning_tokens) || 0);
    k.c = (k.c || 0) + Math.min(inn, (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0); }
  showUsage(); clearTimeout(usageTimer); usageTimer = setTimeout(() => persist(), 1500);
}
let usageTimer = null;
function priceList() { const p = String(S().prices || GEMINI.prices).split(',').map(x => parseFloat(x) || 0); return { sIn: p[0], sOut: p[1], cIn: p[2], cOut: p[3], aOut: p[4] }; }
function usageCost(u) {   // returns { total, story, bg, voice } in dollars
  const p = priceList(), r = { story: 0, bg: 0, voice: 0 };
  const inTok = k => (k.i - (k.c || 0)) + (k.c || 0) * GEMINI.cacheRate;   // cached input is billed at a fraction of the normal price
  Object.entries(u || {}).forEach(([kind, k]) => {
    if (kind === 'voice') r.voice += k.s * 25 / 1e6 * p.aOut;
    else { const c = k.big ? (inTok(k) * p.sIn + k.o * p.sOut) / 1e6 : (inTok(k) * p.cIn + k.o * p.cOut) / 1e6; if (kind === 'gm') r.story += c; else r.bg += c; }
  });
  r.total = r.story + r.bg + r.voice; return r;
}
let usageBase = null;   // snapshot of the adventure's usage when you last pressed Send
const kfmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
function showUsage() {
  const a = A(), el = $('usageBar'); if (el && guest()) { el.textContent = inviteLine(); el.title = 'An estimate: what is left on your invite, at the pace you have been playing.'; return; }
  if (!a || !a.usage || !el) { if (el) el.textContent = ''; return; }
  const u = a.usage, tot = usageCost(u); if (!usageBase || usageBase.__adv !== db.current) usageBase = Object.assign(JSON.parse(JSON.stringify(u)), { __adv: db.current });
  const b = usageBase, g = u.gm || { i: 0, o: 0, th: 0 }, g0 = b.gm || { i: 0, o: 0, th: 0 };
  const dn = Object.keys(u).reduce((o, k) => { const x = u[k], y = b[k] || { i: 0, o: 0, th: 0, s: 0, n: 0, c: 0, big: x.big }; o[k] = { i: x.i - y.i, o: x.o - y.o, th: x.th - y.th, s: x.s - y.s, n: x.n - y.n, c: (x.c || 0) - (y.c || 0), big: x.big }; return o; }, {});
  const last = usageCost(dn), gc = (g.c || 0) - (g0.c || 0);
  el.textContent = 'Last turn: story ' + kfmt(g.i - g0.i) + ' in' + (gc > 0 ? ' (' + kfmt(gc) + ' cached)' : '') + ' / ' + kfmt(g.o - g0.o) + ' out' + (g.th - g0.th > 0 ? ' (' + kfmt(g.th - g0.th) + ' thinking)' : '') +
    (dn.voice && dn.voice.s ? ' | voice ' + Math.round(dn.voice.s) + 's' : '') + ' | ~$' + last.total.toFixed(3) +
    '  ||  Adventure: ~$' + tot.total.toFixed(2) + ' (story ' + tot.story.toFixed(2) + ', memory ' + tot.bg.toFixed(2) + ', voice ' + tot.voice.toFixed(2) + ')' +
    (S().freeTier ? '  ||  Key without billing: Google does not bill these calls' : '');
}
// Streaming version of the story call: onDelta(text) fires as tokens arrive. Returns the full reply.
async function chatStream(messages, onDelta) {
  if (S().fake) {
    const t = fake('gm', messages);
    for (const w of (t.match(/\S+\s*/g) || [t])) { onDelta(w); await new Promise(r => setTimeout(r, 12)); }
    return t;
  }
  if (!hasKey()) throw new Error('Set your API key in Settings (or enable offline test mode).');
  const effort = guest() || S().effort === undefined ? 'low' : S().effort;   // thinking is billed as output; low effort cuts cost and the wait for the first word
  const variants = [[effort, true], [effort === 'minimal' ? 'low' : effort, true], [effort, false], ['', false]].map(([e, u]) => ({ stream: true, effort: e, usage: u, kind: 'gm' }));
  const { r, model } = await quotaRetry(storyModel(), true, m => tryVariants(m, variants, messages));
  if (!r.ok) throw await llmError(r, model);
  const big = !S().freeTier;
  if (!r.body || (r.headers.get('content-type') || '').includes('application/json')) {   // endpoint ignored streaming
    const j = await r.json(), full = j.choices[0].message.content; recordUsage('gm', j.usage, big); onDelta(full); return full;
  }
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', full = '', usage = null;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim(); if (data === '[DONE]') continue;
      try { const o = JSON.parse(data); if (o.usage) usage = o.usage; const d = o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content; if (d) { full += d; onDelta(d); } } catch (e) { /* partial or non-content chunk */ }
    }
  }
  recordUsage('gm', usage, big);
  if (!full) throw new Error('The model returned an empty reply.');
  return full;
}
function fake(tag, m) {
  const last = String(m[m.length - 1].content).split(/\n(?:THE PLAYER|INSTRUCTION): /).pop();   // just the action, not the private briefing
  if (tag === 'gm') return '[fake GM] The holodeck hums. You said: "' + last.slice(0, 120) + '". A hooded figure named Captain Mara watches from the Rusty Anchor tavern.';
  if (tag === 'options') return JSON.stringify({ options: ['Fake option A', 'Fake option B', 'Fake option C', 'Fake option D'] });
  if (tag === 'final') return JSON.stringify({ title: 'Fake Tale', summary: 'You did things. Things happened.', next: 'Next time, take the fake tale somewhere stranger.', holodeck: { grade: 'B+', score: 88, comment: 'The quiet scenes delivered the feeling; the chase in the middle got in the way.' }, player: { grade: 'B', score: 84, comment: 'You committed to your character, but played it safe at the docks.' } });
  if (tag === 'extract') return JSON.stringify({ lore: [{ name: 'Captain Mara', type: 'person', aliases: ['Mara'], desc: 'Hooded figure who watches from the tavern.' }, { name: 'Rusty Anchor', type: 'place', aliases: [], desc: 'A dockside tavern.' }],
    events: ['Player met the gaze of Captain Mara.'], location: 'Rusty Anchor', links: [['Rusty Anchor', 'Harbour Pier']], beats: [{ beat: 'Learn what Captain Mara wants', status: 'active' }],
    mood: { feeling: 5 + Math.floor(Math.random() * 5), hooked_on: Math.random() < 0.4 ? 'Captain Mara' : '', meandering: Math.random() < 0.3, leaving_plot: false }, goal_progress: 'Settling in at the tavern.' });
  if (tag === 'plan') return JSON.stringify({ voice: 'Warm, wry narration with sensory detail; Mara speaks in clipped sentences.', secrets: ['The tavern owner is Mara\'s brother.', 'The anchor is hollow and holds a map.'], threads: [{ thread: 'Someone is following the player', status: 'seeded' }], big_reveal: 'The note was written by the player in the future.' });
  return '(fake bible refresh) ' + last.slice(0, 200);
}

// ---------------- Retrieval ----------------
const STOP = new Set('the and you was for that with this are his her they them have has had not but your from what who how into then there will would'.split(' '));
const tok = s => (s.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []).filter(w => w.length > 2 && !STOP.has(w));
function bm25(docs, query, k) {
  const q = [...new Set(tok(query))];
  if (!docs.length || !q.length) return [];
  const avg = docs.reduce((a, d) => a + d.t.length, 0) / docs.length || 1;
  const df = {}; docs.forEach(d => new Set(d.t).forEach(t => df[t] = (df[t] || 0) + 1));
  return docs.map(d => {
    const tf = {}; d.t.forEach(t => tf[t] = (tf[t] || 0) + 1); let s = 0;
    q.forEach(t => { const f = tf[t] || 0; if (!f) return; const idf = Math.log(1 + (docs.length - df[t] + 0.5) / (df[t] + 0.5)); s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.t.length / avg)); });
    return { d, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.d);
}

