// pagination.ts — UIPaginationElement, the fleet's first standalone page navigator (ADR-0163 cl.6, SPEC-R3).
// BEHAVIOUR + props + the imperative rebuild + self-define ONLY; the pure windowing math lives in
// pagination-model.ts (DOM-free, unit-testable — the table-model.ts precedent), geometry/token CSS lives in
// pagination.css.
//
// Anatomy: previous/next + a windowed page-number list with an ellipsis marker (computePageWindow, fixed
// window, no configurable knob in v1), composing a REAL `ui-button` for every stop (the swiper-paddles.ts
// precedent for a Pattern-class control stamping ui-button; `aria-label`/`aria-current` set on the composed
// child from OUTSIDE is NOT a violation of the "ARIA via internals" rule — that rule governs a control's OWN
// self-applied state, and swiper-paddles.ts's own banner states the same sanction for `aria-label`).
// `tier: pattern`, extends `UIElement` directly — NO new geometry row (cl.6: "the buttons carry their own
// geometry; the novelty is zero").
//
// `pages < 2` renders NOTHING at all (SPEC-R3's honest empty state) — no host children, no navigation
// landmark content to announce. The host role is `navigation` (ElementInternals, set once — static, like
// ui-toolbar's `role=toolbar`), named by the `label` prop via `internals.ariaLabel` (SPEC-R3's "a labelled
// navigation").
//
// Every interactive stop is a real, separately-focusable `ui-button` — normal tab order, no roving focus (the
// ADR-0163 cl.3 "no composite widget" posture, though this control isn't even a table — it simply never
// needed one: N independent buttons, not one widget with N states).
//
// Commit emits `change` with `{ page: number }` — the fleet §4 vocabulary; never fired by a programmatic
// `page`/`pages` write, only by an actual click (the fleet's commit law, `sort`/`select`'s own precedent on
// ui-table).
//
// `controls → dom` only (no traits needed — no roving focus, no overlay).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import type { UIButtonElement } from '../button/button.ts'
import { computePageWindow, ELLIPSIS } from './pagination-model.ts'

const props = {
  page: { ...prop.number(1), reflect: true }, // 1-based current page — bindable, commits via `change`
  pages: { ...prop.number(0), reflect: true }, // total page count — 0 (default) ⇒ renders nothing
  label: { ...prop.string(''), reflect: true }, // the accessible navigation-landmark NAME → internals.ariaLabel
} satisfies PropsSchema

export interface UIPaginationElement extends ReactiveProps<typeof props> {}
export class UIPaginationElement extends UIElement {
  static props = props

  protected connected(): void {
    this.internals.role = 'navigation' // ARIA via internals ONLY — never a host attribute (static, like ui-toolbar)

    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
    })

    this.effect(() => {
      this.#rebuild()
    })
  }

  /** Clamp an arbitrary `page` into the valid `[1, pages]` range (never trusts the raw prop — a bindable
   *  state prop can carry a stale/out-of-range/non-finite/`null` value; SPEC-R3's own windowing already
   *  clamps identically via `computePageWindow`). */
  #clampedPage(pages: number): number {
    const raw = this.page
    const truncated = raw !== null && Number.isFinite(raw) ? Math.trunc(raw) : 1
    const safe = truncated !== 0 ? truncated : 1
    return Math.min(Math.max(1, safe), Math.max(1, pages))
  }

  /**
   * The whole-anatomy rebuild — reads `page`/`pages`/`label` is unnecessary (`label` only feeds the internals
   * effect above), so this reads `page`/`pages` only. A full `replaceChildren` every time (the table.ts
   * whole-array-swap precedent) — cheap here (at most a handful of buttons). Preserves focus ACROSS the
   * rebuild when the click that triggered it originated inside this host: the new "active page" button is
   * the natural post-click focus target (SPEC-R4.5's focus-restoration spirit, applied to the one control
   * here that could plausibly need it — a small UX completeness the ADR does not mandate but the same
   * rebuild-loses-focus mechanics call for).
   */
  #rebuild(): void {
    const rawPages = this.pages
    const pages = Math.max(0, rawPages !== null && Number.isFinite(rawPages) ? Math.trunc(rawPages) : 0)
    if (pages < 2) {
      this.replaceChildren()
      return
    }
    const current = this.#clampedPage(pages)
    const hadFocus = this.contains(document.activeElement)

    const nodes: HTMLElement[] = []
    nodes.push(this.#stopButton('prev', 'Previous', current - 1, current <= 1, false))
    for (const item of computePageWindow(current, pages)) {
      if (item === ELLIPSIS) {
        const span = document.createElement('span')
        span.setAttribute('data-part', 'ellipsis')
        span.setAttribute('aria-hidden', 'true')
        span.textContent = '…'
        nodes.push(span)
      } else {
        nodes.push(this.#stopButton('page', String(item), item, false, item === current))
      }
    }
    nodes.push(this.#stopButton('next', 'Next', current + 1, current >= pages, false))
    this.replaceChildren(...nodes)

    if (hadFocus) {
      const active = this.querySelector<HTMLElement>('[data-part="page"][aria-current="page"]')
      active?.focus()
    }
  }

  /** One composed `ui-button` stop — `data-part` identifies prev/next/page (pagination.md); `aria-current`
   *  on the current page's button ONLY (SPEC-R3); `disabled` on an out-of-range prev/next. Click commits
   *  `target` via `#commit` unless already disabled or already the current page (a no-op click on the
   *  active page button neither writes `page` nor emits — nothing changed). */
  #stopButton(part: 'prev' | 'next' | 'page', text: string, target: number, disabled: boolean, active: boolean): UIButtonElement {
    const button = document.createElement('ui-button') as UIButtonElement
    button.setAttribute('data-part', part)
    button.setAttribute('size', 'sm')
    button.setAttribute('variant', active ? 'soft' : 'ghost')
    button.textContent = text
    if (disabled) button.setAttribute('disabled', '')
    if (part === 'prev' || part === 'next') button.setAttribute('aria-label', `${text} page`)
    if (active) button.setAttribute('aria-current', 'page')
    if (!disabled && !active) {
      this.listen(button, 'click', () => this.#commit(target))
    }
    return button
  }

  #commit(target: number): void {
    this.page = target
    this.emit('change', { page: target })
  }
}

if (!customElements.get('ui-pagination')) customElements.define('ui-pagination', UIPaginationElement)
