/**
 * Proxy local para un proveedor compatible con OpenAI.
 *
 * La clave vive solo en el servidor de Vite (`LLM_API_KEY`). El navegador
 * nunca la recibe: llama a `/api/agent` y este módulo añade la autenticación.
 * Sin `LLM_MODEL` el endpoint queda desactivado y la app sigue funcionando.
 */
export const AGENT_PATH = '/api/agent'
export const MAX_REQUEST_BYTES = 200_000
export const MAX_RESPONSE_BYTES = 1_500_000
export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
export const UPSTREAM_TIMEOUT_MS = 60_000
/** Errores transitorios del proveedor: merece la pena reintentar. */
const RETRY_STATUSES = new Set([500, 502, 503, 504])
export const MAX_ATTEMPTS = 3
export const RETRY_DELAYS_MS = [400, 1200]

type Environment = Record<string, string | undefined>
interface Dependencies {
  env: Environment
  fetcher?: typeof fetch
  /** Inyectable para que las pruebas no esperen de verdad. */
  sleep?: (ms: number) => Promise<void>
}
const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const respond = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } })

const isLocalHost = (hostname: string) => hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1'

export interface AgentConfig {
  configured: boolean
  baseUrl: string
  model: string
  fallbackModel: string
  apiKey: string
  endpoint: string
  problem?: string
}

export function resolveAgentConfig(env: Environment): AgentConfig {
  const baseUrl = (env.LLM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = env.LLM_MODEL?.trim() ?? ''
  const fallbackModel = env.LLM_FALLBACK_MODEL?.trim() ?? ''
  const apiKey = env.LLM_API_KEY?.trim() ?? ''
  const empty = { configured: false, baseUrl, model, fallbackModel, apiKey, endpoint: baseUrl, problem: '' }
  let url: URL
  try { url = new URL(baseUrl) } catch { return { ...empty, problem: 'LLM_BASE_URL no es una URL válida.' } }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ...empty, problem: 'LLM_BASE_URL debe usar https:// (o http:// solo en local).' }
  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) return { ...empty, problem: 'LLM_BASE_URL debe usar https:// salvo en localhost (Ollama).' }
  const endpoint = url.host
  if (!model) return { ...empty, endpoint, problem: 'Falta LLM_MODEL en .env. El agente está desactivado.' }
  if (!apiKey && !isLocalHost(url.hostname)) return { ...empty, endpoint, problem: 'Falta LLM_API_KEY en .env. El agente está desactivado.' }
  return { configured: true, baseUrl, model, fallbackModel, apiKey, endpoint }
}

async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw new Error('body_too_large')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(bytes)
}

const roles = new Set(['system', 'user', 'assistant', 'tool'])
type Message = { role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string }

function cleanMessages(value: unknown): Message[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 60) throw new Error('messages')
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('messages')
    const source = item as Record<string, unknown>
    if (typeof source.role !== 'string' || !roles.has(source.role)) throw new Error('messages')
    if (source.content !== null && source.content !== undefined && typeof source.content !== 'string') throw new Error('messages')
    const message: Message = { role: source.role, content: (source.content as string | null | undefined) ?? null }
    if (Array.isArray(source.tool_calls)) message.tool_calls = source.tool_calls
    if (typeof source.tool_call_id === 'string') message.tool_call_id = source.tool_call_id
    if (typeof source.name === 'string') message.name = source.name
    return message
  })
}

function cleanTools(value: unknown): unknown[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) throw new Error('tools')
  return value
}

export function createAgentHandler({ env, fetcher = fetch, sleep = defaultSleep }: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const config = resolveAgentConfig(env)
    try {
      if (request.method === 'GET') {
        return respond(200, {
          configured: config.configured,
          model: config.configured ? config.model : '',
          endpoint: config.configured ? config.endpoint : '',
          hint: config.problem ?? '',
        })
      }
      if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed', message: 'Usa POST.' }, { Allow: 'GET, POST' })
      if (!config.configured) return respond(503, { error: 'not_configured', message: config.problem ?? 'El agente no está configurado.' })

      const declared = Number(request.headers.get('content-length') ?? 0)
      if (declared > MAX_REQUEST_BYTES) return respond(413, { error: 'body_too_large', message: 'La solicitud supera el límite permitido.' })
      let body: unknown
      try { body = JSON.parse(await readLimited(request.body, MAX_REQUEST_BYTES)) }
      catch (error) {
        if (error instanceof Error && error.message === 'body_too_large') return respond(413, { error: 'body_too_large', message: 'La solicitud supera el límite permitido.' })
        return respond(400, { error: 'invalid_json', message: 'El cuerpo debe ser JSON válido.' })
      }
      if (!body || typeof body !== 'object') return respond(400, { error: 'invalid_body', message: 'Formato de solicitud no válido.' })
      const payload = body as Record<string, unknown>
      let messages: Message[]
      let tools: unknown[] | undefined
      try { messages = cleanMessages(payload.messages); tools = cleanTools(payload.tools) }
      catch { return respond(400, { error: 'invalid_body', message: 'Mensajes o herramientas no válidos.' }) }

      const baseUpstream = {
        messages,
        ...(tools ? { tools } : {}),
        temperature: typeof payload.temperature === 'number' ? Math.min(1, Math.max(0, payload.temperature)) : 0.2,
        max_tokens: 4096,
      }
      const models = [config.model, ...(config.fallbackModel && config.fallbackModel !== config.model ? [config.fallbackModel] : [])]
      let failure: { status: number; error: string; message: string; retryAfter?: string } | null = null

      for (const model of models) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          if (attempt > 1) await sleep(RETRY_DELAYS_MS[Math.min(attempt - 2, RETRY_DELAYS_MS.length - 1)])
          let response: Response
          try {
            response = await fetcher(`${config.baseUrl}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
              body: JSON.stringify({ ...baseUpstream, model }),
              redirect: 'error',
              signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            })
          } catch (error) {
            const timeout = error instanceof Error && error.name === 'TimeoutError'
            failure = timeout
              ? { status: 504, error: 'provider_timeout', message: 'El proveedor tardó demasiado en responder.' }
              : { status: 502, error: 'provider_unreachable', message: 'No se pudo conectar con el proveedor de IA.' }
            continue
          }
          if (!response.ok) {
            await response.body?.cancel().catch(() => {})
            if (response.status === 429) return respond(429, { error: 'rate_limited', message: 'El proveedor alcanzó su límite o cuota. Inténtalo más tarde.' }, { 'Retry-After': '60' })
            if (response.status === 401 || response.status === 403) return respond(502, { error: 'provider_auth', message: 'El proveedor rechazó la clave configurada. Revisa LLM_API_KEY y LLM_MODEL.' })
            if (response.status === 404) {
              failure = { status: 502, error: 'provider_error', message: `El modelo «${model}» no está disponible en este proveedor.` }
              break
            }
            if (RETRY_STATUSES.has(response.status)) {
              failure = { status: 503, error: 'provider_busy', message: 'El proveedor está saturado ahora mismo. Lo he reintentado varias veces; vuelve a probar en unos segundos.', retryAfter: '5' }
              continue
            }
            return respond(502, { error: 'provider_error', message: `El proveedor respondió con estado ${response.status}.` })
          }
          let text: string
          try { text = await readLimited(response.body, MAX_RESPONSE_BYTES) }
          catch { return respond(502, { error: 'provider_too_large', message: 'El proveedor devolvió una respuesta demasiado grande.' }) }
          let data: unknown
          try { data = JSON.parse(text) } catch { return respond(502, { error: 'invalid_provider_response', message: 'El proveedor devolvió una respuesta no válida.' }) }
          const choices = (data as { choices?: unknown } | null)?.choices
          if (!Array.isArray(choices) || choices.length === 0) return respond(502, { error: 'invalid_provider_response', message: 'El proveedor no devolvió ninguna respuesta.' })
          return respond(200, data)
        }
        // Si este modelo se agotó, se prueba el siguiente (LLM_FALLBACK_MODEL) si existe.
      }
      return respond(
        failure?.status ?? 502,
        { error: failure?.error ?? 'provider_error', message: failure?.message ?? 'El proveedor no respondió.' },
        failure?.retryAfter ? { 'Retry-After': failure.retryAfter } : {},
      )
    } catch {
      return respond(500, { error: 'internal_error', message: 'No se pudo completar la solicitud del agente.' })
    }
  }
}
