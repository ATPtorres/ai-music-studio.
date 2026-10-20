import { z } from 'zod'
import { projectSchema, type MusicProject } from '../models/project'
import { defaultStructureOptions, structureOptionsSchema, type StructureOptions } from '../knowledge/structureSchema'
import { structureLibrary } from '../knowledge/structures'
import { randomFromSeed } from '../music/random'
import { harmonyFingerprint } from '../music/lines'
import { sourceClip } from './clips'
import { instrumentOrder } from './instruments'
import { renderArrangement } from './render'

type Section = MusicProject['sections'][number]
const seedSchema = z.number().int().min(0).max(0xffffffff)
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
function genreFamily(text: string) {
  const value = normalize(text)
  return /jazz/.test(value) ? 'jazz' : /ambient/.test(value) ? 'ambient' : /instrumental/.test(value) ? 'instrumental' : /folk|acustic/.test(value) ? 'folk' : /r&b|funk/.test(value) ? 'rnb' : /rock/.test(value) ? 'rock' : /trap|hip-hop|reggaeton/.test(value) ? 'urban' : /latin/.test(value) ? 'latin' : /electron/.test(value) ? 'electronic' : 'pop'
}
export function structureFingerprint(sections: Section[]) {
  const text = JSON.stringify(sections.map(s => [s.id, s.name, s.bars, s.trackIds, s.variantIds ?? {}]))
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return `structure1:${(hash >>> 0).toString(16)}:${text.length}`
}
export function generateStructure(project: MusicProject, input: StructureOptions = defaultStructureOptions, inputSeed = crypto.getRandomValues(new Uint32Array(1))[0]) {
  const options = structureOptionsSchema.parse(input), seed = seedSchema.parse(inputSeed), random = randomFromSeed(seed)
  const candidates = structureLibrary.recipes.filter(recipe => options.family === 'auto' || recipe.family === options.family)
  const chosen = candidates.find(recipe => recipe.id === options.recipeId)
  if (options.recipeId !== 'auto' && !chosen) throw new Error('La receta no pertenece a la familia seleccionada o no está disponible.')
  // Excluding the last automatically selected recipe avoids merely renaming the same form.
  const choices = candidates.length > 1 ? candidates.filter(recipe => recipe.id !== project.structureGeneration?.recipeId) : candidates
  const family = genreFamily(project.parameters.genre), mood = normalize(project.parameters.mood)
  const weighted = choices.map(recipe => ({ recipe, weight: (1 + (recipe.genres.includes(family) ? 2 : 0) + (recipe.moods.includes(mood) ? 1 : 0)) * Math.exp(-Math.abs(recipe.novelty - options.exploration) / 32) }))
  let draw = random() * weighted.reduce((sum, item) => sum + item.weight, 0)
  const recipe = chosen ?? weighted.find(item => { draw -= item.weight; return draw <= 0 })?.recipe ?? weighted.at(-1)!.recipe
  const tracks = instrumentOrder.flatMap(kind => project.tracks.filter(track => track.kind === kind)).filter(track => sourceClip(track, project.parameters.timeSignature).notes.length > 0).slice(0, 16)
  const anchor = tracks.find(t => t.kind === 'chords') ?? tracks.find(t => t.kind === 'melody') ?? tracks.find(t => t.kind === 'bass') ?? tracks[0]
  const provenance = harmonyFingerprint(project)
  const groupVariants = new Map<string, Map<string, string>>()
  const usedVariants = new Map<string, Set<string>>()
  const firstMusicalGroup = recipe.steps.find(step => !['intro', 'outro', 'coda'].includes(step.role))!.group
  const occurrences = new Map<string, number>()
  const plan = recipe.steps.map(step => {
    const count = (occurrences.get(step.label) ?? 0) + 1; occurrences.set(step.label, count)
    const selected = tracks.filter(track => step.energy === 3 || (step.energy === 0 ? track.id === anchor?.id || (track.kind === 'melody' && random() < .35) : step.energy === 1 ? ['chords', 'bass'].includes(track.kind) || (track.kind === 'drums' && random() < .65) : track.kind !== 'melody' || random() < .65))
    if (!selected.length && anchor) selected.push(anchor)
    let variants = groupVariants.get(step.group)
    if (!variants) {
      variants = new Map(); groupVariants.set(step.group, variants)
      for (const track of tracks) {
        // Chords stay on V1: independently edited harmony could invalidate bass and lead.
        const compatible = (track.variants ?? []).filter(v => v.notes.length && (track.kind === 'drums' || ((track.kind === 'bass' || track.kind === 'melody') && v.sourceHarmony === provenance)))
        if (step.group !== firstMusicalGroup && !['intro', 'outro', 'coda', 'break', 'build'].includes(step.role) && compatible.length) {
          const used = usedVariants.get(track.id) ?? new Set<string>()
          const fresh = compatible.filter(v => !used.has(v.id))
          const pool = fresh.length ? fresh : compatible
          const selected = pool[Math.floor(random() * pool.length)].id
          variants.set(track.id, selected); used.add(selected); usedVariants.set(track.id, used)
        }
      }
    }
    const variantIds = Object.fromEntries(selected.filter(track => variants!.has(track.id)).map(track => [track.id, variants!.get(track.id)!]))
    return { name: `${step.label}${count > 1 ? ` ${count}` : ''}`, units: step.units, trackIds: selected.map(track => track.id), variantIds }
  })
  const warnings: string[] = []
  // Preserve relative phrase lengths while fitting the existing preview/MIDI resource caps.
  for (const phraseBars of [options.phraseBars, ...[8, 4, 2].filter(value => value < options.phraseBars)]) {
    const sections: Section[] = plan.map(step => ({ id: crypto.randomUUID(), name: step.name, bars: step.units * phraseBars, trackIds: [...step.trackIds], variantIds: { ...step.variantIds }, lyrics: '' }))
    try { renderArrangement({ ...project, sections }) }
    catch (error) {
      if (error instanceof Error && /supera el límite|supera el límite de 15000/.test(error.message)) {
        if (phraseBars !== 2) continue
      }
      throw error
    }
    if (phraseBars !== options.phraseBars) warnings.push(`Fraseo reducido a ${phraseBars} compases para respetar los límites de reproducción.`)
    if (!tracks.length) warnings.push('Todavía no hay pistas con notas: la forma está lista para vincular instrumentos.')
    if (project.tracks.length > tracks.length) warnings.push('Solo se vinculan clips originales con notas, hasta un máximo de 16 pistas.')
    if (!tracks.some(t => (t.kind === 'bass' || t.kind === 'melody') && t.variants?.some(v => v.notes.length && v.sourceHarmony === provenance))) warnings.push('Sin variantes melódicas compatibles: el contraste usa entradas y salidas; crea frases diferentes para distinguir los temas.')
    else {
      const materialGroups = new Set(recipe.steps.filter(s => !['intro', 'outro', 'coda', 'break', 'build', 'prechorus', 'postchorus'].includes(s.role)).map(s => s.group)).size
      const melodicChoices = Math.max(0, ...tracks.filter(t => t.kind === 'bass' || t.kind === 'melody').map(t => t.variants?.filter(v => v.notes.length && v.sourceHarmony === provenance).length ?? 0))
      if (melodicChoices < materialGroups - 1) warnings.push('Hay más grupos de material que variantes melódicas compatibles: algunas secciones compartirán frases. Prepara más variantes si buscas mayor contraste.')
    }
    const structureGeneration = { libraryVersion: 1 as const, recipeId: recipe.id, seed, options, actualPhraseBars: phraseBars, fingerprint: structureFingerprint(sections) }
    projectSchema.parse({ ...project, sections, structureGeneration })
    return { sections, structureGeneration, recipe, warnings }
  }
  throw new Error('No se pudo ajustar esta estructura a los límites del arreglo.')
}
/** Compatibility entry point for callers that only need the section list. */
export function createDynamicStructure(project: MusicProject, options?: StructureOptions, seed?: number): Section[] {
  return generateStructure(project, options, seed).sections
}
