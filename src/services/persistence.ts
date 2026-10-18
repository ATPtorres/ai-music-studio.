import { projectSchema, type MusicProject } from '../models/project'
export const STORAGE_KEY = 'ai-music-studio:project:v1'
export const MAX_PROJECT_BYTES = 2_000_000
export function parseProject(text: string): MusicProject {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('El proyecto supera el límite de 2 MB.')
  const parsed = projectSchema.safeParse(JSON.parse(text))
  if (!parsed.success) throw new Error('Proyecto no válido o versión incompatible. Se requiere el formato v1.')
  return parsed.data
}
export function loadProject(storage: Pick<Storage, 'getItem'>): MusicProject | null {
  const raw = storage.getItem(STORAGE_KEY)
  return raw ? parseProject(raw) : null
}
export function saveProject(storage: Pick<Storage, 'setItem'>, project: MusicProject): void {
  const serialized = JSON.stringify(projectSchema.parse(project))
  if (new TextEncoder().encode(serialized).length > MAX_PROJECT_BYTES) throw new Error('El proyecto supera el límite de 2 MB. Exporta una copia JSON.')
  storage.setItem(STORAGE_KEY, serialized)
}
export function downloadProject(project: MusicProject): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 80)}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
