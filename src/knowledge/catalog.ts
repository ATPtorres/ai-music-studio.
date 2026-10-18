import rawLibrary from './data/library.v1.json'
import { librarySchema, type CreativeSettings, type HarmonyRecipe, type KnowledgeSuggestion } from './schema'
import { randomFromSeed } from '../music/random'

export const library = librarySchema.parse(rawLibrary)
export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export interface RecipeRequest { mode: 'major' | 'minor'; genre: string; mood: string; complexity: 'simple' | 'intermediate' | 'advanced'; controls: CreativeSettings }
const rank = { simple: 0, intermediate: 1, advanced: 2 }
function genreFamily(text: string) {
  const genre = normalize(text)
  return /jazz/.test(genre) ? 'jazz' : /r&b|funk/.test(genre) ? 'rnb' : /rock/.test(genre) ? 'rock' : /trap|hip-hop|reggaeton/.test(genre) ? 'urban' : /latin/.test(genre) ? 'latin' : /electron/.test(genre) ? 'electronic' : 'pop'
}
export function eligibleRecipes(request: RecipeRequest): HarmonyRecipe[] {
  return library.recipes.filter(recipe => recipe.mode === request.mode && rank[recipe.minComplexity] <= rank[request.complexity] && recipe.steps.every(step => step.kind === 'diatonic' || request.controls.color === 'mixed' || (request.controls.color === 'borrowed' && step.kind === 'borrowed') || (request.controls.color === 'secondary' && step.kind === 'secondary')))
}
export function rankRecipes(request: RecipeRequest) {
  const family = genreFamily(request.genre)
  const mood = normalize(request.mood)
  return eligibleRecipes(request).map(recipe => ({ recipe, score: (recipe.genres.includes(family) ? 20 : 0) + (recipe.emotions.some(emotion => mood.includes(emotion)) ? 12 : 0) - Math.abs(recipe.novelty - request.controls.exploration) * 0.4 - Math.abs(recipe.tension - request.controls.tension) * 0.3 - Math.abs(recipe.movement - request.controls.movement) * 0.3 })).sort((a, b) => b.score - a.score || a.recipe.id.localeCompare(b.recipe.id))
}
export function chooseRecipe(request: RecipeRequest, seed: number, recipeId?: string, avoidRecipeId?: string): HarmonyRecipe {
  const ranked = rankRecipes(request)
  if (!ranked.length) throw new Error('No hay recetas compatibles con estos ajustes.')
  if (recipeId) {
    const pinned = ranked.find(item => item.recipe.id === recipeId)
    if (!pinned) throw new Error('La receta no es compatible con el modo, color o complejidad elegidos.')
    return pinned.recipe
  }
  const choices = ranked.length > 1 ? ranked.filter(item => item.recipe.id !== avoidRecipeId) : ranked
  const best = choices[0].score
  const weights = choices.map(item => Math.exp((item.score - best) / 9))
  let draw = randomFromSeed(seed)() * weights.reduce((sum, value) => sum + value, 0)
  for (const [index, item] of choices.entries()) { draw -= weights[index]; if (draw <= 0) return item.recipe }
  return choices.at(-1)!.recipe
}
export function recipeSuggestion(recipe: HarmonyRecipe): KnowledgeSuggestion {
  const borrowed = recipe.steps.some(step => step.kind === 'borrowed')
  const secondary = recipe.steps.some(step => step.kind === 'secondary')
  return { id: recipe.id, mode: recipe.mode, complexity: recipe.minComplexity, color: borrowed && secondary ? 'mixed' : borrowed ? 'borrowed' : secondary ? 'secondary' : 'diatonic' }
}
export function searchKnowledge(query: string, category: string) {
  const words = normalize(query.slice(0, 300)).split(/\s+/).filter(Boolean)
  const matches = (item: { title: string; explanation: string; tags: string[] }) => words.every(word => normalize([item.title, item.explanation, ...item.tags].join(' ')).includes(word))
  return {
    recipes: category === 'all' || category === 'harmony' ? library.recipes.filter(matches) : [],
    resources: library.resources.filter(item => (category === 'all' || item.category === category) && matches(item)),
  }
}
/** A bounded data context for a future provider; no model call or prompt execution. */
export function buildKnowledgeContext(request: RecipeRequest, query = '', maxChars = 4000) {
  if (!Number.isInteger(maxChars) || maxChars < 512 || maxChars > 10000) throw new Error('El presupuesto de contexto debe estar entre 512 y 10000 caracteres.')
  const matched = searchKnowledge(query, 'all').resources
  const candidates = [...rankRecipes(request).slice(0, 3).map(item => item.recipe), ...matched]
  const context = { libraryVersion: library.version, resources: [] as { id: string; title: string; explanation: string; practice: string; sourceId: string }[] }
  for (const item of candidates) {
    const entry = { id: item.id, title: item.title, explanation: item.explanation, practice: item.practice, sourceId: item.sourceId }
    const next = { ...context, resources: [...context.resources, entry] }
    if (JSON.stringify(next).length <= maxChars) context.resources.push(entry)
    if (context.resources.length === 6) break
  }
  return context
}
