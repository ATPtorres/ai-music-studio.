import { describe, expect, it } from 'vitest'
import { buildKnowledgeContext, chooseRecipe, eligibleRecipes, library, rankRecipes, recipeSuggestion, searchKnowledge, type RecipeRequest } from './catalog'
import { defaultCreativeSettings, librarySchema } from './schema'

const request: RecipeRequest = { mode: 'major', genre: 'Pop', mood: 'Alegre', complexity: 'advanced', controls: { ...defaultCreativeSettings, color: 'mixed' } }
describe('Biblioteca versionada y selector', () => {
  it('valida 68 entradas originales, 12 escalas y referencias trazables', () => {
    expect(library.recipes).toHaveLength(36)
    expect(library.resources).toHaveLength(32)
    expect(library.resources.filter(r => r.category === 'scales')).toHaveLength(12)
    expect(librarySchema.parse(library)).toEqual(library)
    expect([...library.recipes, ...library.resources].every(item => library.sources.some(s => s.id === item.sourceId))).toBe(true)
  })
  it('rechaza duplicados, procedencias falsas, intervalos y resoluciones incorrectas', () => {
    const duplicate = structuredClone(library); duplicate.resources.push(duplicate.resources[0])
    expect(librarySchema.safeParse(duplicate).success).toBe(false)
    const source = structuredClone(library); source.resources[0].sourceId = 'missing'
    expect(librarySchema.safeParse(source).success).toBe(false)
    const scale = structuredClone(library); scale.resources.find(r => r.intervals)!.intervals = [0, 7, 2]
    expect(librarySchema.safeParse(scale).success).toBe(false)
    const resolution = structuredClone(library); resolution.recipes.find(r => r.id === 'major-applied-five')!.steps[3] = { kind: 'diatonic', degree: 0 }
    expect(librarySchema.safeParse(resolution).success).toBe(false)
    const repeated = structuredClone(library); repeated.recipes[1].steps = repeated.recipes[0].steps
    expect(librarySchema.safeParse(repeated).success).toBe(false)
  })
  it('filtra modo, color y complejidad y puede preparar todas las recetas', () => {
    const simple = eligibleRecipes({ ...request, complexity: 'simple', controls: defaultCreativeSettings })
    expect(simple.length).toBeGreaterThan(2)
    expect(simple.every(r => r.mode === 'major' && r.minComplexity === 'simple' && r.steps.every(s => s.kind === 'diatonic'))).toBe(true)
    for (const recipe of library.recipes) {
      const suggestion = recipeSuggestion(recipe)
      expect(eligibleRecipes({ ...request, ...suggestion, controls: { ...defaultCreativeSettings, color: suggestion.color } }).map(r => r.id)).toContain(recipe.id)
    }
    expect(() => chooseRecipe({ ...request, controls: defaultCreativeSettings }, 42, 'major-minor-four')).toThrow(/compatible/)
  })
  it('es reproducible, evita la última receta y ofrece variedad con distintas semillas', () => {
    expect(chooseRecipe(request, 123).id).toBe(chooseRecipe(request, 123).id)
    const last = chooseRecipe(request, 123).id
    expect(chooseRecipe(request, 123, undefined, last).id).not.toBe(last)
    const ids = new Set(Array.from({ length: 400 }, (_, seed) => chooseRecipe(request, seed).id))
    expect(ids.size).toBeGreaterThan(8)
    expect(chooseRecipe(request, 123, 'major-minor-four').id).toBe('major-minor-four')
  })
  it('los tres controles cambian las puntuaciones de acuerdo con las etiquetas', () => {
    for (const field of ['exploration', 'tension', 'movement'] as const) {
      const property = field === 'exploration' ? 'novelty' : field
      const low = rankRecipes({ ...request, controls: { ...request.controls, [field]: 0 } })
      const high = rankRecipes({ ...request, controls: { ...request.controls, [field]: 100 } })
      const recipe = low.find(item => item.recipe[property] > 50)!
      expect(high.find(item => item.recipe.id === recipe.recipe.id)!.score).toBeGreaterThan(recipe.score)
    }
  })
  it('busca por palabras sin depender de acentos y respeta las categorías', () => {
    expect(searchKnowledge('SÍNCOPA', 'rhythm').resources.length).toBeGreaterThan(0)
    expect(searchKnowledge('', 'scales').resources).toHaveLength(12)
    expect(searchKnowledge('', 'lyrics').recipes).toHaveLength(0)
    expect(searchKnowledge('zzzzzz', 'all')).toEqual({ recipes: [], resources: [] })
  })
  it('prepara un contexto acotado sin ejecutar ni llamar a proveedores', () => {
    for (const budget of [512, 1000, 4000, 10000]) {
      const context = buildKnowledgeContext(request, '', budget)
      expect(JSON.stringify(context).length).toBeLessThanOrEqual(budget)
      expect(context.resources.length).toBeLessThanOrEqual(6)
      expect(context.resources.every(item => item.sourceId === 'project-original')).toBe(true)
    }
    expect(() => buildKnowledgeContext(request, '', 10001)).toThrow(/presupuesto/)
  })
})
