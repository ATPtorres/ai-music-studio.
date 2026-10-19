import { z } from 'zod'

export const soundIds = ['piano', 'electric-piano', 'pad', 'strings', 'acoustic-guitar', 'electric-guitar', 'pluck', 'lead', 'flute', 'electric-bass', 'synth-bass', 'acoustic-bass', 'kit-707', 'kit-808', 'kit-909', 'kit-linn'] as const
export const soundSchema = z.enum(soundIds)
export type SoundId = z.infer<typeof soundSchema>
export type TrackKind = 'chords' | 'melody' | 'bass' | 'drums'
export type DrumSound = Extract<SoundId, `kit-${string}`>
export const sounds: Record<SoundId, { name: string; program: number }> = {
  piano: { name: 'Piano', program: 0 },
  'electric-piano': { name: 'Piano eléctrico', program: 4 },
  pad: { name: 'Pad cálido', program: 89 },
  strings: { name: 'Strings · cuerdas', program: 48 },
  'acoustic-guitar': { name: 'Guitarra acústica', program: 24 },
  'electric-guitar': { name: 'Guitarra eléctrica limpia', program: 27 },
  pluck: { name: 'Pluck', program: 10 },
  lead: { name: 'Lead suave', program: 80 },
  flute: { name: 'Flauta sintética', program: 73 },
  'electric-bass': { name: 'Bajo eléctrico', program: 33 },
  'synth-bass': { name: 'Bajo sintetizado', program: 38 },
  'acoustic-bass': { name: 'Contrabajo', program: 32 },
  'kit-707': { name: '707 · seco y compacto', program: 0 },
  'kit-808': { name: '808 · grave y profundo', program: 25 },
  'kit-909': { name: '909 · pegada electrónica', program: 24 },
  'kit-linn': { name: 'LinnDrum · pop ochentero', program: 8 },
}
export const soundsByKind: Record<TrackKind, readonly SoundId[]> = {
  chords: ['piano', 'electric-piano', 'pad', 'strings', 'acoustic-guitar', 'electric-guitar'],
  melody: ['pluck', 'acoustic-guitar', 'electric-guitar', 'piano', 'lead', 'flute'],
  bass: ['electric-bass', 'synth-bass', 'acoustic-bass'],
  drums: ['kit-707', 'kit-808', 'kit-909', 'kit-linn'],
}
export const defaultSounds: Record<TrackKind, SoundId> = { chords: 'piano', melody: 'lead', bass: 'electric-bass', drums: 'kit-707' }
export function resolveSound(kind: TrackKind, sound?: SoundId): SoundId {
  const chosen = sound ?? defaultSounds[kind]
  if (!soundsByKind[kind].includes(chosen)) throw new Error('El sonido no es compatible con este tipo de pista.')
  return chosen
}
export function midiProgram(track: { kind: TrackKind; sound?: SoundId }) { return sounds[resolveSound(track.kind, track.sound)].program }
