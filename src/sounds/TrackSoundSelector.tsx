import type { MusicTrack } from '../models/project'
import { resolveSound, sounds, soundsByKind, type SoundId, type TrackKind } from './catalog'
import './sounds.css'

const labels: Record<TrackKind, string> = { chords: 'Sonido de acordes', melody: 'Sonido de melodía', bass: 'Sonido de bajo', drums: 'Máquina de batería' }
interface Props { track?: MusicTrack; kind: TrackKind; onChange: (sound: SoundId) => void; label?: string; compact?: boolean }
export default function TrackSoundSelector({ track, kind, onChange, label = labels[kind], compact = false }: Props) {
  return <div className={`sound-selector${compact ? ' compact' : ''}`}><label>{label}<select aria-label={label} disabled={!track} value={resolveSound(kind, track?.sound)} onChange={event => onChange(event.target.value as SoundId)}>{soundsByKind[kind].map(id => <option value={id} key={id}>{sounds[id].name}</option>)}</select></label>{!compact && <p>{!track ? 'Genera una pista para elegir su sonido. ' : ''}{kind === 'drums' ? 'Kits de síntesis inspirados en estas máquinas. La elección conserva tu patrón.' : 'Timbres de síntesis; piano, cuerdas y guitarras son aproximaciones. La elección conserva tus notas.'} Cambiar el sonido detiene el preview.</p>}</div>
}
