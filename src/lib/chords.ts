import { Chord } from 'tonal'
import type { ChordEvent, ChordSheetLine, ChordSheetParagraph, ParseResult, SongSection } from '../types'

const SECTION_PATTERN = /^\s*\[(.+?)\]\s*$/
const CONTINUATION_TOKENS = new Set(['-', '–', '—'])
const CHORD_LINE_TOKEN_PATTERN = /[^|\s]+|[|\s]+/g

function createSection(id: string, name: string, startIndex: number): SongSection {
  return {
    id,
    name,
    type: normalizeSectionType(name),
    startIndex,
    endIndex: startIndex,
  }
}

function normalizeSectionType(name: string): SongSection['type'] {
  const lowered = name.toLowerCase()
  if (lowered.includes('intro')) return 'intro'
  if (lowered.includes('verse')) return 'verse'
  if (lowered.includes('chorus')) return 'chorus'
  if (lowered.includes('bridge')) return 'bridge'
  if (lowered.includes('outro')) return 'outro'
  return 'custom'
}

export function canonicalizeChordSymbol(symbol: string): string {
  return symbol
    .trim()
    .replace(/-/g, 'm')
    .replace(/Δ/g, 'maj')
    .replace(/\s+/g, '')
    .replace(/maj(\d)/g, 'maj$1')
}

export function parseChordSymbol(symbol: string, index: number): ChordEvent | null {
  const normalizedSymbol = canonicalizeChordSymbol(symbol)
  if (!normalizedSymbol) return null
  const parsed = Chord.get(normalizedSymbol)
  if (!parsed.tonic || parsed.empty) {
    return null
  }

  const slashBass = normalizedSymbol.includes('/') ? normalizedSymbol.split('/')[1] : undefined
  const quality = parsed.quality || parsed.type || 'unknown'
  const extensions = parsed.aliases[0]
    ? parsed.aliases[0].replace(/[A-G][b#]?/, '').split(/(?=\d|sus|add|alt)/).filter(Boolean)
    : []

  return {
    id: `chord-${index}`,
    index,
    symbol,
    normalizedSymbol,
    root: parsed.tonic,
    quality,
    extensions,
    slashBass,
    durationBeats: 4,
  }
}

export function parseChordText(input: string): ParseResult {
  const sections: SongSection[] = []
  const warnings: string[] = []
  const chords: ChordEvent[] = []
  const paragraphs: ChordSheetParagraph[] = [{ id: 'p-0', lines: [] }]

  const lines = input.split('\n')
  let activeSection = createSection('section-0', 'Song', 0)
  sections.push(activeSection)

  function ensureParagraph(): ChordSheetParagraph {
    if (paragraphs.length === 0) {
      const created = { id: 'p-0', lines: [] as ChordSheetLine[] }
      paragraphs.push(created)
      return created
    }
    return paragraphs[paragraphs.length - 1]
  }

  function pushParagraphIfNeeded(): void {
    const current = ensureParagraph()
    if (current.lines.length > 0) {
      paragraphs.push({
        id: `p-${paragraphs.length}`,
        lines: [],
      })
    }
  }

  function pushLine(line: ChordSheetLine): void {
    ensureParagraph().lines.push(line)
  }

  for (const [lineIndex, rawLine] of lines.entries()) {
    const line = rawLine.trim()
    if (!line) {
      pushParagraphIfNeeded()
      continue
    }
    const sectionMatch = line.match(SECTION_PATTERN)
    if (sectionMatch) {
      pushParagraphIfNeeded()
      activeSection.endIndex = Math.max(activeSection.endIndex, chords.length - 1)
      activeSection = createSection(
        `section-${sections.length}`,
        sectionMatch[1],
        Math.max(chords.length, 0),
      )
      sections.push(activeSection)
      pushLine({
        id: `line-${lineIndex}`,
        type: 'section',
        text: sectionMatch[1],
        sectionId: activeSection.id,
      })
      continue
    }

    const rawTokens = rawLine.match(CHORD_LINE_TOKEN_PATTERN) ?? []
    const tokenParts = rawTokens.map((token) => {
      const trimmed = token.trim()
      const isSpacer = trimmed.length === 0 || trimmed === '|'
      const isContinuation = CONTINUATION_TOKENS.has(trimmed)
      const parsed = !isSpacer && !isContinuation ? parseChordSymbol(trimmed, 0) : null
      return {
        raw: token,
        token: trimmed,
        isSpacer,
        isContinuation,
        parsed,
      }
    })

    const candidateTokens = tokenParts.filter((part) => !part.isSpacer)
    const parsedCount = candidateTokens.filter((candidate) => candidate.parsed !== null || candidate.isContinuation).length
    const isChordLine = parsedCount > 0 && parsedCount / Math.max(1, candidateTokens.length) >= 0.5

    if (!isChordLine) {
      pushLine({
        id: `line-${lineIndex}`,
        type: 'lyric',
        text: rawLine.trim(),
      })
      continue
    }

    const lineTokens: ChordSheetLine['tokens'] = []
    for (const part of tokenParts) {
      if (part.isSpacer) {
        lineTokens?.push({
          id: `line-${lineIndex}-token-${lineTokens.length}`,
          text: part.raw,
        })
        continue
      }

      if (part.isContinuation) {
        lineTokens?.push({
          id: `line-${lineIndex}-token-${lineTokens.length}`,
          text: part.token,
        })
        continue
      }

      const parsed = parseChordSymbol(part.token, chords.length)
      if (!parsed) {
        warnings.push(`Could not parse chord token: "${part.token}"`)
        lineTokens?.push({
          id: `line-${lineIndex}-token-${lineTokens.length}`,
          text: part.token,
        })
        continue
      }
      chords.push(parsed)
      lineTokens?.push({
        id: `line-${lineIndex}-token-${lineTokens.length}`,
        text: parsed.normalizedSymbol,
        chordIndex: parsed.index,
      })
    }

    pushLine({
      id: `line-${lineIndex}`,
      type: 'chord',
      tokens: lineTokens,
    })
  }

  if (chords.length === 0) {
    warnings.push('No chords were parsed. Add space-separated symbols such as "C G Am F".')
  }

  activeSection.endIndex = Math.max(chords.length - 1, activeSection.startIndex)
  const sheetParagraphs = paragraphs.filter((paragraph) => paragraph.lines.length > 0)

  return {
    sections,
    chords,
    sheetParagraphs,
    warnings,
  }
}

export function transposeChordSymbol(symbol: string, semitones: number): string {
  const chord = Chord.get(canonicalizeChordSymbol(symbol))
  if (!chord.tonic || chord.empty) return symbol
  const transposed = Chord.transpose(chord.symbol, `${semitones}m`)
  return transposed || symbol
}
