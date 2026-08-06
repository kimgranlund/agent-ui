// index.test.ts — the `concierge` persona local pattern set (SPEC-R1 AC1/AC2/AC3/AC4, GH #497),
// mirroring `fixture-demo/index.test.ts`.

import { describe, it, expect } from 'vitest'
import { conciergeFragment, conciergeTargetCatalogs, conciergePersona, CONCIERGE_PERSONA_ID } from './index.ts'
import { conciergeFactories } from './factories.ts'
import { Registry } from '../../registry.ts'
import { defaultCatalog } from '../../default/index.ts'
import { defaultFactories } from '../../default/factories.ts'
import { a2uiBasicCatalog } from '../../a2ui-basic/index.ts'
import { a2uiBasicFactories } from '../../a2ui-basic/factories.ts'

describe('concierge persona (SPEC-R1, GH #497)', () => {
  it('AC1 — lands entirely under catalog/personas/concierge/, a stable kebab persona id', () => {
    expect(CONCIERGE_PERSONA_ID).toBe('concierge')
    expect(conciergePersona.personaId).toBe(CONCIERGE_PERSONA_ID)
  })

  it('AC2 — the fragment loads through the SAME structural gate a whole catalog runs — exactly the two promoted types', () => {
    expect(Object.keys(conciergeFragment.components).sort()).toEqual(['BookingConfirmation', 'BookingForm'])
    expect(conciergeFragment.components.BookingForm?.properties.fields?.mapsTo).toBe('fields')
    expect(conciergeFragment.components.BookingForm?.children).toBe('child')
    expect(conciergeFragment.components.BookingForm?.value).toEqual({ prop: 'value', event: 'change', readProp: 'a2uiFormValue' })
    expect(conciergeFragment.components.BookingConfirmation?.properties.rows?.mapsTo).toBe('rows')
    expect(conciergeFragment.functions).toEqual({})
  })

  it('AC3 — the fragment declares a factory for every component it declares (the FACTORY_MISSING precondition)', () => {
    for (const type of Object.keys(conciergeFragment.components)) {
      expect(Object.hasOwn(conciergeFactories, type), type).toBe(true)
    }
  })

  it('AC4 — targetCatalogs names only the two currently-registered bases', () => {
    expect(conciergeTargetCatalogs).toEqual(['agent-ui', 'a2ui-basic'])
  })

  it('BookingForm/BookingConfirmation do not collide with either shipped base catalog\'s own names', () => {
    for (const type of Object.keys(conciergeFragment.components)) {
      expect(Object.hasOwn(defaultCatalog.components, type), `default: ${type}`).toBe(false)
      expect(Object.hasOwn(defaultFactories, type), `default factories: ${type}`).toBe(false)
      expect(Object.hasOwn(a2uiBasicCatalog.components, type), `a2ui-basic: ${type}`).toBe(false)
      expect(Object.hasOwn(a2uiBasicFactories, type), `a2ui-basic factories: ${type}`).toBe(false)
    }
  })

  it('a stand-alone Registry composes the concierge fragment onto EITHER shipped base with zero throw (§2.2\'s open flag, proven)', () => {
    const registry = new Registry()
    registry.register(defaultCatalog, defaultFactories)
    registry.register(a2uiBasicCatalog, a2uiBasicFactories)
    expect(() =>
      registry.register(
        { ...defaultCatalog, catalogId: 'agent-ui--concierge', components: { ...defaultCatalog.components, ...conciergeFragment.components } },
        { ...defaultFactories, ...conciergeFactories },
      ),
    ).not.toThrow()
    expect(() =>
      registry.register(
        { ...a2uiBasicCatalog, catalogId: 'a2ui-basic--concierge', components: { ...a2uiBasicCatalog.components, ...conciergeFragment.components } },
        { ...a2uiBasicFactories, ...conciergeFactories },
      ),
    ).not.toThrow()
  })
})
