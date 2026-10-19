import { Midi } from '@tonejs/midi'
import { parseMidi, writeMidi } from 'midi-file'
import type { MusicProject } from '../models/project'
import { renderArrangement } from '../arrangement/render'

/** The same rendered events feed preview and SMF; source generators are never rerun here. */
export function exportArrangementMidi(project: MusicProject): Uint8Array {
  const arrangement = renderArrangement(project)
  const sources = arrangement.tracks.filter(track => track.notes.length)
  if (!sources.length) throw new Error('Vincula al menos una pista con notas para exportar el arreglo.')
  if (new Set(sources.map(track => track.channel)).size !== sources.length) throw new Error('Hay pistas del arreglo con el mismo canal MIDI. Cambia sus canales en la mezcla; si son dos baterías, desvincula una para exportar.')
  const midi = new Midi()
  midi.header.name = project.name
  midi.header.setTempo(project.parameters.bpm)
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [...project.parameters.timeSignature] }]
  midi.header.meta = arrangement.sections.map(section => ({ type: 'marker', text: section.name, ticks: Math.round(section.start * midi.header.ppq) }))
  midi.header.update()
  for (const source of sources) {
    const track = midi.addTrack()
    track.name = source.name; track.channel = source.channel
    track.instrument.number = source.kind === 'bass' ? 33 : source.kind === 'melody' ? 80 : 0
    for (const note of source.notes) {
      const ticks = Math.round(note.start * midi.header.ppq)
      const section = arrangement.sections.find(item => note.start >= item.start && note.start < item.end)!
      const room = Math.round(section.end * midi.header.ppq) - ticks
      if (room <= 0) throw new Error('Una nota es demasiado próxima al límite de sección para representarla en MIDI. Ajusta su inicio en el editor.')
      track.addNote({ midi: note.pitch, ticks, durationTicks: Math.min(room, Math.max(1, Math.round((note.start + note.duration) * midi.header.ppq) - ticks)), velocity: note.velocity / 127 })
    }
  }
  // @tonejs/midi ignores endOfTrackTicks on encoding. Preserve silent final sections
  // by setting the SMF End Of Track time explicitly, without inventing a note.
  const data = parseMidi(midi.toArray())
  const endTicks = Math.round(arrangement.end * midi.header.ppq)
  for (const events of data.tracks) {
    const last = events.reduce((ticks, event) => ticks + event.deltaTime, 0)
    events[events.length - 1].deltaTime += Math.max(0, endTicks - last)
  }
  return new Uint8Array(writeMidi(data))
}
export function downloadArrangementMidi(project: MusicProject) {
  const bytes = exportArrangementMidi(project)
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'audio/midi' }))
  const link = document.createElement('a')
  link.href = url; link.download = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 60)}-arreglo.mid`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
