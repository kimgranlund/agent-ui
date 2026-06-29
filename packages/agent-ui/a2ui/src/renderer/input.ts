// input.ts — generic two-way input binding controller (renderer LLD-C8, SPEC-R7; scheduled by ADR-0019).
//
// The reverse of the bound-prop effect (widget.ts LLD-C7 wires data→control; this wires control→data).
// For an input widget — one whose catalog `WidgetFactory` carries a `value: { prop, event }` mark — this
// installs ONE listener on the control's declared commit event that writes the freshly committed value
// back into `surface.data` at the bound path. It is a single GENERIC controller: every branch is driven
// by the factory mark + the node's binding, never by a component name, so Tabs `selected`, Modal `open`,
// and the back-filled text-field `value` (ADR-0019) all flow through the same code with zero per-control
// special-casing.
//
// Three load-bearing properties:
//   • Opt-in by the factory mark. No `value` on the factory ⇒ no listener (a non-input control like
//     `ui-button` is left untouched). A `value` mark whose node prop is a literal (not a `{path}`) ⇒ also
//     no listener: there is no writeback target, so two-way binding is vacuous. The controller never
//     installs a listener it cannot honour.
//   • Scope-owned, zero-residue teardown. The listener is registered with `surface.ac.signal`, so
//     `disposeSurface`'s `ac.abort()` removes it with every other surface listener (SPEC-N3) — no manual
//     cleanup, no leak. A late commit event after teardown is therefore inert.
//   • Optimistic + per-path waking. The writeback goes through binding LLD-C5's structural-sharing
//     `setPointer`, so only the nodes ALONG the written path are copied and every untouched sibling
//     subtree keeps its reference identity. The kernel's `Object.is` cutoff then wakes ONLY the bindings
//     on the path that actually changed (SPEC-N2) — a sibling field's bound-prop effect stays asleep.
//     The new value lands in `surface.data` synchronously, so a subsequent action's `collectContext`
//     (LLD-C9, already shipped) reads it straight off the data model — input feeds action with no extra
//     wiring here.
//
// Write-side itemScope (ADR-0024 amendment, LLD-C8). A relative binding inside a list item must write
// the same absolute pointer it reads. `installInputBinding` accepts a trailing optional `itemScope` —
// the same `{path, index}` the list renderer passes to `createWidget` — and resolves the writeback
// target through the shared `scopedPointer` rewrite (binding.ts). An absolute path or no itemScope is
// unchanged; the no-itemScope path is byte-for-byte the pre-list behavior.
//
// `value.prop` names BOTH sides of the round-trip by contract: the A2UI node prop that carries the bind
// (`node[prop]` → the `{path}` writeback target) and the DOM value property read off the control on
// commit (`el[prop]` → the committed value). The default catalog names them to match by design. If a
// future control's commit/value shape cannot be expressed by `{ prop, event }`, that is a catalog SPEC
// gap (ADR-0019 discovered-reality guard) — repair `a2ui-catalog` and re-derive, do not improvise here.

import type { A2uiComponent } from '../protocol.ts'
import type { WidgetFactory } from '../catalog/types.ts'
import type { Surface } from './surface.ts'
import type { ItemScope } from './types.ts'
import { scopedPointer, setPointer } from './binding.ts'

/** A bound prop value: a JSON-Pointer reference rather than a literal — the writeback target. Mirrors
 *  widget.ts's `isBinding` (the same protocol `Binding` shape) so both sides judge a bind identically. */
const isBinding = (v: unknown): v is { path: string } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { path?: unknown }).path === 'string'

/**
 * Install the two-way input bind for one widget (renderer LLD-C8, SPEC-R7). A no-op unless the factory
 * marks a `value: { prop, event }` AND the node's `value.prop` is a `{path}` binding — then it listens
 * on `value.event` and, on each commit, writes the control's current `value.prop` into `surface.data` at
 * the bound path via the structural-sharing `setPointer` (so per-path waking holds, SPEC-N2). The write
 * is optimistic and untracked (`peek` base ⇒ the handler never subscribes to data).
 *
 * `itemScope`, when present (a list item, ADR-0024 amendment), rewrites a RELATIVE bound path to its
 * absolute pointer `{path}/{index}/…` via `scopedPointer` — symmetric with the read direction — so a
 * relative two-way binding reads and writes the same `/items/{i}/x` pointer. An absolute path or absent
 * itemScope is unchanged, preserving the pre-list no-itemScope behavior byte-for-byte.
 *
 * `ac` defaults to `surface.ac` (the surface lifetime). The list renderer passes a per-item
 * AbortController (created in `appendInstance` and aborted in `removeLast`) so the listener is
 * gated on the item's lifetime, not the surface's. This is the SPEC-N3 item-granular listener
 * discipline: a removed list item immediately loses its commit listener so churn does not accumulate
 * registrations on `surface.ac`. A late commit on the detached element is then also silently inert.
 *
 * Called by widget resolution (LLD-C7) right after the control + bound props are wired; everything it
 * needs is in scope there. Generic by construction — no component name appears below.
 */
export function installInputBinding(
  el: HTMLElement,
  factory: WidgetFactory,
  node: A2uiComponent,
  surface: Surface,
  itemScope?: ItemScope,
  ac: AbortController = surface.ac,
): void {
  const spec = factory.value
  if (spec === undefined) return // non-input control — no commit event to bind (opt-in by the factory mark)

  const bound = node[spec.prop]
  if (!isBinding(bound)) return // value is a literal/absent — no `{path}` to write back to, nothing to bind

  const valuePath = scopedPointer(bound.path, itemScope)
  el.addEventListener(
    spec.event,
    () => {
      const committed = (el as unknown as Record<string, unknown>)[spec.prop]
      // Optimistic, structural-sharing write (binding LLD-C5): copies only the path, so unrelated
      // bindings stay Object.is-equal and asleep (SPEC-N2). peek() base ⇒ the handler stays untracked.
      surface.data.value = setPointer(surface.data.peek(), valuePath, committed)
    },
    // `ac` is surface.ac by default (static nodes) or the per-item AbortController (list items).
    // Either abort removes the listener: the per-item abort fires on positional removal
    // (list.ts removeLast), the surface abort fires on disposeSurface (SPEC-N3, zero residue).
    { signal: ac.signal },
  )
}
