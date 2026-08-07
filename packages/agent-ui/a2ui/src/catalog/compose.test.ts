// compose.test.ts — the persona catalog compose-time overlay (SPEC-R2, `persona-catalog-composition.spec.md`).
// Synthetic fixtures throughout (the `registry.test.ts` precedent) — decoupled from the real
// default/a2ui-basic catalogs so this suite proves the MECHANISM, not any one shipped catalog's content.

import { describe, it, expect } from 'vitest'
import {
  composeCatalog,
  composePersonaCatalogs,
  composePersonaCatalogDocs,
  loadCatalogFragment,
  derivedCatalogId,
  derivedCatalogIdsFor,
  CatalogComposeError,
  CatalogComposeErrorCode,
} from './compose.ts'
import type { CatalogFragment, PersonaCatalogPackage, PersonaCatalogManifest } from './compose.ts'
import { Registry } from './registry.ts'
import type { WidgetFactory } from './types.ts'
import type { Catalog } from './catalog.ts'

const fakeFactory = (tag: string): WidgetFactory => ({
  tag,
  create: () => document.createElement('div'),
  applyProp: () => {},
})

const comp = (name: string) => ({ name, properties: {} })

const baseCatalog = (catalogId: string, types: string[], fns: string[] = []): Catalog => ({
  catalogId,
  protocolVersion: 'v1.0',
  components: Object.fromEntries(types.map((t) => [t, comp(t)])),
  functions: Object.fromEntries(fns.map((f) => [f, { args: {}, returns: { type: 'boolean' }, callableFrom: 'clientOnly' as const }])),
})

const emptyFragment: CatalogFragment = { components: {}, functions: {} }

describe('derivedCatalogId — OF1b naming convention', () => {
  it('is `<base>--<persona>`', () => {
    expect(derivedCatalogId('agent-ui', 'concierge')).toBe('agent-ui--concierge')
    expect(derivedCatalogId('a2ui-basic', 'croupier')).toBe('a2ui-basic--croupier')
  })
})

describe('composeCatalog — AC1 identity case', () => {
  it('an empty fragment composes to a content-equal copy of the base\'s components/functions', () => {
    const base = baseCatalog('agent-ui', ['Card', 'Button'], ['email'])
    const derived = composeCatalog(base, emptyFragment, 'nobody')
    expect(derived.components).toEqual(base.components)
    expect(derived.functions).toEqual(base.functions)
    expect(derived.catalogId).toBe('agent-ui--nobody')
  })
})

describe('composeCatalog — AC2 non-colliding union', () => {
  it('the derived components/functions maps are exactly {...base, ...local}', () => {
    const base = baseCatalog('agent-ui', ['Card', 'Button'], ['email'])
    const local: CatalogFragment = {
      components: { Widget: comp('Widget') },
      functions: { greet: { args: {}, returns: { type: 'string' }, callableFrom: 'clientOnly' } },
    }
    const derived = composeCatalog(base, local, 'p1')
    expect(Object.keys(derived.components).sort()).toEqual(['Button', 'Card', 'Widget'])
    expect(Object.keys(derived.functions).sort()).toEqual(['email', 'greet'])
    expect(derived.components.Card).toEqual(base.components.Card)
    expect(derived.components.Widget).toEqual(local.components.Widget)
  })
})

describe('composeCatalog — AC3 collision case (OF1, ruled reject-loud)', () => {
  it('throws CatalogComposeError naming the persona, base catalogId, and colliding component name', () => {
    const base = baseCatalog('agent-ui', ['Card'])
    const local: CatalogFragment = { components: { Card: comp('Card') }, functions: {} }
    let error: unknown
    try {
      composeCatalog(base, local, 'concierge')
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as CatalogComposeError).code).toBe(CatalogComposeErrorCode.COLLISION)
    expect((error as Error).message).toContain('concierge')
    expect((error as Error).message).toContain('agent-ui')
    expect((error as Error).message).toContain('Card')
  })

  it('a colliding function name also throws COLLISION', () => {
    const base = baseCatalog('agent-ui', [], ['email'])
    const local: CatalogFragment = { components: {}, functions: { email: { args: {}, returns: { type: 'boolean' }, callableFrom: 'clientOnly' } } }
    expect(() => composeCatalog(base, local, 'p')).toThrow(CatalogComposeError)
  })

  it('a collision against one targeted base never blocks a different (non-colliding) base\'s pairing for the same fragment', () => {
    const collidingBase = baseCatalog('agent-ui', ['Card'])
    const cleanBase = baseCatalog('a2ui-basic', ['Text'])
    const local: CatalogFragment = { components: { Card: comp('Card') }, functions: {} }
    expect(() => composeCatalog(collidingBase, local, 'p')).toThrow(CatalogComposeError)
    expect(() => composeCatalog(cleanBase, local, 'p')).not.toThrow()
    const derived = composeCatalog(cleanBase, local, 'p')
    expect(Object.keys(derived.components).sort()).toEqual(['Card', 'Text'])
  })
})

describe('composeCatalog — AC5 protocolVersion carries through unchanged', () => {
  it('carries THAT base\'s protocolVersion, independent per targeted base', () => {
    // distinct versions so cross-contamination between derivations is detectable (composeCatalog is a
    // pure passthrough — no version validation blocks the v0.9.1 fixture)
    const baseA: Catalog = baseCatalog('agent-ui', ['Card'])
    const baseB: Catalog = { ...baseCatalog('a2ui-basic', ['Text']), protocolVersion: 'v0.9.1' }
    const derivedA = composeCatalog(baseA, emptyFragment, 'p')
    const derivedB = composeCatalog(baseB, emptyFragment, 'p')
    expect(derivedA.protocolVersion).toBe('v1.0')
    expect(derivedB.protocolVersion).toBe('v0.9.1')
    expect(derivedA.protocolVersion).not.toBe(derivedB.protocolVersion)
  })
})

describe('loadCatalogFragment — SPEC-R1 AC2', () => {
  it('an empty fragment (identity-case input) loads without the whole-catalog ≥1-component gate', () => {
    expect(loadCatalogFragment({ components: {}, functions: {} })).toEqual({ components: {}, functions: {} })
    expect(loadCatalogFragment({})).toEqual({ components: {}, functions: {} })
  })

  it('runs the SAME structural + UAX-31 naming gates a whole catalog document runs', () => {
    expect(() => loadCatalogFragment({ components: { '@bad': { properties: {} } } })).toThrow(/UAX-31/)
    expect(() => loadCatalogFragment({ components: { Ok: { properties: 'nope' } } })).toThrow()
    expect(() => loadCatalogFragment('not json{')).toThrow()
  })

  it('accepts a JSON string input, mirroring loadCatalog', () => {
    expect(loadCatalogFragment('{"components":{},"functions":{}}')).toEqual({ components: {}, functions: {} })
  })
})

describe('composePersonaCatalogs — SPEC-R2 constructor-time derive-then-register step', () => {
  function registryWithBases(): Registry {
    const registry = new Registry()
    registry.register(baseCatalog('agent-ui', ['Card']), { Card: fakeFactory('ui-card') })
    registry.register(baseCatalog('a2ui-basic', ['Text']), { Text: fakeFactory('ui-text') })
    return registry
  }

  it('registers one derived catalog per (fragment, targeted base) pairing', () => {
    const registry = registryWithBases()
    const persona: PersonaCatalogPackage = {
      personaId: 'concierge',
      fragment: { components: { Widget: comp('Widget') }, functions: {} },
      factories: { Widget: fakeFactory('div') },
      targetCatalogs: ['agent-ui', 'a2ui-basic'],
    }
    composePersonaCatalogs(registry, [persona])
    expect(registry.get('agent-ui--concierge')).toBeDefined()
    expect(registry.get('a2ui-basic--concierge')).toBeDefined()
    expect(Object.keys(registry.get('agent-ui--concierge')!.catalog.components).sort()).toEqual(['Card', 'Widget'])
    expect(Object.keys(registry.get('a2ui-basic--concierge')!.catalog.components).sort()).toEqual(['Text', 'Widget'])
  })

  it('absent targetCatalogs defaults to [\'agent-ui\'] alone', () => {
    const registry = registryWithBases()
    const persona: PersonaCatalogPackage = {
      personaId: 'p',
      fragment: { components: {}, functions: {} },
      factories: {},
    }
    composePersonaCatalogs(registry, [persona])
    expect(registry.get('agent-ui--p')).toBeDefined()
    expect(registry.get('a2ui-basic--p')).toBeUndefined()
  })

  it('AC6 — an unregistered target-base id fails loud at constructor time', () => {
    const registry = registryWithBases()
    const persona: PersonaCatalogPackage = {
      personaId: 'p',
      fragment: { components: {}, functions: {} },
      factories: {},
      targetCatalogs: ['not-a-real-base'],
    }
    let error: unknown
    try {
      composePersonaCatalogs(registry, [persona])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as CatalogComposeError).code).toBe(CatalogComposeErrorCode.UNKNOWN_TARGET)
  })

  it('a REGISTERED-but-illegitimate target (the a2ui-basic canonical-URI alias) fails loud too — an existence check alone is not enough', () => {
    // Simulate ADR-0169 cl.13's own registration: the SAME bytes registered a SECOND time under the
    // upstream canonical URI, exactly as renderer.ts's own a2uiBasicCatalogCanonical does beside
    // a2uiBasicCatalog. That second registration IS real (registry.get resolves it) — SPEC-R2's own
    // prose is explicit it is never a legal composition target regardless.
    const CANONICAL_URI = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'
    const registry = registryWithBases()
    registry.register(baseCatalog(CANONICAL_URI, ['Text']), { Text: fakeFactory('ui-text') })
    expect(registry.get(CANONICAL_URI)).toBeDefined() // anti-vacuous: the alias really did register

    const persona: PersonaCatalogPackage = {
      personaId: 'p',
      fragment: { components: {}, functions: {} },
      factories: {},
      targetCatalogs: [CANONICAL_URI],
    }
    let error: unknown
    try {
      composePersonaCatalogs(registry, [persona])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as CatalogComposeError).code).toBe(CatalogComposeErrorCode.UNKNOWN_TARGET)
    expect(registry.get(`${CANONICAL_URI}--p`)).toBeUndefined() // never silently composed+registered
  })

  it('derivedCatalogIdsFor mirrors the SAME legal-target allowlist — throws on an illegitimate target even though it is registered', () => {
    const persona: PersonaCatalogPackage = {
      personaId: 'p',
      fragment: { components: {}, functions: {} },
      factories: {},
      targetCatalogs: ['https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'],
    }
    let error: unknown
    try {
      derivedCatalogIdsFor([persona])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as CatalogComposeError).code).toBe(CatalogComposeErrorCode.UNKNOWN_TARGET)
  })

  it('the collision case throws through composePersonaCatalogs too — zero-half-composed registration', () => {
    const registry = registryWithBases()
    const persona: PersonaCatalogPackage = {
      personaId: 'p',
      fragment: { components: { Card: comp('Card') }, functions: {} },
      factories: { Card: fakeFactory('div') },
      targetCatalogs: ['agent-ui'],
    }
    expect(() => composePersonaCatalogs(registry, [persona])).toThrow(CatalogComposeError)
    expect(registry.get('agent-ui--p')).toBeUndefined()
  })

  it('the combined factory table (base + local) satisfies the registry\'s own FACTORY_MISSING gate — zero CATALOG_FACTORY_MISSING', () => {
    const registry = registryWithBases()
    const persona: PersonaCatalogPackage = {
      personaId: 'ok',
      fragment: { components: { Widget: comp('Widget') }, functions: {} },
      factories: { Widget: fakeFactory('div') },
      targetCatalogs: ['agent-ui'],
    }
    expect(() => composePersonaCatalogs(registry, [persona])).not.toThrow()
  })

  it('merges the per-catalog function-impl override table (base + local, ADR-0169 cl.8, reused unchanged)', () => {
    const registry = new Registry()
    registry.register(baseCatalog('agent-ui', ['Card'], ['email']), { Card: fakeFactory('ui-card') }, { email: () => true })
    const persona: PersonaCatalogPackage = {
      personaId: 'p',
      fragment: { components: {}, functions: { greet: { args: {}, returns: { type: 'string' }, callableFrom: 'clientOnly' } } },
      factories: {},
      functions: { greet: () => 'hi' },
      targetCatalogs: ['agent-ui'],
    }
    composePersonaCatalogs(registry, [persona])
    const entry = registry.get('agent-ui--p')!
    expect(entry.functions?.email?.({})).toBe(true)
    expect(entry.functions?.greet?.({})).toBe('hi')
  })
})

describe('composePersonaCatalogDocs — GH #516, the server-host (DOM-less) twin of composePersonaCatalogs', () => {
  function basesMap(): Map<string, Catalog> {
    return new Map([
      ['agent-ui', baseCatalog('agent-ui', ['Card'])],
      ['a2ui-basic', baseCatalog('a2ui-basic', ['Text'])],
    ])
  }

  it('composes one derived Catalog DOCUMENT per (fragment, targeted base) pairing — no factories/registry needed', () => {
    const manifest: PersonaCatalogManifest = {
      personaId: 'croupier',
      fragment: { components: { PlayingCard: comp('PlayingCard') }, functions: {} },
      targetCatalogs: ['agent-ui', 'a2ui-basic'],
    }
    const derived = composePersonaCatalogDocs(basesMap(), [manifest])
    expect(derived.size).toBe(2)
    const agentUiDerived = derived.get('agent-ui--croupier')!
    const basicDerived = derived.get('a2ui-basic--croupier')!
    expect(agentUiDerived).toBeDefined()
    expect(basicDerived).toBeDefined()
    // the persona's own local pattern's inventory is REALLY present in the derived catalog document —
    // the exact thing GH #516's server hosts must resolve to for BOTH prompt teaching and validation.
    expect(Object.keys(agentUiDerived.components).sort()).toEqual(['Card', 'PlayingCard'])
    expect(Object.keys(basicDerived.components).sort()).toEqual(['PlayingCard', 'Text'])
  })

  it('absent targetCatalogs defaults to [\'agent-ui\'] alone (SPEC-R1\'s own widening note, unchanged for the manifest twin)', () => {
    const manifest: PersonaCatalogManifest = { personaId: 'p', fragment: { components: {}, functions: {} } }
    const derived = composePersonaCatalogDocs(basesMap(), [manifest])
    expect(derived.has('agent-ui--p')).toBe(true)
    expect(derived.has('a2ui-basic--p')).toBe(false)
  })

  it('AC3 — the collision case reject-loud posture holds identically for the DOM-less doc-only path', () => {
    const manifest: PersonaCatalogManifest = {
      personaId: 'p',
      fragment: { components: { Card: comp('Card') }, functions: {} },
      targetCatalogs: ['agent-ui'],
    }
    expect(() => composePersonaCatalogDocs(basesMap(), [manifest])).toThrow(CatalogComposeError)
  })

  it('AC6 — an unregistered target-base id fails loud, never a silent skip', () => {
    const manifest: PersonaCatalogManifest = {
      personaId: 'p',
      fragment: { components: {}, functions: {} },
      targetCatalogs: ['not-a-real-base'],
    }
    let error: unknown
    try {
      composePersonaCatalogDocs(basesMap(), [manifest])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as CatalogComposeError).code).toBe(CatalogComposeErrorCode.UNKNOWN_TARGET)
  })

  it('a base id that is legal but simply absent from the caller-supplied `bases` map also fails loud (never falls through undefined)', () => {
    const onlyDefault = new Map([['agent-ui', baseCatalog('agent-ui', ['Card'])]])
    const manifest: PersonaCatalogManifest = {
      personaId: 'p',
      fragment: { components: {}, functions: {} },
      targetCatalogs: ['a2ui-basic'],
    }
    let error: unknown
    try {
      composePersonaCatalogDocs(onlyDefault, [manifest])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(CatalogComposeError)
    expect((error as CatalogComposeError).code).toBe(CatalogComposeErrorCode.UNKNOWN_TARGET)
  })
})
