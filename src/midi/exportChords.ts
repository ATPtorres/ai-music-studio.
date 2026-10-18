import { Midi } from '@tonejs/midi'
import { projectSchema, type MusicProject, type MusicTrack } from '../models/project'
import { chordsToNotes } from '../music/harmony'

/** Standard MIDI File: metadata track + piano track, quarter-note tick units. */
export function exportChordsMidi(project: MusicProject, trackId: string): Uint8Array {
  const validated = projectSchema.parse(project)
  const source = validated.tracks.find(track => track.id === trackId && track.kind === 'chords')
  if (!source || !source.chords.length) throw new Error('Genera una progresión antes de exportar.')
  const midi = new Midi()
  midi.header.name = validated.name
  midi.header.setTempo(validated.parameters.bpm)
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [...validated.parameters.timeSignature] }]
  midi.header.update()
  const track = midi.addTrack()
  track.name = source.name
  track.channel = source.channel
  track.instrument.number = 0 // General MIDI acoustic grand piano.
  for (const note of chordsToNotes(source.chords)) {
    const ticks = Math.round(note.start * midi.header.ppq)
    const durationTicks = Math.max(1, Math.round(note.duration * midi.header.ppq))
    if (!Number.isSafeInteger(ticks + durationTicks) || ticks + durationTicks > 0x0fffffff) throw new Error('Los tiempos de la pista exceden el rango de exportación MIDI.')
    track.addNote({ midi: note.pitch, ticks, durationTicks, velocity: note.velocity / 127 })
  }
  return midi.toArray()
}

export function downloadChordsMidi(project: MusicProject, track: MusicTrack): void {
  const bytes = exportChordsMidi(project, track.id)
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'audio/midi' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 70)}-acordes.mid`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
