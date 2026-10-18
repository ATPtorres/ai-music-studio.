import * as Tone from 'tone'
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
  constructor(output: Tone.Gain) {
    try {
      this.kick = new Tone.MembraneSynth({ pitchDecay: 0.035, octaves: 5, envelope: { attack: 0.001, decay: 0.17, sustain: 0, release: 0.04 }, volume: -10 })
      this.resources.push(this.kick)
      this.kick.connect(output)
      const noise = (frequency: number, decay: number, volume: number, type: 'highpass' | 'bandpass' = 'highpass') => {
        const filter = new Tone.Filter(frequency, type)
        this.resources.push(filter)
        filter.connect(output)
        const synth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay, sustain: 0, release: 0.015 }, volume })
        this.resources.push(synth)
        synth.connect(filter)
        return synth
      }
      this.snare = noise(1100, 0.12, -17)
      this.clap = noise(1800, 0.09, -15, 'bandpass')
      this.closed = noise(7000, 0.035, -22)
      this.open = noise(6500, 0.22, -22)
      this.shaker = noise(4000, 0.045, -24)
    } catch (error) { this.dispose(); throw error }
  }
  trigger(pitch: number, time: number, velocity: number) {
    switch (pitch) {
      case drumMap.kick: this.kick.triggerAttackRelease('C1', 0.12, time, velocity); break
      case drumMap.snare: this.snare.triggerAttackRelease(0.08, time, velocity); break
      case drumMap.clap: this.clap.triggerAttackRelease(0.06, time, velocity); break
      case drumMap.closedHat: this.open.triggerRelease(time); this.closed.triggerAttackRelease(0.025, time, velocity); break
      case drumMap.openHat: this.open.triggerAttackRelease(0.2, time, velocity); break
      case drumMap.shaker: this.shaker.triggerAttackRelease(0.04, time, velocity); break
    }
  }
  releaseAll() { for (const instrument of [this.kick, this.snare, this.clap, this.closed, this.open, this.shaker]) instrument.triggerRelease() }
  dispose() { for (const resource of this.resources.reverse()) resource.dispose(); this.resources = [] }
}
