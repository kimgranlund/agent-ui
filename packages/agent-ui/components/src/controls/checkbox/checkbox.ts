// checkbox.ts — UICheckboxElement, the Indicator-class tri-state checkbox (decomp S1 · ADR-0042 · ADR-0041).
// Light-DOM FACE form control — extends UIIndicatorElement which owns: the boolean form value (checked /
// value / size props), the checked-state machine + ARIA (LLD-C2), the pressActivation toggle (LLD-C3),
// and the widget-box geometry seam (LLD-C4). The leaf adds:
//   • static role = 'checkbox' (sets internals.role on connect via the base's LLD-C2 wiring)
//   • `indeterminate` property (property-only, NOT reflected, NOT submitted) — tri-state visual override:
//     ariaChecked="mixed" + :state(indeterminate) when true; cleared on the next click/Space toggle.
//   • self-define as `ui-checkbox`
//
// `size` is now in UIIndicatorElement.props (the shared widget-box axis — ADR-0041); checkbox inherits it
// via the base-props spread without a local override.
//
// No light-DOM parts: the box and glyph paint entirely in CSS via ::before/::after on the host.
// Zero-dep; controls → dom+traits inward only (✓); erasableSyntaxOnly ✓ (no enum/decorator).

import { signal } from '../../reactive/index.ts'
import { type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIIndicatorElement } from '../_base/indicator-element.ts'

// `size` is inherited from UIIndicatorElement.props — the spread brings checked/value/size/name/disabled/
// required. No local additions. Each control owns its own `static props` (the UIFormElement.formProps
// precedent; ADR-0013 — static props cannot be inherited via the prototype chain).
const checkboxProps = {
  ...UIIndicatorElement.props,
} satisfies PropsSchema

export interface UICheckboxElement extends ReactiveProps<typeof checkboxProps> {}
export class UICheckboxElement extends UIIndicatorElement {
  static props = checkboxProps

  // LLD-C2 contract: the subclass declares the ARIA role; the base applies it via internals.role in connected().
  static role = 'checkbox'

  // `indeterminate` — property-only (NOT reflected, NOT submitted; checkbox-specific tri-state).
  // Visual override: `ariaChecked="mixed"` when true; `checked` retains its boolean for the form value.
  // Backed by a private signal so the supplemental indeterminate effect (below) re-runs on every change.
  #indeterminate = signal(false)

  get indeterminate(): boolean {
    return this.#indeterminate.value
  }
  set indeterminate(v: boolean) {
    this.#indeterminate.value = v
  }

  protected override connected(): void {
    super.connected() // base wires: role · tabbable · Enter-guard · pressActivation · click-toggle ·
    //                             checked effect (ariaChecked="true"/"false", :state(checked)) · ariaDisabled

    // Supplemental indeterminate effect — runs AFTER the base's checked effect (registered second).
    // Reads BOTH #indeterminate AND checked so it tracks both signals and wins on any change to either.
    // When indeterminate=true: overrides ariaChecked to "mixed", adds :state(indeterminate), removes
    // :state(checked). When indeterminate=false: restores the correct checked state (the base effect
    // may not re-run for an indeterminate→false transition alone, so we re-apply here).
    this.effect(() => {
      const indeterminate = this.#indeterminate.value // tracked
      const checked = this.checked                     // also tracked — ensures re-run on checked change too
      const states = this.internals.states
      if (indeterminate) {
        states?.add('indeterminate')
        states?.delete('checked')
        this.internals.ariaChecked = 'mixed'
      } else {
        states?.delete('indeterminate')
        if (checked) {
          states?.add('checked')
          this.internals.ariaChecked = 'true'
        } else {
          states?.delete('checked')
          this.internals.ariaChecked = 'false'
        }
      }
    })
  }

  /**
   * Pre-toggle hook (LLD-C3): called by the base's click handler immediately before `checked` is flipped.
   * Clears `indeterminate` so clicking an indeterminate checkbox first resolves the visual state and THEN
   * toggles checked — platform checkbox parity (a click on ☐/☑/dash always produces ☑, never stays
   * mixed on click; the next click is then ☑→☐).
   */
  protected override beforeToggle(): void {
    if (this.#indeterminate.value) this.#indeterminate.value = false
  }
}

if (!customElements.get('ui-checkbox')) customElements.define('ui-checkbox', UICheckboxElement)
