// Phonodeck: screens and controls: start screen, story view, settings, invited guests, invite admin and start-up.
// Plain scripts that share one global scope (no build step); index.html loads them in order: prompts, experiences, core, engine, voice, curator, ui.

// ---------------- Start screen ----------------
function renderStart() {
  $('closeStart').style.display = A() ? '' : 'none';
  const names = Object.keys(db.adventures).sort((x, y) => (db.adventures[y].updated || 0) - (db.adventures[x].updated || 0));
  $('contBtn').style.display = names.length ? '' : 'none';
  $('contSub').textContent = names.length + ' saved experience' + (names.length === 1 ? '' : 's');
  $('contList').innerHTML = names.map(n => {
    const a = db.adventures[n], turns = a.transcript.filter(t => t.role === 'player').length;
    return '<div class="advrow"><button class="big" data-n="' + esc(n) + '">' + esc(n) + '<small>' + (timed(a) ? (isSim(a) ? 'Simulator' : 'Story') + ' · ' + Math.round(playedSecs(a) / 60) + ' of ' + a.minutes + ' min' + (a.feeling ? ' · ' + esc(a.feeling) : '') : turns + ' turns') + ' · ' + esc(a.location || 'not started') + (a.updated ? ' · ' + new Date(a.updated).toLocaleDateString() : '') + '</small></button>' +
      '<button class="side" data-seq="' + esc(n) + '" title="New adventure with this cast and world">&#8635; Same cast</button>' +
      '<button class="side" data-del="' + esc(n) + '" title="Delete">✕</button></div>';
  }).join('');
  $('contList').querySelectorAll('[data-n]').forEach(b => b.onclick = () => enterAdventure(b.dataset.n, false));
  $('contList').querySelectorAll('[data-seq]').forEach(b => b.onclick = () => startSequel(b.dataset.seq));
  $('contList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const n = b.dataset.del; if (!confirm('Delete "' + n + '"? This cannot be undone.')) return;
    delete db.adventures[n]; if (db.current === n) db.current = ''; persist(n); renderStart(); refresh();
  });
}
$('newExpBtn').onclick = () => { cur = newCur(); $('start').classList.remove('on'); $('curator').classList.add('on'); $('curNext').disabled = false; curRender(); };
$('contBtn').onclick = () => { $('contList').style.display = $('contList').style.display === 'none' ? '' : 'none'; };
$('menuBtn').onclick = () => { renderStart(); $('start').classList.add('on'); };
$('closeStart').onclick = () => $('start').classList.remove('on');
$('startSettings').onclick = () => { $('start').classList.remove('on'); showTab('settings'); };
$('closeFinale').onclick = () => $('finale').classList.remove('on');
$('finaleMenu').onclick = () => { $('finale').classList.remove('on'); renderStart(); $('start').classList.add('on'); };
$('finaleSequel').onclick = () => startSequel(db.current);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('start').classList.contains('on') && A()) $('start').classList.remove('on'); });
async function enterAdventure(name, isNew) {
  flushEdits(); loreEditing = null; bibleDirty = false;   // save edits to the adventure you are leaving first
  db.current = name; { const a = A(); if (a && timed(a) && a.transcript.length) a.lastSendAt = Date.now(); }   // the time away is a break, not play time
  persist(name); $('start').classList.remove('on'); showTab('story'); refresh();
  if (isNew) await send(); else if (A() && A().result) showFinale(A()); else recap();
}

// ---------------- Mission track ----------------
function renderMap() {
  const a = A(); if (!a) { $('map').innerHTML = ''; return; }
  const m = a.mood, meter = v => '<span style="color:var(--accent);letter-spacing:2px">' + '&#9679;'.repeat(v) + '</span><span style="color:var(--line);letter-spacing:2px">' + '&#9679;'.repeat(10 - v) + '</span>';
  let html = '<h3>THE FEELING</h3><div class="card"><b>' + esc(feelingOf(a)) + '</b>' + (m ? '<br>' + meter(m.feeling) + ' <span class="tag">' + m.feeling + '/10 last reading' + (m.hooked_on ? ' &middot; enjoying ' + esc(m.hooked_on) : '') + '</span>' : '<br><span class="tag">Readings appear as you play.</span>') + '</div>' +
    (timed(a) ? '<p class="tag">' + (isSim(a) ? 'Experience simulator' : 'Curated story') + ' &middot; ' + Math.round(playedSecs(a, true) / 60) + ' of ' + a.minutes + ' minutes played' + (a.left != null && !a.result ? ' &middot; about ' + a.left + ' more turn' + (a.left === 1 ? '' : 's') : '') + '</p>' : '');
  if (isSim(a)) html += "<h3>YOUR GOAL</h3><div class=\"card\">" + esc(goalOf(a) || '(open)') + (a.goalProgress ? '<br><span class="tag">So far: ' + esc(a.goalProgress) + '</span>' : '') + '</div>' + (a.location ? '<p class="tag">You are at: ' + esc(a.location) + '</p>' : '');
  else html += '<h3>MISSION TRACK</h3>' + (a.location ? '<p class="tag">Current location: ' + esc(a.location) + '</p>' : '') + '<div class="quest">' +
    (a.beats.map(b => '<div class="q ' + (b.status === 'done' ? 'done' : b.status === 'active' ? 'active' : '') + '">' + esc(b.beat) + ' <span class="tag">' + esc(b.status || '') + '</span></div>').join('') || '<span class="tag">Mission steps will appear here.</span>') + '</div>';
  const placesSeen = Object.values(a.places).filter(p => p.visits > 0).map(p => p.name);
  if (isSim(a) && placesSeen.length) html += '<h3>PLACES YOU HAVE BEEN</h3><p>' + esc(placesSeen.join(' · ')) + '</p>';
  if (a.events.length) html += '<h3>' + (isSim(a) ? 'MOMENTS CAPTURED' : 'RECENT EVENTS') + '</h3><pre>' + esc(a.events.slice(-10).join('\n')) + '</pre>';
  $('map').innerHTML = html;
}
// ---------------- UI ----------------
let bulk = false, fitEl = null;
// Snap to the newest message; if it is taller than the visible area, shrink its font (down to 12px) so it fits, else align its top.
function fitLast() {
  const main = document.querySelector('main'), box = $('story');
  if (bulk || !box.classList.contains('on')) return;
  const msgs = box.querySelectorAll('.msg'); if (!msgs.length) return;
  const last = msgs[msgs.length - 1];
  if (fitEl && fitEl !== last) fitEl.style.fontSize = '';
  fitEl = last; last.style.fontSize = '';
  const avail = main.clientHeight - 24; let fs = 16;
  while (last.offsetHeight > avail && fs > 12) { fs--; last.style.fontSize = fs + 'px'; }
  if (last.offsetHeight <= avail) main.scrollTop = main.scrollHeight;
  else main.scrollTop += last.getBoundingClientRect().top - main.getBoundingClientRect().top - 8;
}
window.addEventListener('resize', fitLast);
// The animation beside "The phonodeck is thinking": a small holographic core (two counter-rotating rings, an orbiting spark, a pulsing heart).
// Inline SVG and CSS, so it costs nothing to load.
const HOLO_SVG = '<svg class="holo" viewBox="0 0 40 40" width="44" height="44" aria-hidden="true"><circle class="h1" cx="20" cy="20" r="17" stroke-dasharray="22 6 3 6"/><circle class="h2" cx="20" cy="20" r="11.5" stroke-dasharray="12 4"/><g class="h3"><circle cx="20" cy="3" r="1.8"/></g><circle class="h4" cx="20" cy="20" r="4.5"/></svg>';
function addMsg(cls, text) {
  const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = md(text);
  $('story').appendChild(d); fitLast(); return d;
}
function renderStory() {
  $('story').innerHTML = ''; const a = A(); fitEl = null;
  if (!a) { addMsg('sys', 'Open the Menu to start or continue an experience.'); return; }
  bulk = true; a.transcript.forEach(t => addMsg(t.role === 'player' ? 'pl' : 'gm', t.text)); bulk = false; fitLast();
  if (!a.transcript.length) addMsg('sys', 'Press Send to begin the adventure.');
  if (a.result) { const m = addMsg('sys', 'The adventure is complete. Tap here to see your report card.'); m.style.cursor = 'pointer'; m.onclick = () => showFinale(a); }
  if (pendingNotice) { addMsg('sys', pendingNotice); pendingNotice = ''; }
}
function renderPanels() {
  const a = A(); showUsage();
  showClock();
  syncBibleBox();
  renderMap();
  if (!loreEditing) renderLore();   // re-rendering an open edit form would wipe what is being typed
  $('usage').textContent = 'Browser storage used: ' + (new Blob([localStorage.getItem(KEY) || '']).size / 1024).toFixed(1) + ' KB of about 5,000 KB.';
}
function refresh() { renderStory(); renderPanels(); }
function showClock() {   // header: the time left (live), or the turn count for older turn-based adventures
  const a = A(), live = a && timed(a) && !a.result && !a.ended;
  $('advTitle').textContent = db.current || '';
  const left = live ? Math.ceil(secsLeft(a, a.transcript.length > 0) / 60) : 0;
  $('advLeft').innerHTML = !a ? '' : timed(a) ? (a.result || a.ended ? 'complete' : '&#9201; ' + left + '<span class="wide"> of ' + (+a.minutes) + '</span> min<span class="wide"> left</span>') : a.length ? 'turn ' + Math.min(playerTurns(a), a.length) + '/' + a.length : '';
  $('clock').style.display = $('advLeft').innerHTML ? '' : 'none'; $('clock').classList.toggle('low', live && left <= 3);
  $('moreTime').style.display = live && !a.finishing ? '' : 'none';
  $('timeBar').firstChild.style.width = !a || !timed(a) ? '0' : a.result || a.ended ? '100%' : Math.min(100, Math.max(0, 100 - left / a.minutes * 100)) + '%';
}
setInterval(() => { if (!document.hidden) showClock(); }, 15000);
$('moreTime').onclick = () => {   // having a good time: stretch the session (the ending moves back accordingly)
  const a = A(); if (!a || !timed(a) || a.result || a.ended) return;
  a.minutes += 10; a.left = Math.max(0, Math.floor(secsLeft(a) / turnSecs(a) + 0.35));
  a.bible = a.bible.replace(/\*\*Session length:\*\* \d+ minutes/, '**Session length:** ' + a.minutes + ' minutes'); a.bibleSeen = a.bible;
  persist(); showClock(); addMsg('sys', 'Ten more minutes on the clock (' + a.minutes + ' in all). The ending moves back to match.');
};
function showTab(t) { flushEdits(); document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t)); document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === t)); if (t !== 'story') { renderPanels(); document.querySelector('main').scrollTop = 0; } else fitLast(); }   // other tabs open at the top; the story snaps to the newest message
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.t));
function showSub(p) { document.querySelectorAll('#subnav button').forEach(x => x.classList.toggle('on', x.dataset.p === p)); document.querySelectorAll('#settings .sp').forEach(x => x.classList.toggle('on', x.dataset.p === p)); document.querySelector('main').scrollTop = 0; }
document.querySelectorAll('#subnav button').forEach(b => b.onclick = () => showSub(b.dataset.p));
$('startSettings').addEventListener('click', () => showSub('conn'));
$('saveBible').onclick = () => saveBibleNow();
// Bible edits autosave (debounced + on leaving the box) and are flagged so the Game Master is told about them on the next reply.
let bibleTimer = null, bibleDirty = false;
function saveBibleNow() {
  clearTimeout(bibleTimer); bibleDirty = false;
  const a = A(); if (!a) return;
  const v = $('bibleEdit').value; if (v === a.bible) { $('bibleStatus').textContent = 'Up to date.'; return; }
  a.bible = v;   // takeTurn diffs this against the version the GM last saw and tells it exactly what changed
  if (a.undo) a.undo.mem.bible = v;   // so Undo never reverts a hand edit
  persist(); $('bibleStatus').textContent = 'Saved ' + new Date().toLocaleTimeString() + '. Takes effect from your next message.';
}
// Shows the latest bible (the AI refreshes it in the background) unless you are in the middle of editing it.
function fitBible() { const el = $('bibleEdit'); if (!el.offsetParent) return; const main = document.querySelector('main'), top = main.scrollTop; el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; main.scrollTop = top; }
window.addEventListener('resize', fitBible);
function syncBibleBox() {
  const a = A(); if (document.activeElement !== $('bibleEdit') && !bibleDirty) $('bibleEdit').value = a ? a.bible : ''; fitBible();
  $('biblePhoto').innerHTML = a && a.photo && a.photo.thumb ? '<img src="' + a.photo.thumb + '" alt="" style="max-width:100%;max-height:200px;border-radius:8px"><p class="tag">This world was painted from your photo (' + esc([a.photo.place, a.photo.era].filter(Boolean).join(', ')) + ').</p>' +
    (a.photo.canvas ? '<details class="tag" style="margin-bottom:10px"><summary>What the phonodeck saw in it</summary><p style="white-space:pre-wrap">' + esc(a.photo.canvas) + '</p></details>' : '') : '';
}
// Saves any unsaved bible or lore edit. Called on Send, tab changes and adventure switches, because iPad Safari often does not fire
// "blur" when you tap a button, and an open lore form (which has its own Save button) was silently dropped.
function flushEdits() {
  if (bibleDirty) saveBibleNow();
  if (loreEditing && A() && $('loreName')) { if ($('loreName').value.trim()) saveLore(loreEditing); else loreEditing = null; }
}
$('bibleEdit').addEventListener('input', () => { fitBible(); bibleDirty = true; $('bibleStatus').textContent = 'Editing...'; clearTimeout(bibleTimer); bibleTimer = setTimeout(saveBibleNow, 700); });
$('bibleEdit').addEventListener('blur', () => { if (bibleDirty) saveBibleNow(); });

let dictated = false;   // set when a message came from hands-free dictation
async function cleanDictation(text) {
  if (S().fake || !hasKey()) return text;
  const a = A(), lastGm = [...a.transcript].reverse().find(t => t.role === 'gm');
  try {
    const out = await Promise.race([chat('clean', [{ role: 'system', content: CLEAN_RULES },
      { role: 'user', content: 'STORY NAMES: ' + (Object.values(a.lore).map(e => e.name).slice(0, 40).join(', ') || '(none)') + '\nLOCATION: ' + (a.location || 'unknown') +
        '\nTHE NARRATOR JUST SAID:\n' + (lastGm ? lastGm.text.slice(-700) : '(this is the opening)') + '\n\nDICTATED TEXT:\n' + text }]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    const t = String(out).trim();
    return t && t.length > text.length * 0.5 && t.length < text.length * 1.5 + 20 ? t : text;   // reject answers that rewrote too much
  } catch (e) { console.warn('dictation cleanup skipped:', e.message); return text; }
}
async function send() {
  if (busy || !A()) return;
  flushEdits();
  const wasDictated = dictated; dictated = false;
  { const a0 = A();
    if (a0.result) { showFinale(a0); return; }
    if (a0.finishing) return;
    if (isOver(a0)) { finishAdventure(); return; } }   // the final reply is in: (re)try the report
  let text = $('input').value.trim();
  const first = A().transcript.length === 0;
  if (!text && !first) return;
  busy = true; $('send').disabled = true; showTab('story'); dictBuf = '';
  usageBase = Object.assign(JSON.parse(JSON.stringify(A().usage || {})), { __adv: db.current });
  stopSpeech(); blip(wasDictated ? 'ack' : 'sent'); startAmbient();
  if (wasDictated && text && S().cleanDict !== false) text = await cleanDictation(text);
  const hidden = first && !text;
  if (hidden) text = isSim(A()) ? 'Begin the experience. Write an immersive opening of 150-250 words that places the player right inside the world, already there, painted in specific detail that could only belong to this place, delivering the FEELING TO ACHIEVE from the first lines and making their goal feel within reach. At most one person with a distinct voice and a touch of gentle humour. No threat, no hook, no mystery. Do not end with a list of options.'
    : isShort(A()) ? 'Begin the story. Write a clean, gripping opening of 90-150 words that drops the player into one clear, vivid moment, introduces one named character with a distinct voice and a telling detail or two, and makes the goal obvious. Add a touch of humour and end on a simple, irresistible hook. Do not end with a list of options.'
    : 'Begin the adventure. Write a cinematic opening of 150-250 words that drops the player into a vivid moment already in motion, in specific detail that could only belong to this story, honoring the Player\'s Wishes and the bible, and setting up the FEELING TO ACHIEVE from the first lines. Introduce at most one named character, with a distinct voice and a want of their own and two or three telling details as a gifted author would (anyone else present is known by their role), include a touch of specific humour, and end on an unresolved hook. Do not end with a list of options.';
  else addMsg('pl', text);
  $('input').value = '';
  const wait = addMsg('sys thinking', ''); wait.innerHTML = HOLO_SVG + '<span>The phonodeck is thinking...</span>';
  const t0 = Date.now(), waitTimer = setInterval(() => { wait.lastChild.textContent = 'The phonodeck is thinking... ' + Math.round((Date.now() - t0) / 1000) + 's (' + holoStage + ')'; }, 1000);
  const stopWait = () => clearInterval(waitTimer);
  const speaker = (S().speak && (TTS || useGemini())) ? makeSpeaker(() => { stopAmbient(); if (handsActive) setTimeout(listen, 300); }) : null;
  let bubble = null, streamed = '';
  const onDelta = d => {
    if (!bubble) { stopWait(); console.log('first token after ' + (Date.now() - t0) + ' ms'); wait.remove(); bubble = addMsg('gm', ''); }
    streamed += d; bubble.innerHTML = md(streamed); fitLast();
    if (speaker) speaker.push(d);
  };
  try {
    const reply = await takeTurn(text, hidden, onDelta);
    stopWait();
    if (!bubble) { wait.remove(); bubble = addMsg('gm', reply); if (speaker) speaker.push(reply); }
    else { bubble.innerHTML = md(reply); fitLast(); }
    if (speaker) speaker.end(); else { stopAmbient(); if (handsActive) setTimeout(listen, 300); }
  } catch (e) {
    stopWait(); stopAmbient(); wait.remove(); if (bubble && !streamed) bubble.remove();
    if (speaker) speaker.end();
    addMsg('sys', e.quota ? e.message : 'Error: ' + e.message + (first ? ' (press Send to retry)' : ''));
  }
  busy = false; $('send').disabled = false; renderPanels();
  { const a = A(); if (a && !hidden && !a.result && !a.finishing && isOver(a)) finishAdventure(); }
}
$('send').onclick = () => { ensureAudio(); send(); };
$('input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !/Mobi|Android|iPhone/.test(navigator.userAgent)) { e.preventDefault(); send(); } });

// ---------------- Settings ----------------
function fillCombo(id, opts, cur, allowNone) {   // a model picker: suggestions, any saved custom value, and "Custom..."
  const el = $(id), list = [...new Set(opts.filter(Boolean))]; if (cur && !list.includes(cur)) list.push(cur);
  el.innerHTML = (allowNone ? '<option value="">(none: keyword memory only)</option>' : '') + list.map(v => '<option>' + esc(v) + '</option>').join('') + '<option value="__custom">Custom...</option>';
  el.value = cur || (allowNone ? '' : list[0] || ''); el.dataset.prev = el.value;
}
function wireCombo(id) {
  const el = $(id);
  el.addEventListener('change', () => {
    if (el.value !== '__custom') { el.dataset.prev = el.value; return; }
    const v = (prompt('Enter the model name:') || '').trim();
    if (v) { if (![...el.options].some(o => o.value === v)) el.insertBefore(new Option(v, v), el.lastChild); el.value = v; el.dataset.prev = v; }
    else el.value = el.dataset.prev;
    autoSave();
  });
}
['setModel', 'setCheap', 'setEmbed', 'setTtsModel'].forEach(wireCombo);
function fillModels() {
  fillCombo('setModel', [GEMINI.model, ...GEMINI.models], S().model || GEMINI.model);
  fillCombo('setCheap', [GEMINI.cheap, ...GEMINI.models, GEMINI.cheapLite], S().cheap || GEMINI.cheap);
  fillCombo('setEmbed', [GEMINI.embed], embedModel(), true);
  fillCombo('setTtsModel', [GEMINI.ttsModel, GEMINI.ttsBackup], S().ttsModel || GEMINI.ttsModel);
}
$('setTtsVoice').innerHTML = GEMINI_VOICES.map(v => '<option>' + v + '</option>').join('') + '<option value="__custom">Custom voice ID...</option>';
function syncTtsVoiceUI() { $('setTtsVoiceCustom').style.display = $('setTtsVoice').value === '__custom' ? '' : 'none'; }
$('setTtsVoice').addEventListener('change', () => { syncTtsVoiceUI(); db.settings.narratorPicked = true; });
function loadTtsVoice() {
  const v = S().ttsVoice || DEFAULT_TTS_VOICE;
  if (GEMINI_VOICES.includes(v)) $('setTtsVoice').value = v; else { $('setTtsVoice').value = '__custom'; $('setTtsVoiceCustom').value = v; }
  syncTtsVoiceUI();
}
const ttsVoiceValue = () => $('setTtsVoice').value === '__custom' ? ($('setTtsVoiceCustom').value.trim() || DEFAULT_TTS_VOICE) : $('setTtsVoice').value;
function loadSettings() {
  if (S().voiceV !== 3) { delete db.settings.voice; db.settings.voiceV = 3; }   // one-time: forget auto-saved browser voices (Automatic is now the default)
  if ((S().effortV || 0) < 3) { db.settings.effort = 'low'; db.settings.effortV = 3; }   // one-time: low thinking by default (deep thinking was the biggest cost)
  if ((S().notesV || 0) < 2) { db.settings.notesModel = 'cheap'; db.settings.notesV = 2; }   // one-time: hidden plot notes on the cheap model
  if (S().ttsV !== 1) { db.settings.ttsEngine = 'gemini'; db.settings.speak = true; db.settings.ttsV = 1; }   // one-time: Gemini narrator voice and reading aloud are on by default
  if (S().prices === '2,12,0.5,3,10') delete db.settings.prices;   // the old default prices: use the corrected ones
  if (S().ttsChunkV !== 3) { db.settings.ttsChunk = '2000'; db.settings.ttsChunkV = 3; if (S().ttsModel === 'gemini-3.8-flash-tts') delete db.settings.ttsModel; }   // one-time: lite voice model, about 3 voice requests per reply
  $('setEffort').value = S().effort === undefined ? 'low' : S().effort;
  $('setTuneRecent').value = tune('recent'); $('setTuneChapters').value = tune('chapters'); $('setTuneRecall').value = tune('recall');
  $('setNotesModel').value = S().notesModel || 'cheap'; $('setTtsChunk').value = ['one', 'two', '2000', '700'].includes(String(S().ttsChunk)) ? String(S().ttsChunk) : '2000'; $('setPrices').value = S().prices || GEMINI.prices;
  $('setKey').value = S().key || ''; $('setFake').checked = !!S().fake; $('setNoEmbed').checked = !!S().noEmbed; $('setSpeak').checked = !!S().speak; $('setCleanDict').checked = S().cleanDict !== false;
  $('setAmbient').value = S().ambient || ''; $('setRate').value = S().rate || 1; $('setEngine').value = S().ttsEngine || 'gemini'; $('setTtsStyle').value = S().ttsStyle || DEFAULT_TTS_STYLE;
  const me = S().me || {}; $('setMeName').value = me.name || ''; $('setMeLast').value = me.last || ''; $('setMeGender').value = me.gender || ''; $('setMeInterest').value = me.interest || ''; $('setMeBorn').value = me.born || '';
  fillModels(); loadTtsVoice();
}
$('expBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ adventures: db.adventures, current: db.current }, null, 1)], { type: 'application/json' }));
  a.download = 'phonodeck-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
};
$('impBtn').onclick = () => $('impFile').click();
$('impFile').onchange = async e => {
  try {
    const o = JSON.parse(await e.target.files[0].text());
    if (o.adventures) Object.entries(o.adventures).forEach(([n, a]) => { db.adventures[n] = norm(a); persist(n); });
    else if (o.name && o.adventure) { db.adventures[o.name] = norm(o.adventure); persist(o.name); }
    else throw new Error('Unrecognised file');
    renderStart(); refresh(); alert('Imported.');
  } catch (err) { alert('Import failed: ' + err.message); }
};
function collectSettings() {   // the browser voice is saved by its own handler (only when you pick one)
  return { effort: $('setEffort').value, effortV: 3, notesV: 2, ttsV: 1, voiceV: 3, ttsChunkV: 3, welcomed: true, tune_recent: +$('setTuneRecent').value, tune_chapters: +$('setTuneChapters').value, tune_recall: +$('setTuneRecall').value,
    notesModel: $('setNotesModel').value, ttsChunk: $('setTtsChunk').value, prices: $('setPrices').value.trim() || GEMINI.prices, key: $('setKey').value.trim(), model: $('setModel').value.trim(), cheap: $('setCheap').value.trim(), fake: $('setFake').checked,
    embed: $('setEmbed').value.trim(), noEmbed: $('setNoEmbed').checked, speak: $('setSpeak').checked, cleanDict: $('setCleanDict').checked, ambient: $('setAmbient').value,
    me: { name: $('setMeName').value.trim(), last: $('setMeLast').value.trim(), gender: $('setMeGender').value.trim(), interest: $('setMeInterest').value.trim(), born: +$('setMeBorn').value || 0 },
    rate: +$('setRate').value, ttsEngine: $('setEngine').value, ttsVoice: ttsVoiceValue(), ttsModel: $('setTtsModel').value.trim(), ttsStyle: $('setTtsStyle').value.trim() };
}
function keyStatus() {
  const k = S().key;
  $('keyStatus').textContent = (k ? 'Key saved (ends in ' + k.slice(-4) + '). ' : guest() ? 'Playing on an invite, so no key is needed. ' : 'No key saved yet. ') + 'Story model: ' + (S().model || GEMINI.model) + ' | cheap model: ' + cheapModel() +
    (S().freeTier ? ' | KEY WITHOUT BILLING: the story uses the cheap model' : '') + (S().fake ? ' | OFFLINE TEST MODE IS ON' : '');
}
function autoSave() {
  const old = db.settings, next = Object.assign({}, old, collectSettings());   // merged, so settings that are not on the form (like the browser voice) survive
  if (!(old.freeTier && old.key === next.key && (old.model || GEMINI.model) === next.model)) delete next.freeTier;   // a new key or story model gets re-checked
  db.settings = next; persist(); keyStatus(); document.body.classList.toggle('guest', guest()); showUsage();
}
$('saveSet').onclick = () => { autoSave(); alert('Settings saved.'); };
document.querySelectorAll('#settings input:not([type=file]), #settings select:not(#setVoice), #settings textarea').forEach(el => { el.addEventListener('change', autoSave); if (el.type === 'password' || el.type === 'text' || el.tagName === 'TEXTAREA') el.addEventListener('input', autoSave); });
$('testConn').onclick = async () => {
  autoSave(); const st = $('connStatus');
  if (!S().key) { st.textContent = 'Enter an API key first.'; return; }
  st.textContent = 'Testing...';
  try {
    const r = await netFetch(GEMINI.base + '/models', { headers: headers() });
    if (!r.ok) throw await llmError(r, 'the model list');
    const ids = ((await r.json()).data || []).map(m => String(m.id).replace(/^models\//, ''));
    const chatM = ids.filter(i => /^gemini/.test(i) && !/embed|tts|image|live|audio|vision/.test(i));
    const add = (id, list) => { const el = $(id); list.forEach(v => { if (![...el.options].some(o => o.value === v)) el.insertBefore(new Option(v, v), el.lastChild); }); };
    add('setModel', chatM); add('setCheap', chatM); add('setEmbed', ids.filter(i => /embed/.test(i))); add('setTtsModel', ids.filter(i => /tts/.test(i)));
    // If a default model is not offered to this key, pick the closest available one instead of failing on the first turn.
    const swapped = [], sorted = [...chatM].sort().reverse();
    [['setModel', [/pro/]], ['setCheap', [/flash(?!.*lite)/, /flash/]]].forEach(([el, res]) => {
      if (!chatM.length || chatM.includes($(el).value)) return;
      for (const re of res) { const hit = sorted.find(i => re.test(i)); if (hit) { $(el).value = hit; swapped.push(hit); break; } }
    });
    if (swapped.length) autoSave();
    st.textContent = 'Key works. ' + ids.length + ' models found; the model pickers above now list the ones available to you.' + (swapped.length ? ' Switched to available models: ' + swapped.join(', ') + '.' : '') + ' ' + await probeTier();
  } catch (e) { st.textContent = 'Failed: ' + e.message; }
};
function closeWelcome() { db.settings.welcomed = true; persist(); $('welcome').classList.remove('on'); }
$('wStart').onclick = () => {
  const k = $('wKey').value.trim(); if (!k) { alert('Paste your API key first, or choose the offline demo.'); return; }
  $('setKey').value = k; autoSave(); closeWelcome(); probeTier(); $('newExpBtn').click();   // the tier check runs while you answer the questions
};
$('wDemo').onclick = () => { $('setFake').checked = true; autoSave(); closeWelcome(); $('newExpBtn').click(); };
$('wSkip').onclick = closeWelcome;

// ---------------- Invited guest: welcome screen ----------------
function guestWelcomeText() {
  const i = inviteInfo; if (!i) return;
  if (i.name) $('gwHello').textContent = 'Hi ' + i.name + ', you have been invited to play.';
  $('gwLeft').textContent = i.status !== 'active' ? INVITE_OFF_MSG : i.minutesLeft > 0 ? 'Your invite has about ' + i.minutesLeft + ' minutes of play.' : QUOTA_MSG;
}
// The "Why" on both welcome screens, in Simon's own words.
const WHY_HTML = '<details class="why"><summary>Why</summary>' +
  '<p>Anxious about the future, so I built the one I want to see.</p>' +
  '<p>I leaned in with Claude Code to build a proto holodeck. LLMs can arguably pass the Turing test now, so I figured why not push them to tell a good story? ' +
  'I think before we get crazy into graphics, we should focus on the elements that make a good story.</p>' +
  '<p>Cue <b>The Phonodeck</b>: a text-to-speech lucid dream.</p><ul>' +
  '<li><b>It\'s totally open source!</b> Feel free to <a href="https://github.com/simbonk/phonodeck" target="_blank" rel="noopener" style="color:var(--accent)">peek under the covers</a>. It\'s basically a bunch of LLMs strung together with the Gemini API to narrate a story, with director and game master models that hover in the background and try to hook you.</li>' +
  '<li><b>Your data stays with you.</b> Everything lives locally in your browser, RAG style. As the story balloons, it keeps you in the bubble without getting bogged down in context. I\'m not scraping any data: that\'s not the goal.</li>' +
  '<li><b>Hands-free mode!</b> Close your eyes, talk, and say "make it so" to send your thoughts. When I chat by voice elsewhere it cuts my thoughts off, and this works much better.</li></ul>' +
  '<p>This runs pretty hot (probably a bit ahead of its time commercially, and it could definitely use more eyeballs to help optimize). I\'m up for ideas, and curious to see where this craziness goes. My North Star is Star Trek: The Next Generation, so I\'ll lean that way.</p>' +
  '<p>Second star to the right, and straight on till morning!</p></details>';
document.querySelectorAll('.whyBox').forEach(el => el.innerHTML = WHY_HTML);

// Both welcome screens (w: first run, gw: invited guest) let you test the microphone before you start.
const MIC_UI = { w: { where: 'this page' }, gw: { where: 'the invite link you were sent', start: 'gwStart', go: 'Start' } };
function voiceCheck(p) {   // hands-free needs the browser's speech recognition (Firefox has none): say so before they get going
  const ok = !!SR, u = MIC_UI[p]; $(p + 'NoVoice').style.display = ok ? 'none' : ''; $(p + 'Mic').style.display = ok ? '' : 'none';
  if (u.start) { $(u.start).classList.toggle('primary', ok); $(u.start).firstChild.textContent = ok ? u.go : 'Continue by typing'; }
}
// Allowing the microphone is not enough: some browsers have speech recognition that never returns words (Firefox, Brave, some Linux builds),
// so listen for a few seconds and show what was heard.
const VOICE_FAIL = where => 'This browser could not turn your speech into words. Hands-free needs <b>Chrome</b>, <b>Edge</b> or <b>Safari</b>, so please open ' + where + ' in one of those. You can still type here if you prefer.';
function voiceFailed(p, why) {
  const u = MIC_UI[p]; $(p + 'MicStatus').textContent = why || '';
  $(p + 'NoVoice').innerHTML = VOICE_FAIL(u.where); $(p + 'NoVoice').style.display = '';
  if (u.start) { $(u.start).classList.remove('primary'); $(u.start).firstChild.textContent = 'Continue by typing'; }
}
async function micTest(p) {
  const st = $(p + 'MicStatus'), btn = $(p + 'Mic');
  if (!SR) return voiceFailed(p);
  try { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); m.getTracks().forEach(t => t.stop()); }
  catch (e) { st.textContent = 'The microphone was not allowed (' + e.name + '). Allow it in your browser\'s settings for this site (the icon left of the address), then test again. You can still type.'; return; }
  let r; try { r = new SR(); } catch (e) { return voiceFailed(p); }
  r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = false;
  let heard = '', failed = '', done = false;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); try { r.abort(); } catch (e) {} btn.disabled = false; btn.firstChild.textContent = 'Test again';
    if (heard) { st.innerHTML = 'Heard: <b>"' + esc(heard) + '"</b>. Hands-free works, you are all set.'; voiceCheck(p); }
    else if (failed === 'no-speech' || !failed) st.textContent = 'I did not hear anything. Check the microphone is not muted, then test again and speak up.';
    else if (failed === 'not-allowed' || failed === 'service-not-allowed' || failed === 'network' || failed === 'language-not-supported') voiceFailed(p, 'Speech-to-text did not work here (' + failed + ').');
    else st.textContent = 'The test did not finish (' + failed + '). Try again.'; };
  r.onresult = e => { heard = [...e.results].map(x => x[0].transcript).join(' ').trim(); st.innerHTML = 'Hearing: <i>' + esc(heard) + '</i>'; };
  r.onerror = e => { failed = e.error || 'error'; };
  r.onend = () => setTimeout(finish, 50);
  const timer = setTimeout(finish, 9000);
  btn.disabled = true; btn.firstChild.textContent = 'Listening... say something';
  st.textContent = 'Listening. Say "Hello, phonodeck".';
  try { r.start(); } catch (e) { failed = 'start'; finish(); }
}
$('wMic').onclick = () => micTest('w');
$('gwMic').onclick = () => micTest('gw');
$('gwStart').onclick = () => {
  db.settings.guestWelcomed = db.settings.welcomed = true; db.settings.speak = true; persist();
  $('guestWelcome').classList.remove('on');
  if (!Object.keys(db.adventures).length) $('newExpBtn').click();
};

// ---------------- Invite admin: open the game with ?admin ----------------
let admPw = ''; try { admPw = sessionStorage.getItem('holodeck.admin') || ''; } catch (e) {}
async function admCall(action, extra) {
  const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': admPw }, body: JSON.stringify(Object.assign({ action }, extra || {})) });
  const o = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(o.message || { 401: 'Wrong password.', 404: 'The invite server is not on this site (see "Invite friends" in the README).' }[r.status] || 'HTTP ' + r.status + ' ' + (o.error || ''));
  return o;
}
const inviteLink = c => location.origin + location.pathname + '?invite=' + c;
const money = n => '$' + (+n).toFixed(2);
function admRender(o) {
  $('admLogin').style.display = 'none'; $('admMain').style.display = '';
  $('admList').innerHTML = !o.invites.length ? '<p class="tag">No invites yet.</p>' : '<table class="adm"><tr><th>Name</th><th>Allowance</th><th>Used</th><th>Left</th><th>Last played</th><th>Status</th><th></th></tr>' +
    o.invites.map(i => '<tr><td><b>' + esc(i.name) + '</b><br><span class="tag">' + esc(i.code) + '</span></td><td>' + money(i.allow) + '</td><td>' + money(i.spent) + '<br><span class="tag">' + i.minutesPlayed + ' min</span></td>' +
      '<td>about ' + i.minutesLeft + ' min</td><td>' + (i.last ? new Date(i.last).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-') + '</td><td>' + (i.status === 'active' ? 'Active' : 'Paused') + '</td>' +
      '<td><button data-act="copy" data-code="' + esc(i.code) + '">Copy link</button><button data-act="add" data-code="' + esc(i.code) + '">Add more</button>' +
      '<button data-act="' + (i.status === 'active' ? 'pause' : 'resume') + '" data-code="' + esc(i.code) + '">' + (i.status === 'active' ? 'Pause' : 'Resume') + '</button><button data-act="delete" data-code="' + esc(i.code) + '" data-name="' + esc(i.name) + '">Delete</button></td></tr>').join('') + '</table>';
  $('admTotals').textContent = 'Guests this month: ' + money(o.month) + ' of the ' + money(o.ceiling) + ' monthly ceiling (every invite stops if it is reached). All time: ' + money(o.total) + '.';
}
async function admRun(action, extra, done) {
  $('admMsg').textContent = '';
  try { const o = await admCall(action, extra); admRender(o); if (done) done(o); }
  catch (e) { $('admMsg').textContent = e.message; if (/password/i.test(e.message)) { $('admLogin').style.display = ''; $('admMain').style.display = 'none'; } }
}
function copyLink(c) {
  const l = inviteLink(c);
  (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => { $('admMsg').textContent = 'Link copied: ' + l; }, () => prompt('Copy this link:', l));
}
$('admGo').onclick = () => { admPw = $('admPass').value; try { sessionStorage.setItem('holodeck.admin', admPw); } catch (e) {} admRun('list'); };
$('admPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('admGo').click(); });
$('admCreate').onclick = () => {
  const name = $('admName').value.trim(), allow = +$('admAllow').value;
  if (!name || !(allow > 0)) { $('admMsg').textContent = 'Type a name and an allowance first.'; return; }
  admRun('create', { name, allow }, o => { $('admName').value = '';
    $('admLink').innerHTML = '<p>Link for ' + esc(name) + ': <code>' + esc(inviteLink(o.created)) + '</code> <button data-act="copy" data-code="' + esc(o.created) + '">Copy</button></p>'; });
};
$('admin').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return; const code = b.dataset.code, act = b.dataset.act;
  if (act === 'copy') copyLink(code);
  else if (act === 'add') { const v = prompt('Add how many dollars? (about 10 cents a minute)', '3'); if (v && +v > 0) admRun('add', { code, amount: +v }); }
  else if (act === 'delete') { if (confirm('Delete the invite for ' + b.dataset.name + '? Their link stops working.')) admRun('delete', { code }); }
  else admRun(act, { code });
});
$('admClose').onclick = () => { $('admin').classList.remove('on'); history.replaceState(null, '', location.pathname); };

// ---------------- Start up ----------------
if (!db.adventures[db.current]) db.current = '';
loadSettings(); persist(); refresh(); renderStart(); initDir(); initVoices();
document.body.classList.toggle('guest', guest());
if (guest()) { if (!S().guestWelcomed) { $('guestWelcome').classList.add('on'); voiceCheck('gw'); } loadInvite(); }
else if (!S().key && !S().fake && !S().welcomed && !Object.keys(db.adventures).length) { $('welcome').classList.add('on'); voiceCheck('w'); }
if (new URLSearchParams(location.search).has('admin')) { $('admin').classList.add('on'); if (admPw) admRun('list'); }
keyStatus();
(function storageCheck() {
  let ok = true;
  try { localStorage.setItem('holodeck.test', '1'); if (localStorage.getItem('holodeck.test') !== '1') ok = false; localStorage.removeItem('holodeck.test'); } catch (e) { ok = false; }
  const w = $('originWarn'), msgs = [];
  if (!ok) msgs.push('This browser is blocking storage for this page, so settings and adventures will NOT be remembered.');
  if (location.protocol === 'file:') msgs.push('Opened as a local file: some browsers restrict these pages (storage, microphone permission, folder saving). For best results, serve the folder from a local web server (see the README).');
  if (msgs.length) { w.textContent = msgs.join(' '); w.style.display = ''; }
})();
