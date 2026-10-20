import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { createProject, projectSchema, type MusicProject } from '../models/project'
import { generateProgression, withChordTrack } from '../music/harmony'
import { generateLine, harmonyFingerprint, withLineTrack } from '../music/lines'
import { generateDrumPattern, withDrumTrack } from '../music/drums'
import { parseProject } from '../services/persistence'
import { applyLyricsDraft } from '../features/lyrics/lyricsProject'
import { exportArrangementMidi } from '../midi/exportArrangement'
import { assignVariant, createDynamicStructure, duplicateVariant, editVariantNotes, variantUsage } from './variants'
import { renderArrangement, sourceClip } from './render'
import { variantClip } from './clips'

function fixture(): MusicProject {
  let project = createProject()
  project = { ...project, tracks: withChordTrack(project, generateProgression({ key: 'A', mode: 'minor', bars: 2, signature: [4, 4], genre: 'Pop', mood: 'Sereno', complexity: 'simple', chordType: 'triad', seed: 5 }), 'Acordes') }
  for (const kind of ['bass', 'melody'] as const) project.tracks = withLineTrack(project, kind, generateLine(project, kind, { low: kind === 'bass' ? 36 : 60, high: kind === 'bass' ? 52 : 84, density: 'medium', rhythm: 'straight', complexity: 'simple', seed: 4 }))
  project.tracks = withDrumTrack(project, generateDrumPattern('Pop', 1, [4, 4], 0.3))
  project.sections = [{ id: 'intro', name: 'Intro', bars: 1, trackIds: project.tracks.map(t => t.id), lyrics: 'Mi letra' }]
  return project
}
describe('Biblioteca y asignación de variantes', () => {
  it('lee proyectos previos como originales y no altera sus eventos ni letras', () => {
    const project = fixture()
    expect(parseProject(JSON.stringify(project))).toEqual(project)
    expect(project.tracks.every(t => t.variants === undefined)).toBe(true)
    expect(project.sections[0].variantIds).toBeUndefined()
    expect(renderArrangement(project).tracks.every(t => t.notes.length > 0)).toBe(true)
  })
  it('duplica sin compartir notas; conserva el ciclo y el timbre de la fila', () => {
    const project = fixture(); const original = structuredClone(project)
    const track = project.tracks[3]
    const result = duplicateVariant(project, track.id)
    expect(project).toEqual(original)
    expect(result.variant.notes).toEqual(sourceClip(track, [4, 4]).notes)
    expect(result.variant.beats).toBe(4)
    expect(result.variant.name).toBe('V2')
    result.variant.notes[0].pitch = 99
    expect(project).toEqual(original)
  })
  it('crea una variación armónica sin reemplazar V1 y bloquea fuentes obsoletas', () => {
    const project = fixture(); const track = project.tracks[1]
    const before = structuredClone(track.notes)
    const result = duplicateVariant(project, track.id, '', true, 12)
    expect(result.variant.notes).not.toEqual(before)
    expect(track.notes).toEqual(before)
    expect(result.variant.sourceHarmony).toBe(harmonyFingerprint(project))
    for (const note of result.variant.notes) {
      const chord = project.tracks[0].chords.find(c => note.start >= c.start && note.start < c.start + c.duration)!
      expect(chord.pitches.map(p => p % 12)).toContain(note.pitch % 12)
    }
    project.parameters.key = 'C'
    expect(() => duplicateVariant(project, track.id, '', true, 1)).toThrow(/armonía/)
    expect(() => duplicateVariant(project, track.id)).not.toThrow()
  })
  it('varía acordes y batería sin cambiar los originales ni colisionar hi-hats', () => {
    const project = fixture()
    for (const track of [project.tracks[0], project.tracks[3]]) {
      const before = structuredClone(track)
      const result = duplicateVariant(project, track.id, '', true, 2)
      expect(result.variant.notes).not.toEqual(sourceClip(track, [4, 4]).notes)
      expect(track).toEqual(before)
      if (track.kind === 'chords') expect(result.variant.notes.map(n => n.pitch % 12)).toEqual(sourceClip(track, [4, 4]).notes.map(n => n.pitch % 12))
      expect(projectSchema.safeParse({ ...project, tracks: result.tracks }).success).toBe(true)
    }
  })
  it('cambia la versión por sección, vuelve a V1 y retira bloques sin borrar frases', () => {
    const project = fixture(); const id = project.tracks[2].id
    const result = duplicateVariant(project, id)
    project.tracks = result.tracks
    project.sections[0] = assignVariant(project.sections[0], id, result.variant.id)
    expect(variantUsage(project, id, result.variant.id)).toHaveLength(1)
    expect(variantUsage(project, id)).toHaveLength(0)
    expect(parseProject(JSON.stringify(project))).toEqual(project)
    project.sections[0] = assignVariant(project.sections[0], id, '')
    expect(project.sections[0].variantIds?.[id]).toBeUndefined()
    project.sections[0] = assignVariant(project.sections[0], id, null)
    expect(project.sections[0].trackIds).not.toContain(id)
    expect(project.tracks[2].variants).toHaveLength(1)
    expect(project.sections[0].lyrics).toBe('Mi letra')
  })
  it('repite versiones de distinta longitud, recorta finales y exporta los mismos eventos MIDI', () => {
    const project = fixture(); const id = project.tracks[2].id
    const result = duplicateVariant(project, id)
    project.tracks = result.tracks
    const variant = project.tracks[2].variants![0]
    variant.notes = [{ pitch: 77, start: 0, duration: 6, velocity: 83 }]; variant.beats = 8
    project.sections = [assignVariant({ ...project.sections[0], trackIds: [], bars: 3 }, id, variant.id), { id: 'silence', name: 'Silencio', bars: 1, trackIds: [], lyrics: '' }]
    const rendered = renderArrangement(project)
    expect(rendered.tracks[0].notes).toEqual([{ pitch: 77, start: 0, duration: 6, velocity: 83 }, { pitch: 77, start: 8, duration: 4, velocity: 83 }])
    const midi = new Midi(exportArrangementMidi(project))
    expect(midi.tracks[0].notes.map(n => [n.midi, n.ticks / midi.header.ppq, n.durationTicks / midi.header.ppq])).toEqual([[77, 0, 6], [77, 8, 4]])
    expect(rendered.end).toBe(16)
  })
  it('editar una copia no altera V1; valida límites, monofonía y percusión', () => {
    const project = fixture(); const result = duplicateVariant(project, project.tracks[1].id)
    const track = result.tracks[1]; const variant = result.variant
    const before = structuredClone(track.notes)
    const changed = editVariantNotes(track, variant.id, [{ pitch: 48, start: 0, duration: 1, velocity: 70 }])
    expect(changed.notes).toEqual(before)
    expect(changed.variants![0].sourceHarmony).toBeUndefined()
    expect(() => editVariantNotes(track, '', [])).toThrow(/Duplica/)
    expect(() => editVariantNotes(track, variant.id, [{ pitch: 60, start: 0, duration: 2, velocity: 90 }, { pitch: 62, start: 1, duration: 1, velocity: 90 }])).toThrow(/monofónicos/)
    expect(() => editVariantNotes(track, variant.id, [{ pitch: 60, start: 0, duration: 100, velocity: 90 }])).toThrow()
    const drum = duplicateVariant(project, project.tracks[3].id)
    expect(() => editVariantNotes(drum.tracks[3], drum.variant.id, [{ pitch: 37, start: 0, duration: 0.1, velocity: 90 }])).toThrow()
    expect(() => editVariantNotes(drum.tracks[3], drum.variant.id, [42, 46].map(pitch => ({ pitch, start: 0, duration: 0.1, velocity: 80 })))).toThrow(/hi-hat/)
  })
  it('preserva todas las variantes al regenerar cualquiera de los cuatro instrumentos', () => {
    const project = fixture()
    for (const track of [...project.tracks]) project.tracks = duplicateVariant(project, track.id).tracks
    const before = project.tracks.map(t => structuredClone(t.variants))
    project.tracks = withChordTrack(project, project.tracks[0].chords, 'Acordes')
    project.tracks = withLineTrack(project, 'bass', project.tracks[1].notes)
    project.tracks = withLineTrack(project, 'melody', project.tracks[2].notes)
    project.tracks = withDrumTrack(project, project.tracks[3].drumPattern!)
    expect(project.tracks.map(t => t.variants)).toEqual(before)
  })
  it('rechaza referencias rotas, IDs duplicados, ciclos inválidos y percusión desconocida', () => {
    const project = fixture(); const id = project.tracks[2].id
    project.sections[0].variantIds = { [id]: 'missing' }
    expect(projectSchema.safeParse(project).success).toBe(false)
    project.tracks = duplicateVariant({ ...project, sections: [] }, id).tracks
    project.sections[0].variantIds = { [id]: project.tracks[2].variants![0].id }
    project.sections[0].trackIds = []
    expect(projectSchema.safeParse(project).success).toBe(false)
    project.sections = []
    project.tracks[2].variants!.push(project.tracks[2].variants![0])
    expect(projectSchema.safeParse(project).success).toBe(false)
    expect(() => variantClip(project.tracks[0], [4, 4], 'missing')).toThrow(/No existe/)
    const fresh = fixture(); const drum = duplicateVariant(fresh, fresh.tracks[3].id)
    drum.variant.notes[0].pitch = 99
    expect(projectSchema.safeParse({ ...fresh, tracks: drum.tracks }).success).toBe(false)
  })
  it('la plantilla alterna instrumentos, usa V2 si existe y conserva las fuentes', () => {
    const project = fixture(); project.tracks = duplicateVariant(project, project.tracks[1].id).tracks
    const before = structuredClone(project)
    const sections = createDynamicStructure(project)
    expect(sections.map(s => s.bars)).toEqual([4, 8, 8, 4, 8, 8, 4])
    expect(sections[0].trackIds.map(id => project.tracks.find(t => t.id === id)!.kind)).toEqual(['chords', 'melody'])
    expect(sections[3].trackIds).toEqual([project.tracks[0].id])
    expect(sections[4].variantIds![project.tracks[1].id]).toBe(project.tracks[1].variants![0].id)
    expect(project).toEqual(before)
    expect(projectSchema.safeParse({ ...project, sections }).success).toBe(true)
    const lyrics = applyLyricsDraft({ ...project, sections }, { title: 'Nuevo título', sections: [{ name: 'Intro nueva', lyrics: 'Hola' }] })
    expect(lyrics.sections[4]).toEqual(sections[4])
  })
})
