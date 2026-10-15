// factories.ts: the `stylist` persona's factory table (ADR-0244 cl.3 and its ContrastPair fork sheet, T-0090;
// the look is the approved mockup, section #cpair). One composite factory, `ContrastPair`, over `ui-card`: a
// header (the `label` and the ratio as text, "4.47:1"), a sample region painted with the pair (`background`
// behind, `foreground` ink) showing `sample` large and one pangram line at body size, a verdict row of three
// `ui-badge` pills (AA body 4.5, AA large 3, AAA body 7), and a values line naming both colors.
//
// The ratio and verdicts come from `contrast.ts`, a pure function, never from the model. Each pill carries a
// glyph and a word (the badge's success tick with "Pass", its danger cross with "Fail"), never color alone. An
// Unrated pair (a translucent background or a value that does not parse) shows "Unrated" in place of the ratio,
// keeps the sample and the raw values, and shows no pills. Display only: no events, no value mark, and it mints
// no action control, so the 36px large-action rule holds by construction.
//
// The card is one region on the ADR-0046 box model (`boxRegionCard`, Amendment 7), its parts one 8px gap apart.
// A named `ui-card` reads as an ARIA group through its own internals; the factory supplies the name as the
// card's documented `aria-label`, composed from the label, both values, the ratio "to 1" and the floors it
// passes. Styling goes through `el.style` only, with no border-left anywhere.

import type { WidgetFactory } from '../../types.ts'
import { BOX, boxRegionCard } from '../box-region.ts'
import { CONTRAST_FLOORS, rateContrast, type FloorId } from './contrast.ts'

// Structural duck-types over the minted controls' public props (the fleet's generic-cast convention).
interface BadgeLike extends HTMLElement {
  label: string
  intent: string
}

interface TextLike extends HTMLElement {
  as: string
  variant: string
  size: string
  emphasis: boolean
}

/** The body line under the large sample, as drawn in the approved mockup. */
export const SAMPLE_LINE = 'The quick brown fox jumps over the lazy dog.'

interface ContrastPairParts {
  labelEl: TextLike
  ratioEl: TextLike
  sampleEl: HTMLElement
  sampleLargeEl: TextLike
  verdictsEl: HTMLElement
  pills: ReadonlyMap<FloorId, BadgeLike>
  valuesEl: TextLike
  foreground: string
  background: string
  label: string
}

const contrastPairParts = new WeakMap<HTMLElement, ContrastPairParts>()

function text(variant: string, size: string): TextLike {
  const el = document.createElement('ui-text') as unknown as TextLike
  el.as = 'none'
  el.variant = variant
  el.size = size
  return el
}

const str = (value: unknown): string => (value == null ? '' : String(value).trim())

/** Paint one CSS color property, clearing it first so an invalid value never leaves the last pair painted. */
function paint(el: HTMLElement, property: string, value: string): void {
  el.style.removeProperty(property)
  if (value !== '') el.style.setProperty(property, value)
}

/** Rate the pair and repaint everything that depends on it: sample, ratio, pills, values and the group name. */
function repaint(el: HTMLElement, parts: ContrastPairParts): void {
  const { foreground, background } = parts
  paint(parts.sampleEl, 'background-color', background)
  paint(parts.sampleEl, 'color', foreground)

  const rating = rateContrast(foreground, background)
  el.setAttribute('data-rated', String(rating.rated))
  const ratio = parts.ratioEl
  if (rating.rated) {
    ratio.textContent = `${rating.display}:1`
    ratio.variant = 'headline'
    ratio.size = 'sm'
    ratio.emphasis = true
    ratio.style.color = ''
    ratio.style.fontWeight = ''
    for (const v of rating.verdicts) {
      const pill = parts.pills.get(v.id)!
      pill.intent = v.pass ? 'success' : 'danger'
      pill.label = `${v.label} ${v.floor} ${v.pass ? 'Pass' : 'Fail'}`
      pill.setAttribute('data-verdict', v.pass ? 'pass' : 'fail')
    }
    parts.verdictsEl.style.display = 'flex'
  } else {
    ratio.textContent = 'Unrated'
    ratio.variant = 'title'
    ratio.size = 'md'
    ratio.emphasis = false
    ratio.style.color = 'var(--md-sys-color-neutral-on-surface-variant)'
    ratio.style.fontWeight = '600'
    parts.verdictsEl.style.display = 'none'
  }

  const shown = (v: string): string => (v === '' ? 'unset' : v)
  const values = `${shown(foreground)} on ${shown(background)}`
  parts.valuesEl.textContent = values
  const name = parts.label !== '' ? parts.label : 'Contrast pair'
  let verdict: string
  if (rating.rated) {
    const passed = rating.verdicts.filter((v) => v.pass).map((v) => v.label)
    verdict = `contrast ${rating.display} to 1, ${passed.length > 0 ? `passes ${passed.join(', ')}` : 'passes no floor'}`
  } else {
    verdict = 'contrast unrated'
  }
  el.setAttribute('aria-label', `${name}, ${values}, ${verdict}`)
}

/**
 * `ContrastPair` → `ui-card` holding the header, sample, verdicts and values parts, in that order. Every part
 * exists from `create()`, so a payload with every prop absent still mounts (as an Unrated pair).
 */
export const contrastPairFactory: WidgetFactory = {
  tag: 'ui-card',
  uses: ['ui-badge', 'ui-text'], // ADR-0233: the controls it mints
  create: () => {
    const el = document.createElement('ui-card')
    // The card's documented name hook: present at connect, so the card mints its `group` role (card.ts).
    el.setAttribute('aria-label', 'Contrast pair, contrast unrated')
    const s = el.style
    s.display = 'flex'
    s.flexDirection = 'column'
    boxRegionCard(el)
    s.gap = BOX.gap

    const headerEl = document.createElement('div')
    headerEl.setAttribute('data-part', 'header')
    const h = headerEl.style
    h.display = 'flex'
    h.flexWrap = 'wrap'
    h.justifyContent = 'space-between'
    h.alignItems = 'baseline'
    h.gap = BOX.gap
    const labelEl = text('title', 'md')
    labelEl.emphasis = true
    labelEl.setAttribute('data-part', 'label')
    const ratioEl = text('headline', 'sm')
    ratioEl.setAttribute('data-part', 'ratio')
    ratioEl.style.fontVariantNumeric = 'tabular-nums'
    ratioEl.style.marginInlineStart = 'auto'
    headerEl.append(labelEl, ratioEl)

    // The painted pair. Its ink is the inherited `color`, so both sample lines read the foreground.
    const sampleEl = document.createElement('div')
    sampleEl.setAttribute('data-part', 'sample')
    const p = sampleEl.style
    p.display = 'grid'
    p.gap = 'var(--md-sys-space-xs)'
    p.padding = 'var(--md-sys-space-md)'
    p.borderRadius = BOX.childRadius
    p.border = '1px solid var(--md-sys-color-neutral-outline-variant)'
    const sampleLargeEl = text('display', 'sm')
    sampleLargeEl.emphasis = true
    sampleLargeEl.setAttribute('data-part', 'sample-large')
    sampleLargeEl.style.color = 'inherit'
    sampleLargeEl.style.lineHeight = '1.1'
    sampleLargeEl.textContent = 'Aa'
    const sampleBodyEl = text('body', 'md')
    sampleBodyEl.setAttribute('data-part', 'sample-body')
    sampleBodyEl.style.color = 'inherit'
    sampleBodyEl.textContent = SAMPLE_LINE
    sampleEl.append(sampleLargeEl, sampleBodyEl)

    const verdictsEl = document.createElement('div')
    verdictsEl.setAttribute('data-part', 'verdicts')
    const v = verdictsEl.style
    v.display = 'none'
    v.flexWrap = 'wrap'
    v.gap = '0.375rem' // 6px, the approved mockup's pill gap
    const pills = new Map<FloorId, BadgeLike>()
    for (const floor of CONTRAST_FLOORS) {
      const pill = document.createElement('ui-badge') as unknown as BadgeLike
      pill.setAttribute('data-part', 'verdict')
      pill.setAttribute('data-floor', floor.id)
      // The approved pill: the intent's container fill and glyph, neutral ink, no outline.
      pill.style.setProperty('--ui-badge-ink', 'var(--md-sys-color-neutral-on-surface)')
      pill.style.setProperty('--ui-badge-outline', 'transparent')
      pill.style.fontWeight = '600'
      pills.set(floor.id, pill)
      verdictsEl.appendChild(pill)
    }

    const valuesEl = text('body', 'sm')
    valuesEl.setAttribute('data-part', 'values')
    valuesEl.style.color = 'var(--md-sys-color-neutral-on-surface-variant)'
    valuesEl.style.fontVariantNumeric = 'tabular-nums'
    valuesEl.style.overflowWrap = 'anywhere'

    el.append(headerEl, sampleEl, verdictsEl, valuesEl)
    const parts: ContrastPairParts = {
      labelEl,
      ratioEl,
      sampleEl,
      sampleLargeEl,
      verdictsEl,
      pills,
      valuesEl,
      foreground: '',
      background: '',
      label: '',
    }
    contrastPairParts.set(el, parts)
    repaint(el, parts)
    return el
  },
  applyProp: (el, prop, value) => {
    const parts = contrastPairParts.get(el)
    if (parts === undefined) return
    switch (prop) {
      case 'foreground':
        parts.foreground = str(value)
        repaint(el, parts)
        break
      case 'background':
        parts.background = str(value)
        repaint(el, parts)
        break
      case 'label':
        parts.label = str(value)
        parts.labelEl.textContent = parts.label
        repaint(el, parts)
        break
      case 'sample': {
        const sample = str(value)
        parts.sampleLargeEl.textContent = sample === '' ? 'Aa' : sample
        break
      }
      default:
        break // an unknown prop is a no-op
    }
  },
}

/** Every component the fragment's `catalog.json` declares must appear here (the FACTORY_MISSING precondition). */
export const stylistFactories: Record<string, WidgetFactory> = {
  ContrastPair: contrastPairFactory,
}
