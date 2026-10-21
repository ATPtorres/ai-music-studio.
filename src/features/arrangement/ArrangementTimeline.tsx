import type { CSSProperties } from 'react'
import { AudioLines, Disc3, Guitar, Piano } from 'lucide-react'
import type { MusicProject } from '../../models/project'
import type { TimelineSection } from '../../arrangement/render'
import { instrumentNames, instrumentOrder } from '../../arrangement/variants'
import { barBeats } from '../../music/theory'

const icons = { drums: Disc3, bass: Guitar, chords: Piano, melody: AudioLines }
interface Props {
  project: MusicProject; timeline: TimelineSection[]; selected?: string; current?: string
  beat: number; playing: boolean; zoom: number
  select: (id: string) => void
  assign: (sectionId: string, trackId: string, variant: string | null) => void
  advanced?: boolean
  openLibrary: (trackId: string, variantId: string) => void
}
export default function ArrangementTimeline({ project, timeline, selected, current, beat, playing, zoom, select, assign, openLibrary, advanced = true }: Props) {
  const tracks = instrumentOrder.flatMap(kind => project.tracks.filter(track => track.kind === kind))
  return <><p className="mobile-scroll-hint">Desliza la línea de tiempo para recorrer tu canción. También puedes elegir las frases en el editor de sección.</p><div className="arrangement-scroll" tabIndex={0} aria-label="Línea de tiempo desplazable"><div className="gantt-canvas" style={{ '--bar-width': `${zoom}px` } as CSSProperties}>
    <table className="arrangement-timeline"><colgroup><col className="gantt-label-column"/>{timeline.map(item => <col key={item.id} style={{ width: item.bars * zoom }}/>)}</colgroup>
      <thead><tr><th scope="col"><strong>Tu canción</strong><span>Instrumentos / compases</span></th>{timeline.map(item => <th scope="col" key={item.id} className={playing && current === item.id ? 'section-playing' : ''}><button title={`${item.name}: ${item.bars} compases`} aria-pressed={selected === item.id} onClick={() => select(item.id)}><strong>{item.name || 'Sin nombre'}</strong><span>{item.bars} compases</span></button><div className="gantt-ruler" aria-label={`Compases ${item.firstBar} a ${item.firstBar + item.bars - 1}`}>{Array.from({ length: Math.ceil(item.bars / (item.bars > 64 ? 8 : 1)) }, (_, i) => <span key={i} style={{ left: i * (item.bars > 64 ? 8 : 1) * zoom }}>{item.firstBar + i * (item.bars > 64 ? 8 : 1)}</span>)}</div></th>)}</tr></thead>
      <tbody>{tracks.map(track => { const Icon = icons[track.kind]; return <tr key={track.id} className="instrument-theme" data-instrument={track.kind}><th scope="row"><button className="gantt-instrument" disabled={!advanced} onClick={() => openLibrary(track.id, '')}><Icon size={18}/><span><strong>{instrumentNames[track.kind]}</strong><small>{track.name}</small></span></button></th>{timeline.map(item => {
        const section = project.sections[item.index]
        const linked = section.trackIds.includes(track.id)
        const variantId = section.variantIds?.[track.id] ?? ''
        const name = variantId ? track.variants?.find(v => v.id === variantId)?.name ?? 'Variante ausente' : 'V1 · Original'
        return <td key={item.id} className={selected === item.id ? 'gantt-selected' : ''}><div className={`gantt-slot ${linked ? 'gantt-active' : ''}`}><label className="gantt-clip-label"><span className="sr-only">{track.name} en {item.name}</span><select title={linked ? `${instrumentNames[track.kind]} · ${name}` : 'Añadir instrumento'} aria-label={`Frase ${track.name} en sección ${item.index + 1}: ${item.name}`} value={linked ? variantId : '__silence'} onChange={e => { select(item.id); assign(item.id, track.id, e.target.value === '__silence' ? null : e.target.value) }}><option value="__silence">＋ Silencio</option><option value="">V1 · Original</option>{track.variants?.map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>{linked && <button className="gantt-edit" hidden={!advanced} aria-label={`Editar ${name} de ${track.name} en ${item.name}`} onClick={() => { select(item.id); openLibrary(track.id, variantId); requestAnimationFrame(() => document.getElementById('variant-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}>Editar frase</button>}</div></td>
      })}</tr> })}</tbody>
    </table>
    {playing && <div className="gantt-playhead" data-testid="gantt-playhead" style={{ left: `calc(var(--gantt-label) + ${beat / barBeats(project.parameters.timeSignature) * zoom}px)` }} aria-hidden="true"><span/></div>}
    {!tracks.length && <p className="arrangement-help gantt-no-tracks">Todavía no hay pistas. Usa Abrir generadores para crear acordes, melodía, bajo o batería.</p>}
  </div></div></>
}
