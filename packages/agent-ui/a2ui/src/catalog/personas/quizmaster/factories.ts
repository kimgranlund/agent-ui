// factories.ts: the `quizmaster` persona's factory table (ADR-0243 cl.2, T-0074; the approved look, ADR-0243
// Amendment 1, T-0082). One composite factory, `QuestionCard`, over `ui-card`: a header row (a `ui-badge` pill and
// a right-aligned meta line), the question text, a radio group of the choices drawn as bordered rows with a
// circular letter badge, and an explanation panel. The concierge `BookingForm` precedent for the two-way bind:
// `value` is an ordinary bindable prop (read direction: `applyProp('value')` selects the radio) with a `value`
// mark whose `readProp` getter returns the inner group's `value`; `ui-radio-group` re-emits a bubbling `change`
// on every user commit, which the root `ui-card` sees and `installInputBinding` writes back.
//
// `revealed` true disables the group and opens the explanation in place; with `answer` naming an option it also
// marks the correct row (a check glyph and "Correct") and a wrong pick (a cross glyph and "Your answer"), so no
// state rests on color alone. A pick commits the answer (T-0429): a click or Space on an option fires the host's own
// `action` event named by `actionName`, with the picked value as the context `value`, which the renderer forwards as
// the A2UI action, once: the picked row then reads pending (`data-pending`), the rows lock and a second tap sends
// nothing until `revealed` changes (T-0439). There is no Check answer Button. The producer's own children (the post-reveal Next question
// Button) are appended by the renderer after the explanation, sized at the button's `lg` step by `actionRowButtons`
// (ADR-0243 Amendment 2; 28px on the A2UI canvas register, ADR-0245 Amendment 2). Styling
// goes through `el.style` only, with no border-left anywhere; no host ARIA. The card is one region on the ADR-0046
// box model (`boxRegionCard`, ADR-0046 Amendment 7): ink the box inset plus the region padding in from the border,
// and one 8px gap between parts.

import type { WidgetFactory } from '../../types.ts'
import { actionRowButtons } from '../action-row.ts'
import { BOX, boxRegionCard } from '../box-region.ts'

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
  disabled: boolean
}

interface BadgeLike extends HTMLElement {
  label: string
}

interface TextLike extends HTMLElement {
  as: string
  variant: string
  size: string
  emphasis: boolean
}

/** One option row's look. Each state carries a glyph and (once revealed) a label, never color alone. */
type OptionState = 'idle' | 'selected' | 'correct' | 'wrong'

const OPTION_LOOK: Record<OptionState, { glyph: string | null; result: string; background: string; border: string }> = {
  idle: { glyph: null, result: '', background: 'var(--md-sys-color-neutral-surface)', border: 'var(--md-sys-color-neutral-outline-variant)' },
  selected: { glyph: '●', result: '', background: 'var(--md-sys-color-primary-container)', border: 'var(--md-sys-color-primary)' },
  correct: { glyph: '✓', result: 'Correct', background: 'var(--md-sys-color-success-container)', border: 'var(--md-sys-color-success)' },
  wrong: { glyph: '✕', result: 'Your answer', background: 'var(--md-sys-color-danger-container)', border: 'var(--md-sys-color-danger)' },
}

interface QuestionCardParts {
  headEl: HTMLElement
  labelEl: BadgeLike
  metaEl: HTMLElement
  questionEl: HTMLElement
  groupEl: RadioGroupLike
  explanationEl: HTMLElement
  explanationTextEl: HTMLElement
  /** The last bound `value`, re-asserted after an options rebuild (a value can arrive before its options). */
  value: string | null
  answer: string | null
  revealed: boolean
  label: string
  progress: { value: number; max: number } | undefined
  /** The action a pick commits (T-0429); empty sends nothing. */
  actionName: string
  /** A pick has committed and the reveal has not landed (T-0439): rows lock and no second answer is sent. */
  pending: boolean
}

const questionCardParts = new WeakMap<HTMLElement, QuestionCardParts>()

function text(as: string, variant: string, size: string): TextLike {
  const el = document.createElement('ui-text') as unknown as TextLike
  el.as = as
  el.variant = variant
  el.size = size
  return el
}

function span(part: string): HTMLElement {
  const el = document.createElement('span')
  el.setAttribute('data-part', part)
  return el
}

/** A, B, C ... Z, then 27, 28 ... for a longer list. */
const letterFor = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1))

/** Mint one option row: a radio drawn as a bordered, tap-sized row holding the key badge, the label and the result. */
function mintOption(): RadioLike {
  const radio = document.createElement('ui-radio') as unknown as RadioLike
  radio.setAttribute('data-part', 'option')
  const s = radio.style
  // The radio's own ring and dot collapse to nothing (per-instance token overrides); the key badge replaces them.
  s.setProperty('--ui-radio-box', '0px')
  s.setProperty('--ui-radio-border', 'transparent')
  s.setProperty('--ui-radio-ink', 'transparent')
  s.setProperty('--ui-radio-dot', 'transparent')
  s.setProperty('--ui-radio-gap', '0px')
  s.setProperty('min-block-size', '44px')
  s.boxSizing = 'border-box'
  s.paddingBlock = 'var(--md-sys-space-sm)'
  // The collapsed ring still spans its two 2px border sides, so the start padding gives those 4px back.
  s.paddingInline = 'calc(var(--md-sys-space-md) - 4px) var(--md-sys-space-md)'
  s.borderWidth = '1px'
  s.borderStyle = 'solid'
  s.borderRadius = BOX.childRadius
  s.lineHeight = '1.35'

  const key = span('key')
  key.setAttribute('aria-hidden', 'true') // the letter or glyph is decoration; checked state and the result text carry meaning
  const k = key.style
  k.display = 'grid'
  k.placeItems = 'center'
  k.flex = 'none'
  k.inlineSize = '22px'
  k.blockSize = '22px'
  k.boxSizing = 'border-box'
  k.borderRadius = '50%'
  k.borderWidth = '1.5px'
  k.borderStyle = 'solid'
  k.borderColor = 'var(--md-sys-color-neutral-outline)'
  k.fontSize = 'var(--md-sys-typescale-label-medium-size)'
  k.fontWeight = '700'
  k.lineHeight = '1'
  k.marginInlineEnd = 'var(--md-sys-space-sm)'

  const result = span('result')
  const r = result.style
  r.marginInlineStart = 'auto'
  r.paddingInlineStart = 'var(--md-sys-space-sm)'
  r.fontSize = 'var(--md-sys-typescale-label-medium-size)'
  r.fontWeight = '700'

  radio.append(key, span('label'), result)
  return radio
}

function optionState(optValue: string, picked: string | null, answer: string | null, revealed: boolean): OptionState {
  if (revealed && answer !== null) {
    if (optValue === answer) return 'correct'
    return optValue === picked ? 'wrong' : 'idle'
  }
  return optValue === picked ? 'selected' : 'idle'
}

const optionsOf = (parts: QuestionCardParts): RadioLike[] =>
  [...parts.groupEl.children].filter((c) => c.tagName.toLowerCase() === 'ui-radio') as RadioLike[]

/** Repaint every row from the current pick, `answer` and `revealed`: `data-state`, glyph, result text and colors. */
function paintOptions(parts: QuestionCardParts): void {
  // The group's own value once it holds one; the bound value while it is still pending on a radio connecting.
  const picked = parts.groupEl.value ?? parts.value
  optionsOf(parts).forEach((radio, i) => {
    const state = optionState(radio.value, picked, parts.answer, parts.revealed)
    const look = OPTION_LOOK[state]
    radio.setAttribute('data-state', state)
    // Each radio too, not only the group: a disabled group swallows a click's change but the radio still checks.
    radio.disabled = parts.revealed || parts.pending
    if (parts.pending && state === 'selected') radio.setAttribute('data-pending', '')
    else radio.removeAttribute('data-pending')
    radio.style.background = look.background
    radio.style.borderColor = look.border
    const key = radio.querySelector('[data-part="key"]')
    const result = radio.querySelector('[data-part="result"]') as HTMLElement | null
    if (key !== null) key.textContent = look.glyph ?? letterFor(i)
    if (result !== null) {
      result.textContent = look.result
      result.style.display = look.result === '' ? 'none' : ''
    }
  })
}

/** Reuse the group's radios by index, add or remove the difference, label each in its label span. */
function syncOptions(parts: QuestionCardParts, options: QuestionOption[]): void {
  const radios = optionsOf(parts)
  for (let i = options.length; i < radios.length; i++) radios[i]!.remove()
  options.forEach((opt, i) => {
    let radio = radios[i]
    if (radio === undefined) {
      radio = mintOption()
      parts.groupEl.appendChild(radio)
    }
    radio.value = opt.value
    const label = radio.querySelector('[data-part="label"]')
    if (label !== null) label.textContent = opt.label
  })
  parts.groupEl.value = parts.value
  paintOptions(parts)
}

/** The pill reads `label`, else `Question n of m` from `progress`; the header hides when it has nothing to show. */
function paintHeader(parts: QuestionCardParts): void {
  const p = parts.progress
  const pill = parts.label !== '' ? parts.label : p !== undefined ? `Question ${p.value} of ${p.max}` : ''
  parts.labelEl.label = pill
  parts.labelEl.style.display = pill === '' ? 'none' : ''
  const meta = parts.metaEl.textContent ?? ''
  parts.metaEl.style.display = meta === '' ? 'none' : ''
  parts.headEl.style.display = pill === '' && meta === '' ? 'none' : 'flex'
}

/** The explanation panel opens in place once revealed, and only when there is an explanation to show. */
function paintExplanation(parts: QuestionCardParts): void {
  const empty = (parts.explanationTextEl.textContent ?? '') === ''
  parts.explanationEl.style.display = parts.revealed && !empty ? '' : 'none'
}

function readProgress(value: unknown): { value: number; max: number } | undefined {
  const p = typeof value === 'object' && value !== null ? (value as { value?: unknown; max?: unknown }) : undefined
  return p !== undefined && typeof p.value === 'number' && typeof p.max === 'number' ? { value: p.value, max: p.max } : undefined
}

const str = (value: unknown): string => (value == null ? '' : String(value))

/**
 * `QuestionCard` → `ui-card` holding the head, question, options and explanation parts, in that order
 * (ADR-0243 cl.2 and Amendment 1). Every part exists from `create()`, so a payload with every prop absent
 * still mounts.
 */
export const questionCardFactory: WidgetFactory = {
  tag: 'ui-card',
  uses: ['ui-badge', 'ui-radio', 'ui-radio-group', 'ui-text'], // ADR-0233: the controls it mints
  create: () => {
    const el = document.createElement('ui-card')
    const s = el.style
    s.display = 'flex'
    s.flexDirection = 'column'
    boxRegionCard(el)
    s.gap = BOX.gap

    const headEl = document.createElement('div')
    headEl.setAttribute('data-part', 'head')
    headEl.style.display = 'none'
    headEl.style.justifyContent = 'space-between'
    headEl.style.alignItems = 'center'
    headEl.style.gap = BOX.gap
    const labelEl = document.createElement('ui-badge') as unknown as BadgeLike
    labelEl.setAttribute('data-part', 'label')
    labelEl.style.display = 'none'
    // The approved pill: info-tinted, neutral ink, no intent glyph (it is a counter, not a status).
    labelEl.style.setProperty('--ui-badge-fill', 'var(--md-sys-color-info-container)')
    labelEl.style.setProperty('--ui-badge-ink', 'var(--md-sys-color-neutral-on-surface)')
    labelEl.style.setProperty('--ui-badge-outline', 'transparent')
    labelEl.style.fontWeight = '600'
    const metaEl = text('none', 'body', 'md')
    metaEl.setAttribute('data-part', 'meta')
    metaEl.style.display = 'none'
    metaEl.style.marginInlineStart = 'auto'
    metaEl.style.color = 'var(--md-sys-color-neutral-on-surface-variant)'
    headEl.append(labelEl, metaEl)

    const questionEl = text('h4', 'title', 'md')
    questionEl.emphasis = true
    questionEl.setAttribute('data-part', 'question')
    const groupEl = document.createElement('ui-radio-group') as unknown as RadioGroupLike
    groupEl.setAttribute('data-part', 'options')

    const explanationEl = document.createElement('div')
    explanationEl.setAttribute('data-part', 'explanation')
    const x = explanationEl.style
    x.display = 'none'
    x.padding = 'var(--md-sys-space-sm) var(--md-sys-space-md)'
    x.borderRadius = BOX.childRadius
    x.background = 'var(--md-sys-color-neutral-container-low)'
    const explanationTextEl = text('p', 'body', 'md')
    explanationEl.appendChild(explanationTextEl)

    // The card's own parts span its width; the producer's children (the Next question Button) keep their content width.
    s.alignItems = 'flex-start'
    for (const part of [headEl, questionEl, groupEl, explanationEl]) part.style.alignSelf = 'stretch'
    el.append(headEl, questionEl, groupEl, explanationEl)
    actionRowButtons(el)
    const parts: QuestionCardParts = {
      headEl,
      labelEl,
      metaEl,
      questionEl,
      groupEl,
      explanationEl,
      explanationTextEl,
      value: null,
      answer: null,
      revealed: false,
      label: '',
      progress: undefined,
      actionName: '',
      pending: false,
    }
    questionCardParts.set(el, parts)
    // A user commit (click, Space, arrow keys) repaints the rows; the event keeps bubbling to the input binding.
    groupEl.addEventListener('change', () => paintOptions(parts))
    // The live selection for `installInputBinding` (LLD-C8): read on the group's bubbling `change`.
    Object.defineProperty(el, 'a2uiQuestionValue', {
      configurable: true,
      get: () => groupEl.value,
    })
    // A pick commits the answer as the host's own `action` event (T-0429), which the renderer forwards only when it
    // is dispatched ON the host. Nothing commits while revealed, disabled, pending (T-0439) or with no pick.
    const commit = (): void => {
      const picked = groupEl.value
      if (parts.actionName === '' || parts.revealed || parts.pending || groupEl.disabled || picked === null || picked === '') return
      parts.pending = true
      groupEl.disabled = true
      paintOptions(parts)
      el.dispatchEvent(new CustomEvent('action', { detail: { action: parts.actionName, context: { value: picked } } }))
    }
    const rowOf = (event: Event): (RadioLike & { checked: boolean }) | null =>
      event.target instanceof Element ? (event.target.closest('ui-radio') as (RadioLike & { checked: boolean }) | null) : null
    // The commit rides `click`, never `change`: arrow keys move the pick with a `change` and no click (selection
    // follows focus), so a keyboard user reaches option C without answering B. Space clicks the row on keyup.
    // Capture: a re-press of the picked row, whose own capture guard swallows its click before it bubbles.
    groupEl.addEventListener('click', (event) => { if (rowOf(event)?.checked === true) commit() }, { capture: true })
    // Bubble: a fresh pick, after the row's toggle fired the `change` the input binding writes, so the action's
    // data model already holds the pick.
    groupEl.addEventListener('click', (event) => { if (rowOf(event) !== null) commit() })
    return el
  },
  applyProp: (el, prop, value) => {
    const parts = questionCardParts.get(el)
    if (parts === undefined) return
    switch (prop) {
      case 'question':
        // A different question is a new round: re-arm a card the reveal never reached.
        if (parts.pending && parts.questionEl.textContent !== str(value)) {
          parts.pending = false
          parts.groupEl.disabled = parts.revealed
          paintOptions(parts)
        }
        parts.questionEl.textContent = str(value)
        break
      case 'explanation':
        parts.explanationTextEl.textContent = str(value)
        paintExplanation(parts)
        break
      case 'name':
        parts.groupEl.name = str(value)
        break
      case 'options':
        syncOptions(parts, readOptions(value))
        break
      case 'value':
        parts.value = value == null || value === '' ? null : String(value)
        parts.groupEl.value = parts.value
        paintOptions(parts)
        break
      case 'answer':
        parts.answer = value == null || value === '' ? null : String(value)
        paintOptions(parts)
        break
      case 'revealed':
        // Any change of `revealed` ends the wait: the reveal landed, or the next round re-armed the card.
        if (parts.revealed !== (value === true)) parts.pending = false
        parts.revealed = value === true
        parts.groupEl.disabled = parts.revealed || parts.pending
        paintExplanation(parts)
        paintOptions(parts)
        break
      case 'label':
        parts.label = str(value)
        paintHeader(parts)
        break
      case 'meta':
        parts.metaEl.textContent = str(value)
        paintHeader(parts)
        break
      case 'progress':
        parts.progress = readProgress(value)
        paintHeader(parts)
        break
      case 'actionName':
        parts.actionName = str(value)
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
