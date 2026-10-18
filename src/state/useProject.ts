import { useEffect, useState } from 'react'
import { createProject, type MusicProject } from '../models/project'
import { loadProject, saveProject } from '../services/persistence'
function initialState() {
  try { return { project: loadProject(localStorage) ?? createProject(), error: '' } }
  catch { return { project: createProject(), error: 'No se pudo recuperar el proyecto local. La copia anterior se conserva; exporta tu trabajo antes de reemplazarla.' } }
}
export function useProject() {
  const [initial] = useState(initialState)
  const [project, setProject] = useState(initial.project)
  const [status, setStatus] = useState(initial.error || 'Guardado en este dispositivo')
  const [blocked, setBlocked] = useState(Boolean(initial.error))
  useEffect(() => {
    if (blocked) return
    const timer = setTimeout(() => {
      try { saveProject(localStorage, project); setStatus('Guardado en este dispositivo') }
      catch { setStatus('No se pudo guardar. Exporta una copia JSON para conservar tu trabajo.') }
    }, 250)
    return () => clearTimeout(timer)
  }, [project, blocked])
  useEffect(() => {
    const flush = () => { if (!blocked) { try { saveProject(localStorage, project) } catch { /* The UI already offers JSON backup. */ } } }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [project, blocked])
  const update = (change: Partial<MusicProject>) => { setProject(p => ({ ...p, ...change, updatedAt: new Date().toISOString() })); if (!blocked) setStatus('Guardando…') }
  const replace = (next: MusicProject) => { setBlocked(false); setProject(next); setStatus('Guardando…') }
  return { project, update, replace, status, blocked }
}
