// domains/body.ts: the shipped domain packages' lazy body (the `personas/body.ts` precedent). `records.ts` reaches
// it only through `import()`, so domain packages and the compose step load the first time a surface names a
// `<base>--<d1>+<d2>` id. A compose collision surfaces here, at load time.

import { composeDomainEntry } from '../compose.ts'
import type { CatalogEntry } from '../types.ts'
import { SHIPPED_DOMAIN_CATALOGS } from './index.ts'

/** The shipped domains `domainIds` composed over `base`. Throws on an unknown domain or a compose collision. */
export function shippedDomainEntry(domainIds: readonly string[], base: CatalogEntry): CatalogEntry {
  const packages = domainIds.map((id) => {
    const d = SHIPPED_DOMAIN_CATALOGS.find((p) => p.domainId === id)
    if (d === undefined) throw new Error(`no shipped domain "${id}"`)
    return d
  })
  return composeDomainEntry(base, packages)
}
