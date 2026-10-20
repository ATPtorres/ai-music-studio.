import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { createProject, trackSchema, type MusicProject, type MusicTrack } from '../models/project'
import { parseProject } from '../services/persistence'
import { withChordTrack } from '../music/harmony'
import { withLineTrack } from '../music/lines'
import { generateDrumPattern, withDrumTrack } from '../music/drums'
import { renderArrangement } from '../arrangement/render'
import { exportTracksMidi } from '../midi/exportTracks'
import { exportChordsMidi } from '../midi/exportChords'
import { exportArrangementMidi } from '../midi/exportArrangement'
import { defaultSounds, midiProgram, resolveSound, soundIds, soundsByKind, type SoundId, type TrackKind } from './catalog'
function fixture(): MusicProject {
  let project = createProject()
  project.tracks = withChordTrack(project, [{ id: 'c', symbol: 'C', degree: 'I', start: 0, duration: 4, pitches: [60, 64, 67] }], 'Acordes')
  for (const kind of ['melody', 'bass'] as const) project.tracks = withLineTrack(project, kind, [{ pitch: kind === 'bass' ? 36 : 72, start: 0, duration: 1, velocity: 90 }])
  project = { ...project, tracks: withDrumTrack(project, generateDrumPattern('Pop', 1, [4, 4], 0.2)) }
  project.sections = [{ id: 'section', name: 'Verso', bars: 2, trackIds: project.tracks.map(track => track.id), lyrics: 'Una letra' }]
  return project
}
describe('Catálogo de sonidos y compatibilidad de proyectos', () => {
  it('retira piano de Acordes y LinnDrum de Batería sin perder proyectos antiguos', () => {
    expect(soundsByKind.chords).not.toContain('piano')
    expect(soundsByKind.melody).toContain('piano')
    expect(soundsByKind.drums).toEqual(['kit-707', 'kit-808', 'kit-909'])
    const old = fixture(); old.tracks[0].sound = 'piano'; old.tracks[3].sound = 'kit-linn'
    const restored = parseProject(JSON.stringify(old))
    expect(restored).toEqual(old)
    expect(resolveSound('chords', restored.tracks[0].sound)).toBe('electric-piano')
    expect(resolveSound('drums', restored.tracks[3].sound)).toBe('kit-707')
    expect(new Midi(exportChordsMidi(restored, restored.tracks[0].id)).tracks[0].instrument.number).toBe(4)
  })
  it('valida cada opción permitida y rechaza sonidos ajenos al tipo de pista', () => {
    const project = fixture()
    expect(soundIds).toHaveLength(new Set(soundIds).size)
    for (const track of project.tracks) {
      for (const sound of soundsByKind[track.kind]) expect(trackSchema.safeParse({ ...track, sound }).success).toBe(true)
      const incompatible = track.kind === 'drums' ? 'piano' : 'kit-808'
      expect(trackSchema.safeParse({ ...track, sound: incompatible }).success).toBe(false)
      expect(() => resolveSound(track.kind, incompatible)).toThrow(/compatible/)
      expect(trackSchema.safeParse({ ...track, sound: 'unknown-synth' }).success).toBe(false)
    }
  })
  it('abre proyectos anteriores sin añadir campos y guarda los nuevos sonidos en JSON v1', () => {
    const old = fixture()
    expect(parseProject(JSON.stringify(old))).toEqual(old)
    expect(old.tracks.every(track => !('sound' in track))).toBe(true)
    old.tracks.forEach(track => { track.sound = soundsByKind[track.kind].at(-1)! })
    const recovered = parseProject(JSON.stringify(old))
    expect(recovered).toEqual(old); expect(recovered.version).toBe(1)
    for (const track of recovered.tracks) expect(resolveSound(track.kind, track.sound)).toBe(track.sound)
    expect(defaultSounds).toEqual({ chords: 'electric-piano', melody: 'lead', bass: 'electric-bass', drums: 'kit-707' })
  })
  it('conserva selección al regenerar acordes, líneas y batería y al renderizar el arreglo', () => {
    const project = fixture()
    const choices: Record<TrackKind, SoundId> = { chords: 'strings', melody: 'pluck', bass: 'synth-bass', drums: 'kit-linn' }
    project.tracks.forEach(track => { track.sound = choices[track.kind] })
    project.tracks = withChordTrack(project, project.tracks[0].chords, 'Acordes')
    for (const kind of ['melody', 'bass'] as const) project.tracks = withLineTrack(project, kind, project.tracks.find(t => t.kind === kind)!.notes)
    project.tracks = withDrumTrack(project, generateDrumPattern('Rock', 2, [4, 4], 0.3))
    expect(project.tracks.map(track => track.sound)).toEqual(['strings', 'pluck', 'synth-bass', 'kit-linn'])
    const rendered = renderArrangement(project)
    expect(rendered.tracks.map(track => track.sound)).toEqual(project.tracks.map(track => track.sound))
    expect(project.sections[0].lyrics).toBe('Una letra')
  })
})
describe('Programas MIDI según el sonido de la pista', () => {
  const expected: Record<SoundId, number> = { piano: 0, 'electric-piano': 4, pad: 89, strings: 48, 'acoustic-guitar': 24, 'electric-guitar': 27, pluck: 10, lead: 80, flute: 73, 'electric-bass': 33, 'synth-bass': 38, 'acoustic-bass': 32, 'kit-707': 0, 'kit-808': 25, 'kit-909': 24, 'kit-linn': 8 }
  it('escribe programas y kits GM sin cambiar canales, pitches ni velocidades', () => {
    const project = fixture()
    for (const source of project.tracks) for (const sound of soundsByKind[source.kind]) {
      const chosen: MusicTrack = { ...source, sound }
      const next = { ...project, tracks: project.tracks.map(track => track.id === source.id ? chosen : track) }
      const midi = new Midi(exportTracksMidi(next, [source.id]))
      const original = new Midi(exportTracksMidi(project, [source.id]))
      expect(midi.tracks[0].instrument.number).toBe(expected[sound])
      expect(midi.tracks[0].channel).toBe(source.channel)
      expect(midi.tracks[0].notes.map(n => [n.midi, n.ticks, n.durationTicks, n.velocity])).toEqual(original.tracks[0].notes.map(n => [n.midi, n.ticks, n.durationTicks, n.velocity]))
      if (source.kind === 'chords') expect(new Midi(exportChordsMidi(next, source.id)).tracks[0].instrument.number).toBe(expected[sound])
    }
  })
  it('aplica los sonidos al MIDI completo y mantiene los programas previos sin selección', () => {
    const project = fixture()
    expect(project.tracks.map(midiProgram)).toEqual([4, 80, 33, 0])
    project.tracks.forEach((track, i) => { track.sound = (['pad', 'acoustic-guitar', 'synth-bass', 'kit-808'] as const)[i] })
    const midi = new Midi(exportArrangementMidi(project))
    expect(midi.tracks.map(track => track.instrument.number)).toEqual([89, 24, 38, 25])
    expect(midi.tracks.map(track => track.channel)).toEqual([0, 1, 2, 9])
  })
})
