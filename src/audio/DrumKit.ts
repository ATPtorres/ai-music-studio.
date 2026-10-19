import * as Tone from 'tone'
import { drumProfiles } from './drumProfiles'
import type { DrumSound } from '../sounds/catalog'
import { drumMap } from '../music/theory'

/** Lightweight, synthesized percussion. MIDI numbers select drums, not pitched notes. */
export class DrumKit {
  private resources: { dispose: () => unknown }[] = []
  private kick: Tone.MembraneSynth
  private snare: Tone.NoiseSynth
  private clap: Tone.NoiseSynth
  private closed: Tone.NoiseSynth
  private open: Tone.NoiseSynth
  private shaker: Tone.NoiseSynth
  private profile
  constructor(output: Tone.Gain, sound: DrumSound = 'kit-707') {
    this.profile = drumProfiles[sound]
    if (!this.profile) throw new Error('Kit de batería desconocido.')
    const profile = this.profile
    try {
      this.kick = new Tone.MembraneSynth({ pitchDecay: profile.kick.pitchDecay, octaves: profile.kick.octaves, envelope: { attack: 0.001, decay: profile.kick.decay, sustain: 0, release: profile.kick.release }, volume: profile.kick.volume })
      this.resources.push(this.kick)
      this.kick.connect(output)
      const noise = (frequency: number, decay: number, volume: number, type: 'highpass' | 'bandpass' = 'highpass') => {
        const filter = new Tone.Filter(frequency, type)
        this.resources.push(filter)
        filter.connect(output)
        const synth = new Tone.NoiseSynth({ noise: { type: profile.noise }, envelope: { attack: 0.001, decay, sustain: 0, release: 0.015 }, volume })
        this.resources.push(synth)
        synth.connect(filter)
        return synth
      }
      this.snare = noise(...profile.snare)
      this.clap = noise(...profile.clap, 'bandpass')
      this.closed = noise(...profile.closed)
      this.open = noise(...profile.open)
      this.shaker = noise(...profile.shaker)
    } catch (error) { this.dispose(); throw error }
  }
  trigger(pitch: number, time: number, velocity: number) {
    switch (pitch) {
      case drumMap.kick: this.kick.triggerAttackRelease(this.profile.kick.note, this.profile.kick.duration, time, velocity); break
      case drumMap.snare: this.snare.triggerAttackRelease(this.profile.snare[1] * 0.67, time, velocity); break
      case drumMap.clap: this.clap.triggerAttackRelease(this.profile.clap[1] * 0.67, time, velocity); break
      case drumMap.closedHat: this.open.triggerRelease(time); this.closed.triggerAttackRelease(this.profile.closed[1] / 0.035 * 0.025, time, velocity); break
      case drumMap.openHat: this.open.triggerAttackRelease(this.profile.open[1] / 0.22 * 0.2, time, velocity); break
      case drumMap.shaker: this.shaker.triggerAttackRelease(this.profile.shaker[1] / 0.045 * 0.04, time, velocity); break
    }
  }
  releaseAll() { for (const instrument of [this.kick, this.snare, this.clap, this.closed, this.open, this.shaker]) instrument.triggerRelease() }
  dispose() { for (const resource of this.resources.reverse()) resource.dispose(); this.resources = [] }
}
