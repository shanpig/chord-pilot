import type { ParseResult } from '../types'
import { parseChordText } from './chords'

const CHORDPRO_LINE = /\[([^\]]+)\]/g

export function parseChordPro(input: string): ParseResult {
  const extracted: string[] = []
  const lines = input.split('\n')
  let lineBuffer: string[] = []

  for (const line of lines) {
    if (line.startsWith('{title:')) {
      continue
    }
    if (line.startsWith('{')) {
      continue
    }
    const matches = [...line.matchAll(CHORDPRO_LINE)]
    if (matches.length > 0) {
      lineBuffer = matches.map((match) => match[1].trim()).filter(Boolean)
      extracted.push(lineBuffer.join(' '))
      lineBuffer = []
    }
  }

  return parseChordText(extracted.join('\n'))
}

export async function parseChordsFromUrl(url: string): Promise<ParseResult> {
  const response = await fetch('/api/import/url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  })

  if (!response.ok) {
    throw new Error(`Import failed (${response.status})`)
  }

  return (await response.json()) as ParseResult
}
