// catalog-files.test.ts: GH #1737, the Node-side `{catalogId -> catalog.json path}` registry
// (`catalog-files.ts`) that `validate-payload.ts --catalog` and `import-seeds.ts`'s per-seed catalog
// both resolve through. Pure fs + `loadCatalog`, so no subprocess and no jsdom: the real files are read
// off the repo root, and the failure arms run against throwaway temp roots.

import { describe, it, expect, afterEach } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { BASE_CATALOG_IDS, CATALOG_FILES, CATALOG_IDS, createCatalogResolver, isCatalogId, loadCatalogById, loadDerivedCatalogById, loadShippedManifests } from './catalog-files.ts'
import type { ShippedManifests } from './catalog-files.ts'
import { loadCatalogFragment } from '../src/catalog/compose.ts'
import { heal } from '../src/corpus/heal.ts'
import { validateA2ui } from '../src/corpus/validate.ts'

declare const process: { cwd(): string }

const REAL_ROOT = process.cwd()

describe('catalog-files: the registry resolves each registered id to ITS OWN catalog', () => {
  it('registers exactly the seed catalog ids, in order', () => {
    expect(CATALOG_IDS).toEqual(['agent-ui', 'a2ui-basic', 'agent-ui--croupier', 'agent-ui--concierge'])
    expect(Object.keys(CATALOG_FILES)).toEqual([...CATALOG_IDS])
    expect(BASE_CATALOG_IDS).toEqual(['agent-ui', 'a2ui-basic'])
  })

  it.each([...CATALOG_IDS])('%s loads from the real tree and declares the id it is registered under', (id) => {
    const catalog = loadCatalogById(REAL_ROOT, id)
    expect(catalog.catalogId).toBe(id)
    expect(Object.keys(catalog.components).length).toBeGreaterThan(0)
  })

  it('the two registered catalogs are DISTINCT dialects, not one document reached by two ids (Divider is Basic-only, Card is shared)', () => {
    const agentUi = loadCatalogById(REAL_ROOT, 'agent-ui')
    const basic = loadCatalogById(REAL_ROOT, 'a2ui-basic')
    expect(basic.components['Divider']).toBeDefined()
    expect(agentUi.components['Divider']).toBeUndefined()
    expect(agentUi.components['Card']).toBeDefined()
    expect(basic.components['Card']).toBeDefined()
  })

  it('a persona shard id composes its fragment over its base: the persona composite is present, the base keeps its rows (T-0240)', () => {
    const base = loadCatalogById(REAL_ROOT, 'agent-ui')
    const croupier = loadCatalogById(REAL_ROOT, 'agent-ui--croupier')
    const concierge = loadCatalogById(REAL_ROOT, 'agent-ui--concierge')
    expect(base.components['CardTable']).toBeUndefined()
    expect(croupier.components['CardTable']).toBeDefined()
    expect(croupier.components['BookingForm']).toBeUndefined()
    expect(concierge.components['BookingForm']).toBeDefined()
    expect(croupier.components['Button']).toEqual(base.components['Button'])
  })

  it('isCatalogId is an own-key test: registered ids pass; unknown ids and Object.prototype names do not', () => {
    expect(isCatalogId('agent-ui')).toBe(true)
    expect(isCatalogId('a2ui-basic')).toBe(true)
    expect(isCatalogId('agent-ui--croupier')).toBe(true)
    expect(isCatalogId('agent-ui--stylist')).toBe(false)
    expect(isCatalogId('bogus')).toBe(false)
    expect(isCatalogId('toString')).toBe(false)
    expect(isCatalogId('')).toBe(false)
  })
})

describe('catalog-files: failure arms, proven on throwaway roots (never the real tree)', () => {
  let root: string
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  /** A temp repo root holding only the listed registry entries, each file sourced from `from[id]`
   *  (default: its own real file), so a test can mis-map a path on purpose. */
  const plantRoot = (entries: Partial<Record<'agent-ui' | 'a2ui-basic', 'agent-ui' | 'a2ui-basic'>>): void => {
    root = mkdtempSync(join(tmpdir(), 'a2ui-catalog-files-'))
    for (const [id, source] of Object.entries(entries) as ['agent-ui' | 'a2ui-basic', 'agent-ui' | 'a2ui-basic'][]) {
      const dest = join(root, CATALOG_FILES[id])
      mkdirSync(dirname(dest), { recursive: true })
      cpSync(join(REAL_ROOT, CATALOG_FILES[source]), dest)
    }
  }

  it('a catalog file whose own catalogId is not the id it is registered under THROWS (a mis-mapped path never validates against the wrong catalog)', () => {
    plantRoot({ 'a2ui-basic': 'agent-ui' }) // the default catalog's bytes sitting at the Basic path
    expect(() => loadCatalogById(root, 'a2ui-basic')).toThrow(/declares catalogId "agent-ui", but it is registered as "a2ui-basic"/)
  })

  it('a registered id whose catalog file is MISSING throws ONE line naming the id, the registry path and the fs code (the CLI prints it verbatim, no stack)', () => {
    plantRoot({}) // an empty temp root: every registered file is absent
    for (const id of CATALOG_IDS) {
      expect(() => loadCatalogById(root, id)).toThrow(`catalog-files: cannot read catalog "${id}" at ${CATALOG_FILES[id]} (ENOENT)`)
    }
  })

  it('the resolver is LAZY: a root holding only the agent-ui catalog resolves agent-ui and never touches the Basic file until asked', () => {
    plantRoot({ 'agent-ui': 'agent-ui' })
    const resolve = createCatalogResolver(root)
    expect(resolve('agent-ui').catalogId).toBe('agent-ui')
    // Only an explicit request for the missing file reads it (and fails): construction and the
    // agent-ui lookup above never did.
    expect(() => resolve('a2ui-basic')).toThrow(/ENOENT/)
  })

  it('the resolver memoizes: the same id returns the SAME catalog object, so one run parses each file once', () => {
    plantRoot({ 'agent-ui': 'agent-ui', 'a2ui-basic': 'a2ui-basic' })
    const resolve = createCatalogResolver(root)
    expect(resolve('a2ui-basic')).toBe(resolve('a2ui-basic'))
    expect(resolve('agent-ui')).not.toBe(resolve('a2ui-basic'))
  })
})

// T-0247: a derived id resolves only through the hosts' derive steps over the shipped manifests.
describe('catalog-files: loadDerivedCatalogById derives only what the hosts derive (T-0247)', () => {
  const fragment = (name: string) => loadCatalogFragment({ components: { [name]: { properties: { label: { type: { type: 'string' }, bindable: true, mapsTo: 'label' } } } }, functions: {} })
  // No domain ships in the real tree yet, so the two-domain legs inject two (the shape `SHIPPED_DOMAIN_CATALOG_MANIFESTS` takes).
  const injected = (shipped: ShippedManifests): ShippedManifests => ({
    ...shipped,
    domains: [
      { domainId: 'design', fragment: fragment('PaletteChip') },
      { domainId: 'games', fragment: fragment('Token') },
    ],
  })

  it('loads the real shipped manifests under plain Node and composes a persona only over a base it targets', async () => {
    const shipped = await loadShippedManifests()
    expect(shipped.personas.map((p) => p.personaId)).toContain('stylist')
    expect(loadDerivedCatalogById(REAL_ROOT, 'agent-ui--stylist', shipped)?.components['ContrastPair']).toBeDefined()
    expect(loadDerivedCatalogById(REAL_ROOT, 'a2ui-basic--stylist', shipped), 'stylist targets agent-ui alone').toBeUndefined()
    expect(loadDerivedCatalogById(REAL_ROOT, 'a2ui-basic--croupier', shipped)?.catalogId).toBe('a2ui-basic--croupier')
    expect(loadDerivedCatalogById(REAL_ROOT, 'agent-ui--stylst', shipped)).toBeUndefined()
    expect(loadDerivedCatalogById(REAL_ROOT, 'bogus--stylist', shipped)).toBeUndefined()
    expect(loadDerivedCatalogById(REAL_ROOT, 'agent-ui', shipped)).toBeUndefined()
  })

  it('a two-domain id composes both domains over the base; the single ids hold one each; a reversed spelling or an unshipped domain derives nothing', async () => {
    const shipped = injected(await loadShippedManifests())
    const pair = loadDerivedCatalogById(REAL_ROOT, 'agent-ui--design+games', shipped)
    expect(pair?.catalogId).toBe('agent-ui--design+games')
    expect(pair?.components['PaletteChip']).toBeDefined()
    expect(pair?.components['Token']).toBeDefined()
    expect(pair?.components['Button']).toEqual(loadCatalogById(REAL_ROOT, 'agent-ui').components['Button'])
    expect(loadDerivedCatalogById(REAL_ROOT, 'agent-ui--design', shipped)?.components['Token']).toBeUndefined()
    expect(loadDerivedCatalogById(REAL_ROOT, 'agent-ui--games+design', shipped)).toBeUndefined()
    expect(loadDerivedCatalogById(REAL_ROOT, 'agent-ui--design+hospitality', shipped)).toBeUndefined()
    expect(loadDerivedCatalogById(REAL_ROOT, 'agent-ui--design+games', await loadShippedManifests()), 'none ships in the real tree').toBeUndefined()
  })

  it('a payload using both domains\' types validates clean against the pair (the validate-payload path: heal, then validateA2ui at finalize) and gets CATALOG findings against one domain alone', async () => {
    const shipped = injected(await loadShippedManifests())
    const payload = JSON.stringify([
      { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui--design+games' } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'root', component: 'Column', children: ['a', 'b'] },
            { id: 'a', component: 'PaletteChip', label: 'x' },
            { id: 'b', component: 'Token', label: 'y' },
          ],
        },
      },
    ])
    const verdictAgainst = (id: string) => {
      const catalog = loadDerivedCatalogById(REAL_ROOT, id, shipped)!
      const healed = heal(payload, { protocolVersion: catalog.protocolVersion })
      if (!healed.ok) throw new Error('payload did not parse')
      return validateA2ui(healed.messages, catalog, undefined, { atFinalize: true })
    }
    expect(verdictAgainst('agent-ui--design+games').valid).toBe(true)
    const design = verdictAgainst('agent-ui--design')
    expect(design.valid).toBe(false)
    const failures = design.valid ? [] : design.failures
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.every((f) => f.code === 'CATALOG')).toBe(true)
  })
})
