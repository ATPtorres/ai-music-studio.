import type { MusicProject } from '../models/project'
import { executeTool, summarizeProject, toolSchemas } from './tools'

export interface AgentToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AgentToolCall[]
  tool_call_id?: string
}

export interface AgentStep {
  name: string
  label: string
  ok: boolean
}

export interface AgentRunResult {
  project: MusicProject
  text: string
  steps: AgentStep[]
}

export class AgentError extends Error {
  constructor(message: string, public code = 'agent_error') { super(message) }
}

interface RunOptions {
  project: MusicProject
  history: { role: 'user' | 'assistant'; content: string }[]
  input: string
  signal?: AbortSignal
  onProject?: (project: MusicProject) => void
  onStep?: (step: AgentStep) => void
  fetcher?: typeof fetch
  maxRounds?: number
}

const toolLabels: Record<string, string> = {
  get_project_summary: 'Leyendo el proyecto',
  configure_project: 'Ajustando parámetros',
  generate_chords: 'Generando acordes',
  generate_line: 'Generando línea',
  generate_drums: 'Generando batería',
  generate_structure: 'Generando estructura',
  clear_track: 'Eliminando pista',
}

function systemPrompt(project: MusicProject) {
  const summary = JSON.stringify(summarizeProject(project))
  return [
    'Eres el agente de composición de AI Music Studio. Trabajas dentro de una app local y modificas el proyecto del usuario con herramientas.',
    'Reglas:',
    '- Responde siempre en español, breve y concreto.',
    '- Usa las herramientas para cambiar el proyecto; nunca inventes que ya lo hiciste.',
    '- Antes de generar melodía o bajo debe existir una pista de acordes. Si no existe, genera acordes primero.',
    '- No pidas confirmación: aplica los cambios. El usuario puede deshacer la última acción desde la interfaz.',
    '- Si una herramienta falla, corrige los argumentos y vuelve a intentarlo una vez; si sigue fallando, explica el motivo.',
    '- Cuando termines, resume en 2–4 frases qué cambiaste y qué puede hacer el usuario ahora.',
    '- No puedes acceder a archivos, red, claves ni al sistema: solo a estas herramientas musicales.',
    '',
    'Estado actual del proyecto (JSON):',
    summary,
  ].join('\n')
}

function parseArguments(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') return JSON.stringify(raw)
  return '{}'
}

export async function runAgent({ project, history, input, signal, onProject, onStep, fetcher = fetch, maxRounds = 8 }: RunOptions): Promise<AgentRunResult> {
  if (!input.trim()) throw new AgentError('Escribe qué quieres crear o cambiar.')
  let current = project
  const steps: AgentStep[] = []
  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt(project) },
    ...history.slice(-8).map(message => ({ role: message.role, content: message.content }) as AgentMessage),
    { role: 'user', content: input.trim() },
  ]
  const tools = toolSchemas()
  let executed = 0

  for (let round = 0; round < maxRounds; round++) {
    let response: Response
    try {
      response = await fetcher('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, tools, temperature: 0.2 }),
        signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new AgentError('No se pudo conectar con el proxy del agente. Comprueba que `npm run dev` esté activo.', 'network_error')
    }
    if (!response.ok) {
      const info = await response.json().catch(() => null) as { message?: string; error?: string } | null
      throw new AgentError(info?.message ?? `El agente respondió con estado ${response.status}.`, info?.error ?? 'http_error')
    }
    const data = await response.json() as { choices?: { message?: { content?: unknown; tool_calls?: unknown } }[] }
    const message = data.choices?.[0]?.message
    if (!message) throw new AgentError('El proveedor devolvió una respuesta vacía.', 'empty_response')

    const calls = Array.isArray(message.tool_calls) ? message.tool_calls as AgentToolCall[] : []
    if (calls.length) {
      messages.push({ role: 'assistant', content: typeof message.content === 'string' ? message.content : null, tool_calls: calls })
      for (const call of calls) {
        executed++
        const name = call.function?.name ?? 'desconocida'
        const label = toolLabels[name] ?? name
        try {
          if (executed > 12) throw new Error('Demasiadas herramientas en una sola petición.')
          const outcome = executeTool(name, parseArguments(call.function?.arguments), current)
          current = outcome.project
          onProject?.(current)
          const step = { name, label, ok: true }
          steps.push(step); onStep?.(step)
          messages.push({ role: 'tool', tool_call_id: call.id, content: outcome.text.slice(0, 4000) })
        } catch (error) {
          const text = error instanceof Error ? error.message : 'La herramienta falló.'
          const step = { name, label: `${label}: ${text}`, ok: false }
          steps.push(step); onStep?.(step)
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: text }) })
        }
      }
      continue
    }

    const text = typeof message.content === 'string' ? message.content.trim() : ''
    return { project: current, text: text || 'Listo. El proyecto está actualizado.', steps }
  }

  return { project: current, text: 'Alcancé el límite de pasos. Revisa el resultado y pídeme el siguiente cambio.', steps }
}
