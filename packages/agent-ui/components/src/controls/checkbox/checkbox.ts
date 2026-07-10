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
import type { ValidityResult } from '../../dom/index.ts'
import { UIIndicatorElement } from '../_base/indicator-element.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'

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

  // The user-invalid TIMING controller (ADR-0051), created per connection (re-arms on reconnect;
  // released on disconnect) — the text-field/select precedent.
  #userInvalid: TrackUserInvalidController | null = null

  /**
   * LLD-C1 extension: `required && !checked` → `valueMissing` (native `<input type=checkbox required>`
   * parity — unlike ui-switch, whose required-ON semantics the fleet deliberately declined as an
   * edge case, checkbox.md has always documented this constraint; this is the code catching up to
   * that contract). `indeterminate` does not affect validity — a required checkbox is satisfied
   * only by `checked=true`, matching the platform.
   */
  protected override formValidity(): ValidityResult {
    if (this.required && !this.checked) {
      return { valid: false, flags: { valueMissing: true }, message: 'Please check this box if you want to proceed.' }
    }
    return { valid: true }
  }

  protected override connected(): void {
    super.connected() // base wires: role · tabbable · Enter-guard · pressActivation · click-toggle ·
    //                             checked effect (ariaChecked="true"/"false", :state(checked)) · ariaDisabled

    // ADR-0051 — the user-invalid TIMING controller: gates the danger treatment until the first
    // blur/change (host itself is the focusable element — the tabbable trait's tabindex rides the
    // host directly, no internal part). Reflects :state(user-invalid) + internals.ariaInvalid.
    const invalidController = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = invalidController
    this.effect(() => {
      if (invalidController.userInvalid()) {
        this.internals.states?.add('user-invalid')
        this.internals.ariaInvalid = 'true'
      } else {
        this.internals.states?.delete('user-invalid')
        this.internals.ariaInvalid = null
      }
    })

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

  /**
   * A reset must not leave a required-unchecked checkbox showing `:state(user-invalid)` until the
   * user re-interacts (the text-field `formReset()` precedent) — `super.formReset()` restores
   * `checked` ← `defaultChecked` (the base's own reset leg) first.
   */
  protected override formReset(): void {
    super.formReset()
    this.#userInvalid?.reset()
  }

  protected override disconnected(): void {
    this.#userInvalid?.release() // idempotent — the listeners already die with the connection scope
    this.#userInvalid = null
  }

  /** Feeds `FormConnectDetail.userInvalid` (ADR-0050) — the `trackUserInvalid` tracker IS the one
   *  timing source; this override just exposes its gate. */
  protected override formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }
}

if (!customElements.get('ui-checkbox')) customElements.define('ui-checkbox', UICheckboxElement)
