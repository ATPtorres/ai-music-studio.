import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../models/project'
import { AgentError, runAgent } from './agentLoop'

const toolCall = (name: string, args: unknown, id = 'call-1') => Response.json({
  choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }],
})
const answer = (text: string) => Response.json({ choices: [{ message: { role: 'assistant', content: text } }] })

describe('bucle del agente', () => {
  it('ejecuta una herramienta, actualiza el proyecto y devuelve la respuesta final', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(toolCall('generate_chords', { bars: 4 })).mockResolvedValueOnce(answer('Listo: cuatro acordes.'))
    const updates: unknown[] = []
    const steps: unknown[] = []
    const result = await runAgent({
      project: createProject(), history: [], input: 'Crea una base', fetcher,
      onProject: project => updates.push(project), onStep: step => steps.push(step),
    })
    expect(result.project.tracks[0].kind).toBe('chords')
    expect(result.project.tracks[0].chords).toHaveLength(4)
    expect(result.text).toBe('Listo: cuatro acordes.')
    expect(updates).toHaveLength(1)
    expect(steps).toEqual([{ name: 'generate_chords', label: 'Generando acordes', ok: true }])
    const firstPayload = JSON.parse(fetcher.mock.calls[0][1]!.body as string)
    expect(firstPayload.messages[0].role).toBe('system')
    expect(firstPayload.messages[0].content).toContain('AI Music Studio')
    expect(firstPayload.tools.map((tool: { function: { name: string } }) => tool.function.name)).toContain('generate_chords')
    const secondPayload = JSON.parse(fetcher.mock.calls[1][1]!.body as string)
    expect(secondPayload.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call-1' })
    expect(secondPayload.messages.at(-1).content).toContain('acordes')
  })

  it('devuelve el error de la herramienta al modelo para que pueda corregir', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(toolCall('generate_line', { kind: 'melody' }))
      .mockResolvedValueOnce(answer('Primero necesito acordes.'))
    const steps: { ok: boolean }[] = []
    const result = await runAgent({ project: createProject(), history: [], input: 'Haz una melodía', fetcher, onStep: step => steps.push(step) })
    expect(steps[0].ok).toBe(false)
    const payload = JSON.parse(fetcher.mock.calls[1][1]!.body as string)
    expect(JSON.parse(payload.messages.at(-1).content)).toMatchObject({ error: expect.stringMatching(/acordes/i) })
    expect(result.project.tracks).toHaveLength(0)
  })

  it('incluye historial reciente y limita el número de rondas', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => toolCall('get_project_summary', {}))
    const result = await runAgent({ project: createProject(), history: [{ role: 'user', content: 'antes' }, { role: 'assistant', content: 'vale' }], input: 'sigue', fetcher, maxRounds: 2 })
    expect(result.text).toContain('límite')
    const payload = JSON.parse(fetcher.mock.calls[0][1]!.body as string)
    expect(payload.messages.slice(1, 3)).toEqual([{ role: 'user', content: 'antes' }, { role: 'assistant', content: 'vale' }])
  })

  it('traduce errores del proxy sin modificar el proyecto', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: 'not_configured', message: 'Falta LLM_MODEL en .env.' }, { status: 503 }))
    const failure = runAgent({ project: createProject(), history: [], input: 'hola', fetcher })
    await expect(failure).rejects.toBeInstanceOf(AgentError)
    await expect(failure).rejects.toMatchObject({ code: 'not_configured', message: 'Falta LLM_MODEL en .env.' })
    await expect(runAgent({ project: createProject(), history: [], input: '   ', fetcher })).rejects.toBeInstanceOf(AgentError)
  })

  it('aborta sin convertir la cancelación en error de red', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); throw new DOMException('abortado', 'AbortError') })
    await expect(runAgent({ project: createProject(), history: [], input: 'hola', fetcher, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
