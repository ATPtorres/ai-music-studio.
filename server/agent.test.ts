import { describe, expect, it, vi } from 'vitest'
import { createAgentHandler, MAX_ATTEMPTS, RETRY_DELAYS_MS, resolveAgentConfig, MAX_REQUEST_BYTES } from './agent'

const env = { LLM_BASE_URL: 'https://api.groq.com/openai/v1', LLM_MODEL: 'llama-test', LLM_API_KEY: 'server-secret' }
const body = { messages: [{ role: 'user', content: 'hola' }], tools: [{ type: 'function', function: { name: 'x', description: '', parameters: { type: 'object' } } }] }
const request = (payload: unknown = body, method = 'POST') => new Request('http://127.0.0.1:5173/api/agent', {
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(method === 'POST' ? { body: typeof payload === 'string' ? payload : JSON.stringify(payload) } : {}),
})
const success = () => Response.json({ choices: [{ message: { role: 'assistant', content: 'Listo.' } }] })

describe('proxy del agente: configuración y fronteras', () => {
  it('desactiva el agente sin modelo y acepta Ollama local sin clave', () => {
    expect(resolveAgentConfig({}).configured).toBe(false)
    expect(resolveAgentConfig({ LLM_MODEL: 'x' }).configured).toBe(false)
    expect(resolveAgentConfig({ LLM_MODEL: 'x', LLM_BASE_URL: 'http://127.0.0.1:11434/v1' }).configured).toBe(true)
    expect(resolveAgentConfig({ LLM_MODEL: 'x', LLM_BASE_URL: 'http://evil.example/v1', LLM_API_KEY: 'k' }).configured).toBe(false)
  })

  it('informa el estado sin exponer la clave', async () => {
    const handler = createAgentHandler({ env, fetcher: vi.fn<typeof fetch>() })
    const response = await handler(request(undefined, 'GET'))
    expect(response.status).toBe(200)
    const data = await response.json() as Record<string, unknown>
    expect(data).toMatchObject({ configured: true, model: 'llama-test', endpoint: 'api.groq.com' })
    expect(JSON.stringify(data)).not.toContain('server-secret')
  })

  it('reenvía solo los campos permitidos y añade la autenticación en el servidor', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(success())
    const handler = createAgentHandler({ env, fetcher })
    const response = await handler(request({ ...body, model: 'modelo-del-cliente', temperature: 9 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ choices: [{ message: { role: 'assistant', content: 'Listo.' } }] })
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(init!.headers).toMatchObject({ Authorization: 'Bearer server-secret' })
    const payload = JSON.parse(init!.body as string)
    expect(payload.model).toBe('llama-test')
    expect(payload.temperature).toBe(1)
    expect(payload.messages).toEqual(body.messages)
    expect(JSON.stringify(payload)).not.toContain('server-secret')
  })

  it('rechaza métodos, JSON y cuerpos fuera de límite', async () => {
    const handler = createAgentHandler({ env, fetcher: vi.fn<typeof fetch>() })
    expect((await handler(request(undefined, 'PUT'))).status).toBe(405)
    expect((await handler(request('{'))).status).toBe(400)
    expect((await handler(request({ messages: [] }))).status).toBe(400)
    const huge = 'x'.repeat(MAX_REQUEST_BYTES + 1)
    expect((await handler(request(huge))).status).toBe(413)
  })

  it('responde 503 sin configuración y no llama al proveedor', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const handler = createAgentHandler({ env: {}, fetcher })
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
    expect((await response.json() as { message: string }).message).toContain('LLM_MODEL')
  })

  it('traduce cuotas y claves rechazadas sin filtrar el cuerpo del proveedor', async () => {
    const limited = createAgentHandler({ env, fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('detalle privado', { status: 429 })) })
    const limitedResponse = await limited(request())
    expect(limitedResponse.status).toBe(429)
    expect(limitedResponse.headers.get('retry-after')).toBe('60')
    expect(await limitedResponse.text()).not.toContain('detalle privado')
    const denied = createAgentHandler({ env, fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('clave secreta', { status: 401 })) })
    const deniedResponse = await denied(request())
    expect(deniedResponse.status).toBe(502)
    expect(await deniedResponse.text()).not.toContain('clave secreta')
  })

  it('rechaza respuestas sin opciones y los fallos de red', async () => {
    const empty = createAgentHandler({ env, fetcher: vi.fn<typeof fetch>().mockResolvedValue(Response.json({})) })
    expect((await empty(request())).status).toBe(502)
    const offline = createAgentHandler({ env, fetcher: vi.fn<typeof fetch>().mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), sleep: async () => {} })
    expect((await offline(request())).status).toBe(504)
  })

  it('reintenta los 503 transitorios y termina bien sin cambiar de modelo', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('saturado', { status: 503 }))
      .mockResolvedValueOnce(success())
    const sleeps: number[] = []
    const handler = createAgentHandler({ env, fetcher, sleep: async ms => { sleeps.push(ms) } })
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([RETRY_DELAYS_MS[0]])
    const models = fetcher.mock.calls.map(([, init]) => JSON.parse(init!.body as string).model)
    expect(models).toEqual(['llama-test', 'llama-test'])
  })

  it('devuelve 503 claro tras agotar los reintentos', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('detalle privado', { status: 503 }))
    const handler = createAgentHandler({ env, fetcher, sleep: async () => {} })
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('5')
    expect(fetcher).toHaveBeenCalledTimes(MAX_ATTEMPTS)
    const bodyText = await response.text()
    expect(bodyText).toContain('saturado')
    expect(bodyText).not.toContain('detalle privado')
  })

  it('no reintenta errores no transitorios del cliente', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('petición inválida', { status: 400 }))
    const handler = createAgentHandler({ env, fetcher, sleep: async () => {} })
    const response = await handler(request())
    expect(response.status).toBe(502)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(await response.text()).not.toContain('petición inválida')
  })

  it('usa LLM_FALLBACK_MODEL cuando el modelo principal está saturado', async () => {
    const fallbackEnv = { ...env, LLM_FALLBACK_MODEL: 'llama-respaldo' }
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const model = JSON.parse(init!.body as string).model
      return model === 'llama-respaldo' ? success() : new Response('saturado', { status: 503 })
    })
    const handler = createAgentHandler({ env: fallbackEnv, fetcher, sleep: async () => {} })
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(MAX_ATTEMPTS + 1)
    const models = fetcher.mock.calls.map(([, init]) => JSON.parse(init!.body as string).model)
    expect(models).toEqual(['llama-test', 'llama-test', 'llama-test', 'llama-respaldo'])
  })

  it('salta al respaldo sin reintentar si el modelo no existe (404)', async () => {
    const fallbackEnv = { ...env, LLM_FALLBACK_MODEL: 'llama-respaldo' }
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const model = JSON.parse(init!.body as string).model
      return model === 'llama-respaldo' ? success() : new Response('modelo retirado', { status: 404 })
    })
    const handler = createAgentHandler({ env: fallbackEnv, fetcher, sleep: async () => {} })
    const response = await handler(request())
    expect(response.status).toBe(200)
    const models = fetcher.mock.calls.map(([, init]) => JSON.parse(init!.body as string).model)
    expect(models).toEqual(['llama-test', 'llama-respaldo'])
  })
})
