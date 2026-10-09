// Phonodeck: speech in and out: the Gemini narrator, the browser voice, voice tests, the thinking sound and hands-free listening.
// Plain scripts that share one global scope (no build step); index.html loads them in order: prompts, experiences, core, engine, voice, curator, ui.

// ---------------- Voice (speech in / speech out) ----------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const TTS = 'speechSynthesis' in window;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS reports itself as a Mac
// Edge's best storytelling voices, best first (names look like "Microsoft Ava Online (Natural) - English (United States)").
// Ana is a child's voice, so it is never picked automatically. A story whose narrator is male (Charon) prefers the male list.
const EDGE_FEMALE = ['AvaMultilingual', 'Ava', 'EmmaMultilingual', 'Emma', 'Jenny', 'Aria', 'Michelle', 'Sonia', 'Libby', 'Natasha'];
const EDGE_MALE = ['AndrewMultilingual', 'Andrew', 'BrianMultilingual', 'Brian', 'Guy', 'Christopher', 'Eric', 'Ryan', 'William'];
const MALE_NARRATORS = /^(Charon|Achird|Algenib|Algieba|Alnilam|Enceladus|Fenrir|Iapetus|Orus|Puck|Rasalgethi|Sadachbia|Sadaltager|Schedar|Umbriel|Zubenelgenubi)$/;
const SPEECH_LANG = /^en/i.test(navigator.language || '') ? navigator.language : 'en-US';   // for speech recognition
// On a computer, browser voices vary wildly, so they are scored (natural/online > Google > the rest; joke voices last) and the best wins.
// On iPhone/iPad the app does NOT pick a voice: Safari lists voices it cannot actually use (including downloaded Enhanced/Premium ones),
// and choosing one of those gives silence. Safari's own default voice for the language always works.
const JOKE_VOICE = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i;
function voiceScore(v) {
  if (!/^en/i.test(v.lang)) return -1;
  if (JOKE_VOICE.test(v.name) || /eloquence/i.test(v.voiceURI || '')) return 0;
  const id = v.name + ' ' + (v.voiceURI || ''); let s = 10;
  const who = (v.name.match(/^Microsoft (\w+) Online/) || [])[1];
  if (who === 'Ana') s -= 40;
  else if (who) {
    const male = MALE_NARRATORS.test((A() && A().ttsVoice) || S().ttsVoice || DEFAULT_TTS_VOICE), lists = male ? [EDGE_MALE, EDGE_FEMALE] : [EDGE_FEMALE, EDGE_MALE];
    lists.forEach((l, k) => { const i = l.indexOf(who); if (i >= 0) s += (k ? 60 : 100) - i * 2; });
  }
  if (/natural|online|neural/i.test(id)) s += 45; else if (/^Google /.test(v.name)) s += 30;
  if (/-US$/i.test(v.lang.replace('_', '-'))) s += 3;
  return s;
}
const rankedVoices = () => speechSynthesis.getVoices().filter(v => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
const goodVoice = v => !!v && voiceScore(v) >= 55;
let voiceSuspect = false;   // a voice stayed silent: use the browser's own default voice for the rest of the session
function browserVoice() {
  if (voiceSuspect) return null;
  const picked = S().voice && speechSynthesis.getVoices().find(v => v.name === S().voice);
  return picked || (IOS ? null : rankedVoices()[0] || null);
}
let rec = null, listening = false, handsActive = false, lastReply = null;

function chunkText(t) {   // Chrome cuts long utterances off, so speak sentence-sized pieces
  const s = String(t).replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/), out = [];
  let cur = '';
  s.forEach(x => { if ((cur + ' ' + x).length > 180 && cur) { out.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); });
  if (cur) out.push(cur);
  return out;
}
// ---------------- Gemini narrator voice: natural, audiobook-style speech via Google's TTS models ----------------
// Uses the same Google API key. Falls back to the browser voice if a request fails or the daily voice quota runs out.
const GEMINI_HOST = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_VOICES = ['Achernar','Achird','Algenib','Algieba','Alnilam','Aoede','Autonoe','Callirrhoe','Charon','Despina','Enceladus','Erinome','Fenrir','Gacrux','Iapetus','Kore','Laomedeia','Leda','Orus','Pulcherrima','Puck','Rasalgethi','Sadachbia','Sadaltager','Schedar','Sulafat','Umbriel','Vindemiatrix','Zephyr','Zubenelgenubi'];
const DEFAULT_TTS_VOICE = 'Sulafat';
let activeGemini = null, geminiWarned = false, geminiBlocked = false, ttsBackupNow = false;   // ttsBackupNow: the chosen voice model hit its daily quota, so use the other one until reload or Test voice
const useGemini = () => (S().ttsEngine || 'gemini') === 'gemini' && hasKey() && !S().fake && !geminiBlocked;   // geminiBlocked: quota hit (HTTP 429), so stay on the browser voice until reload or Test voice
function stopSpeech() { blockedPlay = null; talkUntil = 0; if (TTS) speechSynthesis.cancel(); if (activeGemini) { activeGemini.stop(); activeGemini = null; } }
// iPhone/iPad Safari only lets a page start sound from a tap. A fresh new Audio() per clip, played seconds later when the API answers,
// is refused. Instead, one shared <audio> element is unlocked by your first tap and reused for every clip, which Safari then allows.
// While hands-free is on, Safari already allows sound (the microphone is in use), so taps then leave the audio alone.
const player = new Audio(); player.setAttribute('playsinline', ''); player.preload = 'auto';
let audioUnlocked = false, blockedPlay = null, silentUrl = null, speechPrimed = false;
function unlockAudio(e) {
  ensureAudio();   // the AudioContext (ambient sound, blips) needs a tap too
  if (IOS && !fxUnlocked) { fxUnlocked = true; silentUrl = silentUrl || URL.createObjectURL(wavFromPcm(new Uint8Array(4800), 24000)); [ambEl, sfxEl].forEach(el => { if (el.paused) { el.src = silentUrl; el.play().catch(() => {}); } }); }   // so the thinking sound and beeps may play later
  if (blockedPlay) { const f = blockedPlay; blockedPlay = null; f(); return; }   // narration was refused: this tap plays it
  if (handsActive || (e && e.target && e.target.closest && e.target.closest('#micBtn'))) return;   // never disturb the microphone
  if (!audioUnlocked && player.paused) {
    silentUrl = silentUrl || URL.createObjectURL(wavFromPcm(new Uint8Array(4800), 24000));   // 0.1 s of silence
    player.onended = player.onerror = null; player.src = silentUrl; player.play().then(() => { audioUnlocked = true; }, () => {});
  }
  if (IOS && TTS && !speechPrimed) { speechPrimed = true; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (x) {} }   // once: lets the browser voice speak later
}
['touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, true));
const TAP_TO_HEAR = 'Tap anywhere to hear the narrator (this browser needs a tap before it plays sound).';
function playClip(fail) {   // plays whatever is loaded in the shared player; if the browser still refuses, waits for the next tap
  player.play().then(() => { audioUnlocked = true; if (actx) ensureAudio(); }, e => {
    if (!e || e.name !== 'NotAllowedError') { fail(); return; }
    voiceStatus(TAP_TO_HEAR, true);
    blockedPlay = () => { if (!handsActive) voiceStatus(''); player.play().catch(fail); };
  });
}
function wavFromPcm(pcm, rate) {   // raw 16-bit mono PCM -> WAV, in case the API returns headerless audio
  const h = new DataView(new ArrayBuffer(44)), w = (o, s) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); w(8, 'WAVEfmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, pcm.length, true);
  return new Blob([h.buffer, pcm], { type: 'audio/wav' });
}
const ttsCache = new Map();   // voice+model+style+text -> audio URL; replaying a message costs nothing while the page stays open
async function geminiTTS(text, only) {   // only: this voice (a narrator sample in the set-up)
  const chosen = (!guest() && S().ttsModel) || GEMINI.ttsModel, voice = only || (A() && A().ttsVoice) || S().ttsVoice || DEFAULT_TTS_VOICE, backup = chosen === GEMINI.ttsModel ? GEMINI.ttsBackup : GEMINI.ttsModel, model = ttsBackupNow ? backup : chosen, style = S().ttsStyle || DEFAULT_TTS_STYLE, ck = [voice, model, style, text].join('\u0001');
  if (ttsCache.has(ck)) return ttsCache.get(ck);
  const body = {
    model,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] }
  };
  const r = guest() ? await netFetch('/api/gemini?p=tts', { method: 'POST', headers: headers(), body: JSON.stringify(body) })
    : await netFetch(GEMINI_HOST + '/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S().key }, body: JSON.stringify(body) });
  if (!r.ok) {
    if (guest() && (r.status === 402 || r.status === 403)) { geminiBlocked = true; throw await inviteError(r); }
    const body = (await r.text()).slice(0, 200);
    // Quotas are per model, so when the chosen voice model runs out, switch to the other one (its own daily allowance) before giving up on Gemini.
    if (r.status === 429 && !ttsBackupNow) { ttsBackupNow = true; console.warn('Voice quota hit on ' + model + '; switching to ' + backup);
      if (A()) addMsg('sys', 'The Gemini voice has used up its allowance for now, so the other voice model (' + backup + ') takes over.'); return geminiTTS(text, only); }
    if (r.status === 429) geminiBlocked = true; throw new Error('Gemini voice HTTP ' + r.status + ': ' + body); }
  const j = await r.json(); let data = null;
  (j.steps || []).forEach(s => (s.content || []).forEach(c => { if (c.type === 'audio' && c.data) data = c.data; }));
  if (!data) throw new Error('Gemini voice returned no audio');
  const bin = atob(data), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  recordUsage('voice', null, false, (bin.startsWith('RIFF') ? bytes.length - 44 : bytes.length) / 48000);   // 24kHz 16-bit mono = 48,000 bytes per second
  const url = URL.createObjectURL(bin.startsWith('RIFF') ? new Blob([bytes], { type: 'audio/wav' }) : wavFromPcm(bytes, 24000));
  ttsCache.set(ck, url);
  if (ttsCache.size > 80) { const k = ttsCache.keys().next().value; URL.revokeObjectURL(ttsCache.get(k)); ttsCache.delete(k); }
  return url;
}
// Same interface as the browser speaker (push / end / done callback). Settings > Voice requests per reply: "one" sends the whole reply in one
// request once it is complete (fewest requests, slower start); "two" sends a short first piece, then the rest. Otherwise chunk sizes GROW:
// a short first piece (fast start), then each piece ~3x larger up to the cap, each requested as soon as it is complete.
function makeGeminiSpeaker(done) {
  const mode = guest() ? '700' : String(S().ttsChunk || '2000');   // guests: smaller pieces keep each clip under the invite server's 4.5 MB response limit
  let buf = '', pend = '', q = [], ended = false, fired = false, playing = false, next = 0, target = 130, stopped = false, audio = null;
  const clean = t => t.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
  const warn = e => { if (geminiWarned) return; geminiWarned = true; console.warn(e); if (e.quota) return;   // the story already says the invite is used up
    addMsg('sys', (/HTTP 429/.test(e.message) ? 'The Gemini voice has reached its limit for now, so the device voice reads the story instead.' : 'Gemini voice unavailable (' + String(e.message).slice(0, 140) + '). Using the device voice instead.') + (IOS ? ' ' + SILENT_TIP : '')); };
  function flush() {
    const t = clean(pend); pend = ''; if (!t) return; target = Math.min(target * 3, Math.max(400, +mode || 2000));
    q.push({ text: t, p: geminiTTS(t).then(url => ({ url }), err => ({ err })) }); pump();
  }
  function add(s) { pend += (pend ? ' ' : '') + s; if (mode === 'one' || (mode === 'two' && q.length)) return; if (pend.length >= target) flush(); }
  function pump() {
    if (stopped || playing) return;
    const it = q[next];
    if (!it) { if (ended && !fired) { fired = true; if (activeGemini === self) activeGemini = null; if (done) done(); } return; }
    playing = true;
    it.p.then(res => {
      if (stopped) return;
      let moved = false; const advance = () => { if (moved || stopped) return; moved = true; audio = null; playing = false; next++; pump(); };
      if (res.url) { audio = player; player.onended = player.onerror = advance; player.src = res.url; stopAmbient(); playClip(advance); }
      else { warn(res.err); if (TTS) { const bs = makeBrowserSpeaker(advance); bs.push(it.text + ' '); bs.end(); } else advance(); }
    });
  }
  const self = {
    stop() { stopped = true; if (audio) { audio.pause(); audio = null; } },
    push(d) { buf += d; let m; while ((m = buf.match(/^([\s\S]{12,}?[.!?…]["'”)\]]*)\s+/))) { add(m[1]); buf = buf.slice(m[0].length); } },
    end() { if (buf.trim()) add(buf); buf = ''; flush(); ended = true; pump(); }
  };
  activeGemini = self;
  return self;
}
function makeSpeaker(done) { return useGemini() ? makeGeminiSpeaker(done) : makeBrowserSpeaker(done); }
function speak(text, done, force) {
  if (useGemini() && (S().speak || force)) { stopSpeech(); const sp = makeGeminiSpeaker(done); sp.push(String(text) + ' '); sp.end(); return; }
  speakBrowser(text, done, force);
}
// ---------------- Browser voice ----------------
// talkUntil: when the browser voice should be finished with everything it was given (about 13 characters a second). Safari sometimes never
// reports that speech ended, so past this time the app stops treating the narrator as talking: the microphone and the story never stay stuck.
let talkUntil = 0;
function utter(t) {
  const u = new SpeechSynthesisUtterance(t), v = browserVoice();
  if (v) { u.voice = v; u.lang = v.lang; }   // no voice: leave the language unset too, so Safari uses its own default voice (it may have none for e.g. en-CA)
  u.rate = +S().rate || 1;
  talkUntil = Math.max(talkUntil, Date.now()) + t.length * 75 / u.rate + 1500;
  return u;
}
function speakBrowser(text, done, force) {
  if (!TTS || !(S().speak || force)) { if (done) done(); return; }
  speechSynthesis.cancel(); talkUntil = 0;
  const parts = chunkText(text);
  if (!parts.length) { if (done) done(); return; }
  parts.forEach((p, i) => { const u = utter(p); if (i === parts.length - 1) u.onend = u.onerror = () => { if (done) done(); }; speechSynthesis.speak(u); });
}
// Speaks a reply sentence by sentence while it is still streaming in. If Safari refuses (nothing starts within 4 s and nothing is speaking),
// the reply is kept and read on the next tap. Either way the speaker always finishes, so hands-free and the Gemini fallback never hang.
function makeBrowserSpeaker(done) {
  let buf = '', pending = 0, ended = false, fired = false, started = false, check = null, safety = null;
  const said = [];
  const finish = force => { if (fired || !ended || (pending > 0 && !force)) return; fired = true; clearTimeout(check); clearTimeout(safety); if (done) done(); };
  const refused = () => {
    if (fired) return;
    try { speechSynthesis.cancel(); } catch (e) {}
    talkUntil = 0; pending = 0; if (S().voice) voiceSuspect = true;   // a voice picked in Settings may be one the browser cannot use
    voiceStatus(TAP_TO_HEAR, true);
    blockedPlay = () => { if (!handsActive) voiceStatus(''); speakBrowser(said.join(' '), null, true); };
    ended = true; finish(true);
  };
  const say = t => {
    t = String(t).replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim(); if (!t) return;
    said.push(t); if (fired) return;
    const u = utter(t); pending++;
    u.onstart = () => { started = true; stopAmbient(); };
    u.onend = u.onerror = () => { pending--; finish(); };
    speechSynthesis.speak(u);
    if (!check) check = setTimeout(() => { if (!started && !speechSynthesis.speaking) refused(); }, 4000);
  };
  return {
    push(d) { buf += d; let m; while ((m = buf.match(/^([\s\S]{12,}?[.!?…]["'”)\]]*)\s+/))) { say(m[1]); buf = buf.slice(m[0].length); } },
    end() {
      say(buf); buf = ''; ended = true; finish();
      if (!fired) safety = setTimeout(() => started ? finish(true) : refused(), Math.max(0, talkUntil - Date.now()) + 3000);
    }
  };
}
function initVoices() {
  if (!TTS) { $('setVoice').innerHTML = '<option value="">(speech not supported in this browser)</option>'; return; }
  const fill = () => {
    const vs = speechSynthesis.getVoices(); if (!vs.length) return;
    const ranked = rankedVoices(), rest = vs.filter(v => !ranked.includes(v)).sort((a, b) => a.name.localeCompare(b.name));
    $('setVoice').innerHTML = '<option value="">' + (IOS ? 'Automatic: Safari\'s default voice (recommended)' : 'Automatic (best available)') + '</option>' +
      ranked.concat(rest).map(v => '<option value="' + esc(v.name) + '">' + esc(v.name + ' (' + v.lang + ')') + (goodVoice(v) ? ' ★' : '') + '</option>').join('');
    $('setVoice').value = vs.some(v => v.name === S().voice) ? S().voice : '';
  };
  fill(); speechSynthesis.onvoiceschanged = fill;
}
$('setVoice').addEventListener('change', () => { if ($('setVoice').value) db.settings.voice = $('setVoice').value; else delete db.settings.voice; voiceSuspect = false; persist(); });
// ---------------- Voice tests with a step-by-step readout (so problems on a phone or tablet can be seen) ----------------
// Silent Mode mutes the device voice (and the soft background sounds) on iPhone and iPad, while the Gemini voice still plays.
const SILENT_TIP = 'Hearing nothing from the device voice? Your iPad or iPhone is probably in Silent Mode, which mutes it (the Gemini voice still plays). To turn Silent Mode off: swipe down from the top-right corner of the screen to open Control Center, then tap the bell so it is no longer crossed out. On an iPhone you can also use the Ring/Silent switch or the Action button on the left side.';
const TEST_LINE = 'The rain came down over the harbour in long silver threads, and somewhere out in the fog, a ship\'s bell began to toll. "Captain," she whispered, "they are early."';
function diag(lines) { $('voiceDiag').innerHTML = lines.filter(Boolean).map(esc).join('<br>'); }
function testDeviceVoice(report) {   // speaks TEST_LINE with the device voice and reports what the browser says happened
  if (!TTS) { report('Device voice: this browser has no speech synthesis.'); return; }
  const u = utter(TEST_LINE), v = browserVoice(), who = v ? v.name + ' (' + v.lang + ')' : 'the browser\'s default voice';
  let started = false;
  u.onstart = () => { started = true; report('Device voice: speaking with ' + who + '. ' + (IOS ? SILENT_TIP : 'If you hear nothing, check that the volume is up and the device is not muted.')); };
  u.onend = () => report('Device voice: finished speaking with ' + who + (started ? '.' : ', but it never reported starting (nothing was heard?).'));
  u.onerror = e => report('Device voice: error "' + (e.error || 'unknown') + '" with ' + who + '.');
  report('Device voice: asked ' + who + ' to speak...');
  speechSynthesis.speak(u);
  setTimeout(() => { if (!started) report('Device voice: nothing started after 3 seconds (' + who + '; ' + speechSynthesis.getVoices().length + ' voices listed; speaking=' + speechSynthesis.speaking + (IOS ? '; iPhone/iPad' : '') + ').'); }, 3000);
}
$('testDevice').onclick = () => { stopSpeech(); voiceSuspect = false; testDeviceVoice(t => diag([t])); };   // runs inside your tap, which Safari always allows
$('testVoice').onclick = async () => {
  autoSave(); stopSpeech(); geminiWarned = false; geminiBlocked = false; ttsBackupNow = false; voiceSuspect = false;
  const lines = [], report = (i, t) => { lines[i] = t; diag(lines); };
  if (TTS) { try { const p = new SpeechSynthesisUtterance(' '); p.volume = 0; speechSynthesis.speak(p); } catch (e) {} }   // inside this tap, so the device voice may speak after the Gemini attempt
  if (S().fake || !hasKey() || S().ttsEngine === 'browser') { report(0, 'Gemini voice: ' + (S().ttsEngine === 'browser' ? 'switched off in Settings' : 'no API key (or offline test mode)') + ', so only the device voice is tested.'); testDeviceVoice(t => report(1, t)); return; }
  report(0, 'Gemini voice: requesting a clip...');
  try {
    const url = await geminiTTS(TEST_LINE);
    player.onended = () => report(0, 'Gemini voice: finished playing.'); player.onerror = null; player.src = url;
    await player.play(); report(0, 'Gemini voice: playing.');
  } catch (e) {
    const quota = /HTTP 429/.test(e.message); if (quota) geminiBlocked = true;
    report(0, e.name === 'NotAllowedError' ? 'Gemini voice: the clip is ready but the browser blocked playback; tap Test voice again.'
      : 'Gemini voice: ' + (quota ? 'out of quota for now (HTTP 429)' : 'failed (' + String(e.message).slice(0, 120) + ')') + '. Trying the device voice instead.');
    if (e.name !== 'NotAllowedError') testDeviceVoice(t => report(1, t));
  }
};
$('story').addEventListener('click', e => { const m = e.target.closest('.msg.gm'); if (m) speak(m.textContent, null, true); });

function micUI(on) { listening = on; }
// ---------------- Ambient sound (synthesised, no files): plays while the story is being prepared, stops when the narrator starts ----------------
let actx = null, amb = null, dictBuf = '';
function ensureAudio() { try { if (!actx || actx.state === 'closed') actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state !== 'running') actx.resume(); } catch (e) {} return actx; }   // iPhone leaves it 'interrupted' after the screen sleeps
// The thinking sound and the beeps need a running AudioContext, and phones only restart one inside a tap. Since the microphone now comes back
// on its own after the screen wakes, there may be no Hands-free tap to do it, so any tap on the page (or the narrator starting) wakes the sound too.
['pointerdown', 'touchend', 'keydown'].forEach(t => document.addEventListener(t, () => { if (actx && actx.state !== 'running') ensureAudio(); }, true));
function ambientKind() {
  let k = S().ambient || (handsActive ? 'calm' : 'off');
  if (k === 'auto') {
    const a = A(), last = a && a.transcript.length ? a.transcript[a.transcript.length - 1].text.slice(0, 600) : '';
    const t = ((a ? a.location + ' ' + a.bible.slice(0, 500) : '') + ' ' + last).toLowerCase();
    k = /rain|storm|drizzle|monsoon/.test(t) ? 'rain' : /\bsea\b|ocean|harbo|shore|beach|ship|pirate|dock|pier|coast|island|wave/.test(t) ? 'waves' : /desert|mountain|forest|prairie|canyon|cliff|wild west|wind/.test(t) ? 'wind' : 'calm';
  }
  return k;
}
// Soft, slow, professional "thinking" pad: a quiet open-fifth chord (D, A, E) of sine tones with a gentle filter swell and a faint echo.
// Phone speakers can't play the low D (73 Hz) and buzz or crackle when pushed there, so the iPhone clip leaves it out and leans on the upper notes.
const PAD_NOTES = [[73.42, 0.5], [146.83, 0.55], [220, 0.4], [329.63, 0.28], [440, 0.12]], PAD_NOTES_PHONE = [[146.83, 0.3], [220, 0.45], [329.63, 0.32], [440, 0.14]];
function calmPad(c, phone) {
  const master = c.createGain(), bus = c.createGain(), filt = c.createBiquadFilter(), delay = c.createDelay(2), fb = c.createGain(), dl = c.createBiquadFilter(), nodes = [];
  filt.type = 'lowpass'; filt.frequency.value = 800; filt.Q.value = 0.4; bus.gain.value = 0.16;
  delay.delayTime.value = 0.5; fb.gain.value = 0.38; dl.type = 'lowpass'; dl.frequency.value = 1100;
  bus.connect(filt); filt.connect(master); filt.connect(delay); delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(master);
  (phone ? PAD_NOTES_PHONE : PAD_NOTES).forEach(([f, g]) => [-4, 4].forEach(dt => {
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f; o.detune.value = dt; og.gain.value = g / 2; o.connect(og); og.connect(bus); o.start(); nodes.push(o);
  }));
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.05; lg.gain.value = 220; lfo.connect(lg); lg.connect(filt.frequency); lfo.start(); nodes.push(lfo);   // slow brightness swell
  const l2 = c.createOscillator(), g2 = c.createGain(); l2.frequency.value = 0.09; g2.gain.value = 0.03; l2.connect(g2); g2.connect(bus.gain); l2.start(); nodes.push(l2);   // slow breathing
  master.connect(c.destination);
  master.gain.setValueAtTime(0, c.currentTime); master.gain.linearRampToValueAtTime(0.5, c.currentTime + 2);
  return { master, nodes };
}
function ambientGraph(c, kind, phone) {   // builds the sound on any audio context: the live one, or an offline one that renders a clip for iPhone
  if (kind === 'calm') return calmPad(c, phone);
  const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'rain') d[i] = w; else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const filt = c.createBiquadFilter(), swell = c.createGain(), master = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  if (kind === 'waves') { filt.type = 'lowpass'; filt.frequency.value = 700; lfo.frequency.value = 0.12; swell.gain.value = 0.5; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(swell.gain); }
  else if (kind === 'rain') { filt.type = 'highpass'; filt.frequency.value = 1500; lfo.frequency.value = 0.3; swell.gain.value = 0.22; lg.gain.value = 0.04; lfo.connect(lg); lg.connect(swell.gain); }
  else { filt.type = 'bandpass'; filt.frequency.value = 400; filt.Q.value = 0.8; lfo.frequency.value = 0.07; swell.gain.value = 0.6; lg.gain.value = 250; lfo.connect(lg); lg.connect(filt.frequency); }
  src.connect(filt); filt.connect(swell); swell.connect(master); master.connect(c.destination);
  master.gain.setValueAtTime(0, c.currentTime); master.gain.linearRampToValueAtTime(0.5, c.currentTime + 1.5);
  src.start(); lfo.start(); return { master, nodes: [src, lfo] };
}
// iPhone/iPad: Web Audio is muted by Silent Mode and can stay asleep after the screen locks, while <audio> elements keep playing (the
// narrator uses one). So on iOS the thinking sound and the beeps are rendered once into WAV clips and played through <audio> elements.
const ambEl = new Audio(), sfxEl = new Audio(); [ambEl, sfxEl].forEach(el => { el.setAttribute('playsinline', ''); el.preload = 'auto'; }); ambEl.loop = true;
let fxUnlocked = false;
const clipCache = {};
function renderClip(key, secs, build, loop) {   // -> Promise of a WAV object URL; a loop gets its end cross-faded into its start, so it repeats seamlessly
  if (clipCache[key]) return clipCache[key];
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return Promise.reject(new Error('No offline audio here'));
  const rate = 24000, pre = loop ? 3 : 0, c = new OC(1, Math.ceil(rate * (secs + pre)), rate); build(c);
  return clipCache[key] = new Promise((res, rej) => { c.oncomplete = e => res(e.renderedBuffer); const p = c.startRendering(); if (p && p.then) p.then(res, rej); }).then(b => {
    let d = b.getChannelData(0);
    if (loop) { const st = pre * rate, f = rate, out = d.slice(st); for (let i = 0; i < f; i++) { const t = i / f, j = out.length - f + i; out[j] = out[j] * (1 - t) + d[st - f + i] * t; } d = out; }
    const pcm = new Int16Array(d.length); for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
    return URL.createObjectURL(wavFromPcm(new Uint8Array(pcm.buffer), rate));
  });
}
function startAmbient() {
  if (amb) return; const kind = ambientKind(); if (kind === 'off') return;
  if (IOS) {
    const me = amb = { el: true };
    renderClip('amb-' + kind, 30, c => ambientGraph(c, kind, true), true).then(url => { if (amb !== me) return; ambEl.src = url; return ambEl.play(); }).catch(e => console.warn('thinking sound', e));
    return;
  }
  const c = ensureAudio(); if (!c) return;
  amb = ambientGraph(c, kind);
}
function stopAmbient() {
  if (amb && amb.el) { amb = null; ambEl.pause(); return; }
  if (!amb || !actx) return; const m = amb; amb = null;
  try { m.master.gain.cancelScheduledValues(actx.currentTime); m.master.gain.setValueAtTime(m.master.gain.value, actx.currentTime); m.master.gain.linearRampToValueAtTime(0, actx.currentTime + 1.2); } catch (e) {}
  setTimeout(() => m.nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 1400);
}
// Short cues so you can hear (eyes closed) what is happening: 'listen' = your turn to talk, 'ack' = "Make it so" heard (a starship
// computer's acknowledging chirp), 'sent' = a typed message sent. Each is a list of [frequency, start, length] tones.
const CUES = { listen: [[660, 0, 0.35]], sent: [[440, 0, 0.35]], ack: [[1175, 0, 0.07], [1568, 0.085, 0.07], [2093, 0.17, 0.16]] };
function cueGraph(c, name, t0) {
  CUES[name].forEach(([f, st, len]) => {
    const o = c.createOscillator(), g = c.createGain(), t = t0 + st; o.type = name === 'ack' ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(name === 'ack' ? 0.09 : 0.12, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + len + 0.05);
  });
}
function blip(name) {
  if (!handsActive) return;
  if (IOS) { renderClip('cue-' + name, 0.5, c => cueGraph(c, name, 0)).then(url => { sfxEl.src = url; return sfxEl.play(); }).catch(e => console.warn('cue', e)); return; }
  const c = ensureAudio(); if (c) cueGraph(c, name, c.currentTime);
}
// The send phrase is "Make it so" (Captain Picard). It only counts at the very END of what you said, and only after a short pause, so a sentence like "make it so the door opens" does not send. "End dictation" still works as a backup.
const SEND_PHRASE = 'make it so';
const END_RE = /(^|\s)(make it so|end (of )?dictation)[.,!?\s]*$/i, hasEnd = s => END_RE.test(s), stripEnd = s => s.replace(END_RE, '').replace(/\s+/g, ' ').trim();
let endTimer = null;
// Hands-free: the microphone stays on until you tap the button again. Speech is ignored while the story is being prepared or the narrator is talking
// (so it never hears itself), and only the words "make it so" send the message. Pauses never send.
let recRun = false, lastMuted = false, voiceErr = '', quietErr = false, recSince = 0, recIdle = 0, recHeard = false;   // recSince: when the current session was started or aborted without ending yet
const narrating = () => !!activeGemini || (TTS && speechSynthesis.speaking && Date.now() < talkUntil);   // see talkUntil: never stuck "talking"
const micMuted = () => busy || narrating();
// The send phrase is drawn letter by letter so each one can glow and bob in a wave.
const magic = p => '<span class="magic" aria-label="' + esc(p) + '">' + [...p].map((c, i) => '<span style="animation-delay:' + (i * 0.08).toFixed(2) + 's">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>').join('') + '</span>';
function voiceStatus(m, warn, html) {
  const el = $('voiceStatus'), h = html || esc(m || ''), k = h + '|' + !!warn;
  if (el.dataset.k === k) return; el.dataset.k = k;   // the status is refreshed every 400 ms; rewriting it would restart the animation
  el.innerHTML = h; el.style.color = warn ? 'var(--warn)' : ''; el.style.display = h ? '' : 'none'; el.classList.toggle('listen', !!html);
}
function setHandsUI() {
  $('micBtn').innerHTML = handsActive ? '&#127911; Hands-free ON' : '&#127911; Hands-free';
  $('input').placeholder = handsActive ? 'Say "' + SEND_PHRASE + '" to send' : 'What do you do?';
  if (!handsActive) { $('micBtn').classList.remove('rec'); voiceStatus(''); }
}
setInterval(() => {
  if (!handsActive) return;
  const m = micMuted();
  if (m !== lastMuted) {
    lastMuted = m; voiceErr = '';   // any stale speech error is cleared whenever the muted state changes
    if (!m) { dictBuf = ''; $('input').value = ''; recSince = Date.now(); try { rec.abort(); } catch (e) {} blip('listen'); }   // fresh session so no tail of the narrator's voice is picked up
  }
  // Watchdog (iPhone): Safari sometimes never ends an aborted session or never starts a new one, which left the mic dead after a few turns.
  // A session that has not started (or ended after an abort) within 4 seconds is dropped and replaced; a mic that sits idle is restarted.
  if (!m && recRun && recSince && Date.now() - recSince > 4000) { console.warn('speech session stuck; restarting'); const old = rec; rec = null; recRun = false; recSince = 0; try { old && old.abort(); } catch (e) {} listen(); }
  else if (!m && !recRun && document.visibilityState === 'visible') { recIdle = recIdle || Date.now(); if (Date.now() - recIdle > 3000) { recIdle = 0; listen(); } }
  else recIdle = 0;
  $('micBtn').classList.toggle('rec', recRun && !m);
  const fileNote = location.protocol === 'file:' ? ' (Opened as a file, so the browser asks for the microphone again on every restart. Serve the folder from a local web server instead; see the README.)' : '';
  if (voiceErr && !m) voiceStatus(voiceErr, true);
  else if (!m && recRun) voiceStatus('', !!fileNote, 'Hands-free ON: listening. Say ' + magic(SEND_PHRASE) + ' to send.' + esc(fileNote));
  else voiceStatus((m ? (narrating() ? 'Hands-free ON: narrator speaking (mic paused).' : 'Hands-free ON: the story is being prepared...') : 'Hands-free ON: starting the microphone...') + fileNote, !!fileNote);
}, 400);
function listen() {
  if (!SR) { alert('Speech recognition is not supported in this browser. Chrome, Edge and Safari support it.'); handsActive = false; setHandsUI(); return; }
  if (!handsActive || recRun || document.visibilityState === 'hidden') return;   // a hidden page restarts it when it comes back
  const me = rec = new SR(); rec.lang = SPEECH_LANG; rec.interimResults = true; rec.continuous = true;   // `me`: a session replaced after the screen woke up is ignored when it finally ends
  let finalText = dictBuf ? dictBuf + ' ' : '', dictDone = false;
  recRun = true; recSince = Date.now();
  rec.onstart = () => { if (rec === me) recSince = 0; micUI(true); };
  rec.onaudiostart = () => { if (rec === me) recSince = 0; };
  rec.onresult = e => {
    if (dictDone || micMuted()) return;
    voiceErr = ''; recHeard = true;
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; }
    const full = (finalText + interim).trim();
    if (hasEnd(full)) {
      $('input').value = stripEnd(full); clearTimeout(endTimer);
      endTimer = setTimeout(() => { endTimer = null; dictDone = true; finalText = stripEnd(full); $('input').value = finalText; try { rec.stop(); } catch (x) {} }, 800);   // wait a beat: if you keep talking, the phrase was part of a sentence
      return;
    }
    clearTimeout(endTimer); endTimer = null;
    $('input').value = full;
  };
  rec.onerror = e => {
    if (rec !== me) return;
    if ((e.error === 'not-allowed' || e.error === 'service-not-allowed') && Date.now() - backAt < 8000) { handsActive = false; setHandsUI(); voiceStatus('The microphone switched off while the screen was asleep. Tap Hands-free to turn it back on.', true); }   // iPhone: a restart after sleep can need a tap
    else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { handsActive = false; voiceErr = ''; setHandsUI(); alert('Microphone access was blocked. Allow it in the browser address bar (lock icon) and tap Hands-free again.'); }
    else if (e.error === 'audio-capture' && recHeard) quietErr = true;   // iPhone: the mic was briefly taken (e.g. by playback) after it had worked; just retry
    else if (e.error === 'audio-capture') { handsActive = false; setHandsUI(); alert('No microphone was found.'); }
    else if (micMuted()) quietErr = true;   // errors while the narrator talks or the story loads are expected (Edge drops the speech service while audio plays): retry quietly, show nothing
    else if (e.error === 'network') voiceErr = 'The browser speech service could not be reached (network). Retrying...';
    else if (e.error !== 'no-speech' && e.error !== 'aborted') voiceErr = 'Speech error: ' + e.error + '. Retrying...';
  };
  rec.onend = () => {
    if (rec !== me) return;
    recRun = false; recSince = 0; micUI(false);
    if (endTimer) { clearTimeout(endTimer); endTimer = null; dictDone = true; }   // the session ended while the send phrase was pending: treat it as sent
    const t = $('input').value.trim();
    if (dictDone) { dictBuf = ''; if (t && !busy) { dictated = true; send(); } }
    else dictBuf = micMuted() ? '' : t;   // the browser ends sessions after silence: keep what was said and reopen
    const slow = voiceErr || quietErr; quietErr = false;
    if (handsActive) setTimeout(listen, slow ? 1500 : 200);
  };
  try { rec.start(); } catch (e) { recRun = false; console.warn(e); if (handsActive) setTimeout(listen, 1000); }
}
// Phones (iPhone especially) cut the microphone when the screen sleeps. While hands-free is on, a screen wake lock keeps the screen awake
// (Safari 16.4+, Chrome, Edge); the browser drops the lock whenever the page is hidden, so it is taken again on return. If the screen
// did sleep, the microphone is restarted cleanly when the page comes back, and if the phone wants a tap first, the status line says so.
let wakeLock = null, backAt = 0;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
  } catch (e) { console.warn('wake lock', e); }
}
document.addEventListener('visibilitychange', () => {
  if (!handsActive) return;
  if (document.visibilityState === 'hidden') { try { rec.abort(); } catch (e) {} return; }
  backAt = Date.now(); keepAwake(true); ensureAudio();
  const old = rec; rec = null; recRun = false; dictBuf = ''; try { old && old.abort(); } catch (e) {} setTimeout(listen, 400);   // a fresh session: the old one died with the screen
});
$('micBtn').onclick = () => {
  ensureAudio();   // browsers only allow sound after a tap, so unlock it here for the ambient sound later
  if (handsActive) { handsActive = false; dictBuf = ''; try { rec.abort(); } catch (e) {} setHandsUI(); keepAwake(false); return; }
  if (!SR) { alert('Speech recognition is not supported in this browser. Chrome, Edge and Safari support it.'); return; }
  if (!S().speak) { db.settings.speak = true; $('setSpeak').checked = true; persist(); }   // hands-free needs the story read aloud
  handsActive = true; voiceErr = ''; recHeard = false; lastMuted = micMuted(); setHandsUI(); blip('listen'); keepAwake(true); listen();
};

