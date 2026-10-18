import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Mic2, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { MusicProject } from '../../models/project'
import { createGeminiLyricsProvider, localLyricsProvider, type LyricsProvider } from '../../services/ai/lyricsProvider'
import { lyricsRequestSchema, type DraftResult, type LyricsRequest } from '../../services/ai/lyricsContract'
import { applyLyricsDraft, lyricsAsText } from './lyricsProject'
import './lyrics.css'

const geminiProvider = createGeminiLyricsProvider()
interface Props { project: MusicProject; update: (change: Partial<MusicProject>) => void; saveStatus: string; aiProvider?: LyricsProvider }
export default function LyricsWorkbench({ project, update, saveStatus, aiProvider = geminiProvider }: Props) {
  const [theme, setTheme] = useState(project.parameters.theme.slice(0, 1000))
  const [instructions, setInstructions] = useState('')
  const [language, setLanguage] = useState<LyricsRequest['language']>('Español')
  const [structure, setStructure] = useState<LyricsRequest['structure']>('classic')
  const [provider, setProvider] = useState('local')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DraftResult | null>(null)
  const [message, setMessage] = useState('')
  const controller = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  useEffect(() => () => { sequence.current++; controller.current?.abort() }, [])
  const generate = async () => {
    const parsed = lyricsRequestSchema.safeParse({ theme, instructions, language, structure, genre: project.parameters.genre, mood: project.parameters.mood })
    if (!parsed.success) { setMessage('Escribe un tema de 1 a 1000 caracteres y revisa las instrucciones.'); return }
    if (provider === 'gemini' && !consent) { setMessage('Confirma el envío a Gemini o elige la guía local.'); return }
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    const id = ++sequence.current
    setBusy(true); setMessage(''); setResult(null)
    try {
      const next = await (provider === 'gemini' ? aiProvider : localLyricsProvider).generate(parsed.data, abort.signal)
      if (id !== sequence.current || abort.signal.aborted) return
      setResult(next)
      setMessage(next.warning ?? (next.source === 'local' ? 'Guía local lista. Es un punto de partida para escribir, sin inteligencia artificial.' : 'Borrador de Gemini listo. Revísalo antes de aplicarlo.'))
    } catch {
      if (id === sequence.current && !abort.signal.aborted) setMessage('No se pudo preparar el borrador. Puedes seguir escribiendo manualmente.')
    } finally { if (id === sequence.current) setBusy(false) }
  }
  const apply = () => {
    if (!result) return
    if (!window.confirm(`¿Aplicar el título y las letras del borrador a las primeras ${result.draft.sections.length} secciones? Se reemplazará su texto actual. Las pistas, los compases y las secciones adicionales se conservan.`)) return
    try { update(applyLyricsDraft(project, result.draft)); setResult(null); setMessage('Borrador aplicado. Puedes editarlo y exportar una copia JSON.') }
    catch { setMessage('No se pudo aplicar el borrador. El proyecto se conserva.') }
  }
  const editSection = (index: number, change: Partial<MusicProject['sections'][number]>) => update({ sections: project.sections.map((section, i) => i === index ? { ...section, ...change } : section) })
  const download = () => {
    const url = URL.createObjectURL(new Blob([lyricsAsText(project)], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'letra.txt'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="lyrics-workbench" aria-label="Editor de letras">
    <p className="lyrics-save" role="status">{saveStatus}</p>
    <div className="lyrics-intro"><span className="icon-box pink"><Mic2 size={25}/></span><div><div className="eyebrow">TU HISTORIA, TU VOZ</div><h2>Encuentra las palabras de tu canción.</h2><p>Escribe libremente, parte de una guía local o prepara un borrador con Gemini.</p></div></div>
    <div className="lyrics-generator"><div className="section-heading"><h3>Un punto de partida</h3><span>El borrador no cambia tu proyecto hasta que lo apliques.</span></div>
      <label>Tema de la letra<textarea aria-label="Tema de la letra" maxLength={1000} value={theme} onChange={e => setTheme(e.target.value)} placeholder="Una despedida en una estación, con esperanza de volver…"/></label>
      <div className="lyrics-settings"><label>Idioma<select value={language} onChange={e => setLanguage(e.target.value as LyricsRequest['language'])}><option>Español</option><option>English</option></select></label><label>Estructura del borrador<select value={structure} onChange={e => setStructure(e.target.value as LyricsRequest['structure'])}><option value="classic">Versos, estribillos y puente</option><option value="short">Breve: verso, estribillo y cierre</option><option value="narrative">Narrativa: escenas y desenlace</option></select></label><label>Asistencia<select aria-label="Asistencia" disabled={busy} value={provider} onChange={e => { setProvider(e.target.value); setConsent(false) }}><option value="local">Guía local · sin conexión</option><option value="gemini">Gemini · opcional</option></select></label></div>
      <label>Indicaciones adicionales<textarea maxLength={1000} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Por ejemplo: primera persona, imágenes cotidianas, sin nombres propios." rows={2}/></label>
      {provider === 'local' && <p className="lyrics-hint">La guía propone ejercicios de escritura según la estructura y el tema. Género, emoción e indicaciones quedan como referencia para tu edición; no se interpretan automáticamente.</p>}
      {provider === 'gemini' && <div className="lyrics-consent"><p>Se enviarán a Google el tema, género, emoción, idioma e indicaciones, junto con recursos de la biblioteca. No se enviarán tus pistas ni la letra guardada. El tratamiento de datos y las cuotas dependen de tu cuenta de Gemini.</p><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>Acepto enviar estos datos a Gemini para este borrador.</label><p>La asistencia necesita estar configurada en el servidor. Si falla, recibirás una guía local.</p></div>}
      <div className="lyrics-actions"><button className="button primary" disabled={busy || !theme.trim() || (provider === 'gemini' && !consent)} onClick={() => { void generate() }}><Sparkles size={16}/>{busy ? 'Preparando…' : provider === 'local' ? 'Preparar guía local' : 'Crear borrador con Gemini'}</button>{busy && <button className="button secondary" onClick={() => { sequence.current++; controller.current?.abort(); setBusy(false); setMessage('Solicitud cancelada. Tu letra no cambió.') }}>Cancelar solicitud</button>}</div>
    </div>
    {message && <p className="lyrics-message" role="status">{message}</p>}
    {result && <section className="lyrics-draft" aria-label="Borrador sin aplicar"><div className="section-heading"><h3>{result.source === 'local' ? 'Guía local' : 'Borrador de Gemini'} · sin aplicar</h3><button className="text-button" onClick={() => { setResult(null); setMessage('Borrador descartado. Tu letra no cambió.') }}>Descartar borrador</button></div><h4>{result.draft.title}</h4>{result.draft.sections.map((section, index) => <div className="lyrics-draft-section" key={index}><h4>{section.name}</h4><p>{section.lyrics}</p></div>)}<button className="button primary" onClick={apply}>Aplicar borrador al proyecto</button></section>}
    <div className="section-heading"><h3>Tu letra</h3><button className="text-button" onClick={download}><ArrowDownToLine size={15}/>Descargar letra TXT</button></div>
    <div className="lyrics-editor"><label>Título de la canción<input value={project.name} maxLength={100} onChange={e => update({ name: e.target.value })} onBlur={() => { if (!project.name.trim()) update({ name: 'Sin título' }) }}/></label>
    {!project.sections.length && <p className="lyrics-hint">Añade una sección para empezar a escribir. No necesitas IA ni conexión.</p>}
    {project.sections.map((section, index) => <section className="lyrics-section" key={section.id} aria-label={`Sección ${index + 1}`}><div className="lyrics-section-heading"><label>Nombre de sección {index + 1}<input maxLength={100} value={section.name} onChange={e => editSection(index, { name: e.target.value })}/></label><button className="text-button" aria-label={`Eliminar sección ${index + 1}`} onClick={() => { if (window.confirm(`¿Eliminar «${section.name}» y su letra? También se eliminarán las referencias de esta sección; las pistas se conservan.`)) update({ sections: project.sections.filter((_, i) => i !== index) }) }}><Trash2 size={15}/>Eliminar</button></div><label>Letra de sección {index + 1}<textarea aria-label={`Letra de sección ${index + 1}`} maxLength={20000} value={section.lyrics} onChange={e => editSection(index, { lyrics: e.target.value })} rows={7} placeholder="Escribe aquí tu letra…"/></label></section>)}
    <button className="button secondary" disabled={project.sections.length >= 100} onClick={() => update({ sections: [...project.sections, { id: crypto.randomUUID(), name: `Verso ${project.sections.length + 1}`, bars: 8, trackIds: [], lyrics: '' }] })}><Plus size={16}/>Añadir sección</button></div>
    <p className="lyrics-hint">El título y las secciones se guardan en este navegador y viajan en el JSON del proyecto. La letra no genera voz ni eventos MIDI. El arreglo musical por secciones llegará en la Fase 6.</p>
  </section>
}
