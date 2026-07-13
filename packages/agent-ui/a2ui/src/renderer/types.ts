// types.ts — renderer inter-module signature types (renderer LLD-C7, SPEC-R9).
//
// The runtime-free call-signatures that one renderer build slice compiles against while a sibling
// slice's implementation is still being built in an isolated worktree. Only the signatures that cross
// a slice boundary live here; module-internal types stay in their own module. `import type` only.

import type { A2uiComponent } from '../protocol.ts'
import type { Surface } from './surface.ts'
import type { Scope } from '@agent-ui/components'
import type { ComponentDef } from '../catalog/catalog.ts'

/**
 * A dynamic-list item's binding scope (renderer LLD-C6, A2UI v1.0 / ADR-0024). Carries the array
 * `path` (the template's pointer) and this instance's 0-based `index`, so a RELATIVE binding inside
 * the template resolves to `{path}/{index}/…` (an ABSOLUTE binding resolves to root). It scopes BOTH
 * the read direction (the per-path memo in binding.ts keys on the resolved absolute pointer — so no
 * `ItemScope` key is needed there) AND the write direction (the input controller, LLD-C8, calls
 * `scopedPointer` with itemScope so a relative two-way binding writes the same absolute pointer it
 * reads). `@index` (the LLD-C10 function evaluator) reads `index` off this.
 */
export interface ItemScope {
  /** The JSON-Pointer to the bound array — the list template's `path`. */
  path: string
  /** This instance's 0-based position within the array (positional reconcile, ADR-0024). */
  index: number
}

/**
 * Resolve + instantiate the live control for one component node (renderer LLD-C7, SPEC-R9). Looks the
 * `node.component` type up in the surface's catalog, instantiates the `WidgetFactory`'s element, sets
 * static props, and installs a bound-prop effect per `{path}` prop OWNED BY `scope`. An unknown type
 * emits `error{CATALOG}` and returns a non-fatal placeholder so siblings still render (SPEC-R9 AC2) —
 * hence it always returns an element. The tree reconstructor (renderer LLD-C4) calls this; pinned so
 * the tree slice can build against a stub while the widget slice is built in parallel.
 *
 * `scope` defaults to `surface.scope` (the surface lifetime) so every existing caller is unchanged; a
 * dynamic-list item (renderer LLD-C6) passes its per-index CHILD scope so the item's bound-prop effects
 * dispose with the item, not the surface. `itemScope` threads the relative-path resolution context for a
 * list item (absent for an ordinary node). `ac` defaults to `surface.ac`; a dynamic-list item passes its
 * per-index AbortController so DOM listeners (action + input) are removed when the item is removed, not
 * only at surface teardown (SPEC-N3 item-granular listener discipline).
 */
export type CreateWidget = (
  node: A2uiComponent,
  surface: Surface,
  scope?: Scope,
  itemScope?: ItemScope,
  ac?: AbortController,
) => HTMLElement

// ── structural-resend reconciliation collaborators (RSR-C2/C6, renderer-structural-resend.lld.md §2) ──
//
// `SurfaceTree` (renderer LLD-C4, amended by RSR-C4..C7) needs three additional host-level entry points
// beyond `CreateWidget` to reconcile an already-mounted node without ever re-minting its element: mint
// ONLY (no wiring, reused for a throwaway pristine-default read), wire an EXISTING element's complete
// prop/action/checks set, and reset one dropped, identity-mapped prop back to its factory default.

/** Mint only — no prop/input/action/checks wiring (the host's `create`, composing `widget.ts`'s `create`). */
export type CreateOnly = (node: A2uiComponent, surface: Surface) => HTMLElement

/** Wire props + input + action + checks onto an ALREADY-EXISTING element (the host's `#wireNode`, exported). */
export type RewireNode = (
  el: HTMLElement,
  node: A2uiComponent,
  surface: Surface,
  scope: Scope,
  itemScope: ItemScope | undefined,
  ac: AbortController,
) => void

/**
 * Resolve `node`'s factory (per `surface.catalogId`) and call its `applyProp(el, prop, value)` — needs
 * `node`/`surface` (not a bare function) because `applyProp` is resolved PER FACTORY, not globally.
 */
export type ResetProp = (el: HTMLElement, node: A2uiComponent, surface: Surface, prop: string, value: unknown) => void

/** The catalog `ComponentDef` for `node.component` under `surface.catalogId`, or `undefined` if unresolved. */
export type ComponentDefOf = (node: A2uiComponent, surface: Surface) => ComponentDef | undefined
