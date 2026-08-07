// variant.test.ts — VariantDispatch resolution (GH #545, catalog LLD-C3/C5).
//
// Decoupled from any real catalog/registry — synthetic fixtures only (the registry.test.ts precedent).

import { describe, it, expect } from 'vitest'
import { isVariantDispatch, resolveFactory, factoriesOf } from './variant.ts'
import type { VariantDispatch, WidgetFactory } from './types.ts'
import type { A2uiComponent } from '../protocol.ts'

const fakeFactory = (tag: string): WidgetFactory => ({
  tag,
  create: () => document.createElement('div'),
  applyProp: () => {},
})

const node = (props: Record<string, unknown>): A2uiComponent => ({ id: 'n1', component: 'Widget', ...props }) as A2uiComponent

describe('isVariantDispatch', () => {
  it('NEGATIVE: a plain WidgetFactory is never mistaken for a dispatch table', () => {
    expect(isVariantDispatch(fakeFactory('ui-x'))).toBe(false)
  })

  it('a VariantDispatch is recognized by its variants field', () => {
    const dispatch: VariantDispatch = { variantProp: 'variant', variants: {}, fallback: fakeFactory('ui-x') }
    expect(isVariantDispatch(dispatch)).toBe(true)
  })
})

describe('resolveFactory — the pass-through leg (byte-compatible with a direct index for every non-variant type)', () => {
  it('NEGATIVE: undefined stays undefined (the unknown-type path)', () => {
    expect(resolveFactory(undefined, node({}))).toBeUndefined()
  })

  it('a plain WidgetFactory slot resolves to itself, unconditionally — the node is never inspected', () => {
    const factory = fakeFactory('ui-button')
    expect(resolveFactory(factory, node({ label: 'Save' }))).toBe(factory)
    expect(resolveFactory(factory, node({}))).toBe(factory) // even with no matching prop at all
  })
})

describe('resolveFactory — the VariantDispatch leg', () => {
  const small = fakeFactory('ui-select-small')
  const large = fakeFactory('ui-select-large')
  const dispatch: VariantDispatch = { variantProp: 'size', variants: { small, large }, fallback: small }

  it('a declared variant value resolves to its matching arm', () => {
    expect(resolveFactory(dispatch, node({ size: 'small' }))).toBe(small)
    expect(resolveFactory(dispatch, node({ size: 'large' }))).toBe(large)
  })

  it('falls back on an absent variantProp', () => {
    expect(resolveFactory(dispatch, node({}))).toBe(small)
  })

  it('falls back on an unmatched string value', () => {
    expect(resolveFactory(dispatch, node({ size: 'huge' }))).toBe(small)
  })

  it('falls back on a dynamic ({path}) binding — dispatch reads only a STATIC string, at mint/rewire time', () => {
    expect(resolveFactory(dispatch, node({ size: { path: '/pref/size' } }))).toBe(small)
  })

  it('falls back on a non-string literal (number/boolean/null)', () => {
    expect(resolveFactory(dispatch, node({ size: 42 }))).toBe(small)
    expect(resolveFactory(dispatch, node({ size: null }))).toBe(small)
  })
})

describe('factoriesOf', () => {
  it('a plain WidgetFactory slot yields exactly itself, one element', () => {
    const factory = fakeFactory('ui-x')
    expect(factoriesOf(factory)).toEqual([factory])
  })

  it('a VariantDispatch slot yields every distinct concrete arm, fallback included', () => {
    const small = fakeFactory('ui-small')
    const large = fakeFactory('ui-large')
    const dispatch: VariantDispatch = { variantProp: 'size', variants: { small, large }, fallback: small }
    expect(new Set(factoriesOf(dispatch))).toEqual(new Set([small, large]))
  })

  it('dedupes when the fallback IS one of the declared variant arms (reference-equal, not just tag-equal)', () => {
    const only = fakeFactory('ui-only')
    const dispatch: VariantDispatch = { variantProp: 'size', variants: { only }, fallback: only }
    expect(factoriesOf(dispatch)).toEqual([only])
  })
})
