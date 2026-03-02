# Audio Spike: Browser vs Native Bridge

## Question

Should Spacechord Pro rely only on browser audio, or use an optional native helper for low-latency professional sessions?

## Options Compared

### Browser-only (WebAudio + AudioWorklet)

- Pros:
  - Fastest to ship and easiest onboarding.
  - No install friction and works on managed devices.
- Cons:
  - Wider latency variability across browsers and interfaces.
  - MIDI device behavior can differ by OS/browser stack.
  - Long-session reliability depends on browser lifecycle constraints.

### Web + Native Bridge

- Pros:
  - Better control over audio scheduling and MIDI device handling.
  - Lower jitter under long sessions and high CPU load.
  - Cleaner pathway to future plugin-grade engine reuse.
- Cons:
  - Added installation and update complexity.
  - Security and IPC design surface area increases.

## Decision

Use a hybrid approach:

- Default v1 runtime: browser engine for immediate usability.
- Recommended pro mode: native bridge helper for low-latency reliability.
- Keep protocol boundary stable (`playChord`, `stopAll`, `recordStart`, `recordStop`) so runtimes are swappable.

## Why This Fits v1

- Delivers a shippable web product quickly.
- Preserves plan-aligned path to professional reliability.
- Prevents lock-in to browser constraints while avoiding delayed launch.

## Success Criteria for the Spike

- Browser mode: acceptable perceived latency for casual creators.
- Bridge mode: lower jitter in sustained sessions and reduced stuck-note incidents.
- Shared control protocol validated by both modes using identical test vectors.
