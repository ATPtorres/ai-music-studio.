import { z } from 'zod'

export const creativeSettingsSchema = z.object({ exploration: z.number().int().min(0).max(100), tension: z.number().int().min(0).max(100), movement: z.number().int().min(0).max(100), color: z.enum(['diatonic', 'borrowed', 'secondary', 'mixed']), voiceLeading: z.boolean() }).strict()
export type CreativeSettings = z.infer<typeof creativeSettingsSchema>
export const defaultCreativeSettings: CreativeSettings = { exploration: 35, tension: 40, movement: 50, color: 'diatonic', voiceLeading: true }
export const harmonyKnowledgeSchema = z.object({ libraryVersion: z.literal(1), recipeId: z.string().min(1).max(100), controls: creativeSettingsSchema, seed: z.number().int().min(0).max(0xffffffff), edited: z.boolean(), pinned: z.boolean() }).strict()
export type HarmonyKnowledge = z.infer<typeof harmonyKnowledgeSchema>
export const recipeStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('diatonic'), degree: z.number().int().min(0).max(6) }).strict(),
  z.object({ kind: z.literal('borrowed'), degree: z.number().int().min(0).max(6) }).strict(),
  z.object({ kind: z.literal('secondary'), target: z.number().int().min(1).max(6) }).strict(),
])
const text = z.string().min(1).max(800)
const base = { id: z.string().regex(/^[a-z0-9-]+$/), title: text, explanation: text, practice: text, tags: z.array(z.string().min(1).max(80)).min(1).max(15), sourceId: z.string().min(1).max(100) }
export const recipeSchema = z.object({ ...base, mode: z.enum(['major', 'minor']), steps: z.array(recipeStepSchema).min(2).max(8), genres: z.array(z.string().max(100)).min(1).max(15), emotions: z.array(z.string().max(100)).min(1).max(10), novelty: z.number().int().min(0).max(100), tension: z.number().int().min(0).max(100), movement: z.number().int().min(0).max(100), minComplexity: z.enum(['simple', 'intermediate', 'advanced']) }).strict()
export type HarmonyRecipe = z.infer<typeof recipeSchema>
export const resourceSchema = z.object({ ...base, category: z.enum(['harmony', 'scales', 'melody', 'rhythm', 'form', 'lyrics']), example: text, conditions: z.array(text).min(1).max(8), intervals: z.array(z.number().int().min(0).max(11)).min(1).max(12).optional() }).strict()
export const librarySchema = z.object({ version: z.literal(1), title: text, sources: z.array(z.object({ id: z.string(), name: text, rights: text, references: z.array(z.string().url()).max(10) }).strict()).min(1), recipes: z.array(recipeSchema).min(1).max(1000), resources: z.array(resourceSchema).min(1).max(1000) }).strict().superRefine((library, ctx) => {
  const ids = [...library.recipes, ...library.resources].map(item => item.id)
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Los identificadores de biblioteca deben ser únicos.' })
  const sources = new Set(library.sources.map(source => source.id))
  if (sources.size !== library.sources.length || [...library.recipes, ...library.resources].some(item => !sources.has(item.sourceId))) ctx.addIssue({ code: 'custom', message: 'Procedencia duplicada o inexistente.' })
  for (const resource of library.resources) if (resource.intervals && (resource.intervals[0] !== 0 || resource.intervals.some((pitch, i) => i > 0 && pitch <= resource.intervals![i - 1]))) ctx.addIssue({ code: 'custom', message: `Intervalos no válidos: ${resource.id}` })
  const sequences = library.recipes.map(recipe => JSON.stringify([recipe.mode, recipe.steps]))
  if (new Set(sequences).size !== sequences.length) ctx.addIssue({ code: 'custom', message: 'Hay recetas musicales duplicadas.' })
  for (const recipe of library.recipes) for (const [index, step] of recipe.steps.entries()) {
    const next = recipe.steps[(index + 1) % recipe.steps.length]
    if (step.kind === 'secondary' && (next.kind !== 'diatonic' || next.degree !== step.target)) ctx.addIssue({ code: 'custom', message: `La dominante aplicada no resuelve a su objetivo: ${recipe.id}` })
  }
})
export interface KnowledgeSuggestion { id: string; mode: 'major' | 'minor'; complexity: 'simple' | 'intermediate' | 'advanced'; color: CreativeSettings['color'] }
