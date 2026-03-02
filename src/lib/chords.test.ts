import { describe, expect, it } from 'vitest'
import { canonicalizeChordSymbol, parseChordSymbol, parseChordText } from './chords'

describe('chords parser', () => {
  it('canonicalizes common chord variants', () => {
    expect(canonicalizeChordSymbol('A-7')).toBe('Am7')
    expect(canonicalizeChordSymbol('CΔ7')).toBe('Cmaj7')
  })

  it('parses a valid chord symbol', () => {
    const chord = parseChordSymbol('F#m7', 2)
    expect(chord?.root).toBe('F#')
    expect(chord?.index).toBe(2)
  })

  it('builds sections and warnings from free text', () => {
    const result = parseChordText('[Verse]\nC G badToken F\n[Chorus]\nAm F G C')
    expect(result.chords).toHaveLength(7)
    expect(result.sections.length).toBeGreaterThan(1)
    expect(result.warnings.some((item) => item.includes('badToken'))).toBe(true)
  })

  it('keeps paragraph and lyric structure for chord sheet rendering', () => {
    const result = parseChordText('[Verse]\nC G Am F\nAmazing grace how sweet the sound\n\n[Chorus]\nF C Dm Bb')
    expect(result.sheetParagraphs.length).toBeGreaterThan(1)
    expect(result.sheetParagraphs[0].lines.some((line) => line.type === 'lyric')).toBe(true)
    expect(result.sheetParagraphs[0].lines.some((line) => line.type === 'chord')).toBe(true)
  })

  it('assigns unique sequential chord indices within one chord line', () => {
    const result = parseChordText('C G Am F')
    const chordLine = result.sheetParagraphs[0]?.lines.find((line) => line.type === 'chord')
    const indices = chordLine?.tokens?.map((token) => token.chordIndex).filter((item) => item !== undefined)
    expect(indices).toEqual([0, 1, 2, 3])
  })

  it('does not warn for continuation marker token "-"', () => {
    const result = parseChordText('[Verse]\nC - G -\nlyric line')
    expect(result.warnings.some((warning) => warning.includes('"-"'))).toBe(false)
  })
})
