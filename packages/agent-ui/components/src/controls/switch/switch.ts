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

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIIndicatorElement } from '../_base/index.ts'

const switchProps = {
  ...UIIndicatorElement.props,
  // ADR-0196 (GH #1065) — the answered/settled choice state. The CONSUMING surface (e.g. an A2UI
  // questionnaire card) sets this after submit; the effect below mirrors it into `:state(answered)`
  // (presentation-only — never AX-reflected, never disabled/readonly).
  answered: prop.boolean(false),

  // ADR-0223 (Fill by Default, slice 2) — the ONE sizing opt-out, fleet-shared name: reflects so the
  // `:scope[inline]` CSS leg (inline-level display + hug posture) applies to JS-set values.
  inline: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UISwitchElement extends ReactiveProps<typeof switchProps> {}
export class UISwitchElement extends UIIndicatorElement {
  static props = switchProps

  /** LLD-C2: ARIA role for the switch widget — UIIndicatorElement.connected() sets internals.role from this. */
  static override role = 'switch'

  protected override connected(): void {
    super.connected()
    // ADR-0196 — mirror `answered` into `:state(answered)` (optional-chained: jsdom may lack
    // CustomStateSet). Presentation-only; never touches disabled/tabindex/ARIA.
    this.effect(() => {
      if (this.answered) this.internals.states?.add('answered')
      else this.internals.states?.delete('answered')
    })
  }
}

if (!customElements.get('ui-switch')) customElements.define('ui-switch', UISwitchElement)
