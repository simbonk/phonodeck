# Contributing to the Phonodeck

Thanks for wanting to help. There are two ways in.

## Share an idea or report a bug (no code)

1. Make a free account at [github.com](https://github.com/signup).
2. Open [a new issue](https://github.com/simbonk/phonodeck/issues/new/choose) and pick **Idea** or **Bug**.
3. Describe it in plain words. A short example from a story you played helps a lot.

Please search the [open issues](https://github.com/simbonk/phonodeck/issues) first; if someone already asked for it, add a comment or a 👍 there instead.

## Build something yourself (code)

1. Comment on the issue you want to work on so nobody else picks it up at the same time. For a new idea, open an issue first so we can agree on it.
2. Fork the repo, make a branch, and keep the change focused on that one issue.
3. Open a pull request that says what changes for the player, before and after.

### How the code is laid out

It is a plain static web app with no build step: open `index.html` in a browser and it runs.

- `index.html` is the markup, `css/phonodeck.css` the styles.
- `js/` holds the scripts, loaded in order: `prompts.js` (all model instructions), `experiences.js` (curated experiences), `core.js`, `engine.js`, `voice.js`, `curator.js` (the set-up questions), `ui.js`.
- `api/` is the small Vercel server that lets invited guests play without their own key.

To try your change, run any static server in the folder (for example `python3 -m http.server`) and open it, or use **Try the offline demo** to look around without a key.

Never put an API key in the code or in an issue.

Every change is reviewed before it is merged, and merged changes go live on [phonodeck.vercel.app](https://phonodeck.vercel.app).
