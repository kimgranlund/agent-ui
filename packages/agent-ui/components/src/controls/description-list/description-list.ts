// description-list.ts — UIDescriptionListElement, the Display-class key–value receipt primitive
// (ADR-0201, GH #1185 — the primitive the GH #1174 grammar composition pattern was written to be
// superseded by). Real, selectable DOM text — per surviving row a label (secondary plane) with its value
// ADJACENT (never opposite-edge flushing, never a two-column label/value split; the receipt rhythm the
// #1174 clause spelled as payload grammar is this component's CSS). Non-interactive, non-form-associated:
// no events, no keyboard contract, no focus, no `size`/`scale` geometry row (Display class — the levers
// are the type matrix + the space ladder). BEHAVIOUR + props + self-define ONLY; the pure hardening/
// formatting/codec math lives in description-list-model.ts (DOM-free, unit-testable) and the rhythm/ink
// lives in description-list.css.
//
// THE EMPTY-VALUE OMISSION LAW HOLDS BY CONSTRUCTION (ADR-0201 cl.3): `cleanDescriptionRows` drops any
// row without a real value — at the codec (attribute path) AND again in the render effect (the table.ts
// case-3 property-write guard, same shared hardening function) — so an empty row is unrepresentable.
// Value HUMANIZATION stays the producer's job (the #1174 law): a surviving string renders VERBATIM; a
// surviving finite number prints via the shared Intl formatter; a boolean value DROPS the row (never a
// silent Yes/No repair).
//
// ONE render effect (reads `rows`): a full `replaceChildren` rebuild per change — the ui-stat whole-swap
// shape (LLD-C5's reasoning holds identically: no interior user state worth preserving on a static
// receipt — no scroll, no selection, no focus). No internals ARIA is minted (the ui-stat precedent —
// real text in reading order label → value, row by row, carries the whole meaning; `role=list` is
// REJECTED as wrong semantics for pairs, and the ARIA term/definition family as draft-tier AT support —
// ADR-0201 cl.5).

import { UIElement, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cleanDescriptionRows, descriptionRowsProp, formatRowValue } from './description-list-model.ts'

const props = {
  rows: descriptionRowsProp, // {label, value}[] · safe JSON codec, hardened both paths — never throws, never renders a valueless row (ADR-0201 cl.2/cl.3)
} satisfies PropsSchema

export interface UIDescriptionListElement extends ReactiveProps<typeof props> {}
export class UIDescriptionListElement extends UIElement {
  static props = props

  protected override connected(): void {
    this.effect(() => {
      // Re-harden on the way in (the table.ts case-3 property-write guard — a direct `el.rows = [...]`
      // property write bypasses the codec; sharing ONE hardening function keeps the two paths identical).
      const rows = cleanDescriptionRows(this.rows)

      // Reading order label → value, row by row, IS DOM order — one replaceChildren commits the whole
      // receipt (whole-swap semantics, no incremental patching; the ui-stat shape).
      this.replaceChildren(...rows.map((row) => this.#row(row.label, formatRowValue(row.value))))
    })
  }

  /** One `<div data-part="row">` holding `<span data-part="label">` then `<span data-part="value">` —
   *  the value sits ADJACENT to its label (flex row, baseline align, fixed pair gap — the CSS's job). */
  #row(label: string, value: string): HTMLElement {
    const row = document.createElement('div')
    row.setAttribute('data-part', 'row')
    const labelEl = document.createElement('span')
    labelEl.setAttribute('data-part', 'label')
    labelEl.textContent = label
    const valueEl = document.createElement('span')
    valueEl.setAttribute('data-part', 'value')
    valueEl.textContent = value
    row.append(labelEl, valueEl)
    return row
  }
}

if (!customElements.get('ui-description-list')) customElements.define('ui-description-list', UIDescriptionListElement) // idempotent self-define
