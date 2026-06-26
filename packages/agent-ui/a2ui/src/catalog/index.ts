// catalog — the @agent-ui/a2ui catalog subsystem public surface (this slice: model + validators).
// Registry, default catalog/factories, functions, and theming land with the control family (A1 cont.).
export { loadCatalog, CatalogError, CatalogLoadCode } from './catalog.ts'
export type { Catalog, ComponentDef, PropDef, FunctionDef, JsonSchema } from './catalog.ts'
export { validName } from './naming.ts'
export { validateCatalogConformance } from './conformance.ts'
