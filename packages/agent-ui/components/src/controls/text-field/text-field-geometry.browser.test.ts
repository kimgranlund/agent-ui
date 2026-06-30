import { describe, it, expect, afterEach } from 'vitest'

// s11 (geometry leg) — the CROSS-ENGINE geometry smoke for ui-text-field (decomp g4-g6 node s11). Where the
// jsdom text-field-geometry.test.ts (s9) pins the DECLARED calc()s, this pins the RENDERED px a real engine
// resolves — and it is ANTI-VACUOUS: it asserts the px genuinely CHANGE where the sizing law says they must
// (across [size] and [scale]), not a vacuous equal-to-self. Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts → the two playwright instances). Sibling to button-geometry.browser.test.ts (G5
// s13) — same harness, same load-bearing CSS order.
//
// The laws under proof (references/geometry.md — the field is a Control-class component, ADR-0014):
//   • FRAME ∝ height — the host block-size rides [size] and [scale] (--ui-scale).
//   • EDITOR FONT ∝ font — the contenteditable editor's font rides the same [size]/[scale] ramp.
//   • VALUE EDGE = h/2 — the value-side inline pad is half the frame height (the per-edge formula); a leading
//     adornment's slot edge is ½(h − icon). Proven on BOTH the bare and the leading-icon variants.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet (text-field's :where() token block + @scope geometry), then the self-defining
// family barrel (registers ui-text-field). Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// ── markup: the two variants the smoke proves in parallel (the editor is control-injected on connect) ───
const BARE = '<ui-text-field></ui-text-field>' //                                       slotless — value edge h/2 both sides
const ICON = '<ui-text-field><span slot="leading" data-role="icon">●</span></ui-text-field>' // leading slot edge ½(h−icon)

// ── mount/cleanup: each field rides a wrapper carrying the [scale] ancestor attribute (dimensions.css keys
// off bare `[scale="…"]`; the custom props inherit down to the host). ──────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; field: HTMLElement; editor: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const field = wrap.querySelector('ui-text-field') as HTMLElement
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement // created on connect (append above)
  return { wrap, field, editor }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

// ── computed-px reads (a real engine resolves the --ui-text-field-* token chain to used lengths) ────────
const px = (v: string): number => Number.parseFloat(v)
const frameHeight = (field: HTMLElement): number => px(getComputedStyle(field).blockSize) // the vertical lever
const fontPx = (el: HTMLElement): number => px(getComputedStyle(el).fontSize)
const padStartPx = (field: HTMLElement): number => px(getComputedStyle(field).paddingInlineStart)
const padEndPx = (field: HTMLElement): number => px(getComputedStyle(field).paddingInlineEnd)

const allDistinct = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === xs.length
const allEqual = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === 1

describe('ui-text-field cross-engine geometry smoke (s11, both engines)', () => {
  it('[size] sm→md→lg CHANGES the frame height + the editor font px — on BOTH the bare and leading-icon variants', () => {
    for (const markup of [BARE, ICON]) {
      const { field, editor } = mount(markup)
      const heights: number[] = []
      const fonts: number[] = []
      for (const size of ['sm', 'md', 'lg'] as const) {
        field.setAttribute('size', size)
        heights.push(frameHeight(field))
        fonts.push(fontPx(editor)) // the editor font rides --ui-text-field-font (the centre value cell)
      }
      // the control-band ramp @ scale 1 (geometry-sizing-spec §1): height 24·28·36, font 13·14·16.
      expect(heights[0]).toBeCloseTo(24, 0)
      expect(heights[1]).toBeCloseTo(28, 0)
      expect(heights[2]).toBeCloseTo(36, 0)
      expect(fonts[0]).toBeCloseTo(13, 0)
      expect(fonts[1]).toBeCloseTo(14, 0)
      expect(fonts[2]).toBeCloseTo(16, 0)
      // anti-vacuous: the three steps are genuinely DISTINCT px — the [size] lever truly moved the frame + font.
      expect(allDistinct(heights), `heights did not change across [size]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `editor fonts did not change across [size]: ${fonts.join()}`).toBe(true)
    }
  })

  it('[scale] ui-sm→content-lg CHANGES the frame height + the editor font px (via --ui-scale) — on BOTH variants', () => {
    for (const markup of [BARE, ICON]) {
      const { wrap, field, editor } = mount(markup) // size stays md (default)
      const heights: number[] = []
      const fonts: number[] = []
      for (const scale of ['ui-sm', 'ui-md', 'content-lg'] as const) {
        wrap.setAttribute('scale', scale)
        heights.push(frameHeight(field))
        fonts.push(fontPx(editor))
      }
      // md base (28/14) × --ui-scale {0.875, 1, 1.75} — [scale] multiplies the WHOLE frame + the font.
      expect(heights[0]).toBeCloseTo(24.5, 1)
      expect(heights[1]).toBeCloseTo(28, 1)
      expect(heights[2]).toBeCloseTo(49, 1)
      expect(fonts[0]).toBeCloseTo(12.25, 1)
      expect(fonts[1]).toBeCloseTo(14, 1)
      expect(fonts[2]).toBeCloseTo(24.5, 1)
      expect(allDistinct(heights), `heights did not change across [scale]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `editor fonts did not change across [scale]: ${fonts.join()}`).toBe(true)
    }
  })

  it('BARE: the value edge == h/2 on BOTH inline sides (the slotless value-edge formula)', () => {
    const { field } = mount(BARE) // md frame @ scale 1 → h = 28, value edge = 14 each side
    const h = frameHeight(field)
    expect(padStartPx(field), 'leading value edge is not h/2').toBeCloseTo(h / 2, 1)
    expect(padEndPx(field), 'trailing value edge is not h/2').toBeCloseTo(h / 2, 1)
    // anti-vacuous: the edge tracks the frame — it really is half of a positive frame height.
    expect(h, 'frame height is not a positive px').toBeGreaterThan(0)
  })

  it('LEADING-ICON: the trailing value edge == h/2 and the leading slot edge == ½(h−icon); 0 < icon ≤ box', () => {
    const { field } = mount(ICON) // md @ scale 1 → h = 28, icon = 18, slot edge = ½(28−18) = 5, value edge = 14
    const leadingCell = field.querySelector('[slot="leading"]') as HTMLElement
    const h = frameHeight(field)
    const icon = leadingCell.getBoundingClientRect().width // the icon-sized slot cell (--ui-text-field-icon)

    expect(padEndPx(field), 'trailing value edge is not h/2').toBeCloseTo(h / 2, 1)
    expect(padStartPx(field), 'leading slot edge is not ½(h−icon)').toBeCloseTo((h - icon) / 2, 1)
    // the icon ramp law: 0 < icon ≤ box (the cell never exceeds the frame).
    expect(icon, 'icon cell is not a positive px').toBeGreaterThan(0)
    expect(icon, 'the icon cell exceeds the box height').toBeLessThanOrEqual(h + 0.5)
    // anti-vacuous: the two edges are genuinely DIFFERENT px (the slot edge is smaller than the value edge),
    // so the per-edge ½(h−icon) vs h/2 split is real — not both collapsing onto one pad.
    expect(padStartPx(field), 'the slot edge did not differ from the value edge (per-edge formula collapsed)').toBeLessThan(
      padEndPx(field),
    )
  })

  // ── ADR-0021: the entry-control min-inline-size floor (native <input size> parity) ──────────────────────
  it('BARE+unsized: carries the min-inline-size typing-width floor — offsetWidth ≥ the resolved ~20ch, NOT the ~0 collapse', () => {
    const { field } = mount(BARE) // no [size], empty — the exact case the s11 smoke caught collapsing the 1fr editor cell
    const floorPx = px(getComputedStyle(field).minInlineSize) // 20ch resolves to an absolute px on a real engine
    // the floor resolved to a real, substantial typing width (native <input size> parity), not a zero/symbolic value.
    expect(floorPx, 'the --ui-text-field-min-inline-size floor did not resolve to a positive px').toBeGreaterThan(0)
    // the bare field's box is held open to AT LEAST the floor — a real pointer can land on it.
    const withFloor = field.offsetWidth
    expect(withFloor, 'the bare field is narrower than its min-inline-size floor').toBeGreaterThanOrEqual(Math.floor(floorPx))
    // NON-VACUOUS — the floor is load-bearing: REMOVE it (host min-inline-size → 0) and the unsized 1fr editor
    // collapses the box back to just its frame chrome, far below the floor (the ~0 typing sliver this fixes). So
    // the assertion above is not vacuously true of any field — it FAILS if the floor is gone.
    field.style.minInlineSize = '0'
    const withoutFloor = field.offsetWidth
    expect(withoutFloor, 'removing the floor did NOT shrink the field below the floor — the floor is not load-bearing').toBeLessThan(
      floorPx,
    )
    expect(withFloor - withoutFloor, 'the floor did not meaningfully widen the bare field').toBeGreaterThan(20)
  })

  // ── ADR-0006 / geometry.md: [density] rides the rhythm (the slot↔editor gap), NEVER the frame (C6 polish) ──
  it('[density] compact→spacious CHANGES the adornment↔editor column-gap (--ui-text-field-gap); the BARE frame is INVARIANT', () => {
    // density multiplies the ONE rhythm quantity (the slot↔editor column-gap) on the leading-icon grid, while the
    // frame (block-size + the h/2 value edges) holds — the sharp ADR-0006 split, mirrored from the button smoke.
    const icon = mount(ICON) // size stays md (default); the `auto 1fr` grid carries the column-gap
    const gaps: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      icon.wrap.setAttribute('density', density)
      gaps.push(px(getComputedStyle(icon.field).columnGap)) // the slot↔editor rhythm
    }
    // gap_md = font_md / 2 × --ui-density = 7 × {0.5, 1, 1.5} @ scale 1 (the one density-bearing quantity).
    expect(gaps[0]).toBeCloseTo(3.5, 1)
    expect(gaps[1]).toBeCloseTo(7, 1)
    expect(gaps[2]).toBeCloseTo(10.5, 1)
    // anti-vacuous: the three gaps are genuinely DISTINCT px — [density] truly moved the rhythm.
    expect(allDistinct(gaps), `the column-gap did not change across [density]: ${gaps.join()}`).toBe(true)

    // the COMPLEMENTARY invariant: density rides the gap ONLY — the BARE field's frame must NOT move (geometry.md).
    const bare = mount(BARE)
    const heights: number[] = []
    const valueEdges: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      bare.wrap.setAttribute('density', density)
      heights.push(frameHeight(bare.field))
      valueEdges.push(padStartPx(bare.field))
    }
    expect(allEqual(heights), `[density] moved the bare frame height: ${heights.join()}`).toBe(true)
    expect(allEqual(valueEdges), `[density] moved the bare h/2 value edge: ${valueEdges.join()}`).toBe(true)
  })
})
