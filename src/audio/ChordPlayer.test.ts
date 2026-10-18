import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  start: vi.fn<() => Promise<void>>(),
  transport: { PPQ: 192, ticks: 0, bpm: { value: 100 }, loop: false, loopStart: 0 as number | string, loopEnd: 0 as number | string, stop: vi.fn(), start: vi.fn(), pause: vi.fn(), clear: vi.fn(), schedule: vi.fn() },
  release: vi.fn(), synthDispose: vi.fn(), partDispose: vi.fn(), gainDispose: vi.fn(), attack: vi.fn(), ramp: vi.fn(),
}))
vi.mock('tone', () => ({
  start: fake.start,
  getTransport: () => fake.transport,
  getDraw: () => ({ schedule: (callback: () => void) => callback() }),
  Frequency: (pitch: number) => ({ toFrequency: () => 440 * 2 ** ((pitch - 69) / 12) }),
  now: () => 0,
  Synth: class {},
  Gain: class { gain = { rampTo: fake.ramp }; toDestination() { return this }; dispose = fake.gainDispose },
  PolySynth: class { connect() { return this }; triggerAttackRelease = fake.attack; releaseAll = fake.release; dispose = fake.synthDispose },
  Part: class { start() { return this }; dispose = fake.partDispose },
}))
import { ChordPlayer } from './ChordPlayer'
const chords = [{ id: 'c', symbol: 'C', degree: 'I', start: 0, duration: 4, pitches: [48, 52, 55] }]

describe('Ciclo de vida del reproductor (Tone simulado, sin verificar sonido)', () => {
  beforeEach(() => { vi.clearAllMocks(); fake.start.mockResolvedValue(); fake.transport.ticks = 0; fake.transport.schedule.mockReturnValue(7) })
  it('Detener cancela un inicio asíncrono pendiente', async () => {
    let resolve!: () => void
    fake.start.mockReturnValue(new Promise<void>(done => { resolve = done }))
    const player = new ChordPlayer(vi.fn())
    player.configure(chords, 120, false, 0.5)
    const pending = player.play()
    player.stop()
    resolve()
    await pending
    expect(fake.transport.start).not.toHaveBeenCalled()
    expect(player.state).toBe('stopped')
  })
  it('Pausa conserva posición y Reanudar vuelve a atacar el acorde que quedó a medias', async () => {
    const player = new ChordPlayer(vi.fn())
    player.configure(chords, 120, false, 0.5)
    await player.play()
    fake.transport.ticks = 2 * 192
    player.pause()
    expect(player.state).toBe('paused')
    expect(player.getBeat()).toBe(2)
    expect(fake.release).toHaveBeenCalled()
    await player.play()
    expect(fake.attack).toHaveBeenCalledWith(expect.any(Array), 1, 0, 0.7)
    expect(player.state).toBe('playing')
    player.dispose()
  })
  it('repetición y volumen no detienen la pista; editar libera recursos', async () => {
    const player = new ChordPlayer(vi.fn())
    player.configure(chords, 120, false, 0.5)
    await player.play()
    player.setLoop(true)
    player.setVolume(0.3)
    expect(player.state).toBe('playing')
    expect(fake.transport.loop).toBe(true)
    expect(fake.ramp).toHaveBeenCalledWith(0.3, 0.03)
    expect(fake.transport.loopEnd).toBe('768i')
    player.configure(chords, 90, false, 0.5)
    expect(player.state).toBe('stopped')
    expect(fake.synthDispose).toHaveBeenCalledOnce()
    expect(fake.partDispose).toHaveBeenCalledOnce()
    expect(fake.gainDispose).toHaveBeenCalledOnce()
    expect(fake.transport.clear).toHaveBeenCalledWith(7)
  })
  it('propaga fallos de permiso y no reproduce pistas vacías o desmontadas', async () => {
    const player = new ChordPlayer(vi.fn())
    await player.play()
    expect(fake.start).not.toHaveBeenCalled()
    player.configure(chords, 100, false, 0.5)
    fake.start.mockRejectedValue(new Error('Audio bloqueado'))
    await expect(player.play()).rejects.toThrow('Audio bloqueado')
    expect(player.state).toBe('stopped')
    player.configure([{ ...chords[0], duration: 70000 }], 100, false, 0.5)
    await expect(player.play()).rejects.toThrow(/límite/)
    player.dispose()
    await player.play()
    expect(fake.transport.start).not.toHaveBeenCalled()
  })
  it('libera recursos parciales si falla la programación de audio', async () => {
    const player = new ChordPlayer(vi.fn())
    player.configure(chords, 100, false, 0.5)
    fake.transport.schedule.mockImplementationOnce(() => { throw new Error('Fallo de programación') })
    await expect(player.play()).rejects.toThrow('Fallo de programación')
    expect(fake.synthDispose).toHaveBeenCalledOnce()
    expect(fake.partDispose).toHaveBeenCalledOnce()
    expect(fake.gainDispose).toHaveBeenCalledOnce()
    expect(player.state).toBe('stopped')
  })
})
