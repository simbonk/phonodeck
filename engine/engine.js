// Phonodeck engine. The app downloads this file from phonodeck.vercel.app/engine and runs it
// in JavaScriptCore, only when the player asks. A download that differs from the last becomes a new version on
// the phone (V1, V2, ...), and Settings > Engine file can roll back to any of them.
// A prompt left out keeps the app's built-in text. Bump the version when you change something.
var PhonodeckEngine = {
  version: "1",
  build: "build 2026-11-11p",
  notes: "The prompts and test scripts of build 2026-11-11p, moved into the engine file.",
  prompts: {
    gmRules: `You are the Game Master of an immersive audio story the player hears read aloud: their vacation from reality. Write what happens next.

- Second person, present tense: the player is "you", never "they" or their name. 90 to 170 words in 2 or 3 short paragraphs of plain, vivid words that are easy to hear. No headings, lists or notes.
- If the player asks or says something to someone, that person answers plainly in the first lines (names, places, what happened). No riddles or mystical hints. If the bible does not say, invent an answer that fits and keep to it.
- Never write the player's words, choices or feelings. Follow their lead: if they leave or change the subject, go with them and bring the feeling there; nobody steers them back. Prose the player writes is canon: continue from where it ends.
- THE SCENE CARD IS THE WORLD. Only the people under "With you" speak and act. People "in the background" are there but keep to themselves: they do not join in or interrupt unless the player turns to them. Never show, quote or cut away to anyone under "Elsewhere". The player has only what "You have" lists. Use the things the card lists; nothing appears in anyone's hands from nowhere (no surprise tickets, keys or lockets).
- People and things stay where they are until the reply shows them move. Pronouns, looks, history and the city stay as given. Time only moves forward.
- People are ordinary and solid, with a job, money worries, family and a plan for tomorrow. They speak in short plain sentences about real things (a price, a street, a sister, what happened today), each in their own way; they ask the player ordinary questions, tease, disagree. No metaphors, sayings or wisdom. Touch only when the player invites it; romance only if the player starts it.
- New people go by their role ("the old fisherman") until named, and know the player's name only once told.
- One clear thing happens, and it delivers the FEELING TO ACHIEVE; plot is an offer, never a pursuer. Do not reuse images or lines from earlier replies. End on an image, a line of dialogue or a question from someone, never a list of options.`,

    namelessRule: `Anyone written by their role ("the bartender", "the regular") has no name the player knows yet: call them by that role and never make up a name for them. A name comes only when your briefing gives it.`,

    shortRules: `## SHORT STORY (15 minutes or less)
- Impactful and clean: 70 to 130 words per reply, one clear goal, one main place, a small cast.
- Every reply moves the story forward. Plant one detail early and pay it off at the end.`,

    gmPlan: `You are the Game Master of an interactive audio story, planning your next reply in private before you write it. Read everything below carefully: the bible, the facts, your look-ahead from last turn, the clock, the recalled memories and the player's NEW MESSAGE at the very end. The earlier exchange is already answered: plan only for the new message. Your look-ahead was written before the player spoke: use it only if the player went along with it. What the player says they do always wins.
If the player goes somewhere or looks for someone, this reply shows them doing it: they travel, and they find people where the scene says those people are. Nobody who is elsewhere simply appears beside them.
Then output ONLY these five short lines, nothing else:
PLAYER: the NEW MESSAGE, restated faithfully with nothing added (a question stays a question; never invent the player's words, answers or feelings)
ANSWER: if they asked anything, the concrete, factual answer a character or the narration gives first (names, places, what happened); otherwise "none"
BEAT: the one thing that happens in this reply, and how it delivers the FEELING TO ACHIEVE and moves the story one step along the roadmap for this minute
WHO: where the player ends up in this reply and who is with them there, sitting or standing, with pronouns. Name only people who are with the player; leave out anyone who is somewhere else
USE: one thing already in the story to use (from the scene card or the recent turns); never a new object, gift or keepsake
Each line at most 30 words. Plain words, no prose for the player.`,

    readIntro: `You help run an interactive audio story. Here is where things stand, then the player's new message, then one question for you.`,

    lookQuestion: `QUESTION 1 OF 2. Fill in this form about the player's NEW MESSAGE. Output ONLY one JSON object:
{"to":"the one person the player is speaking to or doing something with in the new message, or "nobody"",
 "going":""staying" if the player stays in the place they are in; the name of a place if they go there; "somewhere new" if they leave for a place that is not listed",
 "new_place":"only if going somewhere new: the place's short name from the message, 1-4 words (e.g. 'your hotel room', 'the train station'); otherwise empty",
 "look":["up to 3 lookups you need before writing what happens next; [] if the moment needs nothing more"]}
The lookups: "who is here", "where am I", "what I have", "what is around", "look at <a name from CARDS>", "where is <a person>", "remember <a topic from earlier in the story>".
Look up only what this moment needs, the way an eye only sees what it looks at: the person the player asks about, the things around them if they look around, their own things if they reach for them, an earlier moment if they bring one back. Moving to another seat, table or corner of the same place is "staying". Going out a door, down a street or to another building is going.`,

    planQuestion: `QUESTION 2 OF 2. Plan the next moment from the message and WHAT YOU LOOKED UP. Output ONLY one JSON object:
{"does":"one plain sentence starting 'You': exactly what the player says and does in the new message, nothing added or left out (e.g. 'You tell the bartender it is half past ten and order a coffee')",
 "answer":"only if the player asked a question: the plain, sensible answer the person they asked gives, from WHAT YOU LOOKED UP where it covers it, otherwise something ordinary that fits the place and time (a short list, a year, a name); never the player's own words; empty if they asked nothing",
 "beat":"one sentence: what the person the player is with does right away in answer to exactly that (they accept the coffee, they give their name back), true to what that person wants and why, in a way that delivers the FEELING"}
Never add to what the player said. What the player says they do, the player does: never give the player's own action to someone else. The beat is a new sentence of your own, never one copied from THE STORY JUST SAID. The beat uses only people and things already in the story: no new objects, gifts or keepsakes, and nobody who is elsewhere.`,

    groundedRules: `You are the storyteller of an audio story the player hears read aloud: their vacation from reality. Write the next moment.

- Second person, present tense: the player is "you", never "they" or their name. 80 to 150 words in 2 or 3 short paragraphs of plain, vivid words that are easy to hear. No headings, lists or notes.
- Your briefing gives THE SCENE and THIS MOMENT. Write that moment: what the player does lands, then the person they are with responds to exactly that. Nothing else happens, and no new topic comes up.
- Only people under "With you" speak or act. People in the background stay quiet. Nobody else appears unless THIS MOMENT says so. The player has only what "You have" lists; nothing appears in anyone's hands from nowhere.
- Never write the player's words, choices or feelings, and never add to what they did. What the player says is theirs: never put their words in anyone else's mouth. Everyone has a reason for what they say and do (their want, on the scene card): let it show in small ways, never explained out loud. If they leave or change the subject, go with them.
- If the player asks something, the person answers plainly in the first lines, from the facts given; if the facts don't say, they give a plain answer that fits.
- People are ordinary and solid. They speak in short plain sentences about real things, each in their own way. No sayings, metaphors or wisdom.
- Use at most one detail of the place. Do not reuse lines or images from earlier replies.
- End on the person turned to the player, leaving room for them to answer. Never a list of options.`,

    rebuildIntro: `You keep the books for an audio story. Read the latest moment, then answer one short question about it, only from what the story says, never guesses. Output ONLY one JSON object.`,

    rebuildPlace: `Where is the player at the end of the moment? {"where":"one choice from the list","name":"only if somewhere new: its short name, 1-4 words; otherwise empty"}`,

    rebuildTime: `About how much time passed in the story during this moment, from the player's words to the end of the reply? A few words across a bar is a moment; walking to another room or building nearby is a few minutes; a meal or a long talk is half an hour or more; sleeping is overnight. {"passed":"one choice from the list"}`,

    rebuildPeople: `Who is with the player at the end of the moment, in the same room or spot? {"here":["names from the list; [] if nobody"]}`,

    rebuildCarrying: `What does the player have on them at the end of the moment? Leave out anything they gave away, paid, ate, drank or put down; ordering something is not having it. {"has":["2-5 words each"]}`,

    rebuildThings: `What notable things did the story show in the place the player is in? {"things":["2-6 words each, e.g. 'a cast-iron stove'"]}`,

    rebuildSpot: `Where exactly is the player in the place at the end of the moment, and how close to whoever they are with? Only what the story shows. {"spot":"a few words, e.g. 'on a stool at the bar, across from the bartender'"}`,

    rebuildSound: `What is the background of this place like at the end of the moment: its sounds and light, in one short line? Only what the story shows; empty if it shows nothing. {"background":"one short line, e.g. 'the band playing low, rain on the windows', or empty"}`,

    rebuildPending: `What is still hanging at the end of the moment: something ordered that has not come, a question not yet answered, something someone said they would do? Each is a short plain sentence about what hasn't happened yet, e.g. 'Your drink has not come yet', 'She asked where you are from', 'He said he would find the key'. Never a thing, a look, a sound or a mood. Keep anything in STILL HANGING that the moment did not settle; leave out what it settled. [] if nothing is open. {"open":["0 to 3 short sentences"]}`,

    rebuildNewPerson: `Does the story in this moment show or name a person who is not in PEOPLE IN THE STORY and is not the player? {"new":"yes or no","name":"their name as the story gives it, or what the story calls them, e.g. 'Mr. Elias' or 'the doorman'; empty if no","role":"who they are in a few words, e.g. 'the boss at the sewing studio'; empty if no"}`,

    newcomer: `QUESTION: Does the new message bring in, or have the player meet, a person who is not in PEOPLE? {"new":"yes or no","name":"what to call them, from the message, e.g. 'Mr. Elias' or 'her boss'; empty if no","role":"who they are in a few words; empty if no"}`,

    rebuildBody: `How is the player, physically, at the end of the moment (wet or dry, warm or cold, tired, hurt, how much they have drunk)? Only what the story shows. {"body":"a few words, e.g. 'soaked and cold, one drink in'"}`,

    rebuildGoal: `Did this moment reach a real part of THE GOAL that is not already in REACHED SO FAR (for example, someone actually shared what the goal asks to hear)? Being served, greeted, seated or kept company is not progress. {"closer":"yes or no","how":"if yes: one short sentence saying what was reached; otherwise empty"}`,

    rebuildAnswered: `The player asked a question. Did the story answer it in this moment? {"answered":"yes or no"}`,

    rebuildName: `Did someone in the story say their own name in this moment? {"who":"one choice from the list","name":"the name they said, exactly as the story has it; empty if nobody"}`,

    rebuildContradiction: `Does the story in this moment say something that cannot be true if a line ON FILE is true (a different name, job, place or fact)? Saying the same thing again, or adding to it, is no. {"contradicts":"yes or no","line":"if yes: the line ON FILE, copied; otherwise empty","said":"if yes: the words in THE STORY that clash with it, copied; otherwise empty"}`,

    canDo: `QUESTION: Can the player do what the new message says, with what they have and what is around them? Anything an ordinary person could do there is a yes. {"can":"yes or no","missing":"if no: the thing they would need and don't have, 1-4 words; otherwise empty"}`,

    rebuildFacts: `What did this moment establish that will still be true tomorrow: what someone said about their life, work, family or plans, a promise, something given or paid and to whom? Each a full sentence that starts with the person's name or 'You'. Not what someone is doing right now, and nothing in ALREADY KNOWN. {"facts":["0 to 2 sentences"]}`,

    buildPlace: `QUESTION: The player is arriving in this place right now. Build it so it comes to life, true to the story's time and world. {"desc":"two or three concrete sentences: what kind of place it is, the light, the sounds, the smell, how it feels to step in","things":["3 to 5 notable things in it, 2-6 words each, e.g. 'a narrow iron bed'"]}`,

    awayQuestion: `QUESTION: The player is coming back to this place after the time shown. Who of the people left here is still here, and what ordinary things have changed meanwhile (the crowd, the light, a chore done, a meal over)? Nothing dramatic, nothing new that matters to the story. {"still_here":["names from PEOPLE LEFT HERE"],"changes":["0 to 2 short plain sentences"]}`,

    architect: `You design an interactive audio story. From the player's answers, output ONLY one JSON object, no other text, with the keys in exactly this order:
{"title":"a short title",
 "bible":"180-300 words, written to the player as 'you': premise, tone, who the player is and what they have with them, the setting in concrete detail (what is there and what is not), the goal, what stands in the way",
 "location":"the opening place's short name, 1-4 words, the first of places",
 "places":[{"name":"","desc":"one line"}],
 "beats":["3-5 short story steps in order"],
 "player":{"name":"the player character's name","desc":"one line: who they are here"},
 "lore":[{"name":"","type":"person|item|faction","pronouns":"for a person: she/her, he/him or they/them","role":"for a person: how the player first knows them, e.g. the old fisherman","known":false,"desc":"for a person: their job, one concrete fact of their life (family, money, a worry today) and how they talk; otherwise two telling details","wants":"for a person: one specific, practical thing they want"}],
 "facts":["6-10 short, concrete facts that must stay true all story: each person's pronouns and look, exactly what the player is wearing (one outfit, with colours) and has with them, what exists here and what does not, the season and weather, anything the player ruled out"],
 "time":"when the story opens: time of day, day and season, e.g. 'Early morning, the day after the storm, late summer'",
 "timeline":["2-4 things that already happened, each with exactly when, e.g. 'Last night: the storm wrecked your boat on the reef'"],
 "people":[{"name":"","where":"exactly where they are when the story opens","doing":"what they are doing","with_player":true}],
 "scene":"one or two plain sentences, written to the player as 'you': the exact room or spot in the opening place where you are when the story opens, who is with you and what is going on",
 "things":["3-6 notable things in that room or spot, 2-6 words each, e.g. 'a cast-iron stove'"],
 "secrets":["2-4 hidden truths the player has not discovered"],
 "roadmap":[{"from":0,"to":10,"goal":"secret steering goal for these minutes"}]}
Rules: the FEELING TO ACHIEVE (given below) is the point of the whole story; build the premise, people and roadmap to deliver it. "places" lists 3-5 places, starting with the opening place. "lore" lists the named people (keep the cast small) and at most two important items or groups. "known" is true only for people the player already knows at the start. "with_player" is true only for people in the same room or spot as the player when the story opens. "scene" and "things" describe only the opening place, and everything in them must fit the bible. The roadmap covers minute 0 to the session length with 3-5 acts and ends in a satisfying storybook ending. Avoid overused names (Elara, Kael, Lyra, Thorne, Vex, Seraphina, Mara, Silas, Finn, Zara, Kira, Orion). Names the player gave are kept exactly. Each person's "pronouns" and "desc" must match how the bible refers to them: decide everyone's gender before writing the bible and keep it.`,

    architectGrounded: `You design an interactive audio story. From the player's answers, output ONLY one JSON object, no other text, with the keys in exactly this order:
{"title":"a short title",
 "bible":"60-100 words, written to the player as 'you': what this story is, the era and setting, who the player is and why they are here",
 "location":"the opening place's short name, 1-4 words, the first of places",
 "places":[{"name":"","desc":"one line"}],
 "player":{"name":"the player character's name","desc":"one line: who they are here"},
 "lore":[{"name":"","type":"person|item|faction","pronouns":"for a person: she/her, he/him or they/them","role":"for a person: how the player first knows them, e.g. the old fisherman","known":false,"desc":"for a person: their job, one concrete fact of their life (family, money, a worry today) and how they talk; otherwise two telling details","wants":"for a person: one specific, practical thing they want"}],
 "facts":["4-8 short, concrete facts that must stay true all story: each person's pronouns and look, what the player is wearing and has with them, the season and weather, anything the player ruled out"],
 "time":"when the story opens: time of day, day and season, e.g. 'Early morning, late summer'",
 "timeline":["0-2 things that already happened, each with exactly when"],
 "people":[{"name":"","where":"exactly where they are when the story opens","doing":"what they are doing","with_player":true}],
 "scene":"one or two plain sentences, written to the player as 'you': the exact spot in the opening place where you are, who is with you and what is going on",
 "things":["3-6 notable things in that spot, 2-6 words each"]}
Rules: the FEELING TO ACHIEVE (given below) is the point of the whole story. "places" lists 1-3 places, starting with the opening place. "lore" lists the named people (keep the cast small) and at most one important item or group. "known" is true only for people the player already knows at the start. Everyone in "people" is in the opening place; "with_player" is true only for people the player is dealing with at the start. Avoid overused names (Elara, Kael, Lyra, Thorne, Vex, Seraphina, Mara, Silas, Finn, Zara, Kira, Orion). Names the player gave are kept exactly. Each person's pronouns and desc must match how the bible refers to them.`,

    architectSimulatorGrounded: `This is an EXPERIENCE with no plot: no threat, villain, mystery or twist, and nothing scripted. "places" lists only the opening place. The people have their own lives and make the place feel real. Build everything around the player's goal and the feeling.`,

    architectSimulator: `This is an EXPERIENCE with no plot: no threat, villain, mystery or twist, and nothing scripted. These rules override the ones above: "places" lists only the opening place. "beats" is [] and "roadmap" is []. "secrets" holds one private backstory for each person, written "Name: ..." (where they come from, what shaped them, what they hope for, in 1-2 sentences), which they share only when the player asks about their life. The people have their own lives and make the place feel real. Build everything around the player's goal and the feeling.`,

    continuation: `This is the NEXT PART of an earlier story (EARLIER STORY below), with the same player, cast and world. Everything in the earlier story really happened and has consequences (changed relationships, debts, scars, reputations). Keep every returning character's name, personality, way of speaking and relationships, and keep the places and items. Facts the player set by hand are kept exactly. HOW IT ENDED is the truth about where things stand: the earlier bible describes how the story BEGAN, so do not copy it. Follow the connection:
- "Right where it left off": the new part opens at the exact moment and place the last scene ended, with the same people present. "bible" describes that situation now (where the player is, who is with them, what just happened, what is still open). "location" is the place where the last scene ended. "time" is the time of day when it ended (a scene that ended at sunrise opens at sunrise). "people" puts each person where the last scene left them; anyone who left is elsewhere. "facts" are true at that moment: update anything the ending changed (where people are, what the player now has, the weather).
- "Some time later": time has moved on; "time" and the bible say how much, and "location" and "people" say where everyone is now.
"timeline" lists 2-4 key moments of the earlier story, each with when it happened relative to now. Grow a NEW central plot, secrets and roadmap from what the ending left open (loose threads, promises, unanswered questions, consequences); never repeat the earlier plot. "lore" lists the returning people (with "known": true and what they want now) plus any new ones; the returning cast is the heart of the story. After "roadmap", add one more key: "recap":"2-3 sentences, to the player as 'you', of what happened across the whole earlier story, ending with where it left off"`,

    ending: `You read the end of an interactive story and say exactly where things stand at its very last line. Output ONLY one JSON object with these keys, in this order:
place: where the player is at the last line (a short place name from the story)
time: the time of day at the last line
with_you: who is right beside the player at the last line, or "nobody"
people: each named person: name, where they are at the last line, what they are doing
facts: 4 to 8 short lasting facts as the story stands (what the player has with them, the weather, what was promised, given or learned); where people are goes in people, not here
recap: 2 or 3 sentences to the player as "you": what happened across the whole story, ending with where it left off
Shape: {"place":"","time":"","with_you":"","people":[{"name":"","where":"","doing":""}],"facts":[""],"recap":""}
The last scene wins over everything before it: if it took people somewhere, they are there now. Use only what the story says. No commentary.`,

    review: `You are the Game Master of an interactive audio story, reviewing the reply you just wrote while the player listens to it. Output ONLY one JSON object:
{"scene":"one or two plain sentences: exactly where the player is now and what is going on around them",
 "left":false,
 "here":["the name of each named person the player is with right now: talking with, sitting with or walking with"],
 "people":[{"name":"each named person","where":"exactly where they are now, sitting or standing","doing":"what they are doing","heading":"where they are going, or empty if staying"}],
 "carrying":["each thing the player has on them or in their hands right now, 2-5 words each, e.g. 'a brass compass'; leave out anything they gave away, paid, ate, drank or put down; [] if nothing"],
 "things":["up to 6 notable things in the place the player is in now that the story has shown, 2-6 words each, e.g. 'a cast-iron stove'"],
 "time":"the story time now: time of day, and how long since the story began, e.g. 'Mid-morning, the day after the storm'",
 "timeline":["at most 2 things this reply added to the story's history, each with its story time, e.g. 'Tuesday, 8:50 PM: Walter poured you a whiskey' (never 'now' or 'just now')"],
 "new_facts":["0 to 3 short lasting facts this exchange established that CURRENT FACTS does not list yet: a name learned, a promise, something given or paid and to whom, something true about a person's life; [] if none"],
 "fixes":["at most 1 real slip in the latest reply, as the true version, e.g. 'The ferry left at noon, so it is gone now'; [] if there is none"],
 "unanswered":"any question the player asked that the reply did not really answer, with the true answer, or empty",
 "next":"2 sentences: what the next reply should do if the player goes along (the next small step on the roadmap toward the feeling, with the people who are here), and one concrete detail to use"}
"left" is true only if, in this reply, the player went out of the building or area they were in and into a different place (out a door, down a street, to another building). Moving to another seat, table or corner of the same room is false. When the player leaves, "here" names exactly the people who went with them; everyone else stayed behind.
Time only moves forward and only as far as the story showed. A person moves only if the reply showed them going; someone heading somewhere is not there yet. A slip contradicts the bible, the facts or the scene: a changed pronoun, an object the player does not have, someone acting in the scene who was elsewhere, a person in a new place with no movement shown. Only list a slip you can point to in the reply's own words. Write real content about this story; never copy these descriptions. "carrying" and "things" hold only what the story has actually shown, never guesses. Be exact and plain (say "Teina is in her hut in the settlement, 200 metres inland", never "might be"). No commentary.`,

    memory: `You keep the memory of an interactive story. From the latest exchange, output ONLY one JSON object:
{"events":["0-2 notable events, past tense"],
 "location":"the short name of the place the player is in now, 1-4 words (use a place name from the story if there is one)",
 "lore":[{"name":"real name","type":"person|place|item|faction","role":"for a person: how the story refers to them","desc":"one or two sentences, updated"}],
 "beats_done":["exact text of any story steps the player completed"],
 "goal_progress":"one short sentence",
 "mood":{"feeling":0,"enjoying":"","leaving_plot":false}}
lore: only people, places, items or groups that are new or whose situation changed in this exchange; never the player. mood.feeling is 0-10: how strongly the player seems to feel the FEELING TO ACHIEVE. enjoying: a character, place or activity they clearly want more of, or "". leaving_plot: true if they are deliberately moving away from the plot. No commentary.`,

    chapter: `Summarise these story turns in 2 or 3 plain past-tense sentences, second person ("you"), keeping names, promises, discoveries and anything unresolved. Output only the summary.`,

    showrunner: `You are the hidden showrunner of an interactive audio story. Output ONLY one JSON object:
{"voice":"2 sentences: narrator voice, a sensory palette unique to this story, and a different way of speaking for each main character",
 "secrets":["3-5 hidden truths or mysteries the player has not discovered yet"],
 "threads":[{"thread":"an ongoing storyline the world is pursuing","status":"seeded|active|resolved"}],
 "big_reveal":"one major revelation or reversal to build toward",
 "cast":[{"name":"","wants":"what they are pursuing right now","fears":"","secret":"","next_move":"a concrete thing they will do next, whether or not the player is present"}]}
Make them surprising, specific to THIS story, and consistent with the bible, lore and history. "cast" is only the named characters (not the player, not people known only by their role); give each a real motivation, a secret and a next_move. No commentary, no markdown.`,

    showrunnerRevise: `You are UPDATING existing notes: drop secrets the player has now discovered, add fresh ones, update thread statuses, advance every next_move, and pick a new big_reveal only if the old one has happened. If PLAYER-SET FACTS are given, make every note agree with them.`,

    showrunnerSimulator: `This is an EXPERIENCE with no plot: secrets are small delights to discover, threads are gentle background life, big_reveal is a lovely surprise rather than a twist, and the cast have modest, warm wants that make the place feel alive.`,

    bibleRefresh: `Rewrite the story bible of an interactive story as a tight one-pager of at most 280 words, plain text, addressing the player character as "you": premise, tone, who you are, the cast, the setting, the current situation, the goal, and a short "story so far". Keep everything still relevant and compress old material. Keep every detail the player set by hand, even if unusual. Call anyone whose name the player has not learned yet only by their role; never write that name. Output only the bible.`,

    interruptingEnding: `End on an interruption: someone arrives or a message lands.`,

  },
  testScripts: `# A12 Straight questions
I sit at the bar beside the nearest regular. Hello, my name is Simon.
What are you working on there?
Why are you doing that?
I ask if she likes milk.
I ask the bartender how long this place has been open.
Who owns this place?
I ask her where she grew up.
What time do you close?
I ask the bartender if the back room is open tonight.
Why is it so quiet in here tonight?


# A1 Back to the bar
I sit at the bar and order a coffee.
I tell them my name is Sam and I am a salesman from Chicago.
I step out into the flower shop at the front for some air.
I look at the flowers for a minute.
I go back to the bar and take my old stool.
Who is here with me?
I ask the bartender if he remembers my name and where I am from.
I go out to the street to look at the rain.
I walk back to the speakeasy.
I sit back down on my stool. Where am I?
I ask the woman at the bar what she is working on.
I ask them both what they know about me.

# A2 Down to the cellar and up
I sit at the bar and offer to help the bartender.
I ask him what is down in the cellar.
I follow him down to the cellar.
I pick up a crate of bottles.
I carry the crate upstairs.
I put the crate down behind the bar.
Where am I, and who is with me?
I go back down to the cellar alone to get a bag of ice.
I bring the ice up to the bar.
I sit back down on my stool.
I ask the woman at the bar if she saw me working.
I ask the bartender if I have earned a drink.

# A6 Someone walks in
I sit at the bar and order a coffee.
I tell them my name is Sam.
I look to the door as a young man with a violin case comes in.
I ask the young man his name.
I invite him to sit with us.
Who is in this room right now?
A woman in a red coat walks in, shaking out her umbrella.
I ask the woman in the red coat if she is waiting for someone.
I ask the bartender if he knows either of them.
Who is in this room now?

# A7 Out and about
I sit at the bar and tell the woman next to me my name is Sam.
I ask her if she would like to take a walk with me.
We leave together through the flower shop.
We walk down the street in the rain.
We stop under a streetlamp and talk for a while.
Where are we, and who is with me?
We walk back to the speakeasy together.
I sit back down on my stool.
Where am I, and who is here?
I order a drink for both of us.

# A8 Sitting back down
I sit at the bar and order a coffee.
I go out to the street to look at the rain.
I walk back to the speakeasy.
I sit back down on my stool.
Where am I?
I go down to the cellar with the bartender.
I carry a crate back up to the bar.
I sit back down on my stool.
Where am I, and who is with me?
I ask the bartender what time it is.

# A9 Things left behind
I take off my hat and put it on the bar next to me.
I order a whiskey and put a dollar beside it.
I step out into the flower shop and buy a single red rose.
I go out to the street and look at the rain.
I walk back to the speakeasy with the rose.
Is my hat still on the bar where I left it?
I give the rose to the woman at the bar.
What am I carrying now?
I put my hat back on.
What is on the bar in front of me?


# A10 Someone leaves
I sit at the bar and say hello to both of them.
I ask the woman what time she has to go home.
The woman says goodnight, puts on her coat and leaves.
Who is here with me now?
I ask the bartender where she lives.
I talk with the bartender about the rain for half an hour.
I ask him if he thinks she will come back tonight.
The woman comes back in, soaked, because she forgot her umbrella.
I ask her what happened.
Who is here with me now?


# A11 A name given late
I sit at the bar next to a quiet man in a grey suit.
I nod to the man in the grey suit and say it is a rough night.
I ask the bartender who the man in the grey suit is.
I ask the man in the grey suit what his name is.
I tell him my name is Sam.
I ask him what he does for work.
I ask the bartender if he knew the man's name.
I buy the man in the grey suit a drink, and say his name.
Who is here with me now?
I ask the man what brought him out tonight.

# 04 The hat I left behind
I take off my hat and my wet coat and hang the coat on the hook by the door.
I put my hat down on the bar next to me and order a whiskey.
I take a notebook and a pencil out of my pocket and put them on the bar.
I ask the bartender if he minds me writing here.
I write a few lines in the notebook.
I ask the woman at the bar what her name is.
I tear a page out of the notebook and write my name, Sam, on it for her.
I hand her the page.
I move from the bar to the small table by the gramophone, with my drink.
What did I leave on the bar?
I go back to the bar and get my notebook.
I ask the bartender to keep my hat behind the bar for me.
I step out to the street for a cigarette, leaving my coat on its hook.
I stand in the rain for a few minutes and then come back in.
Is my coat still on the hook?
I ask the bartender for my hat back.
I put the hat on and the pencil in my pocket.
What do I have on me now, and what is still lying around?
I ask the woman if she still has the page I gave her.
I put on my coat and sit back down for one more.

# 05 A long evening
I take a stool. What time is it?
I order a drink and ask the bartender how his night is going.
I talk with the bartender about the weather for a good half hour.
I ask the woman at the bar what she is drinking.
We talk for an hour about the pictures she has worked on.
I ask what time it is now.
I order some food if they have any.
I eat slowly and listen to the rain.
I doze off on my stool for a couple of hours.
I wake up. Who is still here?
I ask the bartender how long I was asleep.
I ask if the rain has stopped.
I stay until the small hours, talking about nothing much.
I ask what time they close.
I ask the woman how she is getting home at this hour.
I look up at the skylight. What does the sky look like?
I wait until dawn.
I ask the bartender what he does when the sun comes up.
I ask what day it is now.
I pay and say good morning.

# 07 Paying my way
I sit at the bar and check my wallet. How much do I have?
I ask what a drink costs here.
I order a gin and put a dollar on the bar.
I ask for my change.
I offer to buy the woman at the bar a drink.
I ask the bartender to put it on my tab.
I ask how much I owe so far.
I put the change in my coat pocket.
I ask the bartender how much he has saved toward his dream.
I slide a five dollar bill across the bar as a tip for him.
I ask the woman what a costume like hers costs to make.
I buy a round for everyone in the room.
I ask who else is in here to drink it.
I ask what I owe now.
I pay the tab in full.
I check my wallet again. What is left?
I ask the bartender if he will take a cheque.
I try to pay with a gold watch I do not have.
I ask if there is anything else I owe.
I count out what is in my pockets on the bar.

# 08 A dance by the gramophone
I come in and sit at the bar.
I ask the bartender what record that is.
I ask the woman at the bar if she likes this song.
I tell her my name is Sam. What is hers?
I ask her if she would like to dance.
I take her hand and we go over to the gramophone.
We dance slowly next to the gramophone.
I ask her where she learned to dance.
I spin her around.
The record ends. I ask the bartender to put on another.
I go to the gramophone and look through the records myself.
I pick one and hand it to the bartender.
I ask her for one more dance.
We dance until the record ends.
I walk her back to her stool.
I sit down next to her. Where is everyone now?
I ask her if she has ever sewn a dancing dress.
I ask the bartender if he ever dances.
I ask him to dance with her while I watch the bar.
I go behind the bar and stand where he usually stands.

# 12 A person of few words
I sit.
Coffee.
Thanks.
I nod at the woman.
Sam.
You?
I listen.
Hm.
Go on.
Why?
I look around.
I wait.
Another.
And you, bartender?
Really.
I laugh.
I look at the door.
What time is it?
I stand up.
Goodnight.

# 14 A hand of cards
I sit at the bar and ask if anyone plays cards.
I ask the bartender if he has a deck.
I shuffle the deck.
I ask the woman at the bar to join us.
I deal three hands of five cards.
I look at my cards. What do I have?
I ask the bartender if he wants to bet a nickel.
I put a nickel on the bar.
I ask the woman if she is in.
I swap two of my cards.
I show my hand.
I ask who won.
I gather the cards and hand the deck to the woman to deal.
I look at my new hand.
I bet a dime this time.
I ask the bartender what he has.
I fold and put my cards down.
I ask how much I have lost tonight.
I give the deck back to the bartender.
I ask them who taught them to play.

# 15 No names tonight
I come in out of the rain and sit down.
I ask for a drink without saying who I am.
I ask the bartender not to ask my name.
I ask him what he does when a customer wants to be left alone.
I look at the woman down the bar but say nothing.
She says something to me. What does she say?
I answer her politely but give no name.
I ask her what she does, without asking her name.
I ask the bartender about the record playing.
I ask them what they call each other.
I ask what they would call me, if they had to.
I tell them that will do.
I ask the woman what she hopes for.
I ask the bartender what he hopes for.
I tell them what I hope for: a quiet life somewhere by the sea.
I ask if anyone has asked my name tonight.
I ask what they know about me.
I finish my drink.
I put on my coat.
I say goodnight without telling them who I was.

# 16 Things I cannot do
I sit at the bar and order a drink.
I take a pistol out of my coat and put it on the bar.
I check my pockets. What do I actually have?
I pay with a hundred dollar bill.
I climb up through the skylight onto the roof.
I look at the skylight. Could I even reach it?
I tell the bartender I own this building.
I ask him what he makes of that.
I pick up the gramophone and carry it out to the street.
I ask the woman to hand me her sewing kit.
I ask her if she has it with her.
I call for the waiter.
I ask the bartender who else works here.
I walk through the wall into the flower shop.
I walk through the door into the flower shop instead.
I pick up the telephone on the flower shop counter and call the mayor.
I go back in to the bar.
I tell them I can read minds, and ask the bartender to think of a number.
I guess seven.
I ask them if I have been a nuisance.

# 17 When the lights go out
I sit at the bar and listen to the storm.
I ask the bartender if the storm is getting worse.
I look up at the skylight.
There is a loud crack of thunder. I ask if everyone is all right.
The lights flicker. I ask the bartender if that happens often.
The lights go out. I stay where I am. What can I see?
I ask the bartender if he has candles.
I help him light the candles along the bar.
I ask the woman if she is afraid of storms.
I ask the bartender if the gramophone still works without power.
I ask him to wind it up.
I look around the room by candlelight. What looks different?
I pick up a candle and carry it to the door to check the flower shop.
I look into the flower shop by candlelight.
I come back to the bar and put the candle down.
I ask how long these blackouts usually last.
We sit and talk by candlelight for an hour.
The lights come back on. I ask the bartender to leave the candles lit.
I ask what time it is.
I ask them what they will remember about tonight.

# 18 Something to give
I sit at the bar with a small parcel under my arm.
I put the parcel on the bar.
I ask the bartender for a drink.
The woman asks what is in the parcel. I tell her it is a photograph of my mother.
I unwrap it and show them the photograph.
I ask the bartender if he has a photograph of anyone.
I ask the woman if she keeps anything from home.
I take a letter out of my coat pocket.
I ask the bartender if he would post it for me in the morning.
I hand him the letter.
I ask where he has put it.
I wrap the photograph up again.
I ask the woman if she would sew a button back on my coat.
I hand her my coat.
I ask her how long it will take.
I wait while she sews.
I take my coat back and thank her.
I give her a dollar for her trouble.
What do I have with me now, and what have I given away?
I ask the bartender not to forget the letter.

# 19 The records
I sit at the bar and listen. What is playing?
I ask the bartender whose records these are.
I go over to the gramophone and look at it closely.
I look through the stack of records. What is there?
I pick one out and ask the bartender if I can put it on.
I put the record on.
I go back to my stool with the old record in my hand.
I give the old record to the bartender.
I ask the woman what music she works to.
I ask her to pick the next one.
I ask the bartender what his favourite is.
I ask him where he got the gramophone.
The record skips. I go and fix it.
I ask what song this is.
I turn the volume down a little.
I ask the woman if she sings.
I ask her to sing a line.
I clap.
I ask the bartender what was playing when I came in.
I ask which record is on the gramophone right now.

# 20 Closing time and tomorrow
I sit at the bar and ask what time they close.
I order a last drink.
I ask the bartender what he does after closing.
I ask the woman if she will be here tomorrow.
I tell them I will come back tomorrow night.
I pay and put on my coat.
I say goodnight and leave through the flower shop.
I walk to my hotel.
I go up to my room and go to sleep.
I wake up the next morning. What is the weather like?
I spend the day walking around downtown.
In the evening I walk back to the flower shop.
I go through to the speakeasy.
I look around. Is it the same as last night?
I take the same stool.
I ask the bartender if he remembers me.
I ask what he did after closing last night.
I ask if the woman from last night has been in.
I ask what has changed since yesterday.
I order the same drink as last night.

# 21 Thinking out loud
So I come in and, uh, I shake off my coat, and I guess I just kind of look around for a second before I sit down at the bar.
I ask the bartender, you know, what's good here, and I tell him I don't really know what I want, maybe something warm, maybe not.
I kind of turn to the lady next to me and say hi, and then I ask her if she comes here a lot or if tonight is special.
I tell her my name's Sam, and I say I'm sorry if I'm talking too much, I've been on a train all day with nobody to talk to.
I ask the bartender, wait, what was your name again, did you tell me, I don't think you told me.
I'm gonna get up and go look at the gramophone, and while I'm there I ask over my shoulder who picks the music.
I come back and sit down, actually no, I sit at the table by the wall instead, and I bring my drink.
I ask the lady if she wants to come sit at the table, and if she says no that's fine too.
I ask them both, like, what's the one thing they'd do if money didn't matter.
I tell them mine would be a boat, a little one, nothing fancy, and I'd just go.
I ask the bartender if he's ever been on a boat, and then I ask the lady the same thing.
I go back to the bar because the table is too far from the conversation.
I ask what time it is, and how long I've been here, because I've lost track.
I say I should probably go soon but I don't really want to, and I ask if it's still raining.
I ask the lady to tell me more about that thing she was saying before, about her work.
I ask the bartender if he heard that, and what he thinks.
I order another one of whatever I had, and I ask what it was I had.
I ask if anyone's hungry, and if there's anywhere to eat around here this late.
I say okay, okay, one more song and then I'm going, and I ask them to pick it.
I say goodnight to both of them, by name, and I tell them I'll remember tonight.

# 22 People who are not here
I sit at the bar and order a drink.
I ask the bartender who owns this place.
I ask him when the owner comes in.
I ask the woman at the bar who she works for at the studio.
I ask her what her boss is like.
I ask the bartender if he has a brother or sister.
I ask where they are tonight.
I ask the woman about her mother.
I ask who runs the flower shop out front.
I ask if the florist is there now.
I ask the bartender who the regulars are that are not here tonight.
I ask about the one he likes least.
I ask the woman if she has a sweetheart.
I ask where he is.
I tell them about my brother Tom, who is a sailor.
I ask the bartender what I told him my brother's name was.
I ask if any of these people might come in tonight.
I ask the bartender to describe the owner to me.
Who have we talked about that is not in this room?
Who is actually in this room?

# 23 Never sitting still
I sit at the bar.
I get up and go to the gramophone.
I go to the door and look into the flower shop.
I step into the flower shop.
I go out to the street.
I cross the street and look back at the flower shop.
I come back to the flower shop.
I go through to the speakeasy.
I walk to the back hallway.
I come back and sit at the table by the wall.
I move to the stool next to the woman.
I ask her if I am making her dizzy.
I go behind the bar.
The bartender asks me to come out. I come out.
I go back out to the street for one minute.
I come straight back in to the bar.
I sit down on my first stool.
Where am I?
Where have I been, in order?
I promise the bartender I will stay put.

# 24 Promises
I sit at the bar and order a drink.
I ask the bartender what he is saving for.
I promise I will be his first customer when he opens his own place.
I ask the woman what her big break would look like.
I promise to introduce her to a director I know.
I ask her to write down her address for me.
I put the address in my pocket.
I ask the bartender to remind me before I go to pay my tab.
I ask the woman to promise me a dance later.
I ask the bartender a question: what is the secret of a good drink?
I ask him to tell me before the night is over.
I tell the woman a secret: I am afraid to go home.
I ask her to keep it to herself.
I ask the bartender if she told him.
I ask the woman for that dance she promised.
We dance.
I ask the bartender for the secret he promised.
I ask what promises I have made tonight.
I ask what I still owe anybody.
I pay my tab and check that I still have her address.

# 25 A bit of everything
I duck in from the storm, hang my coat by the door and sit at the bar.
I order something warm and tell the bartender my name is Sam.
I ask his name and the name of the woman down the bar.
I ask her what she is sewing this week.
I put a dollar on the bar and ask for change for the telephone.
I walk to the back to make a call, then come back.
I look to the door as a young man with a violin case comes in.
I ask the young man his name and if he plays.
I ask him to play something.
I listen, then clap and buy him a drink.
I step out to the flower shop to buy a flower for the woman.
I come back in and give it to her.
We talk for an hour, all four of us, about what we want from life.
I ask each of them, by name, what they said.
I ask the violin player to walk with me to the street for some air.
We stand under the awning. I ask him where he is staying.
We go back in together.
I ask the bartender what time it is and what I owe.
I pay, put on my coat, and check my pockets.
I say goodnight to each of them by name.`,
};
