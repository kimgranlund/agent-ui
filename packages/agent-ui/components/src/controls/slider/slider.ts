// slider.ts — UISliderElement, the single-thumb Range-class control (range-element.lld.md · ADR-0042 · ADR-0041).
// Extends UIRangeElement which owns: the numeric value model + clamp/snap (LLD-C1), the ARIA slider
// semantics (LLD-C2), keyboard step (LLD-C3), and the --value-pct geometry seam (LLD-C5). The leaf adds:
//   • `static role = 'slider'` — confirmatory; the base sets internals.role='slider' directly in connected()
//   • connected(): tabbable (keyboard focus) + valueDrag wiring (LLD-C4, one thumb at --value-pct)
//   • slider.css — the rail (thin fill line) + thumb circle (box − 4px at --value-pct, ADR-0041 cl.3)
//   • self-define as ui-slider
//
// All props (value / min / max / step / size / name / disabled / required) are inherited via the
// UIRangeElement.props spread. Zero-dep; controls → dom+traits inward only (✓); erasableSyntaxOnly ✓.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIRangeElement, RANGE_READOUT_HIDE_MS } from '../_base/range-element.ts'
import { tabbable } from '../../traits/tabbable.ts'
import { valueDrag } from '../../traits/value-drag.ts'

// All props are inherited from UIRangeElement — spread into a local constant so UISliderElement
// carries its OWN static props (ADR-0013: static props cannot be inherited via the prototype chain;
// the spread is the documented workaround, matching how UICheckboxElement spreads UIIndicatorElement.props).
const sliderProps = {
  ...UIRangeElement.props,
  // GH #1136 — the GH #1126 readout's opt-out. Bare participle (naming.md §3: booleans are bare
  // adjectives/participles, never a verb) describing the state when true; default false keeps the
  // #1126 default-on behaviour byte-identical. Multi-word → explicit kebab `attribute:` (naming.md §3,
  // the iconOnly/viewTransitions precedent).
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

  // GH #1126 — the live value readout (design choice: label-end STATIC overlay, not a thumb-following
  // bubble; see slider.md "Value readout" + the Findings posted on the issue). A light-DOM child, built
  // once (idempotent across reconnect — the text-field/field part-creation precedent), `position:absolute`
  // in slider.css so toggling `[hidden]` never reflows the rail/thumb or the page around it. `aria-hidden`
  // — purely a SIGHTED convenience; `internals.ariaValueText` (range-element.ts) already carries the one
  // AT-facing announcement, so this never doubles it.
  #valueEl: HTMLElement | undefined
  #hideTimer: ReturnType<typeof setTimeout> | undefined

  protected override connected(): void {
    super.connected() // base: normaliser · ARIA (ariaValueNow/Min/Max) · --value-pct seam · keyboard step

    // Keyboard-focusable while enabled; removed from the tab order while disabled (ADR-0010).
    tabbable(this, { disabled: () => this.effectiveDisabled() })

    // GH #1126: build the readout part lazily, then keep its text in sync with the (already-normalised —
    // the base's own normaliser effect above ran first) value on every value/min/max/step change. Visibility
    // is driven separately (below) by the interaction itself, not by this effect — the text stays fresh
    // even while hidden, so it never shows a stale number the instant it reappears.
    this.effect(() => {
      if (!this.#valueEl) {
        const el = document.createElement('span')
        el.setAttribute('data-part', 'value')
        el.setAttribute('aria-hidden', 'true')
        el.hidden = true
        this.append(el)
        this.#valueEl = el
      }
      this.#valueEl.textContent = this.valueText(this.value ?? 0)
    })

    // GH #1126: `input` fires on EVERY live change from BOTH sources (keyboard step — the base's own
    // keydown listener above — and pointer drag — this leaf's valueDrag onValue below), so one listener
    // here covers both without duplicating either interaction's detection logic. Each firing re-arms the
    // hide timer, so the readout stays visible for the whole drag/step run and fades RANGE_READOUT_HIDE_MS
    // after the LAST change. `blur` hides immediately (defensive — the timer would also catch it).
    this.listen(this, 'input', () => this.#armReadout())
    this.listen(this, 'blur', () => this.#hideReadoutNow())

    // LLD-C4: wire the pointer→value gesture controller. The host IS the interactive track surface
    // (light-DOM — no child track element); opts.track() is re-read on each pointerdown so reconnect
    // always resolves the live element. Emits `input` on each stepped value change; `change` is emitted
    // by the base on blur when value has moved since focus (the base's commit-on-blur contract).
    this._releaseDrag = valueDrag(this, {
      track: () => this,
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

    // GH #1126: drop any pending hide timer — zero-residue (C10): a live timer surviving disconnect
    // would still fire ~1.2s later and touch a detached node; clearing here bounds its lifetime to the
    // connection, matching every other cleanup in this method.
    if (this.#hideTimer !== undefined) {
      clearTimeout(this.#hideTimer)
      this.#hideTimer = undefined
    }
    // …and hide the readout itself: a disconnect mid-scrub (timer cleared, hidden=false) would otherwise
    // reconnect stuck-visible until the next input (component-checker finding, GH #1126).
    if (this.#valueEl) this.#valueEl.hidden = true
  }

  /** GH #1126: show the readout and (re)arm its auto-hide timer — called on every live `input`.
   *  GH #1136: `readoutHidden` guards this ONE call site — the readout never shows while set,
   *  regardless of interaction source (keyboard step or pointer drag both funnel through here). */
  #armReadout(): void {
    if (!this.#valueEl || this.readoutHidden) return
    this.#valueEl.hidden = false
    if (this.#hideTimer !== undefined) clearTimeout(this.#hideTimer)
    this.#hideTimer = setTimeout(() => {
      if (this.#valueEl) this.#valueEl.hidden = true
      this.#hideTimer = undefined
    }, RANGE_READOUT_HIDE_MS)
  }

  /** GH #1126: hide the readout immediately (blur) and cancel any pending timer. */
  #hideReadoutNow(): void {
    if (this.#hideTimer !== undefined) {
      clearTimeout(this.#hideTimer)
      this.#hideTimer = undefined
    }
    if (this.#valueEl) this.#valueEl.hidden = true
  }
}

if (!customElements.get('ui-slider')) customElements.define('ui-slider', UISliderElement)
