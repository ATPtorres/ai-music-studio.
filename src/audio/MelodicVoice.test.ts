import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Gain } from 'tone'
const fake = vi.hoisted(() => ({ voices: [] as { family: string; options: unknown; attack: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[], failConnect: false }))
vi.mock('tone', () => ({
  Synth: class { static family = 'synth' }, FMSynth: class { static family = 'fm' }, MonoSynth: class { static family = 'filtered' },
  PolySynth: class {
    triggerAttackRelease = vi.fn(); releaseAll = vi.fn(); dispose = vi.fn()
    constructor(voice: { family: string }, options: unknown) { fake.voices.push({ family: voice.family, options, attack: this.triggerAttackRelease, release: this.releaseAll, dispose: this.dispose }) }
    connect() { if (fake.failConnect) throw new Error('Connect failed'); return this }
  },
}))
import { createMelodicVoice } from './MelodicVoice'
import { soundsByKind } from '../sounds/catalog'
beforeEach(() => { fake.voices.length = 0; fake.failConnect = false })
describe('Voces polifónicas de la paleta de instrumentos (Tone simulado)', () => {
  it('crea todos los presets y conserva acordes, tiempos y velocidad en la interfaz común', () => {
    for (const kind of ['chords', 'melody', 'bass'] as const) for (const id of soundsByKind[kind]) {
      const voice = createMelodicVoice(kind, id, {} as Gain)
      voice.triggerAttackRelease([261, 330, 392], 1.2, 2, 0.6); voice.releaseAll(); voice.dispose()
      const created = fake.voices.at(-1)!
      expect(created.attack).toHaveBeenCalledWith([261, 330, 392], 1.2, 2, 0.6)
      expect(created.release).toHaveBeenCalledOnce(); expect(created.dispose).toHaveBeenCalledOnce()
    }
  })
  it('distingue motores FM, filtrado y lead, con recetas diferentes para todos los timbres', () => {
    const ids = [...new Set([...soundsByKind.chords, ...soundsByKind.melody, ...soundsByKind.bass])]
    for (const id of ids) {
      const kind = soundsByKind.chords.includes(id) ? 'chords' : soundsByKind.melody.includes(id) ? 'melody' : 'bass'
      createMelodicVoice(kind, id, {} as Gain)
    }
    expect(new Set(fake.voices.map(v => JSON.stringify([v.family, v.options]))).size).toBe(ids.length)
    expect(fake.voices.find((_, index) => ids[index] === 'electric-piano')!.family).toBe('fm')
    expect(fake.voices.find((_, index) => ids[index] === 'pad')!.family).toBe('filtered')
    expect(fake.voices.find((_, index) => ids[index] === 'acoustic-guitar')!.family).toBe('filtered')
    expect(fake.voices.find((_, index) => ids[index] === 'lead')!.family).toBe('synth')
  })
  it('rechaza sonidos incompatibles antes de asignar nodos y limpia una conexión fallida', () => {
    expect(() => createMelodicVoice('chords', 'kit-808', {} as Gain)).toThrow(/compatible/)
    expect(fake.voices).toHaveLength(0)
    fake.failConnect = true
    expect(() => createMelodicVoice('chords', 'piano', {} as Gain)).toThrow('Connect failed')
    expect(fake.voices[0].dispose).toHaveBeenCalledOnce()
  })
})
