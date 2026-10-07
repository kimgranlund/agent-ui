// registry.ts — the two-tier CatalogRegistry (catalog LLD-C3, SPEC-R6/R7, N1).
//
// Holds the registered catalogs + their factory tables and answers the renderer's three reads: widget
// resolution (`get`, renderer LLD-C7), capabilities (`supportedCatalogIds`, renderer LLD-C12), and the
// submit-gate selector (`submitGateSelector`, ADR-0054 — the `#wireAction` gate branch). Two-tier
// (SPEC-R6/N1): a project registers its OWN catalog with zero package edits — `register` is the public
// seam. Registration enforces the SPEC-R7 AC1 invariant (every declared component type has a factory)
// and the intentional-override path (duplicate `catalogId` ⇒ last-wins). Pure within-package
// dependencies: the loader (the single shape gate) + the pinned render contracts.

import { loadCatalog } from './catalog.ts'
import type { Catalog } from './catalog.ts'
import type { ControlLoader } from '@agent-ui/components/loader'
import { CatalogLoadError, loadCatalogBody } from './loader.ts'
import type { CatalogEntry, CatalogRegistry, LazyCatalogRecord, VariantDispatch, WidgetFactory } from './types.ts'
import { factoriesOf } from './variant.ts'

/** Registration-time diagnostic codes owned by the registry (catalog LLD-C3, error table §8). */
export const RegistryErrorCode = {
  /** A declared component type has no factory in the table (SPEC-R7 AC1). */
  FACTORY_MISSING: 'CATALOG_FACTORY_MISSING',
} as const
export type RegistryErrorCode = (typeof RegistryErrorCode)[keyof typeof RegistryErrorCode]

/** Thrown by `register` on a coverage gap. Mirrors `CatalogError`: a typed `code` + a message. */
export class RegistryError extends Error {
  readonly code: RegistryErrorCode
  constructor(code: RegistryErrorCode, message: string) {
    super(message)
    this.name = 'RegistryError'
    this.code = code
  }
}

const warnOverride = (id: string): void => console.warn(`[a2ui] catalog "${id}" re-registered, last registration wins`)

/**
 * The default `CatalogRegistry` implementation (catalog LLD-C3). Construct one per runtime; the default
 * catalog and any project catalogs register into it, and the renderer reads from it.
 */
export class Registry implements CatalogRegistry {
  readonly #catalogs = new Map<string, CatalogEntry>()
  // ADR-0241: recorded-but-unloaded catalogs. An id is in at most one of `#catalogs` and `#records`.
  readonly #records = new Map<string, LazyCatalogRecord>()
  readonly #pending = new Map<string, Promise<void>>()

  register(
    catalog: unknown,
    factories: Record<string, WidgetFactory | VariantDispatch>,
    functions?: Record<string, (args: Record<string, unknown>) => unknown>,
    controls?: ControlLoader,
  ): void {
    this.#store(catalog, factories, functions, controls, true)
  }

  // The one place a catalog enters `#catalogs`: `register` and a lazy body's `ensure` both come through it.
  // `shadowing` is false only for a recorded id's own body, which is not an override of itself.
  #store(
    catalog: unknown,
    factories: Record<string, WidgetFactory | VariantDispatch>,
    functions: Record<string, (args: Record<string, unknown>) => unknown> | undefined,
    controls: ControlLoader | undefined,
    shadowing: boolean,
  ): void {
    // Defensive re-assert + narrow `unknown` → a structurally-valid `Catalog`. The loader is the single
    // shape gate (LLD-C1 invariant); storing its normalized result keeps the stored entry valid downstream.
    const loaded: Catalog = loadCatalog(catalog)

    // SPEC-R7 AC1: every declared component type must have a factory — a gap is a registration error,
    // not a silent dead type. Own-property check so a type named like an `Object.prototype` key
    // (`toString`, `constructor`, …) cannot spuriously satisfy the lookup via the prototype chain.
    for (const type of Object.keys(loaded.components)) {
      if (!Object.hasOwn(factories, type)) {
        throw new RegistryError(
          RegistryErrorCode.FACTORY_MISSING,
          `CATALOG_FACTORY_MISSING: catalog "${loaded.catalogId}" declares component "${type}" with no registered factory`,
        )
      }
    }

    // Last-wins (SPEC-R6/N1): a project catalog MAY intentionally shadow a prior registration — its own
    // id (re-register), the default's id, or a recorded lazy id (ADR-0241). The override is logged so it
    // is never silent.
    if (shadowing && this.knows(loaded.catalogId)) warnOverride(loaded.catalogId)
    // ADR-0169 cl.8: the optional per-catalog function-impl override, stored only when provided (a plain
    // `functions` key of `undefined` would still satisfy the optional-field type but pollutes intent).
    // ADR-0233: the optional control loader follows the same rule.
    const entry: CatalogEntry = functions !== undefined ? { catalog: loaded, factories, functions } : { catalog: loaded, factories }
    if (controls !== undefined) entry.controls = controls
    this.#catalogs.set(loaded.catalogId, entry)
    this.#records.delete(loaded.catalogId)
  }

  /**
   * Record a catalog by id without loading its body (ADR-0241 cl.3). Internal to the package: `register`
   * stays the one project seam. Last-wins like `register`: a loaded or recorded entry under the same id is
   * replaced, and a load already in flight for it is discarded.
   */
  registerLazy(record: LazyCatalogRecord): void {
    if (this.knows(record.id)) warnOverride(record.id)
    this.#catalogs.delete(record.id)
    this.#pending.delete(record.id)
    this.#records.set(record.id, record)
  }

  /** A registered id or a recorded (not yet loaded) one. `get` answers only for a loaded catalog. */
  knows(id: string): boolean {
    return this.#catalogs.has(id) || this.#records.has(id)
  }

  /**
   * Load a recorded catalog's body (module-wide memo, `loader.ts`) and register it into this registry, once
   * (ADR-0241 cl.4-5). Resolves at once for a loaded id. Rejects with `CatalogLoadError` for an unrecorded
   * id, a failed load, a body declaring another id, or a factory gap; the next call retries.
   */
  ensure(id: string): Promise<void> {
    if (this.#catalogs.has(id)) return Promise.resolve()
    const record = this.#records.get(id)
    if (record === undefined) return Promise.reject(new CatalogLoadError(id, `no catalog record for "${id}"`))
    const known = this.#pending.get(id)
    if (known !== undefined) return known
    const pending = loadCatalogBody(record).then(
      (body) => {
        // A `register` or newer `registerLazy` for this id landed while the body loaded: it wins, and this
        // call settles on whatever now answers to the id.
        if (this.#records.get(id) !== record) return this.ensure(id)
        const declared = (body.catalog as { catalogId?: unknown } | null)?.catalogId
        if (declared !== id) throw new CatalogLoadError(id, `catalog body declares "${String(declared)}", not "${id}"`)
        try {
          this.#store(body.catalog, body.factories, body.functions, body.controls, false)
        } catch (cause) {
          throw new CatalogLoadError(id, `catalog "${id}" failed to register: ${(cause as Error).message}`, { cause })
        }
      },
      (cause: unknown) => {
        throw new CatalogLoadError(id, `catalog "${id}" failed to load: ${(cause as Error | undefined)?.message}`, { cause })
      },
    )
    this.#pending.set(id, pending)
    const settle = (): void => {
      if (this.#pending.get(id) === pending) this.#pending.delete(id)
    }
    pending.then(settle, settle)
    return pending
  }

  get(id: string): CatalogEntry | undefined {
    return this.#catalogs.get(id)
  }

  supportedCatalogIds(): string[] {
    return [...this.#catalogs.keys(), ...this.#records.keys()]
  }

  submitGateSelector(): string {
    // Aggregate across ALL registered catalogs (two-tier, ADR-0054) — a project catalog may mark its
    // own gate alongside the default's `FormProvider`. Keyed by tag (a `Set` dedupes a tag declared by
    // more than one catalog's factory). Recomputed on every call (cheap — factory tables are small) so
    // a later `register` is picked up without a cache-invalidation seam.
    // ADR-0241: a recorded catalog's manifest tags count before its body loads.
    const tags = new Set<string>()
    for (const record of this.#records.values()) for (const tag of record.submitGate) tags.add(tag)
    for (const entry of this.#catalogs.values()) {
      for (const slot of Object.values(entry.factories)) {
        // A `VariantDispatch` slot (GH #545) fans out to every concrete arm — a variant MAY mark its
        // own `submitGate` independent of its sibling arms.
        for (const factory of factoriesOf(slot)) {
          if (factory.submitGate === true) tags.add(factory.tag)
        }
      }
    }
    return [...tags].join(', ')
  }
}
