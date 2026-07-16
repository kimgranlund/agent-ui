// avatar.ts — UIAvatarElement, the Indicator-class compact identity mark (LLD-C3, feed-family.lld.md §3;
// SPEC-R4…R7; ADR-0112 cl.3). Non-interactive, non-form-associated leaf: no events, no keyboard contract,
// no focus. The fallback chain (SPEC-R5) never renders a broken-image box and never renders empty —
// exactly one of `src` image / initials / person glyph paints at a time.
//
// ONE render effect (reads src/identity/#failedSrc) walks the chain in order:
//   1. `src` non-empty AND not the failed src ⇒ an <img alt=""> (empty-alt — the Option/MenuItem sanction;
//      host ARIA stays on internals) with an `error` listener that records the src into `#failedSrc`. The
//      effect re-runs on that write and falls through to initials/glyph — no broken-image final state. A
//      NEW `src` no longer equals `#failedSrc`, so it re-attempts (SPEC-R5's re-attempt transition falls
//      out of the equality check, no extra state machine); clearing `src` falls back immediately.
//   2. else `initialsFrom(identity)` non-empty ⇒ a `<span data-part="initials">`.
//   3. else ⇒ `<ui-icon glyph="user">` — decorative by its own default; the icon control module is
//      statically imported so the tag is defined before use (the sanctioned sibling-control import).
//
// A second effect owns ARIA (SPEC-R6) — the `ui-icon` contract shape verbatim: decorative by default
// (`internals.ariaHidden = 'true'`, no role — a feed avatar beside a visible name would otherwise
// duplicate it); non-empty `label` opts into `role=img` + `ariaLabel` + clears `ariaHidden`. A label-less
// avatar beside no name announces nothing — that is a contract-level author error, not a defect here
// (the descriptor states it explicitly).

import { signal } from '../../reactive/index.ts'
import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { initialsFrom } from './avatar-initials.ts'
import { UIIconElement } from '../icon/icon.ts' // sanctioned sibling-control import — self-defines ui-icon

const props = {
  src: prop.string(''), // image URL; a load error falls back without ever painting a broken-image box
  identity: prop.string(''), // the identity the initials derive from; NOT announced by default (SPEC-R6). Renamed from `name` (TKT-0069 item 1 ruling: `name` = the FORM name, reserved; the A2UI catalog keeps wire `name`, mapped in its bespoke factory)
  label: { ...prop.string(''), reflect: true }, // the a11y escape hatch — non-empty makes the avatar itself the accessible name
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true }, // reflected — the CSS [size] hook
} satisfies PropsSchema

export interface UIAvatarElement extends ReactiveProps<typeof props> {}
export class UIAvatarElement extends UIElement {
  static props = props

  // The most recent `src` that failed to load — an equality check, not a boolean flag, so a NEW src
  // (which no longer equals this value) re-attempts for free (SPEC-R5's re-attempt transition).
  #failedSrc = signal('')

  protected override connected(): void {
    this.effect(() => {
      const src = this.src
      const name = this.identity
      const failedSrc = this.#failedSrc.value

      if (src !== '' && src !== failedSrc) {
        const img = document.createElement('img')
        img.alt = '' // empty-alt semantics on an interior node — host ARIA stays on internals
        img.addEventListener('error', () => { this.#failedSrc.value = src }, { once: true })
        img.src = src
        this.replaceChildren(img)
        return
      }

      const initials = initialsFrom(name)
      if (initials !== '') {
        const span = document.createElement('span')
        span.dataset.part = 'initials'
        span.textContent = initials
        this.replaceChildren(span)
        return
      }

      const icon = document.createElement('ui-icon') as UIIconElement
      icon.glyph = 'user'
      this.replaceChildren(icon)
    })

    // ARIA effect (SPEC-R6): decorative by default; `label` opts into role=img + accessible name.
    this.effect(() => {
      if (this.label) {
        this.internals.role = 'img'
        this.internals.ariaLabel = this.label
        this.internals.ariaHidden = null
      } else {
        this.internals.role = null
        this.internals.ariaLabel = null
        this.internals.ariaHidden = 'true'
      }
    })
  }
}

if (!customElements.get('ui-avatar')) customElements.define('ui-avatar', UIAvatarElement) // idempotent self-define
