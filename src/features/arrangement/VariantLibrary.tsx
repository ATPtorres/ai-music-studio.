import { ZodError } from 'zod'
import { useState } from 'react'
import { Copy, Plus, Shuffle, Trash2 } from 'lucide-react'
import { type MusicNote, type MusicProject, type MusicTrack, variantSchema, trackSchema } from '../../models/project'
import { variantClip } from '../../arrangement/clips'
import { assignVariant, duplicateVariant, editVariantNotes, instrumentNames, variantUsage } from '../../arrangement/variants'
import { barBeats, midiToNote } from '../../music/theory'
import PianoRoll from '../lines/PianoRoll'
import '../lines/lines.css'

interface Props {
  project: MusicProject
  selection: { trackId: string; variantId: string }
  select: (selection: { trackId: string; variantId: string }) => void
  update: (change: Partial<MusicProject>) => void
  sectionId?: string
  report: (message: string) => void
}
export default function VariantLibrary({ project, selection, select, update, sectionId, report }: Props) {
  const [selectedNote, setSelectedNote] = useState(-1)
  const track = project.tracks.find(track => track.id === selection.trackId) ?? project.tracks[0]
  if (!track) return <div className="variant-library"><h3>Biblioteca de frases</h3><p className="arrangement-help">Genera tus instrumentos para crear versiones independientes.</p></div>
  const variant = track.variants?.find(item => item.id === selection.variantId)
  const variantId = variant?.id ?? ''
  let clip = { notes: [] as MusicNote[], period: 0 }
  let clipError = ''
  try { clip = variantClip(track, project.parameters.timeSignature, variantId) }
  catch (error) { clipError = error instanceof Error ? error.message : 'No se pudo abrir esta frase.' }
  const end = Math.max(clip.period, barBeats(project.parameters.timeSignature))
  const usage = variantUsage(project, track.id, variantId)
  const section = project.sections.find(item => item.id === sectionId)
  const attempt = (action: () => void) => { try { action(); return true } catch (error) { report(error instanceof ZodError ? error.issues[0]?.message ?? 'Revisa la variante.' : error instanceof Error ? error.message : 'No se pudo editar la variante.'); return false } }
  const saveTrack = (next: MusicTrack) => { const validated = trackSchema.parse(next); update({ tracks: project.tracks.map(item => item.id === track.id ? validated : item) }) }
  const duplicate = (vary: boolean) => attempt(() => {
    const result = duplicateVariant(project, track.id, variantId, vary, crypto.getRandomValues(new Uint32Array(1))[0])
    update({ tracks: result.tracks }); select({ trackId: track.id, variantId: result.variant.id }); setSelectedNote(-1)
    report(`${result.variant.name} creada. La frase anterior se conserva. Asígnala a las secciones donde quieras escucharla.`)
  })
  const saveNotes = (notes: MusicNote[]) => attempt(() => { saveTrack(editVariantNotes(track, variantId, notes)); setSelectedNote(-1); report('Variante editada. Revisa su armonía después de editar notas manualmente.') })
  const note = clip.notes[selectedNote]
  const low = track.kind === 'drums' ? 36 : Math.max(0, Math.min(track.kind === 'bass' ? 36 : 60, ...clip.notes.map(note => note.pitch)) - 2)
  const high = track.kind === 'drums' ? 70 : Math.min(127, Math.max(track.kind === 'bass' ? 48 : 72, ...clip.notes.map(note => note.pitch)) + 2)
  const changeNote = (change: Partial<MusicNote>) => { if (note) return saveNotes(clip.notes.map((item, i) => i === selectedNote ? { ...item, ...change } : item)) }
  const addNote = (pitch?: number, start?: number) => {
    const duration = track.kind === 'drums' ? 0.1 : 0.5
    if (start === undefined) {
      start = 0
      while (start < clip.period && clip.notes.some(note => note.start < start! + duration && note.start + note.duration > start!)) start += 0.5
      if (start >= clip.period) { report('No hay espacio libre. Selecciona una nota para acortarla o eliminarla.'); return }
    }
    saveNotes([...clip.notes, { pitch: pitch ?? (track.kind === 'drums' ? 36 : low + 2), start, duration: Math.min(duration, clip.period - start), velocity: 90 }])
  }
  return <section className="variant-library instrument-theme" data-instrument={track.kind} aria-label="Biblioteca de variantes">
    <div className="section-heading"><div><div className="eyebrow">FRASES INDEPENDIENTES</div><h3>Biblioteca de {instrumentNames[track.kind].toLowerCase()}</h3></div><span>{clip.notes.length} notas · {Number((clip.period / barBeats(project.parameters.timeSignature)).toFixed(2))} compases</span></div>
    <div className="variant-controls"><label>Instrumento<select aria-label="Instrumento de la biblioteca" value={track.id} onChange={e => { select({ trackId: e.target.value, variantId: '' }); setSelectedNote(-1) }}>{project.tracks.map(item => <option key={item.id} value={item.id}>{instrumentNames[item.kind]} · {item.name}</option>)}</select></label><label>Frase<select aria-label="Variante de la biblioteca" value={variantId} onChange={e => { select({ trackId: track.id, variantId: e.target.value }); setSelectedNote(-1) }}><option value="">V1 · Original del generador</option>{track.variants?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    {clipError && <p className="arrangement-error" role="alert">{clipError} Las demás frases siguen disponibles en el selector.</p>}
    <p className="variant-usage">Se utiliza en: {usage.length ? usage.map(item => item.name || 'Sin nombre').join(', ') : 'ninguna sección'}. {variant ? 'Editar esta frase actualiza todas esas secciones. Duplica para cambiar solo una copia.' : 'V1 sigue los cambios del generador. Duplica para conservar y editar una versión independiente.'}</p>
    <div className="arrangement-actions"><button className="button secondary" disabled={!clip.notes.length || (track.variants?.length ?? 0) >= 32} onClick={() => duplicate(false)}><Copy size={15}/>Duplicar para editar</button><button className="button secondary" disabled={!clip.notes.length || (track.variants?.length ?? 0) >= 32} onClick={() => duplicate(true)}><Shuffle size={15}/>Crear variación</button><button className="button primary" disabled={!section} onClick={() => { if (section) { update({ sections: project.sections.map(item => item.id === section.id ? assignVariant(item, track.id, variantId) : item) }); report(`Frase asignada a ${section.name}. Usa Reproducir desde esta sección para escucharla.`) } }}>Asignar a {section?.name || 'sección'}</button></div>
    {variant && <div className="variant-controls" key={variant.id}><label>Nombre de la variante<input aria-label="Nombre de la variante" maxLength={100} defaultValue={variant.name} onBlur={e => { const name = e.target.value.trim(); if (name) attempt(() => { try { saveTrack({ ...track, variants: track.variants?.map(v => v.id === variant.id ? { ...v, name } : v) }) } catch (error) { e.target.value = variant.name; throw error } }); else e.target.value = variant.name }}/></label><label>Ciclo · compases<input aria-label="Compases de la variante" type="number" min={0.25} max={512} step={0.25} defaultValue={variant.beats / barBeats(project.parameters.timeSignature)} onBlur={e => attempt(() => { const beats = Number(e.target.value) * barBeats(project.parameters.timeSignature); const result = variantSchema.safeParse({ ...variant, beats }); if (!result.success || beats > 512 * barBeats(project.parameters.timeSignature)) { e.target.value = String(variant.beats / barBeats(project.parameters.timeSignature)); throw new Error('El ciclo debe contener todas las notas y no superar 512 compases ni 4096 negras.') }; saveTrack({ ...track, variants: track.variants?.map(v => v.id === variant.id ? result.data : v) }) })}/></label></div>}
    {variant ? <><p className="arrangement-help">Edita las notas de esta copia. Puedes usar el piano roll o los controles con teclado. En batería: 36 bombo, 38 caja, 39 clap, 42/46 hi-hat y 70 shaker.</p><PianoRoll key={`${track.id}:${variantId}`} notes={clip.notes} low={low} high={high} end={end} beatsPerBar={barBeats(project.parameters.timeSignature)} selected={selectedNote} onSelect={setSelectedNote} onAdd={(pitch, start) => { if (start < clip.period) addNote(pitch, start) }}/><div className="arrangement-actions variant-note-actions"><button className="button secondary" onClick={() => addNote()}><Plus size={15}/>Añadir nota a variante</button><label>Seleccionar nota<select aria-label="Nota de la variante" value={selectedNote} onChange={e => setSelectedNote(Number(e.target.value))}><option value={-1}>Selecciona una nota</option>{clip.notes.map((n, i) => <option key={i} value={i}>{i + 1}. {midiToNote(n.pitch)} · {n.start}</option>)}</select></label></div>{note && <div className="note-editor" key={`${variant.id}-${selectedNote}-${JSON.stringify(note)}`}><label>Altura<select aria-label="Altura en variante" value={note.pitch} onChange={e => changeNote({ pitch: Number(e.target.value) })}>{(track.kind === 'drums' ? [36, 38, 39, 42, 46, 70] : Array.from({ length: 128 }, (_, i) => i)).map(p => <option key={p} value={p}>{midiToNote(p)} · {p}</option>)}</select></label>{(['start', 'duration', 'velocity'] as const).map((field, i) => <label key={field}>{['Inicio · negras', 'Duración · negras', 'Velocidad'][i]}<input aria-label={`Variante ${field}`} type="number" min={field === 'start' ? 0 : field === 'duration' ? 0.01 : 1} max={field === 'velocity' ? 127 : clip.period} step={field === 'velocity' ? 1 : 0.25} defaultValue={note[field]} onBlur={e => { const value = Number(e.target.value); const parsed = noteSchemaSafe({ ...note, [field]: value }); if (parsed) { if (!changeNote({ [field]: value })) e.target.value = String(note[field]) } else { e.target.value = String(note[field]); report('Revisa el valor de la nota.') } }}/></label>)}<button className="button secondary" onClick={() => saveNotes(clip.notes.filter((_, i) => i !== selectedNote))}><Trash2 size={15}/>Eliminar nota</button></div>}<button className="text-button variant-delete" onClick={() => { if (window.confirm(`¿Eliminar ${variant.name}? Sus bloques quedarán en silencio en ${usage.length} secciones. V1 y las demás variantes se conservan.`)) { update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, variants: item.variants?.filter(v => v.id !== variantId) } : item), sections: project.sections.map(item => item.variantIds?.[track.id] === variantId ? assignVariant(item, track.id, null) : item) }); select({ trackId: track.id, variantId: '' }); setSelectedNote(-1) } }}>Eliminar variante</button></> : <p className="arrangement-help">Los controles de edición de V1 están en su generador. Las copias se editan aquí y se conservan al regenerar el instrumento.</p>}
  </section>
}
function noteSchemaSafe(note: MusicNote) { return Number.isFinite(note.start) && note.start >= 0 && Number.isFinite(note.duration) && note.duration > 0 && Number.isInteger(note.velocity) && note.velocity >= 1 && note.velocity <= 127 }
