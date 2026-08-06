// index.test.ts — the `fixture-demo` persona local pattern set (SPEC-R1 AC1/AC2/AC3/AC4).

import { describe, it, expect } from 'vitest'
import { fixtureDemoFragment, fixtureDemoTargetCatalogs, fixtureDemoPersona, FIXTURE_DEMO_PERSONA_ID } from './index.ts'
import { fixtureDemoFactories } from './factories.ts'
import { Registry } from '../../registry.ts'
import { defaultCatalog } from '../../default/index.ts'
import { defaultFactories } from '../../default/factories.ts'

describe('fixture-demo persona (SPEC-R1)', () => {
  it('AC1 — lands entirely under catalog/personas/fixture-demo/, a stable kebab persona id', () => {
    expect(FIXTURE_DEMO_PERSONA_ID).toBe('fixture-demo')
    expect(fixtureDemoPersona.personaId).toBe(FIXTURE_DEMO_PERSONA_ID)
  })

  it('AC2 — the fragment loads through the SAME structural gate a whole catalog runs (a single non-colliding demo component)', () => {
    expect(Object.keys(fixtureDemoFragment.components)).toEqual(['FixtureBanner'])
    expect(fixtureDemoFragment.components.FixtureBanner?.properties.text?.mapsTo).toBe('textContent')
    expect(fixtureDemoFragment.functions).toEqual({})
  })

  it('AC2 (negative control) — a malformed fragment component still fails the SAME structural gate', async () => {
    const { loadCatalogFragment } = await import('../../compose.ts')
    expect(() => loadCatalogFragment({ components: { Bad: { properties: 'nope' } } })).toThrow(/must be an object/)
  })

  it('AC2 (negative control) — an @-prefixed fragment name fails the SAME UAX-31/reserved-namespace gate', async () => {
    const { loadCatalogFragment } = await import('../../compose.ts')
    expect(() => loadCatalogFragment({ components: { '@index': { properties: {} } } })).toThrow(/not a valid UAX-31/)
  })

  it('AC3 — the fragment declares a factory for every component it declares (the FACTORY_MISSING precondition)', () => {
    for (const type of Object.keys(fixtureDemoFragment.components)) {
      expect(Object.hasOwn(fixtureDemoFactories, type), type).toBe(true)
    }
  })

  it('AC4 — targetCatalogs names only the two currently-registered bases', () => {
    expect(fixtureDemoTargetCatalogs).toEqual(['agent-ui', 'a2ui-basic'])
  })

  it('FixtureBanner does not collide with the default catalog\'s own component/factory names', () => {
    expect(Object.hasOwn(defaultCatalog.components, 'FixtureBanner')).toBe(false)
    expect(Object.hasOwn(defaultFactories, 'FixtureBanner')).toBe(false)
  })

  it('a stand-alone Registry can register the fixture fragment merged onto the default catalog with zero throw', () => {
    const registry = new Registry()
    registry.register(defaultCatalog, defaultFactories)
    expect(() => registry.register(
      { ...defaultCatalog, catalogId: 'agent-ui--fixture-demo', components: { ...defaultCatalog.components, ...fixtureDemoFragment.components } },
      { ...defaultFactories, ...fixtureDemoFactories },
    )).not.toThrow()
  })
})
