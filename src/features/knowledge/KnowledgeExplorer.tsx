import { useMemo, useState } from 'react'
import { BookOpen, ArrowRight, Search } from 'lucide-react'
import { library, recipeSuggestion, searchKnowledge } from '../../knowledge/catalog'
import type { KnowledgeSuggestion } from '../../knowledge/schema'
import './knowledge.css'

const categories = [['all', 'Todo'], ['harmony', 'Armonía'], ['scales', 'Escalas'], ['melody', 'Melodía'], ['rhythm', 'Ritmo'], ['form', 'Estructura'], ['lyrics', 'Letras']] as const
const complexity = { simple: 'Simple', intermediate: 'Intermedia', advanced: 'Avanzada' }
export default function KnowledgeExplorer({ onUseRecipe }: { onUseRecipe: (suggestion: KnowledgeSuggestion) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const results = useMemo(() => searchKnowledge(query, category), [query, category])
  const count = results.recipes.length + results.resources.length
  return <section className="knowledge-explorer">
    <div className="knowledge-intro"><BookOpen size={26}/><div><h2>Ideas con contexto</h2><p>{library.recipes.length} recetas de acordes y {library.resources.length} fichas de consulta. Contenido local, versionado y ampliable.</p><p>Las recetas alimentan Acordes. Las fichas de escalas, melodía, ritmo, estructura y letras son material de consulta; sus nuevos motores llegarán en entregas posteriores.</p></div></div>
    <div className="knowledge-filters"><label><Search size={17}/><input aria-label="Buscar en biblioteca" type="search" maxLength={300} value={query} onChange={e => setQuery(e.target.value)} placeholder="Busca: contraste, imagen, cadencia…"/></label><select aria-label="Categoría de biblioteca" value={category} onChange={e => setCategory(e.target.value)}>{categories.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></div>
    <p role="status" className="muted">{count} recursos encontrados · Biblioteca v{library.version}</p>
    {count === 0 && <div className="knowledge-empty">No hay coincidencias. Prueba con menos palabras o cambia la categoría.</div>}
    <div className="knowledge-grid">{results.recipes.map(recipe => <article className="knowledge-card" key={recipe.id}>
      <span className="knowledge-kind">RECETA · ACORDES · {recipe.mode === 'major' ? 'MAYOR' : 'MENOR'}</span><h3>{recipe.title}</h3><p>{recipe.explanation}</p><p className="knowledge-practice"><strong>Prueba:</strong> {recipe.practice}</p><div className="knowledge-tags">{recipe.tags.map(tag => <span key={tag}>{tag}</span>)}</div><small>Complejidad mínima: {complexity[recipe.minComplexity]} · {recipe.steps.length} compases por ciclo</small><button className="text-button" onClick={() => onUseRecipe(recipeSuggestion(recipe))}>Preparar en Acordes <ArrowRight size={15}/></button><small>Prepara un borrador; genera para aplicarlo.</small>
    </article>)}{results.resources.map(resource => <article className="knowledge-card" key={resource.id}>
      <span className="knowledge-kind">CONSULTA · {categories.find(([id]) => id === resource.category)?.[1].toUpperCase()}</span><h3>{resource.title}</h3><p>{resource.explanation}</p>{resource.intervals && <p className="knowledge-intervals">Semitonos desde la tónica: {resource.intervals.join(' · ')}</p>}<p><strong>Ejemplo:</strong> {resource.example}</p><p className="knowledge-practice"><strong>Prueba:</strong> {resource.practice}</p><details><summary>Cuándo usarla</summary><ul>{resource.conditions.map(condition => <li key={condition}>{condition}</li>)}</ul></details><div className="knowledge-tags">{resource.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    </article>)}</div>
    <details className="knowledge-sources"><summary>Procedencia y referencias</summary><p>Todas las fichas y recetas de esta edición comparten la procedencia indicada abajo. Las puntuaciones de exploración, tensión y movimiento son criterios de selección, no garantías sobre lo que sentirás al escucharlas.</p>{library.sources.map(source => <div key={source.id}><h3>{source.name}</h3><p>{source.rights}</p><ul>{source.references.map((url, index) => <li key={url}><a href={url} target="_blank" rel="noreferrer">Open Music Theory · referencia {index + 1}</a></li>)}</ul></div>)}</details>
  </section>
}
