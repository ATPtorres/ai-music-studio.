import { describe, expect, it } from 'vitest'
import { createProject, drumPatternSchema, projectSchema } from '../models/project'
import { drumGenres, drumLanes, drumPatternEnd, drumPatternNotes, drumSelection, editDrumStep, generateDrumPattern, repeatDrumNotes, stepsPerBar, varyDrumPattern, withDrumTrack } from './drums'
import { parseProject } from '../services/persistence'
describe('Motor de batería', () => {
  it('genera patrones distintos por género con notas GM y rangos correctos', () => {
    const patterns = drumGenres.map(genre => generateDrumPattern(genre, 2, [4, 4]))
    expect(new Set(patterns.map(pattern => JSON.stringify(pattern.lanes))).size).toBe(drumGenres.length)
    for (const pattern of patterns) {
      expect(drumPatternSchema.safeParse(pattern).success).toBe(true)
      expect(Object.values(pattern.lanes).every(lane => lane.length === 32)).toBe(true)
      const notes = drumPatternNotes(pattern)
      expect(notes.length).toBeGreaterThan(0)
      expect(notes.every(note => drumLanes.some(lane => lane.pitch === note.pitch) && note.velocity > 0 && note.velocity <= 127 && note.start + note.duration <= 8)).toBe(true)
    }
  })
  it('calcula pasos y acentos por compás sin usar 4/4 de forma fija', () => {
    expect(stepsPerBar([4, 4])).toBe(16)
    expect(stepsPerBar([6, 8])).toBe(12)
    expect(stepsPerBar([3, 4])).toBe(12)
    expect(stepsPerBar([7, 8])).toBe(14)
    const compound = generateDrumPattern('Pop', 2, [6, 8])
    expect(compound.lanes.kick[0]).toBeGreaterThan(0)
    expect(compound.lanes.snare[6]).toBeGreaterThan(0)
    expect(drumPatternEnd(compound)).toBe(6)
  })
  it('aplica swing a pasos impares locales, incluso con compases de longitud impar', () => {
    let pattern = generateDrumPattern('Pop', 2, [3, 16])
    for (const lane of drumLanes) pattern.lanes[lane.id].fill(0)
    pattern = editDrumStep(pattern, 'kick', 1, 100)
    pattern = editDrumStep(pattern, 'kick', 3, 90)
    pattern.swing = 0.6
    const notes = drumPatternNotes(pattern)
    expect(notes.map(note => note.start)).toEqual([0.4, 0.75])
    expect(notes[0].velocity).toBe(100)
    expect(notes.every(note => note.start + note.duration <= drumPatternEnd(pattern))).toBe(true)
  })
  it('edita sin mutar el patrón anterior y excluye hats abierto/cerrado simultáneos', () => {
    const pattern = generateDrumPattern('Pop', 1, [4, 4])
    const before = JSON.stringify(pattern)
    const changed = editDrumStep(pattern, 'openHat', 0, 127)
    expect(JSON.stringify(pattern)).toBe(before)
    expect(changed.lanes.openHat[0]).toBe(127)
    expect(changed.lanes.closedHat[0]).toBe(0)
    const again = editDrumStep(changed, 'closedHat', 0, 70)
    expect(again.lanes.openHat[0]).toBe(0)
    expect(() => editDrumStep(pattern, 'kick', 16, 100)).toThrow()
    expect(() => editDrumStep(pattern, 'kick', 0, 128)).toThrow()
  })
  it('varía un golpe de forma reproducible y no cambia los demás', () => {
    const pattern = generateDrumPattern('Funk', 2, [4, 4])
    const varied = varyDrumPattern(pattern, 7)
    expect(varied).toEqual(varyDrumPattern(pattern, 7))
    expect(varied).not.toEqual(pattern)
    expect(varied.lanes.snare).toEqual(pattern.lanes.snare)
    expect(varied.swing).toBe(pattern.swing)
  })
  it('repite sin duplicar swing y limita notas al final de la selección', () => {
    const notes = [{ pitch: 42, start: 0.4, duration: 0.06, velocity: 75 }]
    expect(repeatDrumNotes(notes, 1, 3).map(note => note.start)).toEqual([0.4, 1.4, 2.4])
    expect(repeatDrumNotes(notes, 1, 1.43).at(-1)!.duration).toBeCloseTo(0.03)
    expect(() => repeatDrumNotes(notes, 0, 4)).toThrow()
    expect(() => repeatDrumNotes(notes, 1, Infinity)).toThrow()
  })
  it('guarda canal 10, pasos y notas en JSON conservando ID y mezcla', () => {
    const project = createProject()
    project.tracks = withDrumTrack(project, generateDrumPattern('Reggaetón', 2, [4, 4], 0.25))
    const id = project.tracks[0].id
    project.tracks[0].volume = 0.3
    project.tracks = withDrumTrack(project, generateDrumPattern('Trap', 1, [4, 4]))
    expect(project.tracks[0].id).toBe(id)
    expect(project.tracks[0].channel).toBe(9)
    expect(project.tracks[0].volume).toBe(0.3)
    expect(parseProject(JSON.stringify(project))).toEqual(project)
    expect(projectSchema.safeParse({ ...project, tracks: [{ ...project.tracks[0], channel: 0 }] }).success).toBe(false)
  })
  it('extiende el ciclo al acompañamiento y rechaza metadatos de longitud incorrecta', () => {
    const project = createProject()
    project.tracks = withDrumTrack(project, generateDrumPattern('Pop', 1, [4, 4]))
    project.tracks.push({ id: 'bass', name: 'Bajo', kind: 'bass', channel: 2, volume: 0.6, muted: false, notes: [{ pitch: 33, start: 7, duration: 0.8, velocity: 90 }], chords: [] })
    const selected = drumSelection(project, project.tracks.map(track => track.id))
    expect(selected.end).toBe(8)
    expect(selected.tracks[0].notes.length).toBe(project.tracks[0].notes.length * 2)
    expect(selected.tracks[0].drumPattern).toBeUndefined()
    const invalid = generateDrumPattern('Pop', 1, [4, 4])
    invalid.lanes.kick.pop()
    expect(drumPatternSchema.safeParse(invalid).success).toBe(false)
    const hats = generateDrumPattern('Pop', 1, [4, 4])
    hats.lanes.closedHat[0] = 80; hats.lanes.openHat[0] = 80
    expect(drumPatternSchema.safeParse(hats).success).toBe(false)
  })
})
