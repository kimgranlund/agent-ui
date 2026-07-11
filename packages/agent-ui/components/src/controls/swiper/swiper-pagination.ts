// swiper-pagination.ts — UISwiperPaginationElement, the dots/fraction anchor of the ui-swiper family
// (swiper-family.lld.md LLD-C9 · swiper-family.spec.md SPEC-R12 · ADR-0124 F3). BEHAVIOUR + the coordinator-
// driven `renderInto` seam + self-define ONLY; geometry lives in swiper.css, the public contract in
// swiper-pagination.md.
//
// An author-placed ANCHOR the owning `ui-swiper` fills and wires (`#driveChrome`, swiper.ts) — this element
// holds no slide/active state of its own; it is a pure render target the coordinator commands. `type=dots`
// renders one real `<button>` indicator per REAL slide (native buttons are keyboard-operable — Enter/Space —
// for free, no roving-focus trait needed: each dot is its own tab stop, exactly like a native radio-less
// button group); `type=fraction` renders a single "n / realCount" text readout. The active dot is
// distinguished by `aria-current="true"` (a real ARIA fact, not a decorative class) — swiper.css keys its
// SIZE-larger treatment off that same attribute (ADR-0057: never colour alone).
//
// `renderInto` REBUILDS the dot list only when the slide COUNT changes (cheap incremental update otherwise —
// re-running on every `active` change must not thrash focus/DOM identity mid-interaction). `controls → dom` is
// the allowed import direction.

import { UIElement } from '../../dom/element.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const PAGINATION_TYPES = ['dots', 'fraction'] as const

const props = {
  type: { ...prop.enum(PAGINATION_TYPES, 'dots'), reflect: true },
} satisfies PropsSchema

export interface UISwiperPaginationElement extends ReactiveProps<typeof props> {}
export class UISwiperPaginationElement extends UIElement {
  static props = props

  #dots: HTMLButtonElement[] = []
  #fraction: HTMLElement | null = null

  /**
   * Coordinator command (swiper.ts's `#driveChrome`) — render `count` indicators (or the `'n / count'`
   * fraction) and mark `active`. `onSelect(i)` is the coordinator's `goTo` — called with the clicked dot's
   * REAL index. Idempotent: re-running with the same `count` reuses the existing dot nodes (only the
   * `aria-current`/label state updates), so a settle-time re-drive never steals focus from an operated dot.
   */
  renderInto(count: number, active: number, onSelect: (i: number) => void): void {
    if (this.type === 'fraction') {
      this.#renderFraction(count, active)
      return
    }
    this.#renderDots(count, active, onSelect)
  }

  #renderFraction(count: number, active: number): void {
    if (this.#dots.length > 0) {
      for (const dot of this.#dots) dot.remove()
      this.#dots = []
    }
    if (!this.#fraction) {
      this.#fraction = document.createElement('span')
      this.#fraction.setAttribute('data-part', 'fraction')
      this.appendChild(this.#fraction)
    }
    this.#fraction.textContent = count === 0 ? '0 / 0' : `${active + 1} / ${count}`
  }

  #renderDots(count: number, active: number, onSelect: (i: number) => void): void {
    if (this.#fraction) {
      this.#fraction.remove()
      this.#fraction = null
    }
    if (this.#dots.length !== count) {
      for (const dot of this.#dots) dot.remove()
      this.#dots = []
      for (let i = 0; i < count; i++) {
        const dot = document.createElement('button')
        dot.type = 'button'
        dot.setAttribute('data-part', 'dot')
        this.appendChild(dot)
        this.#dots.push(dot)
      }
    }
    this.#dots.forEach((dot, i) => {
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`)
      dot.setAttribute('aria-current', i === active ? 'true' : 'false')
      dot.onclick = () => onSelect(i) // reassigning .onclick replaces cleanly — no accumulation across re-drives
    })
  }
}

if (!customElements.get('ui-swiper-pagination')) customElements.define('ui-swiper-pagination', UISwiperPaginationElement)
