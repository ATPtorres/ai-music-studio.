import { z } from 'zod'

export const structureFamilies = ['verse-chorus', 'songbook', 'strophic', 'ternary', 'rondo', 'electronic', 'through', 'response'] as const
export const structureFamilyNames = { 'verse-chorus': 'Verso y coro', songbook: 'Canción AABA / ABAC', strophic: 'Estrófica', ternary: 'Ternaria', rondo: 'Rondó', electronic: 'Electrónica', through: 'Desarrollo continuo', response: 'Llamada y respuesta' }
export const structureOptionsSchema = z.object({ family: z.enum(['auto', ...structureFamilies]), recipeId: z.string().min(1).max(100), phraseBars: z.union([z.literal(4), z.literal(8), z.literal(16)]), exploration: z.number().int().min(0).max(100) }).strict()
export type StructureOptions = z.infer<typeof structureOptionsSchema>
export const defaultStructureOptions: StructureOptions = { family: 'auto', recipeId: 'auto', phraseBars: 8, exploration: 50 }
export const structureGenerationSchema = z.object({ libraryVersion: z.literal(1), recipeId: z.string().min(1).max(100), seed: z.number().int().min(0).max(0xffffffff), options: structureOptionsSchema, actualPhraseBars: z.number().int().min(2).max(16), fingerprint: z.string().max(100) }).strict()
export type StructureGeneration = z.infer<typeof structureGenerationSchema>
const stepSchema = z.object({ label: z.string().min(1).max(70), group: z.string().regex(/^[A-Z]$/), role: z.enum(['intro', 'verse', 'prechorus', 'chorus', 'postchorus', 'bridge', 'break', 'build', 'drop', 'theme', 'episode', 'solo', 'response', 'development', 'outro', 'coda']), units: z.union([z.literal(0.5), z.literal(1), z.literal(1.5), z.literal(2)]), energy: z.number().int().min(0).max(3) }).strict()
export const structureRecipeSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1).max(100), family: z.enum(structureFamilies), explanation: z.string().min(1).max(800), practice: z.string().min(1).max(800), genres: z.array(z.string().min(1).max(50)).min(1), moods: z.array(z.string().min(1).max(50)).min(1), novelty: z.number().int().min(0).max(100), sourceId: z.string(), steps: z.array(stepSchema).min(3).max(16) }).strict()
export type StructureRecipe = z.infer<typeof structureRecipeSchema>
export const structureLibrarySchema = z.object({ version: z.literal(1), sources: z.array(z.object({ id: z.string(), name: z.string(), rights: z.string(), references: z.array(z.string().url()) }).strict()).min(1), recipes: z.array(structureRecipeSchema).min(1).max(1000) }).strict().superRefine((library, ctx) => {
  const ids = library.recipes.map(r => r.id), sources = new Set(library.sources.map(s => s.id))
  if (new Set(ids).size !== ids.length || sources.size !== library.sources.length) ctx.addIssue({ code: 'custom', message: 'Identificadores de estructura duplicados.' })
  const sequences = library.recipes.map(r => JSON.stringify(r.steps.map(s => [s.role, s.group, s.units, s.energy])))
  if (new Set(sequences).size !== sequences.length) ctx.addIssue({ code: 'custom', message: 'Recetas estructurales duplicadas.' })
  for (const recipe of library.recipes) {
    if (!sources.has(recipe.sourceId)) ctx.addIssue({ code: 'custom', message: `Procedencia inexistente: ${recipe.id}` })
    const lengths = new Map<string, number>()
    for (const [index, step] of recipe.steps.entries()) {
      if (lengths.has(step.group) && lengths.get(step.group) !== step.units) ctx.addIssue({ code: 'custom', message: `Las reapariciones del grupo deben conservar su fraseo: ${recipe.id}` })
      lengths.set(step.group, step.units)
      const next = recipe.steps[index + 1]
      if ((step.role === 'intro' && index !== 0) || (step.role === 'outro' && index !== recipe.steps.length - 1) || (step.role === 'build' && next?.role !== 'drop') || (step.role === 'prechorus' && next?.role !== 'chorus')) ctx.addIssue({ code: 'custom', message: `Transición estructural incoherente: ${recipe.id}` })
    }
  }
})
