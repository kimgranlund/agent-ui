// ladder.ts — UILadderElement, the Display-class labeled-dimensional-tiers leaf (LLD-C6, token-surfaces.lld.md
// §3.3; SPEC-R9…R12; ADR-0118 cl.1/2/4). BEHAVIOUR + props + list-semantics ARIA + the component-built rows +
// self-define ONLY — the value-lane/hardening/length-routing logic lives in the shared
// `_token-surface/token-surface.ts` (LLD-C1), the row/bar geometry in ladder.css.
//
// A ladder is data, not decoration (ADR-0118 cl.4): the host carries `role=list` via `ElementInternals` (the
// `ui-bar-chart`/`ui-ramp` precedent) — never a host attribute — named by `label` when non-empty (SPEC-R12).
// Each rendered row is a real `role=listitem` element whose text content is its label plus the printed value;
// the magnitude bar (`[data-part='track']`) is `aria-hidden` — the printed value is the accessible datum either
// way, whether the bar rendered a real length or degraded to zero (the unified no-silent-state rule, SPEC-R11).
//
// The literal-length ruling (SPEC-R10, the deliberate ui-bar-chart departure): NO cross-tier normalization math
// — a tier's magnitude bar is its LITERAL length, capped to the track (`min(100%, …)`, ladder.css). Length
// VALIDITY is a rendering ROUTER, not a drop gate (SPEC-R11): `isRenderableLength` decides whether a tier's
// value drives a real bar or a `0px` zero-bar — the row + its printed value survive either way, so `cleanEntries`
// runs with NO further length-based filtering (only a genuinely malformed {label,value} shape drops an entry).
//
// Imports inward only (controls → dom + the sibling shared helper).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cleanEntries, cssValue, isRenderableLength, tokenEntriesProp, type TokenEntry } from '../_token-surface/token-surface.ts'

const props = {
  tiers: tokenEntriesProp(), // { label: string; value: string }[] · safe JSON codec (LLD-C1) · default []
  label: prop.string(''), // the list's accessible name — SPEC-R12: unlabeled is legal, never a silent state
  // NO `scheme` — dimensions are scheme-invariant (SPEC-R9).
} satisfies PropsSchema

export interface UILadderElement extends ReactiveProps<typeof props> {}
export class UILadderElement extends UIElement {
  static props = props

  protected override connected(): void {
    // List semantics (SPEC-R12, the `ui-bar-chart`/`ui-ramp` precedent) — a constant semantic role, set
    // directly (not inside an effect); re-set on each connect (idempotent).
    this.internals.role = 'list'

    // The label effect — `label` names the list when non-empty; an unlabeled list is legal (SPEC-R12 AC2).
    this.effect(() => {
      this.internals.ariaLabel = this.label || null
    })

    // The tiers effect (SPEC-R10/R11): whole-array derived state — every `tiers` change rebuilds the full
    // light-DOM row list via one `replaceChildren`. `cleanEntries` runs again here (not just inside the
    // codec) — the SPEC-R7-sibling property-write guard the codec alone cannot cover. NO length-based drop:
    // a non-length tier value KEEPS its row (routed to a zero-length bar by `#rowNode`, SPEC-R11).
    this.effect(() => {
      const rendered = cleanEntries(this.tiers)
      this.replaceChildren(...rendered.map((tier) => this.#rowNode(tier)))
    })
  }

  /**
   * Build one component-owned row: `label · track(aria-hidden) > bar · value` (LLD-C6's markup). The bar's
   * magnitude rides the row-scoped custom property `--_mag`, set imperatively — ladder.css owns every paint
   * decision, this method never writes a `width`. A resolvable length (SPEC-R11: `isRenderableLength` — a
   * `--var` counts, its own resolution is the browser's job) passes through `cssValue` (the LOAD-BEARING
   * transform, LLD-C6: a `--`-prefixed value becomes `var(--…)`, never a bare dashed-ident, which is invalid at
   * computed-value time inside `min(100%, …)`); a non-length value (`"red"`) routes to a literal `'0px'` — the
   * row + printed value survive either way (SPEC-R11 the unified no-silent-state rule). AT reading (SPEC-R12):
   * the listitem's text content is `{label}{value}` (the two real text spans, the `ui-bar-chart`/`ui-ramp`
   * listitem-text precedent); the track subtree is `aria-hidden` and text-free.
   */
  #rowNode(tier: TokenEntry): HTMLElement {
    const item = document.createElement('div')
    item.setAttribute('role', 'listitem')

    const label = document.createElement('span')
    label.setAttribute('data-part', 'label')
    label.textContent = tier.label

    const bar = document.createElement('span')
    bar.setAttribute('data-part', 'bar')
    const mag = isRenderableLength(tier.value) ? cssValue(tier.value) : '0px'
    bar.style.setProperty('--_mag', mag)

    const track = document.createElement('span')
    track.setAttribute('data-part', 'track')
    track.setAttribute('aria-hidden', 'true')
    track.appendChild(bar)

    const value = document.createElement('span')
    value.setAttribute('data-part', 'value')
    value.textContent = tier.value

    item.append(label, track, value)
    return item
  }
}

if (!customElements.get('ui-ladder')) customElements.define('ui-ladder', UILadderElement) // idempotent self-define
