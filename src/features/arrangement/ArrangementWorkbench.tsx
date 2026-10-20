import TrackSoundSelector from '../../sounds/TrackSoundSelector'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowUp, Copy, ListMusic, Pause, Play, Plus, Square, Trash2 } from 'lucide-react'
import type { MusicProject } from '../../models/project'
import { layoutSections, moveSection, renderArrangement } from '../../arrangement/render'
import { TrackPlayer, type PreviewTrack } from '../../audio/TrackPlayer'
import type { PlaybackState } from '../../audio/ChordPlayer'
import { downloadArrangementMidi } from '../../midi/exportArrangement'
import { barBeats } from '../../music/theory'
import { assignVariant, createDynamicStructure, instrumentNames, instrumentOrder } from '../../arrangement/variants'
import ArrangementTimeline from './ArrangementTimeline'
import VariantLibrary from './VariantLibrary'
import './arrangement.css'

type Section = MusicProject['sections'][number]
interface Props { project: MusicProject; update: (change: Partial<MusicProject>) => void; saveStatus: string; onOpenLyrics: () => void; onOpenTools: () => void }
function clock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }
function TempoControl({ bpm, commit, report }: { bpm: number; commit: (value: number) => void; report: (message: string) => void }) {
  const [text, setText] = useState(String(bpm))
  const save = () => {
    const value = Number(text)
    if (!Number.isInteger(value) || value < 30 || value > 300) { setText(String(bpm)); report('El tempo debe ser un entero entre 30 y 300 BPM.'); return }
    if (value !== bpm) commit(value)
  }
  return <label className="arrangement-tempo">BPM<input aria-label="BPM" type="number" min={30} max={300} value={text} onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/></label>
}
function SectionEditor({ section, edit, report }: { section: Section; edit: (change: Partial<Section>) => void; report: (message: string) => void }) {
  const [bars, setBars] = useState(String(section.bars))
  const commitBars = () => {
    const value = Number(bars)
    if (!Number.isInteger(value) || value < 1 || value > 512) { setBars(String(section.bars)); report('Cada sección necesita entre 1 y 512 compases enteros.'); return }
    if (value !== section.bars) edit({ bars: value })
  }
  return <><div className="arrangement-section-fields"><label>Nombre de la sección<input maxLength={100} value={section.name} onChange={e => edit({ name: e.target.value })}/></label><label>Compases de la sección<input type="number" min={1} max={512} value={bars} onChange={e => setBars(e.target.value)} onBlur={commitBars} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/></label></div><label>Letra de esta sección<textarea aria-label="Letra de esta sección" maxLength={20000} rows={4} value={section.lyrics} onChange={e => edit({ lyrics: e.target.value })} placeholder="La letra del editor de Fase 5 se conserva aquí."/></label></>
}
export default function ArrangementWorkbench({ project, update, saveStatus, onOpenLyrics, onOpenTools }: Props) {
  const [selected, setSelected] = useState(project.sections[0]?.id ?? '')
  const [zoom, setZoom] = useState(36)
  const [librarySelection, setLibrarySelection] = useState({ trackId: project.tracks[0]?.id ?? '', variantId: '' })
  const [message, setMessage] = useState('')
  const [state, setState] = useState<PlaybackState>('stopped')
  const [starting, setStarting] = useState(false)
  const [loop, setLoop] = useState(false)
  const [beat, setBeat] = useState(0)
  const engine = useRef<TrackPlayer | null>(null)
  const rendered = useMemo(() => {
    try { return { arrangement: renderArrangement(project), error: '' } }
    catch (error) { return { arrangement: null, error: error instanceof Error ? error.message : 'No se pudo preparar el arreglo.' } }
  }, [project])
  const arrangement = rendered.arrangement
  const timeline = arrangement?.sections ?? layoutSections(project)
  const end = arrangement?.end ?? 0
  const scoreJson = useMemo(() => JSON.stringify((arrangement?.tracks ?? []).map(track => ({ id: track.id, kind: track.kind, sound: track.sound, notes: track.notes, volume: 0, muted: false }))), [arrangement])
  const mixJson = useMemo(() => JSON.stringify((arrangement?.tracks ?? []).map(track => ({ id: track.id, volume: track.volume, muted: track.muted }))), [arrangement])
  useEffect(() => {
    const player = new TrackPlayer(next => { setState(next); setBeat(player.getBeat()) })
    engine.current = player
    return () => { player.dispose(); engine.current = null }
  }, [])
  useEffect(() => { engine.current?.configure(JSON.parse(scoreJson) as PreviewTrack[], project.parameters.bpm, end) }, [scoreJson, project.parameters.bpm, end])
  useEffect(() => { engine.current?.setLoop(loop) }, [loop, scoreJson])
  useEffect(() => { for (const item of JSON.parse(mixJson) as { id: string; volume: number; muted: boolean }[]) engine.current?.setMix(item.id, item.volume, item.muted) }, [mixJson, scoreJson, project.parameters.bpm, end])
  useEffect(() => {
    if (state !== 'playing') return
    const timer = window.setInterval(() => setBeat(engine.current?.getBeat() ?? 0), 80)
    return () => window.clearInterval(timer)
  }, [state])
  const section = project.sections.find(item => item.id === selected) ?? project.sections[0]
  const index = project.sections.findIndex(item => item.id === section?.id)
  const current = timeline.find(item => beat >= item.start && beat < item.end)
  const sounding = Boolean(arrangement?.tracks.some(track => track.notes.length))
  const commit = (sections: Section[]) => { engine.current?.stop(); update({ sections }) }
  const edit = (change: Partial<Section>) => { if (section) commit(project.sections.map(item => item.id === section.id ? { ...item, ...change } : item)) }
  const add = () => {
    if (project.sections.length >= 100) return
    const next = { id: crypto.randomUUID(), name: `Sección ${project.sections.length + 1}`, bars: 8, trackIds: [], lyrics: '' }
    commit([...project.sections, next]); setSelected(next.id)
  }
  const play = async (from?: number) => {
    setStarting(true)
    try {
      if (from !== undefined) { engine.current?.stop(); engine.current?.seek(from) }
      await engine.current?.play(); setMessage('')
    } catch (error) { setMessage(`No se pudo iniciar el audio: ${error instanceof Error ? error.message : 'revisa el permiso de sonido'}`) }
    finally { setStarting(false) }
  }
  const assign = (id: string, trackId: string, variantId: string | null) => commit(project.sections.map(item => item.id === id ? assignVariant(item, trackId, variantId) : item))
  const linkAll = () => {
    if (!section) return
    if (project.tracks.length > 16) { setMessage('Vincula manualmente un máximo de 16 pistas al arreglo.'); return }
    edit({ trackIds: project.tracks.map(track => track.id) })
  }
  const createStructure = () => {
    if (project.sections.length && !window.confirm('¿Reemplazar la estructura y sus letras por la plantilla? Exporta una copia JSON si quieres conservarla. Las pistas y variantes se conservan.')) return
    const sections = createDynamicStructure(project)
    commit(sections); setSelected(sections[0].id)
    const missing = instrumentOrder.filter(kind => !project.tracks.some(track => track.kind === kind)).map(kind => instrumentNames[kind])
    setMessage(`Plantilla creada con entradas y salidas por sección.${missing.length ? ` Instrumentos por generar: ${missing.join(', ')}.` : ''} Verso 2 usa la primera variante de bajo y melodía si existe; puedes crearla en la biblioteca.`)
  }
  const changeLibrary = (change: Partial<MusicProject>) => { engine.current?.stop(); update(change) }
  const mix = (id: string, change: Partial<MusicProject['tracks'][number]>) => update({ tracks: project.tracks.map(track => track.id === id ? { ...track, ...change } : track) })
  const exportMidi = () => { try { downloadArrangementMidi(project); setMessage('MIDI del arreglo preparado, con marcadores de sección y silencio final.') } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo exportar el arreglo.') } }
  const selectedTimeline = timeline.find(item => item.id === section?.id)
  return <section className="arrangement-workbench" aria-label="Estudio de arreglo">
    <p className="arrangement-save" role="status">{saveStatus}</p>
    <div className="arrangement-intro"><span className="icon-box yellow"><ListMusic size={26}/></span><div><div className="eyebrow">DE LAS PARTES A LA CANCIÓN</div><h2>Construye el recorrido de tu música.</h2><p>Diseña las entradas, los silencios y las variantes que hacen avanzar tu canción.</p></div></div>
    <div className="arrangement-overview"><div><strong>{arrangement?.bars ?? '—'}</strong><span>compases · {project.parameters.timeSignature.join('/')}</span></div><div><strong>{arrangement ? clock(arrangement.seconds) : '—'}</strong><span>duración del arreglo</span></div><div><strong>{arrangement?.tracks.length ?? 0}</strong><span>pistas vinculadas</span></div></div>
    <div className="arrangement-transport" aria-label="Transporte del arreglo"><div className="arrangement-play"><button className="button primary" disabled={!sounding || !!rendered.error || starting || state === 'playing'} onClick={() => { void play() }}><Play size={16}/>{starting ? 'Iniciando…' : state === 'paused' ? 'Reanudar arreglo' : 'Reproducir arreglo'}</button><button className="button secondary" disabled={state !== 'playing'} onClick={() => engine.current?.pause()}><Pause size={16}/>Pausar</button><button className="button secondary" onClick={() => engine.current?.stop()}><Square size={16}/>Detener</button></div><label className="arrangement-check"><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)}/>Repetir arreglo</label><TempoControl bpm={project.parameters.bpm} commit={value => { engine.current?.stop(); update({ parameters: { ...project.parameters, bpm: value } }) }} report={setMessage}/><span className="arrangement-position" role="status">{state === 'playing' ? 'Reproduciendo' : state === 'paused' ? 'En pausa' : 'Detenido'} · {clock(beat * 60 / project.parameters.bpm)}{current ? ` · ${current.name || 'Sin nombre'}` : ''}</span></div>
    {current && state !== 'stopped' && <div className="arrangement-current-lyrics" aria-label="Letra de sección en reproducción"><strong>{current.name || 'Sin nombre'}</strong><p>{project.sections[current.index].lyrics || 'Esta sección no tiene letra.'}</p></div>}
    {rendered.error && <p className="arrangement-error" role="alert">{rendered.error}</p>}
    {message && <p className="arrangement-message" role="status">{message}</p>}
    {arrangement?.warnings.map(warning => <p className="arrangement-message" key={warning}>{warning}</p>)}
    <div className="section-heading"><h3>Línea de tiempo</h3><div className="arrangement-actions"><button className="text-button" onClick={onOpenTools}>Abrir generadores</button><button className="text-button" onClick={onOpenLyrics}>Abrir letras</button></div></div>
    <p className="arrangement-help">Elige una frase en cada bloque para añadir el instrumento, o Silencio para retirarlo. Cada frase se repite desde su inicio y se recorta al final de la sección. Los cambios del arreglo detienen el audio; volumen y silencio se aplican mientras suena.</p>
    {!project.sections.length && <div className="arrangement-empty"><h3>Empieza con una estructura</h3><p>Crea una canción con Intro, Versos, Coros, Break y Outro. Cada sección tendrá una combinación distinta de instrumentos disponibles.</p><button className="button primary" onClick={createStructure}>Crear estructura inicial</button></div>}
    <div className="gantt-toolbar"><div className="gantt-legend">{instrumentOrder.map(kind => <span className="instrument-theme" data-instrument={kind} key={kind}><i/>{instrumentNames[kind]}</span>)}</div><label>Zoom · compases<select aria-label="Zoom de la línea de tiempo" value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={24}>Compacto</option><option value={36}>Normal</option><option value={56}>Ampliado</option></select></label><button className="button secondary" onClick={createStructure}>Aplicar plantilla dinámica</button></div>
    {timeline.length > 0 && <ArrangementTimeline project={project} timeline={timeline} selected={section?.id} current={current?.id} beat={beat} playing={state !== 'stopped'} zoom={zoom} select={setSelected} assign={assign} openLibrary={(trackId, variantId) => setLibrarySelection({ trackId, variantId })}/>}
    <div className="arrangement-actions arrangement-section-actions"><button className="button secondary" disabled={project.sections.length >= 100} onClick={add}><Plus size={16}/>Añadir sección</button>{section && <><button className="button secondary" disabled={index <= 0} onClick={() => commit(moveSection(project.sections, section.id, -1))}><ArrowUp size={15}/>Mover antes</button><button className="button secondary" disabled={index >= project.sections.length - 1} onClick={() => commit(moveSection(project.sections, section.id, 1))}><ArrowDown size={15}/>Mover después</button><button className="button secondary" disabled={project.sections.length >= 100} onClick={() => { const copy = { ...section, id: crypto.randomUUID(), name: `${section.name} (copia)`.slice(0, 100), trackIds: [...section.trackIds], ...(section.variantIds ? { variantIds: { ...section.variantIds } } : {}) }; const sections = [...project.sections]; sections.splice(index + 1, 0, copy); commit(sections); setSelected(copy.id) }}><Copy size={15}/>Duplicar sección</button><button className="button secondary" onClick={() => { if (window.confirm(`¿Eliminar «${section.name}» con su letra y sus vínculos? Las pistas originales se conservan.`)) { commit(project.sections.filter(item => item.id !== section.id)); setSelected(project.sections[index + 1]?.id ?? project.sections[index - 1]?.id ?? '') } }}><Trash2 size={15}/>Eliminar sección</button></>}</div>
    {section && <div className="arrangement-editor"><label>Sección a editar<select aria-label="Sección a editar" value={section.id} onChange={e => setSelected(e.target.value)}>{project.sections.map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {item.name || 'Sin nombre'}</option>)}</select></label><SectionEditor key={section.id} section={section} edit={edit} report={setMessage}/><div className="arrangement-actions"><button className="button secondary" disabled={!project.tracks.length} onClick={linkAll}>Vincular todas a esta sección</button><button className="button secondary" disabled={!section.trackIds.length} onClick={() => edit({ trackIds: [], variantIds: {} })}>Desvincular todas de esta sección</button><button className="button secondary" disabled={!sounding || !selectedTimeline || starting} onClick={() => { if (selectedTimeline) void play(selectedTimeline.start) }}>Reproducir desde esta sección</button></div></div>}
    {section && <div className="section-instruments" aria-label="Instrumentos de la sección">{project.tracks.map(track => <label className="instrument-theme" data-instrument={track.kind} key={track.id}>{instrumentNames[track.kind]} · {track.name}<select aria-label={`Frase de ${track.name} en sección seleccionada`} value={section.trackIds.includes(track.id) ? section.variantIds?.[track.id] ?? '' : '__silence'} onChange={e => assign(section.id, track.id, e.target.value === '__silence' ? null : e.target.value)}><option value="__silence">Silencio</option><option value="">V1 · Original</option>{track.variants?.map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>)}</div>}
    <div id="variant-library"><VariantLibrary key={`${librarySelection.trackId}:${librarySelection.variantId}`} project={project} selection={librarySelection} select={setLibrarySelection} update={changeLibrary} sectionId={section?.id} report={setMessage}/></div>
    <div className="section-heading"><h3>Mezcla del proyecto</h3><span>Guardado por pista</span></div>
    <div className="arrangement-mixer">{project.tracks.map(track => <div className="arrangement-mix-track instrument-theme" data-instrument={track.kind} key={track.id}><div className="arrangement-track-sound"><strong>{track.name}</strong><TrackSoundSelector track={track} kind={track.kind} compact label={`Sonido ${track.name}`} onChange={sound => { engine.current?.stop(); mix(track.id, { sound }) }}/></div><label className="arrangement-check"><input type="checkbox" checked={track.muted} onChange={e => mix(track.id, { muted: e.target.checked })} aria-label={`Silenciar ${track.name}`}/>Silenciar</label><label>Volumen · {Math.round(track.volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={e => mix(track.id, { volume: Number(e.target.value) })} aria-label={`Volumen ${track.name}`}/></label><label>Canal MIDI<select value={track.channel} disabled={track.kind === 'drums'} aria-label={`Canal MIDI ${track.name}`} onChange={e => { engine.current?.stop(); mix(track.id, { channel: Number(e.target.value) }) }}>{(track.kind === 'drums' ? [9] : Array.from({ length: 16 }, (_, i) => i).filter(i => i !== 9)).map(value => <option key={value} value={value}>{value + 1}</option>)}</select></label></div>)}{!project.tracks.length && <p className="arrangement-help">Las pistas aparecerán aquí al generarlas o importar un proyecto.</p>}</div>
    <div className="arrangement-export"><button className="button primary" disabled={!sounding || !!rendered.error} onClick={exportMidi}><ArrowDownToLine size={16}/>Descargar MIDI del arreglo</button><p>El MIDI incluye las pistas vinculadas, también las silenciadas. El volumen y el silencio afectan al preview; las velocidades MIDI originales se conservan. Usa canales distintos para exportar varias pistas.</p></div>
    <p className="arrangement-help">Las secciones y la mezcla viajan en el JSON del proyecto. V1 sigue la pista del generador. Las variantes son copias independientes; editar una actualiza todos sus bloques. El compás actual tiene {barBeats(project.parameters.timeSignature)} negras; la duración se calcula con los compases y el BPM, sin ajustar las notas automáticamente a la duración objetivo.</p>
  </section>
}
