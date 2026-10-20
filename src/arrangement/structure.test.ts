import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { parseMidi } from 'midi-file'
import { createProject, projectSchema, type MusicProject } from '../models/project'
import { structureLibrary, searchStructures } from '../knowledge/structures'
import { defaultStructureOptions, structureFamilies, structureLibrarySchema } from '../knowledge/structureSchema'
import { generateStructure, structureFingerprint } from './structure'
import { renderArrangement } from './render'
import { harmonyFingerprint } from '../music/lines'
import { exportArrangementMidi } from '../midi/exportArrangement'
import { parseProject } from '../services/persistence'

function fixture(): MusicProject {
  const project = createProject()
  project.tracks = (['chords', 'bass', 'melody', 'drums'] as const).map((kind, index) => ({ id: kind, name: kind, kind, channel: kind === 'drums' ? 9 : index, notes: [{ pitch: kind === 'drums' ? 36 : kind === 'bass' ? 45 : 69, start: 0, duration: 1, velocity: 96 }], chords: [], volume: 0.7, muted: false }))
  const provenance = harmonyFingerprint(project)
  for (const track of project.tracks.filter(t => t.kind !== 'chords')) track.variants = [{ id: track.id + '-v2', name: 'V2', beats: 4, notes: [{ pitch: track.notes[0].pitch, start: 1, duration: 0.5, velocity: 80 }], sourceHarmony: provenance }]
  return project
}
const shape = (project: MusicProject, seed: number) => generateStructure(project, defaultStructureOptions, seed)
describe('Conocimiento estructural y generación musical', () => {
  it('valida 24 recetas distintas en ocho familias y una búsqueda sin acentos', () => {
    expect(structureLibrary.recipes).toHaveLength(24)
    expect(new Set(structureLibrary.recipes.map(r => r.family)).size).toBe(8)
    expect(structureLibrarySchema.safeParse(structureLibrary).success).toBe(true)
    expect(searchStructures('ESTRÓFICA').length).toBeGreaterThan(0)
    expect(searchStructures('zzzzzz')).toHaveLength(0)
  })
  it('rechaza duplicados, fuentes inexistentes, llegadas sin preparación válida y retornos de longitud distinta', () => {
    const duplicate = structuredClone(structureLibrary); duplicate.recipes.push(duplicate.recipes[0])
    expect(structureLibrarySchema.safeParse(duplicate).success).toBe(false)
    const source = structuredClone(structureLibrary); source.recipes[0].sourceId = 'missing'
    expect(structureLibrarySchema.safeParse(source).success).toBe(false)
    const transition = structuredClone(structureLibrary); transition.recipes.find(r => r.id === 'electronic-two-drops')!.steps[3].role = 'verse'
    expect(structureLibrarySchema.safeParse(transition).success).toBe(false)
    const length = structuredClone(structureLibrary); length.recipes.find(r => r.id === 'songbook-aaba')!.steps[2].units = 2
    expect(structureLibrarySchema.safeParse(length).success).toBe(false)
  })
  it('realiza todas las recetas en cinco compases sin modificar las fuentes ni romper referencias', () => {
    for (const signature of [[4, 4], [3, 4], [6, 8], [7, 8], [12, 2]] as const) for (const recipe of structureLibrary.recipes) {
      const project = fixture(); project.parameters.timeSignature = [...signature]
      const before = structuredClone(project)
      const result = generateStructure(project, { ...defaultStructureOptions, recipeId: recipe.id }, 7)
      const next = { ...project, sections: result.sections, structureGeneration: result.structureGeneration }
      expect(project).toEqual(before)
      expect(projectSchema.safeParse(next).success).toBe(true)
      expect(result.sections).toHaveLength(recipe.steps.length)
      result.sections.forEach((s, i) => {
        expect(s.bars).toBe(recipe.steps[i].units * result.structureGeneration.actualPhraseBars)
        expect(s.trackIds.length).toBeGreaterThan(0)
        expect(s.trackIds.every(id => project.tracks.some(t => t.id === id))).toBe(true)
      })
      expect(renderArrangement(next).tracks.some(t => t.notes.length)).toBe(true)
    }
  })
  it('la semilla repite la forma y se evitan recetas consecutivas en selección automática', () => {
    const project = fixture(), first = shape(project, 123)
    const stripped = (sections: MusicProject['sections']) => sections.map(s => ({ name: s.name, bars: s.bars, trackIds: s.trackIds, variantIds: s.variantIds }))
    expect(stripped(shape(project, 123).sections)).toEqual(stripped(first.sections))
    const next = shape({ ...project, sections: first.sections, structureGeneration: first.structureGeneration }, 123)
    expect(next.recipe.id).not.toBe(first.recipe.id)
    const selections = new Set(Array.from({ length: 200 }, (_, seed) => shape(createProject(), seed).recipe.id))
    expect(selections.size).toBeGreaterThanOrEqual(18)
  })
  it('filtra familias, respeta una receta fija y la exploración orienta la distribución', () => {
    const project = createProject()
    for (const family of structureFamilies) expect(generateStructure(project, { ...defaultStructureOptions, family }, 42).recipe.family).toBe(family)
    expect(() => generateStructure(project, { ...defaultStructureOptions, family: 'rondo', recipeId: 'pop-return' }, 42)).toThrow(/familia/)
    expect(generateStructure(project, { ...defaultStructureOptions, recipeId: 'pop-return' }, 42).recipe.id).toBe('pop-return')
    const average = (exploration: number) => Array.from({ length: 150 }, (_, seed) => generateStructure(project, { ...defaultStructureOptions, exploration }, seed).recipe.novelty).reduce((a, b) => a + b) / 150
    expect(average(100)).toBeGreaterThan(average(0) + 20)
  })
  it('mantiene AABA proporcionado, reutiliza el material al regresar y excluye variantes desactualizadas', () => {
    const project = fixture()
    const options = { ...defaultStructureOptions, recipeId: 'songbook-aaba' }
    const result = generateStructure(project, options, 42)
    expect(result.sections.slice(1, 5).map(s => s.bars)).toEqual([8, 8, 8, 8])
    expect(result.sections[1].variantIds).toEqual(result.sections[2].variantIds)
    expect(result.sections[1].variantIds).toEqual(result.sections[4].variantIds)
    expect(result.sections[3].variantIds?.bass).toBe('bass-v2')
    project.tracks.find(t => t.kind === 'bass')!.variants![0].sourceHarmony = 'stale'
    expect(generateStructure(project, options, 42).sections.every(s => !s.variantIds?.bass)).toBe(true)
  })
  it('prefiere variantes distintas para episodios diferentes y avisa si no alcanza el material', () => {
    const project = fixture(), options = { ...defaultStructureOptions, recipeId: 'rondo-abaca' }
    expect(generateStructure(project, options, 42).warnings.join(' ')).toContain('más grupos de material')
    const bass = project.tracks.find(t => t.kind === 'bass')!
    bass.variants!.push({ ...structuredClone(bass.variants![0]), id: 'bass-v3', name: 'V3' })
    const result = generateStructure(project, options, 42)
    expect(result.sections[2].variantIds?.bass).not.toBe(result.sections[4].variantIds?.bass)
    expect(result.sections[1].variantIds?.bass).toBeUndefined()
  })
  it('funciona vacío o con un solo tipo de instrumento sin generar secciones silenciosas por falta de los demás', () => {
    const empty = shape(createProject(), 42)
    expect(empty.sections.every(s => s.trackIds.length === 0)).toBe(true)
    expect(empty.warnings.join(' ')).toContain('Todavía no hay pistas')
    for (const kind of ['drums', 'bass', 'melody', 'chords']) {
      const project = fixture(); project.tracks = project.tracks.filter(t => t.kind === kind)
      expect(shape(project, 42).sections.every(s => s.trackIds[0] === kind)).toBe(true)
    }
  })
  it('adapta el fraseo completo a la densidad del proyecto sin cortar la última sección', () => {
    const project = fixture(); project.tracks = project.tracks.filter(t => t.kind === 'drums')
    project.tracks[0].notes = Array.from({ length: 200 }, (_, i) => ({ pitch: 36, start: i * .02, duration: .01, velocity: 90 }))
    project.tracks[0].variants = []
    const result = generateStructure(project, { ...defaultStructureOptions, recipeId: 'pop-return', phraseBars: 16 }, 42)
    expect(result.structureGeneration.actualPhraseBars).toBeLessThan(16)
    expect(result.sections).toHaveLength(8)
    expect(result.sections.at(-1)?.name).toBe('Outro')
    expect(renderArrangement({ ...project, sections: result.sections }).tracks[0].notes.length).toBeLessThanOrEqual(15000)
    expect(result.warnings.join(' ')).toContain('reducido')
  })
  it('conserva metadatos en JSON, detecta ediciones y exporta el arreglo MIDI con sus notas y duración', () => {
    const project = fixture(), result = shape(project, 42)
    const next = { ...project, sections: result.sections, structureGeneration: result.structureGeneration }
    expect(parseProject(JSON.stringify(next))).toEqual(next)
    expect(structureFingerprint(next.sections)).toBe(result.structureGeneration.fingerprint)
    next.sections[0].bars++
    expect(structureFingerprint(next.sections)).not.toBe(result.structureGeneration.fingerprint)
    const rendered = renderArrangement(next), bytes = exportArrangementMidi(next), midi = new Midi(bytes)
    const binary = parseMidi(bytes)
    for (const events of binary.tracks) expect(events.reduce((sum, e) => sum + e.deltaTime, 0)).toBe(rendered.end * binary.header.ticksPerBeat!)
    expect(midi.tracks.reduce((sum, t) => sum + t.notes.length, 0)).toBe(rendered.tracks.reduce((sum, t) => sum + t.notes.length, 0))
    next.structureGeneration.recipeId = 'future-form'
    expect(parseProject(JSON.stringify(next)).sections).toEqual(next.sections)
  })
})
