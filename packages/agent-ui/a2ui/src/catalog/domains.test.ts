// domains.test.ts: the domain catalog mechanism (T-0202, catalog architecture SPEC CA-R2 and CA-R7, W0). No domain
// ships in W0, so the mechanism is proven on seeded domains built here (a `games` fragment holding `Dice` and a
// `design` fragment holding `Palette`), and the shipped lists are held coherent and pairwise disjoint so the first
// real domain (W1) lands under the same gates.

import { describe, it, expect } from 'vitest'
import { domainCatalogId, parseDomainCatalogId, catalogIdDomains, splitCatalogId } from './catalog-id.ts'
import {
  composeDomainCatalog,
  composeDomainCatalogDocs,
  composeDomainEntry,
  domainCatalogIdsFor,
  domainSemanticChecksForCatalog,
  resolveDomainCatalogId,
  CatalogComposeError,
  CatalogComposeErrorCode,
} from './compose.ts'
import type { CatalogFragment, DomainCatalogManifest, DomainCatalogPackage } from './compose.ts'
import { gateChecksOnCatalog } from './semantic-check.ts'
import type { SemanticCheck } from './semantic-check.ts'
import { DOMAINS, domainRecordResolver, catalogRecordFor } from './records.ts'
import { Registry } from './registry.ts'
import { SHIPPED_DOMAIN_CATALOGS } from './domains/index.ts'
import { SHIPPED_DOMAIN_CATALOG_MANIFESTS } from './domains/manifests.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from './personas/manifests.ts'
import { defaultCatalog } from './default/index.ts'
import { defaultFactories } from './default/factories.ts'
import { a2uiBasicCatalog } from './a2ui-basic/index.ts'
import type { Catalog } from './catalog.ts'
import type { WidgetFactory } from './types.ts'

const fakeFactory = (tag: string): WidgetFactory => ({ tag, create: () => document.createElement('div'), applyProp: () => {} })
const fragmentOf = (...types: string[]): CatalogFragment => ({
  components: Object.fromEntries(types.map((t) => [t, { name: t, properties: {} }])),
  functions: {},
})
const domain = (domainId: string, types: string[], targetCatalogs?: string[]): DomainCatalogPackage => ({
  domainId,
  fragment: fragmentOf(...types),
  factories: Object.fromEntries(types.map((t) => [t, fakeFactory(`x-${t.toLowerCase()}`)])),
  ...(targetCatalogs === undefined ? {} : { targetCatalogs }),
})

const games = domain('games', ['Dice'], ['agent-ui', 'a2ui-basic'])
const design = domain('design', ['Palette'])

/** Every pair of `domains` whose fragments share a component or function name: the pairwise disjointness gate. */
function overlappingPairs(domains: readonly { domainId: string; fragment: CatalogFragment }[]): string[] {
  const out: string[] = []
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const a = domains[i]!
      const b = domains[j]!
      const shared = [
        ...Object.keys(a.fragment.components).filter((n) => Object.hasOwn(b.fragment.components, n)),
        ...Object.keys(a.fragment.functions).filter((n) => Object.hasOwn(b.fragment.functions, n)),
      ]
      for (const n of shared) out.push(`${a.domainId} and ${b.domainId} both declare "${n}"`)
    }
  }
  return out
}

describe('the multi-domain id grammar (CA-R2, D2)', () => {
  it('writes the domains sorted and deduplicated, joined by +', () => {
    expect(domainCatalogId('agent-ui', ['games'])).toBe('agent-ui--games')
    expect(domainCatalogId('agent-ui', ['games', 'design'])).toBe('agent-ui--design+games')
    expect(domainCatalogId('agent-ui', ['games', 'design', 'games'])).toBe('agent-ui--design+games')
    expect(domainCatalogId('agent-ui', [])).toBe('agent-ui')
  })

  it('reads a canonical id back and refuses a reversed, repeated or malformed spelling (never a second id for one catalog)', () => {
    expect(parseDomainCatalogId('agent-ui--design+games')).toEqual({ base: 'agent-ui', domains: ['design', 'games'] })
    expect(parseDomainCatalogId('agent-ui--games')).toEqual({ base: 'agent-ui', domains: ['games'] })
    for (const id of ['agent-ui', 'agent-ui--games+design', 'agent-ui--games+games', 'agent-ui--', 'agent-ui--games+', 'agent-ui--+games', 'agent-ui--a--b']) {
      expect(parseDomainCatalogId(id), id).toBeUndefined()
    }
    expect(catalogIdDomains('agent-ui--design+games')).toEqual(['design', 'games'])
    expect(catalogIdDomains('agent-ui--games+design')).toEqual([])
    expect(catalogIdDomains('agent-ui')).toEqual([])
  })

  it('resolves only shipped domains that target the base', () => {
    expect(resolveDomainCatalogId('agent-ui--design+games', [games, design])?.domains.map((d) => d.domainId)).toEqual(['design', 'games'])
    expect(resolveDomainCatalogId('a2ui-basic--design+games', [games, design]), 'design targets agent-ui alone').toBeUndefined()
    expect(resolveDomainCatalogId('a2ui-basic--games', [games, design])?.base).toBe('a2ui-basic')
    expect(resolveDomainCatalogId('agent-ui--ghost', [games, design])).toBeUndefined()
    expect(resolveDomainCatalogId('ghost--games', [games, design])).toBeUndefined()
    expect(resolveDomainCatalogId('agent-ui--games+design', [games, design])).toBeUndefined()
  })
})

describe('domain composition (CA-R2 AC1 to AC3, on seeded domains)', () => {
  it('AC1: agent-ui--games holds the games type and the bare base does not', () => {
    const derived = composeDomainCatalog(defaultCatalog, [games])
    expect(derived.catalogId).toBe('agent-ui--games')
    expect(derived.components.Dice).toBeDefined()
    expect(defaultCatalog.components.Dice).toBeUndefined()
    expect(Object.keys(derived.components).length).toBe(Object.keys(defaultCatalog.components).length + 1)
  })

  it('AC2: a domain redeclaring a base type, or a type another domain declares, fails with the colliding name', () => {
    const clashBase = domain('games', ['Button'])
    expect(() => composeDomainCatalog(defaultCatalog, [clashBase])).toThrow(/domain "games" component "Button" collides with base catalog "agent-ui"/)
    const clashDomain = domain('games', ['Palette'])
    let error: unknown
    try {
      composeDomainCatalog(defaultCatalog, [clashDomain, design])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as CatalogComposeError).code).toBe(CatalogComposeErrorCode.COLLISION)
    expect((error as CatalogComposeError).message).toMatch(/domain "games" component "Palette" collides with domain "design"/)
    expect(() => composeDomainCatalog(defaultCatalog, [games, games])).toThrow(/domain "games" is composed twice/)
  })

  it('AC3: agent-ui--design+games composes both domains, and the input order never changes the result', () => {
    const one = composeDomainCatalog(defaultCatalog, [games, design])
    const other = composeDomainCatalog(defaultCatalog, [design, games])
    expect(one.catalogId).toBe('agent-ui--design+games')
    expect(one).toEqual(other)
    expect(one.components.Dice).toBeDefined()
    expect(one.components.Palette).toBeDefined()
  })

  it('a composed entry carries the base factories plus each domain, and refuses a domain that does not target the base', () => {
    const entry = composeDomainEntry({ catalog: defaultCatalog, factories: defaultFactories }, [games, design])
    expect(entry.catalog.catalogId).toBe('agent-ui--design+games')
    expect(Object.hasOwn(entry.factories, 'Dice') && Object.hasOwn(entry.factories, 'Palette') && Object.hasOwn(entry.factories, 'Button')).toBe(true)
    expect(() => composeDomainEntry({ catalog: a2uiBasicCatalog, factories: {} }, [design])).toThrow(/does not target base catalog "a2ui-basic"/)
  })

  it('the server derive step composes every domain set per base, each under its canonical id', () => {
    const bases = new Map<string, Catalog>([
      ['agent-ui', defaultCatalog],
      ['a2ui-basic', a2uiBasicCatalog],
    ])
    const docs = composeDomainCatalogDocs(bases, [games, design])
    expect([...docs.keys()].sort()).toEqual(['a2ui-basic--games', 'agent-ui--design', 'agent-ui--design+games', 'agent-ui--games'])
    expect(composeDomainCatalogDocs(bases, []).size).toBe(0)
    expect(domainCatalogIdsFor([games, design])).toEqual(['agent-ui--games', 'a2ui-basic--games', 'agent-ui--design'])
  })
})

describe('the renderer knows a multi-domain id by parsing it (CA-R2, CA-R7)', () => {
  it('the record resolver answers a canonical id over known domains, memoized, and refuses every other spelling', () => {
    const resolve = domainRecordResolver([
      ['games', ['agent-ui', 'a2ui-basic'], []],
      ['design', ['agent-ui'], ['ui-form-provider']],
    ])
    const record = resolve('agent-ui--design+games')
    expect(record?.id).toBe('agent-ui--design+games')
    expect(record?.submitGate).toEqual(['ui-form-provider'])
    expect(resolve('agent-ui--design+games'), 'one record per id: the loader memoizes by identity').toBe(record)
    expect(resolve('a2ui-basic--games')?.id).toBe('a2ui-basic--games')
    for (const id of ['agent-ui--games+design', 'a2ui-basic--design', 'agent-ui--ghost', 'agent-ui--croupier', 'ghost--games', 'agent-ui']) {
      expect(resolve(id), id).toBeUndefined()
    }
  })

  it('a Registry with a resolver records, loads and registers a parsed id it was never told about', async () => {
    const id = 'agent-ui--design+games'
    const registry = new Registry({
      resolveRecord: (asked) =>
        asked === id
          ? { id, functions: defaultCatalog.functions, submitGate: [], load: async () => composeDomainEntry({ catalog: defaultCatalog, factories: defaultFactories }, [games, design]) }
          : undefined,
    })
    expect(registry.knows('agent-ui--games+design')).toBe(false)
    expect(registry.knows(id)).toBe(true)
    await registry.ensure(id)
    expect(registry.get(id)?.catalog.components.Dice).toBeDefined()
    expect(registry.get('agent-ui')).toBeUndefined()
    await expect(registry.ensure('agent-ui--games+design')).rejects.toThrow(/no catalog record/)
  })

  it('with no domain shipped, the renderer resolver answers nothing', () => {
    expect(catalogRecordFor('agent-ui--games')).toBeUndefined()
  })
})

describe('the shipped domain lists (CA-R7)', () => {
  const ids = (xs: readonly { domainId: string }[]): string[] => xs.map((x) => x.domainId).sort()

  it('the packages, the manifests and the records table name the same domains and targets', () => {
    expect(ids(SHIPPED_DOMAIN_CATALOG_MANIFESTS)).toEqual(ids(SHIPPED_DOMAIN_CATALOGS))
    expect(DOMAINS.map(([id]) => id).sort()).toEqual(ids(SHIPPED_DOMAIN_CATALOGS))
    for (const [id, targets] of DOMAINS) {
      const pkg = SHIPPED_DOMAIN_CATALOGS.find((d) => d.domainId === id)!
      expect([...targets].sort(), id).toEqual(domainCatalogIdsFor([pkg]).map((x) => splitCatalogId(x).base).sort())
    }
  })

  it('no domain id is a persona id (a derived tail resolves to exactly one of them)', () => {
    const personas = new Set(SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => m.personaId))
    expect(SHIPPED_DOMAIN_CATALOG_MANIFESTS.filter((d) => personas.has(d.domainId))).toEqual([])
  })

  it('every shipped domain is pairwise disjoint from every other (CA-R2: all domains compose together)', () => {
    expect(overlappingPairs(SHIPPED_DOMAIN_CATALOG_MANIFESTS)).toEqual([])
  })

  it('NEGATIVE CONTROL: two seeded domains sharing a type are reported by name', () => {
    expect(overlappingPairs([games, design])).toEqual([])
    expect(overlappingPairs([games, domain('design', ['Palette', 'Dice'])])).toEqual(['games and design both declare "Dice"'])
  })
})

describe('semantic checks attach to their domain and self-gate on their types (D4, CA-R7)', () => {
  const diceCheck: SemanticCheck = { id: 'dice-check', requires: ['Dice'], check: () => [{ code: 'DICE', path: 's:d', message: 'm' }] }
  const games2: DomainCatalogManifest = { ...games, semanticChecks: [diceCheck] }

  it('a domain id resolves its domain checks; a base id, a persona id or another domain resolves none', () => {
    expect(domainSemanticChecksForCatalog('agent-ui--games', [games2, design])).toEqual([diceCheck])
    expect(domainSemanticChecksForCatalog('agent-ui--design+games', [games2, design])).toEqual([diceCheck])
    expect(domainSemanticChecksForCatalog('agent-ui', [games2, design])).toEqual([])
    expect(domainSemanticChecksForCatalog('agent-ui--design', [games2, design])).toEqual([])
    expect(domainSemanticChecksForCatalog('agent-ui--croupier', [games2, design])).toEqual([])
  })

  it('a check runs only when the effective catalog declares every type it requires', () => {
    expect(gateChecksOnCatalog([diceCheck], composeDomainCatalog(defaultCatalog, [games]))).toEqual([diceCheck])
    expect(gateChecksOnCatalog([diceCheck], defaultCatalog)).toEqual([])
    const ungated: SemanticCheck = { id: 'free', check: () => [] }
    expect(gateChecksOnCatalog([ungated], defaultCatalog)).toEqual([ungated])
  })

  it('T-0485: a requiresAny check runs with one listed type in the catalog and is dropped with none', () => {
    const any: SemanticCheck = { id: 'any-of', requires: ['Dice'], requiresAny: ['Slider', 'Palette'], check: () => [] }
    const cat = (...types: string[]) => ({ components: Object.fromEntries(types.map((t) => [t, {}])) })
    expect(gateChecksOnCatalog([any], cat('Dice', 'Slider'))).toEqual([any])
    expect(gateChecksOnCatalog([any], cat('Dice', 'Palette'))).toEqual([any])
    expect(gateChecksOnCatalog([any], cat('Dice'))).toEqual([])
    expect(gateChecksOnCatalog([any], cat('Slider'))).toEqual([])
  })

  it('T-0401: a check is dropped on a catalog that declares any type it is gated unless', () => {
    const twin: SemanticCheck = { id: 'basic-only', unless: ['ConfirmReceipt'], check: () => [] }
    expect(Object.hasOwn(defaultCatalog.components, 'ConfirmReceipt')).toBe(true)
    expect(Object.hasOwn(a2uiBasicCatalog.components, 'ConfirmReceipt')).toBe(false)
    expect(gateChecksOnCatalog([twin], defaultCatalog)).toEqual([])
    expect(gateChecksOnCatalog([twin], a2uiBasicCatalog)).toEqual([twin])
  })

  it('the shipped croupier checks declare the types they read, which its derived catalogs hold', () => {
    const croupier = SHIPPED_PERSONA_CATALOG_MANIFESTS.find((m) => m.personaId === 'croupier')!
    expect(croupier.semanticChecks!.every((c) => (c.requires ?? []).length > 0)).toBe(true)
    const derived = { components: { ...defaultCatalog.components, ...croupier.fragment.components } }
    expect(gateChecksOnCatalog(croupier.semanticChecks!, derived)).toEqual(croupier.semanticChecks)
    expect(gateChecksOnCatalog(croupier.semanticChecks!, defaultCatalog)).toEqual([])
  })
})
