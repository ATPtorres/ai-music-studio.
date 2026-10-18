import { describe, expect, it } from 'vitest'
import { createProject, keys, projectSchema } from '../models/project'
import { generateProgression, withChordTrack } from './harmony'
import { generateLine, harmonyFingerprint, scalePitches, validateLineNotes, varyLine, withLineTrack, type LineSettings } from './lines'

export function lineFixture() {
  const project = createProject()
  project.tracks = withChordTrack(project, generateProgression({ key: 'A', mode: 'minor', bars: 4, signature: [4, 4], genre: 'Pop', mood: 'Alegre', complexity: 'advanced', chordType: 'seventh', seed: 42 }), 'Acordes')
  return project
}
const settings: LineSettings = { low: 60, high: 84, density: 'dense', rhythm: 'straight', complexity: 'advanced', seed: 10 }
describe('Melodías y bajos locales', () => {
  it('respeta escala, acordes, rango y monofonía en las 24 tonalidades', () => {
    for (const key of keys) for (const mode of ['major', 'minor'] as const) {
      const project = createProject()
      project.parameters.key = key; project.parameters.mode = mode
      const chords = generateProgression({ key, mode, bars: 4, signature: [4, 4], genre: 'Pop', mood: 'Alegre', complexity: 'advanced', chordType: 'seventh', seed: 42 })
      project.tracks = withChordTrack(project, chords, 'Acordes')
      for (const kind of ['melody', 'bass'] as const) {
        const range = kind === 'bass' ? { low: 28, high: 52 } : {}
        const config = { ...settings, ...range }
        const notes = generateLine(project, kind, config)
        const scale = scalePitches(project, config.low, config.high)
        expect(notes.every(note => scale.includes(note.pitch) && note.pitch >= config.low && note.pitch <= config.high)).toBe(true)
        expect(validateLineNotes(notes, 16)).toEqual(notes)
        for (const chord of chords) {
          const anchor = notes.find(note => note.start === chord.start)!
          expect(chord.pitches.some(pitch => pitch % 12 === anchor.pitch % 12)).toBe(true)
        }
      }
    }
  })
  it('usa la fundamental del símbolo incluso si el acorde está invertido', () => {
    const project = lineFixture()
    project.tracks[0].chords = [{ id: 'a', symbol: 'Am', degree: 'i', start: 0, duration: 4, pitches: [60, 64, 69] }]
    const notes = generateLine(project, 'bass', { ...settings, low: 28, high: 52, rhythm: 'sustained' })
    expect(notes[0].pitch % 12).toBe(9)
    expect(notes[0].duration).toBe(4)
  })
  it('reproduce semillas y modifica densidad y síncopa de forma real', () => {
    const project = lineFixture()
    const notes = generateLine(project, 'melody', settings)
    expect(generateLine(project, 'melody', settings)).toEqual(notes)
    expect(generateLine(project, 'melody', { ...settings, seed: 20 })).not.toEqual(notes)
    expect(generateLine(project, 'melody', { ...settings, density: 'sparse' }).length).toBeLessThan(notes.length)
    const sync = generateLine(project, 'melody', { ...settings, rhythm: 'syncopated' })
    expect(sync.some(note => note.start % 0.5 !== 0)).toBe(true)
    expect(validateLineNotes(sync, 16)).toEqual(sync)
  })
  it('respeta 6/8, huecos y duraciones de acorde fraccionarias', () => {
    const project = lineFixture()
    project.parameters.timeSignature = [6, 8]
    project.tracks[0].chords = [{ id: 'a', symbol: 'Am', degree: 'i', start: 1, duration: 1.25, pitches: [57, 60, 64] }, { id: 'b', symbol: 'Em', degree: 'v', start: 3, duration: 3, pitches: [52, 55, 59] }]
    for (const rhythm of ['straight', 'sustained', 'walking', 'syncopated'] as const) {
      const notes = generateLine(project, 'bass', { ...settings, low: 28, high: 52, rhythm })
      expect(validateLineNotes(notes, 6)).toEqual(notes)
      expect(notes.every(note => project.tracks[0].chords.some(chord => note.start >= chord.start && note.start + note.duration <= chord.start + chord.duration + 1e-8))).toBe(true)
    }
  })
  it('la variación mantiene todos los tiempos y velocidades', () => {
    const project = lineFixture()
    const notes = generateLine(project, 'melody', settings)
    const changed = varyLine(project, notes, { ...settings, seed: 3 })
    expect(changed).not.toEqual(notes)
    expect(changed.map(({ start, duration, velocity }) => [start, duration, velocity])).toEqual(notes.map(({ start, duration, velocity }) => [start, duration, velocity]))
  })
  it('conserva IDs y notas al cambiar acordes, detectando la referencia antigua', () => {
    const project = lineFixture()
    const notes = generateLine(project, 'melody', settings)
    project.tracks = withLineTrack(project, 'melody', notes)
    const id = project.tracks[1].id
    project.tracks = withLineTrack(project, 'melody', notes)
    expect(project.tracks[1].id).toBe(id)
    expect(projectSchema.safeParse(project).success).toBe(true)
    const original = harmonyFingerprint(project)
    project.parameters.bpm = 123
    expect(harmonyFingerprint(project)).toBe(original)
    project.tracks[0].chords[0].duration = 2
    expect(harmonyFingerprint(project)).not.toBe(original)
    expect(project.tracks[1].sourceHarmony).toBe(original)
    expect(project.tracks[1].notes).toEqual(notes)
  })
  it('asigna canales libres y reserva el 10 para percusión', () => {
    const project = lineFixture()
    project.tracks[0].channel = 1
    project.tracks = withLineTrack(project, 'melody', generateLine(project, 'melody', settings))
    project.tracks = withLineTrack(project, 'bass', generateLine(project, 'bass', { ...settings, low: 28, high: 52 }))
    expect(new Set(project.tracks.map(track => track.channel)).size).toBe(3)
    expect(project.tracks.every(track => track.channel !== 9)).toBe(true)
  })
  it('rechaza falta de armonía, registros imposibles, solapamientos y ediciones inválidas', () => {
    expect(() => generateLine(createProject(), 'melody', settings)).toThrow(/Acordes/)
    const project = lineFixture()
    expect(() => generateLine(project, 'melody', { ...settings, low: 80, high: 60 })).toThrow()
    expect(() => generateLine(project, 'melody', { ...settings, low: 61, high: 61 })).toThrow(/registro/)
    project.tracks[0].chords[1].start = 0
    expect(() => generateLine(project, 'melody', settings)).toThrow(/solapan/)
    expect(() => validateLineNotes([{ pitch: 60, start: 0, duration: 2, velocity: 90 }, { pitch: 61, start: 1, duration: 1, velocity: 80 }], 4)).toThrow(/solaparse/)
    expect(() => validateLineNotes([{ pitch: 60, start: 0, duration: 8, velocity: 90 }], 4)).toThrow(/dentro/)
  })
})
