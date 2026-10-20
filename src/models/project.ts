import { z } from 'zod'
import { soundSchema, soundsByKind } from '../sounds/catalog'
import { harmonyKnowledgeSchema } from '../knowledge/schema'

export const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const noteSchema = z.object({ pitch: z.number().int().min(0).max(127), start: z.number().min(0), duration: z.number().positive(), velocity: z.number().int().min(1).max(127) }).strict()
export const chordSchema = z.object({ id: z.string().max(100), symbol: z.string().max(30), degree: z.string().max(20), start: z.number().min(0), duration: z.number().positive(), pitches: z.array(z.number().int().min(0).max(127)).min(1).max(12) }).strict()
export const lineOptionsSchema = z.object({ low: z.number().int().min(0).max(127), high: z.number().int().min(0).max(127), density: z.enum(['sparse', 'medium', 'dense']), rhythm: z.enum(['sustained', 'straight', 'syncopated', 'walking']), complexity: z.enum(['simple', 'intermediate', 'advanced']) }).strict().refine(options => options.high >= options.low, 'El límite superior debe ser igual o mayor que el inferior.')
export const drumPatternSchema = z.object({ bars: z.number().int().min(1).max(8), signature: z.tuple([z.number().int().min(1).max(12), z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)])]), genre: z.enum(['Pop', 'Rock', 'Funk', 'Reggaetón', 'Trap', 'Hip-hop', 'R&B', 'Jazz', 'Electrónica', 'Música latina']), swing: z.number().min(0).max(0.6), lanes: z.object({ kick: z.array(z.number().int().min(0).max(127)).max(768), snare: z.array(z.number().int().min(0).max(127)).max(768), clap: z.array(z.number().int().min(0).max(127)).max(768), closedHat: z.array(z.number().int().min(0).max(127)).max(768), openHat: z.array(z.number().int().min(0).max(127)).max(768), shaker: z.array(z.number().int().min(0).max(127)).max(768) }).strict() }).strict().superRefine((pattern, ctx) => {
  const count = pattern.bars * pattern.signature[0] * 16 / pattern.signature[1]
  if (Object.values(pattern.lanes).some(lane => lane.length !== count)) ctx.addIssue({ code: 'custom', message: 'La longitud de las filas no coincide con los compases del patrón.' })
  if (pattern.lanes.closedHat.some((velocity, index) => velocity > 0 && pattern.lanes.openHat[index] > 0)) ctx.addIssue({ code: 'custom', message: 'El hi-hat abierto y el cerrado no pueden activarse en el mismo paso.' })
})
export type DrumPattern = z.infer<typeof drumPatternSchema>
export const variantSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100),
  beats: z.number().positive().max(4096), notes: z.array(noteSchema).max(4096),
  sourceHarmony: z.string().max(100).optional(),
}).strict().superRefine((variant, ctx) => {
  if (variant.notes.some(note => note.start + note.duration > variant.beats + 1e-8)) ctx.addIssue({ code: 'custom', message: 'Las notas deben terminar dentro del ciclo de la variante.' })
})
export type MusicVariant = z.infer<typeof variantSchema>
export const trackSchema = z.object({ id: z.string().max(100), name: z.string().max(100), kind: z.enum(['chords', 'melody', 'bass', 'drums']), channel: z.number().int().min(0).max(15), muted: z.boolean(), volume: z.number().min(0).max(1), notes: z.array(noteSchema).max(50000), chords: z.array(chordSchema).max(10000), sourceHarmony: z.string().max(100).optional(), generation: lineOptionsSchema.optional(), drumPattern: drumPatternSchema.optional(), harmonyKnowledge: harmonyKnowledgeSchema.optional(), sound: soundSchema.optional(), variants: z.array(variantSchema).max(32).optional() }).strict().superRefine((track, ctx) => {
  if (new Set(track.variants?.map(variant => variant.id)).size !== (track.variants?.length ?? 0)) ctx.addIssue({ code: 'custom', message: 'Las variantes deben tener identificadores únicos.' })
  if (track.variants?.some(variant => variant.name === 'V1') || new Set(track.variants?.map(variant => variant.name)).size !== (track.variants?.length ?? 0)) ctx.addIssue({ code: 'custom', message: 'Cada variante necesita un nombre diferente; V1 está reservado para el original.' })
  if ((track.kind === 'bass' || track.kind === 'melody') && track.variants?.some(variant => {
    const sorted = [...variant.notes].sort((a, b) => a.start - b.start)
    return sorted.some((note, i) => i > 0 && note.start < sorted[i - 1].start + sorted[i - 1].duration - 1e-8)
  })) ctx.addIssue({ code: 'custom', message: 'Las variantes de bajo y melodía son monofónicas.' })
  if (track.kind === 'drums' && track.variants?.some(variant => {
    const hats = new Map<number, number>()
    return variant.notes.some(note => {
      if (![42, 46].includes(note.pitch)) return false
      if (hats.has(note.start) && hats.get(note.start) !== note.pitch) return true
      hats.set(note.start, note.pitch)
      return false
    })
  })) ctx.addIssue({ code: 'custom', message: 'El hi-hat abierto y el cerrado no pueden empezar juntos.' })
  if (track.kind === 'drums' && track.variants?.some(variant => variant.notes.some(note => ![36, 38, 39, 42, 46, 70].includes(note.pitch)))) ctx.addIssue({ code: 'custom', message: 'La variante de batería contiene una nota de percusión no compatible.' })
  if (track.sound && !soundsByKind[track.kind].includes(track.sound)) ctx.addIssue({ code: 'custom', message: 'El sonido no corresponde al tipo de pista.' })
  if ((track.kind === 'drums') !== (track.channel === 9)) ctx.addIssue({ code: 'custom', message: 'La batería usa el canal 10 (índice 9), reservado para percusión.' })
  if (track.drumPattern && track.kind !== 'drums') ctx.addIssue({ code: 'custom', message: 'Un patrón de batería solo puede pertenecer a una pista de batería.' })
  if (track.harmonyKnowledge && track.kind !== 'chords') ctx.addIssue({ code: 'custom', message: 'La referencia de receta armónica solo corresponde a acordes.' })
})
const sectionSchema = z.object({ id: z.string().max(100), name: z.string().max(100), bars: z.number().int().min(1).max(512), trackIds: z.array(z.string()).max(100), lyrics: z.string().max(20000), variantIds: z.record(z.string().min(1).max(100), z.string().min(1).max(100)).optional() }).strict()
export const projectSchema = z.object({
  version: z.literal(1), id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  parameters: z.object({ key: z.enum(keys), mode: z.enum(['major', 'minor']), bpm: z.number().int().min(30).max(300), timeSignature: z.tuple([z.number().int().min(1).max(12), z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)])]), genre: z.string().max(100), mood: z.string().max(100), complexity: z.enum(['simple', 'intermediate', 'advanced']), instruments: z.array(z.string().max(100)).max(20), references: z.string().max(1000), theme: z.string().max(5000), targetSeconds: z.number().int().min(15).max(3600) }).strict(),
  tracks: z.array(trackSchema).max(100), sections: z.array(sectionSchema).max(100),
}).strict().superRefine((project, ctx) => {
  const ids = project.tracks.map(track => track.id)
  if (new Set(ids).size !== ids.length || new Set(project.sections.map(section => section.id)).size !== project.sections.length) ctx.addIssue({ code: 'custom', message: 'Los identificadores deben ser únicos.' })
  if (project.sections.some(section => Object.entries(section.variantIds ?? {}).some(([trackId, variantId]) => !section.trackIds.includes(trackId) || !project.tracks.find(track => track.id === trackId)?.variants?.some(variant => variant.id === variantId)))) ctx.addIssue({ code: 'custom', message: 'Una sección hace referencia a una variante inexistente o a una pista no vinculada.' })
  if (project.sections.some(section => section.trackIds.some(id => !ids.includes(id)))) ctx.addIssue({ code: 'custom', message: 'Una sección hace referencia a una pista inexistente.' })
})
export type MusicProject = z.infer<typeof projectSchema>
export type MusicNote = z.infer<typeof noteSchema>
export type MusicTrack = z.infer<typeof trackSchema>
export function createProject(): MusicProject {
  const now = new Date().toISOString()
  return { version: 1, id: crypto.randomUUID(), name: 'Mi próxima canción', createdAt: now, updatedAt: now, parameters: { key: 'A', mode: 'minor', bpm: 100, timeSignature: [4, 4], genre: 'Indie pop', mood: 'Nostálgico', complexity: 'simple', instruments: ['Piano', 'Bajo', 'Batería'], references: '', theme: '', targetSeconds: 180 }, tracks: [], sections: [] }
}
