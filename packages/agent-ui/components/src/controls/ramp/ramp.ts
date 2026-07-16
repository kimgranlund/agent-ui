// ramp.ts — UIRampElement, the Display-class ordered-color-series leaf (LLD-C4, token-surfaces.lld.md §3.2;
// SPEC-R5…R8; ADR-0118 cl.1/2/4). BEHAVIOUR + props + list-semantics ARIA + the component-built cell strip +
// self-define ONLY — the value-lane/hardening logic lives in the shared `_token-surface/token-surface.ts`
// (LLD-C1), the strip/cell geometry in ramp.css.
//
// A ramp is data, not decoration (ADR-0118 cl.4): the host carries `role=list` via `ElementInternals` (the
// `ui-bar-chart`/`ui-list` precedent) — never a host attribute — named by `label` when non-empty (SPEC-R8). Each
// rendered cell is a real `role=listitem` element whose text content is its label plus the printed value; the
// color box (`[data-part='box']`) is `aria-hidden` — color cannot be announced, the printed label/value IS the
// accessible datum (CVD-safe by construction — no step is color-encoded only).
//
// Content model — component-built cells, NOT host-as-grid (the chart family's whole-array precedent): `steps` is
// display-only derived state (no positional reconcile — inert cells with no focus/selection worth reconciling),
// so `render()` stays the inherited no-op and the steps effect rebuilds the full light-DOM cell list on every
// `steps`/`scheme` change via `replaceChildren` (a whole-array swap, no incremental API — SPEC-R6).
//
// Imports inward only (controls → dom + the sibling shared helper).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cleanEntries, cssValue, tokenEntriesProp, type TokenEntry } from '../_token-surface/token-surface.ts'

const props = {
  steps: tokenEntriesProp(), // { label: string; value: string }[] · safe JSON codec (LLD-C1) · default []
  label: { ...prop.string(''), reflect: true }, // the strip's accessible name — SPEC-R8: unlabeled is legal, never a silent state
  scheme: prop.enum(['auto', 'light', 'dark'] as const, 'auto'), // pins the WHOLE strip's color-scheme resolution
} satisfies PropsSchema

export interface UIRampElement extends ReactiveProps<typeof props> {}
export class UIRampElement extends UIElement {
  static props = props

  protected override connected(): void {
    // List semantics (SPEC-R8, the `ui-bar-chart` precedent) — a constant semantic role, set directly (not
    // inside an effect); re-set on each connect (idempotent).
    this.internals.role = 'list'

    // The label effect — `label` names the list when non-empty; an unlabeled list is legal (SPEC-R8 AC2 —
    // the host stays role=list regardless, never aria-hidden, never a silent state).
    this.effect(() => {
      this.internals.ariaLabel = this.label || null
    })

    // The steps effect (SPEC-R6/R7): whole-array derived state — every `steps`/`scheme` change rebuilds the
    // full light-DOM cell list via one `replaceChildren`. `cleanEntries` runs again here (not just inside the
    // codec), so a PROPERTY write of garbage never reaches the render path either (the SPEC-R7 property-write
    // guard the codec alone cannot cover — the codec only guards the ATTRIBUTE path).
    this.effect(() => {
      const scheme = this.scheme
      const entries = cleanEntries(this.steps)
      this.replaceChildren(...entries.map((step) => this.#cellNode(step, scheme)))
    })
  }

  /**
   * Build one component-owned strip cell: `box(aria-hidden) · step-label · value` (LLD-C4's markup). The
   * listitem's combined text content is `{label}{value}` (the two real text spans — the accessible datum,
   * SPEC-R8 AC1, the `ui-bar-chart` listitem-text precedent); the box is `aria-hidden` and carries the
   * strip-shared `scheme` pin (colorScheme) exactly like swatch's own box.
   */
  #cellNode(step: TokenEntry, scheme: 'auto' | 'light' | 'dark'): HTMLElement {
    const item = document.createElement('div')
    item.setAttribute('role', 'listitem')
    item.setAttribute('data-part', 'cell')

    const box = document.createElement('span')
    box.setAttribute('data-part', 'box')
    box.setAttribute('aria-hidden', 'true')
    box.style.background = cssValue(step.value)
    box.style.colorScheme = scheme === 'auto' ? '' : scheme

    const stepLabel = document.createElement('span')
    stepLabel.setAttribute('data-part', 'step-label')
    stepLabel.textContent = step.label

    const value = document.createElement('span')
    value.setAttribute('data-part', 'value')
    value.textContent = step.value

    item.append(box, stepLabel, value)
    return item
  }
}

if (!customElements.get('ui-ramp')) customElements.define('ui-ramp', UIRampElement) // idempotent self-define
