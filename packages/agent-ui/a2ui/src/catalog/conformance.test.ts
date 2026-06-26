import { describe, it, expect } from 'vitest'
import { validateCatalogConformance } from './conformance.ts'
import { demoCatalog } from '../fixtures.ts'
import type { A2uiComponent } from '../protocol.ts'

const comp = (c: Record<string, unknown>): A2uiComponent => c as A2uiComponent

describe('validateCatalogConformance (catalog LLD-C6, SPEC-R7/R9/N3)', () => {
  it('passes a conformant component', () => {
    const f = validateCatalogConformance(comp({ id: 'b1', component: 'Button', label: 'Save', disabled: false }), demoCatalog)
    expect(f).toEqual([])
  })

  it('flags an unknown component type with CATALOG at the component id', () => {
    const f = validateCatalogConformance(comp({ id: 'x', component: 'Doohickey' }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'x' }])
  })

  it('flags an unknown property with CATALOG at id.prop', () => {
    const f = validateCatalogConformance(comp({ id: 'b1', component: 'Button', nope: 1 }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'b1.nope' }])
  })

  it('flags a type mismatch (boolean prop given a string)', () => {
    const f = validateCatalogConformance(comp({ id: 'b1', component: 'Button', disabled: 'yes' }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'b1.disabled' }])
  })

  it('enforces integer vs number', () => {
    const ok = validateCatalogConformance(comp({ id: 't', component: 'TextField', maxLength: 10 }), demoCatalog)
    expect(ok).toEqual([])
    const bad = validateCatalogConformance(comp({ id: 't', component: 'TextField', maxLength: 10.5 }), demoCatalog)
    expect(bad).toEqual([{ code: 'CATALOG', path: 't.maxLength' }])
  })

  it('accepts a {path} binding on a bindable property', () => {
    const f = validateCatalogConformance(comp({ id: 't', component: 'Text', text: { path: '/user/name' } }), demoCatalog)
    expect(f).toEqual([])
  })

  it('rejects a {path} binding on a non-bindable property', () => {
    // `variant` is not bindable → a binding object is not a string literal → CATALOG
    const f = validateCatalogConformance(comp({ id: 't', component: 'Text', variant: { path: '/v' } }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 't.variant' }])
  })

  it('ignores reserved adjacency keys (id/component/child/children)', () => {
    const f = validateCatalogConformance(
      comp({ id: 'col', component: 'Column', children: ['a', 'b'], child: 'a' }),
      demoCatalog,
    )
    expect(f).toEqual([])
  })

  it('reports every failure (totality, not short-circuit)', () => {
    const f = validateCatalogConformance(comp({ id: 'b', component: 'Button', nope: 1, disabled: 'x' }), demoCatalog)
    expect(f).toEqual([
      { code: 'CATALOG', path: 'b.nope' },
      { code: 'CATALOG', path: 'b.disabled' },
    ])
  })
})
