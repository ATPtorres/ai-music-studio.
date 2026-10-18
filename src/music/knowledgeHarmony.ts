import { keys } from '../models/project'
import { chooseRecipe, library } from '../knowledge/catalog'
import type { CreativeSettings, HarmonyKnowledge } from '../knowledge/schema'
import type { HarmonySettings, MusicChord } from './harmony'
import { barBeats } from './theory'

type ChordType = HarmonySettings['chordType']
type CoreChord = Omit<MusicChord, 'id' | 'start' | 'duration'>
type Builder = (key: typeof keys[number], mode: 'major' | 'minor', degree: number, type: ChordType) => CoreChord
export function knowledgeChord(key: typeof keys[number], mode: 'major' | 'minor', step: { kind: 'diatonic'; degree: number } | { kind: 'borrowed'; degree: number } | { kind: 'secondary'; target: number }, type: ChordType, build: Builder): CoreChord {
  if (step.kind === 'diatonic') return build(key, mode, step.degree, type)
  if (step.kind === 'borrowed') {
    const parallel = mode === 'major' ? 'minor' : 'major'
    const chord = build(key, parallel, step.degree, type)
    const normal = build(key, mode, step.degree, type)
    const change = chord.pitches[0] - normal.pitches[0]
    return { ...chord, degree: `${change < 0 ? '♭' : change > 0 ? '♯' : ''}${chord.degree} (p)` }
  }
  const target = build(key, mode, step.target, 'triad')
  const pc = (target.pitches[0] + 7) % 12
  const offsets = type === 'triad' ? [0, 4, 7] : type === 'seventh' ? [0, 4, 7, 10] : [0, 4, 7, 10, 14]
  return { symbol: `${keys[pc]}${type === 'triad' ? '' : type === 'seventh' ? '7' : '9'}`, degree: `V/${target.degree}`, pitches: offsets.map(offset => 48 + pc + offset) }
}
/** Greedy nearest-voice voicing, not a claim of globally optimal classical counterpoint. */
export function smoothVoiceLeading(chords: MusicChord[]): MusicChord[] {
  let previous: number[] | undefined
  return chords.map(chord => {
    if (!previous) { previous = [...chord.pitches]; return { ...chord, pitches: [...chord.pitches] } }
    const candidates: number[][] = []
    for (let inversion = 0; inversion < chord.pitches.length; inversion++) for (const shift of [-12, 0, 12]) {
      const pitches = [...chord.pitches.slice(inversion), ...chord.pitches.slice(0, inversion).map(pitch => pitch + 12)].map(pitch => pitch + shift).sort((a, b) => a - b)
      if (pitches.every(pitch => pitch >= 36 && pitch <= 84)) candidates.push(pitches)
    }
    const cost = (pitches: number[]) => pitches.reduce((total, pitch, index) => total + Math.abs(pitch - previous![Math.min(index, previous!.length - 1)]), 0)
    const chosen = candidates.reduce((best, candidate) => cost(candidate) < cost(best) ? candidate : best, chord.pitches)
    previous = chosen
    return { ...chord, pitches: [...chosen] }
  })
}
export function generateKnowledgeHarmony(settings: HarmonySettings, build: Builder): { chords: MusicChord[]; knowledge: HarmonyKnowledge } {
  const options = settings.knowledge!
  const recipe = chooseRecipe({ mode: settings.mode, genre: settings.genre, mood: settings.mood, complexity: settings.complexity, controls: options.controls }, settings.seed, options.recipeId, options.avoidRecipeId)
  const beats = barBeats(settings.signature)
  const chords = Array.from({ length: settings.bars }, (_, index) => ({ ...knowledgeChord(settings.key, settings.mode, recipe.steps[index % recipe.steps.length], settings.chordType, build), id: crypto.randomUUID(), start: index * beats, duration: beats }))
  return { chords: options.controls.voiceLeading ? smoothVoiceLeading(chords) : chords, knowledge: { libraryVersion: library.version, recipeId: recipe.id, controls: options.controls, seed: settings.seed, edited: false, pinned: Boolean(options.recipeId) } }
}
export function extraChordChoices(key: typeof keys[number], mode: 'major' | 'minor', type: ChordType, color: CreativeSettings['color'], build: Builder): CoreChord[] {
  const result: CoreChord[] = []
  if (color === 'borrowed' || color === 'mixed') for (let degree = 0; degree < 7; degree++) result.push(knowledgeChord(key, mode, { kind: 'borrowed', degree }, type, build))
  if (color === 'secondary' || color === 'mixed') for (let target = 1; target < 7; target++) {
    if (!build(key, mode, target, 'triad').symbol.includes('dim')) result.push(knowledgeChord(key, mode, { kind: 'secondary', target }, type, build))
  }
  return result
}
