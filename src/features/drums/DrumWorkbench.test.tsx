// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, type MusicProject } from '../../models/project'
import { parseProject } from '../../services/persistence'
import { generateProgression, withChordTrack } from '../../music/harmony'
import { generateLine, withLineTrack } from '../../music/lines'
import DrumWorkbench from './DrumWorkbench'
const fake = vi.hoisted(() => ({ configure: vi.fn(), mix: vi.fn() }))
vi.mock('../../audio/TrackPlayer', () => ({ TrackPlayer: class {
  constructor(private state: (value: string) => void) {}
  configure = fake.configure; setMix = fake.mix
  setLoop() {}; dispose() {}; getBeat() { return 0 }; stop() { this.state('stopped') }; pause() { this.state('paused') }; async play() { this.state('playing') }
} }))
function Harness({ initial = createProject() }: { initial?: MusicProject }) {
  const [project, setProject] = useState(initial)
  return <><DrumWorkbench project={project} update={change => setProject(current => ({ ...current, ...change }))} saveStatus="Guardado de prueba"/><output>{JSON.stringify(project)}</output></>
}
let container: HTMLDivElement
let root: Root
const originalConfirm = window.confirm
const readProject = () => JSON.parse(container.querySelector('output')!.textContent!) as MusicProject
async function click(name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.trim() === name || item.getAttribute('aria-label') === name)
  expect(button, name).toBeTruthy()
  await act(() => button!.click())
}
async function select(label: string, value: string) {
  const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
  await act(() => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
}
async function blurNumber(label: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
  await act(() => { element.value = value; element.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
}
describe('Secuenciador en DOM simulado', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(async () => { await act(() => root.unmount()); container.remove(); window.confirm = originalConfirm; vi.restoreAllMocks(); vi.unstubAllGlobals() })
  it('funciona sin acordes, genera 6/8 y conserva pasos y notas al exportar JSON', async () => {
    await act(() => root.render(<Harness/>))
    await select('Género de batería', 'Reggaetón'); await select('Compases de batería', '1'); await select('Compás de batería', '6/8')
    await click('Generar patrón')
    expect(container.querySelectorAll('button.drum-step')).toHaveLength(72)
    const project = readProject()
    expect(project.parameters.timeSignature).toEqual([6, 8])
    expect(project.tracks[0].channel).toBe(9)
    expect(project.tracks[0].drumPattern!.lanes.kick).toHaveLength(12)
    expect(parseProject(JSON.stringify(project))).toEqual(project)
  })
  it('alterna pasos y permite seleccionar con Mayús y editar velocidades sin borrar otros golpes', async () => {
    await act(() => root.render(<Harness/>)); await click('Generar patrón')
    const initial = readProject().tracks[0].drumPattern!.lanes.kick[0]
    expect(initial).toBeGreaterThan(0)
    const button = () => container.querySelector<HTMLButtonElement>('button[data-lane="kick"][data-step="0"]')!
    await act(() => button().click())
    expect(readProject().tracks[0].drumPattern!.lanes.kick[0]).toBe(0)
    await act(() => button().dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })))
    expect(readProject().tracks[0].drumPattern!.lanes.kick[0]).toBe(0)
    await blurNumber('Velocidad del golpe', '112')
    expect(readProject().tracks[0].drumPattern!.lanes.kick[0]).toBe(112)
    expect(readProject().tracks[0].notes.find(note => note.pitch === 36 && note.start === 0)!.velocity).toBe(112)
  })
  it('mantiene separados los compases y aplica variaciones reales', async () => {
    await act(() => root.render(<Harness/>)); await click('Generar patrón')
    const first = readProject().tracks[0].drumPattern!.lanes.kick[0]
    await click('Compás siguiente')
    await act(() => container.querySelector<HTMLButtonElement>('button[data-lane="kick"][data-step="16"]')!.click())
    expect(readProject().tracks[0].drumPattern!.lanes.kick[0]).toBe(first)
    expect(readProject().tracks[0].drumPattern!.lanes.kick[16]).toBe(0)
    const before = readProject().tracks[0]
    await click('Variar patrón')
    expect(readProject().tracks[0].id).toBe(before.id)
    expect(readProject().tracks[0].drumPattern!.lanes).not.toEqual(before.drumPattern!.lanes)
  })
  it('confirma antes de vaciar y deja una cuadrícula editable sin notas', async () => {
    await act(() => root.render(<Harness/>)); await click('Generar patrón')
    const before = readProject()
    const confirm = vi.fn().mockReturnValue(false)
    window.confirm = confirm
    await click('Vaciar patrón')
    expect(readProject()).toEqual(before)
    confirm.mockReturnValue(true)
    await click('Vaciar patrón')
    expect(readProject().tracks[0].notes).toHaveLength(0)
    expect(container.querySelectorAll('button.drum-step')).toHaveLength(96)
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'MIDI de batería')!.disabled).toBe(true)
  })
  it('modifica el swing guardado y los tiempos de notas desde el control', async () => {
    await act(() => root.render(<Harness/>))
    await select('Género de batería', 'Funk'); await click('Generar patrón')
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Swing de batería"]')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(() => { setter.call(input, '0.5'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(readProject().tracks[0].drumPattern!.swing).toBe(0.5)
    expect(readProject().tracks[0].notes.some(note => note.start % 0.25 !== 0)).toBe(true)
  })
  it('sincroniza cuatro pistas, repite el ciclo y mantiene mezcla al cambiar BPM', async () => {
    const project = createProject()
    project.tracks = withChordTrack(project, generateProgression({ key: 'A', mode: 'minor', bars: 4, signature: [4, 4], genre: 'Pop', mood: 'Alegre', complexity: 'simple', chordType: 'triad', seed: 1 }), 'Acordes')
    for (const kind of ['melody', 'bass'] as const) project.tracks = withLineTrack(project, kind, generateLine(project, kind, { low: kind === 'bass' ? 28 : 60, high: kind === 'bass' ? 52 : 84, density: 'medium', rhythm: 'straight', complexity: 'simple', seed: 1 }))
    await act(() => root.render(<Harness initial={project}/>))
    await select('Compases de batería', '1'); await click('Generar patrón')
    const count = readProject().tracks.find(track => track.kind === 'drums')!.notes.length
    for (const text of ['Con acordes', 'Con melodía', 'Con bajo']) {
      const label = Array.from(container.querySelectorAll('label')).find(item => item.textContent === text)!
      await act(() => label.querySelector('input')!.click())
    }
    const config = fake.configure.mock.calls.at(-1)!
    expect(config[0]).toHaveLength(4)
    expect(config[0].find((track: { kind: string }) => track.kind === 'drums').notes).toHaveLength(count * 4)
    expect(config[2]).toBe(16)
    await click('Reproducir')
    expect(container.querySelector('.drum-play-state')!.textContent).toBe('Reproduciendo')
    const configurations = fake.configure.mock.calls.length
    const mute = Array.from(container.querySelectorAll('label')).find(item => item.textContent === 'Silenciar batería')!
    await act(() => mute.querySelector('input')!.click())
    expect(fake.configure.mock.calls.length).toBe(configurations)
    const mixes = fake.mix.mock.calls.length
    await blurNumber('Tempo de batería', '123')
    expect(fake.configure.mock.calls.at(-1)![1]).toBe(123)
    expect(fake.mix.mock.calls.length).toBeGreaterThan(mixes)
    expect(fake.mix.mock.calls.slice(-4)[0][2]).toBe(true)
  })
})
