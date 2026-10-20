// option-deck.ts: UIOptionDeckElement, a deck of option cards for "pick one of a few things to start" (T-0193,
// the OptionDeck fork sheet and the approved playful direction in .sdlc/tickets/.0193-option-deck/). Behaviour,
// props, internals ARIA and the control-built parts only; the hardening lives in option-deck-model.ts and every
// visual rule in option-deck.css.
//
// Composition: `UIElement` composing `rovingFocus` + `selectionCommit` (mode 'single') from `connected()`, the
// ui-choice-group idiom without the form leg. The cards are light-DOM `[data-part="option"]` parts built from
// the `options` prop and patched in place by index (the ui-result-card stat-parts idiom), so a re-render never
// drops focus mid-roving. A part has no ElementInternals, so its `role`, `aria-selected`, `aria-labelledby` and
// `aria-describedby` are attributes on the part; the host carries only internals (`role=listbox`).
//
// The event channel (the BoardGrid shape): the trait emits `select` with the picked key itself, after `onSelect`
// has set `this.value`, so a listener reading `el.value` sees the new pick. A separate `action` event follows,
// only when `actionName` is set, carrying `{action, context: {value}}`, the detail the a2ui renderer's forwarded
// action reads. One pick is exactly one `select` and at most one `action`; a disabled deck fires neither.
//
// Selected paint follows `value`, not only a commit: the render effect reads `this.value` and paints every card,
// and the trait's `reflectSelected` seam routes through the same painter. The trait's own reflect is commit-time
// only (selection-commit.ts header, GH #908/#905), and `value` is settable from outside (a bind, `el.value`).
//
// Keyboard: two `rovingFocus` instances, vertical (Up/Down) and horizontal (Left/Right), both in tree order and
// both re-synced from the focused card on every keydown, so either axis moves through the auto-fit grid.
// `selectionCommit` wires click and Enter; Space is turned into `.click()` on the focused card here, the
// choice-group.ts precedent, so it rides the trait's click path.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { selectionCommit } from '../../traits/selection-commit.ts'
import type { UIIconElement } from '../icon/icon.ts'
import '../icon/icon.ts'
import { cleanOptions, RANDOM_KEY, type CleanOption } from './option-deck-model.ts'
// Generated from option-deck.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs option-deck`.
import { props } from './option-deck.props.gen.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The shuffle glyph of the approved mockup's Surprise me card, on a 24-unit box, stroked. */
const SHUFFLE_D = 'M3 7h3.5c4 0 6.5 10 11 10H21M18 14l3 3-3 3M3 17h3.5c1.6 0 2.8-1.4 3.8-3M21 7h-3.5c-1.6 0-2.8 1.4-3.8 3M18 4l3 3-3 3'

interface CardParts {
  root: HTMLElement
  hero: HTMLElement
  indexStart: HTMLElement
  indexEnd: HTMLElement
  disc: HTMLElement
  icon: UIIconElement | undefined // built on the card's first icon, then kept
  image: HTMLImageElement | undefined // built on the card's first image, then kept
  body: HTMLElement
  title: HTMLElement
  description: HTMLElement
  meta: HTMLElement
  chips: HTMLElement[]
  pick: HTMLElement
}

const part = <T extends HTMLElement = HTMLElement>(tag: string, name: string): T => {
  const node = document.createElement(tag) as T
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

let deckCount = 0

export interface UIOptionDeckElement extends ReactiveProps<typeof props> {}
export class UIOptionDeckElement extends UIElement {
  static props = props

  readonly #uid = `ui-option-deck-${++deckCount}`
  #heading: HTMLElement | undefined
  #subheading!: HTMLElement
  #grid!: HTMLElement
  #cards: CardParts[] = []
  #random!: CardParts

  protected override connected(): void {
    this.internals.role = 'listbox'
    this.#ensureParts()

    this.effect(() => {
      const heading = typeof this.heading === 'string' ? this.heading.trim() : ''
      this.internals.ariaLabel = heading === '' ? 'Options' : heading
      this.internals.ariaDisabled = this.disabled ? 'true' : null
    })
    this.effect(() => this.#renderHead())
    this.effect(() => this.#renderCards())

    const items = (): HTMLElement[] => Array.from(this.#grid.children) as HTMLElement[]
    const keyOf = (el: HTMLElement): string => el.dataset.key ?? ''
    const roving = {
      items,
      typeAhead: false,
      initialIndex: () => items().findIndex((card) => keyOf(card) === this.value),
      syncIndex: () => items().indexOf(document.activeElement as HTMLElement),
    }
    rovingFocus(this, { ...roving, orientation: 'vertical' })
    rovingFocus(this, { ...roving, orientation: 'horizontal' })

    selectionCommit(this, {
      mode: 'single',
      items,
      keyOf,
      itemFromTarget: (target) => {
        if (this.disabled || !(target instanceof Element)) return null
        const card = target.closest('[data-part="option"]')
        return card instanceof HTMLElement && card.parentElement === this.#grid ? card : null
      },
      reflectSelected: (el, selected) => this.#paint(el, selected),
      onSelect: (selection) => {
        this.value = selection as string
      },
    })

    // The action rides its own event after `select` (the BoardGrid emit). Registered after the trait, so a
    // two-way bind on `value` wired before connect has already committed when the action goes out.
    this.listen(this, 'select', (event) => {
      if (event.target !== this) return
      const value = (event as CustomEvent<unknown>).detail
      if (typeof value !== 'string' || this.actionName === '' || this.disabled) return
      this.emit('action', { action: this.actionName, context: { value } })
    })

    // Space picks the focused card (selectionCommit wires click and Enter only); `.click()` rides its click path.
    this.listen(this, 'keydown', (event) => {
      const e = event as KeyboardEvent
      if (e.key !== ' ') return
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || active.parentElement !== this.#grid) return
      e.preventDefault() // no page scroll
      active.click()
    })
  }

  #ensureParts(): void {
    if (this.#heading) return // parts persist across reconnects; built once ever
    this.#heading = part('div', 'heading')
    this.#subheading = part('p', 'subheading')
    this.#grid = part('div', 'grid')
    this.#random = this.#buildCard(`${this.#uid}-r`)
    this.#random.root.dataset.random = ''
    this.#random.root.dataset.key = RANDOM_KEY
    this.#random.root.dataset.tone = 'neutral'
    const shuffle = document.createElementNS(SVG_NS, 'svg')
    shuffle.dataset.part = 'shuffle'
    shuffle.setAttribute('viewBox', '0 0 24 24')
    shuffle.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', SHUFFLE_D)
    for (const [k, v] of [['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) path.setAttribute(k!, v!)
    shuffle.append(path)
    this.#random.disc.append(shuffle)
    this.append(this.#heading, this.#subheading, this.#grid)
  }

  #buildCard(id: string): CardParts {
    const root = part('div', 'option')
    root.setAttribute('role', 'option')
    root.setAttribute('aria-selected', 'false')
    root.tabIndex = -1
    const hero = part('div', 'hero')
    const indexStart = part('span', 'index')
    indexStart.dataset.corner = 'start'
    indexStart.setAttribute('aria-hidden', 'true')
    const indexEnd = part('span', 'index')
    indexEnd.dataset.corner = 'end'
    indexEnd.setAttribute('aria-hidden', 'true')
    const disc = part('span', 'disc')
    hero.append(disc)
    const body = part('div', 'body')
    const title = part('span', 'title')
    title.id = `${id}-title`
    const description = part('span', 'description')
    description.id = `${id}-description`
    const meta = part('span', 'meta')
    meta.id = `${id}-meta`
    body.append(title)
    const pick = part('span', 'pick')
    pick.setAttribute('aria-hidden', 'true')
    pick.textContent = 'Your pick'
    root.setAttribute('aria-labelledby', title.id)
    root.append(hero, body)
    return { root, hero, indexStart, indexEnd, disc, icon: undefined, image: undefined, body, title, description, meta, chips: [], pick }
  }

  #renderHead(): void {
    const heading = typeof this.heading === 'string' ? this.heading : ''
    const subheading = typeof this.subheading === 'string' ? this.subheading : ''
    setText(this.#heading!, heading)
    setText(this.#subheading, subheading)
    place(this, this.#heading!, heading.trim() !== '', [this.#subheading, this.#grid])
    place(this, this.#subheading, subheading.trim() !== '', [this.#grid])
  }

  /** Build or patch every card from `options`, then paint the pick and the tab stop from `value` and `disabled`. */
  #renderCards(): void {
    const options = cleanOptions(this.options)
    const cards = this.#cards
    while (cards.length > options.length) cards.pop()!.root.remove()
    while (cards.length < options.length) {
      const card = this.#buildCard(`${this.#uid}-${cards.length}`)
      this.#grid.insertBefore(card.root, this.#random.root.parentNode === this.#grid ? this.#random.root : null)
      cards.push(card)
    }
    options.forEach((option, i) => this.#renderCard(cards[i]!, option))

    const label = typeof this.randomLabel === 'string' && this.randomLabel.trim() !== '' ? this.randomLabel : 'Surprise me'
    setText(this.#random.title, label)
    place(this.#grid, this.#random.root, this.allowRandom === true)

    const value = typeof this.value === 'string' ? this.value : ''
    const disabled = this.disabled === true
    const all = Array.from(this.#grid.children) as HTMLElement[]
    for (const card of all) {
      this.#paint(card, value !== '' && card.dataset.key === value)
      setAttr(card, 'aria-disabled', disabled ? 'true' : null)
    }
    // The roving tab stop: none while disabled; otherwise keep the one rovingFocus placed, or seed the picked
    // card (or the first) when no card holds it, such as a fresh render or a re-enable.
    if (disabled) {
      for (const card of all) card.tabIndex = -1
    } else if (all.length > 0 && !all.some((card) => card.tabIndex === 0)) {
      const seed = Math.max(0, all.findIndex((card) => card.dataset.key === value))
      all.forEach((card, i) => { card.tabIndex = i === seed ? 0 : -1 })
    }
  }

  #renderCard(parts: CardParts, option: CleanOption): void {
    const { root, hero, disc, body } = parts
    root.dataset.key = option.value
    root.dataset.tone = option.tone

    const index = option.index ?? ''
    setText(parts.indexStart, index)
    setText(parts.indexEnd, index)
    place(hero, parts.indexStart, index !== '', [disc])
    place(hero, parts.indexEnd, index !== '')

    const image = option.image ?? ''
    if (image !== '' && parts.image === undefined) parts.image = part<HTMLImageElement>('img', 'image')
    if (parts.image) {
      setAttr(parts.image, 'src', image === '' ? null : image)
      setAttr(parts.image, 'alt', option.imageAlt ?? '')
      place(hero, parts.image, image !== '', [disc])
    }
    place(hero, disc, image === '', [parts.indexEnd])

    const icon = option.icon ?? ''
    if (icon !== '' && parts.icon === undefined) parts.icon = part<UIIconElement>('ui-icon', 'icon')
    if (parts.icon) {
      if (parts.icon.symbol !== icon && icon !== '') parts.icon.symbol = icon
      place(disc, parts.icon, icon !== '')
    }

    setText(parts.title, option.title)
    const description = option.description ?? ''
    setText(parts.description, description)
    place(body, parts.description, description !== '', [parts.meta])

    const chips = parts.chips
    while (chips.length > option.meta.length) chips.pop()!.remove()
    while (chips.length < option.meta.length) {
      const chip = part('span', 'chip')
      parts.meta.append(chip)
      chips.push(chip)
    }
    option.meta.forEach((text, i) => setText(chips[i]!, text))
    place(body, parts.meta, option.meta.length > 0)

    const described = [description !== '' ? parts.description.id : '', option.meta.length > 0 ? parts.meta.id : '']
      .filter((id) => id !== '')
      .join(' ')
    setAttr(root, 'aria-describedby', described === '' ? null : described)
  }

  /** The one selected-state painter: `aria-selected` plus the Your pick pill, present only on the picked card. */
  #paint(card: HTMLElement, selected: boolean): void {
    setAttr(card, 'aria-selected', String(selected))
    const parts = card === this.#random.root ? this.#random : this.#cards.find((c) => c.root === card)
    if (parts) place(card, parts.pick, selected)
  }
}

if (!customElements.get('ui-option-deck')) customElements.define('ui-option-deck', UIOptionDeckElement)
