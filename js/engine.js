// Phonodeck: the story engine: clock, a turn of play, memory, recall, the hidden showrunner and director, chapters, undo and the lore editor.
// Plain scripts that share one global scope (no build step); index.html loads them in order: prompts, experiences, core, engine, voice, curator, ui.

// ---------------- Clock, feeling and play mode ----------------
// Sessions are measured in real minutes, not turns. Each Send adds the time since the previous Send (capped, so a break does not eat the
// session) and the app estimates how many more replies fit from your own recent pace. Older adventures that were set up in turns keep working.
const SEC_PER_TURN = 90;    // first guess at one exchange (reading or hearing the reply, then answering) until your own pace is known
const MAX_GAP = 300;        // at most 5 minutes counted per turn: a longer pause is a break, not play time
const timed = a => !!a && a.minutes > 0;
const isSim = a => !!a && a.mode === 'sim';
function minutesOf(t) {   // "20 minutes", "1 hour", "90 min", "2 hours (an epic)"; default 30
  t = String(t || ''); const h = /(\d+(?:\.\d+)?)\s*(h|hr|hour)/i.exec(t), m = /(\d+)/.exec(t);
  const v = h ? +h[1] * 60 : m ? +m[1] : (/\bhour\b/i.test(t) ? 60 : 30);
  return Math.max(5, Math.min(240, Math.round(v)));
}
function turnSecs(a) {   // median of your last few turns, once there are enough of them
  const t = (a.turnTimes || []).slice(-6); if (t.length < 2) return SEC_PER_TURN;
  const s = [...t].sort((x, y) => x - y), med = s[Math.floor(s.length / 2)];
  return Math.max(30, Math.min(MAX_GAP, (med + SEC_PER_TURN * Math.max(0, 3 - t.length)) / (1 + Math.max(0, 3 - t.length))));
}
const playedSecs = (a, live) => (a.elapsed || 0) + (live && a.lastSendAt ? Math.min(MAX_GAP, (Date.now() - a.lastSendAt) / 1000) : 0);
const secsLeft = (a, live) => Math.max(0, a.minutes * 60 - playedSecs(a, live));
// Called once per reply, before it is written: counts the time played and sets a.left = how many more player replies are likely to fit
// after this one (0 = this reply is the ending). Old turn-based adventures count turns instead.
function clockTick(a, hidden) {
  if (timed(a)) {
    const now = Date.now();
    if (!hidden && a.lastSendAt) { const dt = Math.min(MAX_GAP, Math.max(0, (now - a.lastSendAt) / 1000)); a.elapsed = (a.elapsed || 0) + dt; a.turnTimes = (a.turnTimes || []).concat(Math.round(dt)).slice(-12); }
    a.lastSendAt = now;
    a.left = Math.max(0, Math.floor(secsLeft(a) / turnSecs(a) + 0.35));
    if (hidden && a.left === 0) a.left = 1;   // the opening is never the ending
  } else if (a.length) a.left = Math.max(0, a.length - (playerTurns(a) + (hidden ? 0 : 1)));
  else a.left = null;
}
const isOver = a => !!a && (a.ended || (!timed(a) && a.length > 0 && playerTurns(a) >= a.length));
// Ready-made feeling ideas for "Suggest some feelings" when no model can be asked (offline demo, or the request fails). Specific, story-shaped feelings make better stories than labels.
const FEELING_IDEAS = ['The thrill of getting away with something', 'Coming home after years away', 'Being truly seen by someone', 'Quiet awe under an impossibly big sky',
  'Cosy safety while a storm rages outside', 'Hard-won triumph against the odds', 'Bittersweet nostalgia for a time I never lived', 'The warmth of a found family',
  'Delicious suspense, then sweet relief', 'Wonder at discovering something no one has seen', 'Falling a little in love with a place', 'The calm of having nowhere to be'];
const FEEL_LINE = '**FEELING TO ACHIEVE (the Game Master\'s main goal):**', GOAL_LINE = '**PLAYER\'S GOAL:**';
// The bible's copy wins, so editing the feeling or the goal in the Bible tab changes what the Game Master aims for.
function bibleLine(a, head) { const i = (a.bible || '').indexOf(head); if (i < 0) return ''; return a.bible.slice(i + head.length).split('\n')[0].trim(); }
const feelingOf = a => bibleLine(a, FEEL_LINE) || a.feeling || 'whatever feeling best fits the Player\'s Wishes';
const goalOf = a => bibleLine(a, GOAL_LINE) || a.goal || '';
function feelingRules(a) {
  const f = feelingOf(a), craft = FEELING_CRAFT.filter(([re]) => re.test(f)).map(x => '- ' + x[1]);
  return '## THE FEELING TO ACHIEVE (your main goal)\n' + f + '\n' + (craft.length ? craft.join('\n') : '- Work out what creates this feeling for this player and build every reply around it.') +
    '\n- Every reply should leave the player feeling more of this. Read how they respond; if the feeling is landing, keep doing what works.';
}
function clockLine(a) {   // the time briefing for this reply
  if (a.left == null) return '';
  if (timed(a)) return 'TIME: about ' + Math.max(1, Math.round(secsLeft(a) / 60)) + ' of ' + a.minutes + ' minutes left (roughly ' + a.left + ' more player repl' + (a.left === 1 ? 'y' : 'ies') + ' after this one).';
  return 'TURNS: ' + a.left + ' more player turn' + (a.left === 1 ? '' : 's') + ' after this one.';
}

// ---------------- Engine ----------------
const extractRules = a => isSim(a) ? EXTRACT_BASE.replace('BEATS', EXTRACT_GOAL) : EXTRACT_BASE.replace('BEATS', EXTRACT_BEATS) + EXTRACT_BEAT_RULE;

function mapText(a) {
  // Only what the GM needs: every active beat, up to 8 upcoming, and the 3 most recently completed (the saved file keeps them all).
  const act = a.beats.filter(b => b.status === 'active'), up = a.beats.filter(b => b.status === 'upcoming').slice(0, 8), done = a.beats.filter(b => b.status === 'done').slice(-3);
  let s = 'Current location: ' + (a.location || 'unknown') + '\n';
  if (isSim(a)) s += "Player's goal: " + (goalOf(a) || '(open)') + '\nProgress so far: ' + (a.goalProgress || '(just arrived)') + '\n';
  else { s += 'Beats:\n'; [...done, ...act, ...up].forEach(b => s += '- [' + b.status + '] ' + b.beat + '\n'); }
  s += 'Recent events:\n'; a.events.slice(-15).forEach(e => s += '- ' + e + '\n');
  return s;
}
const loreLine = e => 'LORE ' + e.name + ' (' + e.type + '): ' + e.desc;

function addPlace(a, name) {
  name = String(name || '').trim(); if (!name) return null;
  const k = name.toLowerCase(); if (!a.places[k]) a.places[k] = { name, visits: 0 }; return k;
}
function addEdge(a, x, y) {
  const p = addPlace(a, x), q = addPlace(a, y); if (!p || !q || p === q) return;
  const e = [p, q].sort().join('|'); if (!a.edges.includes(e)) a.edges.push(e);
}

let memoryJob = Promise.resolve(), slowJob = Promise.resolve();   // extraction (fast, awaited next turn) / bible, GM notes, summaries (slow, background)
let holoStage = '';
async function takeTurn(input, hidden, onDelta) {
  holoStage = 'finishing memory update';
  await Promise.race([memoryJob, new Promise(res => setTimeout(res, 2000))]);   // never let the memory update hold up the story for long
  const a = A(), tr = a.transcript;
  // The verbatim window moves in steps of two exchanges instead of every turn, so the conversation part of the prompt repeats exactly
  // from one turn to the next and Google can bill it as cached input.
  const over = Math.max(0, tr.length - RECENT_N()), recentStart = over - (over % 4);
  const snap = snapshot(a);
  clockTick(a, hidden);   // time played so far, and how many replies are likely to fit in what is left
  // Hand edits to the bible since the GM last saw it become PLAYER CHANGES (a line diff, so the model knows exactly what changed).
  if (a.bibleSeen == null) { if (a.bibleEdited) noteChange(a, 'Story bible: the player edited the bible by hand; treat it as authoritative.'); }
  else if (a.bible !== a.bibleSeen) lineDiff(a.bibleSeen, a.bible).slice(0, 8).forEach(l => noteChange(a, 'Story bible now says: ' + l.slice(0, 300)));
  const bibleNow = a.bible;
  holoStage = 'recalling memories';
  const pinned = pinnedLore(a), pinnedLines = pinned.map(loreLine);
  const memList = (await retrieve(a, input, recentStart)).filter(x => !pinnedLines.includes(x));   // pinned entries are already in the prompt
  holoStage = 'waiting for the story model';
  const mem = memList.map(x => '- ' + x).join('\n') || '(none)';
  const changes = liveChanges(a);
  const chapters = (a.chunks || []).slice(-tune('chapters')).map(c => '- Turns ' + c.from + '-' + c.to + ': ' + c.text).join('\n') || '(none yet)';
  // Prompt order is deliberate, for Google's prompt cache: everything that rarely changes (rules, bible, chapters, GM notes) is the system
  // message, then the conversation; only the last message changes every turn. It carries this turn's private briefing (map, recalled
  // memories, director notes, hand changes) followed by the player's action, and is not stored, so earlier turns stay byte-for-byte identical.
  const me = Object.values(a.lore).find(e => e.isPlayer);
  const system = GM_RULES + (isShort(a) ? '\n' + shortRules(a) : '') + '\n\n' + castRules(a.minutes) + (me && me.name !== 'You' ? '\n\nTHE PLAYER CHARACTER is ' + me.name + ', and that is "you": narrate everything they do and feel as "you"; the name ' + me.name + ' appears only in other characters\' dialogue.' : '') + '\n\n' + feelingRules(a) + '\n\n' + modeRules(a) + (a.age ? '\n\n' + ageRules(a) : '') + '\n\n## STORY BIBLE\n' + a.bible +
    (a.photo && a.photo.canvas ? "\n\n## THE WORLD AS PAINTED FROM THE PLAYER'S PHOTO (keep it faithful)\n" + a.photo.canvas : '') +
    (pinned.length ? '\n\n## PLAYER-SET FACTS (written by the player; they override earlier narration, lore and notes)\n' + pinnedLines.map(x => '- ' + x).join('\n') : '') +
    '\n\n## STORY SO FAR (chapter summaries)\n' + chapters + '\n\n## PRIVATE GM NOTES (never reveal outright)\n' + gmText(a) +
    '\n\n## HOW EACH TURN ARRIVES\nThe latest message starts with a private GAME MASTER BRIEFING for this reply only (mission map, recalled memories, director notes, player changes), then the player\'s action. Follow the briefing, never mention or quote it, and reply to the action.';
  const briefing = '[GAME MASTER BRIEFING: private, for this reply only]\n## MISSION MAP\n' + mapText(a) + '\n## RELEVANT MEMORIES\n' + mem + '\n\n## DIRECTOR NOTES FOR THIS REPLY\n' + directorNotes(a) +
    (changes.length ? '\n\n## PLAYER CHANGES (made by hand; they win over anything said earlier in this conversation. Apply them from this reply on as if they had always been true, e.g. new pronouns or descriptions, and do not comment on the change)\n' + changes.map(c => '- ' + c.text).join('\n') : '') +
    '\n[END OF BRIEFING]\n\n' + (hidden ? 'INSTRUCTION: ' : 'THE PLAYER: ') + input;
  const messages = [{ role: 'system', content: system }];
  tr.slice(recentStart).forEach(t => messages.push({ role: t.role === 'player' ? 'user' : 'assistant', content: t.text }));
  messages.push({ role: 'user', content: briefing });
  const reply = onDelta ? await chatStream(messages, onDelta) : await chat('gm', messages);
  const name = db.current; a.undo = snap; a.bibleEdited = false; a.bibleSeen = bibleNow;
  if (!hidden) tr.push({ n: tr.length + 1, role: 'player', text: input });
  tr.push({ n: tr.length + 1, role: 'gm', text: reply });
  if (!hidden && a.left === 0) a.ended = true;   // that was the final reply: the report card comes next
  persist(name);
  memoryJob = (async () => {
    try {
      // Lore entries named in this exchange are sent along, so the memory call can update them (living lore) without another request.
      const said = (input + ' ' + reply).toLowerCase(), known = Object.values(a.lore).filter(e => [e.name, ...(e.aliases || [])].filter(Boolean).some(n => said.includes(n.toLowerCase()))).slice(0, 12);
      const ex = await chat('extract', [{ role: 'system', content: extractRules(a) },
        { role: 'user', content: (changes.length ? 'PLAYER CHANGES (authoritative; update any affected entries to match them):\n' + changes.map(c => '- ' + c.text).join('\n') + '\n' : '') + 'FEELING TO ACHIEVE: ' + feelingOf(a) + '\nKnown location: ' + a.location +
          (isSim(a) ? "\nPlayer's goal: " + (goalOf(a) || '(open)') : '\nCurrent beats:\n' + (a.beats.filter(b => b.status !== 'done').slice(-12).map(b => '- [' + b.status + '] ' + b.beat).join('\n') || '(none)')) +
          '\nKNOWN LORE (entries named in this exchange):\n' + (known.map(loreLine).join('\n') || '(none)') + '\nPLAYER: ' + input + '\nGAME MASTER: ' + reply }]);
      applyExtraction(a, ex);
    } catch (e) { console.warn('memory extraction skipped', e); }
    persist(name);
    if (db.current === name) { renderMap(); if (!loreEditing) renderLore(); }
  })();
  // Slow housekeeping (bible refresh, GM notes, chapter summaries) runs in the background and never blocks the next turn.
  slowJob = memoryJob.then(async () => {
    if (!hidden && tr.filter(t => t.role === 'player').length % BIBLE_EVERY === 0) { try { await refreshBible(a); } catch (e) { console.warn(e); } }
    // GM notes are also revised after a hand edit, so the cast agendas stop describing the old version (e.g. old pronouns).
    try { if (!a.gm) await makeGmNotes(a); else if (a.notesStale || (!hidden && tr.filter(t => t.role === 'player').length % BIBLE_EVERY === 0)) { await makeGmNotes(a, true); a.notesStale = false; } } catch (e) { console.warn('GM notes skipped', e); }
    try { await summarizeChunks(a); } catch (e) { console.warn(e); }
    persist(name);
    if (db.current === name) { renderMap(); if (!loreEditing) renderLore(); syncBibleBox(); }
  });
  return reply;
}
function applyExtraction(a, raw) {
  const i = raw.indexOf('{'), j = raw.lastIndexOf('}'); if (i < 0 || j < i) return;
  const o = JSON.parse(raw.slice(i, j + 1)), n = a.transcript.length;
  (o.lore || []).forEach(e => {
    const name = String(e.name || '').trim(); if (!name) return;
    const k = name.toLowerCase(), cur = a.lore[k] || (a.lore[k] = { name, type: 'other', desc: '', aliases: [] });
    if (!cur.byPlayer) {   // never overwrite an entry the player wrote by hand
      if (e.type) cur.type = e.type;
      const d = String(e.desc || '').trim();
      if (d && d !== cur.desc) { if (cur.desc) { cur.history = (cur.history || []).concat({ t: n, desc: cur.desc }).slice(-4); cur.changedAt = n; } cur.desc = d; }   // living lore: keep the last few versions
    }
    cur.aliases = [...new Set([...(cur.aliases || []), ...(e.aliases || [])])]; cur.lastSeen = n;
    if (cur.type === 'place') addPlace(a, name);
  });
  (o.events || []).forEach(ev => a.events.push('T' + n + ': ' + ev));
  const prev = a.location;
  if (o.location && String(o.location).trim()) {
    a.location = String(o.location).trim(); const k = addPlace(a, a.location); a.places[k].visits++;
    if (prev && prev.toLowerCase() !== a.location.toLowerCase()) addEdge(a, prev, a.location);
  }
  (o.links || []).forEach(l => { if (Array.isArray(l) && l.length === 2) addEdge(a, l[0], l[1]); });
  if (!isSim(a)) (o.beats || []).forEach(nb => {
    if (!nb || !nb.beat) return;
    const ex = a.beats.find(b => b.beat.toLowerCase() === String(nb.beat).toLowerCase());
    if (ex) ex.status = nb.status; else a.beats.push({ beat: nb.beat, status: nb.status });
  });
  if (o.goal_progress) a.goalProgress = String(o.goal_progress).trim();
  if (o.mood && typeof o.mood === 'object') {
    const f = Math.max(0, Math.min(10, Math.round(+o.mood.feeling || 0)));
    a.mood = { feeling: f, hooked_on: String(o.mood.hooked_on || '').trim(), meandering: !!o.mood.meandering, leaving_plot: !!o.mood.leaving_plot, t: n };
    a.moodLog = (a.moodLog || []).concat(f).slice(-200);
  }
}
async function refreshBible(a) {
  const recent = a.transcript.slice(-BIBLE_EVERY * 2).map(t => t.role + ': ' + t.text).join('\n');
  const wi = wishAt(a.bible), wishes = wi >= 0 ? a.bible.slice(wi).trim() : wishesSection(a), before = a.bible;   // keep the wishes block exactly as it is now (it may have been hand-edited)
  const nb = await chat('bible', [
    { role: 'system', content: 'Rewrite the story bible for a text adventure as a tight one-pager (max 450 words, markdown), addressing the player character as "you" (name them once, never narrate them in the third person): premise, tone, player character, cast, setting, current situation, goals, and a "story so far" summary. Keep everything still relevant; compress old material. Do NOT include a "Player\'s Wishes" section; it is added separately. Keep any details the player wrote by hand, even if unusual. Output only the bible.' },
    { role: 'user', content: 'CURRENT BIBLE:\n' + stripWishes(a.bible) + '\n\n' + playerFactsText(a) + 'MISSION MAP:\n' + mapText(a) + '\nRECENT TRANSCRIPT:\n' + recent }]);
  if (nb && nb.trim() && a.bible === before) { a.bible = stripWishes(nb.trim()) + '\n\n' + wishes; if (a.bibleSeen === before) a.bibleSeen = a.bible; }   // skip if you edited the bible while this refresh was running
}
// ---------------- Player edits: hand changes to the bible or lore override earlier narration ----------------
// Bible edits are diffed against the version the GM last saw; lore saves are recorded directly and the entry is pinned (the AI no longer
// rewrites it). Each change stays in the prompt as a PLAYER CHANGE until the old narration has left the verbatim transcript window.
const lineDiff = (o, n) => { const old = new Set(String(o || '').split('\n').map(s => s.trim())); return String(n || '').split('\n').map(s => s.trim()).filter(s => s && !old.has(s)); };
function noteChange(a, text) { a.changes = (a.changes || []).filter(c => c.text !== text).concat({ text, turn: playerTurns(a) }).slice(-12); a.notesStale = true; }
const liveChanges = a => (a.changes || []).filter(c => playerTurns(a) - c.turn <= Math.ceil(RECENT_N() / 2) + 1);
const pinnedLore = a => Object.values(a.lore).filter(e => e.byPlayer).sort((x, y) => (y.editedAt || 0) - (x.editedAt || 0)).slice(0, 15);
function playerFactsText(a) {   // for background calls (bible refresh, GM notes): what the player set by hand, which beats the transcript
  const p = pinnedLore(a), c = liveChanges(a);
  return p.length || c.length ? 'PLAYER-SET FACTS (written by the player; keep them exactly, even where the transcript says otherwise):\n' + [...c.map(x => x.text), ...p.map(loreLine)].map(x => '- ' + x).join('\n') + '\n\n' : '';
}
// The Player's Wishes block closes the bible. (The Spanish heading from a previous version is still recognised.)
const WISH_HEAD = "## Player's Wishes (from the Experience Curator)", WISH_HEADS = [WISH_HEAD, '## Deseos del jugador (del Curador de Experiencias)'];
function wishAt(b) { const xs = WISH_HEADS.map(h => b.indexOf(h)).filter(i => i >= 0); return xs.length ? Math.min(...xs) : -1; }
function stripWishes(b) { const i = wishAt(b); return (i >= 0 ? b.slice(0, i) : b).trim(); }
function wishesSection(a) {
  const c = (a.curator || []).filter(x => !['feeling', 'goal', 'time', 'mode', 'depth', 'pick'].includes(x.id));
  return WISH_HEAD + '\n' + (a.feeling ? FEEL_LINE + ' ' + a.feeling + '\n' : '') + (a.mode ? '**Play mode:** ' + (isSim(a) ? 'Experience simulator (no plot points; focus on the feeling and the player\'s goal)' : 'Curated story (a hidden roadmap that bends to the player)') + '\n' : '') +
    (a.goal ? GOAL_LINE + ' ' + a.goal + '\n' : '') + (a.minutes ? '**Session length:** ' + a.minutes + ' minutes\n' : '') + (c.length ? c.map(x => '- **' + x.q + '** ' + x.a).join('\n') : '(none recorded)');
}

// ---------------- Embeddings + hybrid recall ----------------
let embedOff = false;                                   // set for the session if the endpoint rejects embeddings
const embedModel = () => guest() ? GEMINI.embed : S().embed !== undefined ? S().embed : GEMINI.embed;
const embOn = () => !embedOff && !S().noEmbed && (!!S().fake || !!embedModel());
function hstr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function quant(v) { const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1; return v.map(x => Math.round(x / n * 127)); }   // int8-ish, keeps storage small
function fakeEmb(t) { const v = new Array(64).fill(0); tok(t).forEach(w => v[Math.abs(hstr(w)) % 64]++); return quant(v); }
async function embed(texts) {
  if (S().fake) return texts.map(fakeEmb);
  if (!hasKey()) throw new Error('no API key');
  const model = embedModel(); if (!model) throw new Error('no embedding model');
  const r = await netFetch(apiUrl('embed'), { method: 'POST', headers: headers(), body: JSON.stringify({ model, input: texts }) });
  if (!r.ok) throw new Error('embeddings HTTP ' + r.status);
  return (await r.json()).data.map(d => quant(d.embedding.slice(0, 256)));   // truncate long vectors (e.g. Gemini's 3072 dims) to keep storage small
}
function cosine(a, b) { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / (Math.sqrt(x * y) || 1); }

async function retrieve(a, input, recentStart) {
  const low = input.toLowerCase(), hits = [];
  Object.values(a.lore).forEach(e => { if ([e.name, ...(e.aliases || [])].filter(Boolean).some(n => low.includes(n.toLowerCase()))) hits.push(loreLine(e)); });
  const docs = [];
  Object.entries(a.lore).forEach(([k, e]) => docs.push({ id: 'L:' + k, text: loreLine(e), t: tok(e.name + ' ' + (e.aliases || []).join(' ') + ' ' + e.desc) }));
  a.transcript.slice(0, recentStart).forEach(t => docs.push({ id: 'T:' + t.n, text: 'T' + t.n + ' ' + t.role + ': ' + t.text, t: tok(t.text) }));
  const inPrompt = new Set((a.chunks || []).slice(-tune('chapters')).map(c => c.from));   // chapters already in the prompt are not recalled again (that would pay for them twice)
  (a.chunks || []).forEach(c => { if (!inPrompt.has(c.from)) docs.push({ id: 'C:' + c.from, text: 'CHAPTER (turns ' + c.from + '-' + c.to + '): ' + c.text, t: tok(c.text) }); });   // older summaries stay searchable after they leave the prompt
  const lastGm = [...a.transcript].reverse().find(t => t.role === 'gm');
  const query = input + (lastGm ? ' ' + lastGm.text.slice(-300) : '');   // short replies like "yes" or "open it" still need context to find the right memories
  const lex = bm25(docs, query, 12);
  let sem = [];
  if (embOn() && docs.length) {
    try {
      const model = S().fake ? 'fake' : embedModel();
      const sig = d => model + ':' + hstr(d.text);
      const need = docs.filter(d => !a.emb[d.id] || a.emb[d.id].s !== sig(d)).slice(0, 96);
      if (need.length) embed(need.map(d => d.text.slice(0, 2000))).then(vs => { need.forEach((d, i) => a.emb[d.id] = { s: sig(d), v: vs[i] }); persist(); })
        .catch(e => { console.warn('embedding backfill failed:', e.message); embedOff = true; });   // background: never delay the reply
      const [qv] = await Promise.race([embed([query.slice(0, 2000)]), new Promise(res => setTimeout(() => res([null]), 1000))]);   // skip semantic recall if slow
      if (qv) sem = docs.filter(d => a.emb[d.id] && a.emb[d.id].v.length === qv.length)
        .map(d => ({ d, s: cosine(qv, a.emb[d.id].v) })).filter(x => x.s > 0.2).sort((x, y) => y.s - x.s).slice(0, 12).map(x => x.d);
    } catch (e) { console.warn('embeddings disabled for this session:', e.message); embedOff = true; }
  }
  const score = new Map();   // reciprocal rank fusion of keyword + semantic rankings
  [lex, sem].forEach(list => list.forEach((d, i) => score.set(d, (score.get(d) || 0) + 1 / (60 + i))));
  const qt = new Set(tok(query));
  const top = [...score.entries()].sort((x, y) => y[1] - x[1]).slice(0, tune('recall')).map(x => brief(x[0], qt)).filter(x => !hits.includes(x));
  const out = []; let room = RECALL_CHARS;   // keep the recalled block small (about 650 tokens); named lore comes first
  for (const x of [...hits, ...top]) { if (out.length && x.length > room) break; out.push(x); room -= x.length; }
  return out;
}
const RECALL_CHARS = 2600;
// An old turn is recalled as its most relevant sentence or two (with the next one for context), not the whole reply: whole replies used to be
// the biggest single part of each prompt. Lore lines and chapter summaries are already short and are recalled whole.
function brief(d, qt) {
  if (!d.id.startsWith('T:')) return d.text;
  const i = d.text.indexOf(': '), head = d.text.slice(0, i + 1), sents = d.text.slice(i + 2).split(/(?<=[.!?…])\s+/);
  if (sents.join(' ').split(/\s+/).length <= 60) return d.text;
  const hit = s => tok(s).filter(w => qt.has(w)).length;
  let b = 0; sents.forEach((s, k) => { if (hit(s) > hit(sents[b])) b = k; });
  const pick = [sents[b]]; if (sents[b + 1] && (sents[b] + sents[b + 1]).split(/\s+/).length <= 70) pick.push(sents[b + 1]);
  return head + ' ...' + pick.join(' ') + '...';
}

// ---------------- Showrunner + Director: the hidden layer that keeps the story alive ----------------
function gmText(a) {
  const g = a.gm; if (!g) return '(none yet: quietly plan a satisfying hidden mystery and seed it)';
  return 'Narrative voice: ' + (g.voice || '') + '\nSecrets (not yet known to the player):\n' + (g.secrets || []).map(s => '- ' + s).join('\n') +
    '\nWorld threads:\n' + (g.threads || []).map(t => '- [' + (t.status || 'seeded') + '] ' + t.thread).join('\n') + '\nCast agendas (each person acts on these, on-screen or off):\n' + (g.cast || []).map(c => '- ' + c.name + ': wants ' + c.wants + '; fears ' + c.fears + '; secret: ' + c.secret + '; next move: ' + c.next_move).join('\n') + '\nBig reveal to build toward: ' + (g.big_reveal || '(open)');
}
function parseJson(raw) { const i = raw.indexOf('{'), j = raw.lastIndexOf('}'); if (i < 0 || j < i) throw new Error('no JSON'); return JSON.parse(raw.slice(i, j + 1)); }
async function makeGmNotes(a, revise) {
  const recentLore = Object.values(a.lore).sort((x, y) => (y.lastSeen || 0) - (x.lastSeen || 0)).slice(0, 30);   // only the 30 most recently seen entries, so this call does not grow with the lorebook
  const ctx = 'BIBLE:\n' + stripWishes(a.bible) + '\n\n' + playerFactsText(a) + 'LORE:\n' + recentLore.map(loreLine).join('\n') + '\n\n' + mapText(a) +
    '\nRECENT TURNS:\n' + a.transcript.slice(-6).map(t => t.role + ': ' + t.text).join('\n');
  const raw = await chat('plan', [{ role: 'system', content: PLAN_RULES + (revise ? '\nYou are UPDATING existing notes: drop secrets the player has now discovered, add fresh ones, update thread statuses, and pick a new big_reveal only if the old one has happened. If PLAYER-SET FACTS are given, rewrite every note to agree with them (names, pronouns, roles).' : '') +
    (isShort(a) ? '\nThis is a SHORT story: keep the notes small and simple (2-3 secrets, 1-2 threads) so the story stays easy to follow.' : '') +
    '\nThe cast has at most ' + namedCap(a.minutes) + ' named characters besides the player, plus one named antagonist if there is one; do not add new named people.' +
    (isSim(a) ? '\nThis is an EXPERIENCE SIMULATOR with no plot: secrets are small delights to discover, threads are gentle background life, big_reveal is a lovely surprise rather than a twist, and the cast have modest, warm wants that make the place feel alive.' : '') +
    '\nEverything should serve the FEELING TO ACHIEVE: ' + feelingOf(a) + '.' },
    { role: 'user', content: (revise ? 'CURRENT NOTES:\n' + gmText(a) + '\n\n' : '') + ctx }]);
  const g = parseJson(raw);
  if (g && (g.voice || g.secrets)) a.gm = { voice: g.voice || '', secrets: g.secrets || [], threads: g.threads || [], big_reveal: g.big_reveal || '', cast: g.cast || [] };
}
function humourFor(f) {   // { p: chance a reply is asked for humour, kinds: which kinds }
  if (/connect|love|romanc/i.test(f)) return { p: 0.3, kinds: GENTLE_HUMOR };
  if (/awe|wonder/i.test(f)) return { p: 0.25, kinds: GENTLE_HUMOR };
  if (/relax|nostalg/i.test(f)) return { p: 0.4, kinds: GENTLE_HUMOR };
  if (/indulg|luxur|pamper/i.test(f)) return { p: 0.5, kinds: GENTLE_HUMOR.concat(HUMOR.slice(4)) };
  if (/exhilar|adventur|thrill|fun|mischie|funny|comed/i.test(f)) return { p: 0.8, kinds: HUMOR };
  return { p: 0.6, kinds: HUMOR };
}
const DISRUPT = ['complication', 'clock', 'world', 'seed', 'choice', 'npc'];   // the moves that pull the player back toward plot; benched while the feeling is landing
function directorNotes(a) {
  const turn = playerTurns(a) + 1, short = isShort(a), sim = isSim(a), left = a.left, final = left === 0, wrap = left != null && left <= 3;
  const m = a.mood || {}, happy = m.feeling >= 7 || !!m.hooked_on, roaming = !sim && (m.meandering || m.leaving_plot), calm = sim || happy || roaming;
  // Pacing: a calm phase ("savour") while the player is happy, roaming or in the simulator. Otherwise timed stories follow the clock
  // (rising for the first half, a peak, then release); older turn-based stories keep their 10-turn cycle.
  let phase;
  if (calm) phase = 'savour';
  else if (timed(a)) { const f = playedSecs(a) / (a.minutes * 60); phase = f < 0.5 ? 'rising' : f < 0.85 ? 'peak' : 'release'; }
  else { const k = turn % 10; phase = short ? (turn / a.length <= 0.5 ? 'rising' : turn < a.length ? 'peak' : 'release') : k >= 1 && k <= 6 ? 'rising' : (k === 7 || k === 8) ? 'peak' : 'release'; }
  const weights = { rising: { seed: 2, npc: 2, world: 2, sensory: 1.5, banter: 2, texture: 2, clock: 1.5, payoff: 1.5 }, peak: { complication: 3, choice: 2, wonder: 1, clock: 2.5, payoff: 2.5, banter: 1.5 },
    release: { quiet: 2, heart: 2, wonder: 1.5, sensory: 1, banter: 2.5, texture: 1.5, payoff: 2 }, savour: { sensory: 2.5, wonder: 2, heart: 2.5, quiet: 2, texture: 1.5, banter: 1.5, payoff: 1.5 } }[phase];
  a.dir = a.dir || {};
  const pool = Object.keys(DIRECTOR).filter(k => (!short || SHORT_NUDGES.includes(k)) && !((calm || wrap) && DISRUPT.includes(k)) && turn - (a.dir[k] || -99) >= 3).map(k => [k, weights[k] || 1]);
  const picked = [];
  for (let n = 0; n < (short || final ? 1 : 2) && pool.length; n++) {
    let r = Math.random() * pool.reduce((s, p) => s + p[1], 0), i = 0;
    while (i < pool.length - 1 && (r -= pool[i][1]) > 0) i++;
    picked.push(pool[i][0]); a.dir[pool[i][0]] = turn; pool.splice(i, 1);
  }
  const f = feelingOf(a), lines = ['FEELING TO ACHIEVE: ' + f + '. Make this reply deliver it.' + (m.feeling != null && m.t ? ' Last reading: ' + m.feeling + '/10' + (m.feeling < 5 ? ', so lean into it harder and drop whatever is getting in the way.' : '.') : '')];
  if (happy) lines.push('KEEP A GOOD THING GOING: the player is enjoying this' + (m.hooked_on ? ' (' + m.hooked_on + ')' : '') + '. Scrub plot points for now: no new complications, no interruptions, no other characters barging in, nothing following them. Deepen what is working.');
  if (roaming) lines.push((m.leaving_plot ? 'The player is leaving the plot behind. Let it go: it does not chase them, follow them or catch up with them. ' : 'The player is happily meandering. ') + 'Make wherever they are now worth being in; the plot can wait (or stay behind for good).');
  lines.push('PACING: ' + { rising: 'momentum is building; keep things moving and curious.', peak: 'this is a high-intensity beat; make it count and force a decisive moment.', release: 'aftermath and breathing room; let consequences land, then open a fresh hook.', savour: 'stay in the moment and let it breathe; no new problems, just more of what the player came for.' }[phase]);
  picked.forEach(k => lines.push(DIRECTOR[k]));
  const old = Object.values(a.lore).filter(e => turn - (e.lastSeen ? Math.ceil(e.lastSeen / 2) : 0) > 8);
  if (!short && !calm && old.length && Math.random() < 0.3) { const e = old[Math.floor(Math.random() * old.length)]; lines.push('Callback: bring back "' + e.name + '" (' + (e.desc || e.type) + ') in a natural, meaningful way.'); }
  if (!sim && !calm && a.playCats && a.playCats.length && Math.random() < (short ? 0.4 : 0.6)) lines.push('Gameplay focus for this reply: ' + a.playCats[Math.floor(Math.random() * a.playCats.length)] + '. Shape the main challenge or interaction around it, organically and without naming the category.');
  if (sim) lines.push("PLAYER'S GOAL: " + (goalOf(a) || '(open: follow their lead)') + '. Help them toward it in this reply, at their pace.');
  else if (a.roadmap && a.roadmap.length) {
    const at = timed(a) ? playedSecs(a) / 60 : turn, act = a.roadmap.find(r => at >= r.from && at <= r.to) || a.roadmap.find(r => at < r.to) || a.roadmap[a.roadmap.length - 1];
    lines.push(wrap && calm ? 'ENDING GOAL (bend it to wherever the player is now; never drag them back to the plot for it): ' + act.goal : calm ? 'SECRET ROADMAP (on hold while the player is ' + (happy ? 'happy where they are' : 'off the plot') + '; offer it again only if they reach for it): ' + act.goal
      : 'SECRET ROADMAP' + (timed(a) ? ' (minute ' + Math.round(at) + ' of ' + a.minutes + ')' : ' (player turn ' + turn + ' of ' + a.length + ')') + ': steer toward this act goal without railroading or revealing it: ' + act.goal);
  }
  const cl = clockLine(a); if (cl) lines.push(cl);
  if (final) lines.push('THIS IS THE FINAL REPLY. Bring the ' + (sim ? 'experience' : 'story') + ' to a definitive, storybook ending that lands the feeling (' + f + ')' + (sim ? ' and lets the player savour what they did' : ', paying off the threads the player actually cared about') + (roaming || happy ? '. The player has been off the plot or happy where they are: end THEIR story, not the roadmap\'s' : '') + '. Do not ask what they do next and do not offer a new hook; end on a closing image.');
  else if (left === 1) lines.push('One reply left after this: start bringing it home. Set up a satisfying payoff for where the player actually is and what they care about.');
  else if (wrap) lines.push('WRAP-UP: the session is nearly over. Start steering toward a payoff and a storybook ending, focused on the feeling. No new threads. If the player wants to meander, let the ending come to them rather than killing the moment with plot.');
  if (!final) { const ends = calm ? ENDINGS.filter(e => !/interruption|reveal|hook/i.test(e)) : ENDINGS; lines.push(ends[Math.floor(Math.random() * ends.length)]); }
  // Humour follows the feeling: how often it is asked for, and which kinds, depend on what the player wants to feel.
  const hum = humourFor(f);
  if (!final && Math.random() < hum.p * (happy ? 0.6 : 1)) lines.push('Humour this reply: ' + hum.kinds[Math.floor(Math.random() * hum.kinds.length)] + '. Land it in the specifics of this scene and keep it ' + (hum.p < 0.5 ? 'light and warm' : 'sharp') + '; it must serve the feeling, never derail the scene.');
  else lines.push('No jokes needed this reply unless one arises naturally from a character; let the feeling carry it.');
  const cast = (a.gm && a.gm.cast) || [];
  if (!short && !calm && !wrap && cast.length && Math.random() < 0.75) { const c = cast[Math.floor(Math.random() * cast.length)]; lines.push('Motive in action: ' + c.name + ' wants ' + c.wants + ' and fears ' + c.fears + '. Show them pursuing it visibly in this reply (a choice, a lie, a favour, a closed door), even where it cuts against what the player wants.'); }
  const rep = repetitionNote(a); if (rep) lines.push(rep);
  return lines.map(l => '- ' + l).join('\n');
}
function repetitionNote(a) {
  const gm = a.transcript.filter(t => t.role === 'gm').slice(-6).map(t => t.text);
  if (gm.length < 2) return '';
  const counts = {};
  gm.forEach(txt => {
    const w = txt.toLowerCase().replace(/[^\p{L}' ]/gu, ' ').split(/\s+/).filter(Boolean), seen = new Set();
    for (let i = 0; i < w.length - 2; i++) { const g = w.slice(i, i + 3).join(' '); if (!seen.has(g)) { seen.add(g); counts[g] = (counts[g] || 0) + 1; } }
  });
  const rep = Object.entries(counts).filter(([g, c]) => c >= 3 && !/^(the|and|of|to|a|in|you|your) /.test(g)).sort((x, y) => y[1] - x[1]).slice(0, 8).map(x => '"' + x[0] + '"');
  const qs = gm.slice(-3).filter(t => /\?["'”)*\s]*$/.test(t.trim())).length;
  const starts = gm.slice(-3).map(t => t.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase());
  let n = '';
  if (rep.length) n += 'You have overused these phrases lately; avoid them: ' + rep.join(', ') + '. ';
  if (qs >= 2) n += 'Your last replies ended with questions: do NOT end with a question this time. ';
  if (new Set(starts).size < starts.length) n += 'Open this reply differently from the last ones. ';
  return n.trim();
}

// ---------------- Chapter summaries ----------------
const CHUNK = 10;   // transcript entries per chapter summary (smaller chunks = fewer un-summarised turns falling between chapters and the recent window)
async function summarizeChunks(a) {
  while (a.transcript.length - RECENT_N() - a.summarizedUpTo >= CHUNK) {
    const from = a.summarizedUpTo, seg = a.transcript.slice(from, from + CHUNK);
    const text = await chat('bible', [
      { role: 'system', content: 'Summarize this excerpt of a text adventure in under 70 words, past tense, keeping names, decisions, discoveries and consequences. Output only the summary.' },
      { role: 'user', content: seg.map(t => t.role + ': ' + t.text).join('\n') }]);
    a.chunks.push({ from: seg[0].n, to: seg[seg.length - 1].n, text: String(text).trim() });
    a.summarizedUpTo = from + CHUNK;
  }
}

// ---------------- Undo last turn (restores memory too) ----------------
const MEM_KEYS = ['bible', 'location', 'beats', 'events', 'lore', 'places', 'edges', 'chunks', 'summarizedUpTo', 'gm', 'dir', 'changes', 'bibleSeen', 'elapsed', 'turnTimes', 'left', 'ended', 'mood', 'moodLog', 'goalProgress'];
function snapshot(a) { const mem = {}; MEM_KEYS.forEach(k => mem[k] = structuredClone(a[k])); return { mem, tlen: a.transcript.length }; }
async function undoLast() {
  await memoryJob; await slowJob;
  const a = A(); if (busy) return;
  if (!a || !a.undo) { alert('Nothing to undo.'); return; }
  const undone = a.transcript.slice(a.undo.tlen), pl = undone.find(t => t.role === 'player');
  a.transcript.length = a.undo.tlen;
  MEM_KEYS.forEach(k => a[k] = a.undo.mem[k]);
  a.undo = null; a.result = null; a.finishing = false; if (timed(a)) a.lastSendAt = Date.now(); persist();
  if (pl) $('input').value = pl.text;
  refresh(); showTab('story');
}
$('undoBtn').onclick = undoLast;

// ---------------- Lore editor ----------------
let loreEditing = null;
function renderLore() {
  const a = A(), box = $('lore'); if (!a) { box.innerHTML = ''; return; }
  const form = (k, e) => '<div class="card lf"><input id="loreName" placeholder="Name" value="' + esc(e.name || '').replace(/"/g, '&quot;') + '">' +
    '<select id="loreType">' + ['person', 'place', 'item', 'faction', 'other'].map(t => '<option' + (t === (e.type || 'other') ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
    '<input id="loreAliases" placeholder="Aliases, comma separated" value="' + esc((e.aliases || []).join(', ')).replace(/"/g, '&quot;') + '">' +
    '<textarea id="loreDesc" rows="3" placeholder="Description">' + esc(e.desc || '') + '</textarea>' +
    '<button class="primary mini" data-act="save" data-k="' + esc(k) + '">Save</button><button class="mini" data-act="cancel">Cancel</button></div>';
  let html = '<button class="mini" data-act="add">+ Add entry</button> <span class="tag">' + Object.keys(a.lore).length + ' entries. Fix duplicates with Merge.</span><div style="margin-top:10px"></div>';
  if (loreEditing === '__new') html += form('__new', {});
  const rank = e => e.isPlayer ? 0 : ({ person: 1, place: 2, faction: 3, item: 4 }[e.type] || 5);
  html += Object.entries(a.lore).sort((x, y) => rank(x[1]) - rank(y[1]) || x[1].name.localeCompare(y[1].name)).map(([k, e]) => loreEditing === k ? form(k, e) :
    '<div class="card"><b>' + esc(e.name) + '</b> <span class="tag">' + (e.isPlayer ? 'main character (you) &middot; ' : '') + esc(e.type || '') + (e.aliases && e.aliases.length ? ' &middot; aka ' + esc(e.aliases.join(', ')) : '') + (e.byPlayer ? ' &middot; &#9998; your edit (the AI keeps it as written)' : '') + (e.changedAt && !e.byPlayer ? ' &middot; &#10227; updated in play (turn ' + Math.ceil(e.changedAt / 2) + ')' : '') + '</span><br>' + esc(e.desc || '') +
    (e.history && e.history.length && !e.byPlayer ? '<details class="tag"><summary>Earlier versions</summary>' + e.history.slice().reverse().map(h => '<div>Turn ' + Math.ceil(h.t / 2) + ': ' + esc(h.desc) + '</div>').join('') + '</details>' : '') +
    '<br><button class="mini" data-act="edit" data-k="' + esc(k) + '">Edit</button><button class="mini" data-act="merge" data-k="' + esc(k) + '">Merge into...</button><button class="mini" data-act="del" data-k="' + esc(k) + '">Delete</button></div>').join('');
  box.innerHTML = html;
}
function saveLore(k) {
  const a = A(), name = $('loreName').value.trim(); if (!name) { alert('Name is required.'); return; }
  const nk = name.toLowerCase(), old = k !== '__new' ? a.lore[k] : null;
  if (nk !== k && a.lore[nk] && !confirm('An entry named "' + a.lore[nk].name + '" exists. Overwrite it?')) return;
  if (old && nk !== k) delete a.lore[k];
  const type = $('loreType').value, desc = $('loreDesc').value.trim();
  const changed = !old || old.name !== name || old.type !== type || (old.desc || '') !== desc;
  a.lore[nk] = { name, type, desc, aliases: $('loreAliases').value.split(',').map(s => s.trim()).filter(Boolean), lastSeen: old ? old.lastSeen : a.transcript.length,
    byPlayer: changed || !!(old && old.byPlayer), editedAt: changed ? Date.now() : (old && old.editedAt), isPlayer: !!(old && old.isPlayer) };
  if (changed) noteChange(a, 'Lore ' + (old && old.name !== name ? '("' + old.name + '" is now "' + name + '") ' : '') + loreLine(a.lore[nk]).slice(5));
  if (a.undo) { a.undo.mem.lore = a.undo.mem.lore || {}; if (old && nk !== k) delete a.undo.mem.lore[k]; a.undo.mem.lore[nk] = structuredClone(a.lore[nk]); a.undo.mem.changes = structuredClone(a.changes); }   // so Undo never reverts a hand edit
  if (type === 'place') addPlace(a, name);
  loreEditing = null; persist(); renderMap(); renderLore();
}
function mergeLore(k) {
  const a = A(), src = a.lore[k], others = Object.values(a.lore).filter(e => e.name.toLowerCase() !== k);
  if (!others.length) { alert('No other entries to merge into.'); return; }
  const pick = prompt('Merge "' + src.name + '" INTO which entry? Type its exact name:\n\n' + others.map(e => '- ' + e.name).join('\n'));
  if (!pick) return;
  const tk = pick.trim().toLowerCase(), tgt = a.lore[tk]; if (!tgt || tk === k) { alert('No matching entry.'); return; }
  tgt.aliases = [...new Set([...(tgt.aliases || []), ...(src.aliases || []), src.name])].filter(x => x.toLowerCase() !== tk);
  if (src.desc && !(tgt.desc || '').includes(src.desc)) tgt.desc = ((tgt.desc || '') + ' ' + src.desc).trim();
  delete a.lore[k];
  const fix = x => x === k ? tk : x;
  a.edges = [...new Set(a.edges.map(e => e.split('|').map(fix).sort().join('|')).filter(e => { const [p, q] = e.split('|'); return p !== q; }))];
  if (a.places[k]) { addPlace(a, tgt.name); delete a.places[k]; }
  if ((a.location || '').toLowerCase() === k) a.location = tgt.name;
  persist(); renderMap(); renderLore();
}
$('lore').onclick = e => {
  const b = e.target.closest('button'); if (!b || !A()) return;
  const act = b.dataset.act, k = b.dataset.k, a = A();
  if (act === 'add') { loreEditing = '__new'; renderLore(); }
  else if (act === 'edit') { loreEditing = k; renderLore(); }
  else if (act === 'cancel') { loreEditing = null; renderLore(); }
  else if (act === 'save') saveLore(k);
  else if (act === 'merge') mergeLore(k);
  else if (act === 'del') { if (confirm('Delete "' + a.lore[k].name + '" from the world?')) { delete a.lore[k]; persist(); renderMap(); renderLore(); } }
};

// ---------------- Session recap ----------------
async function recap() {
  const a = A(), name = db.current; if (!a || !a.transcript.length) return;
  let text = 'Previously: ' + (a.events.slice(-3).map(e => e.replace(/^T\d+:\s*/, '')).join(' ') || 'the story is just beginning.') + (a.location ? ' You are at ' + a.location + '.' : '');
  if (S().fake || hasKey()) {
    try {
      text = await chat('bible', [
        { role: 'system', content: 'Write a 3-4 sentence "previously on your adventure" recap for a returning player of a text adventure. Second person, evocative, ending with where they are and the open situation. Output only the recap.' },
        { role: 'user', content: 'BIBLE:\n' + stripWishes(a.bible) + '\n\n' + mapText(a) + '\nLAST TURNS:\n' + a.transcript.slice(-4).map(t => t.role + ': ' + t.text).join('\n') }]);
    } catch (e) { console.warn('recap fell back to local summary', e); }
  }
  if (db.current === name && !busy) addMsg('recap', text);
}

