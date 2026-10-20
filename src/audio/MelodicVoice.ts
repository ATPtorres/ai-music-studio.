import * as Tone from 'tone'
import { resolveSound, type SoundId, type TrackKind } from '../sounds/catalog'
import { previewTrimDb } from './previewLevels'

/** Common polyphonic interface: every preset can play chords and sustained resumes. */
export interface MelodicVoice {
  triggerAttackRelease(notes: number | number[], duration: number, time: number, velocity: number): unknown
  releaseAll(): unknown
  dispose(): unknown
}
export function createMelodicVoice(kind: Exclude<TrackKind, 'drums'>, sound: SoundId | undefined, output: Tone.Gain): MelodicVoice {
  const id = resolveSound(kind, sound)
  const volume = (kind === 'chords' ? -19 : -13) + previewTrimDb(kind, id)
  let voice: Tone.PolySynth<Tone.Synth> | Tone.PolySynth<Tone.FMSynth> | Tone.PolySynth<Tone.MonoSynth>
  if (id === 'piano' || id === 'electric-piano' || id === 'electric-bass') {
    const electric = id === 'electric-piano'
    const bass = id === 'electric-bass'
    voice = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: electric ? 3 : 1, modulationIndex: electric ? 2.5 : bass ? 0.5 : 1.1,
      oscillator: { type: 'sine' }, modulation: { type: electric ? 'sine' : 'triangle' },
      envelope: { attack: 0.003, decay: bass ? 0.45 : 1.3, sustain: bass ? 0.18 : 0.04, release: bass ? 0.1 : 0.24 },
      modulationEnvelope: { attack: 0.002, decay: electric ? 0.9 : 0.2, sustain: 0, release: 0.1 }, volume,
    })
  } else if (id === 'pad' || id === 'strings') {
    const pad = id === 'pad'
    voice = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'fatsawtooth', count: pad ? 3 : 2, spread: pad ? 14 : 7 },
      envelope: { attack: pad ? 0.35 : 0.12, decay: 0.3, sustain: 0.65, release: pad ? 0.7 : 0.3 },
      filter: { type: 'lowpass', rolloff: -12, Q: 0.5 },
      filterEnvelope: { attack: 0.2, decay: 0.4, sustain: 0.5, release: 0.5, baseFrequency: pad ? 500 : 1400, octaves: 1.5 }, volume: volume - 5,
    })
  } else if (id === 'acoustic-guitar' || id === 'electric-guitar' || id === 'pluck' || id === 'acoustic-bass' || id === 'synth-bass') {
    const electric = id === 'electric-guitar'
    const bass = id === 'acoustic-bass' || id === 'synth-bass'
    voice = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: id === 'synth-bass' ? 'sawtooth' : electric ? 'square' : 'triangle' },
      envelope: { attack: 0.002, decay: id === 'pluck' ? 0.24 : electric ? 0.7 : 0.55, sustain: electric ? 0.13 : id === 'synth-bass' ? 0.35 : 0, release: electric ? 0.16 : 0.09 },
      filter: { type: 'lowpass', rolloff: -12, Q: electric ? 1 : 0.5 },
      filterEnvelope: { attack: 0.001, decay: electric ? 0.3 : 0.16, sustain: id === 'synth-bass' ? 0.2 : 0, release: 0.1, baseFrequency: bass ? 150 : id === 'pluck' ? 900 : 650, octaves: bass ? 3 : electric ? 2.5 : 4 }, volume: volume - 3,
    })
  } else {
    voice = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: id === 'flute' ? 0.08 : 0.01, decay: id === 'flute' ? 0.2 : 0.12, sustain: id === 'flute' ? 0.7 : 0.35, release: id === 'flute' ? 0.18 : 0.08 }, volume,
    })
  }
  try { voice.connect(output); return voice }
  catch (error) { voice.dispose(); throw error }
}
