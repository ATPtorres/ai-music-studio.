// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KnowledgeExplorer from './KnowledgeExplorer'

let container: HTMLDivElement
let root: Root
const onUseRecipe = vi.fn()
describe('Explorador de conocimiento en DOM simulado', () => {
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    onUseRecipe.mockClear()
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(() => root.render(<KnowledgeExplorer onUseRecipe={onUseRecipe}/>))
  })
  afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  it('ofrece 68 recursos, distingue consulta y prepara una receta compatible', async () => {
    expect(container.querySelectorAll('.knowledge-card')).toHaveLength(68)
    expect(container.querySelectorAll('.knowledge-card button')).toHaveLength(36)
    const button = container.querySelector<HTMLButtonElement>('.knowledge-card button')!
    await act(() => button.click())
    expect(onUseRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: 'major-home', mode: 'major', color: 'diatonic' }))
    const category = container.querySelector<HTMLSelectElement>('[aria-label="Categoría de biblioteca"]')!
    await act(() => { category.value = 'scales'; category.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.querySelectorAll('.knowledge-card')).toHaveLength(12)
    expect(container.querySelectorAll('.knowledge-card button')).toHaveLength(0)
    expect(container.textContent).toContain('Semitonos desde la tónica')
  })
  it('muestra un estado vacío al buscar sin coincidencias', async () => {
    const search = container.querySelector<HTMLInputElement>('[aria-label="Buscar en biblioteca"]')!
    // React's controlled-input tracker needs a native setter in simulated DOM.
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'zzzzzzzz')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelectorAll('.knowledge-card')).toHaveLength(0)
    expect(container.textContent).toContain('No hay coincidencias')
  })
})
