// catalog — the @agent-ui/a2ui catalog subsystem public surface: the schema model + loader (LLD-C1),
// the conformance validator (LLD-C6), the two-tier registry (LLD-C3), and the shipped default catalog
// + factory table (LLD-C4/C5) the host pre-registers.
export { loadCatalog, CatalogError, CatalogLoadCode } from './catalog.ts'
export type { Catalog, ComponentDef, PropDef, FunctionDef, JsonSchema } from './catalog.ts'
export { validName } from './naming.ts'
export { validateCatalogConformance } from './conformance.ts'

export { Registry, RegistryError, RegistryErrorCode } from './registry.ts'
export type { CatalogEntry, CatalogRegistry, WidgetFactory } from './types.ts'

export { defaultCatalog } from './default/index.ts'
export { defaultFactories, buttonFactory } from './default/factories.ts'
