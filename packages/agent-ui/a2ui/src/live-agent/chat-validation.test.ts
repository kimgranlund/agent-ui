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
import { readFileSync } from 'node:fs'
import { selectCatalog, buildCatalogMap, semanticChecksDeps, validateResponsePreference } from '../../tools/agent/chat-validation.ts'
import { croupierSemanticChecks } from '../../src/catalog/personas/croupier/checks.ts'
import { HIDDEN_STATE_CHECKS } from '../../src/catalog/hidden-state-checks.ts'
import { gateChecksOnCatalog } from '../../src/catalog/semantic-check.ts'
import { compositeMomentChecks } from '../../src/catalog/composite-moments.ts'
import { framedChoiceCheck } from '../../src/catalog/framed-choice-check.ts'
import { optionDeckCountCheck } from '../../src/catalog/option-deck-check.ts'
import { singlePickCheck } from '../../src/catalog/single-pick-check.ts'
import { loadCatalog } from '../../src/catalog/catalog.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import catalogRaw from '../../src/catalog/default/catalog.json'
import basicCatalogRaw from '../../src/catalog/a2ui-basic/catalog.json'
import { composePersonaCatalogDocs, CatalogComposeError, CatalogComposeErrorCode } from '../../src/catalog/compose.ts'
import type { PersonaCatalogManifest } from '../../src/catalog/compose.ts'

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

describe('buildCatalogMap (GH #516 / persona-catalog-composition SPEC-R3 — the server-host derived-catalog fix)', () => {
  // Real shipped catalogs + the real shipped `croupier` persona (SPEC-N6's later slice, GH #497) —
  // NOT a synthetic fixture: this is the exact live-turn shape #516's repro hit (`catalogId:
  // "agent-ui--croupier"`), proving the fix against the actual production data, not just the mechanism.
  const catalog = loadCatalog(catalogRaw)
  const basicCatalog = loadCatalog(basicCatalogRaw)
  const catalogs = buildCatalogMap(catalog, basicCatalog)

  it('holds both base catalogs unchanged, plus every shipped persona\'s derived catalogs (never a smaller/different map)', () => {
    expect(catalogs.get('agent-ui')).toBe(catalog)
    expect(catalogs.get('a2ui-basic')).toBe(basicCatalog)
    expect(catalogs.has('agent-ui--croupier')).toBe(true)
    expect(catalogs.has('a2ui-basic--croupier')).toBe(true)
  })

  it('(1) a derived catalogId resolves — via the SAME selectCatalog both hosts call — to a catalog whose inventory includes the persona\'s local pattern types (was: silently the default, GH #516\'s repro)', () => {
    const resolved = selectCatalog(catalogs, 'agent-ui--croupier', catalog)
    expect(resolved.catalogId).toBe('agent-ui--croupier')
    expect(resolved).not.toBe(catalog) // never the fail-closed degrade — the exact defect GH #516 reports
    expect(Object.keys(resolved.components)).toContain('PlayingCard')
    // the base catalog's own types are still there too (SPEC-R2 AC2's non-colliding union)
    expect(Object.keys(resolved.components)).toEqual(expect.arrayContaining(Object.keys(catalog.components)))
  })

  it('holds across BOTH targeted bases for the same persona (a2ui-basic--croupier too, SPEC-R2\'s per-target-base composition)', () => {
    const resolved = selectCatalog(catalogs, 'a2ui-basic--croupier', catalog)
    expect(resolved.catalogId).toBe('a2ui-basic--croupier')
    expect(Object.keys(resolved.components)).toContain('PlayingCard')
  })

  it('(2) a genuinely-unknown id still degrades to the default — the #487 fail-closed posture, byte-identical, untouched by this fix', () => {
    expect(selectCatalog(catalogs, 'not-a-real-catalog', catalog)).toBe(catalog)
    expect(selectCatalog(catalogs, 'agent-ui--not-a-real-persona', catalog)).toBe(catalog)
  })

  it('(3) is the ONE construction both HTTP hosts share (ADR-0168 both-arms precedent) — not a second hand-built copy', () => {
    // `dev-proxy-plugin.ts` is safe to import under vitest (chat-route.test.ts's own precedent), and its
    // module body already ran above (via `buildCatalogMap`'s own import chain) — a source-text assertion
    // is enough to prove BOTH hosts call the exact same helper rather than re-deriving their own map:
    // `worker/index.ts` itself is deliberately never IMPORTED here (vitest.config.ts's `tools` project
    // comment: it statically imports the corpus `.jsonl` shard as Wrangler Text, plus `providers.json` and
    // catalog JSON, which only the Wrangler bundle loads).
    // `process.cwd()`-relative (the chat-route.test.ts precedent) — jsdom's `import.meta.url` is not a
    // real `file://` URL (vitest.config.ts's own `scripts` project comment names this exact gap).
    const ROOT = `${(process as { cwd(): string }).cwd()}/packages/agent-ui/a2ui/tools/agent`
    const devProxySrc = readFileSync(`${ROOT}/dev-proxy-plugin.ts`, 'utf8')
    const workerSrc = readFileSync(`${ROOT}/worker/index.ts`, 'utf8')
    expect(devProxySrc).toMatch(/buildCatalogMap\(catalog, basicCatalog\)/)
    expect(workerSrc).toMatch(/buildCatalogMap\(catalog, basicCatalog\)/)
  })

  it('reject-loud propagates through buildCatalogMap from a malformed shipped persona (SPEC-R2 AC3/AC6) — never a half-composed map', () => {
    // A synthetic collision (a manifest declaring a type the default catalog already owns), composed
    // directly against the SAME real base `buildCatalogMap` reads — `composePersonaCatalogDocs`
    // (compose.ts) throws synchronously; `buildCatalogMap` never swallows or degrades it.
    const collidingType = Object.keys(catalog.components)[0]!
    const collidingManifest: PersonaCatalogManifest = {
      personaId: 'malformed-persona',
      fragment: { components: { [collidingType]: catalog.components[collidingType]! }, functions: {} },
      targetCatalogs: ['agent-ui'],
    }
    let error: unknown
    try {
      composePersonaCatalogDocs(new Map<string, Catalog>([['agent-ui', catalog]]), [collidingManifest])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as InstanceType<typeof CatalogComposeError>).code).toBe(CatalogComposeErrorCode.COLLISION)
  })
})

describe('semanticChecksDeps (ADR-0238; GH #1795): the selected catalog decides the persona checks', () => {
  const catalog = loadCatalog(catalogRaw)
  const basicCatalog = loadCatalog(basicCatalogRaw)
  const catalogs = buildCatalogMap(catalog, basicCatalog)

  // T-0230: the hidden game state checks ride every catalog, then (T-0208) the composite-moment checks and (T-0258) the
  // framed-choice check, each kept only where its `requires` types exist.
  const ids = (deps: ReturnType<typeof semanticChecksDeps>): string[] => (deps.semanticChecks ?? []).map((c) => c.id)
  const hidden = (c: Catalog): string[] => gateChecksOnCatalog(HIDDEN_STATE_CHECKS, c).map((x) => x.id)
  // The base-catalog rows: the games rows, (T-0279) the ProductCard row and (T-0359) the Swatch row; its ask check rides
  // the Stylist alone (Kim, 2026-10-18).
  const GAMES = ['composite-moment-board-grid', 'composite-moment-game-hud', 'composite-moment-result-card', 'composite-moment-timeline', 'composite-moment-product-card', 'composite-moment-swatch']
  const BOOKING = ['composite-moment-booking-form', 'composite-moment-booking-confirmation']
  const CROUPIER = croupierSemanticChecks.map((c) => c.id)
  const FRAMED = [framedChoiceCheck.id]
  const DECK = [optionDeckCountCheck.id, singlePickCheck.id]

  it('a derived croupier catalog yields its checks, then the hidden-state and composite checks the catalog holds', () => {
    expect(ids(semanticChecksDeps(catalogs.get('agent-ui--croupier')!))).toEqual([...CROUPIER, ...hidden(catalogs.get('agent-ui--croupier')!), ...GAMES, ...FRAMED, ...DECK])
    expect(ids(semanticChecksDeps(catalogs.get('a2ui-basic--croupier')!))).toEqual([...CROUPIER, ...hidden(catalogs.get('a2ui-basic--croupier')!), ...FRAMED])
    expect(ids(semanticChecksDeps(catalog))).toEqual([...HIDDEN_STATE_CHECKS.map((c) => c.id), ...GAMES, ...FRAMED, ...DECK])
    expect(ids(semanticChecksDeps(catalogs.get('agent-ui--hospitality')!))).toEqual(['concierge-surface-required', 'concierge-listing-surface-required', 'concierge-booking-field-paths', 'concierge-edit-applied', ...HIDDEN_STATE_CHECKS.map((c) => c.id), ...BOOKING, ...GAMES, ...FRAMED, ...DECK])
    expect(ids(semanticChecksDeps(basicCatalog))).toEqual([...hidden(basicCatalog), ...FRAMED])
    expect(semanticChecksDeps(catalog).semanticChecks!.slice(HIDDEN_STATE_CHECKS.length, -3).every((c) => compositeMomentChecks.includes(c))).toBe(true)
    expect(semanticChecksDeps(catalog).semanticChecks!.at(-1)).toBe(singlePickCheck)
  })

  it('T-0479: carries the persona id the resolution stamp names, and nothing for a stamp with no persona row', () => {
    const stamp = [{ id: 'foundation', kind: 'prompt-section', version: 4 }, { id: 'negotiator', kind: 'persona', version: 4 }]
    expect(semanticChecksDeps(catalog, stamp).persona).toBe('negotiator')
    expect(semanticChecksDeps(catalog, stamp.slice(0, 1))).not.toHaveProperty('persona')
    expect(semanticChecksDeps(catalog, 'negotiator')).not.toHaveProperty('persona')
    expect(semanticChecksDeps(catalog)).not.toHaveProperty('persona')
  })

  it('follows selectCatalog, never the raw id: an unknown id falls back to the default catalog and its checks', () => {
    expect(ids(semanticChecksDeps(selectCatalog(catalogs, 'agent-ui--croupier', catalog))).slice(0, CROUPIER.length)).toEqual(CROUPIER)
    expect(ids(semanticChecksDeps(selectCatalog(catalogs, 'agent-ui--croupier-typo', catalog)))).toEqual([...HIDDEN_STATE_CHECKS.map((c) => c.id), ...GAMES, ...FRAMED, ...DECK])
  })

  it('both HTTP hosts spread it from the SELECTED catalog into produce() deps (source-text, the buildCatalogMap idiom)', () => {
    const ROOT = `${(process as { cwd(): string }).cwd()}/packages/agent-ui/a2ui/tools/agent`
    for (const src of [readFileSync(`${ROOT}/dev-proxy-plugin.ts`, 'utf8'), readFileSync(`${ROOT}/worker/index.ts`, 'utf8')]) {
      expect(src).toMatch(/const selectedCatalog = selectCatalog\(catalogs, catalogId, catalog\)/)
      expect(src).toMatch(/\.\.\.semanticChecksDeps\(selectedCatalog, resolution\)/) // T-0479: with the session's persona id
    }
  })
})

describe('validateResponsePreference (RTS-R6 AC3, RTS-R7): only the three literals pass, never a 400', () => {
  it('passes each literal through unchanged', () => {
    for (const v of ['text', 'surface', 'auto'] as const) expect(validateResponsePreference(v)).toBe(v)
  })

  it('drops anything else to undefined', () => {
    for (const v of ['TEXT', 'both', 1, null, undefined, {}]) expect(validateResponsePreference(v)).toBeUndefined()
  })
})
