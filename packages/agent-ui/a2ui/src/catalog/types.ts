// types.ts — catalog↔renderer render-contract types (catalog LLD-C3/C5, SPEC-R4/R6/R7).
//
// The small, runtime-free contracts the renderer's widget resolution (renderer LLD-C7) and
// capabilities (renderer LLD-C12) build against, and that the registry (LLD-C3) + default factories
// (LLD-C5) implement. Kept in its OWN file (not the package-root protocol.ts, which is wire shapes
// only) because these are *render* contracts — they reference `HTMLElement` and the loaded `Catalog`,
// not the over-the-wire message types. Pinning them here lets the renderer and catalog build slices
// compile against one another's interface without importing a not-yet-built implementation. Pure
// types: `import type` only, zero runtime.

import type { Catalog } from './catalog.ts'

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
   * Input widgets only: the DOM value property + change event the renderer's input controller
   * (renderer LLD-C8) wires for two-way binding. Absent for non-input controls.
   */
  value?: { prop: string; event: string }
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
 * A registered catalog paired with its factory table — the registry's component-resolution result
 * (catalog LLD-C3). The renderer resolves a node's control via `registry.get(catalogId)?.factories[type]`.
 */
export interface CatalogEntry {
  catalog: Catalog
  factories: Record<string, WidgetFactory>
}

/**
 * The catalog registry contract (catalog LLD-C3, SPEC-R6/R7). The default + project catalogs register
 * their factories; the renderer reads `get` (widget resolution, LLD-C7) and `supportedCatalogIds`
 * (capabilities, LLD-C12). Two-tier: a project registers its own catalog with zero package edits (N1).
 */
export interface CatalogRegistry {
  /** Register a catalog + its factory table (throws `CATALOG_FACTORY_MISSING` on a gap; last-wins on a dup id). */
  register(catalog: unknown, factories: Record<string, WidgetFactory>): void
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
