import { describe, expect, it } from 'vitest'
import { renderEventsToWav } from './wavExport'

describe('wav export renderer', () => {
  it('renders non-empty blob from midi-like events', () => {
    const blob = renderEventsToWav([
      { timestampMs: 0, type: 'on', note: 60, velocity: 96 },
      { timestampMs: 500, type: 'off', note: 60, velocity: 0 },
    ])
    expect(blob.size).toBeGreaterThan(44)
    expect(blob.type).toBe('audio/wav')
  })
})
