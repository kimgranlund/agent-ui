// toolbar.ts — UIToolbarElement, the Pattern-class action-bar control (ADR-0121; toolbar.lld.md LLD-C1..C4).
//
// A light-DOM host-as-flex container (the ui-row precedent — no named slots, the consumer's own interactive
// children ARE the flex items) that gives them `role="toolbar"` + arrow-key roving focus via the shared
// `roving-focus` trait, DECOUPLED from selection (focus-only — no `select` event, no selected state; the
// load-bearing difference from the ui-tabs reuse, ADR-0121 F3). The floating/embedded posture is expressed
// purely through the inherited `elevation`/`brightness` surface axis (ADR-0015) — no posture prop, no overlay
// machinery, no positioning of its own (ADR-0121 F1). The toolbar emits no events and owns no value — it is
// arrangement + focus semantics, not a command bus (ADR-0121 F6).
//
// Layer: controls/ — imports reactive + dom + traits (inward-only ✓).

import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'

const ORIENTATIONS = ['horizontal', 'vertical'] as const
const ALIGNS = ['start', 'center', 'end', 'stretch', 'baseline'] as const // ADR-0039 box-alignment dialect
const JUSTIFIES = ['start', 'center', 'end', 'between', 'around', 'evenly'] as const
const GAPS = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
const OVERFLOWS = ['wrap', 'scroll'] as const // F4 — the `menu` member is a fenced, additive v2

// Item discovery (LLD-C4): the toolbar's focusable interactive descendants, in DOM order, excluding disabled.
// Descendant query (not direct-child) so ui-row grouping still roves (SPEC-R4 AC3). `data-toolbar-item` is the
// explicit escape hatch for a control the button-like set misses.
const ITEM_SELECTOR = 'ui-button, button, a[href], [role="button"], [data-toolbar-item]'

const props = {
  // Surface axis (ADR-0015) — the F1 posture lever. Spread from the container base's surfaceProps so the
  // enum/default/reflect match the fleet seam ui-row/ui-card/ui-tabs share (do NOT redefine the values).
  ...UIContainerElement.surfaceProps, // elevation, brightness — enum [0,1,2,3,-1,-2,-3], default 0, reflect
  orientation: { ...prop.enum(ORIENTATIONS, 'horizontal'), reflect: true },
  align: { ...prop.enum(ALIGNS, 'center'), reflect: true }, // NOTE default 'center' (bar look), not row's 'start'
  justify: { ...prop.enum(JUSTIFIES, 'start'), reflect: true },
  gap: { ...prop.enum(GAPS, 'sm'), reflect: true }, // NOTE default 'sm' (toolbars are tight)
  overflow: { ...prop.enum(OVERFLOWS, 'wrap'), reflect: true },
  label: { ...prop.string(''), reflect: true }, // author accessible name → internals.ariaLabel
} satisfies PropsSchema

export interface UIToolbarElement extends ReactiveProps<typeof props> {}
export class UIToolbarElement extends UIContainerElement {
  static props = props

  protected connected(): void {
    // LLD-C2 — role + ARIA via internals ONLY (never a host attribute). role is static; aria reflects live.
    this.internals.role = 'toolbar'
    this.effect(() => {
      this.internals.ariaOrientation = this.orientation === 'vertical' ? 'vertical' : null
    })
    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
    })

    // LLD-C3 — roving focus, decoupled from selection: focus-only, no wrap, no type-ahead, no commit.
    // Called DIRECTLY — traits are bare calls in this fleet; there is NO host.use() (popover.ts:5 says so
    // explicitly; tabs.ts / radio-group.ts / menu.ts / select.ts / listbox-element.ts all call
    // rovingFocus(this, {…}) directly). It rides connected()'s connection AbortSignal, so it auto-releases
    // on disconnect and re-arms on reconnect. orientation is RESOLVED ONCE here as a VALUE (the trait's
    // `orientation` is a RovingOrientation read once at invoke — roving-focus.ts:100 — NOT an accessor;
    // passing a function is a type error and leaves the comparison permanently false); the radio-group.ts:
    // 120-144 precedent — connect-resolve the axis, pass the value (see §3 note + §8).
    const rovingOrientation = this.orientation === 'vertical' ? 'vertical' : 'horizontal'
    rovingFocus(this, {
      items: () => this.#items(),
      orientation: rovingOrientation,
      loop: false,
      typeAhead: false,
      // no onMove selection coupling, no syncIndex — the trait moves focus, the toolbar tracks nothing.
    })
  }

  // LLD-C4 — live descendant query, DOM order, disabled excluded (the trait re-reads this on every key event).
  #items(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
    )
  }
}

if (!customElements.get('ui-toolbar')) customElements.define('ui-toolbar', UIToolbarElement)
