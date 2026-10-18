import { keys } from '../models/project'
/** All musical times use quarter-note beats; BPM counts quarter notes. */
export function barBeats([numerator, denominator]: readonly [number, number]): number {
  if (!Number.isInteger(numerator) || numerator < 1 || numerator > 12 || ![2, 4, 8, 16].includes(denominator)) throw new Error('Compás inválido')
  return numerator * 4 / denominator
}
export function durationSeconds(bars: number, bpm: number, signature: readonly [number, number]): number {
  if (!Number.isFinite(bars) || bars < 0 || !Number.isFinite(bpm) || bpm <= 0) throw new Error('Duración inválida')
  return bars * barBeats(signature) * 60 / bpm
}
export function midiToNote(pitch: number): string {
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) throw new Error('Nota MIDI inválida')
  return `${keys[pitch % 12]}${Math.floor(pitch / 12) - 1}`
}
export function noteToMidi(note: string): number {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(note)
  if (!match) throw new Error('Nota inválida')
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const pitch = (Number(match[3]) + 1) * 12 + natural[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0)
  midiToNote(pitch)
  return pitch
}
/** General MIDI percussion, channel 10 (zero-based channel 9). */
export const drumMap = { kick: 36, snare: 38, clap: 39, closedHat: 42, openHat: 46, shaker: 70 } as const
