import type { ChordEvent, SongSection } from '../types'

export interface ProgressionCursor {
  currentIndex: number
  sectionId?: string
}

export function nextChordIndex(
  chords: ChordEvent[],
  currentIndex: number,
  sections: SongSection[],
  loopSectionId?: string,
): number {
  if (!chords.length) return 0
  if (!loopSectionId) return Math.min(currentIndex + 1, chords.length - 1)

  const section = sections.find((item) => item.id === loopSectionId)
  if (!section) return Math.min(currentIndex + 1, chords.length - 1)

  if (currentIndex >= section.endIndex) return section.startIndex
  return Math.min(currentIndex + 1, section.endIndex)
}

export function prevChordIndex(chords: ChordEvent[], currentIndex: number): number {
  if (!chords.length) return 0
  if (currentIndex <= 0) return 0
  return currentIndex - 1
}

export function jumpToSection(
  sections: SongSection[],
  targetSectionId: string,
  fallbackIndex = 0,
): ProgressionCursor {
  const section = sections.find((item) => item.id === targetSectionId)
  if (!section) {
    return {
      currentIndex: fallbackIndex,
      sectionId: undefined,
    }
  }
  return {
    currentIndex: section.startIndex,
    sectionId: section.id,
  }
}

export function inferSectionForIndex(sections: SongSection[], index: number): SongSection | undefined {
  return sections.find((section) => index >= section.startIndex && index <= section.endIndex)
}
