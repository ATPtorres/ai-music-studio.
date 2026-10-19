import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Gain } from 'tone'
const fake = vi.hoisted(() => ({
  instruments: [] as { attack: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
  filters: [] as { dispose: ReturnType<typeof vi.fn> }[], failNoise: false,
}))
vi.mock('tone', () => ({
  MembraneSynth: class { triggerAttackRelease = vi.fn(); triggerRelease = vi.fn(); dispose = vi.fn(); constructor() { fake.instruments.push({ attack: this.triggerAttackRelease, release: this.triggerRelease, dispose: this.dispose }) }; connect() { return this } },
  NoiseSynth: class { triggerAttackRelease = vi.fn(); triggerRelease = vi.fn(); dispose = vi.fn(); constructor() { if (fake.failNoise) throw new Error('Noise falló'); fake.instruments.push({ attack: this.triggerAttackRelease, release: this.triggerRelease, dispose: this.dispose }) }; connect() { return this } },
  Filter: class { dispose = vi.fn(); constructor() { fake.filters.push({ dispose: this.dispose }) }; connect() { return this } },
}))
import { DrumKit } from './DrumKit'
describe('Kit sintetizado (Tone simulado)', () => {
  beforeEach(() => { vi.clearAllMocks(); fake.instruments.length = 0; fake.filters.length = 0; fake.failNoise = false })
  it('distingue los seis sonidos, respeta la velocidad y ahoga el hat abierto con el cerrado', () => {
    const kit = new DrumKit({} as Gain)
    kit.trigger(36, 1, 0.8)
    expect(fake.instruments[0].attack).toHaveBeenCalledWith('C1', 0.12, 1, 0.8)
    kit.trigger(46, 2, 0.5); kit.trigger(42, 3, 0.6)
    expect(fake.instruments[4].release).toHaveBeenCalledWith(3)
    expect(fake.instruments[3].attack).toHaveBeenCalledWith(0.025, 3, 0.6)
    kit.trigger(38, 4, 0.7); kit.trigger(39, 4, 0.7); kit.trigger(70, 4, 0.7)
    expect(fake.instruments.every(instrument => instrument.attack.mock.calls.length === 1)).toBe(true)
    kit.releaseAll()
    expect(fake.instruments.every(instrument => instrument.release.mock.calls.length > 0)).toBe(true)
    kit.dispose(); kit.dispose()
    expect(fake.instruments.every(instrument => instrument.dispose.mock.calls.length === 1)).toBe(true)
    expect(fake.filters.every(filter => filter.dispose.mock.calls.length === 1)).toBe(true)
  })
  it('libera el kit parcial si falla la creación de un instrumento', () => {
    fake.failNoise = true
    expect(() => new DrumKit({} as Gain)).toThrow('Noise falló')
    expect(fake.instruments[0].dispose).toHaveBeenCalledOnce()
    expect(fake.filters[0].dispose).toHaveBeenCalledOnce()
  })
  it('diferencia los cuatro kicks y libera cada kit después del cambio', () => {
    const choices = [
      ['kit-707', 'C1', 0.12], ['kit-808', 'A0', 0.65], ['kit-909', 'D1', 0.24], ['kit-linn', 'G1', 0.1],
    ] as const
    for (const [id, pitch, duration] of choices) {
      const index = fake.instruments.length
      const kit = new DrumKit({} as Gain, id)
      kit.trigger(36, 2, 0.75)
      expect(fake.instruments[index].attack).toHaveBeenCalledWith(pitch, duration, 2, 0.75)
      kit.dispose()
    }
    expect(fake.instruments.every(instrument => instrument.dispose.mock.calls.length === 1)).toBe(true)
    expect(fake.filters.every(filter => filter.dispose.mock.calls.length === 1)).toBe(true)
  })

})
