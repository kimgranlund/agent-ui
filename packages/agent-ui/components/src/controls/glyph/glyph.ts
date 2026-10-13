// glyph.ts: UIGlyphElement, the functional-mark display atom (ADR-0245 clauses 4 and 5). <ui-glyph
// symbol="caret-down"> draws one mark from the closed twelve-mark set as an inline SVG stroke path from the
// library path table (glyph-paths.ts). An icon is pictorial pack art in a 2n box; a glyph is library geometry
// in a 2n - 2c box. The host is the shared 2n slot, inset c on each side, so an icon and a glyph in
// neighbouring slots share the slot box and the centre line. Light-DOM, self-defining, no traits.
//
// Two props, two connected() effects, the ui-icon shape:
//   • `symbol`: the mark name (the same prop ui-icon takes). An empty symbol clears the host; a name outside
//     the closed set renders an empty `<svg data-glyph-missing>` rather than guessing, the resolve.ts
//     missing-icon precedent. A plain string, not an enum: an enum codec snaps an unknown attribute to its
//     first member, which would draw a real mark for a typo.
//   • `label`: decorative by default (aria-hidden); non-empty makes the mark meaningful (role=img +
//     aria-label). ARIA via ElementInternals only, never a host attribute.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { GLYPH_MARKS, GLYPH_VIEWBOX, isGlyphSymbol } from './glyph-paths.ts'

export { GLYPH_MARKS, GLYPH_SYMBOLS, isGlyphSymbol, type GlyphSymbol } from './glyph-paths.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

const props = {
  symbol: prop.string(''), // a GlyphSymbol; empty renders nothing, an unknown name renders an empty data-glyph-missing svg
  label: { ...prop.string(''), reflect: true }, // non-empty: meaningful (role=img + aria-label); empty: decorative (aria-hidden)
} satisfies PropsSchema

/** A fresh `<svg>` for `symbol`; an unknown name yields an empty `<svg data-glyph-missing="name">`. */
export function renderGlyph(symbol: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  if (!isGlyphSymbol(symbol)) {
    svg.setAttribute('data-glyph-missing', symbol)
    return svg
  }
  const mark = GLYPH_MARKS[symbol]
  const filled = 'filled' in mark && mark.filled === true
  svg.setAttribute('viewBox', GLYPH_VIEWBOX)
  svg.setAttribute('fill', filled ? 'currentColor' : 'none')
  svg.setAttribute('stroke', filled ? 'none' : 'currentColor')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', mark.d)
  path.setAttribute('vector-effect', 'non-scaling-stroke')
  svg.append(path)
  return svg
}

export interface UIGlyphElement extends ReactiveProps<typeof props> {}
export class UIGlyphElement extends UIElement {
  static props = props

  protected override connected(): void {
    // symbol effect: (re)draw the mark on symbol change; an empty symbol clears the host.
    this.effect(() => {
      if (this.symbol) this.replaceChildren(renderGlyph(this.symbol))
      else this.replaceChildren()
    })
    // label effect: decorative (aria-hidden) vs meaningful (role=img + aria-label). ElementInternals only.
    this.effect(() => {
      if (this.label) {
        this.internals.role = 'img'
        this.internals.ariaLabel = this.label
        this.internals.ariaHidden = null
      } else {
        this.internals.role = null
        this.internals.ariaLabel = null
        this.internals.ariaHidden = 'true'
      }
    })
  }
}

if (!customElements.get('ui-glyph')) customElements.define('ui-glyph', UIGlyphElement) // idempotent self-define
