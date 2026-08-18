// stat.ts — UIStatElement, the Display-class metric tile (LLD-C5, report-family.lld.md §3; SPEC-R7..R10;
// ADR-0111). Real, selectable DOM text — label + value + optional delta + optional caption — in a small
// component-built grid; deliberately NO heading stamp (SPEC-R8 — a stat's value is not a document
// heading; this retires the fake-`h3`-in-a-card idiom the whole intake was forced by,
// `a2ui/src/examples/patterns.ts:183-187` / `catalog-coverage.ts:319-323`). Non-interactive,
// non-form-associated: no events, no keyboard contract, no focus, no `size`/`scale` geometry (Display
// class, SPEC-R17). No child/slot seam (ADR-0111 fork F2, binding — composing a Sparkline beside a stat
// is pure composition in a Row, OUTSIDE this component; never a slot here).
//
// ONE render effect (reads label/value/delta/caption/variant/percent): a full `replaceChildren` rebuild
// per change — unlike ui-table there is no interior user state worth preserving on a four-span tile (no
// scroll, no selection), so the simple whole-swap is correct (LLD-C5). No internals ARIA is minted: real
// text carries the tile's whole meaning, including the delta's DIRECTION (SPEC-R9) — the direction word is
// real, visually-hidden-but-announced text preceding the signed number; the glyph is `aria-hidden` and
// text-free; direction never travels by color (ADR-0057 — no `[data-dir]` rule in stat.css touches ink).
//
// `variant='ring'` (GH#1208, req-a2ui-library.md item 7 — the donut/progress-ring later-tier row): the
// API DECISION, against stat's existing grain (documented in full in stat.md's "Ring variant" section) —
// TWO new props, not one: a structural `variant` enum (`'tile' | 'ring'`, the sparkline/badge precedent —
// reflects, since ring vs tile swaps `--ui-stat-*` CSS layout via a host attribute selector, unlike
// sparkline's own non-reflecting `variant`) PLUS a dedicated `percent` (0–100, `number | null`, the
// statDeltaProp null-default shape — see stat-model.ts) that drives the ring's fill independently of
// `figure`'s own printed text. Rejected: overloading `figure` itself as the ring's percent (parsing "72%"
// back into a number couples two concerns — the PRINTED text an author controls verbatim, SPEC-R7, and the
// GEOMETRY a percent-shaped number drives — the same string-vs-number ambiguity `statValueProp` already
// exists to avoid) and a single combined `ring="72"` shorthand (fails the 1:1-accessor grain every other
// stat prop already holds). The ring itself is PURELY DECORATIVE (`aria-hidden`, like the delta glyph) —
// the printed `figure`/`caption` text already carries the percent's meaning as real text (SPEC-R7's law,
// applied unchanged to the new visual); nothing new enters the accessibility tree.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import {
  deltaParts,
  formatStatValue,
  ringPercent,
  statDeltaProp,
  statPercentProp,
  statValueProp,
  type DeltaParts,
} from './stat-model.ts'

const props = {
  label: { ...prop.string(''), reflect: true },
  figure: statValueProp, // string | number · number → Intl-formatted, string passes through (stat-model.ts). Renamed from `value` (TKT-0069 item 1 ruling: `value` = the FACE form value, reserved; the A2UI catalog keeps wire `value`, mapped in its bespoke factory)
  delta: statDeltaProp, // number | null · absent/non-finite → the delta region is not rendered (SPEC-R7)
  caption: prop.string(''),
  // structural — GH#1208; CSS keys the ring layout off the reflected [variant] host attribute (badge
  // [intent] / indicator-element [size] precedent), unlike sparkline's own non-reflecting variant (which
  // never needed a host-level CSS selector — its variant only ever picks an SVG shape in JS)
  variant: { ...prop.enum(['tile', 'ring'] as const, 'tile'), reflect: true },
  // number | null · ring-only completion 0-100, clamped (stat-model.ts) — ignored when variant!=='ring'.
  // NOT a plain `prop.number(0)`: a non-null-defaulting number codec misclassifies under the LLD-C9
  // `kindOf` build-verify (component-descriptor.ts), so this mirrors statDeltaProp's null-default shape.
  percent: statPercentProp,
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
      const variant = this.variant
      const percent = this.percent

      // Reading order label → value → delta → caption is DOM order (SPEC-R8) — the array below IS that
      // order; one replaceChildren commits the whole tile (whole-swap semantics, no incremental patching).
      // The ring (GH#1208) is inserted right before `value` — a decorative sibling the CSS overlays onto
      // the SAME grid area as `value` (stat.css), never a wrapper: it stays outside DOM/reading order.
      const nodes: HTMLElement[] = [this.#part('label', label)]
      if (variant === 'ring') nodes.push(this.#ringNode(ringPercent(percent)))
      nodes.push(this.#part('value', value))
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

  /**
   * The ring variant's decorative donut (GH#1208, stat.md's "Ring variant" section): a component-drawn,
   * `aria-hidden` node — never announced, since the printed `figure`/`caption` text already carries the
   * percent's meaning as real text (SPEC-R7's law, applied to the new visual — the delta-glyph precedent).
   * `--_ring-pct` (bar-chart's non-`--ui-*`-namespaced imperative-custom-property precedent,
   * `--_bar-start`/`--_bar-length`) is the ONLY value this file computes; every paint decision — the arc
   * via the conic-gradient percentage stop, the donut hole via `mask`, the forced-colors override — lives
   * in stat.css, never here.
   */
  #ringNode(pct: number): HTMLElement {
    const ring = document.createElement('span')
    ring.setAttribute('data-part', 'ring')
    ring.setAttribute('aria-hidden', 'true')
    ring.style.setProperty('--_ring-pct', String(pct))
    return ring
  }
}

if (!customElements.get('ui-stat')) customElements.define('ui-stat', UIStatElement) // idempotent self-define
