import TrackSoundSelector from '../../sounds/TrackSoundSelector'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ChevronLeft, ChevronRight, Disc3, Pause, Play, RefreshCw, Repeat2, Shuffle, Square, Trash2 } from 'lucide-react'
import { ZodError } from 'zod'
import type { DrumPattern, MusicProject } from '../../models/project'
import { drumGenres, drumLanes, drumPatternEnd, drumPatternNotes, drumSelection, editDrumStep, generateDrumPattern, stepsPerBar, varyDrumPattern, withDrumTrack, type DrumLane } from '../../music/drums'
import { TrackPlayer, type PreviewTrack } from '../../audio/TrackPlayer'
import type { PlaybackState } from '../../audio/ChordPlayer'
import { downloadTracksMidi } from '../../midi/exportTracks'
import './drums.css'

interface Props { project: MusicProject; update: (change: Partial<MusicProject>) => void; saveStatus: string }
function selectionFor(project: MusicProject, ids: string[]) {
  try { return { ...drumSelection(project, ids), error: '' } }
  catch (error) { return { tracks: [], end: 0, error: error instanceof Error ? error.message : 'No se pudo preparar el preview.' } }
}
export default function DrumWorkbench({ project, update, saveStatus }: Props) {
  const track = project.tracks.find(item => item.kind === 'drums')
  const pattern = track?.drumPattern
  const drumNotes = pattern ? drumPatternNotes(pattern) : track?.notes ?? []
  const [genre, setGenre] = useState<DrumPattern['genre']>(() => pattern?.genre ?? (drumGenres.includes(project.parameters.genre as DrumPattern['genre']) ? project.parameters.genre as DrumPattern['genre'] : 'Pop'))
  const [bars, setBars] = useState(pattern?.bars ?? 2)
  const [signature, setSignature] = useState(project.parameters.timeSignature)
  const [draftSwing, setDraftSwing] = useState(0)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<{ lane: DrumLane; step: number }>({ lane: 'kick', step: 0 })
  const [hitVelocity, setHitVelocity] = useState(96)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<PlaybackState>('stopped')
  const [starting, setStarting] = useState(false)
  const [loop, setLoop] = useState(true)
  const [accompaniment, setAccompaniment] = useState<string[]>([])
  const [playIndex, setPlayIndex] = useState(-1)
  const engine = useRef<TrackPlayer | null>(null)
  const music = (['chords', 'melody', 'bass'] as const).map(kind => project.tracks.find(item => item.kind === kind)).filter(item => item && (item.kind === 'chords' ? item.chords.length : item.notes.length))
  const ids = track ? [track.id, ...accompaniment.filter(id => music.some(item => item!.id === id))] : []
  const selection = selectionFor(project, ids)
  const scoreJson = JSON.stringify(selection.tracks.map(item => ({ id: item.id, kind: item.kind, sound: item.sound, notes: item.notes, volume: 0, muted: false })))
  const mixJson = JSON.stringify(selection.tracks.map(item => ({ id: item.id, volume: item.volume, muted: item.muted })))
  useEffect(() => { const player = new TrackPlayer(setState); engine.current = player; return () => { player.dispose(); engine.current = null } }, [])
  useEffect(() => { engine.current?.configure(JSON.parse(scoreJson) as PreviewTrack[], project.parameters.bpm, selection.end) }, [scoreJson, project.parameters.bpm, selection.end])
  useEffect(() => { engine.current?.setLoop(loop) }, [loop, scoreJson])
  useEffect(() => { for (const item of JSON.parse(mixJson) as { id: string; volume: number; muted: boolean }[]) engine.current?.setMix(item.id, item.volume, item.muted) }, [mixJson, scoreJson, project.parameters.bpm, selection.end])
  const cycle = pattern ? drumPatternEnd(pattern) : 0
  const swing = pattern?.swing ?? draftSwing
  useEffect(() => {
    if (state !== 'playing' || !cycle) return
    const timer = window.setInterval(() => {
      const beat = (engine.current?.getBeat() ?? 0) % cycle
      let index = Math.floor(beat * 4)
      if (pattern && index % stepsPerBar(pattern.signature) % 2 && beat < index * 0.25 + swing * 0.25) index--
      setPlayIndex(index)
    }, 60)
    return () => window.clearInterval(timer)
  }, [state, cycle, swing, pattern])
  const attempt = (action: () => void) => { try { action() } catch (error) { setMessage(error instanceof ZodError ? error.issues[0]?.message ?? 'Revisa los parámetros.' : error instanceof Error ? error.message : 'No se pudo completar la acción.') } }
  const commit = (next: DrumPattern) => update({ tracks: withDrumTrack(project, next) })
  const generate = () => attempt(() => {
    const next = generateDrumPattern(genre, bars, signature, swing, crypto.getRandomValues(new Uint32Array(1))[0])
    update({ parameters: { ...project.parameters, timeSignature: signature }, tracks: withDrumTrack(project, next) })
    setPage(0); setSelected({ lane: 'kick', step: 0 }); setMessage('Patrón generado y añadido al proyecto. Cada paso conserva su velocidad MIDI.')
  })
  const empty = () => attempt(() => {
    if (drumNotes.length && !window.confirm('¿Vaciar la batería? Los demás instrumentos se conservan.')) return
    const next = generateDrumPattern(genre, bars, signature, swing)
    for (const lane of drumLanes) next.lanes[lane.id].fill(0)
    update({ parameters: { ...project.parameters, timeSignature: signature }, tracks: withDrumTrack(project, next) })
    setPage(0); setSelected({ lane: 'kick', step: 0 }); setMessage('Patrón vacío listo para dibujar tu ritmo.')
  })
  const count = pattern ? stepsPerBar(pattern.signature) : 16
  const bar = pattern ? Math.min(page, pattern.bars - 1) : 0
  const selectedStep = pattern ? Math.min(selected.step, pattern.lanes[selected.lane].length - 1) : 0
  const selectedVelocity = pattern?.lanes[selected.lane][selectedStep] ?? 0
  const changeBar = (index: number) => { setPage(index); setSelected(value => ({ ...value, step: index * count + value.step % count })) }
  const stale = Boolean(pattern && pattern.signature.join('/') !== project.parameters.timeSignature.join('/'))
  const unknown = drumNotes.filter(note => !drumLanes.some(lane => lane.pitch === note.pitch)).length
  const play = async () => {
    setStarting(true)
    try { await engine.current?.play(); setMessage('') } catch (error) { setMessage(`No se pudo iniciar el audio: ${error instanceof Error ? error.message : 'revisa los permisos de sonido'}`) } finally { setStarting(false) }
  }
  const exportMidi = (all: boolean) => attempt(() => {
    if (!track) return
    const source = all ? { ...project, tracks: project.tracks.map(item => selection.tracks.find(rendered => rendered.id === item.id) ?? item) } : project
    downloadTracksMidi(source, all ? ids : [track.id], all ? 'bateria-acompanamiento' : 'bateria')
    setMessage('MIDI preparado: canal 10 de batería, velocidades y swing incluidos.')
  })
  const hasSound = selection.tracks.some(item => item.notes.length)

  return <section className="drum-workbench instrument-theme" data-instrument="drums" aria-label="Secuenciador de batería">
    <p className="drum-save" role="status">{saveStatus}</p>
    <div className="drum-intro"><span className="icon-box orange"><Disc3 size={27}/></span><div><div className="eyebrow">EL PULSO DE TU CANCIÓN · MOTOR LOCAL</div><h2>Un ritmo que lo conecta todo.</h2><p>Seis instrumentos. Cada golpe, en tus manos.</p></div><span className="drum-ready">Fase 4 · Disponible</span></div>
    {track && project.sections.some(section => section.trackIds.includes(track.id) && !section.variantIds?.[track.id]) && <p className="generator-usage">V1 se utiliza en: {project.sections.filter(section => section.trackIds.includes(track.id) && !section.variantIds?.[track.id]).map(section => section.name).join(', ')}. Editar o regenerar aquí actualiza esos bloques. Puedes conservar una copia desde la biblioteca de Estructura.</p>}
    <TrackSoundSelector track={track} kind="drums" onChange={sound => { if (track) update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, sound } : item) }) }}/>
    <div className="drum-config"><div className="section-heading"><h3>Elige tu punto de partida</h3><span>Sonidos sintetizados · Sin muestras externas</span></div><div className="drum-settings">
      <label>Patrón por género<select aria-label="Género de batería" value={genre} onChange={e => setGenre(e.target.value as DrumPattern['genre'])}>{drumGenres.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Longitud<select aria-label="Compases de batería" value={bars} onChange={e => setBars(Number(e.target.value))}>{Array.from(new Set([bars, 1, 2, 4, 8])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} {value === 1 ? 'compás' : 'compases'}</option>)}</select></label>
      <label>Compás<select aria-label="Compás de batería" value={signature.join('/')} disabled={music.length > 0} onChange={e => setSignature(e.target.value.split('/').map(Number) as DrumPattern['signature'])}>{Array.from(new Set([signature.join('/'), '4/4', '3/4', '6/8', '2/4', '5/4', '7/8'])).map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Swing <span>{Math.round(swing * 100)}%</span><input aria-label="Swing de batería" type="range" min="0" max="0.6" step="0.01" value={swing} onChange={e => { const value = Number(e.target.value); if (pattern) attempt(() => commit({ ...pattern, swing: value })); else setDraftSwing(value) }}/></label>
    </div><div className="drum-generate"><p>{music.length ? 'El compás sigue al proyecto. Cámbialo en Acordes si lo necesitas.' : 'Puedes crear batería sin acordes ni otras pistas.'}<br/>{pattern ? 'Regenerar reemplaza los pasos actuales.' : 'Elige un groove o empieza desde cero.'}</p><div><button className="button secondary" onClick={empty}><Trash2 size={14}/>{pattern ? 'Vaciar patrón' : 'Empezar vacío'}</button><button className="button primary" onClick={generate}><RefreshCw size={15}/>{pattern ? 'Regenerar patrón' : 'Generar patrón'}</button></div></div></div>
    {message && <p className="drum-message" role="status">{message}</p>}
    {stale && <p className="drum-warning" role="alert">El patrón conserva el compás {pattern!.signature.join('/')}, pero el proyecto usa {project.parameters.timeSignature.join('/')}. Tus pasos se mantienen; regenera para adaptarlos.</p>}
    {selection.error && <p className="drum-warning" role="alert">{selection.error}</p>}
    {unknown > 0 && <p className="drum-warning" role="alert">La pista importada contiene {unknown} golpes fuera del mapa de seis instrumentos de este preview. Se conservan en el proyecto y el MIDI, pero aquí no tendrán sonido.</p>}
    {pattern ? <>
      <div className="section-heading"><h3>Tu secuenciador <span className="drum-pattern-tag">{pattern.genre} · {pattern.signature.join('/')} · {count} pasos por compás</span></h3><button className="text-button" onClick={() => attempt(() => { commit(varyDrumPattern(pattern, crypto.getRandomValues(new Uint32Array(1))[0])); setMessage('Variación aplicada a un golpe; los demás pasos se conservan.') })}><Shuffle size={14}/>Variar patrón</button></div>
      <div className="drum-bar-nav"><div><button className="transport-icon" aria-label="Compás anterior" disabled={bar === 0} onClick={() => changeBar(bar - 1)}><ChevronLeft size={16}/></button><label>Compás<select aria-label="Compás visible" value={bar} onChange={e => changeBar(Number(e.target.value))}>{Array.from({ length: pattern.bars }, (_, index) => <option key={index} value={index}>{index + 1} de {pattern.bars}</option>)}</select></label><button className="transport-icon" aria-label="Compás siguiente" disabled={bar === pattern.bars - 1} onClick={() => changeBar(bar + 1)}><ChevronRight size={16}/></button></div><span>1 paso = 1 semicorchea · Clic activa o desactiva</span></div>
      <div className="drum-grid-scroll"><div className="drum-grid" role="group" aria-label={`Compás ${bar + 1} del patrón`} style={{ gridTemplateColumns: `118px repeat(${count}, minmax(28px, 1fr))`, minWidth: 118 + count * 28 }}>
        <div className="drum-grid-corner">INSTRUMENTO</div>{Array.from({ length: count }, (_, index) => <div className={`drum-step-label ${index % 4 === 0 ? 'beat-start' : ''}`} key={index}>{index + 1}</div>)}
        {drumLanes.map(lane => <div className="drum-grid-row" key={lane.id}><div className="drum-row-label"><strong>{lane.name}</strong><span>{lane.detail} · GM {lane.pitch}</span></div>{Array.from({ length: count }, (_, index) => {
          const step = bar * count + index; const velocity = pattern.lanes[lane.id][step]; const focused = selected.lane === lane.id && selectedStep === step
          return <button key={step} className={`drum-step ${velocity ? 'hit' : ''} ${index % 4 === 0 ? 'beat-start' : ''} ${focused ? 'step-selected' : ''} ${state === 'playing' && playIndex === step ? 'step-playing' : ''}`} data-lane={lane.id} data-step={step} aria-label={`${lane.name}, compás ${bar + 1}, paso ${index + 1}, velocidad ${velocity}`} aria-pressed={velocity > 0} title="Clic: activar/desactivar. Mayús+clic: seleccionar sin cambiar." onFocus={() => setSelected({ lane: lane.id, step })} onClick={e => { setSelected({ lane: lane.id, step }); if (!e.shiftKey) attempt(() => commit(editDrumStep(pattern, lane.id, step, velocity ? 0 : hitVelocity))) }}><span style={{ opacity: velocity ? 0.4 + velocity / 127 * 0.6 : 0 }}/></button>
        })}</div>)}
      </div></div>
      <div className="drum-hit-editor"><div><h4>Golpe seleccionado</h4><span>{drumLanes.find(lane => lane.id === selected.lane)!.name} · compás {Math.floor(selectedStep / count) + 1} · paso {selectedStep % count + 1}</span></div><label>Instrumento<select aria-label="Instrumento del golpe" value={selected.lane} onChange={e => setSelected({ lane: e.target.value as DrumLane, step: selectedStep })}>{drumLanes.map(lane => <option key={lane.id} value={lane.id}>{lane.name}</option>)}</select></label><label>Velocidad · 0 apaga<input key={`${selected.lane}-${selectedStep}-${selectedVelocity}`} aria-label="Velocidad del golpe" type="number" min="0" max="127" defaultValue={selectedVelocity} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} onBlur={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 0 && value <= 127) attempt(() => commit(editDrumStep(pattern, selected.lane, selectedStep, value))); else e.target.value = String(selectedVelocity) }}/></label><label>Nuevos golpes<input aria-label="Velocidad de nuevos golpes" type="number" min="1" max="127" defaultValue={hitVelocity} onBlur={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 1 && value <= 127) setHitVelocity(value); else e.target.value = String(hitVelocity) }}/></label></div>
      <p className="drum-help">Mayús+clic selecciona sin cambiar el paso. También puedes usar Tab para seleccionar un golpe y editar su velocidad. El swing retrasa la segunda semicorchea de cada pareja y se incluye en el MIDI.</p>
    </> : <div className="drum-empty"><Disc3 size={42}/><h3>{track ? 'Tu batería importada está lista para escuchar.' : 'Empieza por el pulso.'}</h3><p>{track ? 'Genera un patrón para reemplazarla por una cuadrícula editable.' : 'Genera un patrón o empieza vacío y dibuja tus golpes.'}</p></div>}
    {track && <div className="drum-listen"><h3>Escucha en contexto</h3><div className="drum-accompaniment">{music.map(item => <label key={item!.id}><input type="checkbox" checked={accompaniment.includes(item!.id)} onChange={e => setAccompaniment(current => e.target.checked ? [...current, item!.id] : current.filter(id => id !== item!.id))}/>{item!.kind === 'chords' ? 'Con acordes' : item!.kind === 'melody' ? 'Con melodía' : 'Con bajo'}</label>)}<label>Volumen<input aria-label="Volumen de batería" type="range" min="0" max="1" step="0.01" value={track.volume} onChange={e => update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, volume: Number(e.target.value) } : item) })}/></label><label><input type="checkbox" checked={track.muted} onChange={e => update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, muted: e.target.checked } : item) })}/>Silenciar batería</label></div>
      <div className="drum-transport"><button className="button primary" disabled={starting || state === 'playing' || !hasSound || Boolean(selection.error)} onClick={() => void play()}><Play size={16}/>{starting ? 'Iniciando…' : state === 'paused' ? 'Reanudar' : 'Reproducir'}</button><button className="transport-icon" aria-label="Pausar batería" disabled={state !== 'playing'} onClick={() => engine.current?.pause()}><Pause size={16}/></button><button className="transport-icon" aria-label="Detener batería" onClick={() => engine.current?.stop()}><Square size={14}/></button><button className={`transport-icon ${loop ? 'enabled' : ''}`} aria-label="Repetir batería" aria-pressed={loop} onClick={() => setLoop(value => !value)}><Repeat2 size={17}/></button><label>BPM<input aria-label="Tempo de batería" type="number" min="30" max="300" defaultValue={project.parameters.bpm} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} onBlur={e => { const bpm = Number(e.target.value); if (Number.isInteger(bpm) && bpm >= 30 && bpm <= 300) update({ parameters: { ...project.parameters, bpm } }); else e.target.value = String(project.parameters.bpm) }}/></label><span className="drum-play-state" aria-live="polite">{state === 'playing' ? 'Reproduciendo' : state === 'paused' ? 'En pausa' : 'Detenido'}</span></div>
      <p className="drum-help">El patrón se repite hasta cubrir el acompañamiento seleccionado. Cambiar pasos, swing, BPM o acompañamiento detiene el preview; volumen y repetición no lo interrumpen.</p>
      <div className="drum-exports"><button className="button secondary" disabled={!drumNotes.length} onClick={() => exportMidi(false)}><ArrowDownToLine size={15}/>MIDI de batería</button><button className="button secondary" disabled={ids.length < 2 || !drumNotes.length || !hasSound || Boolean(selection.error)} onClick={() => exportMidi(true)}><ArrowDownToLine size={15}/>MIDI con acompañamiento</button></div>
    </div>}
  </section>
}
