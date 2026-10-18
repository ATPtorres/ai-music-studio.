import { describe, expect, it } from 'vitest'
import { createProject, noteSchema, projectSchema, trackSchema } from '../models/project'
import { loadProject, MAX_PROJECT_BYTES, parseProject, saveProject, STORAGE_KEY } from './persistence'
describe('Formato y almacenamiento de proyectos', () => {
  it('crea un proyecto válido y conserva todos sus parámetros', () => {
    const project = createProject()
    expect(projectSchema.parse(project)).toEqual(project)
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
    expect(loadProject(storage)).toBeNull()
    saveProject(storage, project)
    expect(loadProject(storage)).toEqual(project)
    expect(data.has(STORAGE_KEY)).toBe(true)
  })
  it('rechaza versiones futuras, JSON roto, datos extra y tamaños excesivos', () => {
    expect(() => parseProject('{')).toThrow()
    expect(() => parseProject(JSON.stringify({ ...createProject(), version: 2 }))).toThrow()
    expect(() => parseProject(JSON.stringify({ ...createProject(), apiKey: 'no permitida' }))).toThrow()
    expect(() => parseProject(' '.repeat(MAX_PROJECT_BYTES + 1))).toThrow(/2 MB/)
  })
  it('rechaza rangos incorrectos y referencias rotas', () => {
    const project = createProject()
    expect(projectSchema.safeParse({ ...project, parameters: { ...project.parameters, bpm: 0 } }).success).toBe(false)
    expect(noteSchema.safeParse({ pitch: 128, start: 0, duration: 1, velocity: 100 }).success).toBe(false)
    expect(noteSchema.safeParse({ pitch: 60, start: 0, duration: 0, velocity: 100 }).success).toBe(false)
    expect(projectSchema.safeParse({ ...project, sections: [{ id: 'a', name: 'Verso', bars: 4, trackIds: ['missing'], lyrics: '' }] }).success).toBe(false)
  })
  it('reserva canal 10 para percusión', () => {
    const track = { id: 'drums', name: 'Batería', kind: 'drums', channel: 9, muted: false, volume: 0.8, notes: [], chords: [] }
    expect(trackSchema.safeParse(track).success).toBe(true)
    expect(trackSchema.safeParse({ ...track, channel: 0 }).success).toBe(false)
    expect(trackSchema.safeParse({ ...track, kind: 'melody' }).success).toBe(false)
  })
  it('no silencia errores de cuota o almacenamiento corrupto', () => {
    expect(() => saveProject({ setItem: () => { throw new Error('QuotaExceeded') } }, createProject())).toThrow('QuotaExceeded')
    expect(() => loadProject({ getItem: () => '{invalid' })).toThrow()
  })
})
