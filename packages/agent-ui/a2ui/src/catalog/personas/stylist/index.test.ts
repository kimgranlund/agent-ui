// index.test.ts: the `stylist` persona local pattern set (T-0090), the quizmaster precedent.

import { describe, it, expect } from 'vitest'
import { stylistFragment, stylistTargetCatalogs, stylistPersona, STYLIST_PERSONA_ID } from './index.ts'
import { stylistFactories } from './factories.ts'
import { stylistManifest } from './manifest.ts'
import { Registry } from '../../registry.ts'
import { defaultCatalog } from '../../default/index.ts'
import { defaultFactories } from '../../default/factories.ts'
import { a2uiBasicCatalog } from '../../a2ui-basic/index.ts'

describe('stylist persona: ContrastPair fragment', () => {
  it('ContrastPair: lands under catalog/personas/stylist/ with a stable kebab persona id', () => {
    expect(STYLIST_PERSONA_ID).toBe('stylist')
    expect(stylistPersona.personaId).toBe(STYLIST_PERSONA_ID)
    expect(stylistManifest.personaId).toBe(STYLIST_PERSONA_ID)
  })

  it('ContrastPair: the fragment loads through the structural gate with exactly the one type and its four bindable props', () => {
    expect(Object.keys(stylistFragment.components)).toEqual(['ContrastPair'])
    const props = stylistFragment.components.ContrastPair!.properties
    expect(Object.keys(props).sort()).toEqual(['background', 'foreground', 'label', 'sample'])
    for (const [name, p] of Object.entries(props)) {
      expect(p.bindable, name).toBe(true)
      expect(p.mapsTo, name).toBe(name)
    }
    expect(stylistFragment.components.ContrastPair!.children).toBeUndefined()
    expect(stylistFragment.functions).toEqual({})
  })

  it('ContrastPair: the fragment declares a factory for every component it declares', () => {
    for (const type of Object.keys(stylistFragment.components)) {
      expect(Object.hasOwn(stylistFactories, type), type).toBe(true)
    }
  })

  it('ContrastPair: targetCatalogs names agent-ui alone (Swatch, its sidecar edge, is a default-only type)', () => {
    expect(stylistTargetCatalogs).toEqual(['agent-ui'])
    expect(Object.hasOwn(defaultCatalog.components, 'Swatch')).toBe(true)
    expect(Object.hasOwn(a2uiBasicCatalog.components, 'Swatch')).toBe(false)
  })

  it('ContrastPair does not collide with the agent-ui base', () => {
    expect(Object.hasOwn(defaultCatalog.components, 'ContrastPair')).toBe(false)
    expect(Object.hasOwn(defaultFactories, 'ContrastPair')).toBe(false)
  })

  it('ContrastPair: a stand-alone Registry composes the fragment onto agent-ui with zero throw', () => {
    const registry = new Registry()
    registry.register(defaultCatalog, defaultFactories)
    expect(() =>
      registry.register(
        { ...defaultCatalog, catalogId: 'agent-ui--stylist', components: { ...defaultCatalog.components, ...stylistFragment.components } },
        { ...defaultFactories, ...stylistFactories },
      ),
    ).not.toThrow()
  })
})
