// records.test.ts: the bijection gate for the built-in lazy catalog records (ADR-0241 cl.9). `records.ts` is an
// explicit list with hand-copied manifests and no generator, so this file is its drift gate:
//   - the record ids equal the shipped catalog folders (the default `agent-ui` included, ADR-0241 Amendment), the
//     a2ui-basic canonical-URI alias, and every persona-by-base id `derivedCatalogIdsFor` enumerates;
//   - each record's `functions` deep-equals its loaded body's normalized `catalog.functions`, and its
//     `submitGate` equals the tags of the body's submit-gate factories;
//   - every body registers into a real `Registry` through `ensure`, which runs the FACTORY_MISSING gate and, for
//     a derived id, the persona compose step against the real bases. That is ADR-0241 cl.8's CI guarantee: a
//     shipped persona's compose collision now surfaces at load time, so this test is where it cannot ship.
// The planted cases at the end prove each comparator reds on the drift it exists to catch.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { BUILTIN_CATALOG_RECORDS } from './records.ts'
import { loadCatalogBody, CatalogLoadError } from './loader.ts'
import { Registry } from './registry.ts'
import { A2UI_BASIC_CANONICAL_URI } from './a2ui-basic/index.ts'
import { SHIPPED_PERSONA_CATALOGS } from './personas/index.ts'
import { CatalogComposeError, composePersonaEntry, derivedCatalogIdsFor } from './compose.ts'
import { defaultCatalog } from './default/index.ts'
import { defaultFactories } from './default/factories.ts'
import { factoriesOf } from './variant.ts'
import type { Catalog } from './catalog.ts'
import type { CatalogBody, LazyCatalogRecord } from './types.ts'

declare const process: { cwd(): string }

const CATALOG_DIR = `${process.cwd()}/packages/agent-ui/a2ui/src/catalog`

/** The `catalogId` of every shipped catalog folder (a folder holding a whole `catalog.json`). */
const shippedCatalogIds = (): string[] =>
  readdirSync(CATALOG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${CATALOG_DIR}/${d.name}/catalog.json`))
    .map((d) => (JSON.parse(readFileSync(`${CATALOG_DIR}/${d.name}/catalog.json`, 'utf8')) as { catalogId: string }).catalogId)

/** Sorted, unique tags of every submit-gate factory in `body` (every variant arm). */
const gateTags = (body: CatalogBody): string[] =>
  [...new Set(Object.values(body.factories).flatMap((slot) => factoriesOf(slot).filter((f) => f.submitGate === true).map((f) => f.tag)))].sort()

/** What differs between `record`'s manifest and its loaded `body`; empty when they agree. */
function manifestProblems(record: LazyCatalogRecord, body: CatalogBody): string[] {
  const problems: string[] = []
  const catalog = body.catalog as Catalog
  if (catalog.catalogId !== record.id) problems.push(`body declares ${catalog.catalogId}`)
  if (!isDeepStrictEqual({ ...record.functions }, catalog.functions)) problems.push('functions differ')
  if (!isDeepStrictEqual([...record.submitGate].sort(), gateTags(body))) problems.push('submitGate differs')
  return problems
}

describe('built-in catalog records: the bijection with the shipped bodies (ADR-0241 cl.9)', () => {
  it('record ids equal the shipped catalog folders, the canonical alias and every persona pairing', () => {
    const shipped = shippedCatalogIds()
    expect(shipped, 'anti-vacuous: both base folders are found').toEqual(expect.arrayContaining(['agent-ui', 'a2ui-basic']))
    const expected = [...shipped, A2UI_BASIC_CANONICAL_URI, ...derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS)]
    const ids = BUILTIN_CATALOG_RECORDS.map((r) => r.id)
    expect(new Set(ids).size, 'no duplicate record').toBe(ids.length)
    expect([...ids].sort()).toEqual([...expected].sort())
    expect(ids).toContain(defaultCatalog.catalogId) // ADR-0241 Amendment: the default is a record too
  })

  it.each(BUILTIN_CATALOG_RECORDS.map((r) => [r.id, r] as const))('%s: the manifest agrees with the loaded body', async (_id, record) => {
    const body = await loadCatalogBody(record)
    expect(manifestProblems(record, body)).toEqual([])
  })

  it('every record loads and registers into a real Registry (FACTORY_MISSING gate, persona compose against the real bases)', async () => {
    const registry = new Registry()
    for (const record of BUILTIN_CATALOG_RECORDS) registry.registerLazy(record)
    for (const record of BUILTIN_CATALOG_RECORDS) {
      await registry.ensure(record.id)
      expect(registry.get(record.id)?.catalog.catalogId, record.id).toBe(record.id)
      expect(registry.recordOf(record.id), `${record.id} left the record table once loaded`).toBeUndefined()
    }
    const derived = derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS)
    expect(derived.length, 'anti-vacuous: shipped personas compose').toBeGreaterThan(0)
    for (const id of derived) {
      const persona = SHIPPED_PERSONA_CATALOGS.find((p) => id.endsWith(`--${p.personaId}`))!
      for (const type of Object.keys(persona.fragment.components)) expect(registry.get(id)?.catalog.components[type], `${id} ${type}`).toBeDefined()
    }
  })

  it('a record is a module-level singleton, so the module-wide memo serves every renderer one body', async () => {
    const [first] = BUILTIN_CATALOG_RECORDS
    expect(await loadCatalogBody(first!)).toBe(await loadCatalogBody(first!))
  })
})

describe('the gate bites (planted drift)', () => {
  const basic = BUILTIN_CATALOG_RECORDS.find((r) => r.id === 'a2ui-basic')!
  const concierge = BUILTIN_CATALOG_RECORDS.find((r) => r.id === 'agent-ui--concierge')!

  it('a manifest missing one function, or one with a widened callableFrom, is caught', async () => {
    const body = await loadCatalogBody(basic)
    const { not: _not, ...fewer } = basic.functions
    expect(manifestProblems({ ...basic, functions: fewer }, body)).toEqual(['functions differ'])
    const widened = { ...basic.functions, not: { ...basic.functions.not!, callableFrom: 'clientOrRemote' as const } }
    expect(manifestProblems({ ...basic, functions: widened }, body)).toEqual(['functions differ'])
  })

  it('a manifest that drops a submit-gate tag, or a record under the wrong id, is caught', async () => {
    const body = await loadCatalogBody(concierge)
    expect(concierge.submitGate).toContain('ui-form-provider')
    expect(manifestProblems({ ...concierge, submitGate: [] }, body)).toEqual(['submitGate differs'])
    expect(manifestProblems({ ...concierge, id: 'agent-ui--other' }, body)).toEqual(['body declares agent-ui--concierge'])
  })

  it('a persona whose fragment collides with its base fails at load as one CatalogLoadError carrying the compose error', async () => {
    const clash: LazyCatalogRecord = {
      id: 'agent-ui--clash',
      functions: defaultCatalog.functions,
      submitGate: [],
      load: async () =>
        composePersonaEntry(
          { catalog: defaultCatalog, factories: defaultFactories },
          { personaId: 'clash', fragment: { components: { Button: defaultCatalog.components.Button! }, functions: {} }, factories: {} },
        ),
    }
    const registry = new Registry()
    registry.registerLazy(clash)
    const failure = await registry.ensure('agent-ui--clash').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(CatalogLoadError)
    expect((failure as CatalogLoadError).cause).toBeInstanceOf(CatalogComposeError)
    expect(registry.get('agent-ui--clash')).toBeUndefined()
  })
})
