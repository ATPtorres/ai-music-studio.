import { describe, expect, it } from 'vitest'
import { createProject, projectSchema } from '../models/project'
import { executeTool, summarizeProject, toolSchemas } from './tools'

function run(name: string, args: unknown, project = createProject()) {
  return executeTool(name, JSON.stringify(args), project)
}

describe('herramientas del agente', () => {
  it('expone esquemas de función válidos y una herramienta por capacidad', () => {
    const schemas = toolSchemas()
    expect(schemas.map(schema => schema.function.name)).toEqual([
      'get_project_summary', 'configure_project', 'generate_chords', 'generate_line', 'generate_drums', 'generate_structure', 'clear_track',
    ])
    for (const schema of schemas) {
      expect(schema.type).toBe('function')
      expect(schema.function.description.length).toBeGreaterThan(20)
      expect(schema.function.parameters).toMatchObject({ type: 'object', additionalProperties: false })
      expect(schema.function.parameters).not.toHaveProperty('$schema')
    }
  })

  it('configura parámetros y conserva las pistas existentes', () => {
    const base = run('generate_chords', { bars: 4 })
    const result = run('configure_project', { name: 'Noche abierta', key: 'C', mode: 'major', bpm: 120, timeSignature: [3, 4], theme: 'Volver a casa' }, base.project)
    expect(result.project.name).toBe('Noche abierta')
    expect(result.project.parameters).toMatchObject({ key: 'C', mode: 'major', bpm: 120, timeSignature: [3, 4], theme: 'Volver a casa' })
    expect(result.project.tracks).toHaveLength(1)
    expect(result.text).toContain('regenera')
    expect(projectSchema.parse(result.project)).toEqual(result.project)
  })

  it('genera acordes y actualiza el resumen del proyecto', () => {
    const result = run('generate_chords', { bars: 8, complexity: 'advanced', genre: 'Jazz', mood: 'Sereno' })
    const track = result.project.tracks.find(item => item.kind === 'chords')!
    expect(track.chords).toHaveLength(8)
    expect(track.notes.length).toBeGreaterThan(0)
    expect(result.project.parameters).toMatchObject({ genre: 'Jazz', mood: 'Sereno', complexity: 'advanced' })
    expect(result.text).toContain('8 acordes')
    const summary = JSON.parse(run('get_project_summary', {}, result.project).text)
    expect(summary.tracks[0].chords).toHaveLength(8)
    expect(summarizeProject(result.project).tracks[0].kind).toBe('chords')
  })

  it('exige acordes antes de generar melodía o bajo y respeta la monofonía', () => {
    expect(() => run('generate_line', { kind: 'melody' })).toThrow(/acordes/i)
    const withChords = run('generate_chords', { bars: 4, complexity: 'simple' }).project
    const melody = run('generate_line', { kind: 'melody', density: 'medium', rhythm: 'straight' }, withChords)
    const track = melody.project.tracks.find(item => item.kind === 'melody')!
    const sorted = [...track.notes].sort((a, b) => a.start - b.start)
    expect(sorted.length).toBeGreaterThan(0)
    expect(sorted.some((note, index) => index > 0 && note.start < sorted[index - 1].start + sorted[index - 1].duration - 1e-8)).toBe(false)
    expect(track.generation).toMatchObject({ density: 'medium', rhythm: 'straight' })
    expect(projectSchema.parse(melody.project)).toEqual(melody.project)
  })

  it('genera batería con el compás del proyecto y la sustituye al repetir', () => {
    const first = run('generate_drums', { genre: 'Funk', bars: 2, swing: 0.2 })
    const drums = first.project.tracks.find(item => item.kind === 'drums')!
    expect(drums.channel).toBe(9)
    expect(drums.drumPattern).toMatchObject({ genre: 'Funk', bars: 2, swing: 0.2, signature: [4, 4] })
    const second = run('generate_drums', { genre: 'Rock', bars: 4 }, first.project)
    expect(second.project.tracks.filter(item => item.kind === 'drums')).toHaveLength(1)
    expect(second.project.tracks[0].drumPattern).toMatchObject({ genre: 'Rock', bars: 4 })
  })

  it('genera una estructura vinculada a las pistas y elimina sus vínculos al borrar', () => {
    const chords = run('generate_chords', { bars: 4 }).project
    const withDrums = run('generate_drums', { genre: 'Pop', bars: 2 }, chords).project
    const structured = run('generate_structure', { family: 'verse-chorus', phraseBars: 4, exploration: 40 }, withDrums)
    expect(structured.project.sections.length).toBeGreaterThan(0)
    expect(structured.project.structureGeneration?.options.family).toBe('verse-chorus')
    expect(structured.project.sections.some(section => section.trackIds.length > 0)).toBe(true)
    const cleared = run('clear_track', { kind: 'drums' }, structured.project)
    expect(cleared.project.tracks.some(track => track.kind === 'drums')).toBe(false)
    expect(cleared.project.sections.every(section => section.trackIds.every(id => cleared.project.tracks.some(track => track.id === id)))).toBe(true)
    expect(projectSchema.parse(cleared.project)).toEqual(cleared.project)
  })

  it('rechaza herramientas y argumentos no válidos', () => {
    expect(() => run('inventada', {})).toThrow(/desconocida/i)
    expect(() => executeTool('configure_project', '{', createProject())).toThrow(/JSON/i)
    expect(() => run('configure_project', { bpm: 500 })).toThrow(/no válidos/i)
    expect(() => run('generate_chords', { bars: 1 })).toThrow(/no válidos/i)
    expect(run('clear_track', { kind: 'bass' }).text).toContain('No había')
  })
})
