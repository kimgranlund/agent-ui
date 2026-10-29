// @agent-ui/a2ui/catalogs: the shipped persona and domain catalog packages (T-0530). Off the root barrel
// because each package carries its factories and semantic checks (the croupier checks alone are about 10 KB
// gz), which the renderer already loads lazily per catalog id (ADR-0241); a root import stays free of them.
// The server-safe `SHIPPED_PERSONA_CATALOG_MANIFESTS` twin (GH #516) stays on the root barrel.
export { SHIPPED_PERSONA_CATALOGS } from './personas/index.ts'
export { SHIPPED_DOMAIN_CATALOGS } from './domains/index.ts'
