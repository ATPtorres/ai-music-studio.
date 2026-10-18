import { describe, expect, it } from 'vitest'
import { createProject, keys, projectSchema } from '../models/project'
import { barBeats } from './theory'
import { chordsToNotes, diatonicChord, generateProgression, retimeChords, withChordTrack, type HarmonySettings } from './harmony'

const base: HarmonySettings = { key: 'C', mode: 'major', bars: 4, signature: [4, 4], genre: 'Pop', mood: 'Alegre', complexity: 'simple', chordType: 'triad', seed: 1 }
describe('Motor armónico', () => {
  it('construye tríadas y séptimas diatónicas conocidas', () => {
    expect(diatonicChord('C', 'major', 0, 'triad')).toEqual({ symbol: 'C', degree: 'I', pitches: [48, 52, 55] })
    expect(diatonicChord('C', 'major', 4, 'seventh')).toEqual({ symbol: 'G7', degree: 'V7', pitches: [55, 59, 62, 65] })
    expect(diatonicChord('C', 'major', 6, 'triad')).toEqual({ symbol: 'Bdim', degree: 'vii°', pitches: [59, 62, 65] })
    expect(diatonicChord('A', 'minor', 1, 'seventh')).toEqual({ symbol: 'Bm7♭5', degree: 'iiø7', pitches: [59, 62, 65, 69] })
    expect(diatonicChord('A', 'minor', 4, 'triad').symbol).toBe('Em')
  })
  it('mantiene todas las voces en la escala y el rango MIDI para todas las tonalidades', () => {
    for (const key of keys) for (const mode of ['major', 'minor'] as const) for (const chordType of ['triad', 'seventh'] as const) {
      const scale = (mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]).map(n => (n + keys.indexOf(key)) % 12)
      const chords = generateProgression({ ...base, key, mode, chordType, complexity: 'advanced', bars: 16 })
      for (const chord of chords) {
        expect(chord.pitches).toHaveLength(chordType === 'triad' ? 3 : 4)
        expect(chord.pitches.every(pitch => pitch >= 0 && pitch <= 127 && scale.includes(pitch % 12))).toBe(true)
      }
    }
  })
  it('es reproducible por semilla y ofrece variación musical entre semillas', () => {
    const pitches = (seed: number) => generateProgression({ ...base, seed }).map(c => c.pitches)
    expect(pitches(7)).toEqual(pitches(7))
    expect(new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(pitches(seed)))).size).toBeGreaterThan(1)
  })
  it('cubre el número exacto de compases en 4/4, 3/4 y 6/8', () => {
    for (const signature of [[4, 4], [3, 4], [6, 8]] as const) {
      const chords = generateProgression({ ...base, signature: [...signature], bars: 8 })
      expect(chords.at(-1)!.start + chords.at(-1)!.duration).toBe(8 * barBeats(signature))
      expect(chords.every((chord, i) => chord.start === i * barBeats(signature))).toBe(true)
    }
  })
  it('reajusta el inicio de acordes y notas después de editar duración', () => {
    const chords = generateProgression(base)
    chords[0].duration = 2
    const edited = retimeChords(chords)
    expect(edited.map(c => c.start)).toEqual([0, 2, 6, 10])
    const notes = chordsToNotes(edited)
    expect(notes).toHaveLength(12)
    expect(notes[3].start).toBe(2)
    expect(notes[0].duration).toBe(2)
  })
  it('integra y reemplaza la pista manteniendo su identidad y referencias', () => {
    const project = createProject()
    project.tracks = withChordTrack(project, generateProgression(base), 'Armonía')
    const id = project.tracks[0].id
    project.sections = [{ id: 'verse', name: 'Verso', bars: 4, trackIds: [id], lyrics: '' }]
    project.tracks = withChordTrack(project, generateProgression({ ...base, seed: 3 }), 'Otra armonía')
    expect(project.tracks).toHaveLength(1)
    expect(project.tracks[0].id).toBe(id)
    expect(projectSchema.safeParse(project).success).toBe(true)
  })
  it('rechaza parámetros que generarían eventos inválidos', () => {
    expect(() => generateProgression({ ...base, bars: 0 })).toThrow()
    expect(() => diatonicChord('C', 'major', 7, 'triad')).toThrow()
    expect(() => retimeChords([{ ...generateProgression(base)[0], duration: -1 }])).toThrow()
  })
})
