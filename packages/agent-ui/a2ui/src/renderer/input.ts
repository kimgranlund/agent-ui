// input.ts — generic two-way input binding controller (renderer LLD-C8, SPEC-R7; scheduled by ADR-0019;
// widened to one-or-more slots by ADR-0161).
//
// The reverse of the bound-prop effect (widget.ts LLD-C7 wires data→control; this wires control→data).
// For an input widget — one whose catalog `WidgetFactory` carries a `value` mark (`ValueSlot | ValueSlot[]`,
// ADR-0161) — this installs ONE listener PER SLOT on that slot's declared commit event, each writing its
// own freshly committed prop back into `surface.data` at its own bound path. It is a single GENERIC
// controller: every branch is driven by the factory mark + the node's binding, never by a component name,
// so Tabs `selected`, Modal `open`, the back-filled text-field `value` (ADR-0019), and a multi-slot commit
// like Calendar's range pair (ADR-0161) all flow through the same code with zero per-control special-casing.
//
// Three load-bearing properties, now applied PER SLOT (`valueSlots(mark)`, catalog.ts — the single-object
// form is a one-element loop, byte-equivalent to the pre-ADR-0161 controller):
//   • Opt-in by the factory mark, per slot. No `value` on the factory ⇒ no listener at all (a non-input
//     control like `ui-button` is left untouched). A slot whose node prop is a literal (not a `{path}`) ⇒
//     no listener for THAT slot: there is no writeback target, so two-way binding is vacuous for it. A
//     payload may bind a subset of slots — the controller never installs a listener it cannot honour.
//   • Scope-owned, zero-residue teardown. Every slot's listener is registered with the SAME `ac.signal`
//     (`surface.ac` or the per-item AbortController), so `disposeSurface`'s `ac.abort()` removes them all
//     with every other surface listener (SPEC-N3) — no manual cleanup, no leak. A late commit event after
//     teardown is therefore inert.
//   • Optimistic + per-path waking, per slot. Each slot's writeback goes through binding LLD-C5's
//     structural-sharing `setPointer`, so only the nodes ALONG that slot's written path are copied and
//     every untouched sibling subtree keeps its reference identity. The kernel's `Object.is` cutoff then
//     wakes ONLY the bindings on the path that actually changed (SPEC-N2) — a sibling field's bound-prop
//     effect stays asleep. Several slots sharing one event (Calendar's range pair) write synchronously in
//     slot-declaration order, so a subsequent action's `collectContext` (LLD-C9, already shipped) reads
//     every committed slot straight off the data model — input feeds action with no extra wiring here.
//
// Write-side itemScope (ADR-0024 amendment, LLD-C8). A relative binding inside a list item must write
// the same absolute pointer it reads. `installInputBinding` accepts a trailing optional `itemScope` —
// the same `{path, index}` the list renderer passes to `createWidget` — and resolves EACH slot's
// writeback target through the shared `scopedPointer` rewrite (binding.ts). An absolute path or no
// itemScope is unchanged; the no-itemScope path is byte-for-byte the pre-list behavior.
//
// `slot.prop` names BOTH sides of the round-trip by contract: the A2UI node prop that carries the bind
// (`node[prop]` → the `{path}` writeback target) and the DOM value property read off the control on
// commit (`el[prop]` → the committed value). The default catalog names them to match by design. If a
// future control's commit/value shape cannot be expressed by one-or-more `{ prop, event }` slots, that is
// a catalog SPEC gap (ADR-0019 discovered-reality guard) — repair `a2ui-catalog` and re-derive, do not
// improvise here.

import type { A2uiComponent } from '../protocol.ts'
import type { WidgetFactory } from '../catalog/types.ts'
import { valueSlots } from '../catalog/catalog.ts'
import type { Surface } from './surface.ts'
import type { ItemScope } from './types.ts'
import { scopedPointer, setPointer } from './binding.ts'

/** A bound prop value: a JSON-Pointer reference rather than a literal — the writeback target. Mirrors
 *  widget.ts's `isBinding` (the same protocol `Binding` shape) so both sides judge a bind identically. */
const isBinding = (v: unknown): v is { path: string } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { path?: unknown }).path === 'string'

/**
 * Install the two-way input bind for one widget (renderer LLD-C8, SPEC-R7; ADR-0161). A no-op unless
 * the factory carries a `value` mark; otherwise it normalizes the mark to slots (`valueSlots`) and, for
 * each slot whose node prop is a `{path}` binding, listens on that slot's `event` and, on each commit,
 * writes the control's current `slot.prop` into `surface.data` at the bound path via the structural-
 * sharing `setPointer` (so per-path waking holds, SPEC-N2). The write is optimistic and untracked
 * (`peek` base ⇒ the handler never subscribes to data). A single-object mark is a one-element loop —
 * byte-equivalent to the pre-ADR-0161 controller.
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
  const mark = factory.value
  if (mark === undefined) return // non-input control — no commit event to bind (opt-in by the factory mark)

  // ADR-0161: apply today's per-mark rules PER SLOT. A single-object mark is a one-element loop —
  // behaviorally byte-equivalent to the pre-ADR-0161 controller. Several slots on one event (the
  // Calendar range pair) install several listeners on that event; all writes land synchronously,
  // in slot-declaration order, so a subsequent action's dataModel snapshot sees every committed slot.
  for (const slot of valueSlots(mark)) {
    const bound = node[slot.prop]
    if (!isBinding(bound)) continue // per-slot opt-in — a slot the payload didn't bind installs no listener

    const valuePath = scopedPointer(bound.path, itemScope)
    el.addEventListener(
      slot.event,
      () => {
        const committed = (el as unknown as Record<string, unknown>)[slot.prop]
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
}
