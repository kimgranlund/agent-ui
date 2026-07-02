import { describe, it, expect, vi, afterEach } from 'vitest'
import { Registry, RegistryError, RegistryErrorCode } from './registry.ts'
import type { WidgetFactory } from './types.ts'

// All fixtures are synthetic — a registry test must not depend on the default catalog or any real
// `ui-*` control (it is decoupled from the factory/catalog.json slices, which build concurrently).

/** A synthetic factory. The registry never invokes `create`/`applyProp`; they exist only to satisfy the type. */
const fakeFactory = (tag: string): WidgetFactory => ({
  tag,
  create: () => document.createElement('div'),
  applyProp: () => {},
})

/** A synthetic, loadable catalog document declaring `types` (each an empty-prop component). */
const synthCatalog = (catalogId: string, types: string[]) => ({
  catalogId,
  protocolVersion: 'v1.0',
  components: Object.fromEntries(types.map((t) => [t, { properties: {} }])),
})

/** A factory table covering exactly `types`. */
const factoriesFor = (types: string[]): Record<string, WidgetFactory> =>
  Object.fromEntries(types.map((t) => [t, fakeFactory(`ui-${t.toLowerCase()}`)]))

afterEach(() => vi.restoreAllMocks())

describe('Registry — register / get / supportedCatalogIds (catalog LLD-C3, SPEC-R6/R7)', () => {
  it('registers a catalog and resolves it via get (catalog + factory table)', () => {
    const reg = new Registry()
    const factories = factoriesFor(['Widget'])
    reg.register(synthCatalog('proj', ['Widget']), factories)

    const entry = reg.get('proj')
    expect(entry).toBeDefined()
    expect(entry?.catalog.catalogId).toBe('proj')
    expect(Object.keys(entry?.catalog.components ?? {})).toEqual(['Widget'])
    expect(entry?.factories.Widget.tag).toBe('ui-widget')
    // stored catalog is the loader-normalized result (functions defaulted), not the raw input
    expect(entry?.catalog.functions).toEqual({})
  })

  it('returns undefined for an unregistered id (renderer CATALOG_UNKNOWN allowlist)', () => {
    const reg = new Registry()
    expect(reg.get('nope')).toBeUndefined()
  })

  it('supportedCatalogIds reflects exactly the registered set', () => {
    const reg = new Registry()
    expect(reg.supportedCatalogIds()).toEqual([])
    reg.register(synthCatalog('a', ['W']), factoriesFor(['W']))
    reg.register(synthCatalog('b', ['W']), factoriesFor(['W']))
    expect(reg.supportedCatalogIds().sort()).toEqual(['a', 'b'])
  })

  it('two-tier (N1): a synthetic multi-type project catalog registers with zero package edits', () => {
    const reg = new Registry()
    const types = Array.from({ length: 10 }, (_, i) => `Type${i}`)
    // The only API touched is the public `register` — no edit to the package's own catalog/factories.
    reg.register(synthCatalog('project', types), factoriesFor(types))

    const entry = reg.get('project')
    expect(Object.keys(entry?.catalog.components ?? {})).toHaveLength(10)
    for (const t of types) expect(entry?.factories[t]).toBeDefined()
    expect(reg.supportedCatalogIds()).toContain('project')
  })

  it('allows a factory table wider than the declared components (extras ignored)', () => {
    const reg = new Registry()
    reg.register(synthCatalog('proj', ['Widget']), factoriesFor(['Widget', 'Extra']))
    expect(reg.get('proj')).toBeDefined()
  })
})

describe('Registry — CATALOG_FACTORY_MISSING (catalog LLD-C3, SPEC-R7 AC1)', () => {
  it('throws RegistryError with code CATALOG_FACTORY_MISSING when a declared type has no factory', () => {
    const reg = new Registry()
    let thrown: unknown
    try {
      reg.register(synthCatalog('proj', ['Widget']), {})
      expect.unreachable('expected register to throw')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(RegistryError)
    expect((thrown as RegistryError).code).toBe(RegistryErrorCode.FACTORY_MISSING)
    expect((thrown as RegistryError).code).toBe('CATALOG_FACTORY_MISSING')
    expect((thrown as RegistryError).message).toMatch(/CATALOG_FACTORY_MISSING/)
    // failed registration leaves the registry untouched
    expect(reg.get('proj')).toBeUndefined()
  })

  it('throws on a partial gap — some types covered, one missing', () => {
    const reg = new Registry()
    const partial = factoriesFor(['A', 'B']) // missing 'C'
    expect(() => reg.register(synthCatalog('proj', ['A', 'B', 'C']), partial)).toThrow(RegistryError)
  })

  it('does not let a prototype key (e.g. "toString") spuriously satisfy the factory lookup', () => {
    const reg = new Registry()
    // `factories.toString` resolves to Object.prototype.toString (truthy) — an own-property check must
    // still treat the declared `toString` component as un-covered.
    expect(() => reg.register(synthCatalog('proj', ['toString']), {})).toThrow(RegistryErrorCode.FACTORY_MISSING)
    // …and an actual own factory for it registers fine. (A `string`-typed key forces the index-signature
    // lookup; `factories.toString` would instead resolve to Object.prototype.toString.)
    const key: string = 'toString'
    reg.register(synthCatalog('proj', ['toString']), { [key]: fakeFactory('ui-x') })
    expect(reg.get('proj')?.factories[key]?.tag).toBe('ui-x')
  })
})

describe('Registry — duplicate catalogId is last-wins (catalog LLD-C3, SPEC-R6)', () => {
  it('re-registering an id replaces the entry and logs the override', () => {
    const reg = new Registry()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    reg.register(synthCatalog('proj', ['A']), factoriesFor(['A']))
    reg.register(synthCatalog('proj', ['B']), factoriesFor(['B']))

    const entry = reg.get('proj')
    expect(Object.keys(entry?.catalog.components ?? {})).toEqual(['B']) // second wins
    expect(entry?.factories.B).toBeDefined()
    expect(entry?.factories.A).toBeUndefined()
    expect(reg.supportedCatalogIds()).toEqual(['proj']) // not duplicated
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('a project catalog may shadow an existing id (intentional override path)', () => {
    const reg = new Registry()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    reg.register(synthCatalog('default', ['Button']), factoriesFor(['Button']))
    reg.register(synthCatalog('default', ['Button', 'Custom']), factoriesFor(['Button', 'Custom']))
    expect(reg.get('default')?.factories.Custom).toBeDefined()
  })
})

describe('Registry — submitGateSelector (catalog LLD-C3, ADR-0054 the submit-gated action seam)', () => {
  it('NEGATIVE: no submitGate factory anywhere yields an empty selector (the provable no-op)', () => {
    const reg = new Registry()
    reg.register(synthCatalog('proj', ['Widget']), factoriesFor(['Widget']))
    expect(reg.submitGateSelector()).toBe('')
  })

  it('derives a CSS selector from the one marked factory\'s tag', () => {
    const reg = new Registry()
    reg.register(synthCatalog('proj', ['Provider', 'Widget']), {
      Provider: { ...fakeFactory('ui-provider'), submitGate: true },
      Widget: fakeFactory('ui-widget'), // unmarked — not a gate
    })
    expect(reg.submitGateSelector()).toBe('ui-provider')
  })

  it('aggregates across multiple registered catalogs (two-tier — a project catalog may add its own gate)', () => {
    const reg = new Registry()
    reg.register(synthCatalog('a', ['Provider']), { Provider: { ...fakeFactory('ui-provider'), submitGate: true } })
    reg.register(synthCatalog('b', ['OtherGate']), { OtherGate: { ...fakeFactory('ui-other-gate'), submitGate: true } })
    expect(reg.submitGateSelector().split(', ').sort()).toEqual(['ui-other-gate', 'ui-provider'])
  })

  it('dedupes a tag declared submitGate by more than one catalog', () => {
    const reg = new Registry()
    reg.register(synthCatalog('a', ['Provider']), { Provider: { ...fakeFactory('ui-provider'), submitGate: true } })
    reg.register(synthCatalog('b', ['Provider2']), { Provider2: { ...fakeFactory('ui-provider'), submitGate: true } })
    expect(reg.submitGateSelector()).toBe('ui-provider') // one tag, not 'ui-provider, ui-provider'
  })
})
