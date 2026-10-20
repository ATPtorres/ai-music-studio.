import { structureLibrary } from '../../knowledge/structures'
import { structureFamilyNames, structureFamilies, type StructureOptions } from '../../knowledge/structureSchema'
import type { MusicProject } from '../../models/project'
import { structureFingerprint } from '../../arrangement/structure'
import './structure-generator.css'

interface Props { project: MusicProject; options: StructureOptions; configure: (options: StructureOptions) => void; generate: () => void }
export default function StructureGenerator({ project, options, configure, generate }: Props) {
  const compatible = structureLibrary.recipes.filter(recipe => options.family === 'auto' || recipe.family === options.family)
  const applied = structureLibrary.recipes.find(recipe => recipe.id === project.structureGeneration?.recipeId)
  const edited = project.structureGeneration && structureFingerprint(project.sections) !== project.structureGeneration.fingerprint
  return <div className="structure-generator">
    <div className="section-heading"><h3>Una forma diferente para cada idea</h3><span>{structureLibrary.recipes.length} recetas · 8 familias · Motor local</span></div>
    <p>Genera otra propuesta con retornos, contrastes y entradas de instrumentos. Los ajustes son un borrador hasta generar; reemplazar una estructura existente pide confirmación.</p>
    <div className="structure-controls">
      <label>Familia de estructura<select aria-label="Familia de estructura" value={options.family} onChange={e => configure({ ...options, family: e.target.value as StructureOptions['family'], recipeId: 'auto' })}><option value="auto">Todas · según el proyecto</option>{structureFamilies.map(family => <option key={family} value={family}>{structureFamilyNames[family]}</option>)}</select></label>
      <label>Receta de estructura<select aria-label="Receta de estructura" value={options.recipeId} onChange={e => configure({ ...options, recipeId: e.target.value })}><option value="auto">Aleatoria · {compatible.length} formas posibles</option>{options.recipeId !== 'auto' && !compatible.some(r => r.id === options.recipeId) && <option value={options.recipeId}>Receta no disponible · elige Aleatoria</option>}{compatible.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}</select></label>
      <label>Frase principal<select aria-label="Compases de frase principal" value={options.phraseBars} onChange={e => configure({ ...options, phraseBars: Number(e.target.value) as StructureOptions['phraseBars'] })}>{[4, 8, 16].map(bars => <option key={bars} value={bars}>{bars} compases</option>)}</select></label>
      <label>Exploración · {options.exploration}<input aria-label="Exploración estructural" type="range" min="0" max="100" disabled={options.recipeId !== 'auto'} value={options.exploration} onChange={e => configure({ ...options, exploration: Number(e.target.value) })}/><small>Familiar ↔ Exploratoria · Selección automática</small></label>
    </div>
    <div className="structure-generate-row"><p>La selección considera género y emoción sin imponer una única forma. Mantiene tus pistas y variantes; las letras de las secciones reemplazadas se descartan al confirmar.</p><button className="button primary" onClick={generate}>{project.sections.length ? 'Generar otra estructura' : 'Generar estructura aleatoria'}</button></div>
    {project.structureGeneration && <div className="structure-applied"><strong>Recurso de partida: {applied?.title ?? project.structureGeneration.recipeId}</strong><p>{applied?.explanation ?? 'Esta receta no está instalada. Tus secciones y notas se conservan.'}</p>{applied && <p>Prueba: {applied.practice}</p>}<small>Frase aplicada: {project.structureGeneration.actualPhraseBars} compases.{edited ? ' Estructura editada: la referencia describe el punto de partida.' : ''}</small></div>}
    <details className="structure-reference"><summary>Cómo trabaja la biblioteca de formas</summary><p>Las letras A/B/C identifican materiales que regresan. El motor conserva la proporción de las frases y cambia las capas de instrumentos; usa variantes compatibles disponibles sin editar sus notas. Si solo existe V1, varias secciones pueden repetir la misma música: crea variantes para obtener contrastes melódicos reales.</p><p>Las etiquetas de estilo y exploración son orientaciones editoriales. Se respetan los límites de notas y duración del preview reduciendo el fraseo si hace falta. La duración se calcula por compases y BPM; no se ajusta automáticamente a los segundos objetivo.</p>{structureLibrary.sources.map(source => <div key={source.id}><p>{source.rights}</p><ul>{source.references.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname} · Formas y arreglo</a></li>)}</ul></div>)}</details>
  </div>
}
