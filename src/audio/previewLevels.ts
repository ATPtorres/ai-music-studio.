import type { SoundId, TrackKind } from '../sounds/catalog'

// Gain trims measured with real offline Web Audio, identical notes and velocity.
// Preserve each envelope and MIDI velocity; the user's track fader remains independent.
const chordTrim: Partial<Record<SoundId, number>> = {
  'electric-piano': 6.5, pad: 1.4, strings: 4.8, 'acoustic-guitar': 4.2, 'electric-guitar': -2.8,
}
const bassTrim: Partial<Record<SoundId, number>> = { 'electric-bass': 8.5, 'synth-bass': 0.3, 'acoustic-bass': 4.8 }
export function previewTrimDb(kind: Exclude<TrackKind, 'drums'>, sound: SoundId): number {
  return (kind === 'chords' ? chordTrim[sound] : kind === 'bass' ? bassTrim[sound] : 0) ?? 0
}
