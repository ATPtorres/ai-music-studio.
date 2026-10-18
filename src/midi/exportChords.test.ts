import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { parseMidi } from 'midi-file'
import { createProject } from '../models/project'
import { generateProgression, withChordTrack } from '../music/harmony'
import { exportChordsMidi } from './exportChords'

function fixture(signature: [number, 4 | 8] = [4, 4]) {
  const project = createProject()
  project.parameters.bpm = 90
  project.parameters.timeSignature = signature
  const chords = generateProgression({ key: 'A', mode: 'minor', bars: 4, signature, genre: 'Pop', mood: 'Nostálgico', complexity: 'simple', chordType: 'seventh', seed: 42 })
  project.tracks = withChordTrack(project, chords, 'Acordes')
  project.tracks[0].channel = 2
  return project
}
describe('Archivo MIDI real', () => {
  it('produce cabecera SMF y metadata de tempo/compás', () => {
    const project = fixture([6, 8])
    const bytes = exportChordsMidi(project, project.tracks[0].id)
    expect(Array.from(bytes.slice(0, 4))).toEqual([77, 84, 104, 100]) // MThd
    const parsed = parseMidi(bytes)
    expect(parsed.header.format).toBe(1)
    expect(parsed.header.ticksPerBeat).toBe(480)
    expect(parsed.tracks.flat().find(event => event.type === 'setTempo')).toMatchObject({ microsecondsPerBeat: 666666 })
    expect(parsed.tracks.flat().find(event => event.type === 'timeSignature')).toMatchObject({ numerator: 6, denominator: 8 })
  })
  it('escribe Note On/Off balanceados con canal, pitches y tiempos correctos', () => {
    const project = fixture()
    const parsed = parseMidi(exportChordsMidi(project, project.tracks[0].id))
    const noteTrack = parsed.tracks.find(events => events.some(event => event.type === 'noteOn'))!
    let ticks = 0
    const active = new Map<number, number>()
    let starts = 0
    let ends = 0
    for (const event of noteTrack) {
      ticks += event.deltaTime
      if (event.type === 'noteOn') { expect(event.channel).toBe(2); expect(event.velocity).toBeGreaterThan(0); expect(active.has(event.noteNumber)).toBe(false); active.set(event.noteNumber, ticks); starts++ }
      if (event.type === 'noteOff') { expect(event.channel).toBe(2); expect(ticks - active.get(event.noteNumber)!).toBe(4 * 480); active.delete(event.noteNumber); ends++ }
    }
    expect(starts).toBe(16)
    expect(ends).toBe(starts)
    expect(active.size).toBe(0)
    expect(ticks).toBe(16 * 480)
  })
  it('conserva notas y duración en segundos al leer el MIDI exportado', () => {
    for (const signature of [[4, 4], [3, 4], [6, 8]] as [number, 4 | 8][]) {
      const project = fixture(signature)
      const imported = new Midi(exportChordsMidi(project, project.tracks[0].id))
      expect(imported.tracks[0].notes.map(note => note.midi).sort()).toEqual(project.tracks[0].notes.map(note => note.pitch).sort())
      expect(imported.duration).toBeCloseTo(4 * signature[0] * 4 / signature[1] * 60 / 90, 4)
      expect(imported.tracks[0].notes.every(note => note.durationTicks > 0)).toBe(true)
    }
  })
  it('exporta las duraciones editadas y rechaza pistas vacías', () => {
    const project = fixture()
    project.tracks[0].chords[0].duration = 0.5
    const imported = new Midi(exportChordsMidi(project, project.tracks[0].id))
    expect(imported.tracks[0].notes[0].durationTicks).toBe(240)
    expect(() => exportChordsMidi(createProject(), 'missing')).toThrow(/Genera/)
    project.tracks[0].chords[0].start = Number.MAX_SAFE_INTEGER
    expect(() => exportChordsMidi(project, project.tracks[0].id)).toThrow(/rango/)
  })
})
