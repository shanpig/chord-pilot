import type { MidiLikeEvent } from '../types'

interface NoteState {
  midi: number
  velocity: number
  startedAtMs: number
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

function clampSample(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

export function renderEventsToWav(events: MidiLikeEvent[], sampleRate = 44100): Blob {
  if (events.length === 0) {
    return new Blob()
  }

  const durationMs = Math.max(...events.map((event) => event.timestampMs)) + 1000
  const sampleCount = Math.ceil((durationMs / 1000) * sampleRate)
  const samples = new Float32Array(sampleCount)
  const active = new Map<number, NoteState>()

  const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs)
  sorted.forEach((event) => {
    if (event.type === 'on') {
      active.set(event.note, { midi: event.note, velocity: event.velocity / 127, startedAtMs: event.timestampMs })
      return
    }

    const note = active.get(event.note)
    if (!note) return
    const startSample = Math.floor((note.startedAtMs / 1000) * sampleRate)
    const endSample = Math.floor((event.timestampMs / 1000) * sampleRate)
    const hz = 440 * Math.pow(2, (note.midi - 69) / 12)
    for (let i = startSample; i < Math.min(endSample, samples.length); i += 1) {
      const t = i / sampleRate
      samples[i] += Math.sin(2 * Math.PI * hz * t) * note.velocity * 0.2
    }
    active.delete(event.note)
  })

  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (const sample of samples) {
    view.setInt16(offset, clampSample(sample) * 32767, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
