// @vitest-environment happy-dom
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, type MusicProject } from '../../models/project'
import type { DraftResult } from '../../services/ai/lyricsContract'
import type { LyricsProvider } from '../../services/ai/lyricsProvider'
import LyricsWorkbench from './LyricsWorkbench'

let container: HTMLDivElement
let root: Root
let latest: MusicProject
const initial = (): MusicProject => ({ ...createProject(), parameters: { ...createProject().parameters, theme: 'La luz de una ventana' }, sections: [{ id: 'existing', name: 'Verso original', bars: 12, trackIds: [], lyrics: 'Mi letra original' }] })
const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name)!
async function input(selector: string, text: string) {
  const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  await act(() => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function Harness({ aiProvider }: { aiProvider?: LyricsProvider }) {
  const [project, setProject] = useState(initial)
  useEffect(() => { latest = project }, [project])
  return <LyricsWorkbench project={project} update={change => setProject(p => ({ ...p, ...change }))} saveStatus="Guardado" aiProvider={aiProvider}/>
}
async function selectGemini() {
  const select = container.querySelector<HTMLSelectElement>('[aria-label="Asistencia"]')!
  await act(() => { select.value = 'gemini'; select.dispatchEvent(new Event('change', { bubbles: true })) })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('Editor de letras en DOM simulado', () => {
  it('edita título, sección y letra manualmente sin solicitudes remotas', async () => {
    const remote = { generate: vi.fn() }
    await act(() => root.render(<Harness aiProvider={remote}/>))
    await input('.lyrics-editor>label input', 'Mi título')
    await input('.lyrics-section-heading input', 'Un verso')
    await input('.lyrics-section textarea', 'Una letra escrita por mí')
    expect(latest.name).toBe('Mi título')
    expect(latest.sections[0]).toMatchObject({ name: 'Un verso', lyrics: 'Una letra escrita por mí', id: 'existing', bars: 12 })
    expect(remote.generate).not.toHaveBeenCalled()
  })
  it('ofrece borrador local sin guardar y exige confirmación antes de reemplazar texto', async () => {
    await act(() => root.render(<Harness/>))
    await act(() => button('Preparar guía local').click())
    expect(container.textContent).toContain('Guía local · sin aplicar')
    expect(latest.sections[0].lyrics).toBe('Mi letra original')
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await act(() => button('Aplicar borrador al proyecto').click())
    expect(latest.sections[0].lyrics).toBe('Mi letra original')
    await act(() => button('Aplicar borrador al proyecto').click())
    expect(latest.sections).toHaveLength(5)
    expect(latest.sections[0]).toMatchObject({ id: 'existing', bars: 12 })
    expect(latest.sections[0].lyrics).toContain('La luz de una ventana')
    expect(container.querySelector('.lyrics-draft')).toBeNull()
  })
  it('descarta un borrador y cancela la eliminación sin perder texto', async () => {
    await act(() => root.render(<Harness/>))
    await act(() => button('Preparar guía local').click())
    await act(() => button('Descartar borrador').click())
    expect(container.querySelector('.lyrics-draft')).toBeNull()
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Eliminar sección 1"]')!.click())
    expect(latest.sections).toHaveLength(1)
    await act(() => button('Añadir sección').click())
    expect(latest.sections).toHaveLength(2)
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Eliminar sección 1"]')!.click())
    expect(latest.sections).toHaveLength(1)
    expect(latest.sections[0].id).not.toBe('existing')
  })
  it('no permite enviar a Gemini sin consentimiento y no envía la letra guardada', async () => {
    const provider = { generate: vi.fn().mockResolvedValue({ source: 'gemini', draft: { title: 'Nuevo', sections: [{ name: 'Verso', lyrics: 'Nueva letra' }] } }) }
    await act(() => root.render(<Harness aiProvider={provider}/>))
    await selectGemini()
    expect(button('Crear borrador con Gemini').disabled).toBe(true)
    expect(provider.generate).not.toHaveBeenCalled()
    await act(() => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
    await act(() => button('Crear borrador con Gemini').click())
    expect(provider.generate).toHaveBeenCalledTimes(1)
    expect(provider.generate.mock.calls[0][0]).not.toHaveProperty('sections')
    expect(JSON.stringify(provider.generate.mock.calls[0][0])).not.toContain('Mi letra original')
    expect(container.textContent).toContain('Borrador de Gemini · sin aplicar')
    expect(latest.sections[0].lyrics).toBe('Mi letra original')
  })
  it('una respuesta tardía tras cancelar no aparece ni modifica el proyecto', async () => {
    let resolve!: (result: DraftResult) => void
    const provider = { generate: vi.fn<LyricsProvider['generate']>(() => new Promise<DraftResult>(r => { resolve = r })) }
    await act(() => root.render(<Harness aiProvider={provider}/>))
    await selectGemini()
    await act(() => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
    await act(() => button('Crear borrador con Gemini').click())
    await act(() => button('Cancelar solicitud').click())
    await act(() => resolve({ source: 'gemini', draft: { title: 'Tardío', sections: [{ name: 'Verso', lyrics: 'No aplicar' }] } }))
    expect(container.querySelector('.lyrics-draft')).toBeNull()
    expect(container.textContent).toContain('Solicitud cancelada')
    expect(latest.sections[0].lyrics).toBe('Mi letra original')
    expect(provider.generate.mock.calls[0][1]?.aborted).toBe(true)
  })
  it('el fallback se identifica como guía local y conserva la letra actual', async () => {
    const provider = { generate: vi.fn().mockResolvedValue({ source: 'local', warning: 'Cuota agotada. Guía local disponible.', draft: { title: 'Guía', sections: [{ name: 'Verso', lyrics: '[Escribe aquí]' }] } }) }
    await act(() => root.render(<Harness aiProvider={provider}/>))
    await selectGemini()
    await act(() => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
    await act(() => button('Crear borrador con Gemini').click())
    expect(container.textContent).toContain('Cuota agotada')
    expect(container.textContent).toContain('Guía local · sin aplicar')
    expect(latest.sections[0].lyrics).toBe('Mi letra original')
  })
})
