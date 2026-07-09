// index.ts — the @agent-ui/router barrel (LLD-C10a, SPEC-R1). Exports the headless core (createRouter,
// connectUrl, types) ONLY — NEVER the elements (SPEC-R1 AC3's tree-shake contract, the pure-core +
// subpath pattern shared with @agent-ui/icons, ADR-0065/0066). `ui-router-outlet`/`ui-router-link` live
// on their own subpaths (`./router-outlet`, `./router-link`) so a headless/core-only consumer never pays
// for the DOM elements. A future "convenience re-export" PR that adds the element classes here is the
// regression this comment (and barrels.test.ts's tree-shake crawl) exists to catch — do not add one.
//
// `RouterInternal` (core/router.ts) is deliberately NOT exported — it is the package-private extension
// the URL adapter (url.ts) and the elements read; the public `Router` shape below is the whole contract.
export { createRouter } from './core/router.ts'
export { connectUrl } from './url.ts'
export type { RouteRecord, RouteMatch, Router } from './core/types.ts'
