// factories.ts: the `quizmaster` persona's factory table (ADR-0243 cl.2, T-0074). One composite factory,
// `QuestionCard`, over `ui-card`: a progress bar, the question text, a radio group of the choices and a
// disclosure holding the explanation. The concierge `BookingForm` precedent for the two-way bind: `value`
// is an ordinary bindable prop (read direction: `applyProp('value')` selects the radio) with a `value`
// mark whose `readProp` getter returns the inner group's `value`; `ui-radio-group` re-emits a bubbling
// `change` on every user commit, which the root `ui-card` sees and `installInputBinding` writes back.
//
// `revealed` true disables the group and opens the explanation in place; false re-enables and closes it.
// Styling goes through `el.style` only (each radio a 44px minimum block size); no host ARIA attributes.

import type { WidgetFactory } from '../../types.ts'

interface QuestionOption {
  value: string
  label: string
}

function isOption(v: unknown): v is QuestionOption {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { value?: unknown }).value === 'string' &&
    typeof (v as { label?: unknown }).label === 'string'
  )
}

function readOptions(value: unknown): QuestionOption[] {
  return Array.isArray(value) ? value.filter(isOption) : []
}

// Structural duck-types over the minted controls' public props (the fleet's generic-cast convention).
interface RadioGroupLike extends HTMLElement {
  name: string
  value: string | null
  disabled: boolean
}

interface RadioLike extends HTMLElement {
  value: string
}

interface ProgressLike extends HTMLElement {
  current: number | null
  max: number
}

interface DisclosureLike extends HTMLElement {
  open: boolean
  summary: string
}

interface TextLike extends HTMLElement {
  as: string
  variant: string
  size: string
}

interface QuestionCardParts {
  progressEl: ProgressLike
  questionEl: HTMLElement
  groupEl: RadioGroupLike
  explanationEl: DisclosureLike
  explanationTextEl: HTMLElement
  /** The last bound `value`, re-asserted after an options rebuild (a value can arrive before its options). */
  value: string | null
}

const questionCardParts = new WeakMap<HTMLElement, QuestionCardParts>()

function text(as: string, variant: string, size: string): HTMLElement {
  const el = document.createElement('ui-text') as unknown as TextLike
  el.as = as
  el.variant = variant
  el.size = size
  return el
}

/** Reuse the group's radios by index, add or remove the difference, label each as its text content. */
function syncOptions(parts: QuestionCardParts, options: QuestionOption[]): void {
  const radios = [...parts.groupEl.children].filter((c) => c.tagName.toLowerCase() === 'ui-radio') as RadioLike[]
  for (let i = options.length; i < radios.length; i++) radios[i]!.remove()
  options.forEach((opt, i) => {
    let radio = radios[i]
    if (radio === undefined) {
      radio = document.createElement('ui-radio') as unknown as RadioLike
      radio.style.setProperty('min-block-size', '44px')
      parts.groupEl.appendChild(radio)
    }
    radio.value = opt.value
    radio.textContent = opt.label
  })
  parts.groupEl.value = parts.value
}

function applyProgress(parts: QuestionCardParts, value: unknown): void {
  const p = typeof value === 'object' && value !== null ? (value as { value?: unknown; max?: unknown }) : undefined
  if (p === undefined || typeof p.value !== 'number' || typeof p.max !== 'number') {
    parts.progressEl.style.display = 'none'
    return
  }
  parts.progressEl.max = p.max
  parts.progressEl.current = p.value
  parts.progressEl.style.display = ''
}

function applyRevealed(parts: QuestionCardParts, revealed: boolean): void {
  parts.groupEl.disabled = revealed
  parts.explanationEl.open = revealed
}

/**
 * `QuestionCard` → `ui-card` holding the progress, question, options and explanation parts, in that order
 * (ADR-0243 cl.2). Every part exists from `create()`, so a payload with every prop absent still mounts.
 */
export const questionCardFactory: WidgetFactory = {
  tag: 'ui-card',
  uses: ['ui-disclosure', 'ui-progress', 'ui-radio', 'ui-radio-group', 'ui-text'], // ADR-0233: the controls it mints
  create: () => {
    const el = document.createElement('ui-card')
    const progressEl = document.createElement('ui-progress') as unknown as ProgressLike
    progressEl.setAttribute('data-part', 'progress')
    progressEl.style.display = 'none'
    const questionEl = text('h4', 'title', 'md')
    questionEl.setAttribute('data-part', 'question')
    const groupEl = document.createElement('ui-radio-group') as unknown as RadioGroupLike
    groupEl.setAttribute('data-part', 'options')
    const explanationEl = document.createElement('ui-disclosure') as unknown as DisclosureLike
    explanationEl.setAttribute('data-part', 'explanation')
    explanationEl.summary = 'Explanation'
    const explanationTextEl = text('p', 'body', 'md')
    explanationEl.appendChild(explanationTextEl)
    el.append(progressEl, questionEl, groupEl, explanationEl)
    questionCardParts.set(el, { progressEl, questionEl, groupEl, explanationEl, explanationTextEl, value: null })
    // The live selection for `installInputBinding` (LLD-C8): read on the group's bubbling `change`.
    Object.defineProperty(el, 'a2uiQuestionValue', {
      configurable: true,
      get: () => groupEl.value,
    })
    return el
  },
  applyProp: (el, prop, value) => {
    const parts = questionCardParts.get(el)
    if (parts === undefined) return
    switch (prop) {
      case 'question':
        parts.questionEl.textContent = value == null ? '' : String(value)
        break
      case 'explanation':
        parts.explanationTextEl.textContent = value == null ? '' : String(value)
        break
      case 'name':
        parts.groupEl.name = value == null ? '' : String(value)
        break
      case 'options':
        syncOptions(parts, readOptions(value))
        break
      case 'value':
        parts.value = value == null || value === '' ? null : String(value)
        parts.groupEl.value = parts.value
        break
      case 'revealed':
        applyRevealed(parts, value === true)
        break
      case 'progress':
        applyProgress(parts, value)
        break
      default:
        break // an unknown prop is a no-op
    }
  },
  value: { prop: 'value', event: 'change', readProp: 'a2uiQuestionValue' },
}

/** Every component the fragment's `catalog.json` declares must appear here (the FACTORY_MISSING precondition). */
export const quizmasterFactories: Record<string, WidgetFactory> = {
  QuestionCard: questionCardFactory,
}
