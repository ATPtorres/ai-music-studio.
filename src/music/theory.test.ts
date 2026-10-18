import { describe, expect, it } from 'vitest'
import { barBeats, drumMap, durationSeconds, midiToNote, noteToMidi } from './theory'
describe('Convenciones musicales', () => {
  it('calcula duración en negras incluso en compases compuestos', () => {
    expect(durationSeconds(4, 120, [4, 4])).toBe(8)
    expect(durationSeconds(4, 120, [6, 8])).toBe(6)
    expect(durationSeconds(8, 90, [3, 4])).toBe(16)
    expect(barBeats([7, 8])).toBe(3.5)
  })
  it('rechaza tempos y compases inválidos', () => {
    expect(() => durationSeconds(1, 0, [4, 4])).toThrow()
    expect(() => durationSeconds(-1, 100, [4, 4])).toThrow()
    expect(() => barBeats([4, 3])).toThrow()
  })
  it('convierte todas las notas MIDI sin perder octavas', () => {
    for (let pitch = 0; pitch <= 127; pitch++) expect(noteToMidi(midiToNote(pitch))).toBe(pitch)
    expect(midiToNote(60)).toBe('C4')
    expect(noteToMidi('Db4')).toBe(61)
    expect(noteToMidi('Cb4')).toBe(59)
    expect(() => midiToNote(128)).toThrow()
    expect(() => noteToMidi('A99')).toThrow()
    expect(() => noteToMidi('H4')).toThrow()
  })
  it('documenta las notas GM de batería', () => { expect(drumMap.kick).toBe(36); expect(drumMap.snare).toBe(38); expect(drumMap.closedHat).toBe(42) })
})
