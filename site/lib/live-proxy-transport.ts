// live-proxy-transport.ts — LLD-C7 / SPEC-R9: the live overlay transport, probed at runtime in EVERY
// environment (ADR-0152 supersedes the old dev-only framing). Browser → the proxy: in dev, a Vite
// middleware that holds the key SERVER-side (`process.env`, LLD-C6); in production, a Cloudflare Worker
// port of the same proxy (`tools/agent/worker/index.ts`) holding the key as a Workers Secret, mounted at
// the same `/__a2ui/agent` path. It POSTs the framed turn + the {provider,model,mode} selection and streams
// the proxy's VALIDATED A2UI JSONL back as AgentTransport lines. This module DOES ship in the production
// `dist/` bundle (it is reachable there now) — the trust boundary is enforced by a same-origin check + a
// Cloudflare rate-limiting rule on the Worker's POST routes, not by the module's absence (SPEC-N2 amended).
// Plain fetch; NO key lives here (the proxy holds it) — this file has no `import.meta.env.VITE_*` reference
// at all.
//
// ADR-0090 §4/LLD-C7: `mode` (a `GenUiMode`) rides the SAME body + `SelectionRef` seam `{provider,model}`
// already prove — the switcher (LLD-C12) is the only producer of a live `mode` value; the proxy (LLD-C6)
// re-validates it independently (never trusts this body verbatim).

import type { AgentTransport, TurnInput } from './agent-runtime.ts'
import type { GenUiMode } from '../../packages/agent-ui/a2ui/src/agent/gen-ui-mode.ts'
import { readNdjsonLines } from './ndjson-lines.ts'

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
 * with each turn; ADR-0090 §4 extends this to `mode`). A ref indirection so the page can swap the
 * selection without re-constructing the transport. */
export interface SelectionRef {
  get(): { provider: string; model: string; mode: GenUiMode }
}

export function createLiveProxyTransport(selection: SelectionRef): AgentTransport {
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      const sel = selection.get()
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input, provider: sel.provider, model: sel.model, mode: sel.mode }),
      })
      if (!res.ok || res.body === null) {
        throw new Error(`Live agent proxy error (${res.status} ${res.statusText}).`)
      }
      // The proxy streams VALIDATED A2UI JSONL — one message per line. Read + re-yield line by line (via the
      // shared reader, LLD-C1) so the browser transport is identical to the recorded backbone (SPEC-R5: same
      // ingest path either way).
      yield* readNdjsonLines(res.body)
    },
  }
}
