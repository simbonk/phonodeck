// Phonodeck: the set-up wizard (Experience Curator), the photo reader, creating a world, short stories and the report card.
// Plain scripts that share one global scope (no build step); index.html loads them in order: prompts, experiences, core, engine, voice, curator, ui.

// ---------------- Experience Curator ----------------
// Answers are stored by question id. Every experience starts with: how much time you have, the narrator's voice (asked once, then saved),
// about you (name, age, gender), and the experience picker: a curated experience (one tap fills everything in; the description stays
// editable) or "build the world myself", which goes on to the feeling, how you want to play, an optional photo and the detailed questions.
// Children (under 13) get their own option chips (ck), and the AI-suggested options take everything said so far into account, age included.
// A session of 15 minutes or less is told as a clean, simple short story, and its option chips (cs) stay on Earth, in familiar times.
const QUESTIONS = [
  { id: 'time', single: true, q: 'How much time do you have?', h: 'You play by the clock, not by turns. The Game Master keeps an eye on the time and lands a proper ending before it runs out, then you get a report card. 10-15 minutes makes a quick short story.', c: ['10 minutes (a quick story)', '20 minutes', '30 minutes', '45 minutes', '1 hour', '2 hours (an epic)'], ph: 'Or type your own, e.g. 25 minutes' },
  { id: 'feeling', suggest: 'Make some suggestions', q: 'What feeling do you want to come away with?', h: 'The phonodeck is a mirror: it gives back what you bring to it. Delivering this feeling is the Game Master\'s main goal, and the whole story bends toward it. Describe it in your own words; the more specific, the better. Stuck? Press "Make some suggestions" to build on anything you have typed.', c: [], ph: 'e.g. the cosy feeling of a snow day with nowhere to be' },
  { id: 'mode', single: true, q: 'How do you want to play?', h: 'Curated story: a hidden plot with a beginning, middle and end, which bends (or waits) when you are happy elsewhere. Experience simulator: no plot points at all, just a richly painted world, your own goal and the feeling.', c: ['Curated story (a plot that bends to you)', 'Experience simulator (no plot, just the world and the feeling)'] },
  { id: 'photo', photo: true, q: 'Paint the world from a photo? (optional)', h: 'Optional. A picture is worth a thousand words: the phonodeck works out the place, the time and the people, writes the world from them, and fills in the remaining questions for you. Add a caption if you like.', c: [], ph: 'Optional caption: who or where is this? e.g. "Me and Dana in Lisbon, summer 2019"' },
  { id: 'goal', q: 'What do you want to do there?', h: 'Your goal for this experience. The Game Master helps you do it, with no plot getting in the way. You can change your mind once you are there.', c: ['Explore every corner', 'Spend time with someone special', 'Learn a craft from a local', 'Eat my way through the place', 'Do absolutely nothing', 'Throw a party'],
    ck: ['Explore every corner', 'Make friends with the animals', 'Build something amazing', 'Find all the secret places', 'Have a feast', 'Learn some magic'], ph: 'e.g. Spend an evening in Ten Forward swapping stories with Guinan' },
  { id: 'world', q: 'What kind of world do you want to step into?', h: 'Pick an era or a world you find fascinating. The more specific the time and place, the richer the story.', ph: 'Or name your own, e.g. Ancient Rome in 44 BC, or Tokyo in 2077',
    c: ['The American Civil War, 1863', 'Star Trek: The Next Generation', 'France during World War II', 'Los Angeles in the 1920s', 'Miami in 1985', 'Victorian London in the 1880s', 'Pirates of the Caribbean, 1715', 'Surprise me'],
    ck: ['Dragons and castles', 'Space adventure', 'Magic school', 'Pirate treasure hunt', 'Dinosaur island', 'Superheroes', 'Underwater kingdom', 'Talking animals', 'A friendly haunted house', 'Jungle explorer', 'Toys come alive', 'Surprise me'] },
  { id: 'vibe', q: 'What vibe should it have?', h: 'Pick a mood; more than one is fine.', c: ['Gritty', 'Whimsical', 'Epic', 'Cozy', 'Tense', 'Funny', 'Melancholic', 'Romantic', 'Mysterious', 'Wholesome'],
    ck: ['Funny', 'Exciting', 'Magical', 'Cozy', 'Silly', 'Mysterious (not too scary)', 'Brave', 'Wholesome'] },
  { id: 'who', q: 'Who are you in this story?', h: 'Name, role, background. A sentence is enough.', c: ['A weary detective', 'A rookie adventurer', 'A smuggler', 'A scholar', 'A soldier turned outcast', 'A stranger with amnesia'],
    cs: ['A small-town reporter', 'A retired detective', 'A ship\'s cook', 'A wedding photographer', 'A taxi driver', 'A schoolteacher'],
    ck: ['A young wizard', 'A brave knight', 'A space cadet', 'A kid detective', 'A dragon rider', 'A pirate captain', 'A superhero in training', 'A talking animal'] },
  { id: 'traits', q: 'What are your character\'s strengths and flaws?', h: 'These will matter in the story.', c: ['Clever but reckless', 'Strong but stubborn', 'Charming but dishonest', 'Brave but haunted', 'Lucky but broke'],
    ck: ['Clever but impatient', 'Brave but clumsy', 'Kind but shy', 'Fast but forgetful', 'Funny but a bit loud'] },
  { id: 'where', q: 'Where and when does it begin?', h: 'Place, era, weather, atmosphere.', c: ['A rainy harbour town', 'A remote space station', 'A royal capital on a festival night', 'A desert outpost', 'A train in motion', 'A city that never sleeps'],
    cs: ['A small coastal town', 'A busy train station', 'A family wedding', 'A hotel during a storm', 'A coffee farm in the hills', 'A city at night'],
    ck: ['A castle on a cloud', 'A secret treehouse', 'A spaceship', 'A magical forest', 'A pirate ship', 'An underwater city'] },
  { id: 'hook', q: 'What is pulling you into the story?', h: 'The hook or central goal.', c: ['Find someone missing', 'Solve a crime', 'Survive and escape', 'Recover a lost treasure', 'Uncover a conspiracy', 'Protect someone', 'Settle a score', 'Build something new'],
    ck: ['Find a lost pet', 'Find hidden treasure', 'Rescue a friend', 'Win a big contest', 'Solve a mystery', 'Save the kingdom', 'Make a new friend'] },
  { id: 'allies', q: 'Who is by your side?', h: 'Allies, companions, or none.', c: ['Lone wolf', 'A loyal sidekick', 'A rival turned ally', 'A small crew', 'A mysterious mentor', 'A talking animal'],
    ck: ['A loyal dog', 'A baby dragon', 'A robot friend', 'My best friend', 'A wise owl', 'A friendly ghost'] },
  { id: 'threat', q: 'What stands in your way?', h: 'The main threat or antagonist.', c: ['A shadowy organisation', 'A single cunning villain', 'Nature itself', 'A ticking clock', 'My own past', 'Something supernatural', 'Betrayal from within'],
    cs: ['A clever con artist', 'A storm', 'A rival', 'A ticking clock', 'A family secret', 'A misunderstanding'],
    ck: ['A grumpy troll', 'A sneaky thief', 'A big storm', 'A mischievous wizard', 'A ticking clock', 'A runaway robot'] },
  { id: 'play', q: 'How do you like to play?', h: 'Style of play and difficulty.', c: ['Lots of dialogue', 'Action heavy', 'Exploration', 'Puzzles and clues', 'Forgiving', 'Dangerous, with real consequences', 'Short punchy replies', 'Rich, detailed prose'] },
  { id: 'avoid', q: 'Anything to avoid, or anything else to know?', h: 'Content boundaries, favourite books/films to echo, special requests.', c: ['Keep it PG-13', 'No gore', 'No romance', 'In the style of a classic novel', 'Nothing off limits within reason'],
    ck: ['Nothing too scary', 'No spiders', 'Lots of jokes', 'In the style of a fairy tale'] }
];
const QBY = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
// The narrator's voice: six Gemini voices that read stories well, three women and three men. Asked once; after that the saved choice is
// used (change it any time in Settings > Voice & sound). Skipped when the Gemini voice is off or there is no key.
const NARRATORS = [
  { v: 'Sulafat', g: 'f', d: 'Warm, the classic storyteller' }, { v: 'Vindemiatrix', g: 'f', d: 'Gentle and intimate' }, { v: 'Gacrux', g: 'f', d: 'Mature and assured' },
  { v: 'Charon', g: 'm', d: 'Deep and measured' }, { v: 'Algieba', g: 'm', d: 'Smooth and easy' }, { v: 'Algenib', g: 'm', d: 'Gravelly, with character' }];
const NARRATOR_LINE = 'Welcome to the phonodeck. Close your eyes for a moment. Where shall we go today?';
const VOICE_Q = { id: 'voice', voice: true, q: 'Choose your narrator', h: 'Tap a voice to hear it. This is asked once and saved; you can change it any time in Settings > Voice & sound.', c: [] };
const voiceStepDue = () => !S().narratorPicked && (S().ttsEngine || 'gemini') === 'gemini' && !S().fake && hasKey();
// About you: name, age and gender, in one step. Pre-filled from Settings > Personal details. (Romance is its own question at the end of the build-it-myself questions.)
const ME_Q = { id: 'me', me: true, q: 'About you in the game', h: 'These can be made up: play as anyone you like. Your name, age and gender shape the whole story (a 10-year-old and a 70-year-old get very different experiences). They are saved in Settings > Personal details for next time.', c: [] };
// The experience picker: the curated experiences, plus a bigger "build the world myself" card. Picking an experience shows its description
// (editable) and the main button becomes "Build my world"; building it yourself goes on to the feeling, play mode, photo and detailed questions.
const PICK_Q = { id: 'pick', pick: true, q: 'Choose an experience', h: 'Curated experiences are hand-made worlds, each built around a feeling. Someday this might be a market, with experience curators making them for a living. Tap one to read it, or build your own world.', c: [], ph: '' };
function mePrefill() {   // answers filled in from Settings > Personal details
  // Gender and interest are free text: common words read naturally ("a man", "women"); anything else is used as written.
  const me = S().me || {}, out = {}, g = String(me.gender || '').trim(), i = String(me.interest || '').trim();
  const who = { male: 'a man', man: 'a man', m: 'a man', female: 'a woman', woman: 'a woman', f: 'a woman', 'non-binary': 'a non-binary person', nonbinary: 'a non-binary person' }[g.toLowerCase()] || (!g ? 'someone' : /^(a|an|the)\s/i.test(g) ? g : /\b(wo)?m[ae]n|person|guy|girl|boy|lady|dude|gal|bloke\b/i.test(g) ? 'a ' + g : 'someone who is ' + g);
  const what = { everyone: 'anyone who catches my eye', anyone: 'anyone who catches my eye', both: 'women and men' }[i.toLowerCase()] || i.toLowerCase();
  if (me.name) out.name = [me.name, me.last].filter(Boolean).join(' ');
  if (g) out.gender = g;
  if (me.born > 1900) out.age = String(new Date().getFullYear() - me.born);
  if (g || i) out.romance = romanceText(g, i);
  return out;
}
function romanceText(g, i) {   // "I am a man who is interested in women" from the two free-text answers
  g = String(g || '').trim(); i = String(i || '').trim();
  const who = { male: 'a man', man: 'a man', m: 'a man', female: 'a woman', woman: 'a woman', f: 'a woman', 'non-binary': 'a non-binary person', nonbinary: 'a non-binary person' }[g.toLowerCase()] || (!g ? 'someone' : /^(a|an|the)\s/i.test(g) ? g : /\b(wo)?m[ae]n|person|guy|girl|boy|lady|dude|gal|bloke\b/i.test(g) ? 'a ' + g : 'someone who is ' + g);
  const what = { everyone: 'anyone who catches my eye', anyone: 'anyone who catches my eye', both: 'women and men' }[i.toLowerCase()] || i.toLowerCase();
  return 'I am ' + who + (who.startsWith('someone who') ? ' and' : ' who is') + ' interested in ' + (what || '...');
}
// The last question of the deep set-up, for adults only, and only when an earlier answer hints at romance (a "Romantic" vibe, love in the
// feeling, a sweetheart among the company...). Pre-filled from Settings > Personal details. Without a hint it is skipped, and the details in
// Settings still reach the story quietly as background (see playerBrief).
const ROMANCE_Q = { id: 'romance', rom: true, q: 'Any romance in this story?', h: 'Something you said suggests romance. Tell the story who you are and who you are drawn to. It stays in the background unless you take it further. Filled in from Settings > Personal details, and saved there if those are empty.', c: [] };
const noRomance = t => !String(t || '').trim() || isNoPref(t) || /^no romance/i.test(String(t).trim());
const ROMANCE_HINT = /\b(roman\w*|love|lovers?|crush|flirt\w*|dating|date night|kiss\w*|sweetheart|passion\w*|wedding|marr(y|ied|iage)|seduc\w*|courtship|affair|soulmate)\b/i;
function romanceHinted() {   // any earlier answer (not the romance answer itself) that mentions romance; "in love with a place" does not count
  return Object.entries(cur.answers).some(([k, v]) => !['romance', 'name', 'age', 'gender', 'me', 'time', 'mode', 'voice', 'pick'].includes(k) && !isNoPref(v) &&
    ROMANCE_HINT.test(String(v || '').replace(/\b(no|without|avoid|skip)( the)? romance\b/gi, '').replace(/\bin love with (a|the|this|that) (place|city|town|village|island|country|world|landscape)\b/gi, '')));
}
// "Same cast, new story": a shorter questionnaire. The cast, world and the old answers below carry over (and are pre-filled).
const LINK_Q = { id: 'link', q: 'How does the new story connect to the old one?', h: 'Same cast and world either way; this sets what they remember.', c: ['Sequel: it picks up after the last story', 'Years later', 'Fresh start: same cast, new story', 'Prequel: before it all began'] };
const WHO2_Q = { id: 'who', q: 'Who are you this time?', h: 'Keep your character, play one of the returning cast, or someone new.', c: ['The same character as before', 'One of the returning characters', 'Someone new'] };
const STORY_IDS = ['world', 'vibe', 'who', 'traits', 'where', 'hook', 'allies', 'threat', 'play', 'avoid'], SIM_IDS = ['world', 'where', 'goal', 'who', 'allies', 'avoid'];
const simPick = () => /simulat/i.test(cur.answers.mode || '');
const shortPick = () => !!cur.answers.time && !isNoPref(cur.answers.time) && minutesOf(cur.answers.time) <= 15;   // a short session was chosen
const buildPick = () => cur.answers.pick === 'build';   // "build the world myself" (otherwise a curated experience, or "surprise me")
const ageNow = () => +cur.answers.age || 0, kidPick = () => ageNow() > 0 && ageNow() < 13, minorPick = () => ageNow() > 0 && ageNow() < 18;
// children get their own chips; short stories get the grounded ones; under-18s never see romance options
const chipsOf = q => (q.ck && kidPick() ? q.ck : q.cs && shortPick() ? q.cs : q.c).filter(c => !(minorPick() && /roman[ct]|love/i.test(c)));
const NOPREF = '(no preference: you decide, surprise me)';
const isNoPref = s => /^\(no preference/i.test(String(s || ''));
let cur = { i: 0, answers: {}, extra: {}, rounds: {} };
function newCur(extra) {   // askVoice is fixed when the wizard opens, so saving the voice part-way through does not renumber the questions
  return Object.assign({ i: 0, answers: mePrefill(), extra: {}, rounds: {}, askVoice: voiceStepDue() }, extra);
}
function curQs() {   // the list depends on the experience you pick and the play mode (and a new story with the same cast skips the world questions)
  const sim = simPick(), head = [QBY.time].concat(cur.askVoice ? [VOICE_Q] : [], [ME_Q]);
  if (cur.src) return head.concat([QBY.feeling, QBY.mode, LINK_Q, sim ? QBY.goal : QBY.hook, WHO2_Q], sim ? [] : [QBY.vibe, QBY.play], [QBY.avoid]);
  return head.concat([PICK_Q], buildPick() ? [QBY.feeling, QBY.mode, QBY.photo].concat((sim ? SIM_IDS : STORY_IDS).map(id => QBY[id]), !minorPick() && romanceHinted() ? [ROMANCE_Q] : []) : []);
}
// Adventures made before answers had ids stored them by position.
const OLD_IDS = ['world', 'vibe', 'who', 'traits', 'where', 'hook', 'allies', 'threat', 'play', 'avoid', 'length', 'romance'];
function curatorAnswer(a, id) {
  const c = a.curator || [], hit = c.some(x => x.id) ? c.find(x => x.id === id) : c[OLD_IDS.indexOf(id)];
  const v = hit ? String(hit.a || '') : ''; return isNoPref(v) || /^\(sin preferencia/i.test(v) ? '' : v;
}
// ---------------- Extra options: if the player lingers on a question, the cheap model suggests more chips that fit their earlier answers ----------------
// The offline demo has no model, so it shows a few ready-made extras instead.
const DEMO_MORE = { feeling: FEELING_IDEAS,
  goal: ['Find the best view in town', 'Cook a meal with a local', 'Win over a grumpy regular', 'Learn the local dance'], world: ['Ancient Rome', '1960s Hollywood', 'A Caribbean island', 'Small-town carnival'], vibe: ['Dreamy', 'Bittersweet', 'Swashbuckling', 'Eerie'],
  who: ['A retired thief', 'A ship\'s cook', 'A disgraced knight', 'A street magician'], traits: ['Kind but naive', 'Proud but loyal', 'Curious but clumsy', 'Calm but secretive'],
  where: ['A floating market', 'A snowbound monastery', 'A lighthouse at dusk', 'A jungle ruin'], hook: ['Deliver a secret message', 'Break a curse', 'Win a contest', 'Clear your name'],
  allies: ['An old friend', 'A reluctant guard', 'A clever child', 'A robot companion'], threat: ['A corrupt official', 'A rival treasure hunter', 'A spreading plague', 'A broken promise'],
  play: ['Heist planning', 'Social intrigue', 'Chase scenes', 'Negotiation'], avoid: ['No spiders', 'Light on violence', 'Keep it hopeful', 'In the style of a fairy tale'] };
const MORE_AFTER_MS = 7000;
let moreTimer = null;
function wireChips() {
  $('curChips').querySelectorAll('.chip').forEach(b => b.onclick = () => {
    const t = $('curA').value, v = b.dataset.c, q = curQs()[cur.i] || {};
    let parts = t.split(/,\s*/).filter(Boolean); const ix = parts.indexOf(v);
    if (ix >= 0) parts.splice(ix, 1); else if (q.single) parts = [v]; else parts.push(v);   // time and play mode take one answer
    $('curA').value = parts.join(', '); curChips(); armMore();
  });
  curChips();
}
function addExtraChips(list) {
  const have = new Set([...$('curChips').querySelectorAll('.chip')].map(b => b.dataset.c.toLowerCase()));
  list.forEach(c => { c = String(c).trim(); if (!c || have.has(c.toLowerCase())) return; have.add(c.toLowerCase());
    const b = document.createElement('button'); b.className = 'chip ai'; b.dataset.c = c; b.textContent = c; $('curChips').appendChild(b); });
  wireChips();
}
const MORE_ROUNDS = {};
const moreDue = id => (cur.rounds[id] || 0) < (MORE_ROUNDS[id] || 1);
function armMore() {   // (re)start the wait; every interaction restarts it, so it only fires when the player seems stuck
  clearTimeout(moreTimer); const q = curQs()[cur.i];
  if (!q || q.suggest || !moreDue(q.id) || ['time', 'mode', 'photo', 'length', 'link', 'me', 'voice', 'pick', 'describe'].includes(q.id) || (S().fake ? false : !hasKey())) return;
  moreTimer = setTimeout(() => moreOptions(q.id), q.id === 'feeling' ? 3500 : MORE_AFTER_MS);
}
async function moreOptions(id, asked) {   // asked: the player pressed a Suggest button (no round limit)
  const qs = curQs(), i = qs.findIndex(q => q.id === id);
  if (i < 0 || i !== cur.i || (!asked && !moreDue(id)) || !$('curator').classList.contains('on')) return;
  cur.rounds[id] = (cur.rounds[id] || 0) + 1;
  const fallback = () => { const all = (DEMO_MORE[id] || []).filter(c => !(minorPick() && /love/i.test(c))), n = asked ? 6 : 4, k = ((cur.rounds[id] - 1) * n) % Math.max(all.length, 1); return all.slice(k, k + n); };
  if (S().fake || !hasKey()) { const d = fallback(); cur.extra[id] = (cur.extra[id] || []).concat(d); addExtraChips(d); armMore(); return; }
  $('curMsg').textContent = 'Thinking of more options...';
  try {
    const q = qs[i], prior = qs.slice(0, i).map(x => '- ' + x.q + ' ' + (x.me ? meSummary() : cur.answers[x.id] || '(open)')).join('\n') || '(nothing yet)';
    const typed = $('curA').value.trim();
    const gp = (id === 'feeling' ? ' For this question IGNORE the 1-4 word rule above: the options are FEELINGS someone might want to come away with from a really good story, each a specific, evocative emotional experience of 3-9 words (e.g. "The thrill of getting away with something", "Coming home after years away", "Cosy safety while a storm rages outside", "Bittersweet nostalgia for a time I never lived"). Make them varied: warm, thrilling, bittersweet, triumphant, peaceful.' +
      (typed ? ' The player has typed "' + typed.slice(0, 300) + '": take it as the cue, and offer richer, more specific variations and close neighbours of that feeling.' : '') : '') +
      (id === 'world' ? ' For this question the options are specific eras and places, or well-known story universes, each with a time and a place where the time matters (e.g. "Venice during Carnival, 1750", "Berlin, 1989").' : '') +
      (id === 'goal' ? ' For this question the options are things to DO in the world (2-6 words, e.g. "Learn a craft from a local", "Throw a party").' : '') + (id === 'play' ? ' For this question the options must be GAMEPLAY CATEGORIES (short, e.g. "Heist planning", "Social intrigue", "Chase scenes", "Survival", "Negotiation", "Mystery solving").' : '') +
      (ageNow() ? ' The player is ' + ageNow() + ' years old: every option must suit and appeal to that age' + (kidPick() ? ' (a child: G-rated, playful, no romance, nothing frightening).' : minorPick() ? ' (a teenager: PG, no romance).' : '.') : '') +
      (shortPick() ? ' The player chose a SHORT story: keep options simple and grounded, set on Earth today or in a familiar period of history; avoid high fantasy, science fiction and invented worlds.' : '');
    const raw = await chat('options', [{ role: 'system', content: 'Output ONLY JSON: {"options":["6 new options"]}. Match the style of the EXISTING OPTIONS exactly: broad, high-level, generic categories of 1-4 words that work for any story (like "Noir detective", "Cozy", "A loyal sidekick", "A ticking clock"). Do NOT invent plot details, character names, place names or anything specific; stay at the same level of abstraction. They should fit the earlier answers in spirit and must not repeat the existing options.' + gp },
      { role: 'user', content: 'EARLIER ANSWERS:\n' + prior + '\n\nQUESTION: ' + q.q + ' (' + q.h + ')\nEXISTING OPTIONS: ' + chipsOf(q).concat(cur.extra[id] || []).join('; ') }]);
    const opts = (parseJson(raw).options || []).slice(0, 8); cur.extra[id] = (cur.extra[id] || []).concat(opts);
    if ((curQs()[cur.i] || {}).id === id) { addExtraChips(opts); $('curMsg').textContent = ''; armMore(); }
  } catch (e) { console.warn('more options failed', e); if ((curQs()[cur.i] || {}).id !== id) return;
    if (asked && DEMO_MORE[id]) { const d = fallback(); cur.extra[id] = (cur.extra[id] || []).concat(d); addExtraChips(d); $('curMsg').textContent = ''; }   // still give some ideas
    else $('curMsg').textContent = (e.quota ? '' : 'Could not think of more options: ') + String(e.message || e).slice(0, 220); }
}
function curRender() {
  const qs = curQs(); cur.i = Math.min(cur.i, qs.length - 1); const q = qs[cur.i], n = qs.length;
  $('curTitle').textContent = cur.src ? 'SAME CAST, NEW STORY: ' + cur.src : 'EXPERIENCE CURATOR';
  $('curBar').style.width = (cur.i / n * 100) + '%';
  $('curStep').textContent = 'Question ' + (cur.i + 1) + ' of ' + n;
  $('curQ').textContent = q.q; $('curHint').textContent = q.h + (cur.fromPhoto && cur.fromPhoto.includes(q.id) ? ' (Filled in from your photo: change anything you like.)' : '');
  $('curPhoto').style.display = q.photo ? '' : 'none'; showPhoto();
  const picked = q.pick && !!cur.preset;
  $('curMe').style.display = q.me ? '' : 'none'; $('curPick').style.display = q.pick ? '' : 'none'; $('curSkip').style.display = q.me || q.rom || q.voice ? 'none' : '';
  $('curVoice').style.display = q.voice ? '' : 'none'; if (q.voice) voiceRender();
  $('curRom').style.display = q.rom ? '' : 'none';
  if (q.rom) { const me = S().me || {}, a = cur.answers; $('romGender').value = a.romGender !== undefined ? a.romGender : a.gender || me.gender || ''; $('romInterest').value = a.romInterest !== undefined ? a.romInterest : me.interest || ''; $('romNone').checked = !!a.romNone; }
  $('curA').style.display = q.me || q.rom || q.voice || (q.pick && !picked) ? 'none' : ''; $('curNext').style.display = q.pick && !picked ? 'none' : '';
  if (picked) $('curHint').textContent = cur.preset.title + ': every detail is filled in (feeling: ' + cur.preset.feeling + '). Edit the description below if you like, then press "Build my world".';
  if (q.me) { const nm = String(cur.answers.name || '').trim().split(/\s+/); $('meName').value = nm.shift() || ''; $('meLast').value = nm.join(' '); $('meAge').value = cur.answers.age || ''; $('meGender').value = cur.answers.gender || ''; }
  $('curFinish').style.display = cur.photo && cur.photo.canvas && cur.i < n - 1 ? '' : 'none';
  presetRender(q);
  $('curA').value = (q.pick ? cur.answers.describe : cur.answers[q.id]) || ''; $('curA').placeholder = q.ph || 'Type your own answer, or tap options above...';
  $('curSuggestRow').style.display = q.suggest ? '' : 'none'; if (q.suggest) { $('curSuggest').textContent = q.suggest; busyBtn($('curSuggest')); }
  if (q.suggest) $('curSuggestRow').after($('curChips')); else $('curHint').after($('curChips'));   // suggestions appear under the box they help with
  const modes = q.id === 'mode'; $('curChips').classList.toggle('modes', modes);   // the play modes show as two cards: name, then what it means
  $('curChips').innerHTML = chipsOf(q).map(c => '<button class="chip" data-c="' + esc(c) + '">' + (modes ? esc(c).replace(/ \((.*)\)$/, '<small>$1</small>') : esc(c)) + '</button>').join('');
  if (cur.extra[q.id]) addExtraChips(cur.extra[q.id]); else wireChips();
  $('curBack').disabled = cur.i === 0;
  curNextLabel();
  $('curMsg').textContent = ''; armMore();
}
const PRESET_IDS = ['world', 'vibe', 'who', 'traits', 'where', 'hook', 'allies', 'threat', 'play', 'avoid'];
function presetPick(p) {   // fills the box, the feeling and every set-up answer; the Game Master also gets the story beats
  if (cur.preset) presetDrop();
  cur.preset = p; const a = cur.answers; a.pick = 'preset'; a.describe = p.describe; a.feeling = p.feeling; a.mode = QBY.mode.c[0];
  PRESET_IDS.forEach(id => { a[id] = p[id]; }); curRender();
}
function presetDrop() { const p = cur.preset; if (!p) return; ['feeling', ...PRESET_IDS].forEach(id => { if (cur.answers[id] === p[id]) delete cur.answers[id]; }); delete cur.answers.describe; delete cur.answers.pick; cur.preset = null; }
function presetRender(q) {
  $('curPresets').style.display = q.pick && !kidPick() ? '' : 'none';   // children build their own world (the curated ones are for adults)
  $('pickBuild').classList.toggle('primary', !!q.pick && buildPick());
  $('presetChips').innerHTML = PRESETS.map(p => '<button class="xp' + (cur.preset === p ? ' sel' : '') + '" data-p="' + p.id + '">' + esc(p.label) + '<small>' + esc(p.feeling) + '</small></button>').join('');
}
$('presetChips').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; const p = PRESETS.find(p => p.id === b.dataset.p);
  if (p === cur.preset) { presetDrop(); curRender(); } else presetPick(p); });   // tapping the picked story again clears it
$('pickBuild').onclick = () => { presetDrop(); cur.answers.pick = 'build'; curAdvance(); };
// ---------------- Narrator voice step ----------------
function voiceRender() {
  const now = cur.answers.voice || S().ttsVoice || DEFAULT_TTS_VOICE, col = g => '<div><div class="tag" style="margin-bottom:6px">' + (g === 'f' ? 'WOMEN' : 'MEN') + '</div>' +
    NARRATORS.filter(n => n.g === g).map(n => '<button class="vc' + (n.v === now ? ' sel' : '') + '" data-v="' + n.v + '" style="width:100%;margin-bottom:8px">&#9654; ' + voiceName(n.v) + '<small>' + esc(n.d) + '</small></button>').join('') + '</div>';
  $('curVoice').innerHTML = col('f') + col('m');
  if (!cur.answers.voice) cur.answers.voice = NARRATORS.some(n => n.v === now) ? now : DEFAULT_TTS_VOICE;
}
$('curVoice').addEventListener('click', async e => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  cur.answers.voice = b.dataset.v; voiceRender(); stopSpeech();
  $('curMsg').textContent = 'Fetching a sample of ' + voiceName(b.dataset.v) + '...';
  try { const url = await geminiTTS(NARRATOR_LINE, b.dataset.v); if (cur.answers.voice !== b.dataset.v) return; player.onended = null; player.onerror = null; player.src = url; await player.play(); $('curMsg').textContent = ''; }
  catch (err) { $('curMsg').textContent = err.name === 'NotAllowedError' ? 'Tap the voice again to hear it.' : 'Could not play a sample (' + String(err.message).slice(0, 120) + '). You can still pick this voice.'; }
});
function curChips() { const parts = $('curA').value.split(/,\s*/); $('curChips').querySelectorAll('.chip').forEach(b => b.classList.toggle('sel', parts.includes(b.dataset.c))); }
$('curA').addEventListener('input', () => { curChips(); armMore(); });
$('curSuggest').onclick = async () => { const q = curQs()[cur.i]; if (!q) return; busyBtn($('curSuggest'), 'Thinking of some...'); await moreOptions(q.id, true); if ((curQs()[cur.i] || {}).id === q.id) busyBtn($('curSuggest')); };
function curStore() {
  const q = curQs()[cur.i]; if (!q) return;
  if (q.pick) { if (cur.preset) cur.answers.describe = $('curA').value.trim(); return; }
  if (q.voice) { const v = cur.answers.voice || DEFAULT_TTS_VOICE; db.settings.ttsVoice = v; db.settings.narratorPicked = true; persist(); loadTtsVoice(); return; }   // saved straight away
  if (q.rom) { const a = cur.answers; a.romGender = $('romGender').value.trim(); a.romInterest = $('romInterest').value.trim(); a.romNone = $('romNone').checked;
    a.romance = a.romNone || (!a.romGender && !a.romInterest) ? 'No romance' : romanceText(a.romGender, a.romInterest); return; }
  if (!q.me) { cur.answers[q.id] = $('curA').value.trim(); return; }
  const n = +$('meAge').value; cur.answers.name = [$('meName').value.trim(), $('meLast').value.trim()].filter(Boolean).join(' '); cur.answers.age = n > 0 ? String(Math.round(n)) : ''; cur.answers.gender = $('meGender').value.trim();
  cur.answers.me = meSummary();
}
function meSummary() { const x = cur.answers; return [x.name && 'name ' + x.name, x.age && 'age ' + x.age, x.gender && 'gender ' + x.gender].filter(Boolean).join('; ') || '(not given)'; }
$('curBack').onclick = () => { curStore(); if (cur.i > 0) { cur.i--; curRender(); } };
$('curSkip').onclick = () => { const q = curQs()[cur.i]; if (q.pick) { presetDrop(); cur.answers.pick = 'surprise'; cur.answers.describe = NOPREF; curAdvance(); return; } if (q.photo) { cur.photo = null; $('photoFile').value = ''; } $('curA').value = ''; cur.answers[q.id] = NOPREF; curAdvance(); };
$('curNext').onclick = async () => {
  curStore(); const q = curQs()[cur.i];
  if (q.photo && cur.photo && !cur.photo.canvas && !(await readPhoto())) return;   // the photo is studied once, when you leave this step
  if (!cur.answers[q.id]) cur.answers[q.id] = q.photo && cur.photo ? '(photo uploaded)' : NOPREF; curAdvance();
};
$('curFinish').onclick = () => {   // the photo answered the rest (your name and age were asked before it; romance comes after, only if hinted)
  curStore(); cur.i = curQs().length - 1; curAdvance();
};
$('curCancel').onclick = () => { $('curator').classList.remove('on'); renderStart(); $('start').classList.add('on'); };

function busyBtn(b, text) {   // a pulsing, disabled button that says what is happening; call without text to restore it
  if (text) { b.dataset.label = b.dataset.label || b.textContent; b.textContent = text; b.disabled = true; b.classList.add('busy'); }
  else { b.disabled = false; b.classList.remove('busy'); if (b.dataset.label) { b.textContent = b.dataset.label; delete b.dataset.label; } }
}
function curNextLabel() {   // the main button says what it will do
  const qs = curQs(), q = qs[cur.i]; if (!q) return;
  $('curNext').textContent = q.photo && cur.photo && !cur.photo.canvas ? 'Study my photo \u2192' : q.pick ? 'Build my world \u2192' : cur.i === qs.length - 1 ? 'Create my experience' : 'Next';
}

// ---------------- Photo: paint the world from a picture ----------------
function shrinkImage(img, max, q) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q);
}
function showPhoto() {
  const p = cur.photo; $('photoPrev').style.display = p ? '' : 'none'; if (p) $('photoPrev').src = p.thumb;
  $('photoClear').style.display = p ? '' : 'none'; $('photoBtn').innerHTML = p ? '&#128247; Choose a different photo' : '&#128247; Choose a photo';
  $('photoName').textContent = p ? (p.canvas ? 'Studied: ' + [p.place, p.era].filter(Boolean).join(', ') : p.name) : '';
}
$('photoBtn').onclick = () => $('photoFile').click();
$('photoClear').onclick = () => { cur.photo = null; cur.fromPhoto = []; $('photoFile').value = ''; showPhoto(); curRender(); };
$('photoFile').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const url = URL.createObjectURL(file), img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('This browser could not open that image. Try a JPEG or PNG.')); img.src = url; });
    cur.photo = { name: file.name, full: shrinkImage(img, 1280, 0.85), thumb: shrinkImage(img, 360, 0.7) }; URL.revokeObjectURL(url);
    $('curMsg').textContent = 'Press "Study my photo" and the phonodeck will read the place, the time and the people.'; showPhoto(); curNextLabel();
  } catch (err) { $('curMsg').textContent = err.message; }
};
async function readPhoto() {   // returns false if it failed (you stay on the photo step)
  const p = cur.photo, caption = $('curA').value.trim();
  busyBtn($('curNext'), 'Studying your photo...'); $('curMsg').textContent = 'Studying your photo: the place, the time and the people. This takes a few seconds.';
  try {
    let o;
    if (S().fake) o = { place: 'A sunlit harbour café', era: 'Late summer, early evening', mood: 'Warm, lazy, golden', people: [{ label: 'The friend with the sunglasses', desc: 'Laughing at something just out of frame.' }],
      canvas: 'You step into the photo. Warm stone under your feet, the clink of glasses, gulls arguing over a dropped chip... (offline demo: a real key writes 700-1000 words here)', lore: [{ name: 'Café Marítimo', type: 'place', aliases: [], desc: 'A harbour café with blue chairs and a cat that owns the place.' }],
      answers: { world: 'Seaside summer', where: 'A harbour café on a warm evening', who: 'The one taking the photo', allies: 'An old friend', vibe: 'Warm, lazy', goal: 'Watch the sunset and stay out late', hook: 'A note is tucked under the sugar bowl' } };
    else {
      if (!hasKey()) throw new Error('Studying a photo needs an API key (Settings > Connection), or turn on the offline demo.');
      o = parseJson(await chat('photo', [{ role: 'system', content: PHOTO_RULES }, { role: 'user', content: [{ type: 'text', text: 'CAPTION FROM THE PLAYER: ' + (caption || '(none)') + '\nPLAY MODE: ' + (cur.answers.mode || 'open') + '\nFEELING THEY WANT: ' + (cur.answers.feeling || 'open') }, { type: 'image_url', image_url: { url: p.full } }] }]));
    }
    if (!o || !o.canvas) throw new Error('The photo description came back empty.');
    Object.assign(p, { canvas: String(o.canvas), place: o.place || '', era: o.era || '', mood: o.mood || '', people: o.people || [], lore: o.lore || [], caption });
    cur.fromPhoto = [];
    Object.entries(o.answers || {}).forEach(([id, v]) => { if (v && QBY[id] && (!cur.answers[id] || isNoPref(cur.answers[id]))) { cur.answers[id] = String(v); cur.fromPhoto.push(id); } });
    cur.answers.photo = 'Photo: ' + [p.place, p.era].filter(Boolean).join(', ') + (caption ? '. Caption: ' + caption : '');
    $('curMsg').textContent = ''; return true;
  } catch (err) { $('curMsg').textContent = 'Could not study the photo: ' + err.message; return false; }
  finally { busyBtn($('curNext')); }
}
async function curAdvance() {
  const qs = curQs();
  if (cur.i < qs.length - 1) { cur.i++; curRender(); return; }
  const answers = qs.flatMap(q => q.voice ? []
    : q.pick ? [{ id: 'describe', q: cur.preset ? 'What you are looking for (a curated experience, possibly edited by the player: where it differs from the details below, this wins)' : 'What you are looking for', a: cur.answers.describe }].filter(x => x.a)
    : q.me ? [{ id: 'name', q: 'Your name', a: cur.answers.name }, { id: 'age', q: 'Your age', a: cur.answers.age }, { id: 'gender', q: 'Your gender', a: cur.answers.gender }].filter(x => x.a)
    : q.id === 'romance' ? [{ id: 'romance', q: 'Romance', a: noRomance(cur.answers.romance) ? '' : cur.answers.romance }].filter(x => x.a)
    : [{ id: q.id, q: q.q, a: cur.answers[q.id] || '(no preference)' }]);
  if (cur.preset) { ['feeling', 'mode', ...PRESET_IDS].forEach(id => { if (cur.answers[id] && !answers.some(x => x.id === id)) answers.push({ id, q: QBY[id].q, a: cur.answers[id] }); });
    answers.push({ id: 'beats', q: 'Story beats for the Game Master (a guide for a good series of events; keep them secret from the player)', a: cur.preset.beats }); }
  { const me = Object.assign({}, S().me), nm = cur.answers.name, age = +cur.answers.age; let ch = false;   // remember your name and age for next time (never overwrites them)
    const [first, ...rest] = String(nm || '').split(/\s+/), last = rest.join(' ');
    if (first && !me.name) { me.name = first; $('setMeName').value = first; ch = true; }
    if (last && !me.last && first.toLowerCase() === String(me.name).toLowerCase()) { me.last = last; $('setMeLast').value = last; ch = true; }
    if (age && !me.born) { me.born = new Date().getFullYear() - age; $('setMeBorn').value = me.born; ch = true; }
    const mine = !first || !me.name || first.toLowerCase() === String(me.name).toLowerCase(), a = cur.answers;
    if (mine && a.gender && !me.gender) { me.gender = a.gender; $('setMeGender').value = a.gender; ch = true; }
    if (mine && qs.includes(ROMANCE_Q) && !a.romNone) {
      if (a.romGender && !me.gender) { me.gender = a.romGender; $('setMeGender').value = a.romGender; ch = true; }
      if (a.romInterest && !me.interest) { me.interest = a.romInterest; $('setMeInterest').value = a.romInterest; ch = true; } }
    if (ch) { db.settings.me = me; persist(); } }
  let suggested;
  if (cur.src) { const base = cur.src.replace(/ \d+$/, ''); let k = 2; while (db.adventures[base + ' ' + k]) k++; suggested = base + ' ' + k; }
  else if (cur.preset) suggested = cur.preset.title;
  else { const w = cur.answers.world || (cur.answers.describe || '').split(/[.!?]/)[0]; suggested = (isNoPref(w) || !w ? 'Adventure' : w.split(',')[0]).replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 30) + ' ' + new Date().toISOString().slice(5, 10); }
  let name = prompt('Name this experience:', suggested); if (!name) return; name = name.trim();
  if (db.adventures[name] && !confirm('"' + name + '" exists. Replace it?')) return;
  busyBtn($('curNext'), 'Building your world...'); $('curMsg').textContent = 'The curator is building your world. This takes a few seconds.';
  // The chosen "how do you like to play" options (including AI-suggested ones) become the gameplay categories the Director rotates through at random.
  const notCats = QBY.play.c.slice(4).map(s => s.toLowerCase());
  const cats = (isNoPref(cur.answers.play) ? '' : cur.answers.play || '').split(/,\s*/).map(s => s.trim()).filter(s => s && !notCats.includes(s.toLowerCase())).slice(0, 6);   // "surprise me" contains a comma, so drop it whole
  try { await createAdventure(name, answers, cats, cur.src, cur.photo && cur.photo.canvas ? cur.photo : null); }
  catch (e) { $('curMsg').textContent = (e.quota ? '' : 'Error: ') + e.message; busyBtn($('curNext')); curNextLabel(); return; }
  busyBtn($('curNext')); curNextLabel();
  $('curator').classList.remove('on'); enterAdventure(name, true);
}
function startSequel(name) {   // a new questionnaire for the same cast and world, pre-filled from the original answers
  const src = db.adventures[name]; if (!src) return;
  const pre = {}; ['vibe', 'play', 'avoid', 'time', 'feeling', 'mode', 'goal', 'romance', 'name', 'age', 'gender'].forEach(id => { const v = curatorAnswer(src, id); if (v) pre[id] = v; });
  pre.who = WHO2_Q.c[0]; const mp = mePrefill(); ['name', 'age', 'gender', 'romance'].forEach(k => { if (mp[k] && !pre[k]) pre[k] = mp[k]; });
  cur = newCur({ answers: pre, src: name });
  $('start').classList.remove('on'); $('finale').classList.remove('on'); $('curator').classList.add('on'); $('curNext').disabled = false; curRender();
}
function namingBrief(exclude) {
  const used = new Set(), usedPlaces = new Set(); Object.entries(db.adventures).forEach(([n, a]) => { if (n === exclude) return; Object.values(a.lore || {}).forEach(e => { if (e.type === 'person' && !e.isPlayer) used.add(String(e.name).split(/\s+/)[0]); else if (e.type !== 'person' && e.name) usedPlaces.add(String(e.name).replace(/^(the|uss|hms|ss|starship|station)\s+/i, '')); }); });
  const letters = 'ABCDEFGHIJKLMNOPRSTVWY'.split('').sort(() => Math.random() - 0.5).slice(0, 4);
  return 'NAMES MATTER: spend real thought on them. Fit each name to the character\'s culture, era, class, age and personality (what would their parents have called them, in that place and time?). Mix ordinary and unusual names, vary origins, syllable counts and first letters, and give at least one character a nickname. Start the main cast\'s first names with these letters, in any order: ' + letters.join(', ') +
    '. Do NOT use these overused names, or names already used in the player\'s other stories: ' + [...new Set([...STALE_NAMES, ...used])].slice(0, 120).join(', ') + '. Ships, stations, planets, towns, inns and organisations need fresh names too: avoid naming them after famous scientists and other obvious picks, and do not reuse these: ' + [...new Set([...STALE_PLACES, ...usedPlaces])].slice(0, 80).join(', ') + '. Names the player gave (in the answers or a photo caption) are always kept exactly.';
}
function sourceWorld(src, name) {   // everything the architect needs to bring a cast and world back
  const g = src.gm || {}, story = (src.result && src.result.summary) || (src.chunks || []).map(c => c.text).join('\n') || src.events.slice(-30).join('\n') || '(the earlier story barely started)';
  const who = curatorAnswer(src, 'who'), traits = curatorAnswer(src, 'traits'), pinned = pinnedLore(src);
  return 'SOURCE WORLD (from the earlier adventure "' + name + '"):\nBIBLE:\n' + stripWishes(src.bible) +
    '\n\nTHE PLAYER CHARACTER THEN: ' + (who || '(see bible)') + (traits ? '; ' + traits : '') +
    (pinned.length ? '\n\nPLAYER-SET FACTS (keep exactly):\n' + pinned.map(loreLine).join('\n') : '') +
    '\n\nLORE (returning cast, places, factions, items):\n' + Object.values(src.lore).slice(0, 80).map(loreLine).join('\n') +
    '\n\nCHARACTER AGENDAS AT THE END:\n' + ((g.cast || []).map(c => '- ' + c.name + ': wants ' + c.wants + '; fears ' + c.fears + '; secret: ' + c.secret).join('\n') || '(none)') +
    '\n\nWHAT HAPPENED IN THAT STORY:\n' + story + '\n\nHOW IT ENDED:\n' + src.transcript.filter(t => t.role === 'gm').slice(-1).map(t => t.text.slice(0, 1500)).join('');
}
// ---------------- Session length, secret roadmap (in minutes) and the final report card ----------------
function defaultMinuteRoadmap(M) {   // acts in minutes of play; the last few minutes are always the ending
  const goals = ['Set the scene and the feeling; establish the player\'s place in the world and the hook.', 'Deepen: complications, allies and the first secrets, always in service of the feeling.', 'The turn: the central secret or a big moment makes it personal.', 'The ending: a satisfying storybook payoff that lands the feeling.'];
  const cuts = [0, 0.25, 0.55, 0.8, 1]; return goals.map((goal, k) => ({ from: Math.round(M * cuts[k]), to: Math.round(M * cuts[k + 1]), goal }));
}
function validMinuteRoadmap(r, M) {   // accept the model's roadmap only if it is well formed; make it cover minutes 0..M with no gaps
  if (!Array.isArray(r) || !r.length) return null;
  const acts = r.map(x => ({ from: +x.from, to: +x.to, goal: String(x.goal || '') })).filter(x => x.goal && x.from >= 0 && x.to > x.from).sort((x, y) => x.from - y.from);
  if (!acts.length) return null;
  acts[0].from = 0; acts[acts.length - 1].to = M;
  for (let i = 1; i < acts.length; i++) acts[i].from = acts[i - 1].to;
  return acts.every(x => x.to > x.from) ? acts : null;
}
const playerTurns = a => a.transcript.filter(t => t.role === 'player').length;
// ---------------- Short stories (5-10 turns): told like a polished short story, simple to follow ----------------
const isShort = a => !!a && (timed(a) ? a.minutes <= 15 : (a.length || 99) <= 10);
const SHORT_NUDGES = ['sensory', 'heart', 'banter', 'choice', 'payoff', 'complication', 'wonder', 'quiet'];   // the director's simpler moves; no side plots, off-screen events or hidden agendas
function finalMessages(a) {
  const pl = a.transcript.filter(t => t.role === 'player').map((t, i) => (i + 1) + '. ' + t.text.slice(0, 300)).join('\n');
  const unit = timed(a) ? 'Minutes ' : 'Turns ';
  return [{ role: 'system', content: FINAL_RULES }, { role: 'user', content: 'BIBLE:\n' + a.bible + '\n\nFEELING TO ACHIEVE: ' + feelingOf(a) + '\nPLAY MODE: ' + (isSim(a) ? "experience simulator (no plot)\nPLAYER'S GOAL: " + goalOf(a) + '\nGOAL PROGRESS: ' + (a.goalProgress || '(not recorded)') : 'curated story') +
    (timed(a) ? '\nSESSION: ' + a.minutes + ' minutes, ' + playerTurns(a) + ' player turns' : '') + (a.age ? "\nPLAYER'S AGE: " + a.age + ' (write the player comment for a reader of this age, and judge them as a ' + a.age + '-year-old)' : '') + '\nFEELING READINGS DURING PLAY (0-10, oldest first): ' + ((a.moodLog || []).join(', ') || '(none)') +
    (isSim(a) ? '' : '\n\nSECRET ROADMAP (the player never saw this):\n' + (a.roadmap || []).map(r => '- ' + unit + r.from + '-' + r.to + ': ' + r.goal).join('\n')) +
    '\n\nCHAPTER SUMMARIES:\n' + ((a.chunks || []).map(c => '- ' + c.text).join('\n') || '(none)') + '\n\nKEY EVENTS:\n' + a.events.slice(-40).join('\n') +
    '\n\nEVERY PLAYER ACTION (in order):\n' + pl + '\n\nLAST EXCHANGES:\n' + a.transcript.slice(-6).map(t => t.role + ': ' + t.text).join('\n\n') }];
}
async function finishAdventure() {
  const name = db.current, a = A(); if (!a || a.result || a.finishing) return;
  a.finishing = true; handsActive = false; try { rec.abort(); } catch (e) {} setHandsUI(); keepAwake(false);
  const note = addMsg('sys', 'The adventure is complete. The phonodeck is preparing your report card...');
  try {
    await memoryJob; await slowJob;
    a.result = parseJson(await chat('final', finalMessages(a)));
  } catch (e) { a.finishing = false; note.textContent = 'Could not prepare the report: ' + e.message + ' Press Send to try again.'; return; }
  a.finishing = false; persist(name); note.remove();
  const until = Date.now() + 180000; while (narrating() && Date.now() < until) await new Promise(r => setTimeout(r, 500));   // let the final scene finish being read first
  if (db.current === name) { renderStory(); showFinale(a); }
}
function showFinale(a) {
  if (a.result && a.result.holodeck) {   // the two-grade report card
    const r = a.result, card = (t, g) => '<h3>' + t + '</h3><div class="card"><span class="grade">' + esc(g.grade || '?') + '</span> <span class="tag">' + esc(g.score != null ? g.score + '/100' : '') + '</span><p>' + esc(g.comment || '') + '</p></div>';
    $('finaleBody').innerHTML = '<div class="tag">ADVENTURE COMPLETE</div><h1>' + esc(r.title || db.current) + '</h1><p>' + esc(r.summary || '') + '</p>' +
      card('HOW THE PHONODECK DID <span class="tag">(the feeling: ' + esc(feelingOf(a)) + (isSim(a) ? '; your goal: ' + esc(goalOf(a)) : '') + ')</span>', r.holodeck) + card('HOW YOU DID', r.player || {}) +
      (r.next ? '<h3>NEXT TIME</h3><div class="card"><p>' + esc(r.next) + '</p></div>' : '');
    $('finale').classList.add('on'); return;
  }
  const r = a.result || {}, s = r.story || {}, p = r.player || {}, f = p.followed || {}, j = p.judgement || {}, rv = r.roadmap_review || [];
  const ul = x => '<ul>' + (x || []).map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
  const hit = { yes: '&#10003;', partly: '~', no: '&#10007;' };
  $('finaleBody').innerHTML = '<div class="tag">ADVENTURE COMPLETE</div><h1>' + esc(r.title || db.current) + '</h1><p>' + esc(r.summary || '') + '</p>' +
    (r.feeling ? '<h3>THE FEELING: ' + esc(feelingOf(a)).toUpperCase() + '</h3><div class="card"><span class="grade">' + esc(r.feeling.grade || '?') + '</span> <span class="tag">' + esc(r.feeling.score != null ? r.feeling.score + '/100' : '') + '</span><p>' + esc(r.feeling.comment || '') + '</p></div>' : '') +
    '<h3>STORY GRADE</h3><div class="card"><span class="grade">' + esc(s.grade || '?') + '</span> <span class="tag">' + esc(s.score != null ? s.score + '/100' : '') + '</span><p>' + esc(s.comments || '') + '</p>' +
    '<b>Strengths</b>' + ul(s.strengths) + '<b>To improve</b>' + ul(s.improve) + '</div>' +
    '<h3>YOUR PLAY' + (p.rank ? ': ' + esc(p.rank) : '') + '</h3>' +
    '<div class="card"><b>' + (isSim(a) ? 'Your goal: ' + esc(goalOf(a)) : 'Staying on the adventure') + '</b> <span class="tag">' + esc(f.score != null ? f.score + '/100' : '') + '</span><p>' + esc(f.comment || '') + '</p></div>' +
    '<div class="card"><b>Judgement</b> <span class="grade" style="font-size:28px">' + esc(j.grade || '') + '</span> <span class="tag">' + esc(j.score != null ? j.score + '/100' : '') + '</span><p>' + esc(j.comment || '') + '</p></div>' +
    (isSim(a) || !(a.roadmap || []).length ? '' : '<h3>THE SECRET ROADMAP</h3><div class="card">' + a.roadmap.map((x, i) => '<div>' + (hit[(rv[i] || {}).hit] || '') + ' <span class="tag">' + (timed(a) ? 'Minutes ' : 'Turns ') + x.from + '-' + x.to + '</span> ' + esc(x.goal) + '</div>').join('') + '</div>');
  $('finale').classList.add('on');
}
async function createAdventure(name, answers, cats, srcName, photo) {
  const src = srcName && db.adventures[srcName];
  const a = norm({ bible: '', curator: answers, playCats: cats || [], updated: Date.now() });
  if (src) a.sequelOf = srcName;
  const txt = answers.filter(x => x.id !== 'photo').map((x, i) => (i + 1) + '. ' + x.q + '\n   ' + x.a).join('\n');
  const g = id => { const v = (answers.find(x => x.id === id) || {}).a || ''; return isNoPref(v) ? '' : v; };
  const M = minutesOf(g('time')); a.minutes = M; a.elapsed = 0; a.mode = /simulat/i.test(g('mode')) ? 'sim' : 'story';
  a.age = +g('age') || 0; a.feeling = g('feeling') || 'Awe and Wonder'; { const v = S().narratorPicked ? '' : a.age && a.age < 18 ? '' : romanceVoice(g('romance')); if (v) a.ttsVoice = v; }   // a narrator you chose wins if (isSim(a)) a.goal = g('goal') || 'Explore and enjoy the place';
  if (photo) a.photo = { thumb: photo.thumb, canvas: photo.canvas, place: photo.place, era: photo.era, caption: photo.caption || '' };
  const sim = isSim(a), est = Math.max(2, Math.round(M * 60 / SEC_PER_TURN));
  let made = null;
  if (!S().fake && hasKey()) {
    try {
      const raw = await chat('gm', [{ role: 'system', content: CREATE_RULES + '\n' + castRules(M) + (a.age ? '\n' + ageRules(a) : '') + (M <= 15 ? '\n' + SHORT_CREATE : '') + (sim ? '\n' + SIM_CREATE : '') + (photo ? '\n' + PHOTO_CREATE : '') + (src ? '\n' + SEQUEL_RULES : '') + '\n' + namingBrief(name) },
        { role: 'user', content: (src ? sourceWorld(src, srcName) + '\n\nNEW QUESTIONNAIRE:\n' : '') + txt + (photo ? '\n\nPHOTO CANVAS (place: ' + photo.place + '; time: ' + photo.era + (photo.caption ? '; caption: ' + photo.caption : '') + '):\n' + photo.canvas +
          '\nPEOPLE IN THE PHOTO:\n' + (photo.people || []).map(p => '- ' + p.label + ': ' + p.desc).join('\n') : '') +
          playerBrief(g('name'), a.age) + '\n\nFEELING TO ACHIEVE: ' + a.feeling + '\nPLAY MODE: ' + (sim ? 'experience simulator (no plot)' : 'curated story') + (sim ? "\nPLAYER'S GOAL: " + a.goal : '') + '\nM (session length in minutes) = ' + M + ' (roughly ' + est + ' player replies)' }]);
      made = parseJson(raw);
    } catch (e) { console.warn('curator generation failed, using answers directly', e); }
  }
  a.roadmap = sim ? [] : validMinuteRoadmap(made && made.roadmap, M) || defaultMinuteRoadmap(M);
  if (photo) (photo.lore || []).forEach(e => { if (!e || !e.name) return; const k = String(e.name).toLowerCase(); if (!a.lore[k]) a.lore[k] = { name: e.name, type: e.type || 'other', desc: e.desc || '', aliases: e.aliases || [], lastSeen: 0 }; if (a.lore[k].type === 'place') addPlace(a, e.name); });
  // Same cast: the returning lore comes first; the architect's new or updated entries are applied on top (hand-edited entries stay as written).
  if (src) Object.entries(src.lore).forEach(([k, e]) => { a.lore[k] = Object.assign(structuredClone(e), { lastSeen: 0 }); if (e.type === 'place') addPlace(a, e.name); });
  if (made && made.bible) {
    a.bible = '# Story Bible\n\n' + String(made.bible).replace(/^#\s*Story Bible\s*/i, '').trim();
    a.location = made.location || '';
    (made.places || []).forEach(p => addPlace(a, p)); (made.links || []).forEach(l => Array.isArray(l) && l.length === 2 && addEdge(a, l[0], l[1]));
    if (a.location) { const k = addPlace(a, a.location); a.places[k].visits = 1; }
    if (!sim) (made.beats || []).forEach(b => b && b.beat && a.beats.push({ beat: b.beat, status: b.status || 'upcoming' }));
    if (made.voice || made.secrets) a.gm = { voice: made.voice || '', secrets: made.secrets || [], threads: made.threads || [], big_reveal: made.big_reveal || '', cast: made.cast || [] };
    (made.lore || []).forEach(e => {
      if (!e.name) return; const k = e.name.toLowerCase(), old = a.lore[k]; if (old && old.byPlayer) return;
      a.lore[k] = { name: e.name, type: e.type || (old && old.type) || 'other', desc: e.desc || (old && old.desc) || '', aliases: [...new Set([...((old && old.aliases) || []), ...(e.aliases || [])])], lastSeen: 0 };
      if (a.lore[k].type === 'place') addPlace(a, e.name);
    });
    if (made.player && (made.player.name || g('name'))) addPlayerLore(a, g('name') || made.player.name, made.player.desc);
  } else if (src) {   // offline or the architect failed: reuse the old bible and note the new story's premise
    a.bible = '# Story Bible\n\n' + stripWishes(src.bible).replace(/^#[^\n]*\n+/, '') + '\n\n**New story:** ' + g('link') + '. ' + g('hook') + '.';
    if (src.gm) a.gm = structuredClone(src.gm);
  } else {
    const L = (k, v) => !String(v || '').trim() ? '' : '\n\n**' + k + ':** ' + v;
    a.bible = '# Story Bible' + (g('describe') ? L('What you asked for', g('describe')) : '') + L('Premise', (g('world') || 'Open') + (g('vibe') ? ' · ' + g('vibe') : '')) + L('Player character', g('who') + (g('traits') ? '. ' + g('traits') : '')) + L('Setting', g('where') || (photo ? photo.place + ', ' + photo.era : '')) +
      (sim ? '' : L('Central hook', g('hook')) + L('Main threat', g('threat')) + L('Style of play', g('play'))) + L('Company', g('allies')) + (g('romance') ? L('Romance', g('romance')) : '');
  }
  if (!Object.values(a.lore).some(e => e.isPlayer)) addPlayerLore(a, g('name') || 'You', [g('who'), g('traits'), g('romance')].filter(Boolean).join('. ') || 'The player character.');
  if (photo) (photo.people || []).forEach(p => { const n = String(p.label || '').trim(); if (n && !/^the\b/i.test(n) && !a.lore[n.toLowerCase()]) a.lore[n.toLowerCase()] = { name: n, type: 'person', desc: p.desc || '', aliases: [], lastSeen: 0 }; });   // people the caption named
  a.bible += '\n\n' + wishesSection(a); a.bibleSeen = a.bible;
  db.adventures[name] = a; db.current = name; persist(name);
}

// The romance answer picks the Gemini narrator for that adventure: interested in women -> Sulafat, in men -> Charon (otherwise your Settings voice).
function romanceVoice(t) {
  const m = /interested in\s+(.*)$/i.exec(String(t || '')), w = (m ? m[1] : String(t || '')).toLowerCase();
  const fem = /\b(women|woman|females?|girls?|ladies|lady|her|she|wife|girlfriend)\b/.test(w), masc = /\b(men|man|males?|guys?|boys?|him|he|husband|boyfriend)\b/.test(w);
  return fem && !masc ? 'Sulafat' : masc && !fem ? 'Charon' : '';
}
function playerBrief(name, age) {   // the player character's name and age, plus Settings > Personal details as defaults the answers can override
  // Someone else playing on this browser (a different name, e.g. your child) does not inherit your gender or romantic interest.
  const me = S().me || {}, own = !name || !me.name || name.split(/\s+/)[0].toLowerCase() === me.name.toLowerCase();
  age = age || (own && me.born > 1900 ? new Date().getFullYear() - me.born : 0);
  const bits = [own && me.gender && 'gender: ' + me.gender, own && me.interest && !(age && age < 18) && 'romantically interested in: ' + me.interest + ' (background only: see the romance rule)',
    age && age + ' years old (born about ' + (new Date().getFullYear() - age) + '; pitch the story, its words and its references to that age)'].filter(Boolean);
  const full = name && /\s/.test(name.trim());
  return (name ? "\n\nPLAYER CHARACTER'S NAME: " + name + ' (use exactly; never invent a different name for the player)' + (full ? '. People address them as they really would in this setting: rank or title with the LAST name (e.g. "Captain ' + name.trim().split(/\s+/).slice(-1)[0] + '" or "Doctor ' + name.trim().split(/\s+/).slice(-1)[0] + '"), the first name only from friends, family and close equals. Never rank or title with the first name.' : '') : '') + (bits.length ? '\nABOUT THE REAL PLAYER (defaults; the answers above win where they differ): ' + bits.join('; ') : '');
}
function addPlayerLore(a, name, desc) {   // the main character's own lore entry; always listed first
  const k = String(name).toLowerCase(), old = a.lore[k];
  a.lore[k] = Object.assign(old || { aliases: [] }, { name, type: 'person', desc: [old && old.desc, desc].filter(Boolean).join(' ').trim(), isPlayer: true, lastSeen: 0 });
}

