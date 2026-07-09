// core/matcher.ts — pure functions; no state, no DOM (the headless invariant, SPEC-R2/R3, LLD-C3).
//
// v1 grammar (deliberately small, PRD §3 fences everything else): static segments · `:param` segments ·
// a trailing `*` catch-all captured under the fixed key `'*'`. Matching walks the compiled table in
// DECLARATION ORDER, first-match-wins (no specificity ranking) — `compile` preserves the input order and
// `match` never reorders it. Trailing-slash normalization (`/a/` ≡ `/a`; root `/` unaffected); the query
// string is parsed onto the match and never participates in matching (SPEC-R3).

import type { RouteRecord, RouteMatch } from './types.ts'

type Segment = { kind: 'static'; value: string } | { kind: 'param'; name: string } | { kind: 'wildcard' }

export interface CompiledRoute {
  record: RouteRecord
  segments: Segment[]
}

/** Split a route PATTERN into raw segments (`/items/:id` → `['items', ':id']`; `/` → `[]`). */
function splitPattern(pattern: string): string[] {
  const trimmed = pattern.replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed === '' ? [] : trimmed.split('/')
}

function classify(raw: string, isLast: boolean, pattern: string): Segment {
  if (raw === '*') {
    // Developer error, loud + early — never at navigate time (LLD-C3 edge: "'*' not in last position").
    if (!isLast) throw new Error(`@agent-ui/router: '*' must be the last segment in route "${pattern}"`)
    return { kind: 'wildcard' }
  }
  if (raw.startsWith(':')) return { kind: 'param', name: raw.slice(1) }
  return { kind: 'static', value: raw }
}

/** Compile the developer's route table into matchable segment lists. Snapshots the table — later
 *  mutation of the input array is inert (LLD-C5's documented edge). Throws on a non-last `*`. */
export function compile(routes: RouteRecord[]): CompiledRoute[] {
  return routes.map((record) => {
    const raw = splitPattern(record.path)
    const segments = raw.map((seg, i) => classify(seg, i === raw.length - 1, record.path))
    return { record, segments }
  })
}

/** `decodeURIComponent`, falling back to the raw segment on a malformed escape (never throws — LLD-C3:
 *  "the model for hostile input is 'no match or raw', not exceptions"). */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** Strip one trailing slash (`/a/` → `/a`); the root `/` is unaffected. An empty pathname normalizes to
 *  root (a bare query string with no leading path, e.g. `?x=1`). */
function normalizeTrailingSlash(pathname: string): string {
  if (pathname === '') return '/'
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

/** Split query off FIRST (LLD-C3 ordering), before trailing-slash normalization touches the pathname. */
function splitPathAndQuery(path: string): [pathname: string, queryString: string] {
  const qIndex = path.indexOf('?')
  return qIndex === -1 ? [path, ''] : [path.slice(0, qIndex), path.slice(qIndex + 1)]
}

/** `URLSearchParams` is a Node ≥10 global, NOT a DOM global — parsing here holds the headless invariant. */
function parseQuery(queryString: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(queryString)) out[k] = v
  return out
}

/** Walk one compiled route's segments against the path's segments; mutates `params` on a full match. A
 *  `:param` never captures empty (`/items//x` — LLD-C3 edge); duplicate param names are last-wins
 *  (documented, not an error); a `*` is always last (compile-time enforced) and consumes the remainder
 *  (including any embedded `/`), so its branch returns immediately. */
function matchSegments(segments: Segment[], pathSegments: string[], params: Record<string, string>): boolean {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.kind === 'wildcard') {
      params['*'] = pathSegments.slice(i).join('/')
      return true
    }
    const raw = pathSegments[i]
    if (raw === undefined) return false
    if (seg.kind === 'static') {
      if (raw !== seg.value) return false
    } else {
      if (raw === '') return false // a param never captures empty
      params[seg.name] = safeDecode(raw)
    }
  }
  return segments.length === pathSegments.length
}

/** Resolve `path` against the compiled table — declaration-order first-match-wins. `null` on no match
 *  (a consumer 404 is a trailing `*` route, SPEC-R3). */
export function match(compiled: CompiledRoute[], path: string): RouteMatch | null {
  const [rawPathname, queryString] = splitPathAndQuery(path)
  const pathname = normalizeTrailingSlash(rawPathname)
  const pathSegments = pathname === '/' ? [] : pathname.slice(1).split('/')
  const query = parseQuery(queryString)

  for (const { record, segments } of compiled) {
    const params: Record<string, string> = {}
    if (matchSegments(segments, pathSegments, params)) return { path: pathname, record, params, query }
  }
  return null
}
