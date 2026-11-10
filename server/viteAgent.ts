import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { loadEnv } from 'vite'
import { AGENT_PATH, MAX_REQUEST_BYTES, createAgentHandler } from './agent'

type Handler = ReturnType<typeof createAgentHandler>

async function readBody(request: IncomingMessage): Promise<Uint8Array | null> {
  if (request.method !== 'POST') return null
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_REQUEST_BYTES) throw new Error('body_too_large')
    chunks.push(buffer)
  }
  return chunks.length ? Buffer.concat(chunks) : new Uint8Array()
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function middleware(getHandler: () => Handler | null): Connect.NextHandleFunction {
  return async (request, response, next) => {
    const handler = getHandler()
    if (!handler) return next()
    try {
      const body = await readBody(request)
      const origin = `http://${request.headers.host ?? '127.0.0.1'}`
      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      }
      const webRequest = new Request(`${origin}${AGENT_PATH}`, {
        method: request.method,
        headers,
        ...(body && body.length ? { body: new Blob([Uint8Array.from(body)]) } : {}),
      })
      const webResponse = await handler(webRequest)
      response.statusCode = webResponse.status
      webResponse.headers.forEach((value, key) => response.setHeader(key, value))
      response.end(Buffer.from(await webResponse.arrayBuffer()))
    } catch (error) {
      if (error instanceof Error && error.message === 'body_too_large') {
        send(response, 413, { error: 'body_too_large', message: 'La solicitud supera el límite permitido.' })
        return
      }
      send(response, 500, { error: 'internal_error', message: 'El proxy del agente falló.' })
    }
  }
}

/** Añade `/api/agent` a `vite` y `vite preview` sin exponer claves al navegador. */
export function agentPlugin(): Plugin {
  let handler: Handler | null = null
  const create = (mode: string, envDir: string | false) => {
    handler = createAgentHandler({ env: loadEnv(mode, typeof envDir === 'string' ? envDir : process.cwd(), '') })
  }
  return {
    name: 'ai-music-studio-agent',
    configureServer(server) {
      create(server.config.mode, server.config.envDir)
      server.middlewares.use(AGENT_PATH, middleware(() => handler))
    },
    configurePreviewServer(server) {
      create(server.config.mode, server.config.envDir)
      server.middlewares.use(AGENT_PATH, middleware(() => handler))
    },
  }
}
