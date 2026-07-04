// live-proxy-transport.ts — LLD-C7 / SPEC-R9: the DEV-ONLY live overlay transport. Browser → the dev
// proxy (LLD-C6, a Vite middleware that holds the key SERVER-side, process.env). It POSTs the framed turn
// + the {provider,model} selection and streams the proxy's VALIDATED A2UI JSONL back as AgentTransport
// lines. This module is reached ONLY via a dev-only dynamic import (`import.meta.env.DEV`) so `vite build`
// tree-shakes it out and no live-call path is ever baked into the static build (SPEC-N2). Plain fetch; NO
// key lives here (the proxy holds it) — this file has no `import.meta.env.VITE_*` reference at all.

import type { AgentTransport, TurnInput } from './agent-runtime.ts'

const ENDPOINT = '/__a2ui/agent'

export interface LiveStatus {
  available: boolean
  providers: number
}

/** Ask the dev proxy whether a live key is configured. The proxy answers a boolean + a count; it NEVER
 * exposes the key value. Any error (no proxy = production build, or a network fault) ⇒ not available. */
export async function probeLive(): Promise<LiveStatus> {
  try {
    const res = await fetch(`${ENDPOINT}/status`)
    if (!res.ok) return { available: false, providers: 0 }
    const body = (await res.json()) as { available?: boolean; providers?: number }
    return { available: body.available === true, providers: body.providers ?? 0 }
  } catch {
    return { available: false, providers: 0 }
  }
}

/** The live transport reads the CURRENT switcher selection per turn (SPEC-R12: `{provider,model}` sent
 * with each turn). A ref indirection so the page can swap the selection without re-constructing the
 * transport. */
export interface SelectionRef {
  get(): { provider: string; model: string }
}

export function createLiveProxyTransport(selection: SelectionRef): AgentTransport {
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      const sel = selection.get()
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input, provider: sel.provider, model: sel.model }),
      })
      if (!res.ok || res.body === null) {
        throw new Error(`Live agent proxy error (${res.status} ${res.statusText}).`)
      }
      // The proxy streams VALIDATED A2UI JSONL — one message per line. Read + re-yield line by line so the
      // browser transport is identical to the recorded backbone (SPEC-R5: same ingest path either way).
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl = buffer.indexOf('\n')
        while (nl !== -1) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (line.length > 0) yield line
          nl = buffer.indexOf('\n')
        }
      }
      const tail = buffer.trim()
      if (tail.length > 0) yield tail
    },
  }
}
