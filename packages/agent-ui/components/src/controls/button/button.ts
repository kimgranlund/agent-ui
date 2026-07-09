// button.ts — UIButtonElement, the reference FACE control (goals.md §G5 / Phase-1). BEHAVIOUR + props +
// role + self-define ONLY.
//
// Content model — host-as-grid (ADR-0006): the user's light-DOM children (an optional leading icon + the
// label) are placed by button.css's `:has()` grid (s7). The button does NOT `render()` a wrapper over
// them, so `render()` stays the inherited no-op (returning nothing → the host render effect commits
// nothing → the user's children are never clobbered). Geometry/colour live entirely in button.css.
//
// Keyboard activation is the `pressActivation` trait (Space/Enter → a native-parity `host.click()`),
// invoked from `connected()` so its listeners ride the connection AbortSignal. Focusability is the
// `tabbable` trait (ADR-0010): tabindex=0 while enabled, out of the tab order while disabled — the inert
// half that lives in a trait. ARIA `role` is set through `ElementInternals`, never a host attribute, and so
// is the disabled AX state (`ariaDisabled`) — a control-level effect because `internals` is protected and a
// trait cannot reach it. `controls → dom + traits` is the allowed import direction.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { pressActivation } from '../../traits/press-activation.ts'
import { tabbable } from '../../traits/tabbable.ts'

const props = {
  // variant/size REFLECT so the attribute-selector styling (`[variant]`/`[size]` in button.css repointing
  // the colour roles + dimensional ramp) applies to JS-set values too, not only author-set attributes.
  variant: { ...prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'), reflect: true },
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
  // `disabled` reflects to a `disabled` attribute so CSS can render the host pointer-inert (s7); the
  // trait already guards keyboard activation off `() => this.disabled`.
  disabled: { ...prop.boolean(false), reflect: true },
  // icon-only ⇒ the geometry law's fifth structure (references/geometry.md "icon-only (no label) →
  // square"): a real slotted adornment (leading/trailing) with NO label content at all. CSS alone
  // cannot detect an empty/text-node label — `:has()` only matches ELEMENTS, so a bare text-node label
  // (the common `<svg slot=leading>…Download</ui-button>` pattern) is invisible to it — so this is an
  // explicit author opt-in (button.css's `:scope[icon-only]` structure). The accessible name must then
  // come from `aria-label` (there is no label text to read), the toast.ts close-button precedent.
  iconOnly: { ...prop.boolean(false), reflect: true, attribute: 'icon-only' },
} satisfies PropsSchema

export interface UIButtonElement extends ReactiveProps<typeof props> {}
export class UIButtonElement extends UIElement {
  static props = props

  protected connected(): void {
    this.internals.role = 'button' // ARIA via internals — never a host role/aria-* attribute
    tabbable(this, { disabled: () => this.disabled }) // tabindex=0 enabled / out of tab order disabled (ADR-0010)
    pressActivation(this, { disabled: () => this.disabled }) // Space/Enter → click; auto-cleans on disconnect
    // The disabled AX state — control-level (internals is protected, unreachable from a trait); scope-owned,
    // so it re-runs on the disabled signal and is disposed on disconnect (zero residue).
    this.effect(() => {
      this.internals.ariaDisabled = this.disabled ? 'true' : null
    })
    // Motion gate (interaction-states standard) — flip the `ready` custom state ONE FRAME PAST first paint, so
    // the upgrade/first-paint styling SNAPS in and only subsequent state changes animate (the button.css
    // transition is gated behind `:state(ready)`). requestAnimationFrame — NOT updateComplete (a microtask,
    // before paint) — to clear the first paint; `states` is optional-chained because jsdom has no CustomStateSet
    // (the real motion behaviour is the cross-engine smoke). Idempotent (a Set), so reconnect is safe.
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }
}

if (!customElements.get('ui-button')) customElements.define('ui-button', UIButtonElement)
