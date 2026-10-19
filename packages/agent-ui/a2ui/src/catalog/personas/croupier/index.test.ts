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
import { validateCatalogConformance } from '../../conformance.ts'
import type { A2uiComponent } from '../../../protocol.ts'

describe('croupier persona (SPEC-R1, GH #497)', () => {
  it('AC1 — lands entirely under catalog/personas/croupier/, a stable kebab persona id', () => {
    expect(CROUPIER_PERSONA_ID).toBe('croupier')
    expect(croupierPersona.personaId).toBe(CROUPIER_PERSONA_ID)
  })

  it('AC2: the fragment loads through the SAME structural gate a whole catalog runs, PlayingCard plus the CardTable composite', () => {
    expect(Object.keys(croupierFragment.components)).toEqual(['PlayingCard', 'CardTable'])
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

  it('PlayingCard and CardTable do not collide with either shipped base catalog\'s own names', () => {
    for (const type of ['PlayingCard', 'CardTable']) {
      expect(Object.hasOwn(defaultCatalog.components, type), type).toBe(false)
      expect(Object.hasOwn(defaultFactories, type), type).toBe(false)
      expect(Object.hasOwn(a2uiBasicCatalog.components, type), type).toBe(false)
      expect(Object.hasOwn(a2uiBasicFactories, type), type).toBe(false)
    }
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

  // T-0381 (Kim 2026-10-19): sm cannot hold the 9px type floor at the widget tier, so the catalog no longer offers it.
  it('PlayingCard size offers md and lg only; sm fails catalog validation on either base', () => {
    expect(croupierFragment.components.PlayingCard?.properties.size?.type).toEqual({ type: 'string', enum: ['md', 'lg'] })
    const card = (size: string): A2uiComponent => ({ id: 'c', component: 'PlayingCard', rank: 'K', suit: 'spades', size }) as A2uiComponent
    for (const base of [defaultCatalog, a2uiBasicCatalog]) {
      const composed = { ...base, catalogId: `${base.catalogId}--croupier`, components: { ...base.components, ...croupierFragment.components } }
      expect(validateCatalogConformance(card('sm'), composed)).toEqual([{ code: 'CATALOG', path: 'c.size' }])
      expect(validateCatalogConformance(card('md'), composed)).toEqual([])
      expect(validateCatalogConformance(card('lg'), composed)).toEqual([])
    }
  })
})
