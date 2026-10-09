# Contributing to the Phonodeck

Thanks for wanting to help. There are two ways in.

## Share an idea or report a bug (no code)

1. Make a free account at [github.com](https://github.com/signup).
2. Open [a new issue](https://github.com/simbonk/phonodeck/issues/new/choose) and pick **Idea** or **Bug**.
3. Describe it in plain words. A short example from a story you played helps a lot.

Please search the [open issues](https://github.com/simbonk/phonodeck/issues) first; if someone already asked for it, add a comment or a 👍 there instead.

## Build something yourself (code)

1. **Start from an issue.** If the idea is already in the [issues](https://github.com/simbonk/phonodeck/issues), comment "I'd like to work on this" so nobody else picks it up at the same time. If it's a new idea, open a new issue first and wait for a go-ahead, so you don't build something that won't be merged.
2. **Fork and branch.** Press **Fork** on the repo page to get your own copy, then make a branch there and keep the change focused on that one issue.
3. **Open a pull request.** From your fork, open a pull request back to this repo and link the issue (write "Fixes #12", for example). Say what changes for the player, before and after.
4. **Review.** The change is tested and reviewed, and you may get questions or small fix requests on the pull request. Nothing goes live until it is merged.
5. **Merge.** Once it's approved and merged, it goes live on [phonodeck.vercel.app](https://phonodeck.vercel.app) within a few minutes.

### How the code is laid out

It is a plain static web app with no build step: open `index.html` in a browser and it runs.

- `index.html` is the markup, `css/phonodeck.css` the styles.
- `js/` holds the scripts, loaded in order: `prompts.js` (all model instructions), `experiences.js` (curated experiences), `core.js`, `engine.js`, `voice.js`, `curator.js` (the set-up questions), `ui.js`.
- `api/` is the small Vercel server that lets invited guests play without their own key.

To try your change, run any static server in the folder (for example `python3 -m http.server`) and open it, or use **Try the offline demo** to look around without a key.

Never put an API key in the code or in an issue.
