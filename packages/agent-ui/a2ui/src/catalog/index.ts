// catalog — the @agent-ui/a2ui catalog subsystem public surface: the schema model + loader (LLD-C1),
// the conformance validator (LLD-C6), the two-tier registry (LLD-C3), and the shipped default catalog
// + factory table (LLD-C4/C5) the host pre-registers.
export { loadCatalog, CatalogError, CatalogLoadCode, valueSlots } from './catalog.ts'
export type { Catalog, ComponentDef, PropDef, FunctionDef, JsonSchema, ValueSlot } from './catalog.ts'
export { validName } from './naming.ts'
export { validateCatalogConformance } from './conformance.ts'

export { Registry, RegistryError, RegistryErrorCode } from './registry.ts'
export type { CatalogEntry, CatalogRegistry, VariantDispatch, WidgetFactory } from './types.ts'
// GH #545 — the variant-dispatch resolver: a factory-table slot MAY be a `VariantDispatch` in place of
// a plain `WidgetFactory`; `resolveFactory` is the public seam a project catalog's own renderer
// integration (or a test) would need — the renderer itself imports it directly from `./variant.ts`.
export { resolveFactory } from './variant.ts'

export { defaultCatalog } from './default/index.ts'
export { defaultFactories, buttonFactory } from './default/factories.ts'

// ADR-0169 — the a2ui-basic catalog (the upstream A2UI v0.9.1 Basic Catalog, mapped onto fleet `ui-*`
// controls): the local short id `a2uiBasicCatalog`, its inbound-only canonical-URI alias
// `a2uiBasicCatalogCanonical` (cl.13), its factory table, and its per-catalog function-impl table (cl.8).
export { a2uiBasicCatalog, a2uiBasicCatalogCanonical, A2UI_BASIC_CANONICAL_URI } from './a2ui-basic/index.ts'
export { a2uiBasicFactories } from './a2ui-basic/factories.ts'
export { a2uiBasicFunctions } from './a2ui-basic/functions.ts'

// M-D — the persona catalog compose-time overlay (ADR-0172 cl.2, `persona-catalog-composition.spec.md`
// SPEC-R1/R2): the pure merge (`composeCatalog`), the fragment loader, the derived-id naming convention,
// the compose-time error, and the constructor-time derive-then-register step `renderer.ts` calls.
export {
  composeCatalog,
  loadCatalogFragment,
  composePersonaCatalogs,
  composePersonaCatalogDocs,
  derivedCatalogId,
  derivedCatalogIdsFor,
  CatalogComposeError,
  CatalogComposeErrorCode,
} from './compose.ts'
export type { CatalogFragment, PersonaCatalogPackage, PersonaCatalogManifest } from './compose.ts'
export { SHIPPED_PERSONA_CATALOGS } from './personas/index.ts'
// GH #516 — the Node/Workers-safe manifest twin (`compose.ts`'s `PersonaCatalogManifest` header): this
// line ALONE does not make the whole `catalog/index.ts` barrel server-safe (the `SHIPPED_PERSONA_CATALOGS`
// export above still pulls in `personas/index.ts`'s DOM-bearing factories), so `dev-proxy-plugin.ts`/
// `worker/index.ts` import `personas/manifests.ts` directly, never through this barrel.
export { SHIPPED_PERSONA_CATALOG_MANIFESTS } from './personas/manifests.ts'
