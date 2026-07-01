// switch.ts — UISwitchElement, the FACE switch control (goals.md §G6 / indicator-element.lld.md LLD-C4).
// BEHAVIOUR + self-define ONLY — the base UIIndicatorElement owns everything: the boolean form value
// (checked/value props + formValue()), the state machine + ARIA (ariaChecked, :state(checked),
// tabbable/disabled), and the pressActivation toggle (click/Space toggles; Enter does NOT — platform parity).
//
// This leaf adds ONLY: `static role = 'switch'` (LLD-C2 — internals.role set from it in connected()), the
// pill-track + 2px-inset thumb geometry in switch.css (LLD-C4), and the contract in switch.md.
// Boolean only (no indeterminate — a switch is ON/OFF; the base's `indeterminate` property is not used
// here and no CSS paints an indeterminate state). Optional label slot (light-DOM, anatomy ADR-0006).
//
// Layer: controls/ — imports only controls/_base/ (inward-only ✓: controls ← traits ← dom ← reactive).

import { UIIndicatorElement } from '../_base/index.ts'

export class UISwitchElement extends UIIndicatorElement {
  /** LLD-C2: ARIA role for the switch widget — UIIndicatorElement.connected() sets internals.role from this. */
  static override role = 'switch'
}

if (!customElements.get('ui-switch')) customElements.define('ui-switch', UISwitchElement)
