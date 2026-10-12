// index.test.ts: the `quizmaster` persona local pattern set (T-0074), the croupier precedent.

import { describe, it, expect } from 'vitest'
import { quizmasterFragment, quizmasterTargetCatalogs, quizmasterPersona, QUIZMASTER_PERSONA_ID } from './index.ts'
import { quizmasterFactories } from './factories.ts'
import { Registry } from '../../registry.ts'
import { defaultCatalog } from '../../default/index.ts'
import { defaultFactories } from '../../default/factories.ts'
import { a2uiBasicCatalog } from '../../a2ui-basic/index.ts'
import { a2uiBasicFactories } from '../../a2ui-basic/factories.ts'

describe('quizmaster persona: QuestionCard fragment', () => {
  it('QuestionCard: lands under catalog/personas/quizmaster/ with a stable kebab persona id', () => {
    expect(QUIZMASTER_PERSONA_ID).toBe('quizmaster')
    expect(quizmasterPersona.personaId).toBe(QUIZMASTER_PERSONA_ID)
  })

  it('QuestionCard: the fragment loads through the structural gate with exactly the one type and its seven props', () => {
    expect(Object.keys(quizmasterFragment.components)).toEqual(['QuestionCard'])
    const props = quizmasterFragment.components.QuestionCard!.properties
    expect(Object.keys(props).sort()).toEqual(['explanation', 'name', 'options', 'progress', 'question', 'revealed', 'value'])
    expect(quizmasterFragment.components.QuestionCard!.children).toBeUndefined()
    expect(quizmasterFragment.functions).toEqual({})
  })

  it('QuestionCard: the fragment declares a factory for every component it declares', () => {
    for (const type of Object.keys(quizmasterFragment.components)) {
      expect(Object.hasOwn(quizmasterFactories, type), type).toBe(true)
    }
  })

  it('QuestionCard: targetCatalogs names the two shipped bases', () => {
    expect(quizmasterTargetCatalogs).toEqual(['agent-ui', 'a2ui-basic'])
  })

  it('QuestionCard does not collide with either shipped base catalog', () => {
    expect(Object.hasOwn(defaultCatalog.components, 'QuestionCard')).toBe(false)
    expect(Object.hasOwn(defaultFactories, 'QuestionCard')).toBe(false)
    expect(Object.hasOwn(a2uiBasicCatalog.components, 'QuestionCard')).toBe(false)
    expect(Object.hasOwn(a2uiBasicFactories, 'QuestionCard')).toBe(false)
  })

  it('QuestionCard: a stand-alone Registry composes the fragment onto either shipped base with zero throw', () => {
    const registry = new Registry()
    registry.register(defaultCatalog, defaultFactories)
    registry.register(a2uiBasicCatalog, a2uiBasicFactories)
    expect(() =>
      registry.register(
        { ...defaultCatalog, catalogId: 'agent-ui--quizmaster', components: { ...defaultCatalog.components, ...quizmasterFragment.components } },
        { ...defaultFactories, ...quizmasterFactories },
      ),
    ).not.toThrow()
    expect(() =>
      registry.register(
        { ...a2uiBasicCatalog, catalogId: 'a2ui-basic--quizmaster', components: { ...a2uiBasicCatalog.components, ...quizmasterFragment.components } },
        { ...a2uiBasicFactories, ...quizmasterFactories },
      ),
    ).not.toThrow()
  })
})
