// index.ts — the a2ui-basic catalog (ADR-0169, catalog LLD-C4/SPEC-R3/R8 pattern, applied to the
// upstream A2UI v0.9.1 Basic Catalog rather than the fleet's own `ui-*` inventory).
//
// Source: `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json` (Google's A2UI spec,
// fetched 2026-08-04). `catalog.json` is OUR document — a 14-of-18-type INCLUDE partition (cl.9,
// `a2ui-basic/index.test.ts`'s coverage gate) mapped onto existing fleet `ui-*` controls
// (`factories.ts`) — never a byte copy of the upstream file. `a2uiBasicCatalog` registers under the
// LOCAL short id `a2ui-basic` (cl.13 — the registry key, the picker option id, the corpus/retrieval
// key, and the producer's outbound authority stamp all use this id).
//
// `a2uiBasicCatalogCanonical` is the SAME components/factories/functions bytes, registered a SECOND
// time under the upstream canonical URI (`A2UI_BASIC_CANONICAL_URI`) — an INBOUND-ONLY alias (cl.13):
// an upstream-authored stream whose `createSurface.catalogId` names the canonical URI resolves and
// renders on any fleet renderer with zero translation. The alias is NEVER a picker option and NEVER an
// outbound stamp — only `a2ui-basic` is.

import { loadCatalog, type Catalog } from '../catalog.ts'
import catalogDoc from './catalog.json'

/** The upstream canonical catalog id (a URI, not a short id) — the `a2uiBasicCatalogCanonical`
 *  registration key (cl.13 inbound alias). */
export const A2UI_BASIC_CANONICAL_URI = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'

/** The a2ui-basic catalog — the LOCAL short id `a2ui-basic` (the primary, outbound-stamped id). */
export const a2uiBasicCatalog: Catalog = loadCatalog(catalogDoc)

/** The SAME catalog, re-keyed under the upstream canonical URI (cl.13 inbound alias) — never a picker
 *  option, never an outbound stamp; registered so an upstream-authored stream resolves unchanged. */
export const a2uiBasicCatalogCanonical: Catalog = loadCatalog({ ...catalogDoc, catalogId: A2UI_BASIC_CANONICAL_URI })
