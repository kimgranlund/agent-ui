// url.ts — the ONLY file that touches location/history APIs (LLD-C6, SPEC-R4). URL reflection is an
// OPT-IN projection of the router's own signal — constructing a router never touches the URL, and this
// module is never a second source of truth: it reads the signal to write out, and writes the signal
// (via `navigate`/`adoptAtIndex`) on genuine external change only.
//
// The primary v1 risk (ADR-0115 §Consequences): two history stacks — the router's own memory stack and
// the browser's — drifting apart. Closed by state-stamping every HISTORY-mode write with the memory
// index (`{uiRouter:{index}}`) and, on a stamped `popstate`, RE-POINTING (never re-deriving) that index
// via `RouterInternal.adoptAtIndex` — browser back/forward then IS `router.back()/forward()` by
// construction, not a guess reconciled after the fact.
//
// Echo-loop lock: `hashchange`/`popstate` fire ASYNCHRONOUSLY (a separate task, not a microtask) in
// every real engine, so a synchronous `writing` boolean cleared right after the write call would already
// be false by the time the platform's own echo arrives — a lock keyed on TIMING cannot work here. Instead
// `lastReflected` tracks the path+query string the URL is currently believed to hold (updated on every
// outbound write AND on every inbound adoption, BEFORE the corresponding signal change lands) — any
// event whose resolved path already equals it is a known-cause echo (ours or already-applied), suppressed
// unconditionally. This is timing-independent by construction: it never matters whether the platform's
// event fires synchronously, on the next microtask, or on the next task.

import { effect, createScope } from '@agent-ui/components'
import type { Router, RouteMatch } from './core/types.ts'
import type { RouterInternal } from './core/router.ts'

const STAMP_KEY = 'uiRouter'

interface StampedState {
  uiRouter: { index: number }
}

function isStampedState(state: unknown): state is StampedState {
  if (typeof state !== 'object' || state === null || !(STAMP_KEY in state)) return false
  const inner = (state as Record<string, unknown>)[STAMP_KEY]
  return typeof inner === 'object' && inner !== null && typeof (inner as Record<string, unknown>).index === 'number'
}

/** The two-strategy seam (LLD-C6): `format` derives an `href` (`ui-router-link`'s seam, LLD-C8); `read`
 *  resolves the CURRENT URL to a candidate path (`null` = "not ours" — a non-route hash); `write` performs
 *  the outbound crossing; `onExternal` reports a genuine platform-driven change — either a resolved
 *  `path` (hash edit / un-stamped popstate — push-adoption) or a `stampedIndex` (a stamped popstate —
 *  re-point, never re-derive). */
interface Strategy {
  format(path: string): string
  read(): string | null
  write(path: string, replace: boolean, historyIndex: number): void
  onExternal(cb: (path: string | null, stampedIndex: number | null) => void, signal: AbortSignal): void
}

function hashStrategy(): Strategy {
  return {
    format: (path) => `#${path}`,
    read() {
      const raw = location.hash.slice(1)
      // v1 rule (LLD-C6 edge): a hash NOT starting with '/' is not ours (an in-app anchor idiom,
      // `#section`) — ignored on read; outbound writes only ever produce `#/…` forms.
      return raw.startsWith('/') ? raw : null
    },
    write(path, replace) {
      if (replace) location.replace(`#${path}`) // no new browser entry (SPEC-R4's replaceState-equivalent)
      else location.hash = path
    },
    onExternal(cb, signal) {
      window.addEventListener(
        'hashchange',
        () => {
          const raw = location.hash.slice(1)
          cb(raw.startsWith('/') ? raw : null, null) // hash carries no stamped index
        },
        { signal },
      )
    },
  }
}

function historyStrategy(): Strategy {
  return {
    format: (path) => path,
    read() {
      return location.pathname + location.search
    },
    write(path, replace, historyIndex) {
      const state: StampedState = { uiRouter: { index: historyIndex } }
      if (replace) window.history.replaceState(state, '', path)
      else window.history.pushState(state, '', path)
    },
    onExternal(cb, signal) {
      window.addEventListener(
        'popstate',
        (e) => {
          const state: unknown = (e as PopStateEvent).state
          if (isStampedState(state)) cb(null, state.uiRouter.index)
          else cb(location.pathname + location.search, null) // un-stamped — adopt-as-push (LLD-C6)
        },
        { signal },
      )
    },
  }
}

function formatQuery(match: RouteMatch): string {
  const qs = new URLSearchParams(match.query).toString()
  return qs ? `${match.path}?${qs}` : match.path
}

const CONNECTED = new WeakSet<Router>()

/**
 * Attach opt-in URL reflection to `router`. Default `mode: 'hash'`. Returns `cleanup()`, which removes
 * every listener, disposes the outbound effect, and restores pure memory operation. A second
 * `connectUrl` on the same router without an intervening `cleanup()` throws (two writers would fork the
 * truth, SPEC-R4). Throws immediately when `location` is absent (a headless host simply never calls it).
 */
export function connectUrl(router: Router, opts?: { mode?: 'hash' | 'history' }): () => void {
  if (typeof location === 'undefined') {
    throw new Error('@agent-ui/router: connectUrl() requires a `location` global — a headless host never calls it')
  }
  if (CONNECTED.has(router)) {
    throw new Error('@agent-ui/router: connectUrl() called twice on the same router without an intervening cleanup()')
  }
  CONNECTED.add(router)

  const internal = router as RouterInternal
  const strategy = (opts?.mode ?? 'hash') === 'history' ? historyStrategy() : hashStrategy()
  internal.urlFormat = strategy.format

  const ac = new AbortController()
  const scope = createScope()

  // The URL is currently believed to hold this path+query — the echo-lock's single source of truth
  // (see the file header). `null` until the first read/write.
  let lastReflected: string | null = null

  const write = (path: string, replace: boolean): void => {
    lastReflected = path
    strategy.write(path, replace, internal.historyIndex)
  }

  // The memory stack's index last OBSERVED by this adapter — `null` until the first observation. Derives
  // replace-vs-push from how the index moved (`MemoryHistory.push` advances it, `.replace` does not),
  // rather than a one-shot flag: a fragile `first`-boolean (this file's earlier shape) can only ever
  // represent "was this the very first write", NOT "was THIS SPECIFIC navigation a replace or a push" —
  // component review caught it going wrong two ways: (a) adoption's own `router.navigate()` makes the
  // outbound effect's first run a same-value no-op (`formatted === lastReflected` below), so a `first`
  // flag consumed only inside that effect was never actually consumed there and leaked into the NEXT
  // real navigation, wrongly forcing replace on it (always-on in history mode, since
  // `historyStrategy.read()` never returns null); (b) even where `first` WAS consumed on schedule, it
  // still couldn't distinguish a later `navigate(path, {replace:true})` from a later push — both simply
  // observed `first === false` and always wrote push, regardless of the caller's actual intent. The index
  // comparison fixes both: `lastIndex === null` (nothing observed yet, whether via adoption or the
  // effect's own first run) forces replace once, same as SPEC-R4 AC2/AC6 require; afterward, an unchanged
  // index means a genuine memory-level `.replace()` happened (write replace), an advanced index means a
  // genuine `.push()` (or back/forward/adopt landing already filtered out by the `lastReflected` check
  // below) happened (write push).
  let lastIndex: number | null = null

  const reflect = (path: string): void => {
    const idx = internal.historyIndex
    const replace = lastIndex === null || idx === lastIndex
    lastIndex = idx
    write(path, replace)
  }

  // ---- Adoption (deep-link-wins, SPEC-R4) — read the existing URL BEFORE any listener attaches. ----
  const existing = strategy.read()
  if (existing !== null) {
    lastReflected = existing // the URL already holds this value — mark it reflected before navigating
    router.navigate(existing, { replace: true })
    // Explicitly perform the first-write HERE rather than relying on the outbound effect's first run
    // (which is a guaranteed no-op immediately after adoption, since the route it just adopted already
    // equals `lastReflected`): stamps the loaded entry in history mode (AC6), is a same-value/no-op-safe
    // write in hash mode, and — critically — observes `lastIndex` so it can never leak a stale replace
    // decision into a later real navigation.
    reflect(existing)
  }

  // ---- Outbound sync — ONE effect drives every write, whichever direction caused the route change. ----
  scope.run(() =>
    effect(() => {
      const current = router.route.value
      if (current === null) return
      const formatted = formatQuery(current)
      if (formatted === lastReflected) return // the URL already reflects this — echo or already-applied, skip
      reflect(formatted)
    }),
  )

  // ---- Inbound (external platform changes) — hashchange / popstate. ----
  strategy.onExternal((path, stampedIndex) => {
    if (stampedIndex !== null) {
      const landed = internal.adoptAtIndex(stampedIndex)
      if (landed !== null) {
        lastReflected = strategy.read() // the browser already updated location — nothing to write back
        return
      }
      // AC6 — a stamped index outside this session's stack (reload/restored session: the memory stack
      // always starts at ONE entry while the browser stack may carry stamps from the prior page life).
      // Adopt the CURRENT url as a new push — never throw, never attempt to resolve a non-existent index.
      const currentUrl = strategy.read()
      if (currentUrl !== null) {
        lastReflected = currentUrl
        router.navigate(currentUrl, { replace: false })
      }
      return
    }
    if (path === null) return // "not ours" (a non-route hash) — LLD-C6 edge, ignored
    if (path === lastReflected) return // our own echo (or a genuine no-op re-edit) — suppressed
    lastReflected = path
    router.navigate(path, { replace: false }) // an external edit / un-stamped popstate — push semantics
  }, ac.signal)

  return function cleanup(): void {
    ac.abort()
    scope.dispose()
    internal.urlFormat = null
    CONNECTED.delete(router)
  }
}
