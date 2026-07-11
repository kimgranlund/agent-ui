// swiper-paddles.ts — UISwiperPaddlesElement, the prev/next anchor of the ui-swiper family
// (swiper-family.lld.md LLD-C10 · swiper-family.spec.md SPEC-R12 · ADR-0124 F3). BEHAVIOUR + the coordinator-
// driven `fill` seam + self-define ONLY; geometry lives in swiper.css, the public contract in
// swiper-paddles.md.
//
// An author-placed ANCHOR the owning `ui-swiper` fills and wires (`#driveChrome`, swiper.ts): TWO composed
// `<ui-button icon-only variant=ghost>` (the toast.ts close-button precedent — an icon-only composed button
// named by `aria-label`, a plain HTML global attribute set from OUTSIDE the button's own FACE internals, not
// a violation of the "ARIA via internals" rule which governs a control's OWN self-applied state). Marked
// `data-part='prev'`/`'next'` so the coordinator can toggle their `disabled` PUBLIC prop directly in non-loop
// mode (LLD §5 — "the coordinator toggles the composed ui-buttons' disabled"; no second method on this class
// is needed for that — `disabled` is public). Icons rotate with `orientation` (caret-left/right horizontal,
// caret-up/down vertical) — `@agent-ui/icons` is a zero-dep sibling package (disclosure.ts's own import
// precedent), never a CSS transform hack.
//
// `controls → dom + @agent-ui/icons` is the allowed import direction.

import { UIElement } from '../../dom/element.ts'
import type { PropsSchema } from '../../dom/props.ts'
import { setIcon } from '@agent-ui/icons'
import type { UIButtonElement } from '../button/button.ts'

export class UISwiperPaddlesElement extends UIElement {
  static props = {} satisfies PropsSchema

  #prev: UIButtonElement | null = null
  #next: UIButtonElement | null = null
  #prevIcon: HTMLElement | null = null
  #nextIcon: HTMLElement | null = null

  /**
   * Coordinator command (swiper.ts's `#driveChrome`) — fill this anchor with two real, wired `ui-button`s
   * (idempotent: built once, reused on every re-drive) and rotate their glyphs to `orientation`.
   */
  fill(onPrev: () => void, onNext: () => void, orientation: 'horizontal' | 'vertical'): void {
    this.#ensureButtons()
    setIcon(this.#prevIcon!, orientation === 'vertical' ? 'caret-up' : 'caret-left')
    setIcon(this.#nextIcon!, orientation === 'vertical' ? 'caret-down' : 'caret-right')
    this.#prev!.onclick = () => onPrev() // reassigning .onclick replaces cleanly — no accumulation across re-drives
    this.#next!.onclick = () => onNext()
  }

  #ensureButtons(): void {
    if (this.#prev) return

    this.#prev = document.createElement('ui-button') as UIButtonElement
    this.#prev.setAttribute('data-part', 'prev')
    this.#prev.setAttribute('variant', 'ghost')
    this.#prev.setAttribute('icon-only', '')
    this.#prev.setAttribute('aria-label', 'Previous slide')
    this.#prevIcon = document.createElement('ui-icon')
    this.#prevIcon.setAttribute('slot', 'leading')
    this.#prevIcon.setAttribute('data-role', 'icon')
    this.#prev.appendChild(this.#prevIcon)
    this.appendChild(this.#prev)

    this.#next = document.createElement('ui-button') as UIButtonElement
    this.#next.setAttribute('data-part', 'next')
    this.#next.setAttribute('variant', 'ghost')
    this.#next.setAttribute('icon-only', '')
    this.#next.setAttribute('aria-label', 'Next slide')
    this.#nextIcon = document.createElement('ui-icon')
    this.#nextIcon.setAttribute('slot', 'leading')
    this.#nextIcon.setAttribute('data-role', 'icon')
    this.#next.appendChild(this.#nextIcon)
    this.appendChild(this.#next)
  }
}

if (!customElements.get('ui-swiper-paddles')) customElements.define('ui-swiper-paddles', UISwiperPaddlesElement)
