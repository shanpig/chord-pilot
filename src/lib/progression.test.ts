import { describe, expect, it } from 'vitest'
import type { ChordEvent, SongSection } from '../types'
import { jumpToSection, nextChordIndex, prevChordIndex } from './progression'

const chords = Array.from({ length: 8 }).map(
  (_, index): ChordEvent => ({
    id: String(index),
    index,
    symbol: 'C',
    normalizedSymbol: 'C',
    root: 'C',
    quality: 'major',
    extensions: [],
    durationBeats: 4,
  }),
)

const sections: SongSection[] = [
  { id: 'verse', name: 'Verse', type: 'verse', startIndex: 0, endIndex: 3 },
  { id: 'chorus', name: 'Chorus', type: 'chorus', startIndex: 4, endIndex: 7 },
]

describe('progression sequencing', () => {
  it('clamps at end by default (no wraparound)', () => {
    expect(nextChordIndex(chords, 7, sections)).toBe(7)
  })

  it('loops inside selected section', () => {
    expect(nextChordIndex(chords, 7, sections, 'chorus')).toBe(4)
  })

  it('clamps at start when going backwards', () => {
    expect(prevChordIndex(chords, 0)).toBe(0)
  })

  it('jumps section by id', () => {
    expect(jumpToSection(sections, 'chorus', 0).currentIndex).toBe(4)
  })
})
