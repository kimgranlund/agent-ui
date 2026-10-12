// base-id.ts: the base half of a catalog id, the one place the `<base>--<persona>` convention
// (`compose.ts` `derivedCatalogId`, OF1b) is read back. Pure and import-free: it lives in `corpus/` so
// `retrieve.ts` stays platform-neutral (SPEC-N5), and `agent/mini-skills.ts` imports it beside `topKByCosine`.
// ADR-0243 cl.3: a derived catalog inherits its base's mini-skills and exemplars, so both scopes match on
// this segment.

/** `agent-ui--croupier` -> `agent-ui` (split on the FIRST `--`, as `selectionGuidanceForId` does); an id with no `--` is its own base. */
export function baseCatalogId(catalogId: string): string {
  const sep = catalogId.indexOf('--')
  return sep === -1 ? catalogId : catalogId.slice(0, sep)
}
