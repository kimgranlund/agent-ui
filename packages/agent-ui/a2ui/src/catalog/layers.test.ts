// layers.test.ts: the layer map gate (T-0202, catalog architecture SPEC CA-R1 AC1). The map in `layers.ts` is held
// equal to the catalogs: every type a shipped persona fragment or a shipped domain declares has exactly one row, a
// default-catalog type with no row is core (derived, T-0209, so no core row is ever listed), every row's home
// declares its type, and every layer sits where its home allows (agentic only in the default catalog, a fragment's
// types only in the domain layer, a domain folder's types only in that domain). The negative controls plant each
// drift into a copy and run the same predicate.

import { describe, it, expect } from 'vitest'
import { CATALOG_LAYER_MAP, LAYER_MAP_EXEMPT_HOMES, layerOf } from './layers.ts'
import type { LayerRow } from './layers.ts'
import { defaultCatalog } from './default/index.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from './personas/manifests.ts'
import { SHIPPED_DOMAIN_CATALOG_MANIFESTS } from './domains/manifests.ts'

type Homes = Readonly<Record<string, readonly string[]>>

/** Every catalog folder the map covers, to the types its `catalog.json` declares. */
const HOMES: Homes = {
  default: Object.keys(defaultCatalog.components),
  ...Object.fromEntries(SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => [`personas/${m.personaId}`, Object.keys(m.fragment.components)])),
  ...Object.fromEntries(SHIPPED_DOMAIN_CATALOG_MANIFESTS.map((m) => [`domains/${m.domainId}`, Object.keys(m.fragment.components)])),
}

/** What differs between `map` and the catalogs in `homes`; empty when the map is complete and every row agrees. */
function layerMapDefects(map: Readonly<Record<string, LayerRow>>, homes: Homes, exempt: readonly string[]): string[] {
  const out: string[] = []
  for (const [home, types] of Object.entries(homes)) {
    if (exempt.includes(home)) continue
    for (const t of types) {
      const row = map[t]
      if (row === undefined) {
        if (home !== 'default') out.push(`"${t}" (${home}) has no layer row`)
      } else if (row.home !== home) out.push(`"${t}" is declared by ${home} but mapped to ${row.home}`)
    }
  }
  for (const [t, row] of Object.entries(map)) {
    if (!(homes[row.home] ?? []).includes(t)) out.push(`"${t}" is mapped to ${row.home}, which does not declare it`)
    if (row.layer === 'core') out.push(`"${t}" is a listed core row (core is derived from the default catalog)`)
    if ((row.layer === 'domain') !== (row.domain !== undefined)) out.push(`"${t}" is ${row.layer} with domain ${String(row.domain)}`)
    if (row.layer !== 'domain' && row.home !== 'default') out.push(`"${t}" is ${row.layer} but homed in ${row.home}`)
    if (row.home.startsWith('personas/') && row.layer !== 'domain') out.push(`"${t}" is a fragment type outside the domain layer`)
    if (row.home.startsWith('domains/') && row.home !== `domains/${row.domain}`) out.push(`"${t}" is homed in ${row.home} but mapped to domain ${String(row.domain)}`)
  }
  return out
}

describe('the layer map (CA-R1)', () => {
  it('covers every default and fragment type, each row agreeing with its home', () => {
    expect(layerMapDefects(CATALOG_LAYER_MAP, HOMES, LAYER_MAP_EXEMPT_HOMES)).toEqual([])
  })

  it('anti-vacuous: all three layers hold default-catalog types, and every listed default row is a default type', () => {
    const defaultTypes = Object.keys(defaultCatalog.components)
    expect([...new Set(defaultTypes.map(layerOf))].sort()).toEqual(['agentic', 'core', 'domain'])
    const mappedDefault = Object.entries(CATALOG_LAYER_MAP).filter(([, r]) => r.home === 'default').map(([t]) => t)
    expect(mappedDefault.length).toBeGreaterThan(0)
    for (const t of mappedDefault) expect(defaultTypes, t).toContain(t)
  })

  it('domain ids are the CA-R8 nouns, and the exempt home is the composition fixture alone', () => {
    const domains = new Set(Object.values(CATALOG_LAYER_MAP).flatMap((r) => (r.domain === undefined ? [] : [r.domain])))
    for (const d of domains) expect(d, d).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(LAYER_MAP_EXEMPT_HOMES).toEqual(['personas/fixture-demo'])
  })
})

describe('the layer map gate bites (planted drift)', () => {
  const copy = (): Record<string, LayerRow> => ({ ...CATALOG_LAYER_MAP })

  it('NEGATIVE CONTROL: a fragment type with no row reds, and a hand-listed core row reds', () => {
    const planted = copy()
    delete planted.PlayingCard
    expect(layerMapDefects(planted, HOMES, LAYER_MAP_EXEMPT_HOMES)).toEqual(['"PlayingCard" (personas/croupier) has no layer row'])
    const listed = { ...copy(), Badge: { layer: 'core' as const, home: 'default' } }
    expect(layerMapDefects(listed, HOMES, LAYER_MAP_EXEMPT_HOMES)).toEqual(['"Badge" is a listed core row (core is derived from the default catalog)'])
  })

  it('NEGATIVE CONTROL: a type moved to its domain without a map edit reds (the W2 move and the row change together)', () => {
    const moved: Homes = { ...HOMES, default: HOMES.default!.filter((t) => t !== 'BoardGrid'), 'domains/games': ['BoardGrid'] }
    expect(layerMapDefects(CATALOG_LAYER_MAP, moved, LAYER_MAP_EXEMPT_HOMES)).toEqual([
      '"BoardGrid" is declared by domains/games but mapped to default',
      '"BoardGrid" is mapped to default, which does not declare it',
    ])
    const fixed = { ...copy(), BoardGrid: { layer: 'domain' as const, domain: 'games', home: 'domains/games' } }
    expect(layerMapDefects(fixed, moved, LAYER_MAP_EXEMPT_HOMES)).toEqual([])
  })

  it('NEGATIVE CONTROL: a layer its home cannot hold reds', () => {
    const coreDomain = { ...copy(), Badge: { layer: 'core' as const, domain: 'games', home: 'default' } }
    expect(layerMapDefects(coreDomain, HOMES, LAYER_MAP_EXEMPT_HOMES)).toEqual([
      '"Badge" is a listed core row (core is derived from the default catalog)',
      '"Badge" is core with domain games',
    ])
    const fragmentCore = { ...copy(), CardTable: { layer: 'core' as const, home: 'personas/croupier' } }
    expect(layerMapDefects(fragmentCore, HOMES, LAYER_MAP_EXEMPT_HOMES)).toEqual([
      '"CardTable" is a listed core row (core is derived from the default catalog)',
      '"CardTable" is core but homed in personas/croupier',
      '"CardTable" is a fragment type outside the domain layer',
    ])
    const wrongDomain: Homes = { ...HOMES, 'domains/games': ['Dice'] }
    const dice = { ...copy(), Dice: { layer: 'domain' as const, domain: 'design', home: 'domains/games' } }
    expect(layerMapDefects(dice, wrongDomain, LAYER_MAP_EXEMPT_HOMES)).toEqual(['"Dice" is homed in domains/games but mapped to domain design'])
  })
})
