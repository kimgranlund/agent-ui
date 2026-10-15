// base-id.ts: the base half of a catalog id, the one place the `<base>--<persona>` convention
// (`compose.ts` `derivedCatalogId`, OF1b) is read back. Pure, importing only the import-free id grammar: it lives in `corpus/` so
// `retrieve.ts` stays platform-neutral (SPEC-N5), and `agent/mini-skills.ts` imports it beside `topKByCosine`.
// ADR-0243 cl.3: a derived catalog inherits its base's mini-skills and exemplars, so both scopes match on
// this segment. T-0210: the split itself is `catalog/catalog-id.ts` `splitCatalogId`, the one grammar every id
// reader shares, so a multi-domain `<base>--<d1>+<d2>` id reads its base the same way.

import { splitCatalogId } from '../catalog/catalog-id.ts'

/** `agent-ui--croupier` -> `agent-ui` (split on the FIRST `--`, as `selectionGuidanceForId` does); an id with no `--` is its own base. */
export function baseCatalogId(catalogId: string): string {
  return splitCatalogId(catalogId).base
}
