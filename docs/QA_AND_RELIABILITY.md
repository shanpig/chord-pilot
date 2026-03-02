# QA and Reliability Checklist

## Automated

- `npm run test` passes chord parser, progression, voicing, and API tests.
- Coverage report is generated and reviewed before release tags.

## Manual Performance Validation

1. Import a 32+ chord song via manual and ChordPro sources.
2. Trigger live play for 10 minutes with fast progression stepping.
3. Enable loop section and verify cursor never escapes section bounds.
4. Record 3 takes and verify WAV, WEBM, and MIDI exports.
5. Simulate high-latency setup by changing latency offset and confirm timing remains playable.

## Soak Test Protocol

- Keep app running for 2+ hours.
- Trigger chords every 3-5 seconds.
- Start/stop recording every 15 minutes.
- Confirm no stuck notes and memory remains stable.

## Release Gate

- No blocker parsing issues in known song corpus.
- Checkout endpoint responds in both mock and real Stripe modes.
- Onboarding steps validated on fresh browser profile.
