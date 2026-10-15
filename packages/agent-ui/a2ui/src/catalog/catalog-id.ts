// catalog-id.ts: the derived catalog id grammar (T-0202, catalog architecture SPEC CA-R2, D2). Pure and
// import-free, so the renderer's records, the compose step, the producer toolkit and the registry subpath all
// read one grammar. The base half is everything before the first `--` (`corpus/base-id.ts` `baseCatalogId`, the
// retrieval scope); the tail is either one persona id (`compose.ts` `derivedCatalogId`) or a domain list
// `<d1>+<d2>`, the domains sorted and unique. `domainCatalogId` writes that tail and `parseDomainCatalogId` reads
// it back; a reversed or repeated spelling is refused, never normalized, so one domain set has exactly one id.

/** The joiner between domain ids in a derived id's tail (`agent-ui--design+games`). */
export const DOMAIN_JOINER = '+'

/** The canonical id of `base` with `domains` composed on: the domains sorted and deduplicated, joined by `+`.
 *  No domains is the base id itself. */
export function domainCatalogId(base: string, domains: readonly string[]): string {
  const sorted = [...new Set(domains)].sort()
  return sorted.length === 0 ? base : `${base}--${sorted.join(DOMAIN_JOINER)}`
}

/**
 * Read a derived id back as a base and a domain list: `{ base, domains }` when the id has a `--` tail whose
 * `+`-separated segments are non-empty, strictly ascending (so sorted and unique) and hold no further `--`.
 * `undefined` for a base id, a malformed tail, or a non-canonical spelling (`agent-ui--games+design`). It
 * checks the grammar only: whether the base and each domain are shipped is the caller's question. A
 * single-segment tail parses too, so a persona id reads as a one-element list; callers look personas up first.
 */
export function parseDomainCatalogId(catalogId: string): { base: string; domains: readonly string[] } | undefined {
  const sep = catalogId.indexOf('--')
  if (sep === -1) return undefined
  const tail = catalogId.slice(sep + 2)
  const domains = tail.split(DOMAIN_JOINER)
  for (let i = 0; i < domains.length; i++) {
    const d = domains[i]!
    if (d.length === 0 || d.includes('--')) return undefined
    if (i > 0 && !(domains[i - 1]! < d)) return undefined
  }
  return { base: catalogId.slice(0, sep), domains }
}

/** The domains an effective catalog id holds: the parsed tail's segments, or `[]` for a base id or a
 *  non-canonical tail. A persona tail reads as its one segment, which names no shipped domain. */
export function catalogIdDomains(catalogId: string): readonly string[] {
  return parseDomainCatalogId(catalogId)?.domains ?? []
}
