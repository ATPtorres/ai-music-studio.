// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, type MusicProject } from '../../models/project'
import { generateProgression, withChordTrack } from '../../music/harmony'
import { generateLine, withLineTrack, type LineKind } from '../../music/lines'
import { parseProject } from '../../services/persistence'
import LineWorkbench from './LineWorkbench'

const fake = vi.hoisted(() => ({ configure: vi.fn(), mix: vi.fn(), openChords: vi.fn() }))
vi.mock('../../audio/TrackPlayer', () => ({ TrackPlayer: class {
  constructor(private state: (value: string) => void) {}
  configure = fake.configure; setMix = fake.mix
  setLoop() {}; dispose() {}; stop() { this.state('stopped') }; pause() { this.state('paused') }; async play() { this.state('playing') }
} }))

function fixture() {
  const project = createProject()
  project.tracks = withChordTrack(project, generateProgression({ key: 'A', mode: 'minor', bars: 4, signature: [4, 4], genre: 'Pop', mood: 'Alegre', complexity: 'simple', chordType: 'triad', seed: 8 }), 'Acordes')
  return project
}
function Harness({ kind = 'melody', initial = fixture() }: { kind?: LineKind; initial?: MusicProject }) {
  const [project, setProject] = useState(initial)
  return <><LineWorkbench kind={kind} project={project} update={change => setProject(current => ({ ...current, ...change }))} saveStatus="Guardado de prueba" onOpenChords={fake.openChords}/><button onClick={() => setProject(current => ({ ...current, tracks: current.tracks.map(track => track.kind === 'chords' ? { ...track, chords: track.chords.map((chord, i) => i === 0 ? { ...chord, pitches: chord.pitches.map(pitch => pitch + 1) } : chord) } : track) }))}>Cambiar armonía de prueba</button><output>{JSON.stringify(project)}</output></>
}
let container: HTMLDivElement
let root: Root
const readProject = () => JSON.parse(container.querySelector('output')!.textContent!) as MusicProject
async function click(name: string) {
  const element = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === name || button.getAttribute('aria-label') === name)
  expect(element, name).toBeTruthy()
  await act(() => element!.click())
}
async function select(label: string, value: string) {
  const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
  await act(() => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
}
describe('Editor de melodía y bajo en DOM simulado', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  it('genera una melodía editable y la conserva en JSON con su referencia armónica', async () => {
    await act(() => root.render(<Harness/>))
    await select('Densidad de notas', 'dense')
    await click('Generar melodía')
    const source = readProject().tracks.find(track => track.kind === 'melody')!
    expect(source.notes).toHaveLength(32)
    expect(source.sourceHarmony).toMatch(/^h1:/)
    expect(source.generation).toMatchObject({ low: 60, high: 84, density: 'dense' })
    expect(parseProject(JSON.stringify(readProject()))).toEqual(readProject())
    const note = container.querySelector('.roll-note')!
    await act(() => note.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    await select('Altura de nota', '72')
    expect(readProject().tracks.find(track => track.kind === 'melody')!.notes[0].pitch).toBe(72)
    await click('Eliminar')
    expect(readProject().tracks.find(track => track.kind === 'melody')!.notes).toHaveLength(31)
    await click('Añadir nota')
    expect(readProject().tracks.find(track => track.kind === 'melody')!.notes).toHaveLength(32)
  })
  it('crea variaciones con los mismos tiempos y avisa al cambiar la armonía sin borrar notas', async () => {
    await act(() => root.render(<Harness/>))
    await click('Generar melodía')
    const before = readProject().tracks[1].notes
    await click('Variar frase')
    const after = readProject().tracks[1].notes
    expect(after).not.toEqual(before)
    expect(after.map(note => [note.start, note.duration])).toEqual(before.map(note => [note.start, note.duration]))
    await click('Cambiar armonía de prueba')
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('La armonía cambió')
    expect(readProject().tracks[1].notes).toEqual(after)
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Variar frase'))!.disabled).toBe(true)
  })
  it('rechaza duración que se solapa y restablece el campo sin perder la nota', async () => {
    await act(() => root.render(<Harness/>))
    await click('Generar melodía')
    await act(() => container.querySelector('.roll-note')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const original = readProject().tracks[1].notes[0].duration
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Duración · negras"]')!
    await act(() => { input.value = '2'; input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
    expect(readProject().tracks[1].notes[0].duration).toBe(original)
    expect(input.value).toBe(String(original))
    expect(container.textContent).toContain('no deben solaparse')
  })
  it('genera bajo, reproduce tres pistas y cambia mute sin reiniciar el transporte', async () => {
    const project = fixture()
    project.tracks = withLineTrack(project, 'melody', generateLine(project, 'melody', { low: 60, high: 84, density: 'medium', rhythm: 'straight', complexity: 'simple', seed: 1 }))
    await act(() => root.render(<Harness kind="bass" initial={project}/>))
    await click('Generar bajo')
    const label = Array.from(container.querySelectorAll('label')).find(item => item.textContent === 'Con melodía')!
    await act(() => label.querySelector('input')!.click())
    expect(fake.configure.mock.calls.at(-1)![0]).toHaveLength(3)
    await click('Reproducir')
    expect(container.querySelector('.line-play-state')!.textContent).toBe('Reproduciendo')
    const count = fake.configure.mock.calls.length
    const mute = Array.from(container.querySelectorAll('label')).find(item => item.textContent === 'Silenciar línea')!
    await act(() => mute.querySelector('input')!.click())
    expect(fake.configure.mock.calls.length).toBe(count)
    expect(fake.mix.mock.calls.at(-1)![2]).toBe(false) // Last mix entry is accompaniment; bass is first.
    expect(fake.mix.mock.calls.slice(-3)[0][2]).toBe(true)
    await click('Pausar línea')
    expect(container.querySelector('.line-play-state')!.textContent).toBe('En pausa')
    const mixes = fake.mix.mock.calls.length
    const bpm = container.querySelector<HTMLInputElement>('input[aria-label="Tempo de línea"]')!
    await act(() => { bpm.value = '120'; bpm.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
    expect(fake.configure.mock.calls.at(-1)![1]).toBe(120)
    expect(fake.mix.mock.calls.length).toBeGreaterThan(mixes)
    expect(fake.mix.mock.calls.slice(-3)[0][2]).toBe(true)
  })
  it('ofrece abrir Acordes cuando el proyecto aún no tiene armonía', async () => {
    await act(() => root.render(<Harness initial={createProject()}/>))
    await click('Abrir Acordes')
    expect(fake.openChords).toHaveBeenCalledOnce()
    expect(container.querySelector('.line-settings')).toBeNull()
  })
})
