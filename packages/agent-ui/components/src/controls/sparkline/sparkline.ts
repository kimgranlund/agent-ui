// sparkline.ts — UISparklineElement, the Display-class series-shape mark (LLD-C2, chart-family.lld.md §2;
// SPEC-R1..R4; ADR-0107). Axis-free: no ticks, no legend, no interaction, no keyboard contract, no form
// participation. Light DOM; the only child is the component-built `<svg>` (the `ui-icon` imperative-
// injection idiom) — `render()` stays the inherited no-op.
//
// Three props, two connected() effects:
//   • `values` (number[], the safe JSON codec from sparkline-math.ts) + `variant` ('line'|'area') drive the
//     MARK effect: a whole-array swap rebuilds the <svg> via `replaceChildren` — no incremental patching.
//   • `label` (accessible context) + `values` drive the ARIA effect: `internals.ariaLabel` is the SPEC-R4
//     generated summary, recomputed on either input — never null, never aria-hidden (no silent state).
// `internals.role = 'img'` is a CONSTANT set directly in connected() (the list.ts `role=list` precedent) —
// it never varies, so it is not inside an effect.
//
// `cleanSeries` runs again at the render boundary (not just inside the codec): a PROPERTY write of garbage
// (e.g. `el.values = [1, null, 'x']`) never reaches the math either (SPEC-R3 AC2) — the codec only guards
// the ATTRIBUTE path.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cleanSeries, sparklineGeometry, sparklineSummary, sparklineValuesProp } from './sparkline-math.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

const props = {
  values: sparklineValuesProp, // number[] · safe JSON codec (sparkline-math.ts)
  label: { ...prop.string(''), reflect: true }, // accessible context (SPEC-R4), e.g. "Revenue trend"
  variant: prop.enum(['line', 'area'] as const, 'line'), // structural — enumType snaps unknowns to 'line'
} satisfies PropsSchema

export interface UISparklineElement extends ReactiveProps<typeof props> {}
export class UISparklineElement extends UIElement {
  static props = props

  protected override connected(): void {
    // A chart is data, not decoration (ADR-0107 cl.4): role=img is CONSTANT — set directly, once, the
    // list.ts `role=list` precedent — never through an effect (there is nothing to toggle it away).
    this.internals.role = 'img'

    // Mark effect (reads values, variant): rebuild the <svg> on any change. `g === null` (empty rendered
    // set) clears the host — the box still paints via the CSS floors (SPEC-R9).
    this.effect(() => {
      const g = sparklineGeometry(cleanSeries(this.values))
      if (g === null) {
        this.replaceChildren()
        return
      }

      const svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('viewBox', '0 0 100 100')
      svg.setAttribute('preserveAspectRatio', 'none')
      // aria-hidden on the SVG — the HOST carries role=img; the svg must never double-announce.
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('focusable', 'false')

      if (this.variant === 'area' && g.area !== null) {
        const area = document.createElementNS(SVG_NS, 'polygon')
        area.setAttribute('data-part', 'area')
        area.setAttribute('points', g.area)
        area.setAttribute('fill', 'currentColor')
        area.setAttribute('stroke', 'none')
        svg.append(area)
      }

      const line = document.createElementNS(SVG_NS, 'polyline')
      line.setAttribute('data-part', 'line')
      line.setAttribute('points', g.points)
      line.setAttribute('fill', 'none')
      line.setAttribute('stroke', 'currentColor')
      line.setAttribute('vector-effect', 'non-scaling-stroke')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('stroke-linejoin', 'round')
      svg.append(line)

      // One replaceChildren(svg) per change — whole-array swap semantics (SPEC-R2; no incremental
      // patching of a 2-node tree).
      this.replaceChildren(svg)
    })

    // ARIA effect (reads label, values): the generated accessible name — recomputed on either input.
    // Never null, never aria-hidden (SPEC-R4 AC2: no silent state, with or without a label).
    this.effect(() => {
      this.internals.ariaLabel = sparklineSummary(this.label, sparklineGeometry(cleanSeries(this.values)))
    })
  }
}

if (!customElements.get('ui-sparkline')) customElements.define('ui-sparkline', UISparklineElement) // idempotent self-define
