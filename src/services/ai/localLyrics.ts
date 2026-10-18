import { sectionNames, lyricsRequestSchema, type LyricsRequest, type DraftResult } from './lyricsContract'

/** A writing scaffold, deliberately labeled as a guide rather than model output. */
export function createLocalLyrics(input: LyricsRequest): DraftResult {
  const request = lyricsRequestSchema.parse(input)
  const english = request.language === 'English'
  const prompts = english ? [
    '[Open with a place, a concrete image and something that has changed.]',
    '[Write one short, repeatable sentence that expresses what you want.]',
    '[Show a new scene or the consequence of the first verse.]',
    '[Change your point of view: what do you understand now?]',
    '[Return to your central sentence and change its last line.]',
  ] : [
    '[Abre con un lugar, una imagen concreta y algo que haya cambiado.]',
    '[Escribe una frase breve y repetible que diga lo que deseas.]',
    '[Muestra otra escena o una consecuencia del primer verso.]',
    '[Cambia de perspectiva: ¿qué entiendes ahora?]',
    '[Vuelve a tu frase central y transforma la última línea.]',
  ]
  const labels = sectionNames(request)
  const selectedPrompts = request.structure === 'short' ? [prompts[0], prompts[1], prompts[4]] : request.structure === 'narrative' ? [prompts[0], prompts[2], prompts[3], prompts[4]] : prompts
  return { source: 'local', draft: {
    title: request.theme.split('\n')[0].slice(0, 100),
    sections: labels.map((name, index) => ({ name, lyrics: `${english ? 'Theme' : 'Tema'}: ${request.theme}\n${selectedPrompts[index]}` })),
  } }
}
