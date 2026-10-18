import { useState } from 'react'
import type { MusicNote } from '../../models/project'
import { midiToNote } from '../../music/theory'

interface Props { notes: MusicNote[]; low: number; high: number; end: number; beatsPerBar: number; selected: number; onSelect: (index: number) => void; onAdd: (pitch: number, start: number) => void }
export default function PianoRoll({ notes, low, high, end, beatsPerBar, selected, onSelect, onAdd }: Props) {
  const [page, setPage] = useState(0)
  const windowSize = beatsPerBar * 8
  const pages = Math.max(1, Math.ceil(end / windowSize))
  const current = Math.min(page, pages - 1)
  const start = current * windowSize
  const visibleEnd = Math.min(end, start + windowSize)
  const row = 18; const beatWidth = 42; const labelWidth = 46; const top = 26
  const width = Math.max(480, (visibleEnd - start) * beatWidth + labelWidth)
  const height = (high - low + 1) * row + top
  const black = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12)
  return <><div className="roll-pages"><button className="text-button" disabled={current === 0} onClick={() => setPage(current - 1)}>← Anteriores</button><span>Compases {current * 8 + 1}–{Math.ceil(visibleEnd / beatsPerBar)}</span><button className="text-button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Siguientes →</button></div><div className="piano-scroll" tabIndex={0} aria-label="Piano roll desplazable"><svg className="piano-roll" width={width} height={height} aria-label="Piano roll editable" onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left - labelWidth; const y = event.clientY - rect.top - top
    if (x < 0 || y < 0 || x >= (visibleEnd - start) * beatWidth) return
    const pitch = high - Math.floor(y / row)
    if (pitch >= low && pitch <= high) onAdd(pitch, start + Math.floor(x / beatWidth * 2) / 2)
  }}>
    <rect width={width} height={height} fill="var(--studio-white)"/>
    {Array.from({ length: high - low + 1 }, (_, index) => { const pitch = high - index; return <g key={pitch}>
      <rect x={labelWidth} y={top + index * row} width={width - labelWidth} height={row} fill={black(pitch) ? 'var(--studio-blue-soft)' : 'var(--studio-white)'}/>
      <line x1={labelWidth} x2={width} y1={top + index * row} y2={top + index * row} stroke="var(--studio-border)" strokeWidth="0.5"/>
      <rect x="0" y={top + index * row} width={labelWidth - 3} height={row - 1} fill={black(pitch) ? 'var(--studio-blue)' : 'var(--studio-white)'}/>
      <text x="7" y={top + index * row + 12} fill={black(pitch) ? 'var(--studio-white)' : 'var(--studio-ink)'} fontSize="8">{midiToNote(pitch)}</text>
    </g> })}
    {Array.from({ length: Math.ceil((visibleEnd - start) * 2) + 1 }, (_, index) => {
      const beat = index / 2; const bar = Math.abs((beat + start) / beatsPerBar - Math.round((beat + start) / beatsPerBar)) < 1e-8
      return <g key={index}><line x1={labelWidth + beat * beatWidth} x2={labelWidth + beat * beatWidth} y1={top} y2={height} stroke={bar ? 'var(--studio-blue)' : 'var(--studio-border)'} strokeWidth={bar ? 1 : 0.5}/>{bar && <text x={labelWidth + beat * beatWidth + 5} y="16" fill="var(--studio-muted)" fontSize="9">{Math.round((beat + start) / beatsPerBar) + 1}</text>}</g>
    })}
    {notes.map((note, index) => note.start < visibleEnd && note.start + note.duration > start ? <rect key={index} className={`roll-note ${selected === index ? 'selected-note' : ''}`} x={labelWidth + (Math.max(start, note.start) - start) * beatWidth + 1} y={top + (high - note.pitch) * row + 2} width={Math.max(4, (Math.min(visibleEnd, note.start + note.duration) - Math.max(start, note.start)) * beatWidth - 2)} height={row - 4} rx="0" role="button" tabIndex={0} aria-label={`Nota ${index + 1}: ${midiToNote(note.pitch)}, inicio ${note.start}, duración ${Number(note.duration.toFixed(3))}`} aria-pressed={selected === index} onClick={event => { event.stopPropagation(); onSelect(index) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(index) } }}/> : null) }
  </svg></div></>
}
