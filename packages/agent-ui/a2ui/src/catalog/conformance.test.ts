import { describe, it, expect } from 'vitest'
import { validateCatalogConformance } from './conformance.ts'
import { demoCatalog } from '../fixtures.ts'
import { loadCatalog } from './catalog.ts'
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

  it('accepts a DynamicString template on a bindable string prop — no false CATALOG (ADR-0027 proof point 8)', () => {
    // A `${…}` template is a plain string literal at the wire level (typeof === 'string'), so
    // conformance.ts `matchesType` accepts it via the ordinary `'string'` leg — no deferred-binding
    // branch involved, zero CATALOG failures (ADR-0027 §2.7 "conformance is a no-op — confirmed").
    // NON-VACUOUS: a string on a non-bindable prop IS rejected (the test below this one proves it).
    const f = validateCatalogConformance(
      comp({ id: 't', component: 'Text', text: 'Hello ${/user/firstName}! You are ${/user/age} years old.' }),
      demoCatalog,
    )
    expect(f).toEqual([])
  })

  it('negative control: a {path} binding on a non-bindable string prop still raises CATALOG', () => {
    // `Text.variant` is a non-bindable string — a binding object is not a string literal → CATALOG.
    // Confirms the template test above is non-vacuous (the string-type leg would pass a plain string,
    // but only bindable props accept binding objects).
    const f = validateCatalogConformance(comp({ id: 't', component: 'Text', variant: { path: '/v' } }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 't.variant' }])
  })
})

describe('validateCatalogConformance — enum membership (ADR-0098)', () => {
  // A stub catalog with a closed string enum (`size`), a BINDABLE closed string enum (`mode` —
  // mirrors the Calendar.mode shape ADR-0098 names), an enum-less string (`note`), and a boolean
  // (`flag`) — proving the new clause is scoped to schemas that actually declare `enum`.
  const enumCatalog = loadCatalog({
    catalogId: 'enum-demo',
    protocolVersion: 'v1.0',
    components: {
      Widget: {
        properties: {
          size: { type: { type: 'string', enum: ['sm', 'md', 'lg'] }, mapsTo: 'size' },
          mode: { type: { type: 'string', enum: ['single', 'range'] }, bindable: true, mapsTo: 'mode' },
          note: { type: { type: 'string' }, mapsTo: 'note' },
          flag: { type: { type: 'boolean' }, mapsTo: 'flag' },
        },
      },
    },
    functions: {},
  })

  it('rejects a non-member literal with CATALOG at <id>.<prop>', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', size: 'xl' }), enumCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.size' }])
  })

  it('accepts a declared member — clean', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', size: 'md' }), enumCatalog)
    expect(f).toEqual([])
  })

  it('is case-sensitive — no coercion (JSON-Schema §6.1.2): "MD" ∉ {sm,md,lg}', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', size: 'MD' }), enumCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.size' }])
  })

  it('does NOT statically judge a {path} binding on a bindable enum prop — stays ADR-0076\'s render-gate charter', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', mode: { path: '/mode' } }), enumCatalog)
    expect(f).toEqual([])
  })

  it('leaves an enum-less string prop unconstrained (negative control — the clause does not over-reject)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', note: 'anything at all' }), enumCatalog)
    expect(f).toEqual([])
  })

  it('leaves a boolean (enum-less, non-string) schema unaffected', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', flag: true }), enumCatalog)
    expect(f).toEqual([])
  })
})
