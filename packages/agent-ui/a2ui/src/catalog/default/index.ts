// default/index.ts — the agent-ui default catalog (catalog LLD-C4, SPEC-R3/R8).
//
// Loads + structurally validates the shipped `catalog.json` into the typed `Catalog` the
// renderer/registry consume. `loadCatalog` is the load-time gate: a malformed document throws
// here at import. Factory-free by contract — the catalog↔factory binding (`./factories.ts`,
// LLD-C5) is wired by the host at `registry.register`, not in this module.
//
// Coverage tracks the shipped control family (SPEC-N2, Assumption A-2): `Button` (G5), `TextField` (G6),
// and the G9 container family — `Row`/`Column`/`Card` (+ region sub-types) / `Tabs` (+ tab/panel) /
// `Modal`. Types whose control has not shipped are omitted (no silent dead types): `Image`/`Video` stay
// absent until media primitives land; `ui-list`/`ui-grid` are direct `ui-*` primitives, NOT catalog
// types (the ratified G9 scope). Each declared type binds to a `ui-*` factory in `./factories.ts`.

import { loadCatalog, type Catalog } from '../catalog.ts'
import catalogDoc from './catalog.json'

/** The agent-ui default catalog — A2UI component types reflecting `@agent-ui/components` controls. */
export const defaultCatalog: Catalog = loadCatalog(catalogDoc)
