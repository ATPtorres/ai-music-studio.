import { useEffect, useRef, useState } from 'react'
import './chords.css'
import { ArrowDownToLine, Headphones, Pause, Piano, Play, RefreshCw, Repeat2, Sparkles, Square, Volume2 } from 'lucide-react'
import { ChordPlayer, type PlaybackState } from '../../audio/ChordPlayer'
import { keys, type MusicProject } from '../../models/project'
import { barBeats, midiToNote } from '../../music/theory'
import { diatonicChord, generateProgressionResult, retimeChords, withChordTrack, type HarmonySettings, type MusicChord } from '../../music/harmony'
import { downloadChordsMidi } from '../../midi/exportChords'
import { defaultCreativeSettings, type CreativeSettings, type KnowledgeSuggestion } from '../../knowledge/schema'
import { eligibleRecipes, library } from '../../knowledge/catalog'
import { extraChordChoices } from '../../music/knowledgeHarmony'
import './knowledge-controls.css'

interface Props { project: MusicProject; update: (change: Partial<MusicProject>) => void; saveStatus: string; onOpenLine?: (kind: 'melody' | 'bass') => void; onBrowseKnowledge?: () => void; suggestion?: KnowledgeSuggestion | null }
const genres = ['Indie pop', 'Pop', 'Rock', 'Funk', 'Reggaetón', 'Trap', 'Hip-hop', 'R&B', 'Jazz', 'Electrónica', 'Música latina']
const moods = ['Nostálgico', 'Alegre', 'Melancólico', 'Enérgico', 'Sereno']

export default function ChordWorkbench({ project, update, saveStatus, onOpenLine, onBrowseKnowledge, suggestion }: Props) {
  const track = project.tracks.find(item => item.kind === 'chords')
  const { parameters } = project
  const [settings, setSettings] = useState(() => ({ key: parameters.key, mode: suggestion?.mode ?? parameters.mode, genre: parameters.genre, mood: parameters.mood, complexity: suggestion?.complexity ?? parameters.complexity, chordType: (track?.chords[0]?.pitches.length ?? 0) >= 5 ? 'extended' as const : track?.chords[0]?.pitches.length === 4 ? 'seventh' as const : 'triad' as const, bars: Math.min(16, Math.max(2, track?.chords.length || 4)), signature: parameters.timeSignature }))
  const [useLibrary, setUseLibrary] = useState(Boolean(suggestion || track?.harmonyKnowledge || !track))
  const [creative, setCreative] = useState<CreativeSettings>(() => ({ ...(track?.harmonyKnowledge?.controls ?? defaultCreativeSettings), ...(suggestion ? { color: suggestion.color } : {}) }))
  const [recipeId, setRecipeId] = useState(suggestion?.id ?? (track?.harmonyKnowledge?.pinned ? track.harmonyKnowledge.recipeId : 'auto'))
  const compatible = eligibleRecipes({ ...settings, controls: creative })
  const applied = library.recipes.find(recipe => recipe.id === track?.harmonyKnowledge?.recipeId)
  const [state, setState] = useState<PlaybackState>('stopped')
  const [starting, setStarting] = useState(false)
  const [loop, setLoop] = useState(false)
  const [activeChord, setActiveChord] = useState(-1)
  const [message, setMessage] = useState('')
  const player = useRef<ChordPlayer | null>(null)
  const beatsPerBar = barBeats(parameters.timeSignature)
  const chords = track?.chords
  const totalBeats = chords?.length ? Math.max(...chords.map(chord => chord.start + chord.duration)) : 0
  const totalSeconds = totalBeats * 60 / parameters.bpm

  useEffect(() => {
    const engine = new ChordPlayer(setState)
    player.current = engine
    return () => { engine.dispose(); player.current = null }
  }, [])
  useEffect(() => { player.current?.configure(chords ?? [], parameters.bpm, false, 0) }, [chords, parameters.bpm])
  useEffect(() => { player.current?.setVolume(track?.muted ? 0 : track?.volume ?? 0.7) }, [track?.muted, track?.volume, chords, parameters.bpm])
  // Loop changes do not rebuild or interrupt the transport.
  useEffect(() => { player.current?.setLoop(loop) }, [loop, chords, parameters.bpm])
  useEffect(() => {
    if (state !== 'playing') return
    const timer = window.setInterval(() => {
      const beat = player.current?.getBeat() ?? 0
      setActiveChord(chords?.findIndex(chord => beat >= chord.start && beat < chord.start + chord.duration) ?? -1)
    }, 60)
    return () => window.clearInterval(timer)
  }, [state, chords])

  const configure = <K extends keyof typeof settings,>(key: K, value: typeof settings[K]) => { setSettings(current => ({ ...current, [key]: value })); if (key === 'mode' || key === 'complexity') setRecipeId('auto') }
  const commit = (next: MusicChord[]) => { if (track) update({ tracks: withChordTrack(project, next, track.name, track.harmonyKnowledge ? { ...track.harmonyKnowledge, edited: true } : undefined) }) }
  const generate = () => {
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0]
      const result = generateProgressionResult({ ...settings, seed, ...(useLibrary ? { knowledge: { controls: creative, ...(recipeId !== 'auto' ? { recipeId } : { avoidRecipeId: track?.harmonyKnowledge?.recipeId }) } } : {}) } satisfies HarmonySettings)
      let next = result.chords
      // Regenerate should actually offer another voicing/progression even when a seed selects the same template.
      if (!useLibrary && track && JSON.stringify(next.map(c => c.pitches)) === JSON.stringify(track.chords.map(c => c.pitches))) next = next.map((chord, index) => index % 2 ? { ...chord, pitches: [...chord.pitches.slice(1), chord.pitches[0] + 12] } : chord)
      update({ parameters: { ...parameters, key: settings.key, mode: settings.mode, genre: settings.genre, mood: settings.mood, complexity: settings.complexity, timeSignature: settings.signature }, tracks: withChordTrack(project, next, `Acordes · ${settings.key} ${settings.mode === 'minor' ? 'menor' : 'mayor'}`, result.knowledge) })
      setMessage('Progresión generada y añadida al proyecto. Puedes editar cada acorde.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo generar la progresión.') }
  }
  const play = async () => {
    setStarting(true)
    try { await player.current?.play(); setMessage('') }
    catch (error) { setMessage(`No se pudo iniciar el audio. ${error instanceof Error ? error.message : 'Comprueba los permisos de sonido y vuelve a pulsar Reproducir.'}`) }
    finally { setStarting(false) }
  }
  const palette = [...Array.from({ length: 7 }, (_, degree) => diatonicChord(parameters.key, parameters.mode, degree, settings.chordType)), ...(useLibrary ? extraChordChoices(parameters.key, parameters.mode, settings.chordType, track?.harmonyKnowledge?.controls.color ?? creative.color, diatonicChord) : [])]
  const choices = palette.filter((chord, index) => palette.findIndex(item => item.symbol === chord.symbol) === index)
  const changeChord = (index: number, choice: number) => {
    if (!chords) return
    commit(chords.map((chord, i) => i === index ? { ...chord, ...choices[choice] } : chord))
  }
  const changeDuration = (index: number, bars: number) => {
    if (!chords) return
    commit(retimeChords(chords.map((chord, i) => i === index ? { ...chord, duration: bars * beatsPerBar } : chord)))
  }

  return <section className="chord-workbench" aria-label="Generador de acordes">
    <p className="chord-save-status" role="status">{saveStatus}</p>
    <div className="chord-intro"><div className="icon-box purple"><Piano size={25}/></div><div><div className="eyebrow">ARMONÍA · MOTOR LOCAL</div><h2>Encuentra el corazón de tu canción.</h2><p>Una progresión para empezar. Tu oído decide lo que viene después.</p></div><span className="ready-tag">Biblioteca · Fase 4.5</span></div>
    <div className="creative-panel"><div className="creative-panel-heading"><label><input type="checkbox" checked={useLibrary} onChange={e => setUseLibrary(e.target.checked)}/>Usar biblioteca creativa</label>{onBrowseKnowledge && <button className="text-button" onClick={onBrowseKnowledge}>Explorar {library.recipes.length + library.resources.length} recursos →</button>}</div>
      {useLibrary && <><p>Combina recetas musicales con tu intención. Los ajustes se aplican al generar; tus acordes actuales se conservan hasta entonces.</p><div className="creative-sliders">{([{ field: 'exploration', label: 'Exploración', hint: 'Familiar ↔ Exploratorio' }, { field: 'tension', label: 'Tensión', hint: 'Estable ↔ Tenso' }, { field: 'movement', label: 'Movimiento armónico', hint: 'Permanencia ↔ Recorrido' }] as const).map(item => <label key={item.field}>{item.label}<span>{creative[item.field]}</span><input aria-label={item.label} type="range" min="0" max="100" step="1" value={creative[item.field]} onChange={e => setCreative(current => ({ ...current, [item.field]: Number(e.target.value) }))}/><small>{item.hint}</small></label>)}</div>
      <div className="creative-choices"><label>Color armónico<select aria-label="Color armónico" value={creative.color} onChange={e => { setCreative(current => ({ ...current, color: e.target.value as CreativeSettings['color'] })); setRecipeId('auto') }}><option value="diatonic">Solo escala base</option><option value="borrowed">Permitir préstamos</option><option value="secondary">Permitir dominantes aplicadas</option><option value="mixed">Explorar ambos colores</option></select></label><label>Receta de partida<select aria-label="Receta de partida" value={recipeId} onChange={e => setRecipeId(e.target.value)}><option value="auto">Automática · {compatible.length} compatibles</option>{recipeId !== 'auto' && !compatible.some(recipe => recipe.id === recipeId) && <option value={recipeId}>Receta incompatible: cambia a Automática</option>}{compatible.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}</select></label><label className="creative-voice"><input type="checkbox" checked={creative.voiceLeading} onChange={e => setCreative(current => ({ ...current, voiceLeading: e.target.checked }))}/>Conducción de voces</label></div><small className="creative-caption">Las escalas de tensión y exploración son criterios de selección, no medidas objetivas de emoción. El color permite opciones; no obliga a usar cromatismos. Exploración, tensión y movimiento orientan la selección automática; una receta fija conserva su recorrido.</small></>}
    </div>
    <div className="chord-config">
      <div className="section-heading"><h3>Diseña tu armonía</h3><span>Sin IA · Sin conexión a servicios</span></div>
      <div className="chord-settings-grid">
        <label>Tonalidad<select aria-label="Tonalidad de acordes" value={settings.key} onChange={e => configure('key', e.target.value as typeof settings.key)}>{keys.map(key => <option key={key}>{key}</option>)}</select></label>
        <label>Modo<select aria-label="Modo de acordes" value={settings.mode} onChange={e => configure('mode', e.target.value as typeof settings.mode)}><option value="major">Mayor</option><option value="minor">Menor natural</option></select></label>
        <label>Género<select aria-label="Género de acordes" value={settings.genre} onChange={e => configure('genre', e.target.value)}>{Array.from(new Set([settings.genre, ...genres])).map(genre => <option key={genre}>{genre}</option>)}</select></label>
        <label>Emoción<select aria-label="Emoción de acordes" value={settings.mood} onChange={e => configure('mood', e.target.value)}>{Array.from(new Set([settings.mood, ...moods])).map(mood => <option key={mood}>{mood}</option>)}</select></label>
        <label>Compases<select aria-label="Número de compases" value={settings.bars} onChange={e => configure('bars', Number(e.target.value))}>{Array.from(new Set([settings.bars, 2, 4, 8, 12, 16])).sort((a, b) => a - b).map(bars => <option key={bars} value={bars}>{bars} compases</option>)}</select></label>
        <label>Complejidad<select aria-label="Complejidad armónica" value={settings.complexity} onChange={e => configure('complexity', e.target.value as typeof settings.complexity)}><option value="simple">Sencilla</option><option value="intermediate">Intermedia</option><option value="advanced">Avanzada · inversiones</option></select></label>
        <label>Tipo de acorde<select aria-label="Tipo de acorde" value={settings.chordType} onChange={e => configure('chordType', e.target.value as typeof settings.chordType)}><option value="triad">Tríadas</option><option value="seventh">Séptimas</option><option value="extended">Extensiones · novenas</option></select></label>
        <label>Compás<select aria-label="Compás de acordes" value={settings.signature.join('/')} onChange={e => configure('signature', e.target.value.split('/').map(Number) as typeof settings.signature)}>{Array.from(new Set([settings.signature.join('/'), '4/4', '3/4', '6/8', '2/4', '5/4', '7/8'])).map(signature => <option key={signature}>{signature}</option>)}</select></label>
      </div>
      <div className="generate-row"><p>Estos ajustes se aplican al generar. Regenerar reemplaza esta progresión.</p><button className="button primary" onClick={generate}>{chords?.length ? <RefreshCw size={15}/> : <Sparkles size={15}/>} {chords?.length ? 'Regenerar progresión' : 'Generar progresión'}</button></div>
    </div>
    {message && <p className="chord-message" role="status">{message}</p>}
    {track?.harmonyKnowledge && <div className="applied-recipe"><div className="eyebrow">RECURSO DE PARTIDA · BIBLIOTECA V{track.harmonyKnowledge.libraryVersion}</div><h3>{applied?.title ?? track.harmonyKnowledge.recipeId}</h3><p>{applied?.explanation ?? 'Este recurso no está en la colección instalada. Tus notas se conservan.'}</p>{applied && <><p className="recipe-practice">Prueba: {applied.practice}</p><small>Un acorde por compás al generar; el ciclo de {applied.steps.length} compases se repite o se recorta según la longitud elegida. Un recorte puede dejar una llegada pendiente.</small></>}<small>{track.harmonyKnowledge.edited ? 'Progresión editada manualmente: esta referencia describe el punto de partida.' : 'Notas construidas localmente a partir de esta receta.'} Los préstamos y dominantes pueden usar notas fuera de la escala base.</small></div>}
    {!track || !chords?.length ? <div className="chord-empty"><AudioBars/><h3>Tu armonía está por sonar.</h3><p>Elige tus parámetros y genera tu primera progresión.<br/>Después podrás escucharla, editarla y llevarla a tu DAW.</p></div> : <>
      <div className="section-heading"><div><h3>Tu progresión <span className="progression-key">{parameters.key} {parameters.mode === 'major' ? 'mayor' : 'menor natural'}</span></h3></div><span>{Number((totalBeats / beatsPerBar).toFixed(2))} compases · {totalSeconds.toFixed(1)} s</span></div>
      <p className="chord-help">Cada tarjeta es un acorde. Cambia su grado o duración para rehacer el recorrido. Notas mostradas con equivalentes en sostenidos.</p>
      <div className="chord-grid">{chords.map((chord, index) => {
        const selected = choices.findIndex(choice => choice.symbol === chord.symbol)
        const durationBars = chord.duration / beatsPerBar
        const playing = state === 'playing' && activeChord === index
        return <article key={chord.id + index} className={`chord-tile ${playing ? 'sounding' : ''}`}>
          <div className="chord-tile-top"><span>ACORDE {String(index + 1).padStart(2, '0')}</span><span>{playing ? 'SONANDO' : `Inicio ${Number((chord.start / beatsPerBar + 1).toFixed(2))}`}</span></div>
          <h4>{chord.symbol}</h4><span className="roman-degree">{chord.degree}</span>
          <div className="chord-notes">{chord.pitches.map((pitch, i) => <span key={i}>{midiToNote(pitch)}</span>)}</div>
          <label>Grado<select aria-label={`Acorde ${index + 1}`} value={selected < 0 ? 'original' : selected} onChange={e => { if (e.target.value !== 'original') changeChord(index, Number(e.target.value)) }}>{selected < 0 && <option value="original">Original: {chord.symbol}</option>}{choices.map((choice, degree) => <option key={degree} value={degree}>{choice.degree} · {choice.symbol}</option>)}</select></label>
          <label>Duración<select aria-label={`Duración del acorde ${index + 1}`} value={durationBars} onChange={e => changeDuration(index, Number(e.target.value))}>{Array.from(new Set([durationBars, 0.5, 1, 2, 4])).sort((a, b) => a - b).map(bars => <option key={bars} value={bars}>{Number(bars.toFixed(3))} {bars === 1 ? 'compás' : 'compases'}</option>)}</select></label>
        </article>
      })}</div>
      <div className="chord-transport"><div className="transport-buttons"><button className="button primary" disabled={starting} onClick={() => void play()}><Play size={16}/>{starting ? 'Iniciando…' : state === 'paused' ? 'Reanudar' : 'Reproducir'}</button><button className="transport-icon" aria-label="Pausar" disabled={state !== 'playing'} onClick={() => player.current?.pause()}><Pause size={17}/></button><button className="transport-icon" aria-label="Detener" onClick={() => player.current?.stop()}><Square size={15}/></button><button className={`transport-icon ${loop ? 'enabled' : ''}`} aria-label="Repetir progresión" aria-pressed={loop} onClick={() => setLoop(value => !value)}><Repeat2 size={18}/></button></div>
        <label className="tempo-control">BPM<input aria-label="Tempo de reproducción" type="number" min={30} max={300} defaultValue={parameters.bpm} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} onBlur={e => { const bpm = Number(e.target.value); if (Number.isInteger(bpm) && bpm >= 30 && bpm <= 300) update({ parameters: { ...parameters, bpm } }); else e.target.value = String(parameters.bpm) }}/></label>
        <label className="volume-control"><Volume2 size={16}/><input aria-label="Volumen de acordes" type="range" min="0" max="1" step="0.01" value={track.volume} onChange={e => { const volume = Number(e.target.value); player.current?.setVolume(track.muted ? 0 : volume); update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, volume } : item) }) }}/></label>
        <button className="button secondary midi-download" onClick={() => { try { downloadChordsMidi(project, track); setMessage('MIDI de acordes preparado: notas reales, tempo, compás y canal de la pista.') } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo exportar MIDI.') } }}><ArrowDownToLine size={16}/>Descargar MIDI</button>
      </div>
      {track.muted && <p className="chord-message">La pista importada está silenciada. <button className="text-button" onClick={() => update({ tracks: project.tracks.map(item => item.id === track.id ? { ...item, muted: false } : item) })}>Activar sonido</button></p>}
      <div className="playback-info" aria-live="polite"><span><span className={`status-dot ${state === 'playing' ? 'playing-dot' : ''}`}/>{state === 'playing' ? 'Reproduciendo' : state === 'paused' ? 'En pausa' : 'Detenido'} · Sintetizador de preview</span><span><Headphones size={13}/> Editar acordes o tempo detiene la reproducción.</span></div>
      <div className="chord-next"><Piano size={18}/><p>Esta pista ya forma parte de tu proyecto. Usa sus acordes como punto de partida para tu melodía y bajo.</p>{onOpenLine && <div className="chord-next-actions"><button className="button secondary" onClick={() => onOpenLine('melody')}>Crear melodía</button><button className="button secondary" onClick={() => onOpenLine('bass')}>Crear bajo</button></div>}</div>
    </>}
  </section>
}

function AudioBars() { return <div className="empty-audio-bars" aria-hidden="true">{[18, 34, 50, 28, 42, 62, 40, 24, 45, 32, 18].map((height, i) => <span key={i} style={{ height }}/>)}</div> }
