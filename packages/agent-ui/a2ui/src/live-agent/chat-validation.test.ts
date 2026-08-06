// chat-validation.test.ts — GH #487: `selectCatalog` (`tools/agent/chat-validation.ts`), the fail-closed
// unknown-catalogId fallback BOTH live transports (`dev-proxy-plugin.ts`'s produce POST branch and
// `worker/index.ts`'s `handleProduce`) ride to key `deps.catalog` off the request's `catalogId` —
// ADR-0169 cl.3 ("Server-side selection — both hosts hold BOTH catalogs, keyed by the request's
// `catalogId`") and `wire-tolerances.md` row S1 ("A non-string or unrecognized `catalogId` on a produce
// request degrades to the default catalog fallback (never a 400/500, never a mixed catalog+prompt)") both
// sanction this exact fallback shape, but until now NOTHING pinned it behaviorally (S1's own Tests
// column: "NONE FOUND"). This file closes that gap. Like `validate-mode.test.ts`/`providers-config.test.ts`
// (the same precedent), it lives in the vitest+tsc include (`src/live-agent/`) and imports the Node-scoped
// `tools/agent/` module by relative path, transitively typechecking it — `chat-validation.ts` itself sits
// outside every vitest project's `include` glob (`vitest.config.ts`'s `tools` project only covers
// `tools/agent/worker/`, `tools/agent/integrations/`, and `tools/corpus/`). Pure/sync/zero-dep, so no
// fixture is needed beyond a small in-test `Map`.

import { describe, it, expect } from 'vitest'
import { selectCatalog } from '../../tools/agent/chat-validation.ts'

const CATALOG_A = { catalogId: 'agent-ui', label: 'default' }
const CATALOG_BASIC = { catalogId: 'a2ui-basic', label: 'basic' }
const CATALOGS = new Map([
  [CATALOG_A.catalogId, CATALOG_A],
  [CATALOG_BASIC.catalogId, CATALOG_BASIC],
])

describe('selectCatalog (ADR-0169 cl.3 / wire-tolerances.md S1 — fail-closed catalog selection)', () => {
  it('degrades to the fallback on an unrecognized catalogId — never a 400/500, never a mixed catalog+prompt', () => {
    expect(selectCatalog(CATALOGS, 'not-a-real-catalog', CATALOG_A)).toBe(CATALOG_A)
  })

  it('passes a known catalogId through, resolving the exact registered entry (not a copy)', () => {
    expect(selectCatalog(CATALOGS, 'a2ui-basic', CATALOG_A)).toBe(CATALOG_BASIC)
  })

  it('degrades malformed input (non-string, empty string, or absent) to the fallback, matching the unknown-id arm', () => {
    // non-string
    expect(selectCatalog(CATALOGS, 42, CATALOG_A)).toBe(CATALOG_A)
    expect(selectCatalog(CATALOGS, null, CATALOG_A)).toBe(CATALOG_A)
    expect(selectCatalog(CATALOGS, { catalogId: 'a2ui-basic' }, CATALOG_A)).toBe(CATALOG_A)
    // empty string — a real string, but not a registered key
    expect(selectCatalog(CATALOGS, '', CATALOG_A)).toBe(CATALOG_A)
    // absent (the request body simply never set `catalogId`)
    expect(selectCatalog(CATALOGS, undefined, CATALOG_A)).toBe(CATALOG_A)
  })
})
