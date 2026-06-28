import { describe, it, expect, afterEach } from 'vitest'

// s6 (browser leg) — the CROSS-ENGINE smoke for ui-grid (decomp g9-containers node s6). Where the jsdom
// grid.test.ts pins the structural contract and grid-css.test.ts pins the declared CSS, this pins the RENDERED
// behaviour a real engine resolves — and it is ANTI-VACUOUS: the column track count genuinely CHANGES where
// the auto-fit/minmax law says it must (across CONTAINER width AND the `min` floor), and the gap responds to
// `[density]`. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
//
// The laws under proof:
//   • INTRINSIC reflow (ADR-0016 cl.3/4) — `repeat(auto-fit, minmax(min, 1fr))` reflows the track count by the
//     grid's OWN width: resize the WRAPPER (the container), not the viewport, and the column count changes.
//   • `min` (the minmax floor) — a smaller floor packs MORE tracks at a fixed width; a larger floor packs fewer
//     (proves the grid.ts --ui-grid-min token thread is live in a real engine).
//   • gap rides --ui-space × [density] (layout rhythm, ADR-0015 cl.4) — an ancestor [density] changes the gap px.
//
// HOST-AT-BOUNDARY: ui-grid is NOT in the component-styles barrel yet (that is s12), so this injects the
// load-bearing sheets DIRECTLY in CSS order — foundation (the --c-* roles + --ui-space ramp + [density]) FIRST,
// then the SHARED surface seam (which also establishes `container-type: inline-size`), then grid's own @scope
// sheet, then the self-defining module (registers ui-grid). Vite injects the CSS imports.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import './grid.css'
import './grid.ts'

// ── mount/cleanup: a width-constrained WRAPPER (the query container) holding a ui-grid + N items ──────────
const mounted: HTMLElement[] = []
const mount = (itemCount: number): { wrap: HTMLElement; grid: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.boxSizing = 'border-box'
  const grid = document.createElement('ui-grid')
  for (let i = 0; i < itemCount; i++) {
    const item = document.createElement('div')
    item.textContent = String(i)
    grid.append(item)
  }
  wrap.append(grid)
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, grid }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

// The resolved track count: getComputedStyle returns the USED track list (each track a px in a real engine);
// count the px tokens. With ≥ tracks items, auto-fit collapses none (the first row fills every fitting track).
const trackCount = (grid: HTMLElement): number => (getComputedStyle(grid).gridTemplateColumns.match(/px/g) ?? []).length
const px = (v: string): number => Number.parseFloat(v)
// `min` rides the grid.ts --ui-grid-min thread, an EFFECT (the kernel batches re-runs on a microtask), so a
// post-mount `min` change must settle before the track count is measured. Width/[density]/[elevation] changes
// are CSS-selector-driven (no effect) and need no settle — getComputedStyle forces the layout itself.
const settle = (el: HTMLElement): Promise<void> => (el as unknown as { updateComplete: Promise<void> }).updateComplete

describe('ui-grid cross-engine auto-fit reflow smoke (s6, both engines)', () => {
  it('reflows the COLUMN COUNT by CONTAINER width (resize the wrapper, not the viewport) — anti-vacuous', async () => {
    const { wrap, grid } = mount(12)
    grid.setAttribute('min', '100px') // a deterministic floor (avoids the rem/root-font default)
    await settle(grid) // let the --ui-grid-min thread apply before measuring

    wrap.style.inlineSize = '640px'
    const wide = trackCount(grid) // ≈ floor(640 / 100) = 6 tracks

    wrap.style.inlineSize = '240px'
    const narrow = trackCount(grid) // ≈ floor(240 / 100) = 2 tracks

    // the law: the SAME grid reflows to FEWER columns under a narrower container — purely by its own width.
    expect(wide).toBeGreaterThan(narrow)
    expect(narrow).toBeGreaterThanOrEqual(1) // never collapses below one track
    expect(wide).toBeGreaterThanOrEqual(3) // a genuinely wide grid (anti-vacuous — not 1-vs-1)
  })

  it('the `min` floor changes the track count at a FIXED width (the --ui-grid-min thread is live)', async () => {
    const { wrap, grid } = mount(12)
    wrap.style.inlineSize = '640px'

    grid.setAttribute('min', '100px')
    await settle(grid)
    const dense = trackCount(grid) // ≈ 6

    grid.setAttribute('min', '300px')
    await settle(grid)
    const roomy = trackCount(grid) // ≈ floor(640 / 300) = 2

    expect(dense).toBeGreaterThan(roomy) // a smaller floor packs MORE tracks — the prop threads into minmax()
  })

  it('the gap responds to an ancestor [density] (layout rhythm off --ui-space, ADR-0015 cl.4)', () => {
    const { wrap, grid } = mount(6)
    wrap.style.inlineSize = '640px'
    grid.setAttribute('gap', 'md') // --ui-space-md = calc(12px * var(--ui-density))

    const gaps: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      wrap.setAttribute('density', density)
      gaps.push(px(getComputedStyle(grid).columnGap))
    }
    // md base 12px × --ui-density {0.5, 1, 1.5} → 6 · 12 · 18 — [density] re-multiplies the layout gap.
    expect(gaps[0]).toBeCloseTo(6, 0)
    expect(gaps[1]).toBeCloseTo(12, 0)
    expect(gaps[2]).toBeCloseTo(18, 0)
    expect(new Set(gaps.map((g) => g.toFixed(2))).size).toBe(3) // anti-vacuous: the three gaps are genuinely distinct
  })

  it('resolves the shared surface seam — [elevation] paints a real background-color (container.css)', () => {
    const { grid } = mount(3)
    const bare = getComputedStyle(grid).backgroundColor // unset ⇒ transparent
    grid.setAttribute('elevation', '2')
    const raised = getComputedStyle(grid).backgroundColor // [elevation=2] repoints --ui-container-bg to a real role
    expect(raised).not.toBe(bare) // the shared elevation×brightness seam covers ui-grid (anti-vacuous)
    expect(raised).toMatch(/^(rgb|oklch|color\()/) // a resolved colour (the tokens are oklch), not a token string
    expect(raised).not.toMatch(/^rgba\(0, 0, 0, 0\)$/) // not transparent — a real plane painted
  })
})
