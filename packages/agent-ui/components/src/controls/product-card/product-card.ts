// product-card.ts: UIProductCardElement, one product, room or offer to buy or book (ADR-0243, the
// ProductCard fork sheet). A display primitive: extends UIElement, not UIContainerElement (the interior is
// a fixed, component-built anatomy from data props) and not form-associated (no value). Tier: pattern
// (container spacing plus one control-height action row, the ADR-0224 cl.1 ServiceCard precedent).
//
// Anatomy: an optional `[data-part="media"]` (an image in a reserved 16:10 box, or the icon header when
// there is no image) and a `[data-part="body"]` (title, subtitle, rating, badge, then the price row with
// price, price note and the real native action button). Every part is built ONCE by an idempotent
// `#ensureParts` and kept live by small per-part effects that only attach or detach nodes, never create
// them, so an unrelated prop change never destroys the action button's focus or hover state. An empty
// optional value renders no box (the ADR-0201 valueless-row law): with no price and no action there is
// no price row at all, the exhibit tile.
//
// The default slot: the control PREPENDS media and body on first connect (the field.ts label-prepend
// precedent), so any light-DOM child the consumer wrote stays a direct host child after the body, and DOM
// order equals reading order. No MutationObserver, no adoption.
//
// Layer: controls/ (imports dom plus two fleet leaves it composes, ui-badge and ui-icon).

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import type { UIBadgeElement } from '../badge/badge.ts'
import '../badge/badge.ts'
import type { UIIconElement } from '../icon/icon.ts'
import '../icon/icon.ts'
// Generated from product-card.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs
// product-card` to regenerate; never hand-edit product-card.props.gen.ts.
import { props } from './product-card.props.gen.ts'

/** Attach `node` under `parent` in its fixed `order` slot when `show`, detach it otherwise. Insert-only:
 *  a node already in place is never moved, so a focused descendant keeps focus. */
function place(node: Element, show: boolean, parent: Element, order: readonly Element[]): void {
  if (!show) {
    node.remove()
    return
  }
  if (node.parentNode === parent) return
  const next = order.slice(order.indexOf(node) + 1).find((n) => n.parentNode === parent) ?? null
  parent.insertBefore(node, next)
}

function part<T extends HTMLElement>(tag: string, name: string): T {
  const el = document.createElement(tag)
  el.setAttribute('data-part', name)
  return el as T
}

export interface UIProductCardElement extends ReactiveProps<typeof props> {}
export class UIProductCardElement extends UIElement {
  static props = props

  #media: HTMLDivElement | null = null
  #image!: HTMLImageElement
  #icon!: UIIconElement
  #body!: HTMLDivElement
  #title!: HTMLDivElement
  #subtitle!: HTMLDivElement
  #rating!: HTMLDivElement
  #ratingValue!: HTMLSpanElement
  #badge!: UIBadgeElement
  #priceRow!: HTMLDivElement
  #price!: HTMLSpanElement
  #priceNote!: HTMLSpanElement
  #action!: HTMLButtonElement

  protected connected(): void {
    // ARIA via internals, never a host role/aria-* attribute (the fleet law).
    this.internals.role = 'group'
    this.#ensureParts()
    // Re-armed every connect (the service-card.ts precedent): `this.listen` rides the current
    // connection's AbortSignal; the button node itself is reused.
    this.listen(this.#action, 'click', () => this.emit('action', this.action))

    const bodyOrder = [this.#title, this.#subtitle, this.#rating, this.#badge, this.#priceRow]
    const rowOrder = [this.#price, this.#priceNote, this.#action]

    this.effect(() => {
      const title = this.title
      this.internals.ariaLabel = title
      this.#title.textContent = title
    })

    this.effect(() => {
      const image = this.image
      const icon = this.icon
      const media = this.#media!
      if (image === '' && icon === '') {
        media.remove()
        return
      }
      if (image !== '') {
        this.#image.src = image
        this.#image.alt = this.imageAlt
        if (this.#image.parentNode !== media) media.replaceChildren(this.#image)
      } else {
        this.#icon.glyph = icon
        if (this.#icon.parentNode !== media) media.replaceChildren(this.#icon)
      }
      if (media.parentNode !== this) this.insertBefore(media, this.#body)
    })

    this.effect(() => {
      const subtitle = this.subtitle
      this.#subtitle.textContent = subtitle
      place(this.#subtitle, subtitle !== '', this.#body, bodyOrder)
    })

    this.effect(() => {
      const rating = this.rating
      const show = rating !== null && rating > 0
      if (show) this.#ratingValue.textContent = rating.toFixed(1)
      place(this.#rating, show, this.#body, bodyOrder)
    })

    this.effect(() => {
      const badge = this.badge
      this.#badge.label = badge
      this.#badge.intent = this.badgeIntent
      place(this.#badge, badge !== '', this.#body, bodyOrder)
    })

    this.effect(() => {
      const price = this.price
      const note = this.priceNote
      const action = this.action
      const label = this.actionLabel
      const title = this.title
      this.#price.textContent = price
      this.#priceNote.textContent = note
      this.#action.textContent = label
      this.#action.setAttribute('aria-label', title === '' ? label : `${label} ${title}`)
      place(this.#price, price !== '', this.#priceRow, rowOrder)
      place(this.#priceNote, note !== '', this.#priceRow, rowOrder)
      place(this.#action, action !== null, this.#priceRow, rowOrder)
      place(this.#priceRow, price !== '' || action !== null, this.#body, bodyOrder)
    })
  }

  #ensureParts(): void {
    if (this.#media) return // idempotent: light-DOM parts persist across a reconnect

    this.#media = part<HTMLDivElement>('div', 'media')
    this.#image = part<HTMLImageElement>('img', 'image')
    this.#icon = part<UIIconElement>('ui-icon', 'icon')

    this.#body = part<HTMLDivElement>('div', 'body')
    this.#title = part<HTMLDivElement>('div', 'title')
    this.#subtitle = part<HTMLDivElement>('div', 'subtitle')

    // Rating: the star is decorative, the number is visible, and a visually hidden " out of 5" makes the
    // accessible text read "4.8 out of 5" (never stars alone, the ADR-0243 A11y row).
    this.#rating = part<HTMLDivElement>('div', 'rating')
    const glyph = part<HTMLSpanElement>('span', 'rating-glyph')
    glyph.setAttribute('aria-hidden', 'true')
    glyph.textContent = '★'
    this.#ratingValue = part<HTMLSpanElement>('span', 'rating-value')
    const ratingText = part<HTMLSpanElement>('span', 'rating-text')
    ratingText.textContent = ' out of 5'
    this.#rating.append(glyph, this.#ratingValue, ratingText)

    this.#badge = part<UIBadgeElement>('ui-badge', 'badge')

    this.#priceRow = part<HTMLDivElement>('div', 'price-row')
    this.#price = part<HTMLSpanElement>('span', 'price')
    this.#priceNote = part<HTMLSpanElement>('span', 'price-note')
    this.#action = part<HTMLButtonElement>('button', 'action')
    this.#action.type = 'button'

    this.#body.append(this.#title)
    this.prepend(this.#body)
  }
}

if (!customElements.get('ui-product-card')) customElements.define('ui-product-card', UIProductCardElement)
