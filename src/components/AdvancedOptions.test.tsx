// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { parseProject } from '../services/persistence'
import ChordWorkbench from '../features/chords/ChordWorkbench'
import LineWorkbench from '../features/lines/LineWorkbench'
import DrumWorkbench from '../features/drums/DrumWorkbench'
import LyricsWorkbench from '../features/lyrics/LyricsWorkbench'
import ArrangementWorkbench from '../features/arrangement/ArrangementWorkbench'

vi.mock('../audio/ChordPlayer', () => ({ ChordPlayer: class { configure() {}; setVolume() {}; setLoop() {}; dispose() {} } }))
vi.mock('../audio/TrackPlayer', () => ({ TrackPlayer: class { configure() {}; setMix() {}; setLoop() {}; dispose() {}; stop() {}; getBeat() { return 0 } } }))

const project = parseProject(readFileSync('docs/examples/proyecto-estructura-aleatoria.json', 'utf8'))
const update = vi.fn()
const props = { project, update, saveStatus: 'Guardado' }
const noop = () => {}
const modules = [
  { name: 'Acordes', view: <ChordWorkbench {...props}/>, field: '[aria-label="Tipo de acorde"]', value: 'extended', basic: '[aria-label="Género de acordes"]' },
  { name: 'Melodías', view: <LineWorkbench {...props} kind="melody" onOpenChords={noop}/>, field: '[aria-label="Nota más grave"]', value: '58', basic: '[aria-label="Patrón rítmico"]' },
  { name: 'Bajos', view: <LineWorkbench {...props} kind="bass" onOpenChords={noop}/>, field: '[aria-label="Nota más grave"]', value: '26', basic: '[aria-label="Patrón rítmico"]' },
  { name: 'Batería', view: <DrumWorkbench {...props}/>, field: '[aria-label="Swing de batería"]', basic: '[aria-label="Género de batería"]' },
  { name: 'Letras', view: <LyricsWorkbench {...props}/>, field: '.advanced-options select', value: 'narrative', basic: '[aria-label="Asistencia"]' },
  { name: 'Estructura', view: <ArrangementWorkbench {...props} onOpenLyrics={noop} onOpenTools={noop}/>, field: '[aria-label="Compases de frase principal"]', value: '16', basic: '[aria-label="Familia de estructura"]' },
]
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  update.mockClear()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })

it.each(modules)('$name oculta los ajustes técnicos y conserva su valor al plegar sin escribir el proyecto', async ({ name, view, field, value, basic }) => {
  await act(() => root.render(view))
  const toggle = container.querySelector<HTMLButtonElement>(`[aria-label="Opciones avanzadas de ${name}"]`)!
  const control = container.querySelector<HTMLSelectElement>(field)!
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(control.closest('[hidden]')).not.toBeNull()
  expect(container.querySelector(basic)?.closest('[hidden]')).toBeNull()
  await act(() => toggle.click())
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(control.closest('[hidden]')).toBeNull()
  if (value) await act(() => { control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })) })
  const current = control.value
  await act(() => toggle.click())
  expect(control.closest('[hidden]')).not.toBeNull()
  await act(() => toggle.click())
  expect(control.value).toBe(current)
  expect(update).not.toHaveBeenCalled()
})

it('mantiene el consentimiento y el botón de Gemini visibles al plegar Letras', async () => {
  await act(() => root.render(<LyricsWorkbench {...props}/>))
  const provider = container.querySelector<HTMLSelectElement>('[aria-label="Asistencia"]')!
  await act(() => { provider.value = 'gemini'; provider.dispatchEvent(new Event('change', { bubbles: true })) })
  const consent = container.querySelector('.lyrics-consent')!
  expect(consent.closest('[hidden]')).toBeNull()
  const generate = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Crear borrador con Gemini'))!
  expect(generate.disabled).toBe(true)
  expect(generate.closest('[hidden]')).toBeNull()
})

it('asignar una frase conserva la vista básica y las ediciones detalladas se habilitan al desplegar', async () => {
  await act(() => root.render(<ArrangementWorkbench {...props} onOpenLyrics={noop} onOpenTools={noop}/>))
  const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Opciones avanzadas de Estructura"]')!
  const clip = container.querySelector<HTMLSelectElement>('.gantt-slot select')!
  await act(() => { clip.value = ''; clip.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(update).toHaveBeenCalled()
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(container.querySelector('#variant-library')?.closest('[hidden]')).not.toBeNull()
  expect(container.querySelector('.gantt-edit')?.closest('[hidden]')).not.toBeNull()
  await act(() => toggle.click())
  await act(() => container.querySelector<HTMLButtonElement>('.gantt-edit')!.click())
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(container.querySelector('#variant-library')?.closest('[hidden]')).toBeNull()
})
