// index.test.ts — the `hospitality` domain (T-0197; first shipped as the concierge persona local pattern set, SPEC-R1
// AC1/AC2/AC3/AC4, GH #497),
// mirroring `fixture-demo/index.test.ts`.

import { describe, it, expect } from 'vitest'
import { hospitalityFragment, hospitalityTargetCatalogs, hospitalityDomain, HOSPITALITY_DOMAIN_ID } from './index.ts'
import { hospitalityFactories } from './factories.ts'
import { Registry } from '../../registry.ts'
import { defaultCatalog } from '../../default/index.ts'
import { defaultFactories } from '../../default/factories.ts'
import { a2uiBasicCatalog } from '../../a2ui-basic/index.ts'
import { a2uiBasicFactories } from '../../a2ui-basic/factories.ts'

describe('hospitality domain (SPEC-R1, GH #497, T-0197)', () => {
  it('AC1 — lands entirely under catalog/domains/hospitality/, a stable lowercase domain id', () => {
    expect(HOSPITALITY_DOMAIN_ID).toBe('hospitality')
    expect(hospitalityDomain.domainId).toBe(HOSPITALITY_DOMAIN_ID)
  })

  it('AC2 — the fragment loads through the SAME structural gate a whole catalog runs — the two promoted types and the Itinerary (T-0199)', () => {
    expect(Object.keys(hospitalityFragment.components).sort()).toEqual(['BookingConfirmation', 'BookingForm', 'Itinerary'])
    expect(hospitalityFragment.components.BookingForm?.properties.fields?.mapsTo).toBe('fields')
    expect(hospitalityFragment.components.BookingForm?.children).toBe('child')
    expect(hospitalityFragment.components.BookingForm?.value).toEqual({ prop: 'value', event: 'change', readProp: 'a2uiFormValue' })
    expect(hospitalityFragment.components.BookingConfirmation?.properties.rows?.mapsTo).toBe('rows')
    expect(hospitalityFragment.functions).toEqual({})
  })

  it('BookingForm.fields kind enum admits dateSingle, select, checkbox, text and number (T-0079), and dateRange, radio, time and stepper (T-0197)', () => {
    const fields = hospitalityFragment.components.BookingForm?.properties.fields?.type as unknown as {
      items: { properties: { kind: { enum: string[] } } }
    }
    expect(fields.items.properties.kind.enum).toEqual(['dateSingle', 'dateRange', 'select', 'radio', 'checkbox', 'text', 'number', 'time', 'stepper'])
  })

  it('AC3 — the fragment declares a factory for every component it declares (the FACTORY_MISSING precondition)', () => {
    for (const type of Object.keys(hospitalityFragment.components)) {
      expect(Object.hasOwn(hospitalityFactories, type), type).toBe(true)
    }
  })

  it('AC4 — targetCatalogs names only the two currently-registered bases', () => {
    expect(hospitalityTargetCatalogs).toEqual(['agent-ui', 'a2ui-basic'])
  })

  it('BookingForm/BookingConfirmation do not collide with either shipped base catalog\'s own names', () => {
    for (const type of Object.keys(hospitalityFragment.components)) {
      expect(Object.hasOwn(defaultCatalog.components, type), `default: ${type}`).toBe(false)
      expect(Object.hasOwn(defaultFactories, type), `default factories: ${type}`).toBe(false)
      expect(Object.hasOwn(a2uiBasicCatalog.components, type), `a2ui-basic: ${type}`).toBe(false)
      expect(Object.hasOwn(a2uiBasicFactories, type), `a2ui-basic factories: ${type}`).toBe(false)
    }
  })

  it('a stand-alone Registry composes the hospitality fragment onto EITHER shipped base with zero throw (§2.2\'s open flag, proven)', () => {
    const registry = new Registry()
    registry.register(defaultCatalog, defaultFactories)
    registry.register(a2uiBasicCatalog, a2uiBasicFactories)
    expect(() =>
      registry.register(
        { ...defaultCatalog, catalogId: 'agent-ui--hospitality', components: { ...defaultCatalog.components, ...hospitalityFragment.components } },
        { ...defaultFactories, ...hospitalityFactories },
      ),
    ).not.toThrow()
    expect(() =>
      registry.register(
        { ...a2uiBasicCatalog, catalogId: 'a2ui-basic--hospitality', components: { ...a2uiBasicCatalog.components, ...hospitalityFragment.components } },
        { ...a2uiBasicFactories, ...hospitalityFactories },
      ),
    ).not.toThrow()
  })
})
