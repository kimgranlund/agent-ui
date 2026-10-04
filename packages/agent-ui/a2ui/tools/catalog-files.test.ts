// catalog-files.test.ts: GH #1737, the Node-side `{catalogId -> catalog.json path}` registry
// (`catalog-files.ts`) that `validate-payload.ts --catalog` and `import-seeds.ts`'s per-seed catalog
// both resolve through. Pure fs + `loadCatalog`, so no subprocess and no jsdom: the real files are read
// off the repo root, and the failure arms run against throwaway temp roots.

import { describe, it, expect, afterEach } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { CATALOG_FILES, CATALOG_IDS, createCatalogResolver, isCatalogId, loadCatalogById } from './catalog-files.ts'

declare const process: { cwd(): string }

const REAL_ROOT = process.cwd()

describe('catalog-files: the registry resolves each registered id to ITS OWN catalog', () => {
  it('registers exactly the seed catalog ids, in order', () => {
    expect(CATALOG_IDS).toEqual(['agent-ui', 'a2ui-basic'])
    expect(Object.keys(CATALOG_FILES)).toEqual([...CATALOG_IDS])
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

  it('isCatalogId is an own-key test: registered ids pass; unknown ids and Object.prototype names do not', () => {
    expect(isCatalogId('agent-ui')).toBe(true)
    expect(isCatalogId('a2ui-basic')).toBe(true)
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
