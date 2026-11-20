# Pixie

A friendly, sweet and cute anime desktop companion for Windows, animated from your original artwork. She wakes up when you open the app, moves her mouth
when she talks, reacts to your gestures and expressions through the webcam, listens for **"Hello Pixie"**, and runs
agentic tasks on your PC: clicking buttons (after highlighting them and asking), typing where your cursor is,
opening apps and sites, searching, scrolling, timers, notes and more. Minimize the window and she becomes a
dynamic island at the top-centre of the screen.

## Get the Windows installer (no local setup)

1. Create a GitHub repository and upload everything in this folder.
2. Push a tag: `git tag v1.0.0 && git push origin v1.0.0`. The **Build Windows installer** workflow builds
   `Pixie-Setup-1.0.0.exe` and attaches it to a GitHub Release. Or use Actions ▸ *Run workflow* and download the artifact.
3. Run the installer. SmartScreen may warn because the app is not code-signed: *More info ▸ Run anyway*.

Free for public repositories (and within the free monthly allowance for private ones).

## First-run setup (30 seconds)

Pixie works offline for built-in commands and the chat box. For her **ears and brain**, add one free key:
Settings ▸ **AI providers** ▸ **Groq Cloud** ▸ paste a key from console.groq.com. The default routing already uses it for chat,
agent tasks, vision and speech recognition (Whisper), so "Hello Pixie" starts working immediately.

## Dashboard

Only: the settings gear (top right), Pixie with her animated halo, a cherry-blossom petal background (petals only, no tree), a 2 cm camera preview
(bottom left) and the **Ask Pixie** chat box (bottom). Replies appear as a speech bubble above the chat box.

## Her animation (original art)

Pixie is animated from the original illustrations only. Each of her 44 emotions combines one of your 13 drawings with its own
motion (bounce, shiver, sob, tilt, nod, float…), props (❓ 💡 💢 ⚙️ ✅), particles (hearts, tears, steam, Zzz, confetti), and a tint. She switches to
*listening*, *working*, *success* or *oops* as she hears you and runs tasks. While talking she swaps between the open-mouth and
closed-mouth drawings in time with her voice (with a small squash-and-stretch). Idle, she looks around, hums, and sometimes yawns on her own.

## Minimized (dynamic island)

A slim pill at the top-centre: her face, one short line, and a mic dot. Hover to type a request or tap Yes/No. Replies are kept to a few words,
and the full agent (speech recognition, clicking, typing, searching…) keeps working.

## Talking to her

- Say **"Hello Pixie"** (no clicking). She stays listening ~20 s after each exchange. Mic dot: green = listening, pink = awake.
- Or type in the chat box. Hold a fist to wake her instantly.
- Screen control: *"click the send button"* → she highlights it and asks **"Use this button?"**. Say yes (or 👍, a nod, or tap Yes). *"No"* shows the next match.
- Writing: *"type hello world"* or *"write an email to my boss saying I'm late"* (AI) → she highlights your text box and asks before typing at the cursor.

### Agent tasks

Local (no AI needed): open apps/sites · web search · YouTube · click a button by name · type at the cursor · keyboard shortcuts
(copy, paste, undo, ctrl+…) · scroll · timers/reminders · notes (Documents/Pixie) · calculator · open folders · volume/media ·
screenshot · minimize all · lock · battery · clipboard · focus timer.
With an AI key: compose & write · summarize / translate / rewrite your selected text · describe your screen · free-form requests
(she can chain up to 4 actions) · chat with memory.

## Settings

Character & listening (speech language, friendly check-ins) · **Voice (Google TTS)** with 5 cute voices (Mochi, Bubbles, Candy, Berry, Sprinkle), free or Cloud mode · AI providers
& keys · **Task routing** with primary, fallback and fallback 2 per task · **Gesture bindings & recorder** (wink → open Spotify;
record your own gestures with 3-sample DTW) · **Face ID** · **Macros** · **Spatial HUD & performance** · Test lab (all 44 emotions) ·
Studio view (wide two-column layout).

Windows system voices are not used. If Google TTS is unreachable she stays silent (lips still move, text still shows).

## Honest notes

- Screen control, typing and shortcuts use Windows UI Automation and SendKeys through PowerShell. They were written to Windows
  APIs but **could not be run in the Linux build sandbox**; test on Windows and report oddities. Apps that expose no accessibility
  tree (some games, custom-drawn UIs) cannot be clicked by name.
- "Google voice (free)" uses Google Translate's unofficial endpoint: no key, but it can change or rate-limit. For stable quality use Cloud TTS.
- Speech accuracy: audio is cleaned (rumble filter + level normalisation), Whisper gets vocabulary hints (your name, app names, your macros), low-confidence/hallucinated segments are dropped, and a second, larger Whisper model is the fallback. Choose your speech language (or Auto) in settings.
- Always-on listening sends short speech clips to your STT provider (Groq free tier has rate limits). Nothing is sent while idle/silent.
- Camera frames stay on your PC. Face ID is a convenience greeting, not security.
- Latency depends on your hardware; vision runs in a background worker with zero-copy frame transfer and falls back to the main thread automatically.

## Develop

```
npm install   # copies MediaPipe and downloads the two vision models
npm start
npm run dist  # Windows installer in dist/
```

## What's new

- **Faster voice**: TTS cache + parallel prefetch, short first chunk, gapless playback, quick VAD; a short "Mm-hm!" filler and thinking dots cover LLM latency.
- **Live character**: continuous breathing/sway/nod animation (also while speaking), a drawn real-time mouth driven by the audio (visemes), crossfades between emotions.
- **Gloves** instead of a skeleton for tracked hands; faster adaptive hand/face tracking in a worker.
- **Providers**: NVIDIA NIM preset (`https://integrate.api.nvidia.com/v1`, key from build.nvidia.com) with a *Fetch models* button.
- **Chat sidebar** (top-left): New chat, Chat, searchable history with rename/delete.
- **Agent speed (Windows)**: persistent PowerShell host, cached UI Automation scan, Invoke-pattern clicks, window focus/maximize/minimize/close.

## Android APK

Push to GitHub; the **Build Android APK** workflow (`.github/workflows/android.yml`) produces `Pixie-debug.apk` as a build artifact (and attaches it to releases on `v*` tags).
Locally: `npm install && npm run mobile:www && npx cap add android && node scripts/patch-android.js && npx cap sync android`, then open `android/` in Android Studio.
Limitations on phone: no system-wide floating island and no desktop UI automation (click/scroll/keys); everything else (voice, tracking, character, chat, touch) works.
