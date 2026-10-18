import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { parseMidi } from 'midi-file'
import { createProject } from '../models/project'
import { generateProgression, withChordTrack } from '../music/harmony'
import { generateLine, withLineTrack } from '../music/lines'
import { exportTracksMidi } from './exportTracks'

function fixture() {
  const project = createProject()
  project.parameters.timeSignature = [6, 8]
  project.parameters.bpm = 105
  project.tracks = withChordTrack(project, generateProgression({ key: 'A', mode: 'minor', bars: 4, signature: [6, 8], genre: 'Pop', mood: 'Alegre', complexity: 'simple', chordType: 'triad', seed: 10 }), 'Acordes')
  for (const kind of ['melody', 'bass'] as const) project.tracks = withLineTrack(project, kind, generateLine(project, kind, { low: kind === 'bass' ? 28 : 60, high: kind === 'bass' ? 52 : 84, density: 'dense', rhythm: 'syncopated', complexity: 'advanced', seed: 2 }))
  return project
}
describe('MIDI de melodías, bajos y acompañamiento', () => {
  it('conserva cada nota, canal, programa, velocidad y duración en la exportación individual', () => {
    const project = fixture()
    for (const source of project.tracks.slice(1)) {
      const midi = new Midi(exportTracksMidi(project, [source.id]))
      expect(midi.tracks).toHaveLength(1)
      expect(midi.tracks[0].channel).toBe(source.channel)
      expect(midi.tracks[0].instrument.number).toBe(source.kind === 'bass' ? 33 : 80)
      expect(midi.header.timeSignatures[0].timeSignature).toEqual([6, 8])
      expect(midi.header.tempos[0].bpm).toBeCloseTo(105, 3)
      expect(midi.tracks[0].notes).toHaveLength(source.notes.length)
      midi.tracks[0].notes.forEach((note, i) => {
        expect(note.midi).toBe(source.notes[i].pitch)
        expect(note.ticks).toBe(Math.round(source.notes[i].start * 480))
        expect(note.durationTicks).toBe(Math.round(source.notes[i].duration * 480))
        expect(note.velocity * 127).toBeCloseTo(source.notes[i].velocity, 0)
      })
    }
  })
  it('escribe tres pistas sincronizadas con Note On/Off balanceados por canal', () => {
    const project = fixture()
    const bytes = exportTracksMidi(project, project.tracks.map(track => track.id))
    const parsed = parseMidi(bytes)
    expect(parsed.header.format).toBe(1)
    const tracks = parsed.tracks.filter(events => events.some(event => event.type === 'noteOn'))
    expect(tracks).toHaveLength(3)
    for (const events of tracks) {
      const active = new Set<string>()
      for (const event of events) {
        if (event.type === 'noteOn') { const id = `${event.channel}:${event.noteNumber}`; expect(active.has(id)).toBe(false); active.add(id) }
        if (event.type === 'noteOff') { const id = `${event.channel}:${event.noteNumber}`; expect(active.has(id)).toBe(true); active.delete(id) }
      }
      expect(active.size).toBe(0)
    }
  })
  it('no silencia el MIDI al bajar el volumen y rechaza selecciones vacías o canales duplicados', () => {
    const project = fixture()
    const source = project.tracks[1]
    source.muted = true; source.volume = 0
    expect(new Midi(exportTracksMidi(project, [source.id])).tracks[0].notes).toHaveLength(source.notes.length)
    expect(() => exportTracksMidi(createProject(), [])).toThrow()
    expect(() => exportTracksMidi(project, ['missing'])).toThrow()
    project.tracks[2].channel = source.channel
    expect(() => exportTracksMidi(project, project.tracks.map(track => track.id))).toThrow(/canal/)
  })
})
