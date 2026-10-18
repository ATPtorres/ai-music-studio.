import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRight, AudioLines, Guitar, Pause, Play, Plus, RefreshCw, Repeat2, Shuffle, Square, Trash2 } from 'lucide-react'
import type { MusicNote, MusicProject } from '../../models/project'
import { chordsToNotes } from '../../music/harmony'
import { generateLine, getHarmony, harmonyEnd, harmonyFingerprint, validateLineNotes, varyLine, withLineTrack, type LineKind, type LineSettings } from '../../music/lines'
import { barBeats, midiToNote } from '../../music/theory'
import { TrackPlayer, type PreviewTrack } from '../../audio/TrackPlayer'
import type { PlaybackState } from '../../audio/ChordPlayer'
import { downloadTracksMidi } from '../../midi/exportTracks'
import { ZodError } from 'zod'
import PianoRoll from './PianoRoll'
import './lines.css'

interface Props { kind: LineKind; project: MusicProject; update: (change: Partial<MusicProject>) => void; saveStatus: string; onOpenChords: () => void }
export default function LineWorkbench({ kind, project, update, saveStatus, onOpenChords }: Props) {
  const bass = kind === 'bass'
  const track = project.tracks.find(item => item.kind === kind)
  const harmony = project.tracks.find(item => item.kind === 'chords')
  const companion = project.tracks.find(item => item.kind === (bass ? 'melody' : 'bass'))
  const end = harmonyEnd(getHarmony(project))
  const [settings, setSettings] = useState<Omit<LineSettings, 'seed'>>(() => track?.generation ?? { low: bass ? 28 : 60, high: bass ? 52 : 84, density: 'medium', rhythm: bass && /jazz/i.test(project.parameters.genre) ? 'walking' : 'straight', complexity: project.parameters.complexity })
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState(-1)
  const [state, setState] = useState<PlaybackState>('stopped')
  const [starting, setStarting] = useState(false)
  const [loop, setLoop] = useState(false)
  const [withChords, setWithChords] = useState(true)
  const [withCompanion, setWithCompanion] = useState(false)
  const engine = useRef<TrackPlayer | null>(null)
  const stale = Boolean(track && track.sourceHarmony !== harmonyFingerprint(project))
  const companionStale = Boolean(withCompanion && companion?.notes.length && companion.sourceHarmony !== harmonyFingerprint(project))
  const selection = [track, withChords ? harmony : undefined, withCompanion ? companion : undefined].filter(item => item && (item.kind === 'chords' ? item.chords.length : item.notes.length))
  const scoreJson = JSON.stringify(selection.map(item => ({ id: item!.id, kind: item!.kind, notes: item!.kind === 'chords' ? chordsToNotes(item!.chords) : item!.notes, volume: 0, muted: false })))
  const mixJson = JSON.stringify(selection.map(item => ({ id: item!.id, volume: item!.volume, muted: item!.muted })))
  const previewEnd = selection.reduce((last, item) => (item!.kind === 'chords' ? chordsToNotes(item!.chords) : item!.notes).reduce((value, note) => Math.max(value, note.start + note.duration), last), end)
  useEffect(() => { const player = new TrackPlayer(setState); engine.current = player; return () => { player.dispose(); engine.current = null } }, [])
  useEffect(() => { engine.current?.configure(JSON.parse(scoreJson) as PreviewTrack[], project.parameters.bpm, previewEnd) }, [scoreJson, project.parameters.bpm, previewEnd])
  useEffect(() => { engine.current?.setLoop(loop) }, [loop, scoreJson])
  useEffect(() => {
    for (const item of JSON.parse(mixJson) as { id: string; volume: number; muted: boolean }[]) engine.current?.setMix(item.id, item.volume, item.muted)
  }, [mixJson, scoreJson, project.parameters.bpm, previewEnd])
  const configure = <K extends keyof typeof settings,>(key: K, value: typeof settings[K]) => setSettings(current => ({ ...current, [key]: value }))
  const attempt = (action: () => void) => { try { action() } catch (error) { setMessage(error instanceof ZodError ? error.issues[0]?.message ?? 'Revisa los parámetros.' : error instanceof Error ? error.message : 'No se pudo completar la acción.') } }
  const freshSettings = () => ({ ...settings, seed: crypto.getRandomValues(new Uint32Array(1))[0] })
  const generate = () => attempt(() => {
    const notes = generateLine(project, kind, freshSettings())
    update({ tracks: withLineTrack(project, kind, notes, settings) }); setSelected(-1)
    setMessage(`${bass ? 'Bajo generado' : 'Melodía generada'}: ${notes.length} notas. Puedes editarlas en el piano roll.`)
  })
  const variation = () => attempt(() => {
    if (!track || stale) throw new Error('Regenera la pista con los acordes actuales antes de crear una variación.')
    const notes = validateLineNotes(varyLine(project, track.notes, freshSettings()), end)
    update({ tracks: withLineTrack(project, kind, notes, { ...(track.generation ?? settings), low: settings.low, high: settings.high }) }); setSelected(-1); setMessage('Variación creada: se conservaron los inicios, duraciones y velocidades.')
  })
  const commit = (notes: MusicNote[], focus?: MusicNote) => {
    if (!track) return
    const sorted = validateLineNotes(notes, Math.max(end, ...track.notes.map(note => note.start + note.duration)))
    update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, notes: sorted } : item) })
    setSelected(focus ? sorted.findIndex(note => note.pitch === focus.pitch && note.start === focus.start && note.duration === focus.duration) : -1)
    setMessage('Nota editada. Las ediciones manuales pueden salir de la escala.')
  }
  const add = (pitch: number, start: number) => attempt(() => {
    if (!track || start >= end) return
    const note = { pitch, start, duration: Math.min(0.5, end - start), velocity: 90 }
    commit([...track.notes, note], note)
  })
  const addFreeNote = () => attempt(() => {
    if (!track) return
    for (let start = 0; start < end; start += 0.5) {
      const duration = Math.min(0.5, end - start)
      if (!track.notes.some(note => note.start < start + duration && note.start + note.duration > start)) { add(settings.low, start); return }
    }
    throw new Error('No hay un espacio libre de media negra. Acorta o elimina una nota primero.')
  })
  const edit = (change: Partial<MusicNote>) => {
    if (!track || !track.notes[selected]) return false
    try {
      const note = { ...track.notes[selected], ...change }
      commit(track.notes.map((item, index) => index === selected ? note : item), note)
      return true
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo editar la nota.'); return false }
  }
  const play = async () => {
    setStarting(true)
    try { await engine.current?.play(); setMessage('') } catch (error) { setMessage(`No se pudo iniciar el audio: ${error instanceof Error ? error.message : 'revisa los permisos de sonido'}`) } finally { setStarting(false) }
  }
  const selectedNote = track?.notes[selected]
  const low = Math.min(settings.low, ...(track?.notes.map(note => note.pitch) ?? []))
  const high = Math.max(settings.high, ...(track?.notes.map(note => note.pitch) ?? []))
  const exportMidi = (all: boolean) => attempt(() => {
    if (!track) return
    downloadTracksMidi(project, all ? selection.map(item => item!.id) : [track.id], all ? 'acompanamiento' : bass ? 'bajo' : 'melodia')
    setMessage('Archivo MIDI preparado con notas reales, tempo y compás.')
  })

  return <section className={`line-workbench ${bass ? 'bass-workbench' : 'melody-workbench'}`} aria-label={bass ? 'Generador de bajos' : 'Generador de melodías'}>
    <p className="line-save" role="status">{saveStatus}</p>
    <div className="line-intro"><span className={`icon-box ${bass ? 'pink' : 'blue'}`}>{bass ? <Guitar size={25}/> : <AudioLines size={25}/>}</span><div><div className="eyebrow">{bass ? 'LA BASE DE TU SONIDO' : 'UNA VOZ PARA TU IDEA'} · MOTOR LOCAL</div><h2>{bass ? 'Un pulso con personalidad.' : 'Encuentra la próxima frase.'}</h2><p>{project.parameters.key} {project.parameters.mode === 'major' ? 'mayor' : 'menor natural'} · {project.parameters.genre} · {project.parameters.mood}</p></div></div>
    {!end ? <div className="line-empty"><h3>Primero, un punto de apoyo.</h3><p>Crea una progresión de acordes para generar una línea compatible.</p><button className="button primary" onClick={onOpenChords}>Abrir Acordes <ArrowRight size={15}/></button></div> : <>
      <div className="line-config"><div className="section-heading"><h3>Diseña tu {bass ? 'bajo' : 'melodía'}</h3><span>{getHarmony(project).length} acordes · {end} negras</span></div><div className="line-settings">
        <label>Nota más grave<select aria-label="Nota más grave" value={settings.low} onChange={e => configure('low', Number(e.target.value))}>{Array.from({ length: 128 }, (_, pitch) => <option key={pitch} value={pitch}>{midiToNote(pitch)}</option>)}</select></label>
        <label>Nota más aguda<select aria-label="Nota más aguda" value={settings.high} onChange={e => configure('high', Number(e.target.value))}>{Array.from({ length: 128 }, (_, pitch) => <option key={pitch} value={pitch}>{midiToNote(pitch)}</option>)}</select></label>
        <label>Densidad<select aria-label="Densidad de notas" disabled={settings.rhythm === 'sustained'} value={settings.density} onChange={e => configure('density', e.target.value as typeof settings.density)}><option value="sparse">Espaciada</option><option value="medium">Media</option><option value="dense">Alta</option></select></label>
        <label>{bass ? 'Patrón' : 'Ritmo'}<select aria-label="Patrón rítmico" value={settings.rhythm} onChange={e => configure('rhythm', e.target.value as typeof settings.rhythm)}><option value="sustained">{bass ? 'Fundamentales largas' : 'Notas largas'}</option><option value="straight">Pulso regular</option><option value="syncopated">Sincopado</option>{bass && <option value="walking">Walking · notas del acorde</option>}</select></label>
        <label>Complejidad<select aria-label="Complejidad de línea" value={settings.complexity} onChange={e => configure('complexity', e.target.value as typeof settings.complexity)}><option value="simple">Sencilla</option><option value="intermediate">Intermedia</option><option value="advanced">Avanzada</option></select></label>
      </div><div className="line-generate"><p>{track ? 'Regenerar reemplaza las notas de esta pista.' : 'Usaremos la armonía y el tempo de tu proyecto.'}</p><button className="button primary" onClick={generate}><RefreshCw size={15}/>{track ? 'Regenerar línea' : bass ? 'Generar bajo' : 'Generar melodía'}</button></div></div>
      {message && <p className="line-message" role="status">{message}</p>}
      {stale && <p className="line-stale" role="alert">La armonía cambió o esta pista no tiene referencia de origen. Tus notas se conservan; regenera para adaptarlas a los acordes actuales.</p>}
      {companionStale && <p className="line-stale" role="alert">La otra línea del acompañamiento se creó con una armonía diferente. Revísala en su módulo antes de darla por compatible.</p>}
      {track && <>
        <div className="section-heading"><h3>Piano roll <span className="line-note-count">{track.notes.length} notas</span></h3><div className="line-roll-actions"><button className="text-button" disabled={stale || !track.notes.length} onClick={variation}><Shuffle size={14}/>Variar frase</button><button className="text-button" onClick={addFreeNote}><Plus size={14}/>Añadir nota</button></div></div>
        <p className="line-help">Selecciona una nota para editarla. Pulsa un espacio libre para añadir una nota de media negra. Desplaza el roll para recorrer el registro.</p>
        <PianoRoll notes={track.notes} low={Math.min(low, high)} high={Math.max(low, high)} end={track.notes.reduce((last, note) => Math.max(last, note.start + note.duration), end)} beatsPerBar={barBeats(project.parameters.timeSignature)} selected={selected} onSelect={setSelected} onAdd={add}/>
        {selectedNote ? <div className="note-editor" key={`${selected}-${selectedNote.start}-${selectedNote.duration}-${selectedNote.pitch}-${selectedNote.velocity}`}><label>Nota<select aria-label="Altura de nota" value={selectedNote.pitch} onChange={e => edit({ pitch: Number(e.target.value) })}>{Array.from({ length: 128 }, (_, pitch) => <option key={pitch} value={pitch}>{midiToNote(pitch)}</option>)}</select></label>{([{ field: 'start', label: 'Inicio · negras', min: 0, max: previewEnd, step: 0.25 }, { field: 'duration', label: 'Duración · negras', min: 0.01, max: previewEnd, step: 0.25 }, { field: 'velocity', label: 'Velocidad MIDI', min: 1, max: 127, step: 1 }] as const).map(item => <label key={item.field}>{item.label}<input aria-label={item.label} type="number" min={item.min} max={item.max} step={item.step} defaultValue={Number(selectedNote[item.field].toFixed(4))} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} onBlur={e => { const value = Number(e.target.value); if (!Number.isFinite(value) || value < item.min || value > item.max || (item.field === 'velocity' && !Number.isInteger(value))) { e.target.value = String(selectedNote[item.field]); return }; if (!edit({ [item.field]: value })) e.target.value = String(selectedNote[item.field]) }}/></label>)}<button className="button secondary" onClick={() => attempt(() => commit(track.notes.filter((_, index) => index !== selected)))}><Trash2 size={14}/>Eliminar</button></div> : <p className="line-help">También puedes seleccionar las notas con Tab y Enter. Los tiempos se expresan en negras desde 0; en 6/8 hay tres negras por compás.</p>}
        <div className="line-listen"><h3>Escucha en contexto</h3><div className="line-listen-options"><label><input type="checkbox" checked={withChords} onChange={e => setWithChords(e.target.checked)}/>Con acordes</label>{companion?.notes.length ? <label><input type="checkbox" checked={withCompanion} onChange={e => setWithCompanion(e.target.checked)}/>Con {bass ? 'melodía' : 'bajo'}</label> : null}<label>Volumen<input aria-label="Volumen de línea" type="range" min="0" max="1" step="0.01" value={track.volume} onChange={e => update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, volume: Number(e.target.value) } : item) })}/></label><label><input type="checkbox" checked={track.muted} onChange={e => update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, muted: e.target.checked } : item) })}/>Silenciar línea</label></div>
          <div className="line-transport"><button className="button primary" disabled={starting || state === 'playing' || !track.notes.length} onClick={() => void play()}><Play size={16}/>{starting ? 'Iniciando…' : state === 'paused' ? 'Reanudar' : 'Reproducir'}</button><button className="transport-icon" aria-label="Pausar línea" disabled={state !== 'playing'} onClick={() => engine.current?.pause()}><Pause size={16}/></button><button className="transport-icon" aria-label="Detener línea" onClick={() => engine.current?.stop()}><Square size={14}/></button><button className={`transport-icon ${loop ? 'enabled' : ''}`} aria-label="Repetir línea" aria-pressed={loop} onClick={() => setLoop(value => !value)}><Repeat2 size={17}/></button><label>BPM<input aria-label="Tempo de línea" type="number" min={30} max={300} defaultValue={project.parameters.bpm} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} onBlur={e => { const bpm = Number(e.target.value); if (Number.isInteger(bpm) && bpm >= 30 && bpm <= 300) update({ parameters: { ...project.parameters, bpm } }); else e.target.value = String(project.parameters.bpm) }}/></label><span className="line-play-state" aria-live="polite">{state === 'playing' ? 'Reproduciendo' : state === 'paused' ? 'En pausa' : 'Detenido'}</span></div>
          <p className="line-help">Editar notas, tempo o acompañamiento detiene el preview. Volumen y repetición se pueden cambiar durante la reproducción.</p>
        </div>
        <div className="line-exports"><button className="button secondary" disabled={!track.notes.length} onClick={() => exportMidi(false)}><ArrowDownToLine size={15}/>MIDI de {bass ? 'bajo' : 'melodía'}</button><button className="button secondary" disabled={!track.notes.length || selection.length < 2} onClick={() => exportMidi(true)}><ArrowDownToLine size={15}/>MIDI con acompañamiento</button><span>Exporta las pistas seleccionadas, incluso si están silenciadas.</span></div>
      </>}
    </>}
  </section>
}
