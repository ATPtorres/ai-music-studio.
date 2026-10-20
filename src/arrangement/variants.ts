import { noteSchema, projectSchema, trackSchema, variantSchema, type MusicProject, type MusicTrack, type MusicNote } from '../models/project'
import { harmonyFingerprint, varyLine } from '../music/lines'
import { randomFromSeed } from '../music/random'
import { variantClip } from './clips'

export { instrumentOrder, instrumentNames } from './instruments'
export { createDynamicStructure } from './structure'
type Section = MusicProject['sections'][number]
export function assignVariant(section: Section, trackId: string, variantId: string | null): Section {
  const variantIds = { ...section.variantIds }
  delete variantIds[trackId]
  if (variantId) variantIds[trackId] = variantId
  const trackIds = section.trackIds.filter(id => id !== trackId)
  if (variantId !== null) trackIds.push(trackId)
  return { ...section, trackIds, ...(section.variantIds || Object.keys(variantIds).length ? { variantIds } : {}) }
}
export function variantUsage(project: MusicProject, trackId: string, variantId = '') {
  return project.sections.filter(section => section.trackIds.includes(trackId) && (section.variantIds?.[trackId] ?? '') === variantId)
}
export function duplicateVariant(project: MusicProject, trackId: string, sourceId = '', vary = false, seed = 0) {
  const track = project.tracks.find(item => item.id === trackId)
  if (!track) throw new Error('No existe el instrumento.')
  if ((track.variants?.length ?? 0) >= 32) throw new Error('Cada instrumento admite hasta 32 variantes además de V1.')
  const clip = variantClip(track, project.parameters.timeSignature, sourceId)
  if (!clip.period || !clip.notes.length) throw new Error('Genera una frase con notas antes de crear una variante.')
  let notes = clip.notes.map(note => ({ ...note }))
  const provenance = sourceId ? track.variants?.find(v => v.id === sourceId)?.sourceHarmony : track.sourceHarmony
  if (vary) {
    if (track.kind === 'bass' || track.kind === 'melody') {
      if (provenance !== harmonyFingerprint(project)) throw new Error('Revisa o regenera la frase con la armonía actual antes de variarla. Puedes duplicarla y editarla manualmente.')
      const low = Math.max(0, Math.min(...notes.map(note => note.pitch)) - 7)
      const high = Math.min(127, Math.max(...notes.map(note => note.pitch)) + 7)
      notes = varyLine(project, notes, { low, high, density: 'medium', rhythm: 'straight', complexity: project.parameters.complexity, seed })
    } else if (track.kind === 'chords') {
      // Invert one voice of each chord, retaining pitch classes and timing.
      const changed = new Set<number>()
      notes = notes.map(note => {
        if (changed.has(note.start)) return note
        changed.add(note.start)
        return { ...note, pitch: note.pitch <= 115 ? note.pitch + 12 : note.pitch - 12 }
      })
    } else {
      const random = randomFromSeed(seed)
      notes = notes.map(note => ({ ...note, velocity: Math.max(1, Math.min(127, note.velocity + (random() < 0.5 ? -12 : 9))) }))
      // Add a final snare fill without conflicting with open/closed hats.
      const start = Math.max(0, clip.period - 0.5)
      if (!notes.some(note => note.pitch === 38 && Math.abs(note.start - start) < 1e-8)) notes.push({ pitch: 38, start, duration: Math.min(0.1, clip.period - start), velocity: 100 })
    }
  }
  const names = new Set(['V1', ...(track.variants ?? []).map(v => v.name)])
  let number = 2
  while (names.has(`V${number}`)) number++
  const variant = variantSchema.parse({ id: crypto.randomUUID(), name: `V${number}`, notes, beats: clip.period, ...(provenance ? { sourceHarmony: provenance } : {}) })
  const tracks = project.tracks.map(item => item.id === trackId ? { ...item, variants: [...item.variants ?? [], variant] } : item)
  projectSchema.parse({ ...project, tracks })
  return { tracks, variant }
}
export function editVariantNotes(track: MusicTrack, variantId: string, notes: MusicNote[]): MusicTrack {
  const variant = track.variants?.find(item => item.id === variantId)
  if (!variant) throw new Error('Duplica V1 para editar una copia independiente.')
  const sorted = notes.map(note => noteSchema.parse(note)).sort((a, b) => a.start - b.start || a.pitch - b.pitch)
  if ((track.kind === 'bass' || track.kind === 'melody') && sorted.some((note, i) => i > 0 && note.start < sorted[i - 1].start + sorted[i - 1].duration - 1e-8)) throw new Error('Bajo y melodía son monofónicos: las notas no deben solaparse.')
  if (track.kind === 'drums' && sorted.some((note, i) => [42, 46].includes(note.pitch) && sorted.some((other, j) => i !== j && other.pitch !== note.pitch && [42, 46].includes(other.pitch) && Math.abs(other.start - note.start) < 1e-8))) throw new Error('El hi-hat abierto y el cerrado no pueden empezar juntos.')
  return trackSchema.parse({ ...track, variants: track.variants?.map(item => item.id === variantId ? variantSchema.parse({ ...item, notes: sorted, sourceHarmony: undefined }) : item) })
}
