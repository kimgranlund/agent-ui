// core/router.ts — createRouter: composes the matcher + memory stack into ONE kernel signal, the single
// source of truth (SPEC-R2, LLD-C5). The headless invariant holds here too: `signal`/`unowned` are the
// reactive kernel's own primitives (imported from `@agent-ui/components`, same pattern as
// `@agent-ui/a2ui`'s renderer) — no DOM global is ever referenced by this module's own source.
//
// A local MemoryHistory instance is deliberately named `stack`, never `history` — the standalone
// identifier `history` is exactly what the LLD-C5 no-DOM static scan (headless.test.ts) targets, and a
// same-named local would be indistinguishable from a real `globalThis.history` reference to a naive scan.

import { signal, unowned } from '@agent-ui/components'
import { compile, match } from './matcher.ts'
import { MemoryHistory } from './history.ts'
import type { RouteRecord, RouteMatch, Router } from './types.ts'

/** Two matches are the SAME resolved route when path/record/params/query all agree (order-insensitive
 *  on the param/query maps) — reused by `commit` so the kernel's `Object.is` cutoff fires on a
 *  re-navigate to the identical path (SPEC-R2's no-op-for-subscribers contract; a freshly-constructed
 *  `RouteMatch` object is never `Object.is`-equal to itself otherwise). */
function sameMatch(a: RouteMatch | null, b: RouteMatch | null): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return a.path === b.path && a.record === b.record && sameShape(a.params, b.params) && sameShape(a.query, b.query)
}

function sameShape(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a)
  if (ak.length !== Object.keys(b).length) return false
  return ak.every((k) => a[k] === b[k])
}

/**
 * The package-private extension of `Router` the URL adapter (`url.ts`, LLD-C6) reads/drives — never
 * exported from the public barrel (index.ts exports only the SPEC §4 `Router` shape). `historyIndex`
 * lets an outbound write stamp the CURRENT memory index; `adoptAtIndex` is the stamped-`popstate`
 * re-point seam — it returns the landed path on success, or `null` when `index` is outside this
 * session's stack (a stale/foreign stamp), so the adapter's un-stamped fallback (adopt-as-push) applies.
 */
export interface RouterInternal extends Router {
  readonly historyIndex: number
  adoptAtIndex(index: number): string | null
  /** The attached URL strategy's path-formatter (LLD-C6's `connectUrl`), or `null` when no adapter is
   *  attached — the `ui-router-link` href-derivation seam (LLD-C8): the attached strategy's own form
   *  when set, hash form when `null` (the documented memory-only degradation, applied by the link
   *  itself). Mutable: `connectUrl` sets it on connect, clears it on cleanup(). */
  urlFormat: ((path: string) => string) | null
}

export function createRouter(routes: RouteRecord[], options?: { initial?: string }): RouterInternal {
  const compiled = compile(routes)
  const stack = new MemoryHistory(options?.initial ?? '/')

  // `unowned`: a router constructed inside some component's connected scope must not die with that
  // component — it is an instance with its OWN lifetime, ended only by dispose() (the kernel's
  // module-singleton rule, LLD-C5).
  const route = unowned(() => signal<RouteMatch | null>(match(compiled, stack.current)))

  let disposed = false
  const assertLive = (): void => {
    if (disposed) throw new Error('@agent-ui/router: navigate/back/forward called on a disposed router')
  }

  const commit = (path: string): void => {
    const next = match(compiled, path)
    route.value = sameMatch(next, route.value) ? route.value : next
  }

  return {
    route,
    navigate(path, opts) {
      assertLive()
      if (opts?.replace) stack.replace(path)
      else stack.push(path)
      commit(stack.current)
    },
    back() {
      assertLive()
      const landed = stack.go(-1)
      if (landed !== null) commit(landed) // clamps silently at index 0 — no signal write at all
    },
    forward() {
      assertLive()
      const landed = stack.go(1)
      if (landed !== null) commit(landed)
    },
    dispose() {
      disposed = true
    },
    get historyIndex() {
      return stack.index
    },
    adoptAtIndex(index) {
      assertLive()
      const landed = stack.setIndex(index)
      if (landed === null) return null
      commit(landed)
      return landed
    },
    urlFormat: null,
  }
}
