# Onboarding Runbook

## Local Setup

1. Install Node.js 20.19+ (recommended) and npm.
2. Run `npm install`.
3. Run `npm run dev` to start web + API.

## First Session Checklist

1. Open app and confirm health by importing seed progression.
2. Press `Space` to trigger current chord.
3. Press `ArrowRight` and `ArrowLeft` for progression navigation.
4. Click `Record`, perform for 10 seconds, stop recording.
5. Export WAV and MIDI take assets.

## Controller Mapping

- Use Mapping Studio to bind custom keyboard keys.
- For foot pedal integrations, map the pedal keycode to `nextChord`.
- Save bindings as profile in browser local state (future cloud profile support planned).

## Environment Variables

- `PORT`: API port (default `4173`).
- `STRIPE_SECRET_KEY`: optional; enables real checkout creation.

## Troubleshooting

- No sound: click any button once to unlock browser audio context.
- URL import fails: target source may block scraping; use manual paste fallback.
- Drift concerns: increase latency offset and reduce browser CPU contention.
