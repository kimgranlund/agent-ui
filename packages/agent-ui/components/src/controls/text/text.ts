// text.ts — UITextElement, the Display-class text primitive (ADR-0025). BEHAVIOUR + props + heading
// semantics + self-define ONLY.
//
// Content model — host-as-content (ADR-0006 + ADR-0025 cl.2): the user's light-DOM children (the
// displayed text) are the styled text node; `render()` stays the inherited VOID so they flow through
// untouched. `variant` is the ONE public prop — a reflected literal union — driving typography via the
// [variant] CSS selectors in text.css, with no TypeScript opinion on size/weight/leading.
//
// Heading semantics (ADR-0025 cl.4 / Fork 3, user-resolved 2026-06-28 — real headings): h1-h5 carry
// `role=heading` + `ariaLevel` via ElementInternals; body/caption clear both (generic styled text, like
// <p>/<span>). This `connected()` effect is the ONLY behavioural code ui-text carries — everything else
// is prop + CSS. ARIA set through ElementInternals — NEVER a host `role`/`aria-*` attribute (the FACE
// pattern, ui-button internals.role precedent). No interaction state, no focus/keyboard, no motion gate.
//
// Display size-class (ADR-0025 cl.1): no control height, no padding-block law, no frame. `user-select`
// is ENABLED (display text is selectable — the deliberate inverse of ui-button, which disables it).
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom barrel.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

// The heading variant set — `h1`-`h5` carry role=heading+ariaLevel; `body`/`caption` stay generic.
const HEADING_VARIANTS = new Set(['h1', 'h2', 'h3', 'h4', 'h5'] as const)

const props = {
  // `variant` REFLECTS so the [variant] typographic repoint in text.css applies to JS-set values too,
  // not only author-set attributes (the ui-button `size`/`variant` precedent).
  variant: { ...prop.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body'] as const, 'body'), reflect: true },
} satisfies PropsSchema

export interface UITextElement extends ReactiveProps<typeof props> {}
export class UITextElement extends UIElement {
  static props = props

  protected connected(): void {
    // Heading semantics — the ONE scope-owned effect ui-text carries (ADR-0025 cl.4). Runs once on
    // connect (variant = the initial value) and re-runs on every variant signal change. Disposed on
    // disconnect (zero residue). ElementInternals — never host attributes (the FACE pattern).
    this.effect(() => {
      const v = this.variant
      if (HEADING_VARIANTS.has(v as 'h1' | 'h2' | 'h3' | 'h4' | 'h5')) {
        this.internals.role = 'heading'
        this.internals.ariaLevel = String(Number(v.slice(1))) // 'h1'→'1', 'h2'→'2', …, 'h5'→'5'
      } else {
        // body/caption — clear both (generic styled text, no implicit role)
        this.internals.role = null
        this.internals.ariaLevel = null
      }
    })
  }
}

if (!customElements.get('ui-text')) customElements.define('ui-text', UITextElement)
