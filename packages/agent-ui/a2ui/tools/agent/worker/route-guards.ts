// route-guards.ts — the Worker's pure, side-effect-free request predicates, split out of index.ts
// specifically so they're safe to unit-test. index.ts's module scope (via its first import,
// process-shim.ts) globally overrides `process.cwd()` — fine inside the real Workers isolate, but
// importing that into the SAME Node process the rest of `npm test` runs in would silently corrupt
// `process.cwd()` for every other test in the run. This module has no such side effect: no imports beyond
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
