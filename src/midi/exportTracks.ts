import { midiProgram } from '../sounds/catalog'
import { Midi } from '@tonejs/midi'
import { projectSchema, type MusicProject } from '../models/project'
import { chordsToNotes } from '../music/harmony'
import { drumPatternNotes } from '../music/drums'

/** Shared phase-3 exporter: selected tracks only, with their own channels/programs. */
export function exportTracksMidi(project: MusicProject, ids: string[]): Uint8Array {
  const valid = projectSchema.parse(project)
  const tracks = valid.tracks.filter(track => ids.includes(track.id))
  if (!tracks.length || new Set(ids).size !== tracks.length) throw new Error('Selecciona pistas existentes para exportar.')
  if (new Set(tracks.map(track => track.channel)).size !== tracks.length) throw new Error('Las pistas seleccionadas comparten un canal MIDI. Exporta cada pista por separado.')
  const midi = new Midi()
  midi.header.name = valid.name
  midi.header.setTempo(valid.parameters.bpm)
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [...valid.parameters.timeSignature] }]
  midi.header.update()
  for (const source of tracks) {
    const notes = source.kind === 'chords' ? chordsToNotes(source.chords) : source.kind === 'drums' && source.drumPattern ? drumPatternNotes(source.drumPattern) : source.notes
    if (!notes.length) throw new Error(`La pista ${source.name} está vacía.`)
    const track = midi.addTrack()
    track.name = source.name
    track.channel = source.channel
    track.instrument.number = midiProgram(source)
    for (const note of notes) {
      const ticks = Math.round(note.start * midi.header.ppq)
      const durationTicks = Math.max(1, Math.round(note.duration * midi.header.ppq))
      if (!Number.isSafeInteger(ticks + durationTicks) || ticks + durationTicks > 0x0fffffff) throw new Error('Los tiempos exceden el rango MIDI.')
      track.addNote({ midi: note.pitch, ticks, durationTicks, velocity: note.velocity / 127 })
    }
  }
  return midi.toArray()
}
export function downloadTracksMidi(project: MusicProject, ids: string[], label: string) {
  const bytes = exportTracksMidi(project, ids)
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'audio/midi' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 60)}-${label}.mid`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
