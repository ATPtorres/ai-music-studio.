import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLyricsHandler, lyricsKnowledgeContext, quotaScript } from './lyrics'

const input = { theme: 'Una despedida con esperanza', genre: 'Pop', mood: 'Sereno', language: 'Español', structure: 'short', instructions: 'Imágenes sencillas' }
const draft = { title: 'Volver', sections: ['Verso', 'Estribillo', 'Cierre'].map(name => ({ name, lyrics: 'Un camino para volver.' })) }
const env = { URL: 'https://studio.example', GEMINI_API_KEY: 'fake-server-key', GEMINI_MODEL: 'gemini-test', UPSTASH_REDIS_REST_URL: 'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'fake-redis-token' }
const now = () => Date.UTC(2026, 9, 18, 12)
const request = (body: unknown = input, headers: Record<string, string> = {}) => new Request('https://studio.example/.netlify/functions/lyrics', { method: 'POST', headers: { Origin: env.URL, 'Content-Type': 'application/json', 'X-Lyrics-Request': '1', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const modelResponse = (content: unknown = draft, finishReason = 'STOP') => Response.json({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(content) }] } }] })
function setup(options: { quota?: number; model?: Response; environment?: Record<string, string>; storeFailure?: boolean } = {}) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
    if (String(url).includes('upstash.io')) {
      if (options.storeFailure) throw new Error('private-store-diagnostics')
      return Response.json({ result: options.quota ?? 0 })
    }
    return options.model ?? modelResponse()
  })
  return { fetcher, handler: createLyricsHandler({ env: options.environment ?? env, now, fetcher }) }
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
describe('Función de letras: fronteras y protección del endpoint', () => {
  it('reserva cuota persistente antes de llamar a Gemini y valida su JSON', async () => {
    const { fetcher, handler } = setup()
    const response = await handler(request({ ...input, language: 'English' }), { ip: '203.0.113.10' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ source: 'gemini', draft })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetcher).toHaveBeenCalledTimes(2)
    const [storeUrl, store] = fetcher.mock.calls[0]
    expect(storeUrl).toBe(env.UPSTASH_REDIS_REST_URL)
    const command = JSON.parse(store!.body as string)
    expect(command.slice(0, 3)).toEqual(['EVAL', quotaScript, '3'])
    expect(command.slice(6, 9)).toEqual(['5', '20', '100'])
    expect(store!.body).not.toContain('203.0.113.10')
    const [modelUrl, model] = fetcher.mock.calls[1]
    expect(modelUrl).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
    expect(modelUrl).not.toContain(env.GEMINI_API_KEY)
    expect(model!.headers).toMatchObject({ 'x-goog-api-key': env.GEMINI_API_KEY })
    const payload = JSON.parse(model!.body as string)
    expect(payload.generationConfig.responseMimeType).toBe('application/json')
    expect(payload.contents[0].parts[0].text).toContain('libraryVersion')
    expect(JSON.parse(payload.contents[0].parts[0].text).sectionNames).toEqual(['Verse', 'Chorus', 'Outro'])
    expect(JSON.stringify(payload)).not.toContain(env.GEMINI_API_KEY)
    expect(JSON.stringify(lyricsKnowledgeContext()).length).toBeLessThan(4000)
  })
  it.each([1, 2, 3])('bloquea exceso de cuota %i sin llamar al modelo', async quota => {
    const { handler, fetcher } = setup({ quota })
    const response = await handler(request(), { ip: '203.0.113.10' })
    expect(response.status).toBe(429); expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('rechaza métodos, orígenes ajenos, ausencia de origen y encabezados sin consumir cuota', async () => {
    const { handler, fetcher } = setup()
    expect((await handler(new Request(env.URL), {})).status).toBe(405)
    for (const headers of [{ Origin: 'https://evil.example' }, { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'X-Lyrics-Request': '' }] as Record<string, string>[]) expect((await handler(request(input, headers), { ip: 'a' })).status).toBe(403)
    expect((await handler(request(input, { 'Content-Type': 'text/plain' }), { ip: 'a' })).status).toBe(415)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('valida JSON, campos, caracteres y límite de bytes incluso sin Content-Length', async () => {
    const { handler, fetcher } = setup()
    for (const bad of ['{broken', { ...input, theme: '' }, { ...input, theme: 'x'.repeat(1001) }, { ...input, apiKey: 'injected' }, { ...input, instructions: 'x'.repeat(1001) }]) expect((await handler(request(bad), { ip: 'a' })).status).toBe(400)
    expect((await handler(request(' '.repeat(12001)), { ip: 'a' })).status).toBe(413)
    expect((await handler(request(input, { 'Content-Length': '12001' }), { ip: 'a' })).status).toBe(413)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('no acepta identidad IP proporcionada por el cliente', async () => {
    const { handler, fetcher } = setup()
    expect((await handler(request(input, { 'X-Forwarded-For': 'spoofed' }), {})).status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('queda desactivada si falta cualquier credencial o si hay destinos no admitidos', async () => {
    for (const missing of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'URL']) {
      const { handler, fetcher } = setup({ environment: { ...env, [missing]: '' } })
      const result = await handler(request(), { ip: 'a' })
      expect([403, 503]).toContain(result.status)
      expect(fetcher).not.toHaveBeenCalled()
    }
    for (const overrides of [{ GEMINI_MODEL: '../other-model' }, { UPSTASH_REDIS_REST_URL: 'http://localhost' }, { UPSTASH_REDIS_REST_URL: 'https://evil.example' }]) {
      const { handler, fetcher } = setup({ environment: { ...env, ...overrides } })
      expect((await handler(request(), { ip: 'a' })).status).toBe(503)
      expect(fetcher).not.toHaveBeenCalled()
    }
  })
  it('falla cerrada si el limitador no responde, sin filtrar diagnósticos privados', async () => {
    const { handler, fetcher } = setup({ storeFailure: true })
    const response = await handler(request(), { ip: 'a' })
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private-store-diagnostics')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([429, 400, 401, 500])('clasifica error remoto %i sin exponer el cuerpo', async status => {
    const { handler } = setup({ model: new Response('private provider detail', { status }) })
    const response = await handler(request(), { ip: 'a' })
    expect(response.status).toBe(status === 429 ? 429 : 502)
    const body = await response.text()
    expect(body).not.toContain('private provider detail'); expect(body).not.toContain(env.GEMINI_API_KEY)
  })
  it('rechaza respuesta mal formada, truncada, bloqueada, extensa o con propiedades inesperadas', async () => {
    for (const model of [Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), new Response('invalid JSON'), new Response('x'.repeat(150001)), modelResponse(draft, 'MAX_TOKENS'), modelResponse({ ...draft, extra: true }), modelResponse({ ...draft, sections: [] }), modelResponse({ ...draft, title: 'x'.repeat(101) })]) {
      const { handler } = setup({ model })
      expect((await handler(request(), { ip: 'a' })).status).toBe(502)
    }
  })
  it('interrumpe la llamada lenta al proveedor sin reintentos', async () => {
    vi.useFakeTimers()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms)
      return controller.signal
    })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ result: 0 })).mockImplementationOnce(async (_url, options) => new Promise((_resolve, reject) => options!.signal!.addEventListener('abort', () => reject(new DOMException('Timeout', 'TimeoutError')), { once: true })))
    const handler = createLyricsHandler({ env, fetcher, now })
    const pending = handler(request(), { ip: 'a' })
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await vi.advanceTimersByTimeAsync(20001)
    expect((await pending).status).toBe(504)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
