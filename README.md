# Spacechord Pro Web

Spacechord Pro is a web-first chord performance and cover-recording app. It lets musicians import song progressions, trigger rich chord voicings with mapped controls, step through sections live, and export takes as WAV, WEBM, and MIDI-like event data.

## Features Implemented

- Chord import from manual text and ChordPro (frontend-only mode).
- Chord parser + normalization with warning feedback for invalid tokens.
- Progression engine with next/prev, section jump, and optional section looping.
- Voicing engine with style presets (`pop`, `neoSoul`, `jazz`, `worshipPad`) and transpose.
- Live performance controls with keyboard mapping studio.
- Recording workflow with quantize/humanize controls and take management.
- Export pipeline: WAV render from performance events, raw WEBM, and MIDI-style JSON.
- Optional API backend for advanced integrations (URL import, analytics, billing).

## Stack

- Frontend: React + TypeScript + Vite + Zustand.
- Music logic: Tonal + custom parser/progression/voicing modules.
- API: Express + TypeScript + Stripe integration (optional).
- Tests: Vitest + Supertest.

## Scripts

- `npm run dev` - run web and API in parallel.
- `npm run dev:web` - web app only.
- `npm run dev:api` - API only.
- `npm run test` - run unit/API tests with coverage.
- `npm run build` - type-check and build frontend.
- `npm run build:api` - compile backend to `dist-server`.

## Quick Start

1. Install dependencies:
   - `npm install`
2. Start app:
   - `npm run dev`
3. Open the web client and load the seed progression.
4. Press:
   - `Space` to play chord
   - `ArrowRight` for next chord
   - `ArrowLeft` for previous chord
   - `R` to start/stop recording

## Environment Variables

- `PORT` (default `4173`)
- `STRIPE_SECRET_KEY` (optional; enables real checkout sessions)

## Product and Launch Docs

- `docs/PRD.md` - product definition and acceptance criteria.
- `docs/TECH_SPIKE_AUDIO.md` - browser vs native bridge spike outcome.
- `docs/QA_AND_RELIABILITY.md` - quality, soak, and release gates.
- `docs/ONBOARDING.md` - setup and first-session runbook.
- `docs/BETA_LAUNCH.md` - beta rollout and success metrics.
