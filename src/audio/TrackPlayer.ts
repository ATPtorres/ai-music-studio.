import * as Tone from 'tone'
import { noteSchema, type MusicNote } from '../models/project'
import type { PlaybackState } from './ChordPlayer'
import { DrumKit } from './DrumKit'

export interface PreviewTrack { id: string; kind: 'chords' | 'melody' | 'bass' | 'drums'; notes: MusicNote[]; volume: number; muted: boolean }
interface Voice { synth?: Tone.PolySynth; drums?: DrumKit; gain: Tone.Gain; part?: Tone.Part<{ time: string; note: MusicNote }> }
/** Owns the transport while a line/drum workbench is mounted. */
export class TrackPlayer {
  private tracks: PreviewTrack[] = []
  private voices = new Map<string, Voice>()
  private endId?: number
  private initialized = false
  private disposed = false
  private request = 0
  private bpm = 100
  private end = 0
  private loop = false
  state: PlaybackState = 'stopped'
  constructor(private onState: (state: PlaybackState) => void) {}

  configure(tracks: PreviewTrack[], bpm: number, end: number) {
    this.stop()
    this.tracks = tracks.map(track => ({ ...track }))
    this.bpm = bpm
    this.end = end
  }
  private attack(voice: Voice, note: MusicNote, time: number, duration = note.duration) {
    if (voice.drums) voice.drums.trigger(note.pitch, time, note.velocity / 127)
    else voice.synth?.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi').toFrequency(), duration * 60 / this.bpm, time, note.velocity / 127)
  }
  private build() {
    this.initialized = true
    const transport = Tone.getTransport()
    transport.stop(); transport.ticks = 0; transport.bpm.value = this.bpm
    transport.loop = this.loop; transport.loopStart = 0; transport.loopEnd = `${this.end * transport.PPQ}i`
    for (const track of this.tracks) {
      const gain = new Tone.Gain(track.muted ? 0 : track.volume).toDestination()
      // Register each resource before building the next one so failures can be cleaned up.
      const voice: Voice = { gain }
      this.voices.set(track.id, voice)
      if (track.kind === 'drums') voice.drums = new DrumKit(gain)
      else {
        voice.synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: track.kind === 'melody' ? 'sine' : 'triangle' }, envelope: { attack: 0.01, decay: 0.12, sustain: 0.35, release: 0.08 }, volume: track.kind === 'chords' ? -19 : -13 })
        voice.synth.connect(gain)
      }
      voice.part = new Tone.Part((time, event: { time: string; note: MusicNote }) => this.attack(voice, event.note, time), track.notes.map(note => ({ time: `${note.start * transport.PPQ}i`, note }))).start(0)
    }
    this.endId = transport.schedule(time => {
      if (!this.loop) { transport.stop(time); Tone.getDraw().schedule(() => { if (!this.disposed) { this.state = 'stopped'; this.onState(this.state) } }, time) }
    }, `${this.end * transport.PPQ}i`)
  }
  async play() {
    if (this.disposed || this.state === 'playing' || !this.tracks.some(track => track.notes.length)) return
    if (!Number.isFinite(this.end) || this.end <= 0 || this.end > 65536 || this.bpm < 30 || this.bpm > 300 || this.tracks.length > 4 || this.tracks.reduce((count, track) => count + track.notes.length, 0) > 15000) throw new Error('La selección supera el límite del preview.')
    for (const track of this.tracks) for (const note of track.notes) { noteSchema.parse(note); if (note.start + note.duration > this.end + 1e-8) throw new Error('Una nota excede el final del preview.') }
    const request = ++this.request
    await Tone.start()
    if (this.disposed || request !== this.request) return
    if (!this.initialized) { try { this.build() } catch (error) { this.stop(); throw error } }
    const beat = this.getBeat()
    if (this.state === 'paused') for (const track of this.tracks) {
      const voice = this.voices.get(track.id)!
      if (track.kind !== 'drums') for (const note of track.notes) if (note.start < beat && note.start + note.duration > beat) this.attack(voice, note, Tone.now(), note.start + note.duration - beat)
    }
    Tone.getTransport().start(); this.state = 'playing'; this.onState(this.state)
  }
  pause() {
    if (this.state !== 'playing') return
    Tone.getTransport().pause()
    for (const voice of this.voices.values()) { voice.synth?.releaseAll(); voice.drums?.releaseAll() }
    this.state = 'paused'; this.onState(this.state)
  }
  stop() {
    this.request++
    if (this.initialized) {
      const transport = Tone.getTransport(); transport.stop(); transport.ticks = 0
      if (this.endId !== undefined) transport.clear(this.endId)
      for (const voice of this.voices.values()) { voice.part?.dispose(); voice.synth?.dispose(); voice.drums?.dispose(); voice.gain.dispose() }
      this.voices.clear(); this.initialized = false; this.endId = undefined
    }
    if (!this.disposed) { this.state = 'stopped'; this.onState(this.state) }
  }
  setLoop(loop: boolean) { this.loop = loop; if (this.initialized) Tone.getTransport().loop = loop }
  setMix(id: string, volume: number, muted: boolean) {
    const track = this.tracks.find(item => item.id === id)
    if (track) { track.volume = volume; track.muted = muted }
    this.voices.get(id)?.gain.gain.rampTo(muted ? 0 : volume, 0.03)
  }
  getBeat() { return this.initialized ? Tone.getTransport().ticks / Tone.getTransport().PPQ : 0 }
  dispose() { this.stop(); this.disposed = true }
}
