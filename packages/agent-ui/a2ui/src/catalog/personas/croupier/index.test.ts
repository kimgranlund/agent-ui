// index.test.ts — the `croupier` persona local pattern set (SPEC-R1 AC1/AC2/AC3/AC4, GH #497),
// mirroring `fixture-demo/index.test.ts`.

import { describe, it, expect } from 'vitest'
import { croupierFragment, croupierTargetCatalogs, croupierPersona, CROUPIER_PERSONA_ID } from './index.ts'
import { croupierFactories } from './factories.ts'
import { Registry } from '../../registry.ts'
import { defaultCatalog } from '../../default/index.ts'
import { defaultFactories } from '../../default/factories.ts'
import { a2uiBasicCatalog } from '../../a2ui-basic/index.ts'
import { a2uiBasicFactories } from '../../a2ui-basic/factories.ts'

describe('croupier persona (SPEC-R1, GH #497)', () => {
  it('AC1 — lands entirely under catalog/personas/croupier/, a stable kebab persona id', () => {
    expect(CROUPIER_PERSONA_ID).toBe('croupier')
    expect(croupierPersona.personaId).toBe(CROUPIER_PERSONA_ID)
  })

  it('AC2 — the fragment loads through the SAME structural gate a whole catalog runs — exactly the one promoted type', () => {
    expect(Object.keys(croupierFragment.components)).toEqual(['PlayingCard'])
    expect(croupierFragment.components.PlayingCard?.properties.rank?.type).toEqual({
      type: 'string',
      enum: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
    })
    expect(croupierFragment.components.PlayingCard?.properties.suit?.type).toEqual({
      type: 'string',
      enum: ['spades', 'hearts', 'diamonds', 'clubs'],
    })
    expect(croupierFragment.functions).toEqual({})
  })

  it('AC3 — the fragment declares a factory for every component it declares (the FACTORY_MISSING precondition)', () => {
    for (const type of Object.keys(croupierFragment.components)) {
      expect(Object.hasOwn(croupierFactories, type), type).toBe(true)
    }
  })

  it('AC4 — targetCatalogs names only the two currently-registered bases', () => {
    expect(croupierTargetCatalogs).toEqual(['agent-ui', 'a2ui-basic'])
  })

  it('PlayingCard does not collide with either shipped base catalog\'s own names', () => {
    expect(Object.hasOwn(defaultCatalog.components, 'PlayingCard')).toBe(false)
    expect(Object.hasOwn(defaultFactories, 'PlayingCard')).toBe(false)
    expect(Object.hasOwn(a2uiBasicCatalog.components, 'PlayingCard')).toBe(false)
    expect(Object.hasOwn(a2uiBasicFactories, 'PlayingCard')).toBe(false)
  })

  it('a stand-alone Registry composes the croupier fragment onto EITHER shipped base with zero throw', () => {
    const registry = new Registry()
    registry.register(defaultCatalog, defaultFactories)
    registry.register(a2uiBasicCatalog, a2uiBasicFactories)
    expect(() =>
      registry.register(
        { ...defaultCatalog, catalogId: 'agent-ui--croupier', components: { ...defaultCatalog.components, ...croupierFragment.components } },
        { ...defaultFactories, ...croupierFactories },
      ),
    ).not.toThrow()
    expect(() =>
      registry.register(
        { ...a2uiBasicCatalog, catalogId: 'a2ui-basic--croupier', components: { ...a2uiBasicCatalog.components, ...croupierFragment.components } },
        { ...a2uiBasicFactories, ...croupierFactories },
      ),
    ).not.toThrow()
  })
})
