// route-guards.ts — the Worker's pure, side-effect-free request predicates, split out of index.ts
// specifically so they're safe to unit-test. index.ts statically imports the corpus `.jsonl`
// shard as Wrangler Text, plus `providers.json` and catalog JSON, which only the Wrangler bundle loads,
// so it cannot be imported into the SAME Node process the rest of `npm test` runs in. This module has no
// such dependency: no imports beyond
// the Fetch API types, safe to import from anywhere, including the jsdom test suite (GH #112).

// GH #101 — same-origin gate for the two state-changing POST routes. See index.ts's call site for the
// full CSRF rationale.
export function isSameOriginRequest(request: Request, allowedOrigin: string): boolean {
  const origin = request.headers.get('origin')
  if (origin !== null) return origin === allowedOrigin
  const referer = request.headers.get('referer')
  if (referer !== null) return referer === allowedOrigin || referer.startsWith(`${allowedOrigin}/`)
  return false // a browser fetch() always sends at least one — neither present means it isn't one
}

// GH #109 — Connect's `.use(mount, handler)` semantics (an exact match or a `/`-bounded prefix), which a
// bare `startsWith` doesn't reproduce.
export function isMountedPath(pathname: string, mount: string): boolean {
  return pathname === mount || pathname.startsWith(`${mount}/`)
}

// GH #103 — the exact shape produce()'s `queryOf`/`userContent` need before their first yield: `input.kind`
// and `input.session.turns`. See index.ts's call site for why this fully closes the "silent empty 200" gap.
export function isValidTurnInput(input: unknown): boolean {
  if (input === null || typeof input !== 'object') return false
  const candidate = input as { kind?: unknown; session?: unknown }
  if (candidate.kind !== 'intent' && candidate.kind !== 'client') return false
  if (candidate.session === null || typeof candidate.session !== 'object') return false
  return Array.isArray((candidate.session as { turns?: unknown }).turns)
}

// GH #111: the request body cap enforced WHILE reading, not after: a Content-Length pre-check plus a
// post-hoc length check after `request.text()` had already buffered the body was a check that ran too
// late (a chunked request with no Content-Length, or a garbled one where `Number(bad)` is NaN, skipped
// both). This reads the `ReadableStream` chunk by chunk and throws before any chunk pushes the total over
// `maxBytes`, the way dev-proxy-plugin.ts's Node reader rejects on `data`. Shared by both Worker mounts
// (T-0430: moved here from index.ts so the arena route reads under its own, smaller cap).
export async function readBodyCapped(request: Request, maxBytes: number): Promise<string> {
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) > maxBytes) throw new Error('request body too large')
  if (request.body === null) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error('request body too large')
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}
