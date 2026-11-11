# Phonodeck engine file

`engine.js` is the story engine the iOS app downloads from https://phonodeck.vercel.app/engine
(Settings > Game Master > Engine file). The app runs it in JavaScriptCore, the phone's built-in
JavaScript, with no network or file access.

- It defines one object, `PhonodeckEngine`, with `version`, `build`, `notes`, `prompts` and `testScripts`.
- A prompt left out keeps the app's built-in text, so a file can hold only what is being tuned.
- The app downloads only when the player taps "Check for a new version", and a download never
  replaces the engine in use. Each download that differs from the last is kept as a new version
  (V1, V2, ...), and
  the Engine file screen can roll back to any of them, or to the engine built into the app.
- Bump `version` whenever you change something.

Anyone can host their own engine file and point the app's address at it.
