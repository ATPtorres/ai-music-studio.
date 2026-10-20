import type { MusicProject, MusicTrack } from '../models/project'
import { chordsToNotes } from '../music/harmony'
import { drumPatternEnd, drumPatternNotes } from '../music/drums'
import { barBeats } from '../music/theory'

export function sourceClip(track: MusicTrack, signature: MusicProject['parameters']['timeSignature']) {
  const notes = track.kind === 'chords' && track.chords.length ? chordsToNotes(track.chords) : track.kind === 'drums' && track.drumPattern ? drumPatternNotes(track.drumPattern) : track.notes
  const last = notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0)
  const period = track.kind === 'drums' && track.drumPattern ? drumPatternEnd(track.drumPattern) : Math.ceil(last / barBeats(signature)) * barBeats(signature)
  if (!Number.isFinite(period) || period > 4096 || notes.length > 15000) throw new Error(`El clip «${track.name}» supera el límite de duración o notas del arreglo.`)
  return { notes, period }
}

export function variantClip(track: MusicTrack, signature: MusicProject['parameters']['timeSignature'], variantId?: string) {
  if (!variantId) return sourceClip(track, signature)
  const variant = track.variants?.find(item => item.id === variantId)
  if (!variant) throw new Error(`No existe la variante de «${track.name}».`)
  return { notes: variant.notes, period: variant.beats }
}
