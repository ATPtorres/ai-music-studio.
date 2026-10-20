// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, type MusicProject } from '../../models/project'
import { parseProject } from '../../services/persistence'
import ChordWorkbench from './ChordWorkbench'
import type { KnowledgeSuggestion } from '../../knowledge/schema'

// Component tests exercise real generation/editing; audio is tested separately.
vi.mock('../../audio/ChordPlayer', () => ({ ChordPlayer: class { configure() {}; setVolume() {}; setLoop() {}; dispose() {}; getBeat() { return 0 } } }))

function Harness({ initial = createProject(), suggestion }: { initial?: MusicProject; suggestion?: KnowledgeSuggestion }) {
  const [project, setProject] = useState(initial)
  return <><ChordWorkbench project={project} suggestion={suggestion} saveStatus="Guardado de prueba" update={change => setProject(current => ({ ...current, ...change }))}/><output data-project>{JSON.stringify(project)}</output></>
}
let container: HTMLDivElement
let root: Root
const readProject = () => JSON.parse(container.querySelector('output')!.textContent!) as MusicProject
async function click(name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.trim() === name)
  expect(button, `Botón ${name}`).toBeTruthy()
  await act(() => button!.click())
}
async function select(label: string, value: string) {
  const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
  expect(element).toBeTruthy()
  await act(() => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('Interacciones del editor en DOM simulado', () => {
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(() => root.render(<Harness/>))
  })
  afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it('aplica la configuración al generar y guarda una pista real compatible con JSON', async () => {
    await select('Tonalidad de acordes', 'D')
    await select('Modo de acordes', 'major')
    await select('Número de compases', '8')
    await select('Tipo de acorde', 'seventh')
    await select('Compás de acordes', '6/8')
    expect(readProject().parameters.key).toBe('A') // Draft has not overwritten the project.
    await click('Generar progresión')
    const project = readProject()
    expect(project.parameters.key).toBe('D')
    expect(project.parameters.timeSignature).toEqual([6, 8])
    expect(project.tracks[0].chords).toHaveLength(8)
    expect(project.tracks[0].notes).toHaveLength(32)
    expect(parseProject(JSON.stringify(project))).toEqual(project)
    expect(container.querySelectorAll('.chord-tile')).toHaveLength(8)
  })

  it('editar grado y duración actualiza las notas y los siguientes inicios', async () => {
    await select('Tonalidad de acordes', 'C')
    await select('Modo de acordes', 'major')
    await click('Generar progresión')
    await select('Acorde 1', '4')
    await select('Duración del acorde 1', '2')
    const track = readProject().tracks[0]
    expect(track.chords[0].symbol).toBe('G')
    expect(track.chords[0].pitches).toEqual([55, 59, 62])
    expect(track.chords[0].duration).toBe(8)
    expect(track.chords[1].start).toBe(8)
    expect(track.notes[0]).toMatchObject({ pitch: 55, duration: 8 })
    expect(track.notes[3].start).toBe(8)
  })

  it('regenerar conserva la pista y sus referencias pero cambia las voces', async () => {
    await click('Generar progresión')
    const before = readProject().tracks[0]
    await click('Regenerar progresión')
    const after = readProject().tracks[0]
    expect(after.id).toBe(before.id)
    expect(readProject().tracks).toHaveLength(1)
    expect(after.chords.map(chord => chord.pitches)).not.toEqual(before.chords.map(chord => chord.pitches))
  })

  it('aplica préstamos, guarda su procedencia y marca las ediciones manuales', async () => {
    await select('Tonalidad de acordes', 'C')
    await select('Modo de acordes', 'major')
    await select('Complejidad armónica', 'intermediate')
    await select('Color armónico', 'borrowed')
    await select('Receta de partida', 'major-minor-four')
    await click('Generar progresión')
    expect(readProject().tracks[0].chords[2].symbol).toBe('Fm')
    expect(readProject().tracks[0].chords[2].pitches.some(p => p % 12 === 8)).toBe(true)
    expect(readProject().tracks[0].harmonyKnowledge).toMatchObject({ recipeId: 'major-minor-four', pinned: true, edited: false })
    await select('Acorde 1', '4')
    expect(readProject().tracks[0].harmonyKnowledge?.edited).toBe(true)
    const checkbox = container.querySelector<HTMLInputElement>('.creative-panel input[type="checkbox"]')!
    await act(() => checkbox.click())
    await click('Regenerar progresión')
    expect(readProject().tracks[0].harmonyKnowledge).toBeUndefined()
    expect(container.querySelector('.applied-recipe')).toBeNull()
  })

  it('preparar una receta desde biblioteca solo cambia el borrador hasta generar', async () => {
    const initial = createProject()
    await act(() => root.render(<Harness initial={initial} suggestion={{ id: 'major-applied-five', mode: 'major', complexity: 'intermediate', color: 'secondary' }}/>))
    // Remount mirrors navigation from the separate explorer page.
    await act(() => root.render(<Harness key="suggestion" initial={initial} suggestion={{ id: 'major-applied-five', mode: 'major', complexity: 'intermediate', color: 'secondary' }}/>))
    expect(readProject().parameters.mode).toBe('minor')
    expect(readProject().tracks).toHaveLength(0)
    await select('Tonalidad de acordes', 'C')
    await click('Generar progresión')
    expect(readProject().parameters.mode).toBe('major')
    expect(readProject().tracks[0].chords[2].symbol).toBe('D')
    expect(readProject().tracks[0].harmonyKnowledge?.recipeId).toBe('major-applied-five')
  })
  it('cambia el sonido sin alterar notas y lo conserva al regenerar', async () => {
    await click('Generar progresión')
    const options = Array.from(container.querySelectorAll<HTMLOptionElement>('select[aria-label="Sonido de acordes"] option')).map(option => option.value)
    expect(options).not.toContain('piano')
    expect(options).toContain('electric-piano')
    const before = structuredClone(readProject().tracks[0].notes)
    await select('Sonido de acordes', 'electric-piano')
    expect(readProject().tracks[0].sound).toBe('electric-piano')
    expect(readProject().tracks[0].notes).toEqual(before)
    await click('Regenerar progresión')
    expect(readProject().tracks[0].sound).toBe('electric-piano')
    expect(parseProject(JSON.stringify(readProject()))).toEqual(readProject())
  })

})
