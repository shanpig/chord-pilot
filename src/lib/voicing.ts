import { Chord, Note } from 'tonal'
import type { VoicingStyle } from '../types'

const STYLE_VELOCITY: Record<VoicingStyle, number> = {
  pop: 0.85,
  neoSoul: 0.7,
  jazz: 0.75,
  worshipPad: 0.6,
}

const STYLE_OCTAVES: Record<VoicingStyle, number[]> = {
  pop: [3, 4],
  neoSoul: [3, 4, 5],
  jazz: [2, 3, 4],
  worshipPad: [3, 4, 5],
}

function dedupePitchClasses(notes: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const note of notes) {
    const pitchClass = Note.pitchClass(note)
    if (!pitchClass || seen.has(pitchClass)) continue
    seen.add(pitchClass)
    result.push(pitchClass)
  }
  return result
}

export interface VoicedNote {
  noteName: string
  midi: number
  velocity: number
}

export function buildVoicing(
  symbol: string,
  style: VoicingStyle,
  inversion = 0,
  transposeSemitones = 0,
): VoicedNote[] {
  const parsed = Chord.get(symbol)
  if (parsed.empty || !parsed.notes.length) return []

  let pitchClasses = dedupePitchClasses(parsed.notes)
  if (pitchClasses.length === 0) return []

  const inversionOffset = ((inversion % pitchClasses.length) + pitchClasses.length) % pitchClasses.length
  if (inversionOffset > 0) {
    pitchClasses = [...pitchClasses.slice(inversionOffset), ...pitchClasses.slice(0, inversionOffset)]
  }

  const octaves = STYLE_OCTAVES[style]
  const velocity = STYLE_VELOCITY[style]
  const voiced: VoicedNote[] = []

  pitchClasses.forEach((note, idx) => {
    const octave = octaves[idx % octaves.length]
    const absoluteName = `${note}${octave}`
    const midi = Note.midi(absoluteName)
    if (midi === null) return
    voiced.push({
      noteName: absoluteName,
      midi: midi + transposeSemitones,
      velocity,
    })
  })

  return voiced.sort((a, b) => a.midi - b.midi)
}
