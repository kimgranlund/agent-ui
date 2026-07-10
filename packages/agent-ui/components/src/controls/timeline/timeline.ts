// timeline.ts — UITimelineElement, the timeline family's DURABLE host (timeline-family.lld.md §3 ·
// SPEC-R6/R7 · ADR-0122 F1/F2/F6). BEHAVIOUR + props + the terminal-connector marking + self-define ONLY.
// Anatomy/geometry per the LLD; styling lives in timeline.css, the public contract in timeline.md.
//
// Authored-children ingress, DOM order, NO auto-sort (the adia rule) — the consumer's `ui-timeline-item`
// light-DOM children are the chronology, read back in the order authored. `internals.role = 'list'` (the
// `ui-list` precedent — list.ts:50), never a host `role` attribute; items are `role="listitem"` (their
// own contract). STATIC — no imperative append/update/finalize API, no MutationObserver tail-follow, no
// live-region role: the negative control separating this from `ui-status-stream` (SPEC-R6 AC3). The ONE
// observer this host owns re-marks the terminal item's connector suppressed (`data-last`) whenever the
// child list changes — the `ui-toast-region` childList-observer precedent (toast-region.ts:55-57),
// repurposed for a STRUCTURAL fact (which item is last), not liveness.
//
// `controls → dom + controls/timeline-item/timeline-item.ts` — the allowed import direction (cross-folder
// sibling, the toast→button precedent direction).

import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import '../timeline-item/timeline-item.ts' // registers the item child (the cross-folder sibling edge — the LLD's './timeline-item.ts' is a typo for this path, since timeline-item/ is a SIBLING folder per §1's layout, not nested under timeline/)

const SIZE = ['sm', 'md', 'lg'] as const
const props = {
  size: { ...prop.enum(SIZE, 'md'), reflect: true }, // first-class geometry (F2); NO variant/data/orientation prop in v1
  label: { ...prop.string(''), reflect: true }, // author accessible name → internals.ariaLabel (the toolbar.ts precedent)
} satisfies PropsSchema

export interface UITimelineElement extends ReactiveProps<typeof props> {}
export class UITimelineElement extends UIContainerElement {
  static props = props // deliberately does NOT spread surfaceProps/flexProps — a timeline owns no elevation axis

  #observer: MutationObserver | null = null

  constructor() {
    super()
    this.internals.role = 'list' // role VALUE = the ui-list precedent (list.ts:50); constructor PLACEMENT
    // (semantics before insertion) = the toast precedent (toast.ts:68)
  }

  protected connected(): void {
    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
    })
    this.#markLastItem() // seed from any children already present (declarative markup)
    this.#observer = new MutationObserver(() => this.#markLastItem())
    this.#observer.observe(this, { childList: true })
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  /** Clear `data-last` on every authored item, then set it on the last — the CSS suppresses that item's
   *  own terminal connector (SPEC-R6 AC2). Re-run on every childList mutation so a late-appended durable
   *  item re-marks the terminal correctly (the toast-region observer precedent). */
  #markLastItem(): void {
    const items = this.querySelectorAll(':scope > ui-timeline-item')
    items.forEach((item, i) => item.toggleAttribute('data-last', i === items.length - 1))
  }
}

if (!customElements.get('ui-timeline')) customElements.define('ui-timeline', UITimelineElement)
