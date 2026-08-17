// slider.ts — UISliderElement, the single-thumb Range-class control (range-element.lld.md · ADR-0042 · ADR-0041).
// Extends UIRangeElement which owns: the numeric value model + clamp/snap (LLD-C1), the ARIA slider
// semantics (LLD-C2), keyboard step (LLD-C3), and the --value-pct geometry seam (LLD-C5). The leaf adds:
//   • `static role = 'slider'` — confirmatory; the base sets internals.role='slider' directly in connected()
//   • connected(): tabbable (keyboard focus) + valueDrag wiring (LLD-C4, one thumb at --value-pct)
//   • slider.css — the rail (thin fill line) + thumb circle (box − 4px at --value-pct, ADR-0041 cl.3),
//     plus the GH #1141 `layout` grid (label / rail / value placement)
//   • self-define as ui-slider
//
// All props (value / min / max / step / size / name / disabled / required / label / layout) are inherited
// via the UIRangeElement.props spread — label/layout landed on the shared base in GH #1141 (range-element.
// lld.md's amendment) so both Range leaves get them identically. Zero-dep; controls → dom+traits inward
// only (✓); erasableSyntaxOnly ✓.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIRangeElement } from '../_base/range-element.ts'
import { tabbable } from '../../traits/tabbable.ts'
import { valueDrag } from '../../traits/value-drag.ts'

// All props are inherited from UIRangeElement — spread into a local constant so UISliderElement
// carries its OWN static props (ADR-0013: static props cannot be inherited via the prototype chain;
// the spread is the documented workaround, matching how UICheckboxElement spreads UIIndicatorElement.props).
const sliderProps = {
  ...UIRangeElement.props,
  // GH #1136 — the value readout's opt-out. Bare participle (naming.md §3: booleans are bare
  // adjectives/participles, never a verb) describing the state when true; default false keeps the
  // #1126 default-on behaviour byte-identical. Multi-word → explicit kebab `attribute:` (naming.md §3,
  // the iconOnly/viewTransitions precedent). GH #1141 widens its meaning: it now hides the AT-REST value
  // part too (the transient scrub-only overlay it originally guarded no longer exists — Ruling 2).
  readoutHidden: { ...prop.boolean(false), reflect: true, attribute: 'readout-hidden' },
} satisfies PropsSchema

export interface UISliderElement extends ReactiveProps<typeof sliderProps> {}
export class UISliderElement extends UIRangeElement {
  static props = sliderProps

  // LLD-C2 subclass contract: the role this leaf carries. The base hardcodes `this.internals.role =
  // 'slider'` in connected() rather than reading a static field, so this declaration is confirmatory.
  static role = 'slider'

  // Connection-scoped valueDrag cleanup — re-assigned on each reconnect (connected() re-runs).
  // Protected so test probes can call it directly to verify idempotent release (G6 DoD, decomp S1).
  protected _releaseDrag: (() => void) = () => {}

  // GH #1141 — the light-DOM structure the `layout` prop positions: a label part, the interactive RAIL
  // (its own real element now — see below), and the value part. Built once (idempotent across reconnect —
  // the text-field/field part-creation precedent).
  #labelEl: HTMLElement | undefined
  #railEl: HTMLElement | undefined
  #valueEl: HTMLElement | undefined

  /** Build the light-DOM structure once (no-op on reconnect — the fields are already set). */
  #buildDOM(): void {
    if (this.#railEl) return

    // GH #1141 — the label part: a visible DUPLICATE of `internals.ariaLabel` (range-element.ts), so
    // `aria-hidden` (same reasoning as the value part below — never double an announcement already made
    // via ElementInternals). `[hidden]` toggles off the label prop being empty — an `auto`-sized grid
    // row collapses to zero when its only child is `display:none` (slider.css), so an empty label reserves
    // no space in any layout, matching Ruling 3's "renders solely when a label source exists".
    const label = document.createElement('span')
    label.setAttribute('data-part', 'label')
    label.setAttribute('aria-hidden', 'true')
    this.#labelEl = label

    // GH #1141 — the RAIL: previously the whole host WAS the rail (the pre-#1141 shape had no label/value
    // rows to make room for). Now that `layout` can place a label row above / a value row below, the rail
    // must be its OWN element — both because valueDrag's `track()` needs a rect scoped to the rail alone
    // (a label/value press must NOT register as a drag; `value-drag.ts`'s `track.contains(target)` guard
    // is what enforces this) and because the rail/thumb pseudo-elements (slider.css) now paint on `.rail`,
    // not `:scope`. Matches `ui-slider-multi`'s existing real-`.rail`-div architecture (this control was
    // the outlier; it now converges on the same shape).
    const rail = document.createElement('div')
    rail.className = 'rail'
    this.#railEl = rail

    // GH #1126 (superseded design, GH #1141 Ruling 2) — the value part. Every `layout` member provides a
    // resting slot for it (Ruling 2), so — unlike the pre-#1141 transient overlay — it is always visible
    // at rest; `readoutHidden` (GH #1136) now hides the AT-REST value too, not just the scrub-time one.
    const value = document.createElement('span')
    value.setAttribute('data-part', 'value')
    value.setAttribute('aria-hidden', 'true')
    this.#valueEl = value

    this.append(label, rail, value)
  }

  protected override connected(): void {
    super.connected() // base: normaliser · ARIA (ariaValueNow/Min/Max/ariaLabel) · --value-pct seam · keyboard step

    this.#buildDOM()

    // Keyboard-focusable while enabled; removed from the tab order while disabled (ADR-0010).
    tabbable(this, { disabled: () => this.effectiveDisabled() })

    // GH #1141 — label text + visibility. `hidden` when the label prop is empty (no label source ⇒ the
    // part renders nothing, and its `auto` grid row collapses — slider.css).
    this.effect(() => {
      if (!this.#labelEl) return
      this.#labelEl.textContent = this.label ?? ''
      this.#labelEl.hidden = !this.label
    })

    // GH #1141 (supersedes GH #1126's transient arm/hide) — the value part's text stays in sync with the
    // (already-normalised) value on every value/min/max/step change, and its visibility is now a PURE
    // function of `readoutHidden` (GH #1136) — always visible at rest, live during scrub, no timer.
    this.effect(() => {
      if (!this.#valueEl) return
      this.#valueEl.textContent = this.valueText(this.value ?? 0)
      this.#valueEl.hidden = this.readoutHidden
    })

    // LLD-C4: wire the pointer→value gesture controller against the RAIL (not the host — GH #1141 grew
    // real label/value siblings the drag must never trigger from; `value-drag.ts`'s own `track.contains`
    // guard already ignores presses outside the track element it is given).
    this._releaseDrag = valueDrag(this, {
      track: () => this.#railEl ?? null,
      min: () => this.min ?? 0,
      max: () => this.max ?? 100,
      step: () => this.step ?? 1,
      onValue: (v) => {
        if (!Object.is(v, this.value ?? 0)) {
          this.value = v
          this.emit('input')
        }
      },
    })
  }

  protected override disconnected(): void {
    // Explicitly release the valueDrag binding so its closure is marked released — the slider-multi
    // shape, adopted here by the TKT-0068 item 1 ruling (the connection AbortController removes the
    // outer pointerdown listener, but `released = true` is a belt-and-suspenders guard against any
    // edge case where the outer listener fires after abort). Idempotent: releasing twice is a no-op.
    this._releaseDrag()
    this._releaseDrag = () => {}
  }
}

if (!customElements.get('ui-slider')) customElements.define('ui-slider', UISliderElement)
