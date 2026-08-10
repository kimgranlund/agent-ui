// toggle.ts — UIToggleElement, the fleet pressed-state pill button (ADR-0179 GH #686 Amendment S7-a,
// admin-three-pane-ia.lld.md §16). BEHAVIOUR + props + role + self-define ONLY.
//
// Content model — host-as-grid (ADR-0006), the button.ts precedent minus its position/role split: `render()`
// stays the inherited no-op (no template; there is nothing to commit) — the light-DOM `icon`/default-`label`/
// `state-icon` slots are placed entirely by toggle.css's `:has()` grid (see toggle.md's Slots section for why
// these three are named by FIXED role, not position, unlike ui-button's leading/trailing).
//
// ARIA: `role="button"` + `aria-pressed` via `ElementInternals` — never a host attribute (FACE). NOT
// form-associated (extends UIElement, not UIFormElement/UIIndicatorElement): a toggle-button pattern
// (aria-pressed), not a checkbox/switch boolean-form-value pattern — the amendment's own ruling (ADR-0179 GH
// #686: "ui-switch is a track-and-thumb FORM control... ui-button carries no pressed state").
//
// The refused-toggle design (toggle.md's own "Refused toggle" section is the load-bearing citation): `toggle`
// fires BEFORE `pressed` commits, via the base `emit()` seam — already `cancelable: true` by construction
// (dom/element.ts). A listener calling `event.preventDefault()` refuses the press: `pressed` is left
// untouched (a true no-op, zero paint to revert — not a flip-then-revert). This reproduces the platform
// `<input type=checkbox>` click-then-commit shape on the fleet's OWN `toggle` vocabulary member (naming.md
// §4's closed seven), rather than minting a second `beforetoggle`-shaped event (out of this slice's scope —
// widening the closed set is an ADR-level decision).
//
// Keyboard: Space AND Enter both activate (pressActivation, unmodified) — native `<button aria-pressed>`
// parity. Unlike the Indicator class (checkbox/switch/radio), Enter is NOT suppressed here: role="button", not
// role="checkbox"/"switch", so both platform activation keys apply (the ui-button precedent, not the
// UIIndicatorElement one).
//
// Layer: controls/ — imports only dom + traits (inward-only ✓: controls ← traits ← dom ← reactive).

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { pressActivation } from '../../traits/press-activation.ts'
import { tabbable } from '../../traits/tabbable.ts'
// Generated from toggle.md's `attributes[]` (ADR-0173) — `node scripts/generate-props.mjs toggle` to
// regenerate; never hand-edit toggle.props.gen.ts. The fleet drift gate
// (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical.
import { props } from './toggle.props.gen.ts'

export interface UIToggleElement extends ReactiveProps<typeof props> {}
export class UIToggleElement extends UIElement {
  static props = props

  protected connected(): void {
    this.internals.role = 'button' // ARIA via internals — never a host role/aria-* attribute
    tabbable(this, { disabled: () => this.disabled }) // tabindex=0 enabled / out of tab order disabled (ADR-0010)
    pressActivation(this, { disabled: () => this.disabled }) // Space/Enter → click; auto-cleans on disconnect

    // Press → toggle. `click` fires from both a real pointer click AND pressActivation's synthetic
    // host.click() (Space keyup / Enter keydown) — one handler covers every activation path, the button.ts
    // shape. `toggle` fires BEFORE the commit (the refused-toggle design, toggle.md); `emit()` is cancelable
    // by construction (dom/element.ts) and returns false when a listener called preventDefault().
    this.listen(this, 'click', () => {
      if (this.disabled) return
      const proceeded = this.emit('toggle')
      if (proceeded) this.pressed = !this.pressed
      // else: refused — a true no-op, `pressed` stays exactly where it was (no flip-then-revert flicker).
    })

    // pressed effect — reactive on `pressed`, publishes:
    //   · internals.ariaPressed ("true" / "false") — the jsdom-accessible ARIA proxy.
    //   · custom state :state(pressed) (CustomStateSet, absent in jsdom — [pressed] reflection covers CSS there).
    this.effect(() => {
      const pressed = this.pressed
      this.internals.ariaPressed = pressed ? 'true' : 'false'
      const states = this.internals.states // optional-chained: absent in jsdom
      if (pressed) states?.add('pressed')
      else states?.delete('pressed')
    })

    // ariaDisabled mirrors `disabled` — reactive, scope-owned (the button.ts precedent).
    this.effect(() => {
      this.internals.ariaDisabled = this.disabled ? 'true' : null
    })

    // Motion gate (interaction-states standard) — flip `ready` ONE FRAME PAST first paint (button.ts
    // precedent), so the upgrade/first-paint styling SNAPS in and only subsequent state changes animate.
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }
}

if (!customElements.get('ui-toggle')) customElements.define('ui-toggle', UIToggleElement)
