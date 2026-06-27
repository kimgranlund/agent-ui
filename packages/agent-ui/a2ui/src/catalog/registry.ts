// registry.ts — the two-tier CatalogRegistry (catalog LLD-C3, SPEC-R6/R7, N1).
//
// Holds the registered catalogs + their factory tables and answers the renderer's two reads: widget
// resolution (`get`, renderer LLD-C7) and capabilities (`supportedCatalogIds`, renderer LLD-C12).
// Two-tier (SPEC-R6/N1): a project registers its OWN catalog with zero package edits — `register` is
// the public seam. Registration enforces the SPEC-R7 AC1 invariant (every declared component type has
// a factory) and the intentional-override path (duplicate `catalogId` ⇒ last-wins). Pure within-package
// dependencies: the loader (the single shape gate) + the pinned render contracts.

import { loadCatalog } from './catalog.ts'
import type { Catalog } from './catalog.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from './types.ts'

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

/**
 * The default `CatalogRegistry` implementation (catalog LLD-C3). Construct one per runtime; the default
 * catalog and any project catalogs register into it, and the renderer reads from it.
 */
export class Registry implements CatalogRegistry {
  readonly #catalogs = new Map<string, CatalogEntry>()

  register(catalog: unknown, factories: Record<string, WidgetFactory>): void {
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
    // id (re-register) or the default's id. The override is logged so it is never silent.
    if (this.#catalogs.has(loaded.catalogId)) {
      console.warn(`[a2ui] catalog "${loaded.catalogId}" re-registered — last registration wins`)
    }
    this.#catalogs.set(loaded.catalogId, { catalog: loaded, factories })
  }

  get(id: string): CatalogEntry | undefined {
    return this.#catalogs.get(id)
  }

  supportedCatalogIds(): string[] {
    return [...this.#catalogs.keys()]
  }
}
