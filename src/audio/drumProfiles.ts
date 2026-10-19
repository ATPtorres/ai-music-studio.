import type { DrumSound } from '../sounds/catalog'
interface DrumProfile {
  kick: { pitchDecay: number; octaves: number; decay: number; release: number; volume: number; note: string; duration: number }
  noise: 'white' | 'pink' | 'brown'
  snare: [number, number, number]; clap: [number, number, number]; closed: [number, number, number]; open: [number, number, number]; shaker: [number, number, number]
}
/** Original synth recipes inspired by broad machine characteristics, without samples. */
export const drumProfiles: Record<DrumSound, DrumProfile> = {
  'kit-707': {
    kick: { pitchDecay: 0.035, octaves: 5, decay: 0.17, release: 0.04, volume: -10, note: 'C1', duration: 0.12 }, noise: 'white',
    snare: [1100, 0.12, -17], clap: [1800, 0.09, -15], closed: [7000, 0.035, -22], open: [6500, 0.22, -22], shaker: [4000, 0.045, -24],
  },
  'kit-808': {
    kick: { pitchDecay: 0.065, octaves: 4, decay: 0.7, release: 0.18, volume: -12, note: 'A0', duration: 0.65 }, noise: 'pink',
    snare: [900, 0.2, -14], clap: [1350, 0.19, -13], closed: [8200, 0.025, -17], open: [7200, 0.42, -18], shaker: [5000, 0.07, -19],
  },
  'kit-909': {
    kick: { pitchDecay: 0.022, octaves: 7, decay: 0.28, release: 0.07, volume: -10, note: 'D1', duration: 0.24 }, noise: 'white',
    snare: [1600, 0.17, -14], clap: [2200, 0.13, -14], closed: [9800, 0.055, -19], open: [9000, 0.32, -20], shaker: [6200, 0.035, -22],
  },
  'kit-linn': {
    kick: { pitchDecay: 0.009, octaves: 2, decay: 0.12, release: 0.025, volume: -10, note: 'G1', duration: 0.1 }, noise: 'white',
    snare: [2100, 0.095, -13], clap: [2800, 0.07, -14], closed: [5800, 0.018, -21], open: [5100, 0.15, -21], shaker: [3300, 0.028, -23],
  },
}
