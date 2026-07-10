// feed-live-transport.ts — LLD-C10 (SPEC-R18): the DEV-ONLY live feed transport. Browser → `/__a2a/feed`
// (LLD-C8, a Vite middleware holding the key SERVER-side). POSTs the client-held ordered A2A message log +
// the `{provider,model}` selection, then reads the response as part-frames (`frames.ts`, LLD-C6) — yielding
// each `part` progressively for paint-as-it-arrives, and returning (the generator's own return value) the
// ONE reassembled `A2aMessage` once the declared part count is met. This module is reached ONLY via a
// dev-only dynamic import (`import.meta.env.DEV`) so `vite build` tree-shakes it out and no live-call path
// is ever baked into the static build (SPEC-N2) — mirrors `live-proxy-transport.ts`'s own shape: no
// `VITE_*`, no key, plain `fetch`.
import { readNdjsonLines } from './ndjson-lines.ts'
import { createFrameAssembler } from '../../packages/agent-ui/a2a/tools/feed/frames.ts'
import type { A2aMessage, A2aPart } from '@agent-ui/a2a'

const ENDPOINT = '/__a2a/feed'

export interface LiveStatus {
  available: boolean
  providers: number
}

/** Ask the dev proxy whether a live key is configured — same posture as `probeLive()`
 *  (`live-proxy-transport.ts`): a boolean + a count, never the key itself; any error (a production build
 *  with no proxy mounted, or a network fault) ⇒ not available. */
export async function probeFeedLive(): Promise<LiveStatus> {
  try {
    const res = await fetch(`${ENDPOINT}/status`)
    if (!res.ok) return { available: false, providers: 0 }
    const body = (await res.json()) as { available?: boolean; providers?: number }
    return { available: body.available === true, providers: body.providers ?? 0 }
  } catch {
    return { available: false, providers: 0 }
  }
}

/**
 * POST the whole client-held log + this turn's `{provider,model}` selection, then stream the proxy's
 * part-frame response back — yielding each `part` as it arrives (progressive paint: a TextPart, then one
 * tagged DataPart per A2UI envelope) and returning the fully reassembled `A2aMessage` once the header's
 * declared part count is met. Throws (never yields a partial) on a non-2xx response or a frame-assembler
 * fault (a foreign frame, a part before the header, or — the completion invariant biting — fewer/more
 * parts than the header declared): the caller (the page, LLD-C11) treats a thrown error as a faulted turn,
 * fail-closed (the partial paint is torn down, the log never gains a half-turn).
 */
export async function* sendTurn(
  feed: readonly string[],
  sel: { provider: string; model: string },
  opts?: { signal?: AbortSignal },
): AsyncGenerator<{ part: A2aPart }, A2aMessage, void> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ feed, provider: sel.provider, model: sel.model }),
    signal: opts?.signal,
  })
  if (!res.ok || res.body === null) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string }
      if (typeof body.error === 'string') detail = body.error
    } catch {
      // non-JSON error body — the status text above is all we have
    }
    throw new Error(`Live feed proxy error (${detail}).`)
  }

  const assembler = createFrameAssembler()
  for await (const line of readNdjsonLines(res.body)) {
    const result = assembler.push(line)
    if (!result.ok) throw new Error(`Live feed transport fault: ${result.reason}`)
    if (result.part !== undefined) yield { part: result.part }
  }
  const completed = assembler.complete()
  if (!completed.ok) throw new Error(`Live feed transport fault: ${completed.reason}`)
  return completed.message
}
