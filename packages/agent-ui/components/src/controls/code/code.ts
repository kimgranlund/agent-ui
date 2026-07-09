// code.ts — UICodeElement, the Display-class zero-machinery verbatim code leaf (LLD-C5,
// content-family.lld.md §3; content-family.spec.md SPEC-R1/R3/R5; ADR-0113 cl.2/fork F2).
//
// Content model — host-as-content (ADR-0006/ADR-0113 fork F2): the light-DOM text IS the code. There is
// NO `code` prop on the element and no `html\`\`` template — `render()` stays the inherited void. The
// catalog's bindable `Code.code` property maps to `textContent` (the `Text.text` lane, SPEC-R3): a bound
// write replaces plain text with plain text, so there is nothing to heal. Normative absences (SPEC-R1
// AC2, the ADR-0106 grep-able-absence precedent, applied here — this file must never NAME the platform
// child-mutation-watching API or a browser copy-affordance API, the same discipline text.ts holds for
// its own banned box-size-watching API): no DOM-mutation watcher of any kind, no stamp, no adoption code,
// no system copy-affordance hookup, no source-transforming pass of any kind — this file is the whole
// zero-machinery leaf.
//
// `language` (SPEC-R4) is a reflected, free-string, INERT metadata prop — no enum (nothing for the
// ADR-0098 static-enum lane to gate), no rendering effect, no dispatch to any rendering-transform
// consumer. It exists so model-emitted markdown-fence habits round-trip losslessly; a future consumer of
// this metadata is a named, fenced escape hatch (SPEC-R6), never built here.
//
// A11y (SPEC-R5): `internals.role = 'code'` — a CONSTANT, set once in connected() (the list.ts/bar-chart
// `role=list` precedent), never a host `role` attribute. Keyboard access to horizontal overflow rides the
// platform's focusable-scroller behaviour where it exists (code.css `overflow-x: auto`); this file mints
// no `tabindex` and no measurement machinery for it (the residual is named and accepted, SPEC-R5 AC2).
//
// Imports inward only (controls → dom): UIElement + prop from the dom barrel.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  // inert metadata (SPEC-R4) — no enum, no effect; reflects so the attribute round-trips a JS-set value
  // too (the fleet reflect precedent) even though nothing in this file or code.css reads the attribute.
  language: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

export interface UICodeElement extends ReactiveProps<typeof props> {}
export class UICodeElement extends UIElement {
  static props = props

  protected connected(): void {
    // The ONE internals line (SPEC-R5) — a constant semantic role, set directly (not inside an effect,
    // nothing reactive depends on it); re-set on each connect (idempotent).
    this.internals.role = 'code'
  }
}

if (!customElements.get('ui-code')) customElements.define('ui-code', UICodeElement) // idempotent self-define
