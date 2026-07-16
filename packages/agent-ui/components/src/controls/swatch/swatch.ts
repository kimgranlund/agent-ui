// swatch.ts — UISwatchElement, the Display-class color-identity leaf (LLD-C2, token-surfaces.lld.md §3.1;
// SPEC-R1…R4; ADR-0118 cl.1/2/4). BEHAVIOUR + props + the composed-name ARIA + the two component-built child
// nodes + self-define ONLY — the value-lane/hardening math lives in the shared `_token-surface/token-surface.ts`
// (LLD-C1), the box/token geometry in swatch.css.
//
// A swatch is data, not decoration (ADR-0118 cl.4): the host carries `role=img` via `ElementInternals` (never a
// host attribute) — a CONSTANT semantic, set once in `connected()` (the `ui-icon`/`ui-bar-chart` precedent). Its
// accessible name is a COMPOSED string (`label`, `', '`, `value` — see `#composeName`): there is no silent
// state, with or without `label` — the color itself is never announced (it cannot be spoken), only its name/
// value. The SAME composed string is also the visible `[data-part='value']` text content (SPEC-R2: "the label/
// value are real DOM text… AT-visible") — one string, two surfaces (the printed datum and the accessible name
// stay in lockstep by construction, never two independently-maintained copies).
//
// Content model — TWO component-built nodes, built ONCE and mutated in place (not a `replaceChildren` rebuild
// per change, unlike the chart family's whole-array row lists): a swatch has a fixed 2-node shape
// (`[data-part='box']` + `[data-part='value']`), so the render effect builds them lazily on first run and only
// ever WRITES into them thereafter — `render()` stays the inherited no-op.
//
// Imports inward only (controls → dom + the sibling shared helper): UIElement + prop + the typed-schema helpers
// from the dom barrel; `cssValue` from the shared `_token-surface` value-lane module (LLD-C1).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cssValue } from '../_token-surface/token-surface.ts'

const props = {
  color: prop.string(''), // a literal CSS color OR a --var name (cssValue routes it) — SPEC-R1. Renamed from `value` (TKT-0069 item 1 ruling: `value` = the FACE form value, reserved; the A2UI catalog keeps wire `value`, mapped in its bespoke factory)
  label: { ...prop.string(''), reflect: true }, // the token name / caption — SPEC-R1
  scheme: prop.enum(['auto', 'light', 'dark'] as const, 'auto'), // the color-scheme pin — SPEC-R2
} satisfies PropsSchema

/**
 * The composed accessible name (SPEC-R4): `label` (when non-empty) + `', '` + `value`; the value alone with no
 * label; `'swatch'` when neither — never nameless, never a silent state. ALSO the visible `[data-part='value']`
 * text content (SPEC-R2) — the printed datum and the accessible name are the SAME string by construction.
 */
function composeName(label: string, value: string): string {
  if (label && value) return `${label}, ${value}`
  if (label) return label
  if (value) return value
  return 'swatch'
}

export interface UISwatchElement extends ReactiveProps<typeof props> {}
export class UISwatchElement extends UIElement {
  static props = props

  #box: HTMLElement | undefined
  #valueText: HTMLElement | undefined

  protected override connected(): void {
    // A swatch is data, not decoration (SPEC-R4, ADR-0118 cl.4) — a constant semantic, set directly (not
    // inside an effect); re-set on each connect (idempotent).
    this.internals.role = 'img'

    // The one render effect (reads value/label/scheme): builds the 2-node shape lazily on first run, then
    // only ever WRITES into the existing nodes on every subsequent change (SPEC-R2/R3/R4).
    this.effect(() => {
      if (!this.#box) {
        this.#box = document.createElement('span')
        this.#box.setAttribute('data-part', 'box')
        this.#valueText = document.createElement('span')
        this.#valueText.setAttribute('data-part', 'value')
        this.replaceChildren(this.#box, this.#valueText)
      }
      const box = this.#box
      const valueText = this.#valueText as HTMLElement

      // SPEC-R2/R3: empty/invalid/undefined-var value → the browser resolves `background` to transparent (or
      // drops the declaration); the box's own hairline border (swatch.css) always carries the shape.
      box.style.background = cssValue(this.color)
      // SPEC-R2: the scheme pin — 'auto' sets nothing (ambient inheritance); light/dark pins color-scheme.
      box.style.colorScheme = this.scheme === 'auto' ? '' : this.scheme

      const name = composeName(this.label, this.color)
      valueText.textContent = name
      this.internals.ariaLabel = name
    })
  }
}

if (!customElements.get('ui-swatch')) customElements.define('ui-swatch', UISwatchElement) // idempotent self-define
