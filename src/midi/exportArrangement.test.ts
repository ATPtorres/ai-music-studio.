import { Midi } from '@tonejs/midi'
import { parseMidi } from 'midi-file'
import { describe, expect, it } from 'vitest'
import { createProject, type MusicProject } from '../models/project'
import { generateProgression, withChordTrack } from '../music/harmony'
import { generateLine, withLineTrack } from '../music/lines'
import { generateDrumPattern, withDrumTrack } from '../music/drums'
import { renderArrangement } from '../arrangement/render'
import { exportArrangementMidi } from './exportArrangement'
function fixture(): MusicProject {
  const project = createProject(); project.parameters.bpm = 120; project.parameters.timeSignature = [6, 8]
  project.tracks = withChordTrack(project, generateProgression({ key: 'A', mode: 'minor', bars: 2, signature: [6, 8], genre: 'Pop', mood: 'Sereno', complexity: 'simple', chordType: 'triad', seed: 2 }), 'Acordes')
  for (const kind of ['melody', 'bass'] as const) project.tracks = withLineTrack(project, kind, generateLine(project, kind, { low: kind === 'bass' ? 36 : 60, high: kind === 'bass' ? 48 : 72, density: 'medium', rhythm: 'straight', complexity: 'simple', seed: 3 }))
  project.tracks = withDrumTrack(project, generateDrumPattern('Pop', 1, [6, 8], 0.4))
  project.sections = [{ id: 'verse', name: 'Verse', bars: 3, trackIds: project.tracks.map(t => t.id), lyrics: 'Texto conservado' }, { id: 'end', name: 'Silence', bars: 2, trackIds: [], lyrics: '' }]
  return project
}
describe('MIDI del arreglo completo', () => {
  it('exporta las mismas notas que el preview con tempo, compás, canales y programas', () => {
    const project = fixture(); const rendered = renderArrangement(project)
    const midi = new Midi(exportArrangementMidi(project))
    expect(midi.tracks).toHaveLength(4)
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([6, 8]); expect(midi.header.tempos[0].bpm).toBe(120)
    for (const [index, track] of midi.tracks.entries()) {
      const source = rendered.tracks[index]
      expect(track.channel).toBe(source.channel)
      expect(track.notes).toHaveLength(source.notes.length)
      expect(track.instrument.number).toBe(source.kind === 'melody' ? 80 : source.kind === 'bass' ? 33 : source.kind === 'chords' ? 4 : 0)
      for (const [i, note] of track.notes.entries()) {
        const actual = source.notes[i]
        expect(note.midi).toBe(actual.pitch)
        expect(note.ticks).toBe(Math.round(actual.start * midi.header.ppq))
        expect(note.durationTicks).toBe(Math.round((actual.start + actual.duration) * midi.header.ppq) - Math.round(actual.start * midi.header.ppq))
        expect(note.velocity * 127).toBeCloseTo(actual.velocity, 0)
      }
    }
  })
  it('conserva silencio final, marcadores y Note On/Off balanceados en el SMF real', () => {
    const parsed = parseMidi(exportArrangementMidi(fixture()))
    expect(parsed.header.format).toBe(1)
    const ppq = parsed.header.ticksPerBeat!
    const markers: { text: string; ticks: number }[] = []
    for (const events of parsed.tracks) {
      let ticks = 0
      const active = new Set<string>()
      for (const event of events) {
        ticks += event.deltaTime
        if (event.type === 'marker') markers.push({ text: event.text, ticks })
        if (event.type === 'noteOn') { const key = `${event.channel}:${event.noteNumber}`; expect(active.has(key)).toBe(false); active.add(key) }
        if (event.type === 'noteOff') { const key = `${event.channel}:${event.noteNumber}`; expect(active.has(key)).toBe(true); active.delete(key) }
      }
      expect(ticks).toBe(15 * ppq); expect(active.size).toBe(0)
    }
    expect(markers).toEqual([{ text: 'Verse', ticks: 0 }, { text: 'Silence', ticks: 9 * ppq }])
  })
  it('mantiene velocidades y notas silenciadas; rechaza canales duplicados y arreglos sin sonido', () => {
    const project = fixture(); const original = exportArrangementMidi(project)
    project.tracks.forEach(track => { track.volume = 0; track.muted = true })
    expect(exportArrangementMidi(project)).toEqual(original)
    project.tracks[1].channel = project.tracks[0].channel
    expect(() => exportArrangementMidi(project)).toThrow(/canal MIDI/)
    expect(() => exportArrangementMidi(createProject())).toThrow(/Vincula/)
    const silent = fixture(); silent.sections.forEach(s => { s.trackIds = [] })
    expect(() => exportArrangementMidi(silent)).toThrow(/Vincula/)
  })
  it('rechaza una nota que redondea fuera del límite de sección en vez de exportar fuera de tiempo', () => {
    const project = createProject()
    project.tracks = [{ id: 'tiny', name: 'Importada', kind: 'melody', channel: 1, muted: false, volume: 1, chords: [], notes: [{ pitch: 60, start: 3.9999, duration: 0.00005, velocity: 100 }] }]
    project.sections = [{ id: 'section', name: 'Una', bars: 1, trackIds: ['tiny'], lyrics: '' }]
    expect(() => exportArrangementMidi(project)).toThrow(/límite de sección/)
  })

})
