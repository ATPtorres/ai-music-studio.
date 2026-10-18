import { createLocalLyrics } from './localLyrics'
import { lyricsRequestSchema, lyricsResponseSchema, type DraftResult, type LyricsRequest } from './lyricsContract'

export interface LyricsProvider { generate(input: LyricsRequest, signal?: AbortSignal): Promise<DraftResult> }
export const localLyricsProvider: LyricsProvider = { generate: async input => createLocalLyrics(input) }
const failureMessages: Record<number, string> = {
  400: 'Revisa el tema y las instrucciones.',
  403: 'La asistencia no está permitida desde este sitio.',
  429: 'Se alcanzó el límite de solicitudes o la cuota de IA. Inténtalo más tarde.',
  503: 'La asistencia de IA no está disponible o aún no está configurada.',
  504: 'La asistencia de IA tardó demasiado en responder.',
}
export function createGeminiLyricsProvider(fetcher: typeof fetch = fetch): LyricsProvider {
  return { async generate(input, signal) {
    const request = lyricsRequestSchema.parse(input)
    // No automatic retries: every attempt can consume provider quota.
    try {
      const response = await fetcher('/.netlify/functions/lyrics', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lyrics-Request': '1' },
        body: JSON.stringify(request), signal: AbortSignal.any([AbortSignal.timeout(28000), ...(signal ? [signal] : [])]),
        credentials: 'same-origin', redirect: 'error',
      })
      if (!response.ok) throw new Error(failureMessages[response.status] ?? 'La IA no pudo crear un borrador válido.')
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Respuesta de IA vacía.')
      let bytes = 0
      const chunks: Uint8Array[] = []
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.length
          if (bytes > 100000) throw new Error('La respuesta de IA supera el límite permitido.')
          chunks.push(value)
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
      const buffer = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }
      const parsed = lyricsResponseSchema.safeParse(JSON.parse(new TextDecoder().decode(buffer)))
      if (!parsed.success) throw new Error('La IA devolvió un borrador incompatible.')
      return parsed.data
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
      const message = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'La asistencia de IA tardó demasiado en responder.'
        : error instanceof SyntaxError ? 'La IA devolvió una respuesta incompatible.'
        : error instanceof TypeError ? 'No se pudo conectar con la asistencia de IA.'
        : error instanceof Error ? error.message : 'No se pudo crear el borrador de IA.'
      return { ...createLocalLyrics(request), warning: `${message} Se preparó una guía local; tu letra guardada no cambió.` }
    }
  } }
}
