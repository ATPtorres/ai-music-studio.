import { describe, expect, it } from 'vitest'
import { createProject, type MusicProject, type MusicTrack } from '../models/project'
import { parseProject } from '../services/persistence'
import { generateDrumPattern } from '../music/drums'
import { moveSection, renderArrangement, sourceClip } from './render'
import { applyLyricsDraft } from '../features/lyrics/lyricsProject'

function track(change: Partial<MusicTrack> = {}): MusicTrack { return { id: 'melody', name: 'Melodía', kind: 'melody', channel: 1, volume: 0.7, muted: false, notes: [{ pitch: 60, start: 1, duration: 2, velocity: 90 }], chords: [], ...change } }
function project(): MusicProject {
  return { ...createProject(), tracks: [track()], sections: [{ id: 'a', name: 'Verso', bars: 3, trackIds: ['melody'], lyrics: 'Primera letra' }, { id: 'b', name: 'Cierre', bars: 1, trackIds: [], lyrics: 'Última letra' }] }
}
describe('Motor de arreglo por secciones', () => {
  it('repite desde cero, conserva silencios, calcula duración real y no modifica fuentes', () => {
    const source = project(); const copy = structuredClone(source)
    const result = renderArrangement(source)
    expect(result.tracks[0].notes.map(note => note.start)).toEqual([1, 5, 9])
    expect(result.sections.map(section => [section.start, section.end, section.firstBar])).toEqual([[0, 12, 1], [12, 16, 4]])
    expect(result.end).toBe(16); expect(result.seconds).toBe(9.6); expect(result.bars).toBe(4)
    expect(source).toEqual(copy)
    expect(parseProject(JSON.stringify(source))).toEqual(copy)
  })
  it('recorta notas en el límite, reinicia clips en cada sección y evita notas colgadas', () => {
    const source = project()
    source.tracks[0].notes = [{ pitch: 60, start: 0, duration: 6, velocity: 100 }]
    source.sections = source.sections.map(s => ({ ...s, bars: 1, trackIds: ['melody'] }))
    const result = renderArrangement(source)
    expect(result.tracks[0].notes).toEqual([{ pitch: 60, start: 0, duration: 4, velocity: 100 }, { pitch: 60, start: 4, duration: 4, velocity: 100 }])
  })
  it('convierte 6/8 y 7/8 a negras y redondea clips melódicos al compás global', () => {
    const source = project(); source.parameters.timeSignature = [6, 8]
    source.sections = [{ ...source.sections[0], bars: 2 }]
    let result = renderArrangement(source)
    expect(result.tracks[0].notes.map(n => n.start)).toEqual([1, 4])
    expect(result.end).toBe(6)
    source.parameters.timeSignature = [7, 8]
    result = renderArrangement(source)
    expect(result.end).toBe(7); expect(result.tracks[0].notes.map(n => n.start)).toEqual([1, 4.5])
  })
  it('usa acordes canónicos y conserva clips importados de notas sin acordes', () => {
    const source = project()
    source.tracks[0] = track({ kind: 'chords', chords: [{ id: 'c', symbol: 'C', degree: 'I', start: 0, duration: 4, pitches: [60, 64, 67] }], notes: [{ pitch: 99, start: 0, duration: 1, velocity: 20 }] })
    const notes = renderArrangement(source).tracks[0].notes
    expect(new Set(notes.map(note => note.pitch))).toEqual(new Set([60, 64, 67]))
    source.tracks[0].chords = []
    expect(renderArrangement(source).tracks[0].notes[0].pitch).toBe(99)
  })
  it('respeta swing, ciclo de batería y advertencias de compás distinto', () => {
    const source = project()
    const pattern = generateDrumPattern('Pop', 1, [6, 8], 0.5)
    source.tracks = [track({ id: 'drums', kind: 'drums', channel: 9, drumPattern: pattern, notes: [] })]
    source.sections = [{ ...source.sections[0], bars: 2, trackIds: ['drums'] }]
    const rendered = renderArrangement(source)
    const base = sourceClip(source.tracks[0], [4, 4])
    expect(base.period).toBe(3)
    expect(rendered.tracks[0].notes.some(note => note.start > 6)).toBe(true)
    expect(rendered.tracks[0].notes.some(note => note.start % 0.25 !== 0)).toBe(true)
    expect(rendered.tracks[0].drumPattern).toBeUndefined()
    expect(rendered.warnings.join(' ')).toContain('6/8')
    expect(rendered.tracks[0].notes.every(note => note.start + note.duration <= 8)).toBe(true)
  })
  it('deduplica referencias, avisa de clips vacíos y permite secciones silenciosas', () => {
    const source = project(); source.sections[0].trackIds = ['melody', 'melody']
    expect(renderArrangement(source).tracks[0].notes).toHaveLength(3)
    source.tracks[0].notes = []
    expect(renderArrangement(source).warnings.join(' ')).toContain('no contiene notas')
    source.sections.forEach(s => { s.trackIds = [] })
    expect(renderArrangement(source).tracks).toEqual([])
    expect(renderArrangement(createProject()).end).toBe(0)
  })
  it('mueve la sección completa con letra y vínculos; mantiene límites del orden', () => {
    const source = project()
    const moved = moveSection(source.sections, 'b', -1)
    expect(moved.map(s => s.id)).toEqual(['b', 'a'])
    expect(moved[0]).toEqual(source.sections[1]); expect(source.sections[0].id).toBe('a')
    expect(moveSection(source.sections, 'a', -1)).toBe(source.sections)
    expect(moveSection(source.sections, 'missing', 1)).toBe(source.sections)
    expect(renderArrangement({ ...source, sections: moved }).tracks[0].notes[0].start).toBe(5)
  })
  it('integración con letras: aplicar otro borrador conserva el arreglo y sus clips', () => {
    const source = project()
    const next = { ...source, ...applyLyricsDraft(source, { title: 'Una canción', sections: [{ name: 'Verso nuevo', lyrics: 'Una letra nueva' }] }) }
    expect(next.sections[0]).toMatchObject({ id: 'a', bars: 3, trackIds: ['melody'] })
    expect(renderArrangement(next).tracks).toEqual(renderArrangement(source).tracks)
    expect(next.sections[1]).toEqual(source.sections[1])
  })
  it('frena expansión excesiva, demasiadas pistas, duraciones enormes y referencias rotas', () => {
    const source = project()
    source.sections = Array.from({ length: 3 }, (_, i) => ({ ...source.sections[0], id: String(i), bars: 512 }))
    expect(() => renderArrangement(source)).toThrow(/4096/)
    source.sections = [{ ...source.sections[0], bars: 512 }]
    source.tracks[0].notes = Array.from({ length: 40 }, (_, i) => ({ pitch: 60 + i, start: 0, duration: 1, velocity: 90 }))
    expect(() => renderArrangement(source)).toThrow(/15000/)
    const many = project(); many.tracks = Array.from({ length: 17 }, (_, i) => track({ id: String(i) })); many.sections[0].trackIds = many.tracks.map(t => t.id)
    expect(() => renderArrangement(many)).toThrow(/16 pistas/)
    const huge = project(); huge.tracks[0].notes[0].start = 1e100
    expect(() => renderArrangement(huge)).toThrow(/clip/)
    const broken = project(); broken.sections[0].trackIds = ['missing']
    expect(() => renderArrangement(broken)).toThrow()
  })
})
