import { projectSchema, type MusicProject } from '../../models/project'
import { lyricsDraftSchema, type LyricsDraft } from '../../services/ai/lyricsContract'

/** Preserve track data and existing section IDs, lengths and clip references. */
export function applyLyricsDraft(project: MusicProject, input: LyricsDraft): Pick<MusicProject, 'name' | 'sections'> {
  const draft = lyricsDraftSchema.parse(input)
  const sections = draft.sections.map((section, index) => ({
    ...(project.sections[index] ?? { id: crypto.randomUUID(), bars: 8, trackIds: [] }),
    name: section.name, lyrics: section.lyrics,
  }))
  sections.push(...project.sections.slice(draft.sections.length))
  const next = projectSchema.parse({ ...project, name: draft.title, sections })
  return { name: next.name, sections: next.sections }
}
export function lyricsAsText(project: MusicProject) {
  return [project.name, ...project.sections.map(section => `${section.name}\n${section.lyrics}`)].join('\n\n')
}
