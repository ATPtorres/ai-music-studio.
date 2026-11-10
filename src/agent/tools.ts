import { z } from 'zod'
import { keys, projectSchema, type MusicProject } from '../models/project'
import { generateProgressionResult, withChordTrack } from '../music/harmony'
import { generateLine, withLineTrack } from '../music/lines'
import { drumGenres, generateDrumPattern, withDrumTrack } from '../music/drums'
import { generateStructure } from '../arrangement/structure'
import { defaultCreativeSettings } from '../knowledge/schema'
import { structureFamilies } from '../knowledge/structureSchema'

export const lineKinds = ['melody', 'bass'] as const
export const trackKinds = ['chords', 'melody', 'bass', 'drums'] as const
const densities = ['sparse', 'medium', 'dense'] as const
const rhythms = ['sustained', 'straight', 'syncopated', 'walking'] as const
const complexities = ['simple', 'intermediate', 'advanced'] as const
const signatureSchema = z.tuple([z.number().int().min(1).max(12), z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)])])

const configureArgs = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  key: z.enum(keys).optional(),
  mode: z.enum(['major', 'minor']).optional(),
  bpm: z.number().int().min(30).max(300).optional(),
  timeSignature: signatureSchema.optional(),
  genre: z.string().trim().min(1).max(100).optional(),
  mood: z.string().trim().min(1).max(100).optional(),
  theme: z.string().max(5000).optional(),
  complexity: z.enum(complexities).optional(),
}).strict()

const chordsArgs = z.object({
  bars: z.number().int().min(2).max(16).default(4),
  chordType: z.enum(['triad', 'seventh', 'extended']).default('seventh'),
  complexity: z.enum(complexities).optional(),
  genre: z.string().trim().min(1).max(100).optional(),
  mood: z.string().trim().min(1).max(100).optional(),
  useLibrary: z.boolean().default(false),
  seed: z.number().int().min(0).max(0xffffffff).optional(),
}).strict()

const lineArgs = z.object({
  kind: z.enum(lineKinds),
  low: z.number().int().min(0).max(127).optional(),
  high: z.number().int().min(0).max(127).optional(),
  density: z.enum(densities).default('medium'),
  rhythm: z.enum(rhythms).default('straight'),
  complexity: z.enum(complexities).default('simple'),
  seed: z.number().int().min(0).max(0xffffffff).optional(),
}).strict()

const drumsArgs = z.object({
  genre: z.enum(drumGenres).optional(),
  bars: z.number().int().min(1).max(8).default(2),
  swing: z.number().min(0).max(0.6).default(0),
  seed: z.number().int().min(0).max(0xffffffff).optional(),
}).strict()

const structureArgs = z.object({
  family: z.enum(['auto', ...structureFamilies]).default('auto'),
  phraseBars: z.union([z.literal(4), z.literal(8), z.literal(16)]).default(8),
  exploration: z.number().int().min(0).max(100).default(50),
  seed: z.number().int().min(0).max(0xffffffff).optional(),
}).strict()

const clearArgs = z.object({ kind: z.enum(trackKinds) }).strict()

export type AgentToolName = 'get_project_summary' | 'configure_project' | 'generate_chords' | 'generate_line' | 'generate_drums' | 'generate_structure' | 'clear_track'

interface ToolContext { project: MusicProject }
export interface ToolOutcome { project: MusicProject; text: string }

const withParameters = (project: MusicProject, change: Partial<MusicProject['parameters']>): MusicProject =>
  projectSchema.parse({ ...project, parameters: { ...project.parameters, ...change } })

const summarize = (project: MusicProject) => ({
  name: project.name,
  parameters: { ...project.parameters, theme: project.parameters.theme.slice(0, 500) },
  tracks: project.tracks.map(track => ({
    id: track.id,
    name: track.name,
    kind: track.kind,
    channel: track.channel,
    notes: track.notes.length,
    chords: track.chords.slice(0, 24).map(chord => chord.symbol),
    ...(track.drumPattern ? { pattern: { genre: track.drumPattern.genre, bars: track.drumPattern.bars, swing: track.drumPattern.swing } } : {}),
    ...(track.generation ? { generation: track.generation } : {}),
    ...(track.variants?.length ? { variants: track.variants.map(variant => variant.name) } : {}),
  })),
  sections: project.sections.map(section => ({ id: section.id, name: section.name, bars: section.bars, tracks: section.trackIds.length, lyrics: section.lyrics.length })),
})

function generateChords(context: ToolContext, args: z.infer<typeof chordsArgs>): ToolOutcome {
  const { project } = context
  const { key, mode, timeSignature } = project.parameters
  const complexity = args.complexity ?? project.parameters.complexity
  const genre = args.genre ?? project.parameters.genre
  const mood = args.mood ?? project.parameters.mood
  const seed = args.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]
  const result = generateProgressionResult({
    key, mode, bars: args.bars, signature: timeSignature, genre, mood, complexity,
    chordType: args.chordType, seed,
    ...(args.useLibrary ? { knowledge: { controls: defaultCreativeSettings } } : {}),
  })
  const tracks = withChordTrack(project, result.chords, `Acordes · ${key} ${mode === 'minor' ? 'menor' : 'mayor'}`, result.knowledge)
  const next = withParameters({ ...project, tracks }, { genre, mood, complexity })
  return {
    project: projectSchema.parse(next),
    text: `Generé ${result.chords.length} acordes en ${key} ${mode === 'minor' ? 'menor' : 'mayor'} (${result.chords.map(chord => chord.symbol).join(' → ')}).`,
  }
}

function generateLineTool(context: ToolContext, args: z.infer<typeof lineArgs>): ToolOutcome {
  const { project } = context
  if (!project.tracks.some(track => track.kind === 'chords' && track.chords.length)) throw new Error('Todavía no hay acordes. Genera una progresión antes de crear la línea.')
  const low = args.low ?? (args.kind === 'bass' ? 36 : 60)
  const high = args.high ?? (args.kind === 'bass' ? 55 : 84)
  const settings = { low, high, density: args.density, rhythm: args.rhythm, complexity: args.complexity, seed: args.seed ?? crypto.getRandomValues(new Uint32Array(1))[0] }
  const notes = generateLine(project, args.kind, settings)
  const next = { ...project, tracks: withLineTrack(project, args.kind, notes, { low, high, density: args.density, rhythm: args.rhythm, complexity: args.complexity }) }
  return {
    project: projectSchema.parse(next),
    text: `Generé ${notes.length} notas de ${args.kind === 'bass' ? 'bajo' : 'melodía'} en el registro ${low}–${high}.`,
  }
}

function generateDrumsTool(context: ToolContext, args: z.infer<typeof drumsArgs>): ToolOutcome {
  const { project } = context
  const requested = args.genre ?? (drumGenres as readonly string[]).find(genre => genre === project.parameters.genre)
  const genre = (requested ?? 'Pop') as typeof drumGenres[number]
  const pattern = generateDrumPattern(genre, args.bars, project.parameters.timeSignature, args.swing, args.seed ?? crypto.getRandomValues(new Uint32Array(1))[0])
  const next = { ...project, tracks: withDrumTrack(project, pattern) }
  return {
    project: projectSchema.parse(next),
    text: `Generé un patrón de batería ${genre} de ${args.bars} compases con swing ${Math.round(args.swing * 100)}%.`,
  }
}

function generateStructureTool(context: ToolContext, args: z.infer<typeof structureArgs>): ToolOutcome {
  const { project } = context
  const result = generateStructure(project, { family: args.family, recipeId: 'auto', phraseBars: args.phraseBars, exploration: args.exploration }, args.seed ?? crypto.getRandomValues(new Uint32Array(1))[0])
  const next = { ...project, sections: result.sections, structureGeneration: result.structureGeneration }
  return {
    project: projectSchema.parse(next),
    text: `Estructura «${result.recipe.title}» lista: ${result.sections.map(section => `${section.name} (${section.bars} compases)`).join(', ')}.${result.warnings.length ? ` Avisos: ${result.warnings.join(' ')}` : ''}`,
  }
}

function clearTrack(context: ToolContext, args: z.infer<typeof clearArgs>): ToolOutcome {
  const { project } = context
  const removed = new Set(project.tracks.filter(track => track.kind === args.kind).map(track => track.id))
  if (!removed.size) return { project, text: `No había ninguna pista de ${args.kind} que eliminar.` }
  const sections = project.sections.map(section => ({
    ...section,
    trackIds: section.trackIds.filter(id => !removed.has(id)),
    variantIds: Object.fromEntries(Object.entries(section.variantIds ?? {}).filter(([id]) => !removed.has(id))),
  }))
  return { project: projectSchema.parse({ ...project, tracks: project.tracks.filter(track => !removed.has(track.id)), sections }), text: `Eliminé la pista de ${args.kind} y sus vínculos en las secciones.` }
}

interface AgentTool {
  name: AgentToolName
  description: string
  schema: z.ZodType
  execute: (context: ToolContext, args: never) => ToolOutcome
}

export const agentTools: AgentTool[] = [
  {
    name: 'get_project_summary',
    description: 'Consulta el estado actual del proyecto: parámetros, pistas, acordes, patrones y secciones. Úsala antes de decidir cambios.',
    schema: z.object({}).strict(),
    execute: context => ({ project: context.project, text: JSON.stringify(summarize(context.project)) }),
  },
  {
    name: 'configure_project',
    description: 'Cambia nombre, tonalidad, modo, BPM, compás, género, emoción, tema o complejidad del proyecto. No regenera pistas existentes.',
    schema: configureArgs,
    execute: (context, args: z.infer<typeof configureArgs>) => {
      const { project } = context
      const change: Partial<MusicProject['parameters']> = {}
      if (args.key !== undefined) change.key = args.key
      if (args.mode !== undefined) change.mode = args.mode
      if (args.bpm !== undefined) change.bpm = args.bpm
      if (args.timeSignature !== undefined) change.timeSignature = args.timeSignature
      if (args.genre !== undefined) change.genre = args.genre
      if (args.mood !== undefined) change.mood = args.mood
      if (args.theme !== undefined) change.theme = args.theme
      if (args.complexity !== undefined) change.complexity = args.complexity
      const next = projectSchema.parse({ ...withParameters(project, change), ...(args.name !== undefined ? { name: args.name } : {}) })
      const harmonyChanged = ['key', 'mode', 'timeSignature'].some(key => key in change)
      const stale = harmonyChanged && project.tracks.some(track => track.notes.length || track.chords.length)
      return { project: next, text: `Parámetros actualizados.${stale ? ' Hay pistas con notas de la armonía anterior: regenera acordes, melodía, bajo o batería si quieres que la sigan.' : ''}` }
    },
  },
  {
    name: 'generate_chords',
    description: 'Genera una progresión de acordes y la guarda en el proyecto. Requiere 2–16 compases. Usa la tonalidad, modo y compás actuales.',
    schema: chordsArgs,
    execute: generateChords,
  },
  {
    name: 'generate_line',
    description: 'Genera una melodía o un bajo monofónico sobre los acordes existentes. Si no hay acordes, falla: genera acordes primero.',
    schema: lineArgs,
    execute: generateLineTool,
  },
  {
    name: 'generate_drums',
    description: 'Genera un patrón de batería de 1–8 compases con swing opcional, usando el compás global del proyecto.',
    schema: drumsArgs,
    execute: generateDrumsTool,
  },
  {
    name: 'generate_structure',
    description: 'Crea la estructura por secciones (verso, coro, puente…) y la vincula a las pistas existentes. Mejor después de tener pistas con notas.',
    schema: structureArgs,
    execute: generateStructureTool,
  },
  {
    name: 'clear_track',
    description: 'Elimina la pista de un instrumento y sus vínculos en las secciones.',
    schema: clearArgs,
    execute: clearTrack,
  },
]

export function toolSchemas() {
  return agentTools.map(tool => {
    const parameters = z.toJSONSchema(tool.schema, { io: 'input' }) as Record<string, unknown>
    delete parameters.$schema
    return { type: 'function' as const, function: { name: tool.name, description: tool.description, parameters } }
  })
}

export function executeTool(name: string, rawArguments: string, project: MusicProject): ToolOutcome {
  const tool = agentTools.find(item => item.name === name)
  if (!tool) throw new Error(`Herramienta desconocida: ${name}`)
  let raw: unknown
  try { raw = rawArguments.trim() ? JSON.parse(rawArguments) : {} }
  catch { throw new Error('Los argumentos de la herramienta no son JSON válido.') }
  const parsed = tool.schema.safeParse(raw)
  if (!parsed.success) throw new Error(`Argumentos no válidos: ${parsed.error.issues.map(issue => `${issue.path.join('.') || 'valor'}: ${issue.message}`).join('; ')}`)
  return tool.execute({ project }, parsed.data as never)
}

export { summarize as summarizeProject }
