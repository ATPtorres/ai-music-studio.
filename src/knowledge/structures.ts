import raw from './data/structures.v1.json'
import { structureLibrarySchema } from './structureSchema'
export const structureLibrary = structureLibrarySchema.parse(raw)
export function searchStructures(query = '') {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = normalize(query.slice(0, 300)).split(/\s+/).filter(Boolean)
  return structureLibrary.recipes.filter(recipe => words.every(word => normalize([recipe.title, recipe.explanation, recipe.family, ...recipe.genres, ...recipe.steps.map(s => s.label)].join(' ')).includes(word)))
}
