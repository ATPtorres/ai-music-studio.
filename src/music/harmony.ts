import { z } from 'zod'
import { chordSchema, keys, type MusicNote, type MusicProject, type MusicTrack } from '../models/project'
import { barBeats } from './theory'
import { creativeSettingsSchema, type HarmonyKnowledge } from '../knowledge/schema'
import { generateKnowledgeHarmony } from './knowledgeHarmony'
import { randomFromSeed } from './random'
export { randomFromSeed } from './random'

export type MusicChord = z.infer<typeof chordSchema>
export const harmonySettingsSchema = z.object({
  key: z.enum(keys), mode: z.enum(['major', 'minor']),
  bars: z.number().int().min(2).max(16),
  signature: z.tuple([z.number().int().min(1).max(12), z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)])]),
  genre: z.string().max(100), mood: z.string().max(100),
  complexity: z.enum(['simple', 'intermediate', 'advanced']),
  chordType: z.enum(['triad', 'seventh', 'extended']), seed: z.number().int().min(0).max(0xffffffff),
  knowledge: z.object({ controls: creativeSettingsSchema, recipeId: z.string().min(1).max(100).optional(), avoidRecipeId: z.string().min(1).max(100).optional() }).strict().optional(),
}).strict()
export type HarmonySettings = z.infer<typeof harmonySettingsSchema>
const scales = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Diatonic thirds from the selected scale. Zero-based degree; MIDI C4 = 60. */
export function diatonicChord(key: typeof keys[number], mode: 'major' | 'minor', degree: number, type: 'triad' | 'seventh' | 'extended'): Omit<MusicChord, 'id' | 'start' | 'duration'> {
  if (!keys.includes(key) || !scales[mode] || !Number.isInteger(degree) || degree < 0 || degree > 6 || !['triad', 'seventh', 'extended'].includes(type)) throw new Error('Acorde no válido')
  const scale = scales[mode]
  const scalePitch = (step: number) => scale[step % 7] + Math.floor(step / 7) * 12
  const root = scalePitch(degree)
  const offsets = Array.from({ length: type === 'extended' ? 5 : type === 'seventh' ? 4 : 3 }, (_, i) => scalePitch(degree + i * 2) - root)
  const minor = offsets[1] === 3
  const diminished = offsets[2] === 6
  const seventh = offsets[3]
  const seventhSuffix = diminished ? 'm7♭5' : minor ? 'm7' : seventh === 11 ? 'maj7' : '7'
  const ninthSuffix = offsets[4] === 13 ? `${seventhSuffix}(♭9)` : diminished ? 'm9♭5' : minor ? 'm9' : seventh === 11 ? 'maj9' : '9'
  const suffix = type === 'triad' ? diminished ? 'dim' : minor ? 'm' : '' : type === 'extended' ? ninthSuffix : seventhSuffix
  const numeral = minor ? roman[degree].toLowerCase() : roman[degree]
  return {
    symbol: `${keys[(keys.indexOf(key) + root) % 12]}${suffix}`,
    degree: numeral + (type === 'triad' ? diminished ? '°' : '' : `${diminished ? 'ø' : ''}${type === 'extended' ? offsets[4] === 13 ? '7(♭9)' : seventh === 11 && !minor ? 'maj9' : '9' : seventh === 11 && !minor ? 'maj7' : '7'}`),
    pitches: offsets.map(offset => 48 + keys.indexOf(key) + root + offset),
  }
}

/** Templates use tonal functions, not copied songs. Seed makes tests reproducible. */
function generateLegacyProgression(input: HarmonySettings): MusicChord[] {
  const settings = harmonySettingsSchema.parse(input)
  const random = randomFromSeed(settings.seed)
  const jazz = /jazz|r&b|funk/i.test(settings.genre)
  const rock = /rock/i.test(settings.genre)
  const mellow = /nost|melanc|seren/i.test(settings.mood)
  let templates = jazz ? [[1, 4, 0, 5], [0, 5, 1, 4], [3, 6, 2, 5]] : rock ? [[0, 3, 4, 0], [0, 4, 3, 0], [0, 3, 5, 4]] : mellow ? [[5, 3, 0, 4], [0, 2, 3, 4], [0, 5, 3, 4]] : [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4]]
  if (settings.mode === 'minor' && !jazz) templates = mellow ? [[0, 5, 2, 6], [0, 3, 5, 6], [0, 6, 5, 6]] : [[0, 3, 6, 0], [0, 6, 2, 5], [0, 5, 6, 0]]
  const template = templates[Math.floor(random() * templates.length)]
  const beats = barBeats(settings.signature)
  return Array.from({ length: settings.bars }, (_, index) => {
    let degree = template[index % template.length]
    if (settings.complexity !== 'simple' && index % 4 === 1) degree = random() < 0.5 ? 1 : 3
    if (settings.complexity === 'advanced' && index % 4 === 2) degree = random() < 0.5 ? 2 : 5
    const chord = diatonicChord(settings.key, settings.mode, degree, settings.chordType)
    // Inversions add voice-leading variety without changing pitch classes.
    if (settings.complexity === 'advanced' && index % 2) chord.pitches = [...chord.pitches.slice(1), chord.pitches[0] + 12]
    return chordSchema.parse({ ...chord, id: crypto.randomUUID(), start: index * beats, duration: beats })
  })
}

export function generateProgressionResult(input: HarmonySettings): { chords: MusicChord[]; knowledge?: HarmonyKnowledge } {
  const settings = harmonySettingsSchema.parse(input)
  if (settings.knowledge) {
    const result = generateKnowledgeHarmony(settings, diatonicChord)
    return { ...result, chords: result.chords.map(chord => chordSchema.parse(chord)) }
  }
  return { chords: generateLegacyProgression(settings) }
}
export function generateProgression(input: HarmonySettings): MusicChord[] { return generateProgressionResult(input).chords }

export function chordsToNotes(chords: MusicChord[]): MusicNote[] {
  return chords.flatMap(chord => chord.pitches.map(pitch => ({ pitch, start: chord.start, duration: chord.duration, velocity: 88 })))
}

export function retimeChords(chords: MusicChord[]): MusicChord[] {
  let start = 0
  return chords.map(chord => { const result = chordSchema.parse({ ...chord, start }); start += result.duration; return result })
}

export function withChordTrack(project: MusicProject, chords: MusicChord[], name: string, knowledge?: HarmonyKnowledge): MusicTrack[] {
  const existing = project.tracks.find(track => track.kind === 'chords')
  const track: MusicTrack = { id: existing?.id ?? crypto.randomUUID(), name, kind: 'chords', channel: existing?.channel ?? 0, muted: existing?.muted ?? false, volume: existing?.volume ?? 0.7, chords, notes: chordsToNotes(chords), ...(existing?.sound ? { sound: existing.sound } : {}), ...(knowledge ? { harmonyKnowledge: knowledge } : {}) }
  return existing ? project.tracks.map(item => item.id === existing.id ? track : item) : [...project.tracks, track]
}
