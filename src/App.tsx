import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { InstrumentPreset, PerformanceBinding, SongSection, VoicingStyle } from './types'
import { useChordPilotStore } from './store/useChordPilotStore'
import './App.css'

const SEED_CHORDS = `[Verse]\nC G Am F\n[Chorus]\nF G Em Am`

function sectionLabel(section: SongSection): string {
  return `${section.name} (${section.startIndex + 1}-${section.endIndex + 1})`
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  )
}

type BindingAction = PerformanceBinding['action']

function App() {
  const [rawInput, setRawInput] = useState(SEED_CHORDS)
  const [sourceType, setSourceType] = useState<'manual' | 'chordpro'>('manual')
  const [importError, setImportError] = useState('')
  const [captureAction, setCaptureAction] = useState<BindingAction | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [importPanelOpen, setImportPanelOpen] = useState(false)
  const activeChordTokenRef = useRef<HTMLButtonElement | null>(null)
  const sheetViewRef = useRef<HTMLDivElement | null>(null)
  const importPanelRef = useRef<HTMLElement | null>(null)

  function adjustTranspose(delta: number): void {
    setTranspose(Math.max(-12, Math.min(12, transpose + delta)))
  }

  const {
    song,
    currentChordIndex,
    selectedSectionId,
    loopSectionId,
    style,
    instrument,
    transpose,
    warnings,
    bindings,
    isRecording,
    takes,
    latencyOffsetMs,
    chordHoldMs,
    fermataEnabled,
    fermataKeyHeld,
    quantizeStrength,
    humanizeMs,
    importFromText,
    importFromChordPro,
    playCurrentChord,
    nextChord,
    prevChord,
    setCurrentChord,
    jumpSection,
    setStyle,
    setInstrument,
    setTranspose,
    setLoopSection,
    setLatencyOffsetMs,
    setChordHoldMs,
    toggleFermata,
    setFermataKeyHeld,
    setQuantizeStrength,
    setHumanizeMs,
    upsertBinding,
    toggleRecording,
    exportTakeAudio,
    exportTakeRawAudio,
    exportTakeMidi,
  } = useChordPilotStore()

  const currentChord = song?.chords[currentChordIndex]
  const next = song?.chords[Math.min(currentChordIndex + 1, Math.max((song?.chords.length ?? 1) - 1, 0))]

  const chordSheet = useMemo(
    () =>
      song?.sheetParagraphs.map((paragraph) => (
        <div className="sheet-paragraph" key={paragraph.id}>
          {paragraph.lines.map((line) => {
            if (line.type === 'section') {
              return (
                <p className="sheet-section" key={line.id}>
                  [{line.text}]
                </p>
              )
            }
            if (line.type === 'lyric') {
              return (
                <p className="sheet-lyric" key={line.id}>
                  {line.text}
                </p>
              )
            }
            return (
              <div className="sheet-chord-line" key={line.id}>
                {line.tokens?.map((token) => {
                  if (token.chordIndex === undefined) {
                    return (
                      <span className="sheet-token-muted" key={token.id}>
                        {token.text}
                      </span>
                    )
                  }
                  return (
                    <button
                      className={`chord-chip ${token.chordIndex === currentChordIndex ? 'active' : ''}`}
                      key={token.id}
                      onClick={() => setCurrentChord(token.chordIndex ?? 0)}
                      ref={token.chordIndex === currentChordIndex ? activeChordTokenRef : null}
                    >
                      {token.text}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )),
    [currentChordIndex, setCurrentChord, song],
  )

  async function handleImport(event: FormEvent) {
    event.preventDefault()
    setImportError('')
    try {
      if (sourceType === 'manual') {
        importFromText(rawInput)
      } else {
        importFromChordPro(rawInput)
      }
    } catch (error) {
      setImportError((error as Error).message)
    }
  }

  useEffect(() => {
    importFromText(SEED_CHORDS)
  }, [importFromText])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault()
      }

      if (isTypingTarget(event.target) && !captureAction) {
        return
      }

      if (captureAction) {
        event.preventDefault()
        upsertBinding({
          action: captureAction,
          key: event.code,
        })
        setCaptureAction(null)
        return
      }

      const playBinding = bindings.find((item) => item.action === 'playChord')?.key ?? 'Space'
      const nextBinding = bindings.find((item) => item.action === 'nextChord')?.key ?? 'ArrowRight'
      const prevBinding = bindings.find((item) => item.action === 'prevChord')?.key ?? 'ArrowLeft'
      const recordBinding = bindings.find((item) => item.action === 'toggleRecord')?.key ?? 'KeyR'
      const fermataBinding = bindings.find((item) => item.action === 'toggleFermata')?.key ?? 'KeyF'

      if (event.code === playBinding) {
        event.preventDefault()
        void playCurrentChord()
      } else if (event.code === nextBinding) {
        nextChord()
      } else if (event.code === prevBinding) {
        prevChord()
      } else if (event.code === recordBinding) {
        void toggleRecording()
      } else if (event.code === fermataBinding) {
        event.preventDefault()
        if (!event.repeat) {
          setFermataKeyHeld(true)
        }
      }
    }

    function onKeyUp(event: KeyboardEvent): void {
      const fermataBinding = bindings.find((item) => item.action === 'toggleFermata')?.key ?? 'KeyF'
      if (event.code === fermataBinding) {
        setFermataKeyHeld(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [bindings, captureAction, nextChord, playCurrentChord, prevChord, setFermataKeyHeld, toggleRecording, upsertBinding])

  useEffect(() => {
    const activeToken = activeChordTokenRef.current
    const container = sheetViewRef.current
    if (!activeToken || !container) return

    const containerRect = container.getBoundingClientRect()
    const tokenRect = activeToken.getBoundingClientRect()
    const tokenTopWithinContainer = tokenRect.top - containerRect.top + container.scrollTop

    // Keep active chord around upper third so lyric lines below remain visible.
    const targetTop = Math.max(0, tokenTopWithinContainer - container.clientHeight * 0.28)
    container.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    })
  }, [currentChordIndex])

  useEffect(() => {
    function onPointerDown(event: MouseEvent): void {
      const panel = importPanelRef.current
      if (!panel || !importPanelOpen) return
      if (panel.contains(event.target as Node)) return
      setImportPanelOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [importPanelOpen])

  return (
    <>
      <main className="layout">
        <header className="topbar">
          <div className="topbar-meta">
            <h1>ChordPilot Pro</h1>
            <p>Tempo-style cover performance workspace</p>
          </div>
          <button
            className="btn btn-secondary sidebar-toggle"
            onClick={() => setSidebarOpen((value) => !value)}
            type="button"
          >
            {sidebarOpen ? 'Close' : 'Controls'} ☰
          </button>
        </header>

        <div className="game-layout">
          <section
            className={`panel import-panel ${importPanelOpen ? 'open' : ''}`}
            onMouseEnter={() => setImportPanelOpen(true)}
            onMouseLeave={() => setImportPanelOpen(false)}
            ref={importPanelRef}
          >
            <h2>Song Import</h2>
            <form className="import-panel-content" onSubmit={handleImport}>
              <div className="row">
                <label>
                  <span>Source</span>
                  <select value={sourceType} onChange={(event) => setSourceType(event.target.value as 'manual' | 'chordpro')}>
                    <option value="manual">Manual Chords</option>
                    <option value="chordpro">ChordPro</option>
                  </select>
                </label>
              </div>
              <textarea
                rows={14}
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder="Paste chords or ChordPro"
              />
              <button className="btn btn-primary" type="submit">
                Load Song
              </button>
            </form>
            <p className="import-panel-peek">Load Song</p>
            {importError && <p className="error import-panel-content">{importError}</p>}
            {warnings.length > 0 && (
              <ul className="warnings import-panel-content">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel performance-panel">
            <h2>Playfield</h2>
            <div className="sheet-focus-panel">
              <div className="score-now">
                <p className="label">Current chord</p>
                <p className="current">{currentChord?.normalizedSymbol ?? '--'}</p>
                <p className="next">Next: {next?.normalizedSymbol ?? '--'}</p>
              </div>
              <div className="sheet-view" ref={sheetViewRef}>
                {chordSheet}
              </div>
            </div>
          </section>
        </div>
      </main>

      <div className="control-hud" role="group" aria-label="Game controls">
        <button className="btn btn-ghost hud-btn" onClick={() => void playCurrentChord()}>
          Space Play
        </button>
        <button className="btn btn-ghost hud-btn" onClick={prevChord}>
          ← Previous
        </button>
        <button className="btn btn-ghost hud-btn" onClick={nextChord}>
          → Next
        </button>
        <button
          className={`btn hud-btn ${fermataEnabled || fermataKeyHeld ? 'btn-primary' : 'btn-ghost'}`}
          onClick={toggleFermata}
        >
          F Fermata {fermataEnabled ? 'Latched' : fermataKeyHeld ? 'Held' : ''}
        </button>
        <button className={`btn hud-btn ${isRecording ? 'btn-danger' : 'btn-ghost'}`} onClick={() => void toggleRecording()}>
          R Record
        </button>
      </div>

      <button
        aria-label="Close controls sidebar"
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        type="button"
      />

      <aside className={`control-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="control-sidebar-header">
          <h2>Settings</h2>
          <button className="btn btn-ghost" onClick={() => setSidebarOpen(false)} type="button">
            Close
          </button>
        </div>

        <section className="panel">
          <h2>Performance Settings</h2>
          <div className="row">
            <label>
              <span>Instrument</span>
              <select value={instrument} onChange={(event) => setInstrument(event.target.value as InstrumentPreset)}>
                <option value="piano">Piano (sampled)</option>
                <option value="guitar">Guitar (sampled)</option>
                <option value="expressiveSynth">Expressive Synth</option>
              </select>
            </label>
            <label>
              <span>Style</span>
              <select value={style} onChange={(event) => setStyle(event.target.value as VoicingStyle)}>
                <option value="pop">Pop</option>
                <option value="neoSoul">Neo Soul</option>
                <option value="jazz">Jazz</option>
                <option value="worshipPad">Worship Pad</option>
              </select>
            </label>
            <label className="transpose-field">
              <span>Transpose</span>
              <div className="transpose-controls">
                <button className="btn btn-secondary transpose-btn" onClick={() => adjustTranspose(-1)} type="button">
                  -1
                </button>
                <button className="btn btn-ghost transpose-readout" onClick={() => setTranspose(0)} type="button">
                  {transpose > 0 ? `+${transpose}` : transpose} st
                </button>
                <button className="btn btn-secondary transpose-btn" onClick={() => adjustTranspose(1)} type="button">
                  +1
                </button>
              </div>
            </label>
            <label>
              <span>Latency offset (ms)</span>
              <input
                type="number"
                min={0}
                max={500}
                value={latencyOffsetMs}
                onChange={(event) => setLatencyOffsetMs(Number(event.target.value))}
              />
            </label>
            <label className="slider-field">
              <span>Chord hold / fermata (ms)</span>
              <div className="range-with-value">
                <input
                  className="compact-range"
                  type="range"
                  min={500}
                  max={6000}
                  step={50}
                  value={chordHoldMs}
                  onChange={(event) => setChordHoldMs(Number(event.target.value))}
                />
                <span className="range-value">{chordHoldMs}</span>
              </div>
            </label>
            <label>
              <span>Quantize strength</span>
              <div className="range-with-value">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={quantizeStrength}
                  onChange={(event) => setQuantizeStrength(Number(event.target.value))}
                />
                <span className="range-value">{Math.round(quantizeStrength * 100)}%</span>
              </div>
            </label>
            <label>
              <span>Humanize (ms)</span>
              <input
                type="number"
                min={0}
                max={40}
                value={humanizeMs}
                onChange={(event) => setHumanizeMs(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="row section-row">
            <label>
              <span>Jump section</span>
              <select onChange={(event) => jumpSection(event.target.value)} value={selectedSectionId ?? ''}>
                <option value="">Select section</option>
                {song?.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {sectionLabel(section)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Loop section</span>
              <select onChange={(event) => setLoopSection(event.target.value || undefined)} value={loopSectionId ?? ''}>
                <option value="">None</option>
                {song?.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">Fermata mode extends hold to about 2.5x while active.</p>
        </section>

        <section className="panel">
          <h2>Mapping Studio</h2>
          <p>Assign your controller keys. Click a button and press any keyboard key.</p>
          <div className="controls">
            {(['playChord', 'nextChord', 'prevChord', 'toggleRecord', 'toggleFermata'] as const).map((action) => {
              const current = bindings.find((item) => item.action === action)?.key ?? 'Unassigned'
              return (
                <button
                  className={`btn ${captureAction === action ? 'btn-primary' : 'btn-secondary'}`}
                  key={action}
                  onClick={() => setCaptureAction(action)}
                >
                  {action}: {captureAction === action ? 'Press key...' : current}
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel recording-panel">
          <h2>Recording Studio</h2>
          {takes.length === 0 ? (
            <p>No takes recorded yet. Press Record then perform.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Take</th>
                  <th>Length</th>
                  <th>MIDI events</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {takes.map((take) => (
                  <tr key={take.id}>
                    <td>{take.id.slice(0, 8)}</td>
                    <td>{Math.max(1, Math.round((take.endedAt - take.startedAt) / 1000))}s</td>
                    <td>{take.events.length}</td>
                    <td className="take-actions">
                      <button className="btn btn-ghost" onClick={() => exportTakeAudio(take.id)}>
                        WAV
                      </button>
                      <button className="btn btn-ghost" onClick={() => exportTakeRawAudio(take.id)}>
                        RAW WEBM
                      </button>
                      <button className="btn btn-ghost" onClick={() => exportTakeMidi(take.id)}>
                        MIDI
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </aside>
    </>
  )
}

export default App
