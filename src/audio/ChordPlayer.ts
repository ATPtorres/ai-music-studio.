import * as Tone from 'tone'
import { createMelodicVoice, type MelodicVoice } from './MelodicVoice'
import type { SoundId } from '../sounds/catalog'
import type { MusicChord } from '../music/harmony'

export type PlaybackState = 'stopped' | 'playing' | 'paused'
/** One transport owner. Audio nodes are created only after a user gesture. */
export class ChordPlayer {
  private synth?: MelodicVoice
  private gain?: Tone.Gain
  private part?: Tone.Part<{ pitches: number[]; duration: number }>
  private endId?: number
  private initialized = false
  private disposed = false
  private request = 0
  private chords: MusicChord[] = []
  private sound?: SoundId
  private bpm = 100
  private looping = false
  private volume = 0.7
  state: PlaybackState = 'stopped'

  constructor(private onState: (state: PlaybackState) => void) {}

  configure(chords: MusicChord[], bpm: number, loop: boolean, volume: number, sound?: SoundId) {
    this.stop()
    this.chords = chords
    this.bpm = bpm
    this.looping = loop
    this.volume = volume
    this.sound = sound
  }

  private build() {
    this.initialized = true // Allows stop() to release partially built nodes if setup fails.
    const transport = Tone.getTransport()
    transport.stop()
    transport.ticks = 0
    transport.bpm.value = this.bpm
    transport.loop = this.looping
    const end = Math.max(...this.chords.map(chord => chord.start + chord.duration))
    transport.loopStart = 0
    transport.loopEnd = `${end * transport.PPQ}i`
    this.gain = new Tone.Gain(this.volume).toDestination()
    this.synth = createMelodicVoice('chords', this.sound, this.gain)
    this.part = new Tone.Part((time, chord: { pitches: number[]; duration: number }) => {
      this.synth?.triggerAttackRelease(chord.pitches.map(pitch => Tone.Frequency(pitch, 'midi').toFrequency()), chord.duration * 60 / this.bpm, time, 0.7)
    }, this.chords.map(chord => ({ time: `${chord.start * transport.PPQ}i`, pitches: chord.pitches, duration: chord.duration }))).start(0)
    this.endId = transport.schedule(time => { if (!this.looping) { transport.stop(time); Tone.getDraw().schedule(() => this.finish(), time) } }, `${end * transport.PPQ}i`)
  }

  async play() {
    if (this.disposed || !this.chords.length || this.state === 'playing') return
    if (this.chords.length > 256 || this.chords.some(chord => !Number.isFinite(chord.start + chord.duration) || chord.start + chord.duration > 65536)) throw new Error('La pista supera el límite del preview de acordes.')
    const request = ++this.request
    await Tone.start()
    if (this.disposed || request !== this.request) return
    if (!this.initialized) {
      try { this.build() }
      catch (error) { this.stop(); throw error }
    }
    const transport = Tone.getTransport()
    const beat = transport.ticks / transport.PPQ
    if (this.state === 'paused') {
      for (const chord of this.chords) {
        if (chord.start < beat && chord.start + chord.duration > beat) this.synth?.triggerAttackRelease(chord.pitches.map(pitch => Tone.Frequency(pitch, 'midi').toFrequency()), (chord.start + chord.duration - beat) * 60 / this.bpm, Tone.now(), 0.7)
      }
    }
    transport.start()
    this.state = 'playing'
    this.onState(this.state)
  }

  pause() {
    if (this.state !== 'playing') return
    Tone.getTransport().pause()
    this.synth?.releaseAll()
    this.state = 'paused'
    this.onState(this.state)
  }

  private finish() { if (!this.disposed) { this.state = 'stopped'; this.onState(this.state) } }

  stop() {
    this.request++
    if (this.initialized) {
      const transport = Tone.getTransport()
      transport.stop()
      transport.ticks = 0
      if (this.endId !== undefined) transport.clear(this.endId)
      this.part?.dispose()
      this.synth?.dispose()
      this.gain?.dispose()
      this.initialized = false
    }
    this.finish()
  }

  setLoop(value: boolean) { this.looping = value; if (this.initialized) Tone.getTransport().loop = value }
  setVolume(value: number) { this.volume = value; if (this.gain) this.gain.gain.rampTo(value, 0.03) }
  getBeat() { return this.initialized ? Tone.getTransport().ticks / Tone.getTransport().PPQ : 0 }
  dispose() { this.stop(); this.disposed = true }
}
