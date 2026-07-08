// default/index.ts — the agent-ui default catalog (catalog LLD-C4, SPEC-R3/R8).
//
// Loads + structurally validates the shipped `catalog.json` into the typed `Catalog` the
// renderer/registry consume. `loadCatalog` is the load-time gate: a malformed document throws
// here at import. Factory-free by contract — the catalog↔factory binding (`./factories.ts`,
// LLD-C5) is wired by the host at `registry.register`, not in this module.
//
// Coverage policy is whole-fleet (ADR-0087, superseding the prior G9-scoped list): every shipped `ui-*`
// control descriptor earns a catalog row, tracked by the fleet-derived coverage gate in `index.test.ts`
// (SPEC-N2) rather than a hand-frozen name list — a shipped-but-uncatalogued control fails CI instead of
// passing silently. All 25 fleet descriptors now resolve to a catalog row (Waves A/B/C landed the 12
// ADR-0087 types + composites); that test's `EXCLUSION_ALLOWLIST` is EMPTY (Wave D, confirmed 2026-07-06).
// `Image`/`Video` stay absent because no `ui-image`/`ui-video` descriptor exists yet — they never enter
// the derived set. Each declared type binds to a `ui-*` factory in `./factories.ts`.

import { loadCatalog, type Catalog } from '../catalog.ts'
import catalogDoc from './catalog.json'

/** The agent-ui default catalog — A2UI component types reflecting `@agent-ui/components` controls. */
export const defaultCatalog: Catalog = loadCatalog(catalogDoc)
