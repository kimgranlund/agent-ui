// game-hud.ts: UIGameHudElement, the game score and status strip (ADR-0243, GameHud fork sheet). Behaviour,
// props, internals ARIA and the control-built parts only; the hardening and formatting live in
// game-hud-model.ts and every visual rule in game-hud.css.
//
// A pattern-tier display primitive: not form-associated, not focusable, no keyboard model, no events.
// The host is `role="group"` named by `title` (or "Game status") and is ONE polite live region, both set
// through ElementInternals, never host attributes. Because the whole HUD is the live region, the parts are
// built once and patched in place: text is written only when it differs and a part is added or removed
// only when its presence changes, so a score change announces only the readout that changed.
//
// `title` is observed as `hud-title`, never the global `title` attribute, so a HUD never paints a native
// tooltip or gains a duplicate accessible description. The status mark is a composed ui-badge, which
// supplies the ADR-0057 shape glyph for the status intent.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import '../badge/badge.ts'
import type { UIBadgeElement } from '../badge/badge.ts'
import { cleanProgress, cleanStats, statusIntentOf, type CleanStat } from './game-hud-model.ts'
// Generated from game-hud.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs game-hud`.
import { props } from './game-hud.props.gen.ts'

interface StatParts {
  root: HTMLElement
  glyph: HTMLElement
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

export interface UIGameHudElement extends ReactiveProps<typeof props> {}
export class UIGameHudElement extends UIElement {
  static props = props

  #header: HTMLElement | undefined
  #title!: HTMLElement
  #status!: UIBadgeElement
  #progress!: HTMLElement
  #progressText!: HTMLElement
  #progressFill!: HTMLElement
  #stats!: HTMLElement
  #statParts: StatParts[] = []

  protected override connected(): void {
    this.internals.role = 'group'
    this.internals.ariaLive = 'polite'
    this.#ensureParts()

    this.effect(() => {
      const title = typeof this.title === 'string' ? this.title.trim() : ''
      this.internals.ariaLabel = title === '' ? 'Game status' : title
    })

    this.effect(() => this.#renderHeader())
    this.effect(() => this.#renderProgress())
    this.effect(() => this.#renderStats())
  }

  #ensureParts(): void {
    if (this.#header) return // parts persist across reconnects; built once ever
    this.#header = part('div', 'header')
    this.#title = part('span', 'title')
    this.#status = part('ui-badge', 'status') as UIBadgeElement
    this.#progress = part('div', 'progress')
    this.#progress.setAttribute('role', 'progressbar')
    this.#progress.setAttribute('aria-valuemin', '0')
    this.#progressText = part('span', 'progress-text')
    const track = part('div', 'progress-track')
    this.#progressFill = part('div', 'progress-fill')
    track.append(this.#progressFill)
    this.#progress.append(this.#progressText, track)
    this.#stats = part('div', 'stats')
  }

  #renderHeader(): void {
    const title = typeof this.title === 'string' ? this.title : ''
    const status = typeof this.status === 'string' ? this.status : ''
    const intent = statusIntentOf(this.statusIntent)
    const header = this.#header!
    setText(this.#title, title)
    place(header, this.#title, title !== '', [this.#status])
    if (this.#status.label !== status) this.#status.label = status
    if (this.#status.intent !== intent) this.#status.intent = intent
    place(header, this.#status, status !== '')
    place(this, header, title !== '' || status !== '', [this.#progress, this.#stats])
  }

  #renderProgress(): void {
    const progress = cleanProgress(this.progress)
    place(this, this.#progress, progress !== null, [this.#stats])
    if (progress === null) return
    const label = progress.label.trim()
    setAttr(this.#progress, 'aria-valuemax', String(progress.max))
    setAttr(this.#progress, 'aria-valuenow', String(progress.value))
    setAttr(this.#progress, 'aria-label', label === '' ? 'Progress' : label)
    const readout = `${progress.value} / ${progress.max}`
    setText(this.#progressText, label === '' ? readout : `${label} ${readout}`)
    const fill = String(progress.value / progress.max)
    if (this.#progressFill.style.getPropertyValue('--_fill') !== fill) this.#progressFill.style.setProperty('--_fill', fill)
  }

  #renderStats(): void {
    const stats = cleanStats(this.stats)
    const parts = this.#statParts
    while (parts.length > stats.length) parts.pop()!.root.remove()
    while (parts.length < stats.length) {
      const root = part('div', 'stat')
      const glyph = part('span', 'glyph')
      glyph.setAttribute('aria-hidden', 'true')
      const entry: StatParts = { root, glyph, label: part('span', 'label'), value: part('span', 'value'), delta: part('span', 'delta') }
      root.append(entry.label, entry.value)
      this.#stats.append(root)
      parts.push(entry)
    }
    stats.forEach((stat, i) => this.#renderStat(parts[i]!, stat))
    place(this, this.#stats, stats.length > 0)
  }

  #renderStat(parts: StatParts, stat: CleanStat): void {
    setAttr(parts.root, 'data-intent', stat.intent ?? null)
    place(parts.root, parts.glyph, stat.intent !== undefined, [parts.label])
    setText(parts.label, stat.label)
    setText(parts.value, stat.value)
    if (stat.delta !== undefined) setText(parts.delta, stat.delta)
    place(parts.root, parts.delta, stat.delta !== undefined)
  }
}

if (!customElements.get('ui-game-hud')) customElements.define('ui-game-hud', UIGameHudElement)
