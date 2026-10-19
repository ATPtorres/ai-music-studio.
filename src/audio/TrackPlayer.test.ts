import { beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({
  start: vi.fn<() => Promise<void>>(),
  transport: { PPQ: 192, ticks: 0, bpm: { value: 100 }, loop: false, loopStart: 0 as number | string, loopEnd: 0 as number | string, stop: vi.fn(), start: vi.fn(), pause: vi.fn(), clear: vi.fn(), schedule: vi.fn() },
  voices: [] as { attack: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
  gains: [] as { ramp: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
  parts: [] as { callback: (time: number, value: { time: string; note: { pitch: number; duration: number; velocity: number } }) => void; events: { time: string; note: { pitch: number; duration: number; velocity: number } }[]; dispose: ReturnType<typeof vi.fn> }[],
  failPart: false,
  drumHit: vi.fn(), drumRelease: vi.fn(), drumDispose: vi.fn(),
}))
vi.mock('./DrumKit', () => ({ DrumKit: class { trigger = fake.drumHit; releaseAll = fake.drumRelease; dispose = fake.drumDispose } }))
vi.mock('tone', () => ({
  start: fake.start, getTransport: () => fake.transport, getDraw: () => ({ schedule: (callback: () => void) => callback() }), now: () => 0,
  Frequency: (pitch: number) => ({ toFrequency: () => pitch }), Synth: class {}, FMSynth: class {}, MonoSynth: class {},
  Gain: class { gain; dispose = vi.fn(); constructor() { const ramp = vi.fn(); this.gain = { rampTo: ramp }; fake.gains.push({ ramp, dispose: this.dispose }) }; toDestination() { return this } },
  PolySynth: class { triggerAttackRelease = vi.fn(); releaseAll = vi.fn(); dispose = vi.fn(); constructor() { fake.voices.push({ attack: this.triggerAttackRelease, release: this.releaseAll, dispose: this.dispose }) }; connect() { return this } },
  Part: class { dispose = vi.fn(); constructor(callback: typeof fake.parts[number]['callback'], events: typeof fake.parts[number]['events']) { if (fake.failPart) throw new Error('Part falló'); fake.parts.push({ callback, events, dispose: this.dispose }) }; start() { return this } },
}))
import { TrackPlayer, type PreviewTrack } from './TrackPlayer'
const tracks: PreviewTrack[] = [
  { id: 'c', kind: 'chords', notes: [{ pitch: 57, start: 0, duration: 4, velocity: 88 }], volume: 0.6, muted: false },
  { id: 'm', kind: 'melody', notes: [{ pitch: 69, start: 0, duration: 0.9, velocity: 100 }], volume: 0.7, muted: false },
  { id: 'b', kind: 'bass', notes: [{ pitch: 33, start: 0, duration: 0.8, velocity: 90 }], volume: 0.5, muted: false },
]
describe('Preview sincronizado (audio simulado)', () => {
  beforeEach(() => { vi.clearAllMocks(); fake.voices.length = 0; fake.gains.length = 0; fake.parts.length = 0; fake.failPart = false; fake.start.mockResolvedValue(); fake.transport.schedule.mockReturnValue(8); fake.transport.ticks = 0 })
  it('agenda las pistas con un solo reloj y convierte negras a segundos y velocidad', async () => {
    const player = new TrackPlayer(vi.fn())
    player.configure(tracks, 120, 4)
    await player.play()
    expect(fake.transport.start).toHaveBeenCalledOnce()
    expect(fake.parts).toHaveLength(3)
    expect(fake.parts.map(part => part.events[0].time)).toEqual(['0i', '0i', '0i'])
    expect(fake.transport.loopEnd).toBe('768i')
    fake.parts[0].callback(5, fake.parts[0].events[0])
    expect(fake.voices[0].attack).toHaveBeenCalledWith(57, 2, 5, 88 / 127)
    player.dispose()
  })
  it('reanuda solamente las notas todavía activas sin perder la posición', async () => {
    const player = new TrackPlayer(vi.fn())
    player.configure(tracks, 120, 4)
    await player.play()
    fake.transport.ticks = 192
    player.pause()
    expect(fake.voices.every(voice => voice.release.mock.calls.length === 1)).toBe(true)
    expect(player.getBeat()).toBe(1)
    await player.play()
    expect(fake.voices[0].attack).toHaveBeenCalledWith(57, 1.5, 0, 88 / 127)
    expect(fake.voices[1].attack).not.toHaveBeenCalled()
    expect(fake.voices[2].attack).not.toHaveBeenCalled()
    player.dispose()
  })
  it('aplica volumen y silencio por pista sin detener y libera todos los nodos al salir', async () => {
    const player = new TrackPlayer(vi.fn())
    player.configure(tracks, 120, 4)
    await player.play()
    player.setMix('m', 0.2, true); player.setLoop(true)
    expect(player.state).toBe('playing')
    expect(fake.gains[1].ramp).toHaveBeenCalledWith(0, 0.03)
    expect(fake.transport.loop).toBe(true)
    expect(tracks[1].muted).toBe(false) // Input project data was not mutated.
    player.dispose()
    expect(fake.voices.every(voice => voice.dispose.mock.calls.length === 1)).toBe(true)
    expect(fake.gains.every(gain => gain.dispose.mock.calls.length === 1)).toBe(true)
    expect(fake.parts.every(part => part.dispose.mock.calls.length === 1)).toBe(true)
    expect(fake.transport.clear).toHaveBeenCalledWith(8)
  })
  it('cancela permisos pendientes y rechaza notas inválidas antes de iniciar audio', async () => {
    let resolve!: () => void
    fake.start.mockReturnValue(new Promise<void>(done => { resolve = done }))
    const player = new TrackPlayer(vi.fn())
    player.configure(tracks, 120, 4)
    const pending = player.play()
    player.stop(); resolve(); await pending
    expect(fake.transport.start).not.toHaveBeenCalled()
    player.configure([{ ...tracks[0], notes: [{ pitch: 128, start: 0, duration: 1, velocity: 90 }] }], 120, 4)
    await expect(player.play()).rejects.toThrow()
    player.dispose()
  })
  it('limpia el grafo parcial si falla la creación de una secuencia', async () => {
    const player = new TrackPlayer(vi.fn())
    player.configure(tracks, 120, 4)
    fake.failPart = true
    await expect(player.play()).rejects.toThrow('Part falló')
    expect(fake.voices[0].dispose).toHaveBeenCalledOnce()
    expect(fake.gains[0].dispose).toHaveBeenCalledOnce()
    expect(player.state).toBe('stopped')
  })
  it('sincroniza cuatro pistas y enruta percusión sin tratarla como una nota afinada', async () => {
    const player = new TrackPlayer(vi.fn())
    player.configure([...tracks, { id: 'd', kind: 'drums', notes: [{ pitch: 36, start: 0, duration: 0.06, velocity: 127 }], volume: 0.7, muted: false }], 120, 4)
    await player.play()
    expect(fake.parts).toHaveLength(4)
    expect(fake.transport.start).toHaveBeenCalledOnce()
    fake.parts[3].callback(3, fake.parts[3].events[0])
    expect(fake.drumHit).toHaveBeenCalledWith(36, 3, 1)
    fake.transport.ticks = 0.02 * 192
    player.pause()
    expect(fake.drumRelease).toHaveBeenCalledOnce()
    await player.play()
    expect(fake.drumHit).toHaveBeenCalledOnce() // Do not re-strike a drum when resuming mid-hit.
    player.dispose()
    expect(fake.drumDispose).toHaveBeenCalledOnce()
  })
  it('permite hasta 16 pistas en un único transporte y rechaza más', async () => {
    const selected = Array.from({ length: 16 }, (_, i) => ({ ...tracks[0], id: String(i) }))
    const player = new TrackPlayer(vi.fn()); player.configure(selected, 120, 4)
    await player.play(); expect(fake.parts).toHaveLength(16)
    player.stop(); player.configure([...selected, { ...tracks[0], id: 'extra' }], 120, 4)
    await expect(player.play()).rejects.toThrow(/límite/); player.dispose()
  })
  it('comienza desde una sección y recupera notas sostenidas sin volver a golpear percusión', async () => {
    const player = new TrackPlayer(vi.fn())
    player.configure([...tracks, { id: 'd', kind: 'drums', notes: [{ pitch: 36, start: 0, duration: 3, velocity: 100 }], volume: 1, muted: false }], 120, 4)
    player.seek(2); expect(player.getBeat()).toBe(2)
    await player.play()
    expect(fake.transport.ticks).toBe(384)
    expect(fake.voices[0].attack).toHaveBeenCalledWith(57, 1, 0, 88 / 127)
    expect(fake.drumHit).not.toHaveBeenCalled()
    expect(() => player.seek(1)).toThrow()
    player.pause(); player.seek(1); expect(player.getBeat()).toBe(1)
    expect(() => player.seek(4)).toThrow(); expect(() => player.seek(-1)).toThrow()
    player.dispose(); expect(player.getBeat()).toBe(0)
  })
  it('al terminar libera el grafo, vuelve a cero y permite empezar de nuevo', async () => {
    const player = new TrackPlayer(vi.fn()); player.configure(tracks, 120, 4)
    await player.play()
    const finish = fake.transport.schedule.mock.calls[0][0] as (time: number) => void
    fake.transport.ticks = 768; finish(2)
    expect(player.state).toBe('stopped'); expect(player.getBeat()).toBe(0)
    expect(fake.voices.every(voice => voice.dispose.mock.calls.length === 1)).toBe(true)
    await player.play(); expect(fake.parts).toHaveLength(6); expect(fake.transport.ticks).toBe(0)
    player.dispose()
  })

})
