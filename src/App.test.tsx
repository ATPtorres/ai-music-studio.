// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject } from './models/project'

const fake = vi.hoisted(() => ({ update: vi.fn(), replace: vi.fn() }))
vi.mock('./state/useProject', () => ({ useProject: () => ({ project: createProject(), update: fake.update, replace: fake.replace, status: 'Guardado', blocked: false }) }))
vi.mock('./features/chords/ChordWorkbench', () => ({ default: () => <section aria-label="Acordes de prueba"/> }))
vi.mock('./features/lines/LineWorkbench', () => ({ default: () => <section aria-label="Notas de prueba"/> }))
vi.mock('./features/drums/DrumWorkbench', () => ({ default: () => <section aria-label="Batería de prueba"/> }))
vi.mock('./features/lyrics/LyricsWorkbench', () => ({ default: () => <section aria-label="Letras de prueba"/> }))
vi.mock('./features/arrangement/ArrangementWorkbench', () => ({ default: () => <section aria-label="Arreglo de prueba"/> }))
import App from './App'

let container: HTMLDivElement, root: Root
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.clearAllMocks()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<App/>))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('Navegación móvil y acceso al contenido', () => {
  it('identifica la página actual, ofrece salto al contenido y enfoca el contenido al navegar', async () => {
    const nav = container.querySelector('nav')!
    expect(nav.querySelector('[aria-current="page"]')!.textContent).toBe('Mi estudio')
    expect(container.querySelector('.skip-link')?.getAttribute('href')).toBe('#main-content')
    const tools = [...nav.querySelectorAll('button')].find(b => b.textContent === 'Herramientas')!
    await act(async () => tools.click())
    expect(nav.querySelector('[aria-current="page"]')).toBe(tools)
    expect(document.activeElement?.id).toBe('main-content')
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0)
    expect(fake.update).not.toHaveBeenCalled()
  })
  it('cambia entre los seis módulos con el selector sin modificar las pistas ni sus parámetros', async () => {
    const card = [...container.querySelectorAll('button')].find(b => b.classList.contains('module-card') && b.textContent?.includes('Acordes'))!
    await act(async () => card.click())
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Cambiar herramienta"]')!
    expect(select.closest<HTMLElement>('.mobile-module-switcher')?.hidden).toBe(false)
    expect(select.options).toHaveLength(6)
    const headings: Record<string, string> = { melody: 'Una melodía que cuenta algo.', bass: 'Todo empieza desde abajo.', drums: 'Dale pulso a tu canción.', lyrics: 'Tu historia también tiene música.', arrangement: 'Tu canción, de principio a fin.', chords: 'Dale armonía a tu idea.' }
    for (const [page, heading] of Object.entries(headings)) {
      await act(async () => { select.value = page; select.dispatchEvent(new Event('change', { bubbles: true })) })
      expect(container.querySelector('h1')!.textContent).toBe(heading)
      expect(container.querySelector('nav [aria-current="page"]')!.textContent).toBe('Herramientas')
      expect(document.activeElement?.id).toBe('main-content')
    }
    expect(fake.update).not.toHaveBeenCalled(); expect(fake.replace).not.toHaveBeenCalled()
  })
})
