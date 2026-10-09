# Phonodeck

*The precursor to the holodeck.*

A single-file, AI-run text adventure powered by Google Gemini. Say how much time you have and the feeling you want, pick a curated story or a plot-free experience (or just upload a photo), and a Game Master builds a world just for you, keeps an eye on the clock, lands a real ending, and grades the result with a report card. Play by typing or hands-free by voice.

<!-- Add a screenshot here: ![Phonodeck](screenshot.png) -->

## Features
- **Play by the clock, not by turns:** choose 10 minutes to 2 hours. The app learns your pace, estimates how many replies are left, starts wrapping up about three replies from the end, and lands a storybook ending in time. Having fun? **+10 min** in the header stretches the session.
- **The feeling comes first:** describe the feeling you want to come away with in your own words (or press *Suggest some feelings*, which builds on anything you have typed). It goes into the bible and is the Game Master's main goal.
- **It notices when you're happy:** every turn the memory pass also reads your mood. When the feeling is landing or you are clearly enjoying a character or place, the plot steps aside: no interruptions, no new complications, and threats don't follow you 200 light years away. Walk away from the plot and it lets you go.
- **Two ways to play:** a *curated story* (a hidden roadmap timed to the session, which bends or waits for you) or an *experience simulator* (no plot points at all: a richly painted world, your own goal, and the feeling).
- **Personal details:** your name, gender and who you're interested in (both free text, in your own words) and your birth year live in *Settings > Personal details* and are filled in for every new experience (change them for any one story). The romance answer also picks the narrator: Sulafat if you're interested in women, Charon if men.
- **About you, and an age-appropriate story:** question 4 asks your name and age (and, for adults only, romance). A 10-year-old gets a G-rated, simple, playful story with no romance; teenagers get PG; adults get references pitched to their generation.
- **Quick start or deep set-up:** question 5 has two big buttons: Quick start shows a box to describe what you want, and Create starts the game; Deep set-up goes straight on to an optional photo and the detailed questions, whose suggestions follow your earlier answers (children get their own options).
- **Paint the world from a photo:** upload a picture and the phonodeck works out the place, the time and the people, writes a detailed description of the world, adds lore, and fills in the rest of the questions.
- **Living lore:** when something changes in play (a relationship, a location, a secret revealed), the lore entry is updated, with earlier versions kept in the World tab. It rides on the existing memory call, so it costs no extra requests.
- **Short sessions that read like short stories:** 15 minutes or less is told clean and simple (one goal, a small cast, a payoff ending), and its suggested settings stay on Earth in familiar times.
- **Same cast, new story:** after a story you love, start a sequel, a "years later", a fresh start or a prequel with the same characters and world.
- **Long-term memory:** story bible, lorebook, chapter summaries and hybrid keyword + semantic recall keep long stories consistent.
- **A plan behind the curtain:** secret roadmap, hidden GM secrets, and a "director" that varies pacing and flags repeated phrases.
- **Report card:** two grades from a discerning high school teacher: *How the Phonodeck did* (did it deliver the feeling and your goals?) and *How you did* (your own choices and play).
- **Hands-free voice:** dictation (say *make it so* to send; the phrase glows while the mic listens), Gemini narrator voice, soft background sound, and automatic cleanup of misheard words.
- **You stay in control:** edit the Story and World tabs mid-story (your edits win over earlier narration), undo a turn (memory included), watch the cost meter, save adventures as plain JSON files.

## Quick start
1. Get a Gemini API key at https://aistudio.google.com/apikey and set up billing for it (a small prepaid balance works).
2. Open the app (see below) and paste the key on the welcome screen.
3. Press **Save key and start**.

No key yet? Choose **Try the offline demo** to look around with a fake Game Master.

**Billing:** the game needs a key with billing set up. Without it Google refuses the Pro story model; the app notices (or tells you when you press **Test connection**) and falls back to the Flash model until billing is on.

### Running it
- **Hosted:** push to a GitHub repo, and enable *Settings > Pages* (deploy from the main branch). Share the link; every player brings their own key.
- **Locally:** from the folder, run `python3 -m http.server 8080` and open `http://localhost:8080/`. (Opening the file directly works, but browsers then re-ask for microphone permission every time.)

### Browsers
| Browser | Typing | Dictation | Save to folder |
|---|---|---|---|
| Chrome / Edge | yes | yes | yes |
| Safari (Mac, iPhone, iPad) | yes | yes | no (use Export / Import) |
| Firefox | yes | no | no |

**iPhone and iPad:** the Gemini narrator starts after your first tap anywhere on the page (Safari's rule for sound). When the Gemini voice is out of quota, the app falls back to Safari's own default voice; web pages can only use Apple's basic built-in voices (downloaded Enhanced or Premium voices are not available to Safari), so it sounds robotic. If Safari ever stays silent, a line asks you to tap once and the reply is read on that tap.

**Hear nothing from the device voice on iPhone or iPad? Check Silent Mode.** It mutes the device voice and the background sounds, while the Gemini voice still plays. To turn it off, swipe down from the top-right corner of the screen to open Control Center and tap the bell so it is no longer crossed out. Older iPads and iPhones may have a switch on the side instead (orange showing means silent); newer iPhones can also use the Action button. *Settings > Voice & sound > Test device voice only* checks it.

**Narrator voice quota:** by default the app makes one voice request per reply (the voice starts once the reply is written), so a daily limit such as ~100 voice requests lasts about 100 replies. *Settings > Voice & sound* trades more requests for a quicker start.

## Invite friends on your key (optional)

If the game is hosted on Vercel, you can let a few people play on your Gemini key without ever seeing it. Each person gets a link with a dollar allowance, which the game shows them as minutes. Their stories stay in their own browser; the server only counts what each call cost.

### One-time setup in Vercel

1. Open the phonodeck project in Vercel, go to **Storage**, and add a free **Upstash for Redis** database, connected to this project. It adds the storage variables by itself.
2. In **Settings > Environment Variables**, add:
   - `GEMINI_KEY`: your Gemini API key (billing set up).
   - `ADMIN_PASSWORD`: a password for the invites page.
   - `MONTHLY_CAP` (optional): the most all guests together may spend in a month, in dollars. The default is 30.
3. Redeploy (Deployments > the latest one > Redeploy).

### Adding someone

Open `/?admin` on your site and enter the admin password. Type a name and an allowance (about 10 cents buys a minute of play, so $3 is roughly 30 minutes) and press **Create invite**, then copy the link and send it. The same page shows what each guest has used, and lets you add more, pause, resume or delete an invite.

To change the Gemini key later, edit `GEMINI_KEY` in Vercel and redeploy. Invites are not affected.

### How it works

The `api` folder holds three small Vercel functions with no dependencies. `api/gemini.js` forwards a guest's calls to Google with your key and charges each call to their invite at Google's prices (listed in `api/_lib.js`). It accepts only the game's own models. `api/admin.js` runs the invites page, and `api/invite.js` tells the game how much a guest has left. A guest who adds their own key in Settings plays on that key instead.

## Privacy and cost
- There is no server. Your key and adventures live in your browser's storage (plus an optional folder you choose). The key is sent only to Google, and is never written to adventure files.
- Do not enter your key on a shared computer. Use a key with a low spending cap.
- Chrome and Edge send dictation audio to Google or Microsoft for transcription.
- You pay Google per call. The bar above the message box estimates cost per turn and per adventure (including input Google served from its cache at a discount); check the prices in *Settings > Story & cost* against your billing page.
- Built to keep costs down: the story model thinks at *Low* effort by default, the hidden plot notes and all memory work run on the cheap model, recalled memories are short excerpts, and the prompt is laid out so most of it repeats each turn and can be billed as cached input. Raise the thinking effort in *Settings > Story & cost* if you want deeper (slower, pricier) replies.

## Troubleshooting
- **"Model not found" or a 404:** preview models get renamed. Open *Settings > Connection* and press **Test connection & list models**: it lists what your key can use and switches to available models if a default is missing.
- **401 or 403:** the key was not accepted. Re-paste it.
- **429:** rate limit or daily quota. Wait, or switch the voice engine to the free browser voice.
- **Browser storage is full:** export a backup, or link a save folder in *Settings > Data*.

## License
MIT. See `LICENSE`.
