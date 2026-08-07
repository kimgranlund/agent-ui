// types.ts — catalog↔renderer render-contract types (catalog LLD-C3/C5, SPEC-R4/R6/R7).
//
// The small, runtime-free contracts the renderer's widget resolution (renderer LLD-C7) and
// capabilities (renderer LLD-C12) build against, and that the registry (LLD-C3) + default factories
// (LLD-C5) implement. Kept in its OWN file (not the package-root protocol.ts, which is wire shapes
// only) because these are *render* contracts — they reference `HTMLElement` and the loaded `Catalog`,
// not the over-the-wire message types. Pinning them here lets the renderer and catalog build slices
// compile against one another's interface without importing a not-yet-built implementation. Pure
// types: `import type` only, zero runtime.

import type { Catalog, ValueSlot } from './catalog.ts'

/**
 * A factory that turns one A2UI component type into a live `ui-*` control (catalog LLD-C5, SPEC-R4).
 * Owned by the catalog; consumed by the renderer's widget resolution (renderer LLD-C7), which
 * instantiates `create()`, then calls `applyProp` for each static prop and inside each scope-owned
 * bound-prop effect.
 */
export interface WidgetFactory {
  /** The custom-element tag this factory produces (e.g. `ui-button`). */
  tag: string
  /** Construct a fresh, unparented control instance. */
  create: () => HTMLElement
  /** Map one A2UI property (per the catalog `PropDef.mapsTo`) onto the control as a prop/attribute. */
  applyProp: (el: HTMLElement, prop: string, value: unknown) => void
  /**
   * Input widgets only: the DOM value property + commit event the renderer's input controller
   * (renderer LLD-C8) wires for two-way binding. Absent for non-input controls. Widened by
   * ADR-0161 from a single slot to one-or-more: a component whose commit gesture finalizes
   * several props (Calendar range, SliderMulti) declares one slot per prop — the single-object
   * form stays legal, unchanged, forever. `valueSlots` (catalog.ts) is the shared per-slot reader.
   */
  value?: ValueSlot | readonly ValueSlot[]
  /**
   * Marks this factory's control as a submit-action GATE (ADR-0054). The renderer's `#wireAction`
   * resolves `el.closest(<the registry's derived selector>)` for a `submit:true`-flagged action and,
   * on a match, defers to the gate's own `submit()` verdict before emitting. A `submitGate` factory's
   * control MUST expose a public `submit(): boolean` method (the structural contract, catalog SPEC
   * §5.1) — the default catalog's `FormProvider` (→ `ui-form-provider`) carries the mark; a project
   * catalog MAY mark its own gate (two-tier, SPEC-R6).
   */
  submitGate?: true
}

/**
 * One catalog TYPE dispatching to a DIFFERENT concrete `WidgetFactory` per the value of one node prop
 * (GH #545 — `WidgetFactory.create()` is a zero-arg closure with no access to the incoming node, so a
 * single catalog type could resolve to exactly one factory; the a2ui-basic E6 drain, SPEC-R10 of the
 * accepted multi-select-field SPEC, needs `ChoicePicker.variant: 'mutuallyExclusive'` to keep routing
 * to `ui-select` while `'multipleSelection'` routes to `ui-multi-select`).
 *
 * Occupies the SAME `CatalogEntry.factories`/registry-table slot a plain `WidgetFactory` would — the
 * renderer's widget resolution (LLD-C7, `variant.ts`'s `resolveFactory`) checks the slot's SHAPE
 * (`variants` marks it as a dispatch table, never a factory itself) and resolves to the concrete factory
 * ONCE per node, BEFORE `create()`/`applyProp()`/the `value` mark are ever touched — so a dispatched
 * variant behaves EXACTLY like any single-tag type for the rest of its lifecycle (mint, static/bound
 * props, two-way input binding, and the submit-gate selector all read off the SAME resolved concrete
 * factory). Dispatch is decided from the node's OWN (static) prop value, never a resolved/bound value —
 * the tag choice, like every catalog type's tag, is fixed at mint time and never re-dispatches reactively.
 */
export interface VariantDispatch {
  /** The node prop whose value selects the concrete factory (e.g. `'variant'`). */
  readonly variantProp: string
  /** variant value → the concrete factory to use. */
  readonly variants: Record<string, WidgetFactory>
  /** Used when the node's `variantProp` value is absent, a dynamic binding (never a plain string at
   *  create time), or matches no key in `variants` — every dispatch table MUST declare one so
   *  resolution can never come back empty for a node whose type otherwise resolved. */
  readonly fallback: WidgetFactory
}

/**
 * A registered catalog paired with its factory table — the registry's component-resolution result
 * (catalog LLD-C3). The renderer resolves a node's control via `registry.get(catalogId)?.factories[type]`
 * (variant.ts's `resolveFactory` when the resolved slot is a `VariantDispatch`, GH #545).
 *
 * `functions` (ADR-0169 cl.8, amends ADR-0034's shared-table seam): a PER-CATALOG override of the
 * function-call implementation table. `renderer/functions.ts`'s `evaluateCatalog` prefers
 * `entry.functions?.[name]` over the shared `catalogFunctions` (`catalog/functions.ts`) — landed
 * per-catalog rather than as a global mutation so two dialects (the default catalog's `{valid,message}`
 * vs. a Basic-dialect catalog's plain booleans) can share function NAMES without colliding. Absent ⇒
 * every lookup falls through to the shared table, byte-identical to before this clause (the default
 * catalog registers none).
 */
export interface CatalogEntry {
  catalog: Catalog
  factories: Record<string, WidgetFactory | VariantDispatch>
  functions?: Record<string, (args: Record<string, unknown>) => unknown>
}

/**
 * The catalog registry contract (catalog LLD-C3, SPEC-R6/R7). The default + project catalogs register
 * their factories; the renderer reads `get` (widget resolution, LLD-C7) and `supportedCatalogIds`
 * (capabilities, LLD-C12). Two-tier: a project registers its own catalog with zero package edits (N1).
 */
export interface CatalogRegistry {
  /** Register a catalog + its factory table (throws `CATALOG_FACTORY_MISSING` on a gap; last-wins on a dup
   *  id). A table slot MAY be a `VariantDispatch` (GH #545) in place of a plain `WidgetFactory`.
   *  `functions` (ADR-0169 cl.8) is an optional per-catalog function-impl override table — absent ⇒
   *  every declared function falls through to the shared `catalogFunctions` table, unchanged. */
  register(
    catalog: unknown,
    factories: Record<string, WidgetFactory | VariantDispatch>,
    functions?: Record<string, (args: Record<string, unknown>) => unknown>,
  ): void
  /** Resolve a registered catalog by id, or `undefined` if unregistered (the renderer's `CATALOG_UNKNOWN` allowlist). */
  get(id: string): CatalogEntry | undefined
  /** Every registered catalog id — feeds renderer capabilities (renderer LLD-C12). */
  supportedCatalogIds(): string[]
  /**
   * The CSS selector matching every registered `submitGate` factory's tag, across ALL registered
   * catalogs (ADR-0054, two-tier). Empty string when no factory carries the mark — callers MUST treat
   * that as "no gate exists anywhere" and skip `Element.closest` (an empty string is an invalid
   * selector, a `SyntaxError`); the renderer's `#wireAction` guards this.
   */
  submitGateSelector(): string
}
