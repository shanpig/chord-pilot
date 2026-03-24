import { Chord } from 'tonal'
import { canonicalizeChordSymbol } from './chords'

type ChordFamily = 'major' | 'minor' | 'dominant' | 'maj7' | 'dim' | 'aug' | 'sus'

interface Hsl {
  h: number
  s: number
  l: number
}

export interface ChordColorTheme {
  chipBgStart: string
  chipBgEnd: string
  chipBorder: string
  chipRipple: string
  chipShadowSoft: string
  chipShadowStrong: string
  currentChordText: string
}

const NOTE_TO_PITCH_CLASS: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeNote(note: string): string {
  return note.trim().replace('♯', '#').replace('♭', 'b')
}

function getPitchClass(note?: string): number | null {
  if (!note) return null
  const normalized = normalizeNote(note)
  return NOTE_TO_PITCH_CLASS[normalized] ?? null
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const lig = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lig - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) {
    r = c
    g = x
  } else if (hue < 120) {
    r = x
    g = c
  } else if (hue < 180) {
    g = c
    b = x
  } else if (hue < 240) {
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (value: number): string => value.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

function hslToRgba(h: number, s: number, l: number, alpha: number): string {
  const [r, g, b] = hslToRgb(h, s, l)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function detectChordFamily(normalizedSymbol: string): ChordFamily {
  const lower = normalizedSymbol.toLowerCase()
  if (lower.includes('m7b5') || lower.includes('ø') || lower.includes('dim')) return 'dim'
  if (lower.includes('aug') || lower.includes('+')) return 'aug'
  if (lower.includes('sus')) return 'sus'
  if (lower.includes('maj7') || lower.includes('maj9') || lower.includes('maj13')) return 'maj7'
  if (/^([a-g](?:#|b)?)(m|min)(?!aj)/i.test(normalizedSymbol)) return 'minor'
  if (/\d/.test(lower) && !lower.includes('maj')) return 'dominant'
  return 'major'
}

function familyToBaseTone(family: ChordFamily): Pick<Hsl, 's' | 'l'> {
  switch (family) {
    case 'minor':
      return { s: 62, l: 53 }
    case 'dominant':
      return { s: 68, l: 55 }
    case 'maj7':
      return { s: 60, l: 59 }
    case 'dim':
      return { s: 48, l: 48 }
    case 'aug':
      return { s: 70, l: 54 }
    case 'sus':
      return { s: 58, l: 57 }
    case 'major':
    default:
      return { s: 66, l: 56 }
  }
}

function remapToCalmHue(hue: number): number {
  const normalized = ((hue % 360) + 360) % 360

  // Avoid the yellow-green band and remap into calmer coral/teal zones.
  if (normalized >= 70 && normalized <= 100) {
    return 38 + (normalized - 70) * 0.7
  }
  if (normalized > 100 && normalized <= 155) {
    return 170 + (normalized - 100) * 0.45
  }
  return normalized
}

function buildColorTheme(hsl: Hsl): ChordColorTheme {
  const hue = hsl.h
  const sat = hsl.s
  const lig = hsl.l
  return {
    chipBgStart: hslToHex(hue, sat + 6, lig + 10),
    chipBgEnd: hslToHex(hue, sat + 2, lig - 1),
    chipBorder: hslToHex(hue, sat + 8, lig - 8),
    chipRipple: hslToRgba(hue, sat + 10, lig - 2, 0.46),
    chipShadowSoft: hslToRgba(hue, sat + 4, lig - 3, 0.2),
    chipShadowStrong: hslToRgba(hue, sat + 8, lig - 8, 0.34),
    currentChordText: hslToHex(hue, sat + 12, lig - 22),
  }
}

export function getChordColorTheme(symbol: string): ChordColorTheme {
  const normalized = canonicalizeChordSymbol(symbol)
  const parsed = Chord.get(normalized)
  const root = parsed.tonic ?? normalized.match(/^([A-G](?:#|b)?)/)?.[1] ?? 'C'
  const pitchClass = getPitchClass(root) ?? 0
  const family = detectChordFamily(normalized)
  const baseTone = familyToBaseTone(family)

  const extensionWeight = (normalized.match(/\d+/g) ?? []).reduce((sum, token) => sum + Number(token), 0)
  const extensionShift = (extensionWeight % 7) - 3

  const bass = normalized.includes('/') ? normalized.split('/')[1] : undefined
  const bassPitchClass = getPitchClass(bass)
  const bassShift = bassPitchClass === null ? 0 : ((bassPitchClass - pitchClass + 12) % 12) * 0.75

  const rawHue = 8 + pitchClass * 30 + bassShift
  const hue = remapToCalmHue(rawHue)
  let sat = clamp(baseTone.s + extensionShift * 0.75, 46, 82)
  let lig = clamp(baseTone.l + extensionShift * 0.6, 44, 72)

  // Avoid muddy brown/olive tones (for example #bd8a2f-like colors).
  if (hue >= 28 && hue <= 56) {
    sat = Math.max(sat, 64)
    lig = Math.max(lig, 58)
  }

  return buildColorTheme({ h: hue, s: sat, l: lig })
}

export function getChordColorCssVars(symbol: string): Record<string, string> {
  const theme = getChordColorTheme(symbol)
  return {
    '--chip-bg-start': theme.chipBgStart,
    '--chip-bg-end': theme.chipBgEnd,
    '--chip-border': theme.chipBorder,
    '--chip-ripple': theme.chipRipple,
    '--chip-shadow-soft': theme.chipShadowSoft,
    '--chip-shadow-strong': theme.chipShadowStrong,
    '--current-chord-color': theme.currentChordText,
  }
}
