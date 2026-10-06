// catalogs.test.ts: the matrix's catalog set is derived, never listed (tools/testkit/catalogs.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readdirSync } from 'node:fs'
import { armOffline } from '../../tools/testkit/offline.ts'
import { allCatalogs, BASE_CATALOGS } from '../../tools/testkit/catalogs.ts'
import { derivedCatalogId } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../catalog/personas/manifests.ts'

declare const process: { cwd(): string }

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const CATALOG_DIR = `${process.cwd()}/packages/agent-ui/a2ui/src/catalog`

function catalogJsonDirs(dir = CATALOG_DIR, rel = ''): string[] {
  const out: string[] = []
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${d.name}` : d.name
    if (d.isDirectory()) out.push(...catalogJsonDirs(`${dir}/${d.name}`, childRel))
    else if (d.name === 'catalog.json') out.push(rel)
  }
  return out
}

describe('allCatalogs', () => {
  it('the id set equals the bases plus derivedCatalogId(base, persona) for every manifest target', () => {
    const want = new Set<string>(BASE_CATALOGS.keys())
    for (const m of SHIPPED_PERSONA_CATALOG_MANIFESTS) {
      const targets = m.targetCatalogs !== undefined && m.targetCatalogs.length > 0 ? m.targetCatalogs : ['agent-ui']
      for (const base of targets) want.add(derivedCatalogId(base, m.personaId))
    }
    const ids = allCatalogs().map((c) => c.catalogId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(ids)).toEqual(want)
    expect(ids).not.toContain('https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json')
  })

  it('every catalog.json under src/catalog belongs to an enumerated catalog', () => {
    const dirs = catalogJsonDirs()
    expect(dirs.length).toBeGreaterThan(2)
    const personaIds = new Set(SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => m.personaId))
    const covered = (dir: string): boolean =>
      dir === 'default' || dir === 'a2ui-basic' || (dir.startsWith('personas/') && personaIds.has(dir.slice('personas/'.length)))
    expect(dirs.filter((d) => !covered(d))).toEqual([])
  })
})
