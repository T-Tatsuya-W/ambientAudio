# Ambient Audio Lab

Free, offline-capable generative ambient synthesiser and acoustic modulation playground, built with the **native Web Audio API**. No backend or external dependencies.

## Demo

- Seven chord progressions: three 4-chord presets, two 8-chord presets, one 12-chord preset and one 16-chord preset, with duration and chord names displayed
- Synthetic pink-ish noise, filter brightness and slow motion
- Adjustable amplitude modulation (1–40 Hz, 0–100% depth)
- Optional independent binaural tones with stereo separation (headphones required)
- Bypass, master volume, basic compressor, and locally saved settings
- Pause/resume/stop, Media Session lock-screen metadata and play/pause actions where supported
- Lookahead scheduler (90 seconds of AudioContext-timed notes) to reduce JavaScript background throttling interruptions
- Seam-smoothed noise loop to reduce periodic clicking
- Mobile-friendly UI, PWA manifest, offline service worker

This is an experimental audio playground, **not** a scientifically verified treatment or a reproduction of Brain.fm's proprietary algorithm.

## Local run

```bash
python -m http.server 8000
```

Open http://localhost:8000 and tap **Start audio**. Browser audio must be activated by user interaction.

## Publish with GitHub Pages

1. Visit **Settings → Pages** and set **Build and deployment → Source: GitHub Actions**.
2. Make sure the repository's visibility and your GitHub plan support Pages. This repository was **private** at the time of the first commit; you may need to make it public.
3. The supplied workflow builds nothing and deploys the static files on pushes to `main`.
4. Once GitHub Pages completes, open https://t-tatsuya-w.github.io/ambientAudio/
5. On Android Chrome, use the browser menu → **Install app** / **Add to Home screen**.

After an initial successful load, the service worker caches the app for offline use. Audio playback while the phone is locked may still be stopped by Android/browser power management. The app tries to expose Android media controls using the Media Session API and an HTML audio element fed by Web Audio; this is browser-dependent and cannot guarantee uninterrupted locked-screen playback.

## Signal processing notes

The AM oscillator controls the ambient gain around `1 - depth/2` with amplitude `depth/2`, maintaining a nonnegative envelope. The binaural layer separately generates carrier and carrier+beat tones on left/right channels. They are different effects: the binaural layer isn't applied to existing music. Use stereo headphones for binaural listening.

Audio is generated locally. Only user settings are stored in localStorage. There are no telemetry or network audio requests.

## Playback diagnosis

There is **no intentionally configured session time limit**. The original version scheduled chords with a JavaScript timeout; Android can throttle that in the background. This version schedules chords 90 seconds ahead on the Web Audio clock. A true AudioContext suspension will still stop sound; reopen the app and tap Resume if that occurs. The short noise buffer previously looped without matching its first and last samples, another possible source of periodic clicks.

## Possible next iterations

- Musical arpeggios, plucks, and richer chord transitions
- Pulse shaping and other modulation waveforms
- Controlled A/B or blinded experiments, session timer and CSV logging
- Level-matched comparison, analyser and spectrum display
- More reliable background audio testing on Android

## Files

```
index.html                   # UI and Web Audio synthesis
manifest.webmanifest         # Installation metadata
sw.js                        # Offline caching
icon.svg, icon-*.png         # PWA icons
.github/workflows/pages.yml  # GitHub Pages publishing
```
