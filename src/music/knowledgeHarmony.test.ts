import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { keys, createProject, projectSchema } from '../models/project'
import { library, recipeSuggestion } from '../knowledge/catalog'
import { defaultCreativeSettings } from '../knowledge/schema'
import { diatonicChord, generateProgressionResult, withChordTrack, type HarmonySettings } from './harmony'
import { knowledgeChord, smoothVoiceLeading } from './knowledgeHarmony'
import { exportChordsMidi } from '../midi/exportChords'
import { parseProject } from '../services/persistence'

const base: HarmonySettings = { key: 'C', mode: 'major', bars: 4, signature: [4, 4], genre: 'Pop', mood: 'Alegre', complexity: 'advanced', chordType: 'triad', seed: 42 }
const pitchClasses = (pitches: number[]) => pitches.map(p => p % 12).sort((a, b) => a - b)
describe('Armonía basada en conocimiento', () => {
  it('realiza las 36 recetas en 12 tonalidades y tres tipos con notas MIDI válidas', () => {
    for (const recipe of library.recipes) for (const key of keys) for (const chordType of ['triad', 'seventh', 'extended'] as const) {
      const suggestion = recipeSuggestion(recipe)
      const result = generateProgressionResult({ ...base, key, chordType, mode: recipe.mode, signature: [6, 8], bars: recipe.steps.length, knowledge: { recipeId: recipe.id, controls: { ...defaultCreativeSettings, color: suggestion.color } } })
      expect(result.knowledge?.recipeId).toBe(recipe.id)
      expect(result.chords).toHaveLength(recipe.steps.length)
      result.chords.forEach((chord, index) => {
        expect(chord.start).toBe(index * 3)
        expect(chord.duration).toBe(3)
        expect(chord.pitches).toHaveLength(chordType === 'triad' ? 3 : chordType === 'seventh' ? 4 : 5)
        expect(chord.pitches.every(p => Number.isInteger(p) && p >= 36 && p <= 84)).toBe(true)
      })
    }
  })
  it('el préstamo iv y V/V contienen las alteraciones esperadas', () => {
    expect(knowledgeChord('C', 'major', { kind: 'borrowed', degree: 3 }, 'triad', diatonicChord)).toMatchObject({ symbol: 'Fm', pitches: [53, 56, 60] })
    expect(knowledgeChord('C', 'major', { kind: 'secondary', target: 4 }, 'seventh', diatonicChord)).toMatchObject({ symbol: 'D7', degree: 'V/V', pitches: [50, 54, 57, 60] })
    const result = generateProgressionResult({ ...base, chordType: 'seventh', knowledge: { controls: { ...defaultCreativeSettings, color: 'secondary' }, recipeId: 'major-applied-five' } })
    expect(result.chords.map(c => c.symbol)).toEqual(['Cmaj7', 'Dm7', 'D7', 'G7'])
  })
  it('las novenas diatónicas respetan la escala y nombran las novenas bemoles', () => {
    for (const key of keys) for (const mode of ['major', 'minor'] as const) {
      const scale = (mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]).map(p => (p + keys.indexOf(key)) % 12)
      for (let degree = 0; degree < 7; degree++) expect(diatonicChord(key, mode, degree, 'extended').pitches.every(p => scale.includes(p % 12))).toBe(true)
    }
    expect(diatonicChord('C', 'major', 2, 'extended').symbol).toBe('Em7(♭9)')
    expect(diatonicChord('C', 'major', 0, 'extended').symbol).toBe('Cmaj9')
  })
  it('la conducción conserva clases de altura y reduce saltos en un recorrido conocido', () => {
    const chords = [0, 4, 5, 3].map((degree, index) => ({ ...diatonicChord('C', 'major', degree, 'triad'), id: String(index), start: index * 4, duration: 4 }))
    const smooth = smoothVoiceLeading(chords)
    const cost = (items: typeof chords) => items.slice(1).reduce((sum, chord, index) => sum + chord.pitches.reduce((subtotal, p, voice) => subtotal + Math.abs(p - items[index].pitches[voice]), 0), 0)
    smooth.forEach((chord, i) => expect(pitchClasses(chord.pitches)).toEqual(pitchClasses(chords[i].pitches)))
    expect(cost(smooth)).toBeLessThan(cost(chords))
    expect(smoothVoiceLeading(chords)).toEqual(smooth)
  })
  it('conserva proyectos anteriores, referencias, mezcla y metadatos en JSON y MIDI', () => {
    const project = createProject(); project.parameters = { ...project.parameters, key: 'C', mode: 'major' }
    const legacy = generateProgressionResult(base)
    expect(legacy.knowledge).toBeUndefined()
    project.tracks = withChordTrack(project, legacy.chords, 'Anterior')
    project.tracks[0].volume = 0.25; project.tracks[0].muted = true
    const id = project.tracks[0].id
    project.sections = [{ id: 'verse', name: 'Verso', bars: 4, trackIds: [id], lyrics: '' }]
    const result = generateProgressionResult({ ...base, chordType: 'extended', knowledge: { controls: { ...defaultCreativeSettings, color: 'borrowed' }, recipeId: 'major-minor-four' } })
    project.tracks = withChordTrack(project, result.chords, 'Biblioteca', result.knowledge)
    expect(project.tracks[0]).toMatchObject({ id, volume: 0.25, muted: true, harmonyKnowledge: { pinned: true, edited: false } })
    expect(parseProject(JSON.stringify(project))).toEqual(project)
    const midi = new Midi(exportChordsMidi(project, id))
    expect(midi.tracks[0].notes).toHaveLength(20)
    expect(midi.tracks[0].notes.some(n => n.midi % 12 === 8)).toBe(true)
    expect(midi.tracks[0].notes.map(n => n.midi).sort()).toEqual(project.tracks[0].notes.map(n => n.pitch).sort())
    expect(midi.duration).toBeCloseTo(9.6)
    project.tracks[0].harmonyKnowledge!.recipeId = 'future-resource'
    expect(projectSchema.safeParse(project).success).toBe(true)
    project.tracks = withChordTrack(project, legacy.chords, 'Básico')
    expect(project.tracks[0].harmonyKnowledge).toBeUndefined()
  })
  it('la semilla reproduce alturas y las longitudes repiten o recortan el ciclo', () => {
    const settings: HarmonySettings = { ...base, bars: 12, knowledge: { controls: defaultCreativeSettings } }
    const first = generateProgressionResult(settings)
    expect(generateProgressionResult(settings).chords.map(c => c.pitches)).toEqual(first.chords.map(c => c.pitches))
    expect(first.chords.at(-1)!.start + first.chords.at(-1)!.duration).toBe(48)
    expect(generateProgressionResult({ ...settings, bars: 2 }).chords).toHaveLength(2)
  })
})
