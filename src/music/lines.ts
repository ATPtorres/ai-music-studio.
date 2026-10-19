import { z } from 'zod'
import { keys, lineOptionsSchema, noteSchema, type MusicNote, type MusicProject, type MusicTrack } from '../models/project'
import { randomFromSeed, type MusicChord } from './harmony'
import { noteToMidi } from './theory'

export type LineKind = 'melody' | 'bass'
export const lineSettingsSchema = lineOptionsSchema.safeExtend({ seed: z.number().int().min(0).max(0xffffffff) })
export type LineSettings = z.infer<typeof lineSettingsSchema>
export function getHarmony(project: MusicProject): MusicChord[] { return project.tracks.find(track => track.kind === 'chords')?.chords ?? [] }
export function harmonyEnd(chords: MusicChord[]) { return chords.reduce((end, chord) => Math.max(end, chord.start + chord.duration), 0) }
/** Provenance checksum, not a security hash. Tempo intentionally excluded. */
export function harmonyFingerprint(project: MusicProject): string {
  const text = JSON.stringify([project.parameters.key, project.parameters.mode, project.parameters.timeSignature, getHarmony(project).map(c => [c.start, c.duration, c.pitches])])
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return `h1:${(hash >>> 0).toString(16)}:${text.length}`
}
export function scalePitches(project: MusicProject, low: number, high: number): number[] {
  const intervals = project.parameters.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]
  const tonic = keys.indexOf(project.parameters.key)
  return Array.from({ length: high - low + 1 }, (_, index) => low + index).filter(pitch => intervals.includes((pitch - tonic + 120) % 12))
}
function chordCandidates(chord: MusicChord, low: number, high: number): number[] {
  const pcs = chord.pitches.map(pitch => pitch % 12)
  return Array.from({ length: high - low + 1 }, (_, index) => low + index).filter(pitch => pcs.includes(pitch % 12))
}
function rootPitchClass(chord: MusicChord): number {
  const match = /^([A-G][#b]?)/.exec(chord.symbol)
  return match ? noteToMidi(`${match[1]}3`) % 12 : chord.pitches[0] % 12
}
function nearest(pitches: number[], target: number): number {
  if (!pitches.length) throw new Error('El registro elegido no contiene notas del acorde. Amplía el rango.')
  return pitches.reduce((best, pitch) => Math.abs(pitch - target) < Math.abs(best - target) ? pitch : best)
}
function validateHarmony(project: MusicProject): MusicChord[] {
  const chords = [...getHarmony(project)].sort((a, b) => a.start - b.start)
  if (!chords.length) throw new Error('Crea primero una progresión en Acordes.')
  if (chords.length > 256 || harmonyEnd(chords) > 4096) throw new Error('La progresión supera el límite de generación de esta versión.')
  if (chords.some((chord, index) => index > 0 && chord.start < chords[index - 1].start + chords[index - 1].duration - 1e-8)) throw new Error('Los acordes se solapan. Usa una progresión consecutiva para generar una línea.')
  return chords
}

export function generateLine(project: MusicProject, kind: LineKind, input: LineSettings): MusicNote[] {
  const settings = lineSettingsSchema.parse(input)
  const chords = validateHarmony(project)
  const random = randomFromSeed(settings.seed)
  const scale = scalePitches(project, settings.low, settings.high)
  const notes: MusicNote[] = []
  let previous = kind === 'bass' ? settings.low + 7 : Math.round((settings.low + settings.high) / 2)
  const baseStep = settings.density === 'sparse' ? 2 : settings.density === 'medium' ? 1 : 0.5
  for (const chord of chords) {
    const chordTones = chordCandidates(chord, settings.low, settings.high)
    if (!chordTones.length) throw new Error('El registro no contiene notas de todos los acordes. Amplía el rango.')
    const root = rootPitchClass(chord)
    const step = settings.rhythm === 'walking' ? Math.max(0.25, baseStep / 2) : baseStep
    for (let offset = 0, event = 0; offset < chord.duration - 1e-8; offset += settings.rhythm === 'sustained' ? chord.duration : step, event++) {
      if (notes.length >= 4096) throw new Error('Demasiadas notas. Reduce la densidad o la longitud de la progresión.')
      const shifted = settings.rhythm === 'syncopated' && event % 2 === 1 ? step / 2 : 0
      const localStart = offset + shifted
      if (localStart >= chord.duration) continue
      const available = Math.min(step - shifted, chord.duration - localStart)
      const anchor = event === 0 || Math.abs(localStart - Math.round(localStart)) < 1e-8
      let candidates = kind === 'melody' && !anchor && settings.complexity !== 'simple' ? scale : chordTones
      if (kind === 'bass' && settings.rhythm !== 'walking') {
        const roots = chordTones.filter(pitch => pitch % 12 === root)
        if (!roots.length) throw new Error('El registro no contiene la fundamental de todos los acordes. Amplía el rango.')
        const fifths = chordTones.filter(pitch => pitch % 12 === (root + 7) % 12)
        candidates = event === 0 || settings.complexity === 'simple' ? roots : event % 2 && fifths.length ? fifths : chordTones
      }
      const wander = settings.complexity === 'simple' ? 3 : settings.complexity === 'intermediate' ? 5 : 9
      const target = previous + Math.round((random() - 0.5) * wander * 2)
      const pitch = nearest(candidates, target)
      const duration = settings.rhythm === 'sustained' ? chord.duration : Math.max(0.01, available * (kind === 'bass' ? 0.8 : 0.9))
      notes.push(noteSchema.parse({ pitch, start: chord.start + localStart, duration: Math.min(duration, chord.duration - localStart), velocity: (anchor ? 94 : 78) + Math.floor(random() * 10) }))
      previous = pitch
    }
  }
  return notes
}

/** Keeps the user's timing and velocities; changes pitches only. */
export function varyLine(project: MusicProject, notes: MusicNote[], input: LineSettings): MusicNote[] {
  const settings = lineSettingsSchema.parse(input)
  const chords = validateHarmony(project)
  const random = randomFromSeed(settings.seed)
  let changed = false
  const result = notes.map(note => {
    const chord = chords.find(item => note.start >= item.start && note.start < item.start + item.duration)
    if (!chord) return { ...note }
    const candidates = chordCandidates(chord, settings.low, settings.high).filter(pitch => pitch !== note.pitch)
    if (!candidates.length || (changed && random() > 0.5)) return { ...note }
    changed = true
    return { ...note, pitch: candidates[Math.floor(random() * candidates.length)] }
  })
  if (!changed) throw new Error('No hay otra nota disponible en este registro. Amplía el rango para crear una variación.')
  return result
}

export function validateLineNotes(notes: MusicNote[], end: number): MusicNote[] {
  if (notes.length > 4096) throw new Error('El editor admite hasta 4096 notas por pista.')
  const sorted = notes.map(note => noteSchema.parse(note)).sort((a, b) => a.start - b.start)
  if (sorted.some(note => note.start + note.duration > end + 1e-8)) throw new Error('La nota debe terminar dentro de la progresión.')
  if (sorted.some((note, i) => i > 0 && note.start < sorted[i - 1].start + sorted[i - 1].duration - 1e-8)) throw new Error('Esta línea es monofónica: las notas no deben solaparse.')
  return sorted
}

export function withLineTrack(project: MusicProject, kind: LineKind, notes: MusicNote[], generation?: z.infer<typeof lineOptionsSchema>): MusicTrack[] {
  const existing = project.tracks.find(track => track.kind === kind)
  const used = new Set(project.tracks.filter(track => track.id !== existing?.id).map(track => track.channel))
  const channel = existing?.channel ?? [kind === 'melody' ? 1 : 2, ...Array.from({ length: 16 }, (_, index) => index)].find(value => value !== 9 && !used.has(value))
  if (channel === undefined) throw new Error('No hay un canal MIDI libre para la pista.')
  const track: MusicTrack = { id: existing?.id ?? crypto.randomUUID(), name: existing?.name ?? (kind === 'melody' ? 'Melodía' : 'Bajo'), kind, channel, muted: existing?.muted ?? false, volume: existing?.volume ?? 0.65, notes, chords: [], ...(existing?.sound ? { sound: existing.sound } : {}), sourceHarmony: harmonyFingerprint(project), ...(generation ?? existing?.generation ? { generation: lineOptionsSchema.parse(generation ?? existing?.generation) } : {}) }
  return existing ? project.tracks.map(item => item.id === existing.id ? track : item) : [...project.tracks, track]
}
