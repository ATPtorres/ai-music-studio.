/* Optional real Web Audio rendering check; no sound is sent to speakers.
 * Pass the absolute path of an external node-web-audio-api installation.
 * The app and its regular tests do not depend on that native verification runtime.
 */
const { buildSync } = require('esbuild')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function main() {
  const audio = require(process.argv[2] || 'node-web-audio-api')
  Object.assign(globalThis, audio)
  globalThis.window = globalThis
  globalThis.addEventListener = () => {}
  globalThis.removeEventListener = () => {}
  const source = String.raw`
import * as Tone from 'tone'
import { createMelodicVoice } from './src/audio/MelodicVoice'
import { DrumKit } from './src/audio/DrumKit'
import { previewTime } from './src/audio/previewTiming'
const rate = 48000
function rms(data: Float32Array, start: number, end: number) {
  const from = Math.floor(start * rate), to = Math.min(data.length, Math.floor(end * rate))
  let sum = 0; for (let i = from; i < to; i++) sum += data[i] ** 2
  return Math.sqrt(sum / Math.max(1, to - from))
}
export async function verify() {
  const levels = []
  for (const kind of ['chords', 'bass'] as const) {
    const choices = kind === 'chords' ? ['electric-piano', 'pad', 'strings', 'acoustic-guitar', 'electric-guitar'] : ['electric-bass', 'synth-bass', 'acoustic-bass']
    for (const sound of choices) {
      let voice, output
      const audio = await Tone.Offline(() => {
        output = new Tone.Gain(0.7).toDestination()
        voice = createMelodicVoice(kind, sound as any, output)
        for (let i = 0; i < 4; i++) voice.triggerAttackRelease(kind === 'chords' ? [130.81, 164.81, 196] : [65.41], 0.6, 0.1 + i * 0.8, 0.75)
      }, 4, 1, rate)
      const data = audio.getChannelData(0)
      let peak = 0; for (const value of data) peak = Math.max(peak, Math.abs(value))
      levels.push({ kind, sound, rmsDb: +(20 * Math.log10(rms(data, .1, 3.3))).toFixed(2), peak: +peak.toFixed(4) })
      voice.dispose(); output.dispose()
      if (peak >= .8) throw Error('Insufficient headroom: ' + sound)
    }
    const values = levels.filter(item => item.kind === kind).map(item => item.rmsDb)
    if (Math.max(...values) - Math.min(...values) > 2) throw Error('Preset level spread exceeds 2 dB: ' + kind)
  }
  let scenarios = 0, minimumHitDb = Infinity
  for (const kit of ['kit-707', 'kit-808', 'kit-909'] as const) for (const pitch of [36, 38, 39, 42, 46, 70]) for (const bpm of [100, 300]) for (const swing of [0, .6]) {
    const original = Tone.getContext()
    const context = new Tone.OfflineContext(1, .1 + 12 * 60 / bpm + .5, rate)
    Tone.setContext(context)
    const output = new Tone.Gain(.7).toDestination(), drums = new DrumKit(output, kit)
    const observed = new Map<number, number>()
    const events = Array.from({ length: 48 }, (_, step) => ({ time: previewTime(step * .25 + (step % 2 ? swing * .25 : 0), context.transport.PPQ), step }))
    const part = new Tone.Part((time, event: { step: number }) => { observed.set(event.step, time); drums.trigger(pitch, time, .8) }, events).start(0)
    context.transport.bpm.value = bpm; context.transport.start(.1)
    try {
      const rendered = await context.render(), data = rendered.getChannelData(0)
      if (observed.size !== 48) throw Error('Missing sequencer steps: ' + JSON.stringify({ kit, pitch, bpm, swing, steps: observed.size }))
      for (const [step, time] of observed) {
        const db = 20 * Math.log10(rms(data, time + .002, time + .018))
        minimumHitDb = Math.min(minimumHitDb, db)
        if (!Number.isFinite(db) || db < -100) throw Error('Silent step: ' + JSON.stringify({ kit, pitch, bpm, swing, step, db }))
      }
      scenarios++
    } finally { part.dispose(); drums.dispose(); output.dispose(); context.dispose(); Tone.setContext(original) }
  }
  return { sampleRate: rate, levels, drumScenarios: scenarios, drumStepsChecked: scenarios * 48, minimumHitDb: +minimumHitDb.toFixed(2) }
}
`
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'music-preview-check-'))
  const outfile = path.join(temporary, 'verify.cjs')
  try {
    buildSync({ stdin: { contents: source, loader: 'ts', resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile })
    console.log(JSON.stringify(await require(outfile).verify(), null, 2))
  } finally {
    if (fs.existsSync(outfile)) fs.unlinkSync(outfile)
    fs.rmdirSync(temporary)
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
