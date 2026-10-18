import { env } from 'node:process'
import { createLyricsHandler } from '../../server/lyrics'

// Netlify supplies context.ip; never trust a client-supplied forwarding header.
export default createLyricsHandler({ env, fetcher: fetch, now: Date.now })
