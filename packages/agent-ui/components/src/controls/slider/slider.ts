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

import { type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIRangeElement } from '../_base/range-element.ts'
import { tabbable } from '../../traits/tabbable.ts'
import { valueDrag } from '../../traits/value-drag.ts'

// All props are inherited from UIRangeElement — spread into a local constant so UISliderElement
// carries its OWN static props (ADR-0013: static props cannot be inherited via the prototype chain;
// the spread is the documented workaround, matching how UICheckboxElement spreads UIIndicatorElement.props).
const sliderProps = {
  ...UIRangeElement.props,
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

  protected override connected(): void {
    super.connected() // base: normaliser · ARIA (ariaValueNow/Min/Max) · --value-pct seam · keyboard step

    // Keyboard-focusable while enabled; removed from the tab order while disabled (ADR-0010).
    tabbable(this, { disabled: () => this.effectiveDisabled() })

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
  }
}

if (!customElements.get('ui-slider')) customElements.define('ui-slider', UISliderElement)
