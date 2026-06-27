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
// Absolute pointers only. Relative-path / list-item resolution (the `itemScope` argument, reserved
// below) is LLD-C6, gated on G3 `repeat`. Literal (non-`{path}`) values are split out upstream in
// widget.ts (`isBinding`), so this module only ever sees the `{path}` branch.

import { computed } from '@agent-ui/components'
import type { ReadonlySignal } from '@agent-ui/components'
import type { Surface } from './surface.ts'

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
 * Resolve a `{path}` binding to its current value off `surface.data` (renderer LLD-C5). Reading the
 * memoized path-signal's `.value` inside the calling bound-prop effect makes that effect depend ONLY on
 * this path's computed, so an unrelated data write never re-applies the prop (SPEC-N2).
 *
 * Signature-compatible with the pinned `WidgetDeps.resolveBinding` (widget.ts) — the host wires
 * `resolveBinding: (b, s) => resolve(b, s)` with zero widget.ts change. `_itemScope` is RESERVED for the
 * list-item / relative-path resolution that lands in LLD-C6 (G3 `repeat`); it is typed but unused today,
 * so a relative path with no scope resolves as it does now (→ `undefined`).
 */
export function resolve(binding: { path: string }, surface: Surface, _itemScope?: unknown): unknown {
  return pathSignal(surface, binding.path).value
}
