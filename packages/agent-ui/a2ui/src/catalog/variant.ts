// variant.ts — variant-dispatch resolution (catalog LLD-C3/C5, GH #545).
//
// The runtime half of `types.ts`'s `VariantDispatch`: `types.ts` stays pure (`import type` only, zero
// runtime, per its own header) so the resolution logic — a real function, called on every widget
// mint/rewire — lives here instead. Two callers: the renderer's widget resolution (`renderer/widget.ts`
// `create`/`wireProps`, LLD-C7) and the renderer host's structural-resend `resetProp` branch
// (`renderer/renderer.ts`, RSR-C2/ADR-0128) — both replace a raw `entry.factories[node.component]`
// index with `resolveFactory(entry?.factories[node.component], node)`. The registry's own
// `submitGateSelector` (catalog LLD-C3, ADR-0054) uses `factoriesOf` to fan a dispatch table's SEVERAL
// concrete factories into the same aggregate, since a variant arm may carry its own `submitGate` mark.

import type { A2uiComponent } from '../protocol.ts'
import type { VariantDispatch, WidgetFactory } from './types.ts'

/** Duck-types a factory-table slot as a `VariantDispatch` (never a plain `WidgetFactory`) — the
 *  `variants` field is the marker; a `WidgetFactory` never declares one. */
export function isVariantDispatch(slot: WidgetFactory | VariantDispatch): slot is VariantDispatch {
  return 'variants' in slot
}

/**
 * Resolve one factory-table slot to the concrete `WidgetFactory` a node should use (GH #545). A plain
 * `WidgetFactory` slot passes through unchanged — byte-identical to the pre-#545 direct index for every
 * non-variant catalog type. A `VariantDispatch` slot reads `node[variantProp]`: a STRING match against a
 * declared `variants` key wins; anything else (absent, a non-string/dynamic-binding value, or an
 * unmatched string) falls back to `fallback`. Decided from the node's own static prop — this runs ONCE
 * per node, at mint/rewire time, never inside a reactive bound-prop effect (a variant's tag choice does
 * not re-dispatch when a BOUND `variantProp` value changes later, matching the fleet-wide rule that a
 * control's tag, unlike its props, is fixed at mint time).
 */
export function resolveFactory(slot: WidgetFactory | VariantDispatch | undefined, node: A2uiComponent): WidgetFactory | undefined {
  if (slot === undefined) return undefined
  if (!isVariantDispatch(slot)) return slot
  const key = node[slot.variantProp]
  return (typeof key === 'string' ? slot.variants[key] : undefined) ?? slot.fallback
}

/** Every concrete `WidgetFactory` a table slot can resolve to — one for a plain factory, `variants` +
 *  `fallback` (deduped by reference) for a dispatch table. Used by `submitGateSelector` (registry.ts) to
 *  fan a dispatch table's several tags into the aggregate submit-gate selector without picking a node. */
export function factoriesOf(slot: WidgetFactory | VariantDispatch): readonly WidgetFactory[] {
  if (!isVariantDispatch(slot)) return [slot]
  const seen = new Set<WidgetFactory>([slot.fallback, ...Object.values(slot.variants)])
  return [...seen]
}
