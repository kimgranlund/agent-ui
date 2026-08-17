// proxy.ts — the live/proxy transport (ADR-0200 clause 3 / SPEC-R4; decomp n2b).
//
// POSTs one turn to a dev-proxy-shaped mount (the EXISTING `/__a2ui/agent` — or its ADR-0152 Worker
// twin) and yields the streamed `application/x-ndjson` body line-by-line across arbitrary chunk
// boundaries. The coupling is HTTP-ONLY (SPEC-R4 AC3): no key, no provider adapter, no `produce()`
// import ever enters this package — the ADR-0073 trust boundary stays exactly where it is, and the
// body fields written here are pinned by SPEC-R4 so proxy drift is a SPEC diff, not a silent break.
//
// `fetch` is INJECTED (browser- and Node-capable, jsdom-testable); the default binds `globalThis.fetch`
// lazily inside `turn()` — zero I/O and zero global capture at module scope.

import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'

/** The structural slice of a `fetch` Response this transport reads — the real `Response` satisfies it. */
export interface ProxyResponseLike {
  ok: boolean
  status: number
  body?: ReadableStream<Uint8Array> | null
  text(): Promise<string>
}

/** The structural slice of `fetch` this transport calls — the real `fetch` satisfies it. */
export type ProxyFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<ProxyResponseLike>

export interface ProxyTransportOptions {
  /** The dev-proxy-shaped mount (e.g. `'/__a2ui/agent'` under `vite dev`, or an absolute URL). */
  url: string
  /** Injected fetch (SPEC-R4) — defaults to `globalThis.fetch`, bound lazily per turn. */
  fetch?: ProxyFetch
  /** The `{provider, model}` PAIR forwarded top-level (the proxy validates it against its allowlist,
   *  SPEC-R12 of the a2ui-live-agent contract). Falls back to the selection the `TurnInput` itself
   *  carries; omitted entirely when neither names one. */
  provider?: string
  model?: string
}

/** The pinned dev-proxy request body (SPEC-R4): exactly the fields the produce branch of
 *  `dev-proxy-plugin.ts` reads — `input` verbatim, plus the top-level `{provider, model}` pair. */
export interface ProxyTurnBody {
  input: TurnInput
  provider?: string
  model?: string
}

/** Split a streamed NDJSON body into lines across arbitrary chunk boundaries. Local by DAG necessity:
 *  `@agent-ui/data/stream`'s hoisted `readNdjsonLines` is unreachable from here (dependencies are
 *  exactly {a2ui, a2a}, ADR-0200 cl.1) — this is the minimal line-splitting half, cited not forked. */
async function* linesOf(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        if (line.length > 0) yield line
      }
    }
    buffer += decoder.decode()
    if (buffer.length > 0) yield buffer
  } finally {
    reader.releaseLock()
  }
}

/**
 * The live backend (SPEC-R4): one `AgentTransport` whose `turn()` POSTs the pinned body and yields
 * the proxy's validated NDJSON lines verbatim. A non-2xx response THROWS carrying the proxy's
 * `{error}` text (AC2) — the caller routes it (the page to its turn-fail path; the seam to an
 * `error` event).
 */
export function proxyTransport(opts: ProxyTransportOptions): AgentTransport {
  return {
    async *turn(input: TurnInput): AsyncIterable<string> {
      const doFetch = opts.fetch ?? (globalThis.fetch as unknown as ProxyFetch)
      const provider = opts.provider ?? input.provider
      const model = opts.model ?? input.model
      const body: ProxyTurnBody = {
        input,
        ...(provider !== undefined ? { provider } : {}),
        ...(model !== undefined ? { model } : {}),
      }
      const res = await doFetch(opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        let message: string | undefined
        try {
          const parsed = JSON.parse(text) as { error?: unknown }
          if (typeof parsed.error === 'string') message = parsed.error
        } catch {
          /* a non-JSON error body falls through to the status fallback */
        }
        throw new Error(message ?? `proxy error (status ${res.status})`)
      }
      if (res.body !== null && res.body !== undefined) {
        yield* linesOf(res.body)
        return
      }
      // A body-less response shape (some fetch stubs / buffered polyfills): fall back to text().
      for (const line of (await res.text()).split('\n')) {
        if (line.length > 0) yield line
      }
    },
  }
}
