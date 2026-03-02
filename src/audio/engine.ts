import type { MidiLikeEvent } from '../types'
import type { InstrumentPreset, VoicingStyle } from '../types'

interface ActiveNote {
  midi: number
  stop: (releaseSeconds: number) => void
  gainNode: GainNode
  filter: BiquadFilterNode
}

interface StyleProfile {
  waveA: OscillatorType
  waveB: OscillatorType
  detuneCents: number
  attack: number
  decay: number
  sustain: number
  release: number
  filterHz: number
  strumMs: number
  width: number
}

interface PlayChordOptions {
  style: VoicingStyle
  instrument: InstrumentPreset
  holdMs: number
  velocityScale?: number
  latencyOffsetMs?: number
}

const STYLE_PROFILE: Record<VoicingStyle, StyleProfile> = {
  pop: {
    waveA: 'triangle',
    waveB: 'sawtooth',
    detuneCents: 5,
    attack: 0.008,
    decay: 0.16,
    sustain: 0.68,
    release: 0.38,
    filterHz: 2900,
    strumMs: 8,
    width: 0.45,
  },
  neoSoul: {
    waveA: 'triangle',
    waveB: 'sine',
    detuneCents: 3,
    attack: 0.02,
    decay: 0.22,
    sustain: 0.64,
    release: 0.55,
    filterHz: 2100,
    strumMs: 18,
    width: 0.35,
  },
  jazz: {
    waveA: 'triangle',
    waveB: 'square',
    detuneCents: 2,
    attack: 0.012,
    decay: 0.2,
    sustain: 0.62,
    release: 0.48,
    filterHz: 1700,
    strumMs: 14,
    width: 0.3,
  },
  worshipPad: {
    waveA: 'sine',
    waveB: 'triangle',
    detuneCents: 9,
    attack: 0.08,
    decay: 0.35,
    sustain: 0.85,
    release: 0.95,
    filterHz: 1400,
    strumMs: 22,
    width: 0.5,
  },
}

export class AudioPerformanceEngine {
  private audioContext: AudioContext
  private masterGain: GainNode
  private mediaDestination: MediaStreamAudioDestinationNode
  private compressor: DynamicsCompressorNode
  private dryBus: GainNode
  private reverbBus: GainNode
  private convolver: ConvolverNode
  private activeNotes = new Map<string, ActiveNote>()
  private sampleBuffers = new Map<InstrumentPreset, Map<string, AudioBuffer>>()
  private sampleLoaders = new Map<InstrumentPreset, Promise<void>>()
  private recorder?: MediaRecorder
  private recordedChunks: Blob[] = []
  private midiEvents: MidiLikeEvent[] = []
  private recordingStartTimeMs = 0

  constructor() {
    this.audioContext = new AudioContext()
    this.compressor = this.audioContext.createDynamicsCompressor()
    this.compressor.threshold.value = -16
    this.compressor.knee.value = 20
    this.compressor.ratio.value = 3.2
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.28

    this.masterGain = this.audioContext.createGain()
    this.masterGain.gain.value = 0.78
    this.dryBus = this.audioContext.createGain()
    this.dryBus.gain.value = 0.86
    this.reverbBus = this.audioContext.createGain()
    this.reverbBus.gain.value = 0.2
    this.convolver = this.audioContext.createConvolver()
    this.convolver.buffer = this.createImpulseResponse(1.7, 2.3)
    this.mediaDestination = this.audioContext.createMediaStreamDestination()

    this.dryBus.connect(this.compressor)
    this.reverbBus.connect(this.convolver)
    this.convolver.connect(this.compressor)
    this.compressor.connect(this.masterGain)
    this.masterGain.connect(this.audioContext.destination)
    this.masterGain.connect(this.mediaDestination)
  }

  async ensureStarted(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  async playChord(
    notes: Array<{ midi: number; velocity: number }>,
    options: PlayChordOptions,
  ): Promise<void> {
    const profile = STYLE_PROFILE[options.style]
    const holdMs = Math.max(250, options.holdMs + (options.latencyOffsetMs ?? 0))
    const velocityScale = options.velocityScale ?? 1
    const sorted = [...notes].sort((a, b) => a.midi - b.midi)
    const useSampler = options.instrument === 'piano' || options.instrument === 'guitar'

    if (useSampler) {
      await this.ensureSamplesLoaded(options.instrument)
    }

    sorted.forEach((note, idx) => {
      let voiceId: string | null = null
      const strumDelay = idx * profile.strumMs + Math.random() * 4
      const velocity = Math.min(1, note.velocity * velocityScale * (0.95 + Math.random() * 0.08))
      window.setTimeout(() => {
        if (useSampler) {
          voiceId = this.noteOnSample(note.midi, velocity, profile, options.instrument, idx, sorted.length)
        } else {
          voiceId = this.noteOn(note.midi, velocity, profile, idx, sorted.length)
        }
      }, strumDelay)
      window.setTimeout(() => {
        if (voiceId) {
          this.stopVoice(voiceId, profile.release)
        }
      }, strumDelay + holdMs)
    })
  }

  noteOn(
    midi: number,
    velocity = 0.8,
    profile: StyleProfile = STYLE_PROFILE.pop,
    noteIndex = 0,
    noteCount = 1,
  ): string {
    const hz = 440 * Math.pow(2, (midi - 69) / 12)
    const oscillatorA = this.audioContext.createOscillator()
    const oscillatorB = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    const filter = this.audioContext.createBiquadFilter()
    const panner = this.audioContext.createStereoPanner()

    oscillatorA.type = profile.waveA
    oscillatorB.type = profile.waveB
    oscillatorA.frequency.value = hz
    oscillatorB.frequency.value = hz
    oscillatorA.detune.value = -profile.detuneCents
    oscillatorB.detune.value = profile.detuneCents

    filter.type = 'lowpass'
    filter.frequency.value = profile.filterHz
    filter.Q.value = 0.85

    const spread = noteCount > 1 ? noteIndex / (noteCount - 1) : 0.5
    panner.pan.value = (spread * 2 - 1) * profile.width

    const now = this.audioContext.currentTime
    gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(velocity, now + profile.attack)
    gainNode.gain.linearRampToValueAtTime(velocity * profile.sustain, now + profile.attack + profile.decay)

    oscillatorA.connect(filter)
    oscillatorB.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(panner)
    panner.connect(this.dryBus)
    panner.connect(this.reverbBus)

    oscillatorA.start()
    oscillatorB.start()

    const voiceId = this.createVoiceId(midi)
    let stopped = false
    this.activeNotes.set(voiceId, {
      midi,
      gainNode,
      filter,
      stop: (releaseSeconds) => {
        if (stopped) return
        stopped = true
        const localNow = this.audioContext.currentTime
        gainNode.gain.cancelScheduledValues(localNow)
        gainNode.gain.setTargetAtTime(0.0001, localNow, Math.max(0.04, releaseSeconds * 0.33))
        filter.frequency.cancelScheduledValues(localNow)
        filter.frequency.linearRampToValueAtTime(Math.max(600, filter.frequency.value * 0.7), localNow + 0.08)
        try {
          oscillatorA.stop(localNow + releaseSeconds + 0.04)
          oscillatorB.stop(localNow + releaseSeconds + 0.04)
        } catch {
          // Already stopped; safe to ignore.
        }
      },
    })
    this.captureEvent('on', midi, Math.round(velocity * 127))
    return voiceId
  }

  stopVoice(voiceId: string, releaseSeconds = 0.35): void {
    const active = this.activeNotes.get(voiceId)
    if (!active) return
    active.stop(releaseSeconds)
    this.activeNotes.delete(voiceId)
    this.captureEvent('off', active.midi, 0)
  }

  stopAll(): void {
    for (const voiceId of this.activeNotes.keys()) {
      this.stopVoice(voiceId)
    }
  }

  startRecording(): void {
    this.recordedChunks = []
    this.midiEvents = []
    this.recordingStartTimeMs = performance.now()
    this.recorder = new MediaRecorder(this.mediaDestination.stream, { mimeType: 'audio/webm' })
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }
    this.recorder.start()
  }

  async stopRecording(): Promise<{ audioBlob: Blob; midiEvents: MidiLikeEvent[] }> {
    if (!this.recorder) {
      return {
        audioBlob: new Blob(),
        midiEvents: this.midiEvents,
      }
    }

    await new Promise<void>((resolve) => {
      this.recorder?.addEventListener('stop', () => resolve(), { once: true })
      this.recorder?.stop()
    })

    return {
      audioBlob: new Blob(this.recordedChunks, { type: 'audio/webm' }),
      midiEvents: [...this.midiEvents],
    }
  }

  private createImpulseResponse(durationSeconds: number, decay: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate
    const length = Math.floor(sampleRate * durationSeconds)
    const buffer = this.audioContext.createBuffer(2, length, sampleRate)
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const channelData = buffer.getChannelData(channel)
      for (let i = 0; i < length; i += 1) {
        const env = Math.pow(1 - i / length, decay)
        channelData[i] = (Math.random() * 2 - 1) * env
      }
    }
    return buffer
  }

  private noteNameToMidi(noteName: string): number | null {
    const match = noteName.match(/^([A-G])([b#]?)(-?\d+)$/)
    if (!match) return null
    const [, note, accidental, octaveRaw] = match
    const octave = Number(octaveRaw)
    const semitones: Record<string, number> = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    }
    let midi = (octave + 1) * 12 + semitones[note]
    if (accidental === '#') midi += 1
    if (accidental === 'b') midi -= 1
    return midi
  }

  private nearestSampleNoteName(targetMidi: number, available: string[]): string | null {
    let winner: string | null = null
    let winnerDistance = Number.POSITIVE_INFINITY
    for (const noteName of available) {
      const midi = this.noteNameToMidi(noteName)
      if (midi === null) continue
      const distance = Math.abs(targetMidi - midi)
      if (distance < winnerDistance) {
        winner = noteName
        winnerDistance = distance
      }
    }
    return winner
  }

  private async ensureSamplesLoaded(instrument: InstrumentPreset): Promise<void> {
    if (instrument === 'expressiveSynth') return
    if (this.sampleBuffers.has(instrument)) return

    const existing = this.sampleLoaders.get(instrument)
    if (existing) {
      await existing
      return
    }

    const loader = this.loadSamples(instrument)
    this.sampleLoaders.set(instrument, loader)
    await loader
  }

  private async loadSamples(instrument: InstrumentPreset): Promise<void> {
    const urls = this.getSampleMap(instrument)
    const buffers = new Map<string, AudioBuffer>()
    await Promise.all(
      Object.entries(urls).map(async ([noteName, url]) => {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Sample fetch failed for ${noteName}`)
        }
        const bytes = await response.arrayBuffer()
        const buffer = await this.audioContext.decodeAudioData(bytes)
        buffers.set(noteName, buffer)
      }),
    )
    this.sampleBuffers.set(instrument, buffers)
  }

  private getSampleMap(instrument: InstrumentPreset): Record<string, string> {
    if (instrument === 'piano') {
      const base = 'https://tonejs.github.io/audio/salamander/'
      return {
        A0: `${base}A0.mp3`,
        C1: `${base}C1.mp3`,
        'D#1': `${base}Ds1.mp3`,
        'F#1': `${base}Fs1.mp3`,
        A1: `${base}A1.mp3`,
        C2: `${base}C2.mp3`,
        'D#2': `${base}Ds2.mp3`,
        'F#2': `${base}Fs2.mp3`,
        A2: `${base}A2.mp3`,
        C3: `${base}C3.mp3`,
        'D#3': `${base}Ds3.mp3`,
        'F#3': `${base}Fs3.mp3`,
        A3: `${base}A3.mp3`,
        C4: `${base}C4.mp3`,
        'D#4': `${base}Ds4.mp3`,
        'F#4': `${base}Fs4.mp3`,
        A4: `${base}A4.mp3`,
        C5: `${base}C5.mp3`,
        'D#5': `${base}Ds5.mp3`,
        'F#5': `${base}Fs5.mp3`,
      }
    }

    const guitarBase = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_steel-mp3/'
    return {
      C2: `${guitarBase}C2.mp3`,
      E2: `${guitarBase}E2.mp3`,
      G2: `${guitarBase}G2.mp3`,
      C3: `${guitarBase}C3.mp3`,
      E3: `${guitarBase}E3.mp3`,
      G3: `${guitarBase}G3.mp3`,
      C4: `${guitarBase}C4.mp3`,
      E4: `${guitarBase}E4.mp3`,
      G4: `${guitarBase}G4.mp3`,
      C5: `${guitarBase}C5.mp3`,
    }
  }

  private noteOnSample(
    midi: number,
    velocity: number,
    profile: StyleProfile,
    instrument: InstrumentPreset,
    noteIndex: number,
    noteCount: number,
  ): string {
    const sampleSet = this.sampleBuffers.get(instrument)
    if (!sampleSet || sampleSet.size === 0) {
      return this.noteOn(midi, velocity, profile, noteIndex, noteCount)
    }

    const sourceNote = this.nearestSampleNoteName(midi, Array.from(sampleSet.keys()))
    if (!sourceNote) {
      return this.noteOn(midi, velocity, profile, noteIndex, noteCount)
    }

    const sourceMidi = this.noteNameToMidi(sourceNote)
    const sourceBuffer = sampleSet.get(sourceNote)
    if (!sourceBuffer || sourceMidi === null) {
      return this.noteOn(midi, velocity, profile, noteIndex, noteCount)
    }

    const bufferSource = this.audioContext.createBufferSource()
    const gainNode = this.audioContext.createGain()
    const filter = this.audioContext.createBiquadFilter()
    const panner = this.audioContext.createStereoPanner()
    const pitchRatio = Math.pow(2, (midi - sourceMidi) / 12)

    bufferSource.buffer = sourceBuffer
    bufferSource.playbackRate.value = pitchRatio

    filter.type = 'lowpass'
    filter.frequency.value = instrument === 'guitar' ? 5200 : 7600
    filter.Q.value = 0.7

    const spread = noteCount > 1 ? noteIndex / (noteCount - 1) : 0.5
    panner.pan.value = (spread * 2 - 1) * profile.width

    const now = this.audioContext.currentTime
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.linearRampToValueAtTime(velocity, now + Math.max(0.004, profile.attack * 0.6))
    gainNode.gain.linearRampToValueAtTime(velocity * 0.82, now + profile.attack + profile.decay)

    bufferSource.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(panner)
    panner.connect(this.dryBus)
    panner.connect(this.reverbBus)

    bufferSource.start()
    const voiceId = this.createVoiceId(midi)
    let stopped = false
    this.activeNotes.set(voiceId, {
      midi,
      gainNode,
      filter,
      stop: (releaseSeconds) => {
        if (stopped) return
        stopped = true
        const localNow = this.audioContext.currentTime
        gainNode.gain.cancelScheduledValues(localNow)
        gainNode.gain.setTargetAtTime(0.0001, localNow, Math.max(0.04, releaseSeconds * 0.4))
        try {
          bufferSource.stop(localNow + releaseSeconds + 0.05)
        } catch {
          // Already stopped; safe to ignore.
        }
      },
    })
    this.captureEvent('on', midi, Math.round(velocity * 127))
    return voiceId
  }

  private createVoiceId(midi: number): string {
    return `${midi}-${performance.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  private captureEvent(type: MidiLikeEvent['type'], note: number, velocity: number): void {
    if (!this.recorder || this.recorder.state !== 'recording') return
    this.midiEvents.push({
      timestampMs: Math.max(0, performance.now() - this.recordingStartTimeMs),
      type,
      note,
      velocity,
    })
  }
}
