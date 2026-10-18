// result-card.ts: UIResultCardElement, the settled outcome card for a game end or a finished booking
// (ADR-0244, ResultCard fork sheet). Behaviour, props, internals ARIA and the control-built parts only; the
// hardening lives in result-card-model.ts and every visual rule in result-card.css.
//
// A pattern-tier display primitive: not form-associated, not focusable, no events of its own. The host is
// `role="group"` named by the outcome word and `title`, set through ElementInternals. The header part is the
// one polite live region; the parts are built once and patched in place, so an unchanged outcome announces
// nothing and a changed one announces once.
//
// The producer's children (its action Buttons) stay direct host children after the parts and form the actions
// row. The control mints no button: it stamps `size="lg"` on every direct `ui-button` child, the
// a2ui `personas/action-row.ts` behaviour re-homed here because components never import a2ui.
//
// `title` is observed as `result-title`, never the global `title` attribute, so a card never paints a native
// tooltip (the ui-game-hud `hud-title` precedent).

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { createGlyph, type GlyphSymbol, type UIGlyphElement } from '../glyph/glyph.ts' // stat intent marks (T-0351)
import { intentMark } from '../badge/intent-mark.ts'
import { cleanStats, outcomeOf, OUTCOME_WORDS, type CleanStat, type Outcome } from './result-card-model.ts'
// Generated from result-card.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs result-card`.
import { props } from './result-card.props.gen.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The outcome glyphs of the approved mockup, on a 16-unit box: stroked check, cross and equals; a filled dot. */
const GLYPHS: Readonly<Record<Outcome, { d: string; filled: boolean }>> = {
  win: { d: 'M3 8.5l3.2 3.2L13 4.8', filled: false },
  lose: { d: 'M4 4l8 8M12 4l-8 8', filled: false },
  draw: { d: 'M4 6h8M4 10h8', filled: false },
  done: { d: 'M5 8a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', filled: true },
}

interface StatParts {
  root: HTMLElement
  glyph: UIGlyphElement | undefined // built on the stat's first intent, then kept
  label: HTMLElement
  value: HTMLElement
  delta: HTMLElement
}

const part = (tag: string, name: string): HTMLElement => {
  const node = document.createElement(tag)
  node.dataset.part = name
  return node
}

const setText = (node: Node, text: string): void => {
  if (node.textContent !== text) node.textContent = text
}

const setAttr = (node: Element, name: string, value: string | null): void => {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name)
  } else if (node.getAttribute(name) !== value) {
    node.setAttribute(name, value)
  }
}

/** Put `node` in `parent` when `present`, before the first of `later` already attached; remove it otherwise. */
const place = (parent: Element, node: Element, present: boolean, later: readonly Element[] = []): void => {
  if (!present) {
    if (node.parentNode === parent) node.remove()
    return
  }
  if (node.parentNode === parent) return
  parent.insertBefore(node, later.find((n) => n.parentNode === parent) ?? null)
}

export interface UIResultCardElement extends ReactiveProps<typeof props> {}
export class UIResultCardElement extends UIElement {
  static props = props

  #header: HTMLElement | undefined
  #outcome!: HTMLElement
  #glyphPath!: SVGPathElement
  #word!: HTMLElement
  #title!: HTMLElement
  #summary!: HTMLElement
  #stats!: HTMLElement
  #statParts: StatParts[] = []
  #buttons: MutationObserver | null = null

  protected override connected(): void {
    this.internals.role = 'group'
    this.#ensureParts()

    this.effect(() => {
      const word = OUTCOME_WORDS[outcomeOf(this.outcome)]
      const title = typeof this.title === 'string' ? this.title.trim() : ''
      this.internals.ariaLabel = title === '' ? word : `${word}: ${title}`
    })

    this.effect(() => this.#renderHeader())
    this.effect(() => this.#renderSummary())
    this.effect(() => this.#renderStats())

    // Size the producer's action buttons at the lg step: the ones already here (appended before connect, or
    // while disconnected, when no observer runs) and every later direct child.
    this.#stampButtons()
    this.#buttons = new MutationObserver(() => this.#stampButtons())
    this.#buttons.observe(this, { childList: true })
  }

  protected override disconnected(): void {
    this.#buttons?.disconnect()
    this.#buttons = null
  }

  #stampButtons(): void {
    for (const child of this.children) {
      if (child.localName === 'ui-button' && child.getAttribute('size') !== 'lg') child.setAttribute('size', 'lg')
    }
  }

  #ensureParts(): void {
    if (this.#header) return // parts persist across reconnects; built once ever
    this.#header = part('div', 'header')
    this.#header.setAttribute('aria-live', 'polite')
    this.#outcome = part('span', 'outcome')
    const glyph = document.createElementNS(SVG_NS, 'svg')
    glyph.dataset.part = 'outcome-glyph'
    glyph.setAttribute('viewBox', '0 0 16 16')
    glyph.setAttribute('aria-hidden', 'true')
    this.#glyphPath = document.createElementNS(SVG_NS, 'path')
    this.#glyphPath.setAttribute('stroke-width', '2')
    this.#glyphPath.setAttribute('stroke-linecap', 'round')
    this.#glyphPath.setAttribute('stroke-linejoin', 'round')
    glyph.append(this.#glyphPath)
    this.#word = part('span', 'outcome-word')
    this.#outcome.append(glyph, this.#word)
    this.#title = part('span', 'title')
    this.#header.append(this.#outcome)
    this.#summary = part('p', 'summary')
    this.#stats = part('div', 'stats')
  }

  /** The parts that come after `node`, then the first producer child: the anchor `node` is inserted before. */
  #after(node: Element): Element[] {
    const order = [this.#header!, this.#summary, this.#stats]
    const firstChild = Array.from(this.children).find((c) => !order.includes(c as HTMLElement))
    return [...order.slice(order.indexOf(node as HTMLElement) + 1), ...(firstChild ? [firstChild] : [])]
  }

  #renderHeader(): void {
    const outcome = outcomeOf(this.outcome)
    const glyph = GLYPHS[outcome]
    setAttr(this.#outcome, 'data-outcome', outcome)
    setAttr(this.#glyphPath, 'd', glyph.d)
    setAttr(this.#glyphPath, 'fill', glyph.filled ? 'currentColor' : 'none')
    setAttr(this.#glyphPath, 'stroke', glyph.filled ? 'none' : 'currentColor')
    setText(this.#word, OUTCOME_WORDS[outcome])
    const title = typeof this.title === 'string' ? this.title : ''
    setText(this.#title, title)
    place(this.#header!, this.#title, title !== '')
    place(this, this.#header!, true, this.#after(this.#header!))
  }

  #renderSummary(): void {
    const summary = typeof this.summary === 'string' ? this.summary : ''
    setText(this.#summary, summary)
    place(this, this.#summary, summary.trim() !== '', this.#after(this.#summary))
  }

  #renderStats(): void {
    const stats = cleanStats(this.stats)
    const parts = this.#statParts
    while (parts.length > stats.length) parts.pop()!.root.remove()
    while (parts.length < stats.length) {
      const root = part('div', 'stat')
      const entry: StatParts = { root, glyph: undefined, label: part('span', 'label'), value: part('span', 'value'), delta: part('span', 'delta') }
      root.append(entry.label, entry.value)
      this.#stats.append(root)
      parts.push(entry)
    }
    stats.forEach((stat, i) => this.#renderStat(parts[i]!, stat))
    place(this, this.#stats, stats.length > 0, this.#after(this.#stats))
  }

  #renderStat(parts: StatParts, stat: CleanStat): void {
    setAttr(parts.root, 'data-intent', stat.intent ?? null)
    this.#renderStatMark(parts, intentMark(stat.intent))
    setText(parts.label, stat.label)
    setText(parts.value, stat.value)
    if (stat.delta !== undefined) setText(parts.delta, stat.delta)
    place(parts.root, parts.delta, stat.delta !== undefined)
  }

  /** The stat's intent mark: the shared badge table's ui-glyph (T-0351), placed before the label for a known
   *  intent and detached otherwise. Decorative: ui-glyph hides itself, the label carries the meaning. */
  #renderStatMark(parts: StatParts, mark: GlyphSymbol | undefined): void {
    if (mark === undefined) {
      if (parts.glyph !== undefined) place(parts.root, parts.glyph, false)
      return
    }
    if (parts.glyph === undefined) {
      parts.glyph = createGlyph(mark)
      parts.glyph.dataset.part = 'glyph'
    } else setAttr(parts.glyph, 'symbol', mark)
    place(parts.root, parts.glyph, true, [parts.label])
  }
}

if (!customElements.get('ui-result-card')) customElements.define('ui-result-card', UIResultCardElement)
