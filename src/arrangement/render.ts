import { projectSchema, type MusicNote, type MusicProject, type MusicTrack } from '../models/project'
import { variantClip } from './clips'
import { harmonyFingerprint } from '../music/lines'
export { sourceClip } from './clips'
import { barBeats } from '../music/theory'

export const arrangementLimits = { beats: 4096, notes: 15000, tracks: 16 } as const
export interface TimelineSection { id: string; name: string; index: number; start: number; end: number; firstBar: number; bars: number }
export interface Arrangement { sections: TimelineSection[]; tracks: MusicTrack[]; end: number; bars: number; seconds: number; warnings: string[] }
/** Layout remains available even when a preview exceeds resource limits. */
export function layoutSections(project: MusicProject): TimelineSection[] {
  const beats = barBeats(project.parameters.timeSignature)
  let bars = 0
  return project.sections.map((section, index) => {
    const start = bars * beats
    const firstBar = bars + 1
    bars += section.bars
    return { id: section.id, name: section.name, index, start, end: bars * beats, firstBar, bars: section.bars }
  })
}
/** Render linked source clips without editing their notes or the persisted v1 project. */
export function renderArrangement(input: MusicProject): Arrangement {
  const project = projectSchema.parse(input)
  const beats = barBeats(project.parameters.timeSignature)
  const sections = layoutSections(project)
  const bars = project.sections.reduce((total, section) => total + section.bars, 0)
  const end = bars * beats
  if (end > arrangementLimits.beats) throw new Error(`El arreglo supera el límite de ${arrangementLimits.beats} negras. Reduce sus compases.`)
  const linked = new Set(project.sections.flatMap(section => section.trackIds))
  const sources = project.tracks.filter(track => linked.has(track.id))
  if (sources.length > arrangementLimits.tracks) throw new Error('El arreglo admite hasta 16 pistas vinculadas. Desvincula algunas pistas.')
  const warnings: string[] = []
  let total = 0
  const tracks = sources.map(track => {
    if (track.drumPattern && track.drumPattern.signature.join('/') !== project.parameters.timeSignature.join('/')) warnings.push(`«${track.name}» conserva el ciclo de batería en ${track.drumPattern.signature.join('/')}; el arreglo usa ${project.parameters.timeSignature.join('/')}.`)
    const notes: MusicNote[] = []
    for (const section of sections) {
      const source = project.sections[section.index]
      if (!source.trackIds.includes(track.id)) continue
      const variantId = source.variantIds?.[track.id]
      const clip = variantClip(track, project.parameters.timeSignature, variantId)
      if (!clip.notes.length) warnings.push(`«${track.name}» en ${section.name} no contiene notas.`)
      const provenance = variantId ? track.variants?.find(variant => variant.id === variantId)?.sourceHarmony : track.sourceHarmony
      if ((track.kind === 'bass' || track.kind === 'melody') && provenance !== harmonyFingerprint(project)) warnings.push(`Revisa ${track.name} en ${section.name}: la armonía cambió o la frase fue editada manualmente.`)
      if (track.kind === 'chords' && variantId && source.trackIds.some(id => project.tracks.some(t => t.id === id && (t.kind === 'bass' || t.kind === 'melody')))) warnings.push(`Revisa bajo y melodía en ${section.name}: utiliza una variante de acordes.`)
      if (track.kind === 'drums' && clip.notes.some(note => ![36, 38, 39, 42, 46, 70].includes(note.pitch))) warnings.push(`«${track.name}» contiene percusión que el preview no sintetiza; se conserva en MIDI.`)
      if (!clip.notes.length || clip.period <= 0) continue
      const duration = section.end - section.start
      for (let offset = 0; offset < duration; offset += clip.period) for (const note of clip.notes) {
        const local = offset + note.start
        if (local >= duration) continue
        notes.push({ ...note, start: section.start + local, duration: Math.min(note.duration, duration - local) })
        if (++total > arrangementLimits.notes) throw new Error('El arreglo supera el límite de 15000 notas. Reduce pistas o compases.')
      }
    }
    notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch)
    // Strip source-only generators: exporters must use these rendered events.
    return { ...track, notes, chords: [], drumPattern: undefined, harmonyKnowledge: undefined, sourceHarmony: undefined, generation: undefined, variants: undefined }
  })
  return { sections, tracks, end, bars, seconds: end * 60 / project.parameters.bpm, warnings: [...new Set(warnings)] }
}
export function moveSection(sections: MusicProject['sections'], id: string, direction: -1 | 1) {
  const index = sections.findIndex(section => section.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= sections.length) return sections
  const next = [...sections]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
