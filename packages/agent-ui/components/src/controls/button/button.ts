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
  }
}

if (!customElements.get('ui-button')) customElements.define('ui-button', UIButtonElement)
