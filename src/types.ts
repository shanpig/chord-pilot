export type SongSectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom'

export interface SongSection {
  id: string
  name: string
  type: SongSectionType
  startIndex: number
  endIndex: number
}

export interface ChordSheetToken {
  id: string
  text: string
  chordIndex?: number
}

export interface ChordSheetLine {
  id: string
  type: 'section' | 'chord' | 'lyric'
  text?: string
  sectionId?: string
  tokens?: ChordSheetToken[]
}

export interface ChordSheetParagraph {
  id: string
  lines: ChordSheetLine[]
}

export interface ChordEvent {
  id: string
  index: number
  symbol: string
  normalizedSymbol: string
  root: string
  quality: string
  extensions: string[]
  slashBass?: string
  durationBeats: number
}

export interface Song {
  id: string
  title: string
  artist?: string
  source: 'manual' | 'chordpro' | 'url'
  key: string
  tempo: number
  meter: string
  sections: SongSection[]
  chords: ChordEvent[]
  sheetParagraphs: ChordSheetParagraph[]
}

export interface PerformanceBinding {
  action:
    | 'playChord'
    | 'nextChord'
    | 'prevChord'
    | 'jumpSection'
    | 'toggleRecord'
    | 'toggleFermata'
  key?: string
  midiNote?: number
  sectionId?: string
}

export interface PerformanceSession {
  id: string
  songId: string
  currentChordIndex: number
  loopSectionId?: string
  transpose: number
  style: VoicingStyle
  latencyOffsetMs: number
}

export interface Take {
  id: string
  sessionId: string
  startedAt: number
  endedAt: number
  events: MidiLikeEvent[]
  audioBlobUrl?: string
}

export interface MidiLikeEvent {
  timestampMs: number
  type: 'on' | 'off'
  note: number
  velocity: number
}

export type VoicingStyle = 'pop' | 'neoSoul' | 'jazz' | 'worshipPad'
export type InstrumentPreset = 'expressiveSynth' | 'piano' | 'guitar'

export interface ParseResult {
  title?: string
  artist?: string
  key?: string
  tempo?: number
  sections: SongSection[]
  chords: ChordEvent[]
  sheetParagraphs: ChordSheetParagraph[]
  warnings: string[]
}
