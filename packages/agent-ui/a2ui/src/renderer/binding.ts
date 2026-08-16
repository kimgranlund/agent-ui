// binding.ts — per-path binding resolver (renderer LLD-C5, SPEC-N2/R5/R4-AC2/N3).
//
// Resolves a `{path}` binding to its current value off `surface.data` and — this is the load-bearing
// part — does so through a per-path memoized COMPUTED so a data-model change wakes ONLY the widgets
// bound to the path that actually changed (SPEC-N2 fine-grained waking), replacing the renderer's
// coarse interim resolver (an absolute pointer read off `surface.data.value` inside every bound-prop
// effect, which re-ran every effect on every `updateDataModel`).
//
// The mechanism is path-granular WAKING, not path-granular invalidation. There is ONE writable signal
// (`surface.data`); every path is a `computed(() => resolvePointer(surface.data.value, pointer))` over
// it. A write marks every path computed possibly-stale, but the kernel's equality cutoff settles each
// one before its downstream effect runs: a computed that re-resolves to an `Object.is`-equal value does
// NOT bump its version (graph.ts), so the bound-prop effect's verification concludes "unchanged" and
// skips its body. That cutoff only bites because `setPointer` is IMMUTABLE with structural sharing —
// an untouched sibling subtree keeps its reference identity across a write, so a `/b` binding resolves
// to the same object after a `/a` write and stays asleep. `setPointer` is therefore the cutoff enabler,
// not an implementation detail: it must never deep-clone.
//
// The memo is a module-private `WeakMap<Surface, Map<pointer, ReadonlySignal>>` — per surface, per
// pointer. Keeping it here (not on `Surface`) leaves surface.ts untouched. Each path computed is created
// INSIDE `surface.scope`, so `scope.dispose()` on `deleteSurface` disposes every one of them and the
// data signal drops to zero subscribers (SPEC-N3, leak-free).
//
// Absolute AND list-item-relative pointers. A list item's `itemScope` ({path,index}, LLD-C6/ADR-0024)
// rewrites a RELATIVE binding (no leading `/`) to its absolute pointer `{path}/{index}/…` BEFORE the
// memo — so the memo still keys on the resolved ABSOLUTE pointer (`/items/0/x` ≠ `/items/1/x`) and needs
// no itemScope key. With no itemScope a relative path resolves as it did before (→ `undefined`); an
// absolute path is unchanged. Literal (non-`{path}`) values are split out upstream in widget.ts
// (`isBinding`), so this module only ever sees the `{path}` branch.

import { computed } from '@agent-ui/components'
import type { ReadonlySignal } from '@agent-ui/components'
import type { Surface } from './surface.ts'
import type { ItemScope } from './types.ts'

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Decode one RFC-6901 reference token (`~1`→`/`, `~0`→`~`). */
const decodeToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~')

/**
 * Read an absolute RFC-6901 pointer off a document, or `undefined` if any step is absent (a render-time
 * placeholder, SPEC-R4 AC2 — never an error). Relative/list-scope pointers are LLD-C6's concern.
 */
function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === '') return doc
  if (pointer[0] !== '/') return undefined
  let cur: unknown = doc
  for (const raw of pointer.slice(1).split('/')) {
    const key = decodeToken(raw)
    if (Array.isArray(cur)) cur = cur[Number(key)]
    else if (isObject(cur)) cur = cur[key]
    else return undefined
    if (cur === undefined) return undefined
  }
  return cur
}

/**
 * Immutably set `value` at an absolute RFC-6901 `pointer` within `doc`, materializing missing objects.
 * Structural sharing is load-bearing: only the nodes ALONG the path are copied; every untouched sibling
 * subtree is carried over by reference, which is what lets the kernel's `Object.is` cutoff keep
 * unrelated bindings asleep (SPEC-N2). Do NOT deep-clone. Relocated verbatim from the renderer's interim
 * resolver; the host's `updateDataModel` imports it (LLD-C5 B2 rewire).
 */
export function setPointer(doc: unknown, pointer: string, value: unknown): unknown {
  const tokens = pointer.slice(1).split('/').map(decodeToken)
  const set = (node: unknown, i: number): unknown => {
    if (i === tokens.length) return value
    const key = tokens[i]!
    if (Array.isArray(node)) {
      const copy = node.slice()
      copy[Number(key)] = set(node[Number(key)], i + 1)
      return copy
    }
    const base = isObject(node) ? node : {}
    return { ...base, [key]: set(base[key], i + 1) }
  }
  return set(doc, 0)
}

/** Encode one RFC-6901 reference token (`~`→`~0`, `/`→`~1`) — the inverse of `decodeToken`. */
const encodeToken = (token: string): string => token.replace(/~/g, '~0').replace(/\//g, '~1')

/** Append one property key to an existing absolute pointer, encoding it as an RFC-6901 token. */
const joinPointer = (base: string, key: string): string => `${base}/${encodeToken(key)}`

const isDraftable = (v: unknown): v is Record<string, unknown> | unknown[] => Array.isArray(v) || isObject(v)

/**
 * Per-proxy bookkeeping for `unwrap` below: `original` is the untouched value the proxy was created
 * from (returned verbatim — same reference — when the proxy was never itself written to, preserving
 * structural sharing for a value the recipe only READ, e.g. `draft.items = [...draft.items, next]` must
 * keep every untouched element's identity); `target` is the private shallow clone `set` writes land on;
 * `dirty` flips true the moment THIS proxy's own `set` trap fires (a descendant's write does not dirty
 * an ancestor — each write already records its own absolute pointer independently).
 */
interface DraftEntry {
  readonly original: unknown
  readonly target: Record<string, unknown> | unknown[]
  dirty: boolean
}
const registry = new WeakMap<object, DraftEntry>()

/**
 * Resolve any value a recipe is about to hand to `setPointer` down to something that can never contain
 * one of our recording proxies — GH #976 review finding: a naive record-and-replay leaks live Proxy
 * objects into the returned data model the instant a recipe re-embeds a draft READ (`draft.b = draft.a`,
 * `draft.copy = {...draft.user}`, the module's own recommended `draft.items = [...draft.items, next]`
 * idiom), which both breaks `Object.is`/structural-sharing identity for untouched values and would hand
 * a live Proxy to a consumer (e.g. `structuredClone`/postMessage) never written to at all.
 *
 * A registered, untouched (`dirty: false`) proxy unwraps to its `original` reference — identity-preserving,
 * the whole point. A registered, WRITTEN (`dirty: true`) proxy unwraps to a fresh shallow copy of its
 * current `target` (never the live `target` object itself — that object keeps receiving further writes
 * for the rest of the recipe, so handing it out live would let an EARLIER recorded write silently observe
 * LATER mutations through the shared reference; the copy freezes what was true at unwrap time). Any other
 * array/object is walked structurally, reusing the same input reference when nothing inside it needed
 * unwrapping (no needless reallocation of ordinary literal data).
 */
function unwrap(v: unknown): unknown {
  if (typeof v !== 'object' || v === null) return v
  const entry = registry.get(v)
  if (entry !== undefined) {
    if (!entry.dirty) return entry.original
    return Array.isArray(entry.target) ? entry.target.slice() : { ...entry.target }
  }
  if (Array.isArray(v)) {
    let changed = false
    const out = v.map((el) => {
      const u = unwrap(el)
      if (u !== el) changed = true
      return u
    })
    return changed ? out : v
  }
  if (isObject(v)) {
    let changed = false
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v)) {
      const u = unwrap(v[k])
      if (u !== v[k]) changed = true
      out[k] = u
    }
    return changed ? out : v
  }
  return v
}

/**
 * A recording Proxy over `value` (renderer LLD-C5 extension, GH #976): reading an object/array-valued
 * property returns another recording proxy (cached per key, so re-reading the SAME nested property after
 * a write sees that write — draft read-after-write consistency, invalidated on the next write to that
 * key); WRITING a property `unwrap`s the assigned value first (so no live proxy is ever recorded or
 * stored), pushes `[absolute pointer, unwrapped value]` onto `writes`, and applies the unwrapped value to
 * a private shallow clone — never to `value` itself. Only PROPERTY ASSIGNMENT is recorded — array mutator
 * methods and `length` writes (`push`/`splice`/`length = n`/…) are not draft-aware and would otherwise
 * silently corrupt the array (an RFC-6901 `setPointer` write to a `"length"`/`"NaN"` key is nonsense), so
 * they THROW instead — out of this bounded helper's scope by design (reassign the whole array instead:
 * `draft.items = [...draft.items, next]`). `delete` is likewise unsupported (`setPointer` cannot express
 * removal) and throws rather than silently applying to the clone alone and vanishing from the write set.
 */
function draftProxy(value: unknown, pointer: string, writes: Array<[string, unknown]>): unknown {
  if (!isDraftable(value)) return value
  const target = Array.isArray(value) ? value.slice() : { ...value }
  const entry: DraftEntry = { original: value, target, dirty: false }
  const children = new Map<string, unknown>()
  const proxy = new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(t, prop, receiver)
      const v = Reflect.get(t, prop, receiver)
      if (!isDraftable(v)) return v
      let child = children.get(prop)
      if (child === undefined) {
        child = draftProxy(v, joinPointer(pointer, prop), writes)
        children.set(prop, child)
      }
      return child
    },
    set(t, prop, v, receiver) {
      if (typeof prop !== 'string') return Reflect.set(t, prop, v, receiver)
      if (Array.isArray(t) && prop === 'length') {
        throw new TypeError(
          'mutate(): array mutator methods (push/splice/…) and length writes are out of scope — reassign the whole array instead (draft.items = [...draft.items, next])',
        )
      }
      const unwrapped = unwrap(v)
      writes.push([joinPointer(pointer, prop), unwrapped])
      children.delete(prop) // invalidate any cached child proxy — a re-read must reflect this write
      entry.dirty = true
      return Reflect.set(t, prop, unwrapped, receiver)
    },
    deleteProperty() {
      throw new TypeError('mutate(): delete is not supported — setPointer cannot express removal; reassign the parent object instead')
    },
  })
  registry.set(proxy, entry)
  return proxy
}

/**
 * `mutate(doc, path, recipe)` — draft-first authoring ergonomics over `setPointer` (GH #976, prompted by
 * Solid 2.0 RC's draft-first stores). `recipe` receives a DRAFT of the subtree at `path` and mutates it
 * directly (`draft.count = draft.count + 1`, `draft.user.name = 'Ana'`); `mutate` RECORDS each property
 * assignment made on the draft as it happens — it never diffs a before/after snapshot — and replays the
 * recordings, in the order made, as the SAME `setPointer` writes a caller would otherwise hand-write.
 *
 * Purely additive authoring sugar: the per-path binding mechanism (Object.is cutoff, structural sharing)
 * is untouched underneath — every replayed write is a real `setPointer` call, so a path the recipe never
 * touched keeps its reference identity exactly as it would from a hand-written write (SPEC-N2 stays
 * intact). Synchronous, like the rest of this module — no scheduling of its own.
 */
export function mutate<T = unknown>(doc: unknown, path: string, recipe: (draft: T) => void): unknown {
  if (path !== '' && path[0] !== '/') {
    throw new TypeError(`mutate(): path must be '' (whole doc) or an absolute RFC-6901 pointer starting with '/', got ${JSON.stringify(path)}`)
  }
  const base = resolvePointer(doc, path)
  const writes: Array<[string, unknown]> = []
  const draft = draftProxy(isDraftable(base) ? base : {}, path, writes)
  recipe(draft as T)
  return writes.reduce<unknown>((acc, [pointer, value]) => setPointer(acc, pointer, value), doc)
}

// ── per-path computed memo ────────────────────────────────────────────────────────────

/** Per-surface, per-pointer memo of resolution computeds. WeakMap ⇒ collected with the surface. */
const memo = new WeakMap<Surface, Map<string, ReadonlySignal<unknown>>>()

/**
 * The memoized resolution computed for `pointer` on `surface`. On a miss it is created INSIDE
 * `surface.scope` (so `scope.dispose()` disposes it, SPEC-N3) and cached; subsequent reads of the same
 * pointer — from any widget — reuse the one computed, so a data change drives at most one pointer walk
 * per distinct path. The computed subscribes to `surface.data`; its `Object.is` cutoff is what delivers
 * per-path waking (see the module header).
 */
function pathSignal(surface: Surface, pointer: string): ReadonlySignal<unknown> {
  let byPath = memo.get(surface)
  if (byPath === undefined) {
    byPath = new Map()
    memo.set(surface, byPath)
  }
  const existing = byPath.get(pointer)
  if (existing !== undefined) return existing
  const sig = surface.scope.run(() => computed(() => resolvePointer(surface.data.value, pointer)))
  byPath.set(pointer, sig)
  return sig
}

/**
 * Rewrite a binding path to the ABSOLUTE pointer the memo keys on (renderer LLD-C6 / ADR-0024). A path
 * with a leading `/` is already absolute (resolves from the data root — the ordinary case). A RELATIVE
 * path (no leading `/`) resolves WITHIN a list item's scope: `{path}/{index}` for the item itself (an
 * empty relative path) else `{path}/{index}/{rest}`. With no `itemScope` the path is returned unchanged,
 * preserving the pre-list behavior (a bare relative path then walks to `undefined` in `resolvePointer`).
 * Exported so the write-side controller (input.ts LLD-C8) resolves the same absolute pointer on writeback
 * — both directions key on the same rewrite, so a relative two-way binding reads and writes symmetrically.
 */
export function scopedPointer(path: string, itemScope?: ItemScope): string {
  if (path.startsWith('/')) return path
  if (itemScope === undefined) return path
  return path === '' ? `${itemScope.path}/${itemScope.index}` : `${itemScope.path}/${itemScope.index}/${path}`
}

/**
 * Resolve a `{path}` binding to its current value off `surface.data` (renderer LLD-C5/C6). Reading the
 * memoized path-signal's `.value` inside the calling bound-prop effect makes that effect depend ONLY on
 * this path's computed, so an unrelated data write never re-applies the prop (SPEC-N2). `itemScope`, when
 * present (a list item, LLD-C6/ADR-0024), rewrites a relative path to its absolute pointer FIRST, so the
 * per-path memo still keys on the resolved absolute pointer — `/items/0/x` and `/items/1/x` are distinct
 * computeds. Signature-compatible with the pinned `WidgetDeps.resolveBinding` (widget.ts).
 */
export function resolve(binding: { path: string }, surface: Surface, itemScope?: ItemScope): unknown {
  return pathSignal(surface, scopedPointer(binding.path, itemScope)).value
}
