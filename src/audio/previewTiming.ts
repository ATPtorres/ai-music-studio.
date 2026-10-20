/** Tone Transport dispatches integer ticks; fractional tick strings can be skipped. */
export function previewTime(beats: number, ppq: number): `${number}i` {
  return `${Math.round(beats * ppq)}i`
}
