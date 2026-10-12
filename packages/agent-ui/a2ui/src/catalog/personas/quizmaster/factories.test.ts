// factories.test.ts: the `quizmaster` persona's factory table (T-0074, restyled to the approved mockup by
// T-0082), the croupier precedent. Probes run on detached elements; the live renderer path is
// `question-card.test.ts`.

import { describe, it, expect } from 'vitest'
import { questionCardFactory, quizmasterFactories } from './factories.ts'
import { quizmasterFragment } from './index.ts'

const part = (el: HTMLElement, name: string): HTMLElement => el.querySelector(`[data-part="${name}"]`) as HTMLElement
const rows = (el: HTMLElement): (HTMLElement & { value: string; disabled: boolean })[] =>
  [...el.querySelectorAll('ui-radio')] as (HTMLElement & { value: string; disabled: boolean })[]
const rowText = (row: HTMLElement, name: string): string => row.querySelector(`[data-part="${name}"]`)?.textContent ?? ''

const FOUR = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
  { value: 'd', label: 'Delta' },
]

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
    expect([...(questionCardFactory.uses ?? [])].sort()).toEqual(['ui-badge', 'ui-radio', 'ui-radio-group', 'ui-text'])
  })

  it('QuestionCard: the value mark is the two-way change bind read through a2uiQuestionValue', () => {
    expect(questionCardFactory.value).toEqual({ prop: 'value', event: 'change', readProp: 'a2uiQuestionValue' })
    expect(questionCardFactory.submitGate).toBeUndefined()
    expect(quizmasterFragment.components.QuestionCard?.value).toEqual(questionCardFactory.value)
  })

  it('QuestionCard: the catalog row takes answer, label, meta and a children list for the action Buttons', () => {
    const row = quizmasterFragment.components.QuestionCard!
    for (const prop of ['answer', 'label', 'meta']) expect(row.properties[prop]?.mapsTo).toBe(prop)
    expect(row.children).toBe('ChildList')
  })

  it('QuestionCard: the parts are head, question, options and explanation, in order', () => {
    const el = questionCardFactory.create()
    expect([...el.children].map((c) => c.getAttribute('data-part'))).toEqual(['head', 'question', 'options', 'explanation'])
  })

  it('QuestionCard: an unknown prop is a no-op and never throws', () => {
    const el = questionCardFactory.create()
    const before = el.innerHTML
    expect(() => questionCardFactory.applyProp(el, 'unknownProp', 'x')).not.toThrow()
    expect(el.innerHTML).toBe(before)
  })

  it('QuestionCard: the header pill reads label, falls back to progress as Question n of m, and hides when both are absent', () => {
    const el = questionCardFactory.create()
    const head = part(el, 'head')
    const pill = part(el, 'label') as HTMLElement & { label: string }
    expect(head.style.display).toBe('none')
    questionCardFactory.applyProp(el, 'progress', { value: 3, max: 10 })
    expect(pill.label).toBe('Question 3 of 10')
    expect(head.style.display).toBe('flex')
    questionCardFactory.applyProp(el, 'label', 'Bonus round')
    expect(pill.label).toBe('Bonus round')
    questionCardFactory.applyProp(el, 'label', null)
    expect(pill.label).toBe('Question 3 of 10')
    questionCardFactory.applyProp(el, 'progress', null)
    expect(pill.style.display).toBe('none')
    expect(head.style.display).toBe('none')
  })

  it('QuestionCard: meta is the right-aligned header text, shown only when set', () => {
    const el = questionCardFactory.create()
    const meta = part(el, 'meta')
    questionCardFactory.applyProp(el, 'meta', 'Science · medium')
    expect(meta.textContent).toBe('Science · medium')
    expect(meta.style.marginInlineStart).toBe('auto')
    expect(part(el, 'head').style.display).toBe('flex')
    questionCardFactory.applyProp(el, 'meta', '')
    expect(meta.style.display).toBe('none')
  })

  it('QuestionCard: options reuse radios by index, drop the surplus and label each row in its label span', () => {
    const el = questionCardFactory.create()
    questionCardFactory.applyProp(el, 'options', FOUR.slice(0, 3))
    const first = el.querySelector('ui-radio')
    questionCardFactory.applyProp(el, 'options', [
      { value: 'x', label: 'Ex' },
      { value: 'y', label: 'Why' },
    ])
    expect(rows(el)).toHaveLength(2)
    expect(rows(el)[0]).toBe(first)
    expect(rows(el).map((r) => [r.value, rowText(r, 'label')])).toEqual([
      ['x', 'Ex'],
      ['y', 'Why'],
    ])
  })

  it('QuestionCard: each option row carries a letter badge A, B, C, D in order, hidden from the accessible name', () => {
    const el = questionCardFactory.create()
    questionCardFactory.applyProp(el, 'options', FOUR)
    expect(rows(el).map((r) => rowText(r, 'key'))).toEqual(['A', 'B', 'C', 'D'])
    for (const r of rows(el)) {
      expect(r.querySelector('[data-part="key"]')?.getAttribute('aria-hidden')).toBe('true')
      expect(r.getAttribute('data-state')).toBe('idle')
    }
  })

  it('QuestionCard: a bound value marks only its row selected, with a dot glyph in place of the letter', () => {
    const el = questionCardFactory.create()
    questionCardFactory.applyProp(el, 'options', FOUR)
    questionCardFactory.applyProp(el, 'value', 'b')
    expect(rows(el).map((r) => r.getAttribute('data-state'))).toEqual(['idle', 'selected', 'idle', 'idle'])
    expect(rows(el).map((r) => rowText(r, 'key'))).toEqual(['A', '●', 'C', 'D'])
  })

  it('QuestionCard: revealed with answer marks the correct row and a wrong pick with a glyph and a label, the rest idle', () => {
    const el = questionCardFactory.create()
    questionCardFactory.applyProp(el, 'options', FOUR)
    questionCardFactory.applyProp(el, 'answer', 'c')
    questionCardFactory.applyProp(el, 'value', 'b')
    questionCardFactory.applyProp(el, 'revealed', true)
    expect(rows(el).map((r) => r.getAttribute('data-state'))).toEqual(['idle', 'wrong', 'correct', 'idle'])
    expect(rows(el).map((r) => rowText(r, 'key'))).toEqual(['A', '✕', '✓', 'D'])
    expect(rows(el).map((r) => rowText(r, 'result'))).toEqual(['', 'Your answer', 'Correct', ''])
    expect(rows(el).every((r) => r.disabled)).toBe(true)
  })

  it('QuestionCard: the states differ in background and border color, not only in the glyph', () => {
    const el = questionCardFactory.create()
    questionCardFactory.applyProp(el, 'options', FOUR)
    questionCardFactory.applyProp(el, 'answer', 'c')
    questionCardFactory.applyProp(el, 'value', 'b')
    questionCardFactory.applyProp(el, 'revealed', true)
    const [idle, wrong, correct] = rows(el)
    expect(correct!.style.background).toContain('--md-sys-color-success-container')
    expect(correct!.style.borderColor).toContain('--md-sys-color-success')
    expect(wrong!.style.background).toContain('--md-sys-color-danger-container')
    expect(wrong!.style.borderColor).toContain('--md-sys-color-danger')
    expect(idle!.style.background).toContain('--md-sys-color-neutral-surface')
  })

  it('QuestionCard: revealed without an answer keeps the pick selected and marks nothing correct or wrong', () => {
    const el = questionCardFactory.create()
    questionCardFactory.applyProp(el, 'options', FOUR)
    questionCardFactory.applyProp(el, 'value', 'a')
    questionCardFactory.applyProp(el, 'revealed', true)
    expect(rows(el).map((r) => r.getAttribute('data-state'))).toEqual(['selected', 'idle', 'idle', 'idle'])
    expect(rows(el).map((r) => rowText(r, 'result'))).toEqual(['', '', '', ''])
  })

  it('QuestionCard: the explanation panel opens only when revealed and non-empty, and carries no border', () => {
    const el = questionCardFactory.create()
    const panel = part(el, 'explanation')
    questionCardFactory.applyProp(el, 'revealed', true)
    expect(panel.style.display).toBe('none')
    questionCardFactory.applyProp(el, 'explanation', 'Because.')
    expect(panel.style.display).toBe('')
    expect(panel.getAttribute('style') ?? '').not.toContain('border-left')
    expect(panel.style.borderStyle).toBe('')
    questionCardFactory.applyProp(el, 'revealed', false)
    expect(panel.style.display).toBe('none')
  })
})
