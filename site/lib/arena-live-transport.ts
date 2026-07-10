// site/lib/arena-live-transport.ts — LLD-C3/C4 (SPEC-R17): the DEV-ONLY live-match overlay. Browser →
// the arena dev proxy (`/__a2a/arena`, a Vite middleware holding the provider key SERVER-side). Reached
// ONLY via a dev-only dynamic import (`import.meta.env.DEV`, see the page module) so `vite build`
// tree-shakes it out and no live-match/key path is ever baked into the static build (SPEC-N2) — this file
// has no `import.meta.env.VITE_*` reference at all; the proxy holds the key.
//
// GENUINELY STREAMING (LLD-C3 supersedes the old batch `runLiveMatch`, which read the whole response via
// `res.text()` before returning — there was nothing mid-flight for it to render, hence the old banner).
// The proxy has emitted the transcript incrementally since the arena wave shipped; this module now reads
// it incrementally too, via the shared `readNdjsonLines` reader (LLD-C1) — one transcript line per
// iteration, exactly the fixture-file line shape, so a completed stream's accumulated text is
// byte-identical to what the old `res.text()` path returned (the proxy contract itself is UNCHANGED).
//
// Mirrors `site/lib/live-proxy-transport.ts`'s `probeLive()`/fetch shape exactly (the a2ui precedent named
// in the LLD), scoped to the arena's own mount + body/response shape (a full match transcript, not a
// per-turn A2UI stream).
import { readNdjsonLines } from './ndjson-lines.ts'

const ENDPOINT = '/__a2a/arena'

export interface ArenaLiveStatus {
  available: boolean
  providers: number
}

/** Ask the dev proxy whether a live key is configured. Any error (no proxy = production build, or a
 * network fault) ⇒ not available — the page's "run a live match" affordance stays hidden. */
export async function probeArenaLive(): Promise<ArenaLiveStatus> {
  try {
    const res = await fetch(`${ENDPOINT}/status`)
    if (!res.ok) return { available: false, providers: 0 }
    const body = (await res.json()) as { available?: boolean; providers?: number }
    return { available: body.available === true, providers: body.providers ?? 0 }
  } catch {
    return { available: false, providers: 0 }
  }
}

export interface ArenaSeatSelection {
  provider: string
  model: string
}

export interface LiveMatchStream {
  /** One transcript line per iteration, in transcript order, via the shared `readNdjsonLines` reader
   * (LLD-C1) — header first, then each event as the proxy writes it. An abort mid-stream ends this
   * iterable by throwing the fetch/reader's own `AbortError` (a typed, platform-standard fault the caller
   * distinguishes from any other failure via `err.name === 'AbortError'` — never a custom wrapper, since
   * the native one already carries exactly that distinction). */
  lines: AsyncIterable<string>
  /** Every line yielded by `lines` so far, verbatim, reassembled into the SAME text shape a committed
   * fixture file is (`loadTranscript` parses it identically either way) — call after the stream completes
   * to hand the accumulated text to the batch reload path. */
  raw(): string
}

/** POST the two seats' `{provider,model}` selections and stream back the match transcript's raw NDJSON
 * lines AS the proxy writes them (LLD-C3) — no more waiting for the whole match before anything renders.
 * Throws on a non-2xx response (a bad seat pair, no key, or a hard match failure) with the proxy's own
 * error text, BEFORE the caller ever iterates `lines`. `opts.signal` cancels the underlying fetch — the
 * page's Cancel control (SPEC-R17 AC3). */
export async function runLiveMatchStream(
  seats: { X: ArenaSeatSelection; O: ArenaSeatSelection },
  opts: { signal?: AbortSignal } = {},
): Promise<LiveMatchStream> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seats }),
    signal: opts.signal,
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string }
      if (typeof body.error === 'string') detail = body.error
    } catch {
      /* the proxy always answers JSON on error — fall back to the status line if it somehow didn't */
    }
    throw new Error(`Live match proxy error (${detail}).`)
  }
  if (res.body === null) throw new Error('Live match proxy error (empty response body).')
  const body = res.body
  const rawLines: string[] = []
  async function* lines(): AsyncIterable<string> {
    for await (const line of readNdjsonLines(body)) {
      rawLines.push(line)
      yield line
    }
  }
  return { lines: lines(), raw: () => (rawLines.length > 0 ? rawLines.join('\n') + '\n' : '') }
}
