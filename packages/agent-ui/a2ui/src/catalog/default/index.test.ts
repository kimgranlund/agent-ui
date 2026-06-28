import { describe, it, expect } from 'vitest'
import { defaultCatalog } from './index.ts'
import { validateCatalogConformance } from '../conformance.ts'
import type { A2uiComponent } from '../../protocol.ts'

// The catalog loaded at import via `loadCatalog` (catalog LLD-C1) — so its mere presence already proves
// SPEC-R1 (well-formed) + SPEC-R2 (every component/property name is a valid UAX-31, non-`@` identifier:
// an invalid name throws CATALOG_NAME_INVALID at load, which would fail this module's import). These
// assertions pin the G9 container declarations + the two-way binds + the conformance verdicts on top.

describe('default catalog (catalog LLD-C4, SPEC-R1/R3/R8/N2)', () => {
  it('loads + exposes the typed Catalog', () => {
    expect(defaultCatalog.catalogId).toBe('agent-ui')
    expect(defaultCatalog.protocolVersion).toBe('v1.0')
  })

  it('declares the shipped family — Button + TextField + the G9 containers (SPEC-N2: no silent dead types)', () => {
    // Shipped: Button (G5), TextField (G6), the G9 containers (Row/Column/Card + regions, Tabs + tab/panel,
    // Modal). ABSENT by discipline: Image/Video (no media primitive yet); ui-list/ui-grid are direct ui-*
    // primitives, NOT catalog types (ratified G9 scope). No `@`-namespaced or dead types.
    expect(Object.keys(defaultCatalog.components).sort()).toEqual(
      [
        'Button',
        'Card',
        'CardContent',
        'CardFooter',
        'CardHeader',
        'Column',
        'Modal',
        'Row',
        'Tab',
        'TabPanel',
        'Tabs',
        'TextField',
      ].sort(),
    )
  })

  it('does NOT declare the deliberately-absent / non-catalog types (Image/Video/List/Grid)', () => {
    for (const absent of ['Image', 'Video', 'List', 'Grid']) {
      expect(defaultCatalog.components[absent], absent).toBeUndefined()
    }
  })

  it('every component name defaults to its declaring key (type identity payloads reference)', () => {
    for (const [key, def] of Object.entries(defaultCatalog.components)) {
      expect(def.name).toBe(key)
    }
  })
})

describe('default catalog — G9 container declarations (SPEC-R3/R4/R8)', () => {
  it('Row/Column declare the surface + flex grammar mapped 1:1 + a ChildList child model', () => {
    for (const type of ['Row', 'Column']) {
      const def = defaultCatalog.components[type]
      expect(def.children).toBe('ChildList')
      for (const p of ['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap']) {
        expect(def.properties[p]?.mapsTo, `${type}.${p}`).toBe(p) // SPEC-R8 1:1 reflection
      }
    }
  })

  it('Card carries surface axes + a ChildList model; its regions are component-native ChildList children', () => {
    expect(defaultCatalog.components.Card.properties.elevation?.mapsTo).toBe('elevation')
    expect(defaultCatalog.components.Card.children).toBe('ChildList')
    for (const region of ['CardHeader', 'CardContent', 'CardFooter']) {
      expect(defaultCatalog.components[region].children, region).toBe('ChildList')
    }
    expect(defaultCatalog.components.CardContent.properties.scrollable?.mapsTo).toBe('scrollable')
  })

  it('Tabs is two-way bound on selected via the select event; Tab/TabPanel are ChildList sub-types', () => {
    const tabs = defaultCatalog.components.Tabs
    expect(tabs.value).toEqual({ prop: 'selected', event: 'select' }) // ADR-0019 cl.2
    expect(tabs.properties.selected?.bindable).toBe(true)
    expect(tabs.children).toBe('ChildList')
    expect(defaultCatalog.components.Tab.children).toBe('ChildList')
    expect(defaultCatalog.components.TabPanel.children).toBe('ChildList')
  })

  it('Modal is two-way bound on open via the toggle event (ADR-0019 cl.2)', () => {
    const modal = defaultCatalog.components.Modal
    expect(modal.value).toEqual({ prop: 'open', event: 'toggle' })
    expect(modal.properties.open?.bindable).toBe(true)
    expect(modal.properties.persistent?.mapsTo).toBe('persistent')
  })

  it('TextField is value-bound on the change event — the deferred bind, now live (ADR-0019 cl.3)', () => {
    const tf = defaultCatalog.components.TextField
    expect(tf.value).toEqual({ prop: 'value', event: 'change' })
    expect(tf.properties.value?.bindable).toBe(true)
  })
})

describe('default catalog — conformance (SPEC-R7/R9)', () => {
  it('a container payload using declared props yields 0 CATALOG errors (SPEC-R3 AC2 / R7)', () => {
    const nodes: A2uiComponent[] = [
      { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'body'] },
      { id: 'hd', component: 'CardHeader', children: ['title'] },
      { id: 'body', component: 'CardContent', scrollable: true },
      { id: 'row', component: 'Row', align: 'center', gap: 'md', wrap: true },
      { id: 'tabs', component: 'Tabs', selected: 0, children: ['t1', 'p1'] },
      { id: 't1', component: 'Tab', children: ['t1label'] },
      { id: 'p1', component: 'TabPanel' },
      { id: 'modal', component: 'Modal', open: false, persistent: false },
      { id: 'tf', component: 'TextField', value: 'hi', label: 'Name', required: true },
    ]
    for (const node of nodes) {
      expect(validateCatalogConformance(node, defaultCatalog), node.component).toEqual([])
    }
  })

  it('accepts a {path} binding for a bindable prop (selected / open / value)', () => {
    const tabs: A2uiComponent = { id: 'tb', component: 'Tabs', selected: { path: '/active' } }
    const modal: A2uiComponent = { id: 'md', component: 'Modal', open: { path: '/shown' } }
    expect(validateCatalogConformance(tabs, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(modal, defaultCatalog)).toEqual([])
  })

  it('NEGATIVE: a malformed Modal payload FAILS conformance with CATALOG (security allowlist, SPEC-R9)', () => {
    // The conformance validator (LLD-C6) verdicts PRESENT props (unknown / type-mismatch), not
    // required-presence — so the malformed-payload control is a type mismatch on `open` (declared boolean)
    // plus an undeclared property; both are `CATALOG`, the renderer's not-rendered verdict.
    const typeMismatch: A2uiComponent = { id: 'm1', component: 'Modal', open: 'yes' }
    expect(validateCatalogConformance(typeMismatch, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'm1.open' })

    const unknownProp: A2uiComponent = { id: 'm2', component: 'Modal', bogus: 1 }
    expect(validateCatalogConformance(unknownProp, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'm2.bogus' })
  })
})
