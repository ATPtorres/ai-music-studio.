// @vitest-environment happy-dom
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, type MusicProject } from '../../models/project'
const audio = vi.hoisted(() => ({ configure: vi.fn(), play: vi.fn(), pause: vi.fn(), stop: vi.fn(), setMix: vi.fn(), setLoop: vi.fn(), seek: vi.fn(), dispose: vi.fn() }))
vi.mock('../../audio/TrackPlayer', () => ({ TrackPlayer: class { configure = audio.configure; play = audio.play; pause = audio.pause; stop = audio.stop; setMix = audio.setMix; setLoop = audio.setLoop; seek = audio.seek; dispose = audio.dispose; getBeat() { return 0 } } }))
vi.mock('../../midi/exportArrangement', () => ({ downloadArrangementMidi: vi.fn() }))
import { downloadArrangementMidi } from '../../midi/exportArrangement'
import ArrangementWorkbench from './ArrangementWorkbench'
let root: Root
let container: HTMLDivElement
let latest: MusicProject
const openLyrics = vi.fn(); const openTools = vi.fn()
function fixture(): MusicProject {
  return { ...createProject(), tracks: [{ id: 'piano', kind: 'chords', name: 'Piano', channel: 0, volume: 0.7, muted: false, notes: [{ pitch: 60, start: 0, duration: 4, velocity: 90 }], chords: [] }], sections: [{ id: 'verse', name: 'Verso', bars: 2, trackIds: ['piano'], lyrics: 'Letra del verso' }, { id: 'chorus', name: 'Estribillo', bars: 4, trackIds: [], lyrics: 'Letra del estribillo' }] }
}
function Harness({ empty = false }: { empty?: boolean }) {
  const [project, setProject] = useState<MusicProject>(() => empty ? createProject() : fixture())
  useEffect(() => { latest = project }, [project])
  return <ArrangementWorkbench project={project} update={change => setProject(p => ({ ...p, ...change }))} saveStatus="Guardado" onOpenLyrics={openLyrics} onOpenTools={openTools}/>
}
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!
async function input(selector: string, value: string, event = 'input') {
  const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  await act(() => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event(event, { bubbles: true }))
  })
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('confirm', vi.fn().mockReturnValue(true)); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
describe('Estudio de arreglo en DOM simulado', () => {
  it('presenta el timeline y vincula/desvincula sin modificar notas ni letras', async () => {
    await act(() => root.render(<Harness/>))
    const original = structuredClone(latest.tracks)
    expect(container.querySelectorAll('.arrangement-timeline thead th')).toHaveLength(3)
    const link = container.querySelector<HTMLButtonElement>('[aria-label="Vínculo Piano en sección 2: Estribillo"]')!
    expect(link.getAttribute('aria-pressed')).toBe('false')
    await act(() => link.click())
    expect(latest.sections[1].trackIds).toEqual(['piano'])
    expect(latest.sections[1].lyrics).toBe('Letra del estribillo'); expect(latest.tracks).toEqual(original)
    expect(audio.configure.mock.calls.at(-1)![0][0].notes.map((n: { start: number }) => n.start)).toEqual([0, 4, 8, 12, 16, 20])
    await act(() => link.click()); expect(latest.sections[1].trackIds).toEqual([])
  })
  it('mueve, duplica y elimina secciones conservando texto, IDs y vínculos', async () => {
    await act(() => root.render(<Harness/>))
    await act(() => button('Mover después').click())
    expect(latest.sections.map(s => s.id)).toEqual(['chorus', 'verse'])
    expect(latest.sections[1].lyrics).toBe('Letra del verso')
    await act(() => button('Duplicar sección').click())
    expect(latest.sections).toHaveLength(3)
    expect(latest.sections[2]).toMatchObject({ lyrics: 'Letra del verso', trackIds: ['piano'], bars: 2 })
    expect(latest.sections[2].id).not.toBe('verse')
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await act(() => button('Eliminar sección').click()); expect(latest.sections).toHaveLength(3)
    await act(() => button('Eliminar sección').click()); expect(latest.sections).toHaveLength(2)
    expect(latest.tracks).toHaveLength(1)
  })
  it('edita letra y compases con validación al confirmar y conserva todo el resto', async () => {
    await act(() => root.render(<Harness/>))
    await input('[aria-label="Letra de esta sección"]', 'Letra nueva')
    await input('.arrangement-section-fields input[type=number]', '3')
    const field = container.querySelector<HTMLInputElement>('.arrangement-section-fields input[type=number]')!
    await act(() => field.dispatchEvent(new Event('focusout', { bubbles: true })))
    expect(latest.sections[0]).toMatchObject({ id: 'verse', bars: 3, trackIds: ['piano'], lyrics: 'Letra nueva' })
    await input('.arrangement-section-fields input[type=number]', '0')
    await act(() => field.dispatchEvent(new Event('focusout', { bubbles: true })))
    expect(latest.sections[0].bars).toBe(3)
    expect(container.textContent).toContain('entre 1 y 512')
    await input('[aria-label="BPM"]', '90')
    const tempo = container.querySelector<HTMLInputElement>('[aria-label="BPM"]')!
    expect(latest.parameters.bpm).toBe(100)
    await act(() => tempo.dispatchEvent(new Event('focusout', { bubbles: true })))
    expect(latest.parameters.bpm).toBe(90)
    await input('[aria-label="BPM"]', '0')
    await act(() => tempo.dispatchEvent(new Event('focusout', { bubbles: true })))
    expect(latest.parameters.bpm).toBe(90); expect(container.textContent).toContain('entre 30 y 300')
  })
  it('mezcla en directo sin reconfigurar el transporte; guarda canales y volumen', async () => {
    await act(() => root.render(<Harness/>))
    const calls = audio.configure.mock.calls.length
    await input('[aria-label="Volumen Piano"]', '0.25')
    expect(latest.tracks[0].volume).toBe(0.25)
    expect(audio.setMix).toHaveBeenLastCalledWith('piano', 0.25, false)
    expect(audio.configure).toHaveBeenCalledTimes(calls)
    await act(() => container.querySelector<HTMLInputElement>('[aria-label="Silenciar Piano"]')!.click())
    expect(latest.tracks[0].muted).toBe(true); expect(audio.setMix).toHaveBeenLastCalledWith('piano', 0.25, true)
    const channel = container.querySelector<HTMLSelectElement>('[aria-label="Canal MIDI Piano"]')!
    await act(() => { channel.value = '2'; channel.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(latest.tracks[0].channel).toBe(2)
  })
  it('reproduce desde la sección, exporta el arreglo y permite volver a letras/generadores', async () => {
    await act(() => root.render(<Harness/>))
    const section = container.querySelector<HTMLSelectElement>('.arrangement-editor>label select')!
    await act(() => { section.value = 'chorus'; section.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(() => button('Reproducir desde esta sección').click())
    expect(audio.seek).toHaveBeenCalledWith(8); expect(audio.play).toHaveBeenCalledOnce()
    await act(() => button('Descargar MIDI del arreglo').click())
    expect(downloadArrangementMidi).toHaveBeenCalledWith(latest)
    await act(() => button('Abrir letras').click()); expect(openLyrics).toHaveBeenCalledOnce()
    await act(() => button('Abrir generadores').click()); expect(openTools).toHaveBeenCalledOnce()
    await act(() => root.unmount()); root = createRoot(container)
    expect(audio.dispose).toHaveBeenCalledOnce()
  })
  it('crea una estructura solo cuando está vacío y admite añadir una sección sin pistas', async () => {
    await act(() => root.render(<Harness empty/>))
    expect(button('Reproducir arreglo').disabled).toBe(true)
    await act(() => button('Crear estructura inicial').click())
    expect(latest.sections.map(s => s.name)).toEqual(['Intro', 'Verso', 'Estribillo'])
    expect(container.textContent).toContain('Todavía no hay pistas')
    await act(() => button('Añadir sección').click()); expect(latest.sections).toHaveLength(4)
    expect(new Set(latest.sections.map(s => s.id)).size).toBe(4)
  })
  it('selecciona sonido en la mezcla, reconfigura el preview y conserva los eventos', async () => {
    await act(() => root.render(<Harness/>))
    const original = structuredClone(latest.tracks[0].notes)
    const sound = container.querySelector<HTMLSelectElement>('[aria-label="Sonido Piano"]')!
    await act(() => { sound.value = 'pad'; sound.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(latest.tracks[0].sound).toBe('pad')
    expect(latest.tracks[0].notes).toEqual(original)
    expect(audio.configure.mock.calls.at(-1)![0][0].sound).toBe('pad')
  })

})
