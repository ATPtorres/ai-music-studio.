import { drumPatternSchema, type DrumPattern, type MusicNote, type MusicProject, type MusicTrack } from '../models/project'
import { drumMap, barBeats } from './theory'
import { chordsToNotes, randomFromSeed } from './harmony'

export const drumLanes = [
  { id: 'kick', name: 'Kick', detail: 'Bombo', pitch: drumMap.kick },
  { id: 'snare', name: 'Snare', detail: 'Caja', pitch: drumMap.snare },
  { id: 'clap', name: 'Clap', detail: 'Palmada', pitch: drumMap.clap },
  { id: 'closedHat', name: 'Hi-hat', detail: 'Cerrado', pitch: drumMap.closedHat },
  { id: 'openHat', name: 'Open hat', detail: 'Abierto', pitch: drumMap.openHat },
  { id: 'shaker', name: 'Shaker', detail: 'Maracas GM', pitch: drumMap.shaker },
] as const
export type DrumLane = typeof drumLanes[number]['id']
export const drumGenres = drumPatternSchema.shape.genre.options
export function stepsPerBar(signature: DrumPattern['signature']) { return barBeats(signature) * 4 }
export function drumPatternEnd(pattern: DrumPattern) { return pattern.bars * barBeats(pattern.signature) }

/** Musical event times are quarter-note beats. Odd sixteenths are delayed by swing. */
export function drumPatternNotes(input: DrumPattern): MusicNote[] {
  const pattern = drumPatternSchema.parse(input)
  const count = stepsPerBar(pattern.signature)
  const notes = drumLanes.flatMap(lane => pattern.lanes[lane.id].flatMap((velocity, index) => velocity ? [{ pitch: lane.pitch, start: index * 0.25 + (index % count % 2 ? pattern.swing * 0.25 : 0), duration: 0.06, velocity }] : []))
  return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch)
}

/** Templates are broad genre grooves, not reproductions of specific recordings. */
export function generateDrumPattern(genre: DrumPattern['genre'], bars: number, signature: DrumPattern['signature'], swing = 0, seed = 0): DrumPattern {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Semilla no válida.')
  const count = stepsPerBar(signature)
  if (!Number.isInteger(count) || count < 1 || bars < 1 || bars > 8 || !Number.isInteger(bars)) throw new Error('Compases o longitud de patrón no válidos.')
  const lanes = Object.fromEntries(drumLanes.map(lane => [lane.id, Array(count * bars).fill(0)])) as DrumPattern['lanes']
  const random = randomFromSeed(seed)
  // Sixteen-step reference patterns are scaled to the selected meter; 6/8 uses compound accents.
  const templates: Record<DrumPattern['genre'], { kick: number[]; snare: number[]; clap?: number[]; hats: number[]; open?: number[]; shaker?: number[] }> = {
    Pop: { kick: [0, 8, 10], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], open: [14] },
    Rock: { kick: [0, 6, 8], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14] },
    Funk: { kick: [0, 3, 7, 10], snare: [4, 12], hats: [0, 1, 2, 4, 6, 7, 8, 10, 12, 14, 15], open: [10] },
    'Reggaetón': { kick: [0, 8], snare: [3, 6, 11, 14], clap: [6, 14], hats: [0, 2, 4, 6, 8, 10, 12, 14] },
    Trap: { kick: [0, 7, 10], snare: [8], clap: [8], hats: [0, 2, 4, 6, 8, 10, 11, 12, 14, 15] },
    'Hip-hop': { kick: [0, 6, 10], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], shaker: [3, 11] },
    'R&B': { kick: [0, 7, 10], snare: [4, 12], hats: [0, 2, 6, 8, 10, 14], open: [14] },
    Jazz: { kick: [0, 8], snare: [4, 12], hats: [0, 4, 7, 8, 12, 15], open: [4, 12] },
    'Electrónica': { kick: [0, 4, 8, 12], snare: [4, 12], clap: [4, 12], hats: [2, 6, 10, 14], open: [6, 14] },
    'Música latina': { kick: [0, 6, 10], snare: [4, 12], hats: [0, 4, 8, 12], shaker: [0, 2, 3, 6, 8, 10, 11, 14] },
  }
  const template = templates[genre]
  if (!template) throw new Error('Género no compatible.')
  const put = (lane: DrumLane, bar: number, reference: number, velocity: number) => {
    const index = bar * count + Math.min(count - 1, Math.floor(reference * count / 16))
    lanes[lane][index] = Math.max(lanes[lane][index], velocity)
  }
  for (let bar = 0; bar < bars; bar++) {
    for (const value of template.kick) put('kick', bar, value, 105)
    for (const value of template.snare) put('snare', bar, value, 98)
    for (const value of template.clap ?? []) put('clap', bar, value, 83)
    for (const value of template.hats) put('closedHat', bar, value, value % 4 === 0 ? 80 : 65)
    for (const value of template.open ?? []) put('openHat', bar, value, 72)
    for (const value of template.shaker ?? []) put('shaker', bar, value, 68)
    if (signature[1] === 8 && signature[0] % 3 === 0) {
      lanes.kick.fill(0, bar * count, (bar + 1) * count)
      lanes.snare.fill(0, bar * count, (bar + 1) * count)
      lanes.kick[bar * count] = 105
      if (count > 6) lanes.snare[bar * count + 6] = 98
      if (count > 12) lanes.kick[bar * count + 12] = 96
    }
    if (seed && random() < 0.65) put('kick', bar, [5, 7, 13, 15][Math.floor(random() * 4)], 82)
    if (seed && bar === bars - 1) put('snare', bar, 15, 60 + Math.floor(random() * 20))
    for (let step = bar * count; step < (bar + 1) * count; step++) if (lanes.openHat[step]) lanes.closedHat[step] = 0
  }
  return drumPatternSchema.parse({ genre, bars, signature, swing, lanes })
}

export function varyDrumPattern(input: DrumPattern, seed: number): DrumPattern {
  const pattern = drumPatternSchema.parse(input)
  const random = randomFromSeed(seed)
  const lane: DrumLane = random() < 0.5 ? 'kick' : 'closedHat'
  const step = Math.floor(random() * pattern.lanes[lane].length)
  pattern.lanes[lane][step] = pattern.lanes[lane][step] ? 0 : 75 + Math.floor(random() * 30)
  if (lane === 'closedHat' && pattern.lanes.closedHat[step]) pattern.lanes.openHat[step] = 0
  return pattern
}
export function editDrumStep(input: DrumPattern, lane: DrumLane, step: number, velocity: number): DrumPattern {
  const pattern = drumPatternSchema.parse(input)
  if (!drumLanes.some(item => item.id === lane) || !Number.isInteger(step) || step < 0 || step >= pattern.lanes[lane].length || !Number.isInteger(velocity) || velocity < 0 || velocity > 127) throw new Error('Paso o velocidad no válidos.')
  pattern.lanes[lane][step] = velocity
  if (velocity && lane === 'openHat') pattern.lanes.closedHat[step] = 0
  if (velocity && lane === 'closedHat') pattern.lanes.openHat[step] = 0
  return pattern
}
export function withDrumTrack(project: MusicProject, input: DrumPattern): MusicTrack[] {
  const pattern = drumPatternSchema.parse(input)
  const existing = project.tracks.find(track => track.kind === 'drums')
  const track: MusicTrack = { id: existing?.id ?? crypto.randomUUID(), name: existing?.name ?? 'Batería', kind: 'drums', channel: 9, volume: existing?.volume ?? 0.7, muted: existing?.muted ?? false, chords: [], notes: drumPatternNotes(pattern), drumPattern: pattern }
  return existing ? project.tracks.map(item => item.id === existing.id ? track : item) : [...project.tracks, track]
}

/** Repeat an editable cycle to accompany a longer phrase; preserve already-swung times. */
export function repeatDrumNotes(notes: MusicNote[], cycle: number, end: number): MusicNote[] {
  if (!Number.isFinite(cycle) || cycle <= 0 || !Number.isFinite(end) || end <= 0 || end > 4096) throw new Error('La selección supera el límite del preview de batería.')
  const result: MusicNote[] = []
  for (let offset = 0; offset < end - 1e-8; offset += cycle) for (const note of notes) {
    if (note.start + offset >= end) continue
    result.push({ ...note, start: note.start + offset, duration: Math.min(note.duration, end - note.start - offset) })
    if (result.length > 15000) throw new Error('Demasiados golpes para reproducir esta selección.')
  }
  return result
}
export function drumSelection(project: MusicProject, ids: string[]): { tracks: MusicTrack[]; end: number } {
  const selected = project.tracks.filter(track => ids.includes(track.id))
  const drums = selected.find(track => track.kind === 'drums')
  if (!drums) return { tracks: [], end: 0 }
  const base = drums.drumPattern ? drumPatternNotes(drums.drumPattern) : drums.notes
  const beats = barBeats(drums.drumPattern?.signature ?? project.parameters.timeSignature)
  const cycle = drums.drumPattern ? drumPatternEnd(drums.drumPattern) : Math.ceil(base.reduce((end, note) => Math.max(end, note.start + note.duration), 0) / beats) * beats
  if (!cycle) return { tracks: [], end: 0 }
  const others = selected.filter(track => track.id !== drums.id).map(track => ({ ...track, notes: track.kind === 'chords' ? chordsToNotes(track.chords) : track.notes }))
  const otherEnd = others.reduce((end, track) => track.notes.reduce((last, note) => Math.max(last, note.start + note.duration), end), 0)
  const end = Math.max(cycle, Math.ceil(otherEnd / beats) * beats)
  const repeated = repeatDrumNotes(base, cycle, end)
  if (repeated.length + others.reduce((count, track) => count + track.notes.length, 0) > 15000) throw new Error('Demasiadas notas en la selección de acompañamiento.')
  return { tracks: [{ ...drums, notes: repeated, drumPattern: undefined }, ...others], end }
}
