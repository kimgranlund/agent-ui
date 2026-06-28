import { describe, it, expect } from 'vitest'
import {
  buttonFactory,
  textFieldFactory,
  rowFactory,
  columnFactory,
  cardFactory,
  cardContentFactory,
  tabsFactory,
  modalFactory,
  defaultFactories,
} from './factories.ts'
import { defaultCatalog } from './index.ts'
import { Registry, RegistryError, RegistryErrorCode } from '../registry.ts'

// factories.ts imports the @agent-ui/components controls barrel, so the SHIPPED tags self-define on load
// (ui-button G5, ui-text-field G6; the G9 container tags self-define once their folders + the s12 barrel
// land). This slice proves the factory CONTRACT — table parity, the ui-* tag, the accessor mapping, the
// two-way `value` bind. The live render-integration (a payload → an upgraded ui-* control) is the standing
// gate's job AFTER s12, per the decomp; here `create()` may yield an un-upgraded element for a G9 tag and
// the accessor mapping is asserted as the own-property set the upgrade dance will adopt.

describe('default catalog factories — table parity (catalog LLD-C5, SPEC-R3 AC1 / R7 AC1)', () => {
  it('declares exactly one factory per catalog component type — no gap, no extra', () => {
    expect(Object.keys(defaultFactories).sort()).toEqual(Object.keys(defaultCatalog.components).sort())
  })

  it('every declared component resolves to a ui-* factory', () => {
    for (const type of Object.keys(defaultCatalog.components)) {
      const factory = defaultFactories[type]
      expect(factory, `factory for ${type}`).toBeDefined()
      expect(factory.tag).toMatch(/^ui-/)
    }
  })

  it('registers cleanly against the real Registry (0 CATALOG_FACTORY_MISSING)', () => {
    const reg = new Registry()
    expect(() => reg.register(defaultCatalog, defaultFactories)).not.toThrow()
    expect(reg.supportedCatalogIds()).toContain('agent-ui')
  })

  it('NEGATIVE: a catalog type with no factory throws CATALOG_FACTORY_MISSING (SPEC-R6/R7)', () => {
    const reg = new Registry()
    const { Card: _omitted, ...factoriesMissingCard } = defaultFactories // drop Card's factory
    let thrown: unknown
    try {
      reg.register(defaultCatalog, factoriesMissingCard)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RegistryError)
    expect((thrown as RegistryError).code).toBe(RegistryErrorCode.FACTORY_MISSING)
  })
})

describe('default catalog factories — Button + TextField (catalog LLD-C5, SPEC-R4)', () => {
  it('Button → ui-button maps variant (prop) + label (textContent); not an input (no value bind)', () => {
    expect(buttonFactory.tag).toBe('ui-button')
    expect(buttonFactory.value).toBeUndefined() // Button is not an input — LLD-C8 wires no two-way binding
    const el = buttonFactory.create()
    buttonFactory.applyProp(el, 'variant', 'soft')
    expect((el as { variant?: unknown }).variant).toBe('soft')
    buttonFactory.applyProp(el, 'label', 'Hi')
    expect(el.textContent).toBe('Hi')
  })

  it('TextField → ui-text-field is value-bound on the change event (the LLD-C8 back-fill, ADR-0019 cl.3)', () => {
    expect(textFieldFactory.tag).toBe('ui-text-field')
    expect(textFieldFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = textFieldFactory.create()
    textFieldFactory.applyProp(el, 'value', 'hello')
    textFieldFactory.applyProp(el, 'label', 'Name')
    expect((el as unknown as Record<string, unknown>).value).toBe('hello')
    expect((el as unknown as Record<string, unknown>).label).toBe('Name')
  })
})

describe('default catalog factories — G9 container family (catalog LLD-C5, SPEC-R4/R8)', () => {
  it('Row → ui-row maps the surface + flex grammar onto accessors', () => {
    expect(rowFactory.tag).toBe('ui-row')
    expect(rowFactory.value).toBeUndefined() // layout primitive, not an input
    const el = rowFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-row')
    rowFactory.applyProp(el, 'elevation', '2')
    rowFactory.applyProp(el, 'align', 'center')
    rowFactory.applyProp(el, 'gap', 'md')
    rowFactory.applyProp(el, 'wrap', true)
    expect((el as unknown as Record<string, unknown>).elevation).toBe('2')
    expect((el as unknown as Record<string, unknown>).align).toBe('center')
    expect((el as unknown as Record<string, unknown>).gap).toBe('md')
    expect((el as unknown as Record<string, unknown>).wrap).toBe(true)
  })

  it('Column → ui-column shares the same accessor grammar', () => {
    expect(columnFactory.tag).toBe('ui-column')
    const el = columnFactory.create()
    columnFactory.applyProp(el, 'justify', 'between')
    expect((el as unknown as Record<string, unknown>).justify).toBe('between')
  })

  it('Card → ui-card maps the surface axes; CardContent → ui-card-content maps scrollable', () => {
    expect(cardFactory.tag).toBe('ui-card')
    const card = cardFactory.create()
    cardFactory.applyProp(card, 'brightness', '1')
    expect((card as unknown as Record<string, unknown>).brightness).toBe('1')

    expect(cardContentFactory.tag).toBe('ui-card-content')
    const content = cardContentFactory.create()
    cardContentFactory.applyProp(content, 'scrollable', true) // renamed from `scroll` — collides with Element.scroll()
    expect((content as unknown as Record<string, unknown>).scrollable).toBe(true)
  })

  it('Tabs → ui-tabs is two-way bound on selected via the select event (ADR-0019 cl.2)', () => {
    expect(tabsFactory.tag).toBe('ui-tabs')
    expect(tabsFactory.value).toEqual({ prop: 'selected', event: 'select' })
    const el = tabsFactory.create()
    tabsFactory.applyProp(el, 'selected', 1)
    expect((el as unknown as Record<string, unknown>).selected).toBe(1)
  })

  it('Modal → ui-modal is two-way bound on open via the toggle event (ADR-0019 cl.2)', () => {
    expect(modalFactory.tag).toBe('ui-modal')
    expect(modalFactory.value).toEqual({ prop: 'open', event: 'toggle' })
    const el = modalFactory.create()
    modalFactory.applyProp(el, 'open', true)
    modalFactory.applyProp(el, 'dismissable', false)
    expect((el as unknown as Record<string, unknown>).open).toBe(true)
    expect((el as unknown as Record<string, unknown>).dismissable).toBe(false)
  })

  it('applyProp honours every declared accessor prop for each container/input factory (mapsTo == name)', () => {
    // The container family + text-field declare `mapsTo` equal to the property name (the SPEC-R8 1:1
    // reflection), so `applyProp(el, name, v)` must land `v` on `el[mapsTo]`. Walk the catalog and assert
    // it for every accessor-mapped type (Button's label→textContent is the one non-identity map — skip it).
    for (const [type, def] of Object.entries(defaultCatalog.components)) {
      if (type === 'Button') continue
      const factory = defaultFactories[type]
      const el = factory.create()
      for (const [name, pd] of Object.entries(def.properties)) {
        const sentinel = `sentinel-${name}`
        factory.applyProp(el, name, sentinel)
        expect((el as unknown as Record<string, unknown>)[pd.mapsTo], `${type}.${name} → ${pd.mapsTo}`).toBe(sentinel)
      }
    }
  })
})
