// list.ts — positional dynamic-list renderer (renderer LLD-C6, SPEC-R6 / ADR-0024 — vehicle B2).
//
// A container whose `children` is a TEMPLATE (`{ path, componentId }`, A2UI v1.0) renders one instance
// of `componentId` per element of the array at `path` — POSITIONALLY. v1.0 has no per-item key: items
// match by array INDEX, so the reconcile is a bespoke kernel loop (NOT the `repeat` directive, which is
// the KEYED-list vehicle — ADR-0022/#69 — whose focus-preserving move a positional list never exercises).
//
// The loop is a `surface.scope` `effect` over a LENGTH-computed:
//   • length-computed = `computed(() => Array.isArray(arr) ? arr.length : 0)` over the bound array. The
//     kernel's `Object.is` cutoff means a SAME-length data write (a mid-array element edit) does NOT wake
//     this effect — the array's `/items` ref changes (structural-sharing `setPointer`), but the length
//     value is unchanged, so the computed's version does not bump and the effect stays asleep. The per-
//     item bound-prop effects (each in its own child scope, subscribed to `/items/{i}/…`) do that re-bind.
//   • grow: while there are fewer instances than the length, append a new instance at the next index.
//   • shrink: while there are more, dispose+detach the TRAILING instance. Boundary-only (SPEC-R6 AC1).
//
// Each instance is a SINGLE-ROOT `ui-*` built via `createWidget(templateNode, surface, childScope, {path,
// index})` in a per-index CHILD scope (`createScope` under `surface.scope`). The child scope owns the
// item's bound-prop effects, so a positional removal disposes them with the item — never leaking into
// `surface.scope` (SPEC-N3). A mid-array insert/remove changes the length, so the boundary instance is
// added/removed and EVERY surviving instance RE-BINDS reactively (instance `i` re-resolves `/items/{i}`) —
// the DOM is never moved or re-created for an unaffected index; the per-path computeds (LLD-C5) do the work.
//
// Teardown. Kernel scopes are FLAT — a `createScope()` child is NOT auto-disposed by its parent. So a
// no-source `effect` in `surface.scope` carries the teardown: its cleanup (which fires ONLY on dispose,
// never on a re-run, because it subscribes to nothing) disposes every still-live item scope. Combined
// with the shrink path's per-removal dispose, no item scope outlives the surface (SPEC-N3, leak-free).
//
// Out of scope (deferred, per ADR-0024): `@index` belongs to the LLD-C10 function evaluator — this module
// only EXPOSES the index via the `itemScope` so C10 can read it. Templates are single-root (createWidget
// does not recurse into a template's own children/child); a subtree-per-item template and nested lists
// (a relative template `path`) are follow-ups, not this slice.

import { computed, createScope, effect } from '@agent-ui/components'
import type { Scope } from '@agent-ui/components'
import type { A2uiChildTemplate, A2uiComponent } from '../protocol.ts'
import type { Surface } from './surface.ts'
import type { CreateWidget, ItemScope } from './types.ts'
import { resolve } from './binding.ts'

/** One rendered list item: its single-root control + the per-index child scope owning its bind effects. */
interface ListItem {
  el: HTMLElement
  scope: Scope
}

/**
 * Drive a positional dynamic list under `container` (renderer LLD-C6 / ADR-0024). Instantiates the
 * template's `componentId` once per element of the array at `template.path`, growing/shrinking by index
 * on a length change and disposing each removed item's child scope (no leak). Wires its loop + teardown
 * into `surface.scope`, so a `deleteSurface` disposes everything. Returns nothing — the surface owns the
 * lifetime.
 */
export function renderList(deps: {
  container: HTMLElement
  template: A2uiChildTemplate
  surface: Surface
  createWidget: CreateWidget
}): void {
  const { container, template, surface, createWidget } = deps
  const items: ListItem[] = []

  // The bound array's length, as a computed so the reconcile effect wakes ONLY on a length delta — a
  // same-length element edit re-resolves the array but keeps this value, so the `Object.is` cutoff
  // settles it without re-running the loop (the per-item effects re-bind instead, SPEC-N2).
  const lengthSignal = surface.scope.run(() =>
    computed(() => {
      const arr = resolve({ path: template.path }, surface)
      return Array.isArray(arr) ? arr.length : 0
    }),
  )

  const appendInstance = (index: number, templateNode: A2uiComponent): void => {
    const childScope = createScope() // per-index; flat scope, torn down on removal / surface teardown
    const itemScope: ItemScope = { path: template.path, index }
    const el = createWidget(templateNode, surface, childScope, itemScope)
    container.appendChild(el)
    items.push({ el, scope: childScope })
  }

  const removeLast = (): void => {
    const item = items.pop()
    if (item === undefined) return
    item.scope.dispose() // dispose the item's bound-prop effects → zero residual subscribers (SPEC-N3)
    item.el.remove() // detach the trailing instance from the container
  }

  // Reconcile loop: positional grow/shrink to the current length (boundary-only, SPEC-R6 AC1). Owned by
  // surface.scope so it disposes with the surface; its first run is synchronous (initial render).
  surface.scope.run(() =>
    effect(() => {
      const len = lengthSignal.value
      const templateNode = surface.components.get(template.componentId)
      // Template not yet delivered (a legal transient, SPEC-R4): render nothing rather than spin. (It is
      // present by the time the container mounts in the ordinary in-order case; out-of-order template
      // arrival is a follow-up — `components` is a plain Map, not reactive, so this will not re-run on it.)
      if (templateNode === undefined) {
        while (items.length > 0) removeLast()
        return
      }
      while (items.length < len) appendInstance(items.length, templateNode)
      while (items.length > len) removeLast()
    }),
  )

  // Teardown carrier (FLAT scopes do not cascade). Subscribes to nothing ⇒ its cleanup fires ONLY when
  // surface.scope disposes it, never on a reconcile re-run — disposing every item scope still live at
  // teardown so no item's effects outlive the surface (SPEC-N3).
  surface.scope.run(() =>
    effect(() => () => {
      for (const item of items) item.scope.dispose()
      items.length = 0
    }),
  )
}
