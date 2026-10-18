import { describe, expect, it, vi } from 'vitest'
import { createProject, projectSchema } from '../../models/project'
import { parseProject } from '../persistence'
import { applyLyricsDraft, lyricsAsText } from '../../features/lyrics/lyricsProject'
import { createLocalLyrics } from './localLyrics'
import { createGeminiLyricsProvider } from './lyricsProvider'
import { lyricsDraftSchema, lyricsRequestSchema, type LyricsRequest } from './lyricsContract'

const request: LyricsRequest = { theme: 'Volver a casa', genre: 'Pop', mood: 'Sereno', language: 'Español', structure: 'short', instructions: '' }
describe('Letras: contratos, guías y preservación del proyecto', () => {
  it('valida las fronteras y produce guías de todas las estructuras e idiomas', () => {
    for (const language of ['Español', 'English'] as const) for (const structure of ['classic', 'short', 'narrative'] as const) {
      const result = createLocalLyrics({ ...request, language, structure })
      expect(result.source).toBe('local')
      expect(lyricsDraftSchema.parse(result.draft)).toEqual(result.draft)
      expect(result.draft.sections).toHaveLength(structure === 'classic' ? 5 : structure === 'short' ? 3 : 4)
      expect(result.draft.sections[0].lyrics).toContain(request.theme)
    }
    expect(lyricsRequestSchema.safeParse({ ...request, theme: ' ' }).success).toBe(false)
    expect(lyricsRequestSchema.safeParse({ ...request, apiKey: 'should-not-travel' }).success).toBe(false)
    expect(lyricsDraftSchema.safeParse({ title: 'x', sections: [] }).success).toBe(false)
    expect(lyricsDraftSchema.safeParse({ title: 'x', sections: Array.from({ length: 7 }, () => ({ name: 'x', lyrics: 'x'.repeat(4000) })) }).success).toBe(false)
  })
  it('aplica texto conservando pistas, IDs, compases, referencias y secciones adicionales en JSON v1', () => {
    const project = createProject()
    project.tracks = [{ id: 'track', name: 'Piano', kind: 'chords', channel: 0, muted: false, volume: 0.6, notes: [{ pitch: 60, start: 0, duration: 1, velocity: 100 }], chords: [] }]
    project.sections = Array.from({ length: 4 }, (_, i) => ({ id: `section-${i}`, name: `Sección ${i}`, bars: 12, trackIds: ['track'], lyrics: 'Letra existente' }))
    const original = structuredClone(project)
    const next = { ...project, ...applyLyricsDraft(project, createLocalLyrics(request).draft) }
    expect(project).toEqual(original)
    expect(next.tracks).toEqual(original.tracks)
    expect(next.sections[0]).toMatchObject({ id: 'section-0', bars: 12, trackIds: ['track'] })
    expect(next.sections[3]).toEqual(original.sections[3])
    expect(parseProject(JSON.stringify(next))).toEqual(next)
    expect(lyricsAsText(next)).toContain('Volver a casa')
    expect(lyricsAsText(next)).toContain('Letra existente')
  })
  it('crea secciones sin colisiones de ID y rechaza borradores inválidos sin mutar', () => {
    const project = createProject()
    const next = { ...project, ...applyLyricsDraft(project, createLocalLyrics(request).draft) }
    expect(new Set(next.sections.map(s => s.id)).size).toBe(3)
    expect(projectSchema.safeParse(next).success).toBe(true)
    expect(() => applyLyricsDraft(project, { title: '', sections: [] })).toThrow()
    expect(project.sections).toHaveLength(0)
  })
})
describe('Proveedor remoto opcional con fallback local', () => {
  it('usa solo el endpoint del propio sitio y devuelve un borrador validado', async () => {
    const draft = createLocalLyrics(request).draft
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ source: 'gemini', draft }))
    expect(await createGeminiLyricsProvider(fetcher).generate(request)).toEqual({ source: 'gemini', draft })
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('/.netlify/functions/lyrics')
    expect(options).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'error' })
    expect(JSON.parse(options!.body as string)).toEqual(request)
    expect(JSON.stringify(options)).not.toContain('API_KEY')
  })
  it.each([403, 429, 503, 504, 502])('con error %i ofrece guía local sin reintentos', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
    const result = await createGeminiLyricsProvider(fetcher).generate(request)
    expect(result.source).toBe('local'); expect(result.warning).toContain('tu letra guardada no cambió')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('rechaza JSON inválido, campos desconocidos y respuestas excesivas', async () => {
    for (const body of ['not JSON', JSON.stringify({ source: 'gemini', draft: { ...createLocalLyrics(request).draft, extra: true } }), 'x'.repeat(100001)]) {
      const result = await createGeminiLyricsProvider(vi.fn<typeof fetch>().mockResolvedValue(new Response(body))).generate(request)
      expect(result.source).toBe('local'); expect(result.warning).toBeTruthy()
    }
  })
  it('no devuelve fallback después de una cancelación explícita', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); throw new DOMException('Cancelled', 'AbortError') })
    await expect(createGeminiLyricsProvider(fetcher).generate(request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
