import { create } from 'zustand'
import { parseChordPro } from '../lib/importers'
import { parseChordText } from '../lib/chords'
import { inferSectionForIndex, jumpToSection, nextChordIndex, prevChordIndex } from '../lib/progression'
import { buildVoicing } from '../lib/voicing'
import { AudioPerformanceEngine } from '../audio/engine'
import { renderEventsToWav } from '../audio/wavExport'
import type {
  ChordEvent,
  ChordSheetParagraph,
  InstrumentPreset,
  PerformanceBinding,
  Song,
  SongSection,
  Take,
  VoicingStyle,
} from '../types'

interface ChordPilotState {
  song: Song | null
  currentChordIndex: number
  selectedSectionId?: string
  loopSectionId?: string
  style: VoicingStyle
  instrument: InstrumentPreset
  transpose: number
  warnings: string[]
  bindings: PerformanceBinding[]
  isRecording: boolean
  takes: Take[]
  latencyOffsetMs: number
  chordHoldMs: number
  fermataEnabled: boolean
  fermataKeyHeld: boolean
  quantizeStrength: number
  humanizeMs: number
  importFromText: (text: string) => void
  importFromChordPro: (text: string) => void
  playCurrentChord: () => Promise<void>
  nextChord: () => void
  prevChord: () => void
  setCurrentChord: (index: number) => void
  jumpSection: (sectionId: string) => void
  setStyle: (style: VoicingStyle) => void
  setInstrument: (instrument: InstrumentPreset) => void
  setTranspose: (value: number) => void
  setLoopSection: (sectionId?: string) => void
  setLatencyOffsetMs: (value: number) => void
  setChordHoldMs: (value: number) => void
  toggleFermata: () => void
  setFermataKeyHeld: (value: boolean) => void
  setQuantizeStrength: (value: number) => void
  setHumanizeMs: (value: number) => void
  upsertBinding: (binding: PerformanceBinding) => void
  toggleRecording: () => Promise<void>
  exportTakeAudio: (takeId: string) => void
  exportTakeRawAudio: (takeId: string) => void
  exportTakeMidi: (takeId: string) => void
}

const engine = new AudioPerformanceEngine()

function trackEvent(name: string, payload: Record<string, unknown> = {}): void {
  if (import.meta.env.DEV) {
    console.debug('[event]', name, payload)
  }
}

function buildSong(
  chords: ChordEvent[],
  sections: SongSection[],
  sheetParagraphs: ChordSheetParagraph[],
  source: Song['source'],
): Song {
  return {
    id: crypto.randomUUID(),
    title: 'Imported Song',
    source,
    key: 'C',
    tempo: 100,
    meter: '4/4',
    sections,
    chords,
    sheetParagraphs,
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function processEvents(
  events: Take['events'],
  quantizeStrength: number,
  humanizeMs: number,
): Take['events'] {
  const gridMs = 125
  return events.map((event) => {
    const quantized = Math.round(event.timestampMs / gridMs) * gridMs
    const blended = event.timestampMs + (quantized - event.timestampMs) * quantizeStrength
    const randomOffset = humanizeMs > 0 ? (Math.random() * 2 - 1) * humanizeMs : 0
    return {
      ...event,
      timestampMs: Math.max(0, blended + randomOffset),
    }
  })
}

export const useChordPilotStore = create<ChordPilotState>((set, get) => ({
  song: null,
  currentChordIndex: 0,
  selectedSectionId: undefined,
  loopSectionId: undefined,
  style: 'pop',
  instrument: 'piano',
  transpose: 0,
  warnings: [],
  bindings: [
    { action: 'playChord', key: 'Space' },
    { action: 'nextChord', key: 'ArrowRight' },
    { action: 'prevChord', key: 'ArrowLeft' },
    { action: 'toggleRecord', key: 'KeyR' },
    { action: 'toggleFermata', key: 'KeyF' },
  ],
  isRecording: false,
  takes: [],
  latencyOffsetMs: 0,
  chordHoldMs: 1450,
  fermataEnabled: false,
  fermataKeyHeld: false,
  quantizeStrength: 0.25,
  humanizeMs: 0,
  importFromText: (text) => {
    const parsed = parseChordText(text)
    trackEvent('song_import_manual', { chordCount: parsed.chords.length })
    set({
      song: buildSong(parsed.chords, parsed.sections, parsed.sheetParagraphs, 'manual'),
      currentChordIndex: 0,
      warnings: parsed.warnings,
    })
  },
  importFromChordPro: (text) => {
    const parsed = parseChordPro(text)
    trackEvent('song_import_chordpro', { chordCount: parsed.chords.length })
    set({
      song: buildSong(parsed.chords, parsed.sections, parsed.sheetParagraphs, 'chordpro'),
      currentChordIndex: 0,
      warnings: parsed.warnings,
    })
  },
  playCurrentChord: async () => {
    const state = get()
    if (!state.song) return
    const chord = state.song.chords[state.currentChordIndex]
    if (!chord) return

    await engine.ensureStarted()
    trackEvent('play_chord', { index: state.currentChordIndex })
    const notes = buildVoicing(chord.normalizedSymbol, state.style, 0, state.transpose)
    const holdMs =
      state.fermataEnabled || state.fermataKeyHeld
        ? Math.round(state.chordHoldMs * 2.5)
        : state.chordHoldMs
    await engine.playChord(notes, {
      style: state.style,
      instrument: state.instrument,
      holdMs,
      latencyOffsetMs: state.latencyOffsetMs,
      velocityScale: 1,
    })
  },
  nextChord: () => {
    const state = get()
    if (!state.song) return
    trackEvent('next_chord', { fromIndex: state.currentChordIndex })
    const nextIndex = nextChordIndex(
      state.song.chords,
      state.currentChordIndex,
      state.song.sections,
      state.loopSectionId,
    )
    const section = inferSectionForIndex(state.song.sections, nextIndex)
    set({
      currentChordIndex: nextIndex,
      selectedSectionId: section?.id,
    })
  },
  prevChord: () => {
    const state = get()
    if (!state.song) return
    trackEvent('prev_chord', { fromIndex: state.currentChordIndex })
    const previousIndex = prevChordIndex(state.song.chords, state.currentChordIndex)
    const section = inferSectionForIndex(state.song.sections, previousIndex)
    set({
      currentChordIndex: previousIndex,
      selectedSectionId: section?.id,
    })
  },
  setCurrentChord: (index) => {
    const state = get()
    if (!state.song) return
    const bounded = Math.max(0, Math.min(index, state.song.chords.length - 1))
    const section = inferSectionForIndex(state.song.sections, bounded)
    set({
      currentChordIndex: bounded,
      selectedSectionId: section?.id,
    })
  },
  jumpSection: (sectionId) => {
    trackEvent('jump_section', { sectionId })
    const state = get()
    if (!state.song) return
    const cursor = jumpToSection(state.song.sections, sectionId, state.currentChordIndex)
    set({
      currentChordIndex: cursor.currentIndex,
      selectedSectionId: cursor.sectionId,
    })
  },
  setStyle: (style) => set({ style }),
  setInstrument: (instrument) => set({ instrument }),
  setTranspose: (transpose) => set({ transpose }),
  setLoopSection: (loopSectionId) => set({ loopSectionId }),
  setLatencyOffsetMs: (latencyOffsetMs) => set({ latencyOffsetMs }),
  setChordHoldMs: (chordHoldMs) => set({ chordHoldMs }),
  toggleFermata: () => set((state) => ({ fermataEnabled: !state.fermataEnabled })),
  setFermataKeyHeld: (fermataKeyHeld) => set({ fermataKeyHeld }),
  setQuantizeStrength: (quantizeStrength) => set({ quantizeStrength }),
  setHumanizeMs: (humanizeMs) => set({ humanizeMs }),
  upsertBinding: (binding) => {
    set((state) => {
      const next = state.bindings.filter((item) => item.action !== binding.action)
      next.push(binding)
      return { bindings: next }
    })
  },
  toggleRecording: async () => {
    const state = get()
    await engine.ensureStarted()
    if (!state.isRecording) {
      engine.startRecording()
      trackEvent('record_start')
      set({ isRecording: true })
      return
    }

    const endedAt = Date.now()
    const result = await engine.stopRecording()
    const processedEvents = processEvents(
      result.midiEvents,
      state.quantizeStrength,
      state.humanizeMs,
    )
    const take: Take = {
      id: crypto.randomUUID(),
      sessionId: state.song?.id ?? 'no-song',
      startedAt: endedAt - 1,
      endedAt,
      events: processedEvents,
      audioBlobUrl: URL.createObjectURL(result.audioBlob),
    }
    set((current) => ({
      takes: [take, ...current.takes],
      isRecording: false,
    }))
    trackEvent('record_stop', { eventCount: take.events.length })
  },
  exportTakeAudio: (takeId) => {
    const take = get().takes.find((item) => item.id === takeId)
    if (!take) return
    const wavBlob = renderEventsToWav(take.events)
    if (wavBlob.size === 0) return
    downloadBlob(wavBlob, `chordpilot-${takeId}.wav`)
  },
  exportTakeRawAudio: (takeId) => {
    const take = get().takes.find((item) => item.id === takeId)
    if (!take?.audioBlobUrl) return
    fetch(take.audioBlobUrl)
      .then((response) => response.blob())
      .then((blob) => downloadBlob(blob, `chordpilot-${takeId}.webm`))
      .catch(() => undefined)
  },
  exportTakeMidi: (takeId) => {
    const take = get().takes.find((item) => item.id === takeId)
    if (!take) return
    const content = JSON.stringify(take.events, null, 2)
    downloadBlob(new Blob([content], { type: 'application/json' }), `chordpilot-${takeId}.midi.json`)
  },
}))
