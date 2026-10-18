import { z } from 'zod'

export const lyricStructures = {
  classic: ['Verso 1', 'Estribillo', 'Verso 2', 'Puente', 'Estribillo final'],
  short: ['Verso', 'Estribillo', 'Cierre'],
  narrative: ['Escena 1', 'Escena 2', 'Giro', 'Desenlace'],
} as const
export const lyricsRequestSchema = z.object({
  theme: z.string().trim().min(1).max(1000),
  genre: z.string().max(100), mood: z.string().max(100),
  language: z.enum(['Español', 'English']),
  structure: z.enum(['classic', 'short', 'narrative']),
  instructions: z.string().max(1000),
}).strict()
export type LyricsRequest = z.infer<typeof lyricsRequestSchema>
export function sectionNames(request: Pick<LyricsRequest, 'language' | 'structure'>): readonly string[] {
  return request.language === 'English' ? {
    classic: ['Verse 1', 'Chorus', 'Verse 2', 'Bridge', 'Final chorus'],
    short: ['Verse', 'Chorus', 'Outro'],
    narrative: ['Scene 1', 'Scene 2', 'Turn', 'Resolution'],
  }[request.structure] : lyricStructures[request.structure]
}
export const lyricsDraftSchema = z.object({
  title: z.string().trim().min(1).max(100),
  sections: z.array(z.object({ name: z.string().trim().min(1).max(100), lyrics: z.string().trim().min(1).max(4000) }).strict()).min(1).max(16),
}).strict().refine(draft => draft.sections.reduce((total, section) => total + section.lyrics.length, 0) <= 24000, 'El borrador supera el límite de texto.')
export type LyricsDraft = z.infer<typeof lyricsDraftSchema>
export const lyricsResponseSchema = z.object({ source: z.literal('gemini'), draft: lyricsDraftSchema }).strict()
export type DraftResult = { source: 'local' | 'gemini'; draft: LyricsDraft; warning?: string }
