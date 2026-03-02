# Spacechord Pro PRD (v1.0)

## Product Intent

Spacechord Pro is a web-first performance app for creators who record song covers by stepping through chord progressions in real time. The product removes theory-heavy setup and gives performers direct controls for chord triggering, progression navigation, and recording/export.

## Primary Users

- Cover artists recording short-form content.
- Livestream musicians running repeatable setlists.
- Worship teams using MIDI keyboards and foot pedals.

## Core Workflow

1. Import chord progression from raw text, ChordPro, or source URL.
2. Verify parsed chords and section map.
3. Configure style/transpose/latency profile.
4. Perform with single-key progression controls and optional loop sections.
5. Capture takes and export audio + MIDI artifacts.

## In-Scope Features (v1.0)

- Chord parser with support for common extensions and slash chords.
- Manual and ChordPro import with warnings for unparsed tokens.
- URL import through backend extraction endpoint.
- Progression engine: next/previous, jump section, section loop.
- Style voicing engine (Pop, Neo Soul, Jazz, Worship Pad).
- Recording transport with per-take export.
- Quantize and humanize processing for MIDI-like event streams.
- Latency offset controls and calibration-ready storage field.

## Out of Scope (v1.0)

- Real DAW plugin binary delivery (VST3/AU).
- Multi-user collaboration and cloud project sharing.
- Marketplace for user-generated voicing packs.

## Acceptance Criteria

- User can import and play a song progression in under 3 minutes.
- User can navigate song sections without dropping chord state.
- User can record at least one take and export both audio and MIDI artifact.
- Parser exposes warnings instead of silently dropping problematic tokens.
- API provides health, URL import, analytics, and billing checkout endpoints.

## Metrics

- Activation: first successful import + play action.
- Value: exports per active user per week.
- Reliability: zero stuck-note incidents in 2-hour soak simulation.
- Business proxy: checkout endpoint invocations from app session.
