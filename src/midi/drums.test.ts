import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { parseMidi } from 'midi-file'
import { createProject } from '../models/project'
import { drumPatternNotes, drumSelection, generateDrumPattern, withDrumTrack } from '../music/drums'
import { exportTracksMidi } from './exportTracks'

describe('MIDI de batería', () => {
  it('exporta canal 10, mapa GM, velocidad y swing dentro de los eventos reales', () => {
    const project = createProject()
    const pattern = generateDrumPattern('Funk', 1, [4, 4], 0.4)
    project.tracks = withDrumTrack(project, pattern)
    const source = project.tracks[0]
    source.notes = [] // Metadata is authoritative, just as with chord pitches.
    const bytes = exportTracksMidi(project, [source.id])
    const parsed = parseMidi(bytes)
    expect(parsed.tracks.flat().filter(event => event.type === 'noteOn').every(event => event.channel === 9)).toBe(true)
    const midi = new Midi(bytes)
    const expected = drumPatternNotes(pattern)
    expect(midi.tracks[0].notes).toHaveLength(expected.length)
    const actual = midi.tracks[0].notes.map(note => [note.midi, note.ticks, note.durationTicks, Math.round(note.velocity * 127)]).sort()
    expect(actual).toEqual(expected.map(note => [note.pitch, Math.round(note.start * 480), Math.round(note.duration * 480), note.velocity]).sort())
    expect(expected.some(note => Math.round(note.start * 480) % 120 !== 0)).toBe(true)
  })
  it('conserva el compás 6/8 y Note On/Off balanceados por instrumento', () => {
    const project = createProject()
    project.parameters.timeSignature = [6, 8]
    project.tracks = withDrumTrack(project, generateDrumPattern('Jazz', 2, [6, 8], 0.6))
    const bytes = exportTracksMidi(project, [project.tracks[0].id])
    expect(new Midi(bytes).header.timeSignatures[0].timeSignature).toEqual([6, 8])
    const parsed = parseMidi(bytes)
    const active = new Set<number>()
    for (const event of parsed.tracks.flat()) {
      if (event.type === 'noteOn') { expect(active.has(event.noteNumber)).toBe(false); active.add(event.noteNumber) }
      if (event.type === 'noteOff') { expect(active.has(event.noteNumber)).toBe(true); active.delete(event.noteNumber) }
    }
    expect(active.size).toBe(0)
  })
  it('exporta las repeticiones usadas en el preview con acompañamiento', () => {
    const project = createProject()
    project.tracks = withDrumTrack(project, generateDrumPattern('Pop', 1, [4, 4], 0.2))
    const count = project.tracks[0].notes.length
    project.tracks.push({ id: 'melody', kind: 'melody', name: 'Melodía', channel: 1, volume: 0.5, muted: false, chords: [], notes: [{ pitch: 69, start: 7, duration: 0.5, velocity: 90 }] })
    const selected = drumSelection(project, project.tracks.map(track => track.id))
    const midi = new Midi(exportTracksMidi({ ...project, tracks: selected.tracks }, selected.tracks.map(track => track.id)))
    expect(midi.tracks.find(track => track.channel === 9)!.notes).toHaveLength(count * 2)
    expect(midi.tracks.find(track => track.channel === 1)!.notes[0].ticks).toBe(7 * 480)
  })
})
