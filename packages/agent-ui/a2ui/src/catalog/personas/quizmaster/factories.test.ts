// factories.test.ts: the `quizmaster` persona's factory table (T-0074), the croupier precedent. Probes run
// on detached elements; the live renderer path is `question-card.test.ts`.

import { describe, it, expect } from 'vitest'
import { questionCardFactory, quizmasterFactories } from './factories.ts'
import { quizmasterFragment } from './index.ts'

describe('QuestionCard factory table', () => {
  it('QuestionCard: one factory per fragment component type, no gap, no extra', () => {
    expect(Object.keys(quizmasterFactories).sort()).toEqual(Object.keys(quizmasterFragment.components).sort())
  })

  it('QuestionCard: the tag is ui-card and create() mints an unparented ui-card', () => {
    expect(questionCardFactory.tag).toBe('ui-card')
    const el = questionCardFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-card')
    expect(el.parentNode).toBeNull()
  })

  it('QuestionCard: uses names every control it mints', () => {
    expect([...(questionCardFactory.uses ?? [])].sort()).toEqual(['ui-disclosure', 'ui-progress', 'ui-radio', 'ui-radio-group', 'ui-text'])
  })

  it('QuestionCard: the value mark is the two-way change bind read through a2uiQuestionValue', () => {
    expect(questionCardFactory.value).toEqual({ prop: 'value', event: 'change', readProp: 'a2uiQuestionValue' })
    expect(questionCardFactory.submitGate).toBeUndefined()
    expect(quizmasterFragment.components.QuestionCard?.value).toEqual(questionCardFactory.value)
  })

  it('QuestionCard: the parts are progress, question, options and explanation, in order', () => {
    const el = questionCardFactory.create()
    expect([...el.children].map((c) => c.getAttribute('data-part'))).toEqual(['progress', 'question', 'options', 'explanation'])
  })

  it('QuestionCard: an unknown prop is a no-op and never throws', () => {
    const el = questionCardFactory.create()
    const before = el.innerHTML
    expect(() => questionCardFactory.applyProp(el, 'unknownProp', 'x')).not.toThrow()
    expect(el.innerHTML).toBe(before)
  })

  it('QuestionCard: progress shows the bar with current and max, and hides it again when absent', () => {
    const el = questionCardFactory.create()
    const bar = el.querySelector('[data-part="progress"]') as HTMLElement & { current: number | null; max: number }
    expect(bar.style.display).toBe('none')
    questionCardFactory.applyProp(el, 'progress', { value: 3, max: 10 })
    expect(bar.style.display).toBe('')
    expect(bar.current).toBe(3)
    expect(bar.max).toBe(10)
    questionCardFactory.applyProp(el, 'progress', null)
    expect(bar.style.display).toBe('none')
  })

  it('QuestionCard: options reuse radios by index and drop the surplus', () => {
    const el = questionCardFactory.create()
    questionCardFactory.applyProp(el, 'options', [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
      { value: 'c', label: 'Gamma' },
    ])
    const first = el.querySelector('ui-radio')
    questionCardFactory.applyProp(el, 'options', [
      { value: 'x', label: 'Ex' },
      { value: 'y', label: 'Why' },
    ])
    const radios = [...el.querySelectorAll('ui-radio')] as (HTMLElement & { value: string })[]
    expect(radios).toHaveLength(2)
    expect(radios[0]).toBe(first)
    expect(radios.map((r) => [r.value, r.textContent])).toEqual([
      ['x', 'Ex'],
      ['y', 'Why'],
    ])
  })
})
