# Ambient Audio Lab

A free, offline-capable ambient synth and acoustic experiment lab. Native Web Audio API, no account, backend or paid dependencies.

## Features
- Seven original progressions (4–16 chords) plus **Pedal Drone** and **Microtonal Drone**.
- All chords use pitch definitions relative to a **reference frequency**, with optional arbitrary root Hz override.
- **No MIDI dependency at the synth boundary:** `scheduleFrequencies([220, 261.63, 329.63], start, duration)` takes Hz values directly.
- A steady, uninterrupted drone on supported progressions (not retriggered for each chord).
- Optional binaural **replacement** of the drone: left ear `rootHz - beatHz/2`, right ear `rootHz + beatHz/2`. Other presets disable binaural controls.
- Streaming `AudioWorklet` noise textures: white, pink, brown, grey-like and warm orange. Noise runs independently of the amplitude-modulated pads.
- AM modulation, volume controls, 60-second lookahead scheduling, media-session controls where supported, PWA and offline caching.

## Structure
- `music.js` — progression definitions and pitch resolution, no audio nodes.
- `audio-engine.js` — Web Audio synthesiser taking frequency arrays in Hz; chord scheduling, continuous drone, binaural replacement, mixer, Media Session.
- `noise-processor.js` — AudioWorklet continuous noise; random samples rather than a looped audio file.
- `app.js` — UI state and controls.
- `index.html` — standalone static UI.
- `sw.js` — offline cache.
- `manifest.webmanifest`, `icon.*` — Android install assets.

## Pitch representation

Progressions specify a root in Hz and each chord is a list of pitch definitions relative to it:

```js
const chord = [
  7,                    // seven semitones above root
  {cents: 350},         // fractional semitone / microtonality
  {ratio: 3 / 2},       // just intonation interval
  {offsetHz: 22.5},     // additive frequency offset
  {hz: 280.25}         // absolute frequency (ignores reference root)
];
```

`resolvePitch(rootHz,pitch)` in `music.js` turns these into Hz. The synth consumes only resolved Hz values. MIDI numbers are used only in a compatibility helper to preserve pitches of the original presets. Future note pickers can generate any frequencies.

The drone is a separate oscillator tied to the reference root frequency, held continuously across chord changes. It is deliberately excluded from each chord's scheduled note list. The mono drone crossfades to/from an equal-level stereo pair for binaural listening. **Headphones required.** Binaural frequencies are symmetric around the root frequency, which is their arithmetic midpoint; the frequency difference is the beat rate.

## Noise colour notes

`noise-processor.js` continuously produces new samples rather than playing a short loop. White noise has a flat input spectrum; pink and brown use filtering. “Grey” and “orange” are *creative approximations*, not standardised, measured spectral equal-loudness curves. A smoothed ~80ms colour transition prevents abrupt jumps. In browsers without AudioWorklet support, a looped pink-ish fallback is used (colour choices won't be fully available).

Noise is deliberately **not** affected by the AM depth control; AM modulates the chord pads only. This prevents the noise bed from rhythmically dipping at 1–40 Hz.

## Running and publishing

Run locally via a local webserver, not `file://`:

```sh
python -m http.server 8000
```

Visit http://localhost:8000. In GitHub **Settings → Pages**, use **Deploy from a branch → main → /(root)**. GitHub's built-in Pages deployment does the publishing; there is no custom Action workflow.

Site URL once deployed: https://t-tatsuya-w.github.io/ambientAudio/

On Android Chrome use **Install app** / **Add to Home screen**. A new service worker cache version forces offline assets to update after reloading.

## Android background playback: limitations

The PWA registers Media Session metadata and play/pause handlers and routes the Web Audio output through an HTML audio element when the browser allows. This *can* make Android show lock-screen media controls, but **it cannot guarantee background playback**: Android or Chrome may suspend the Web Audio context. The lookahead scheduler reduces JavaScript timer throttling, but does not prevent full context suspension.

If uninterrupted locked-screen audio becomes an essential requirement, a dedicated **Android app with a foreground media playback service (Media3 MediaSessionService)** is a more reliable architecture. A thin Capacitor WebView wrapper by itself is not sufficient; the synthesiser would need to run in an audio pipeline owned by the service or be provided as continuously playable audio.

## Experiments and safety

These acoustic effects are not proven focus treatments. Start at a low volume and use stereo headphones for binaural experiments. The dynamics compressor is not a hearing-safety guarantee. Browser playback and battery behaviour need real device testing.

## Potential next steps

- Blinded A/B experiment mode and CSV logs.
- Additional synthesis methods with arbitrary Hz inputs and generative atonal composition.
- Better chord voice leading, crossfade on changing progression and custom progression editing.
- A native Android foreground service for persistent background generation.
