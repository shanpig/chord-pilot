import { describe, expect, it } from 'vitest'
import { buildVoicing } from './voicing'

describe('voicing engine', () => {
  it('generates notes for major7 chords', () => {
    const notes = buildVoicing('Cmaj7', 'pop')
    expect(notes.length).toBeGreaterThan(2)
    expect(notes[0].midi).toBeLessThan(notes[notes.length - 1].midi)
  })

  it('applies transpose and inversion', () => {
    const rootPosition = buildVoicing('Dm7', 'jazz', 0, 0)
    const transposed = buildVoicing('Dm7', 'jazz', 1, 2)
    expect(transposed[0].midi).toBeGreaterThan(rootPosition[0].midi)
  })
})
