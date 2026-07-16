// bar-chart.ts — UIBarChartElement, the Display-class magnitude-comparison bar list (LLD-C5,
// chart-family.lld.md §3; chart-family.spec.md SPEC-R5…R8; ADR-0107 cl.1-5, fork F2). BEHAVIOUR + props +
// list-semantics ARIA + the component-built rows + self-define ONLY; the zero-baseline PROPORTION math
// lives in bar-math.ts (DOM-free, unit-testable) and the CSS grid/token geometry lives in bar-chart.css.
//
// The name stays `ui-bar-chart`/`BarChart` even though v1 renders the horizontal bar-LIST model (ADR-0107
// fork F2, SPEC-R5) — models know "BarChart"; the descriptor documents the deviation honestly.
//
// A chart is data, not decoration (ADR-0107 cl.4): the host carries `role=list` via `ElementInternals`
// (the `ui-list` precedent, `list.ts:50`) — never a host attribute — named by `label` when non-empty
// (SPEC-R8). Each rendered row is a real `role=listitem` element whose text content is `{label} {printed
// value}`; the visual bar (track + fill) is `aria-hidden` — the printed value is the accessible datum, the
// bar itself repeats it in the length channel only, never the sole carrier (ADR-0057).
//
// Content model — component-built rows, NOT host-as-grid: `data` is display-only, whole-array derived
// state (no positional reconcile — LLD-C5's deliberate NOT-ADR-0024 call, LLD §7 row 7: these are inert
// text rows with no focus/selection worth reconciling), so `render()` stays the inherited no-op and the
// rows effect rebuilds the full light-DOM child list on every `data` change via `replaceChildren`. The
// fill's geometry rides two row-scoped custom properties set imperatively (`--_bar-start`/`--_bar-length`,
// a non-`--ui-*` namespace — the slider/slider-multi `--value-pct` precedent) so bar-chart.css owns every
// paint decision and this file never writes a `width`.
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom barrel;
// the pure math from the co-located bar-math.ts (the ADR-0065 pure-core split, ADR-0107 cl.3/cl.7).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { barDataProp, barRows, cleanData, type BarRow } from './bar-math.ts'

const props = {
  data: barDataProp, // { label: string; value: number }[] · safe JSON codec (bar-math.ts) · default []
  label: { ...prop.string(''), reflect: true }, // the list's accessible name — SPEC-R8: unlabeled is legal, never a silent state
} satisfies PropsSchema

export interface UIBarChartElement extends ReactiveProps<typeof props> {}
export class UIBarChartElement extends UIElement {
  static props = props

  protected override connected(): void {
    // List semantics (SPEC-R8, the `ui-list` precedent) — a constant semantic role, set directly (not
    // inside an effect); re-set on each connect (idempotent).
    this.internals.role = 'list'

    // The label effect — `label` names the list when non-empty; an unlabeled list is legal (SPEC-R8 AC —
    // the host stays `role=list` regardless, never aria-hidden, never a silent state).
    this.effect(() => {
      this.internals.ariaLabel = this.label || null
    })

    // The rows effect (SPEC-R6/R7): whole-array derived state — every `data` change rebuilds the full
    // light-DOM row list via one `replaceChildren` (display-only rows hold no focus/selection state worth
    // a positional reconcile — LLD-C5's deliberate NOT-ADR-0024 call). `cleanData` runs again here (not
    // just inside the codec), so a PROPERTY write of garbage never reaches the math either (the SPEC-R3
    // AC2 sibling rule the codec alone cannot cover — the codec only guards the ATTRIBUTE path).
    this.effect(() => {
      const rows = barRows(cleanData(this.data))
      this.replaceChildren(...rows.map((row) => this.#rowNode(row)))
    })
  }

  /**
   * Build one component-owned row: `label · track(aria-hidden) > fill · value` (LLD-C5's markup). The
   * fill's geometry rides two row-scoped custom properties — bar-chart.css owns every paint decision, this
   * method never writes a `width`. AT reading (SPEC-R8 AC1): the listitem's text content is
   * `{label} {printed value}` (the two text spans); the track subtree is aria-hidden and text-free.
   */
  #rowNode(row: BarRow): HTMLElement {
    const item = document.createElement('div')
    item.setAttribute('role', 'listitem')

    const label = document.createElement('span')
    label.setAttribute('data-part', 'label')
    label.textContent = row.label

    const fill = document.createElement('span')
    fill.setAttribute('data-part', 'fill')
    fill.style.setProperty('--_bar-start', String(row.startPct))
    fill.style.setProperty('--_bar-length', String(row.lengthPct))

    const track = document.createElement('span')
    track.setAttribute('data-part', 'track')
    track.setAttribute('aria-hidden', 'true')
    track.appendChild(fill)

    const value = document.createElement('span')
    value.setAttribute('data-part', 'value')
    value.textContent = row.text

    item.append(label, track, value)
    return item
  }
}

if (!customElements.get('ui-bar-chart')) customElements.define('ui-bar-chart', UIBarChartElement) // idempotent self-define
