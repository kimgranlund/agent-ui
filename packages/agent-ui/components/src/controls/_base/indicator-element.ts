// indicator-element.ts — UIIndicatorElement, the shared base for the Indicator class
// (ui-checkbox · ui-switch · ui-radio). indicator-element.lld.md.
//
// Owns: the boolean form value (LLD-C1), the checked-state machine + ARIA (LLD-C2), the toggle via
// pressActivation + click (LLD-C3), and the widget-box geometry seam (LLD-C4, CSS in the subclass).
// The subclass declares `static role` (LLD-C2), the glyph in its `.css` (LLD-C4), and (radio) the
// group wiring via `grouped()` (LLD-C5).
//
// Layer: controls/_base/ — imports dom + traits (inward-only ✓).
// Inward-only ✓ (controls ← traits ← dom ← reactive).

import { signal } from '../../reactive/index.ts'
import { UIFormElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import type { FormValue } from '../../dom/index.ts'
import { tabbable } from '../../traits/tabbable.ts'
import { pressActivation } from '../../traits/press-activation.ts'

const indicatorProps = {
  ...UIFormElement.formProps,
  // LLD-C1: the boolean form value; reflected so `[checked]` drives CSS + is observable as an attribute.
  checked: { ...prop.boolean(false), reflect: true },
  // LLD-C1: the submitted string when checked (HTML checkbox semantics, default 'on'); reflected.
  value: { ...prop.string('on'), reflect: true },
} satisfies PropsSchema

export interface UIIndicatorElement extends ReactiveProps<typeof indicatorProps> {}
export class UIIndicatorElement extends UIFormElement {
  static props = indicatorProps

  /**
   * The ARIA role this indicator carries — declared by each leaf subclass (LLD-C2).
   * `'checkbox'` / `'switch'` / `'radio'`; the base sets `internals.role` from it in `connected()`.
   */
  static role: string = ''

  // LLD-C1: indeterminate is property-only (NOT reflected, NOT submitted). Visual override only:
  // `ariaChecked="mixed"` when true; `checked` retains its boolean for the form value.
  // Backed by a private signal so the checked-state effect (LLD-C2) re-runs on every change.
  #indeterminate = signal(false)

  get indeterminate(): boolean {
    return this.#indeterminate.value
  }
  set indeterminate(v: boolean) {
    this.#indeterminate.value = v
  }

  // LLD-C3: suppress the next click when it originated from an Enter keydown.
  // Platform parity: Enter does NOT toggle a checkbox; but pressActivation fires host.click() on Enter,
  // so a keydown guard registered BEFORE pressActivation marks the pending Enter-click for suppression.
  #suppressNextClick = false

  /**
   * LLD-C1: platform checkbox semantics — unchecked submits nothing; checked submits `this.value`.
   * `indeterminate` does not affect the submitted value (only the visual `ariaChecked="mixed"`).
   */
  protected override formValue(): FormValue {
    return this.checked ? this.value : null
  }

  protected connected(): void {
    const ctor = this.constructor as typeof UIIndicatorElement

    // LLD-C2: set the ARIA role from the subclass's static declaration. Never a host attribute (FACE).
    this.internals.role = ctor.role

    // LLD-C3: tabbable — tabindex=0 while enabled, removed from the tab order while disabled (ADR-0010).
    tabbable(this, { disabled: () => this.effectiveDisabled() })

    // LLD-C3: Enter suppressor — must register BEFORE pressActivation so this keydown handler runs
    // first. pressActivation fires host.click() on Enter keydown; that synthetic click is suppressed
    // in the click handler below. Disabled-guarded: pressActivation also early-returns while disabled,
    // so a disabled-Enter must not arm the flag (else the next enabled mouse-click would be swallowed).
    this.listen(this, 'keydown', (event) => {
      if (!this.effectiveDisabled() && (event as KeyboardEvent).key === 'Enter') {
        this.#suppressNextClick = true
      }
    })

    // LLD-C3: pressActivation — Space activates on keyup; Enter fires host.click() (suppressed below).
    pressActivation(this, { disabled: () => this.effectiveDisabled() })

    // LLD-C3: click → toggle checked (mouse clicks + Space-activated synthetic clicks; Enter suppressed).
    // Platform parity: clicking an indeterminate checkbox clears `indeterminate`, then toggles `checked`.
    this.listen(this, 'click', () => {
      if (this.#suppressNextClick) {
        this.#suppressNextClick = false
        return // Enter-click: no toggle (platform checkbox parity)
      }
      if (this.effectiveDisabled()) return
      if (this.indeterminate) this.indeterminate = false
      this.checked = !this.checked
      this.emit('input')
      this.emit('change')
    })

    // LLD-C2: checked-state effect — reactive on `checked` + `#indeterminate`, publishes:
    //   · custom states :state(checked) / :state(indeterminate) (CustomStateSet, absent in jsdom)
    //   · internals.ariaChecked ("true" / "false" / "mixed") — the jsdom-accessible ARIA proxy.
    // `indeterminate` overrides: when true, ariaChecked="mixed" even when checked=true (platform parity).
    this.effect(() => {
      const checked = this.checked
      const indeterminate = this.#indeterminate.value
      const states = this.internals.states // CustomStateSet; absent in jsdom (optional-chained below)
      if (indeterminate) {
        states?.add('indeterminate')
        states?.delete('checked')
        this.internals.ariaChecked = 'mixed'
      } else if (checked) {
        states?.add('checked')
        states?.delete('indeterminate')
        this.internals.ariaChecked = 'true'
      } else {
        states?.delete('checked')
        states?.delete('indeterminate')
        this.internals.ariaChecked = 'false'
      }
    })

    // LLD-C3: ariaDisabled mirrors effectiveDisabled() — reactive, scope-owned (same form as button.ts).
    this.effect(() => {
      this.internals.ariaDisabled = this.effectiveDisabled() ? 'true' : null
    })

    // LLD-C5: delegate to the subclass's group wiring (radio overrides; checkbox/switch leave it no-op).
    this.grouped()
  }

  /**
   * LLD-C5: grouping hook — the radio subclass overrides this to wire roving-focus + exclusive
   * selection within a name-scoped group. Called from `connected()` after all base wiring is in place.
   * Checkbox/switch leave it a no-op.
   */
  protected grouped(): void {}
}
