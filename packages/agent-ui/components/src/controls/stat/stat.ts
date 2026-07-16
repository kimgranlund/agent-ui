// stat.ts — UIStatElement, the Display-class metric tile (LLD-C5, report-family.lld.md §3; SPEC-R7..R10;
// ADR-0111). Real, selectable DOM text — label + value + optional delta + optional caption — in a small
// component-built grid; deliberately NO heading stamp (SPEC-R8 — a stat's value is not a document
// heading; this retires the fake-`h3`-in-a-card idiom the whole intake was forced by,
// `a2ui/src/examples/patterns.ts:183-187` / `catalog-coverage.ts:319-323`). Non-interactive,
// non-form-associated: no events, no keyboard contract, no focus, no `size`/`scale` geometry (Display
// class, SPEC-R17). No child/slot seam (ADR-0111 fork F2, binding — composing a Sparkline beside a stat
// is pure composition in a Row, OUTSIDE this component; never a slot here).
//
// ONE render effect (reads label/value/delta/caption): a full `replaceChildren` rebuild per change —
// unlike ui-table there is no interior user state worth preserving on a four-span tile (no scroll, no
// selection), so the simple whole-swap is correct (LLD-C5). No internals ARIA is minted: real text
// carries the tile's whole meaning, including the delta's DIRECTION (SPEC-R9) — the direction word is
// real, visually-hidden-but-announced text preceding the signed number; the glyph is `aria-hidden` and
// text-free; direction never travels by color (ADR-0057 — no `[data-dir]` rule in stat.css touches ink).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { deltaParts, formatStatValue, statDeltaProp, statValueProp, type DeltaParts } from './stat-model.ts'

const props = {
  label: { ...prop.string(''), reflect: true },
  figure: statValueProp, // string | number · number → Intl-formatted, string passes through (stat-model.ts). Renamed from `value` (TKT-0069 item 1 ruling: `value` = the FACE form value, reserved; the A2UI catalog keeps wire `value`, mapped in its bespoke factory)
  delta: statDeltaProp, // number | null · absent/non-finite → the delta region is not rendered (SPEC-R7)
  caption: prop.string(''),
} satisfies PropsSchema

export interface UIStatElement extends ReactiveProps<typeof props> {}
export class UIStatElement extends UIElement {
  static props = props

  protected override connected(): void {
    this.effect(() => {
      const label = this.label
      const value = formatStatValue(this.figure)
      const caption = this.caption
      const delta = deltaParts(this.delta)

      // Reading order label → value → delta → caption is DOM order (SPEC-R8) — the array below IS that
      // order; one replaceChildren commits the whole tile (whole-swap semantics, no incremental patching).
      const nodes: HTMLElement[] = [this.#part('label', label), this.#part('value', value)]
      if (delta !== null) nodes.push(this.#deltaNode(delta))
      if (caption !== '') nodes.push(this.#part('caption', caption))

      this.replaceChildren(...nodes)
    })
  }

  /** One `<span data-part="{part}">{text}</span>` — the tile's plain text cells (label/value/caption). */
  #part(part: string, text: string): HTMLElement {
    const span = document.createElement('span')
    span.setAttribute('data-part', part)
    span.textContent = text
    return span
  }

  /**
   * The delta region (SPEC-R9): `data-dir` carries direction for the CSS glyph orientation; a
   * component-drawn `aria-hidden` glyph (omitted when `dir === 'flat'` — no arrow for "unchanged"); a
   * visually-hidden-but-announced direction WORD precedes the signed number, so the direction is real,
   * readable text — never color, never a bare glyph codepoint (ADR-0111 cl.4, ADR-0057).
   */
  #deltaNode(delta: DeltaParts): HTMLElement {
    const region = document.createElement('span')
    region.setAttribute('data-part', 'delta')
    region.setAttribute('data-dir', delta.dir)

    if (delta.dir !== 'flat') {
      const glyph = document.createElement('span')
      glyph.setAttribute('data-part', 'delta-glyph')
      glyph.setAttribute('aria-hidden', 'true')
      region.append(glyph)
    }

    const word = document.createElement('span')
    word.setAttribute('data-part', 'delta-word')
    word.textContent = `${delta.word} `
    region.append(word, document.createTextNode(delta.text))

    return region
  }
}

if (!customElements.get('ui-stat')) customElements.define('ui-stat', UIStatElement) // idempotent self-define
