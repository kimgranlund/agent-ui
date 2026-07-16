// button.ts — UIButtonElement, the reference FACE control (goals.md §G5 / Phase-1). BEHAVIOUR + props +
// role + self-define ONLY.
//
// Content model — host-as-grid (ADR-0006): the user's light-DOM children (an optional leading icon + the
// label) are placed by button.css's `:has()` grid (s7). `render()` stays the inherited no-op — there is no
// template, so the host render effect never commits anything of its own. ADR-0133 ADDS one adoption move
// beyond that: the label region (the non-adornment children — anything without `slot="leading"`/
// `slot="trailing"`) is wrapped in a real, persistent `<span data-part="label">` so button.css can carry
// `text-overflow` on it (anonymous grid text has no selector surface for the clip — button.css:99-103's own
// long-standing deferral comment). This is `ui-text`'s stamp/heal shape (ADR-0078 cl.4) adapted: nodes are
// MOVED, never cloned, and a `childList` MutationObserver re-adopts any stray label child that lands
// directly on the host later (parser streaming, or the A2UI `buttonFactory`'s `el.textContent = label`
// write, `factories.ts:117-119` — the identical clobbering pattern ui-text's heal observer exists to
// survive). The wrapper is UNCONDITIONAL — no opt-in prop — because the label is already forced to one line
// (`white-space: nowrap`, unconditional); ellipsis-on-overflow completes that existing default rather than
// adding a new axis. An `icon-only` button (no label content at all) never gets an empty wrapper — the heal
// pass only builds one when there is a stray non-adornment node to hold, so the fifth (square) structure is
// untouched. Geometry/colour otherwise live entirely in button.css.
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

/** An adornment child sits in a POSITION slot (ADR-0006/ADR-0012) — everything else is label content. */
const isAdornment = (node: ChildNode): boolean =>
  node instanceof Element && (node.getAttribute('slot') === 'leading' || node.getAttribute('slot') === 'trailing')

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

  // The label wrapper (ADR-0133) — the one real element the label region is adopted into, so button.css
  // can carry `text-overflow` on it. Null whenever there is no label content to hold (e.g. `icon-only`).
  #label: HTMLSpanElement | null = null
  // The childList observer that heals the wrapper invariant — the SAME shape as ui-text's `#observer`
  // (ADR-0078 cl.4): re-adopts a stray label child (parser streaming) and rebuilds the wrapper fresh after
  // a `textContent` clobber (the A2UI `buttonFactory` `label` write). Disconnected in `disconnected()` —
  // the "zero residue after removal" discipline a raw platform observer needs by hand.
  #observer: MutationObserver | null = null

  protected connected(): void {
    this.internals.role = 'button' // ARIA via internals — never a host role/aria-* attribute
    tabbable(this, { disabled: () => this.disabled }) // tabindex=0 enabled / out of tab order disabled (ADR-0010)
    pressActivation(this, { disabled: () => this.disabled }) // Space/Enter → click; auto-cleans on disconnect
    // The disabled AX state — control-level (internals is protected, unreachable from a trait); scope-owned,
    // so it re-runs on the disabled signal and is disposed on disconnect (zero residue).
    this.effect(() => {
      this.internals.ariaDisabled = this.disabled ? 'true' : null
    })
    // The label wrapper (ADR-0133) — an initial heal pass adopts whatever label content already exists
    // (parser-streamed or set before connect), then the observer heals every later mutation. Installed
    // AFTER the initial pass so it never observes its own synchronous setup.
    this.#heal()
    this.#observer = new MutationObserver(() => this.#heal())
    this.#observer.observe(this, { childList: true })
    // Motion gate (interaction-states standard) — flip the `ready` custom state ONE FRAME PAST first paint, so
    // the upgrade/first-paint styling SNAPS in and only subsequent state changes animate (the button.css
    // transition is gated behind `:state(ready)`). requestAnimationFrame — NOT updateComplete (a microtask,
    // before paint) — to clear the first paint; `states` is optional-chained because jsdom has no CustomStateSet
    // (the real motion behaviour is the cross-engine smoke). Idempotent (a Set), so reconnect is safe.
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  /**
   * Restore the label-wrapper invariant (ADR-0133). A DETACHED wrapper (a `textContent`/`innerHTML`
   * clobber that replaced every child, wrapper included) is forgotten; every stray non-adornment child
   * currently on the host is then adopted into the wrapper, building one fresh only if there is at least
   * one such child (an empty wrapper would pollute the `icon-only` single-column anatomy with a dead grid
   * track). The wrapper's insert point is anchored on the TRAILING adornment element itself (never on
   * `strays[0]`) — adornments are never moved, so inserting immediately before whatever trailing element
   * currently exists (or appending, when there is none) places the wrapper after any leading adornment and
   * before any trailing one regardless of interspersed whitespace text nodes (component-reviewer finding:
   * an authored, pretty-printed `<ui-button>\n  <svg slot="leading">…</svg>Label\n</ui-button>` has a
   * whitespace text node BEFORE the leading adornment — anchoring on `strays[0]` put the wrapper ahead of
   * it, inverting the anatomy). Adopting a node re-fires this same observer, but the next delivery finds
   * the invariant satisfied — a no-op — so this self-converges within ≤2 passes (the ui-text `#heal`
   * precedent).
   */
  #heal(): void {
    if (this.#label && this.#label.parentNode !== this) this.#label = null // detached — a full clobber
    const strays = Array.from(this.childNodes).filter((node) => node !== this.#label && !isAdornment(node))
    if (strays.length === 0) return // nothing to wrap — keep icon-only (and empty) buttons untouched
    if (!this.#label) {
      this.#label = document.createElement('span')
      this.#label.setAttribute('data-part', 'label')
      const trailing = Array.from(this.children).find((el) => el.getAttribute('slot') === 'trailing') ?? null
      this.insertBefore(this.#label, trailing) // before the trailing adornment, or appended when there is none
    }
    for (const node of strays) this.#label.appendChild(node)
  }
}

if (!customElements.get('ui-button')) customElements.define('ui-button', UIButtonElement)
