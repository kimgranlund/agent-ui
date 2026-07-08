// site/lib/arena-live-transport.ts — LLD-C10/C11 (SPEC-R13): the DEV-ONLY live-match overlay. Browser →
// the arena dev proxy (`/__a2a/arena`, a Vite middleware holding the provider key SERVER-side). Reached
// ONLY via a dev-only dynamic import (`import.meta.env.DEV`, see the page module) so `vite build`
// tree-shakes it out and no live-match/key path is ever baked into the static build (SPEC-N2) — this file
// has no `import.meta.env.VITE_*` reference at all; the proxy holds the key.
//
// Mirrors `site/lib/live-proxy-transport.ts`'s `probeLive()`/fetch shape exactly (the a2ui precedent named
// in the LLD), scoped to the arena's own mount + body/response shape (a full match transcript, not a
// per-turn A2UI stream).

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

/** POST the two seats' `{provider,model}` selections and read back the match transcript's raw NDJSON
 * text (one transcript event per line — the same shape `loadTranscript` parses from a committed fixture).
 * Reads the WHOLE response before returning: the proxy runs the match to completion server-side (its own
 * file banner names this scoping choice) — there is no partial transcript to render mid-flight. Throws on
 * a non-2xx response (a bad seat pair, no key, or a hard match failure) with the proxy's own error text. */
export async function runLiveMatch(seats: { X: ArenaSeatSelection; O: ArenaSeatSelection }): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seats }),
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
  return res.text()
}
