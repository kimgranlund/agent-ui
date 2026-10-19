import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'
import { glyphBox, rootResolve } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)
import { server, cdp } from 'vitest/browser'

// Phase-1 s13 — the CROSS-ENGINE geometry + forced-colors smoke (the gold geometry PROOF; goals §G5 DoD).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances). Where the
// s11 static probe (button-geometry.test.ts) pins the DECLARED calc()s, this pins the RENDERED px a real
// engine resolves — and it is ANTI-VACUOUS BOTH WAYS: it asserts the px genuinely CHANGE where the law
// says they must, and stay INVARIANT where the law says they must not.
//
// The two laws under proof (references/geometry.md · ADR-0006 host-as-grid):
//   • FRAME ∝ height — block-size + the h/2 inline-pads ride [size] and [scale] (--md-sys-scale), NOT density.
//   • RHYTHM ∝ font — the icon↔label gap (--md-sys-gap) rides [density] (the ONE density-bearing quantity).
// The sharp ADR-0006 pair: [density] MOVES the icon+label gap but leaves the bare-label FRAME untouched.
//
// Side-effect imports — same load-bearing CSS order as the s12 harness (ADR-0003): foundation roles +
// dimensional ramp FIRST, then the component sheet, then the self-defining `all` entry. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ── markup: the two variants the smoke proves in parallel ───────────────────────────────────────────
const BARE = '<ui-button>Label</ui-button>' //                          slotless — density-INVARIANT frame
const ICON = '<ui-button><span slot="leading" data-role="icon">●</span>Label</ui-button>' // host-as-grid — density-BEARING gap
// icon-only via a REAL slotted adornment, NO label content at all — the fifth structure this suite regression-guards.
const ICON_ONLY = '<ui-button icon-only aria-label="Dismiss"><span slot="leading" data-role="icon">●</span></ui-button>'

// ── mount/cleanup: each button rides a wrapper that carries the [scale]/[density] ancestor attributes
// (the region axes data-tier / data-scale, ADR-0245; custom props inherit down to the host). ──
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; btn: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, btn: wrap.querySelector('ui-button') as HTMLElement }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

// ── computed-px reads (a real engine resolves the --ui-button-* token chain to used lengths) ─────────
const px = (v: string): number => Number.parseFloat(v)
const frameHeight = (btn: HTMLElement): number => px(getComputedStyle(btn).blockSize) // the vertical lever
const frameWidth = (btn: HTMLElement): number => btn.getBoundingClientRect().width // the WHOLE rendered box, not a per-part px
const fontPx = (btn: HTMLElement): number => px(getComputedStyle(btn).fontSize)
const gapPx = (btn: HTMLElement): number => px(getComputedStyle(btn).columnGap) // the icon↔label rhythm
const padStartPx = (btn: HTMLElement): number => px(getComputedStyle(btn).paddingInlineStart)
const padEndPx = (btn: HTMLElement): number => px(getComputedStyle(btn).paddingInlineEnd)
/** The label part's own inset (the control rule, ADR-0245 Amendment 4): n - c on each inline side. */
const labelInsetPx = (btn: HTMLElement): number => px(getComputedStyle(btn.querySelector('[data-part="label"]') as HTMLElement).paddingInlineStart)

/** Alpha channel of a computed colour — 0 ⇒ the ink/border has VANISHED, > 0 ⇒ it is still painted. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1 // a bare system-colour keyword (no rgb() wrapper) is opaque/visible
  const parts = m[1].split(/[\s,/]+/).filter(Boolean) // handles `r, g, b, a` and `r g b / a`
  return parts.length >= 4 ? Number(parts[3]) : 1
}

const allDistinct = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === xs.length

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-button cross-engine geometry + forced-colors smoke (s13)', () => {
  it('[size] sm→md→lg CHANGES the frame height + font px — on BOTH the bare and icon+label variants', () => {
    for (const markup of [BARE, ICON]) {
      const { btn } = mount(markup)
      const heights: number[] = []
      const fonts: number[] = []
      for (const size of ['sm', 'md', 'lg'] as const) {
        btn.setAttribute('size', size)
        heights.push(frameHeight(btn))
        fonts.push(fontPx(btn))
      }
      // The derived ramp at the root register (product / md), ADR-0245 cl.3: height 4n, font = control type.
      const ramp = (['sm', 'md', 'lg'] as const).map((s) => rootResolve(s))
      expect(heights[0]).toBeCloseTo(ramp[0].h, 0)
      expect(heights[1]).toBeCloseTo(ramp[1].h, 0)
      expect(heights[2]).toBeCloseTo(ramp[2].h, 0)
      expect(fonts[0]).toBeCloseTo(ramp[0].type.control, 0)
      expect(fonts[1]).toBeCloseTo(ramp[1].type.control, 0)
      expect(fonts[2]).toBeCloseTo(ramp[2].type.control, 0)
      // anti-vacuous: the three steps are genuinely DISTINCT px — the [size] lever truly moved the frame.
      expect(allDistinct(heights), `heights did not change across [size]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `fonts did not change across [size]: ${fonts.join()}`).toBe(true)
    }
  })

  it('ADR-0245 cl.2: HEIGHT and FONT follow the region register (4n and n + 6), md base, BOTH variants', () => {
    // The six old [scale] registers as tier / scale; each md button is 4n tall with control type n + 6.
    const REGISTERS = [['widget', 'sm'], ['product', 'sm'], ['product', 'md'], ['content', 'sm'], ['content', 'md'], ['content', 'lg']] as const
    for (const markup of [BARE, ICON]) {
      const { wrap, btn } = mount(markup) // size stays md (default)
      for (const [tier, scale] of REGISTERS) {
        wrap.setAttribute('data-tier', tier)
        wrap.setAttribute('data-scale', scale)
        const r = resolve(tier, scale, 'md')
        expect(frameHeight(btn), `height @ ${tier} / ${scale}`).toBeCloseTo(r.height, 1)
        expect(fontPx(btn), `font @ ${tier} / ${scale}`).toBe(r.type.control)
      }
    }
  })

  it('ADR-0245: sampled size × register cells render resolve() integers (height, font, icon box)', () => {
    const iconPx = (b: HTMLElement): number =>
      px(getComputedStyle(b.querySelector('[data-role="icon"]') as HTMLElement).width) // explicit inline-size → exact px
    const read = (size: 'sm' | 'md' | 'lg', tier: string | null, scale: string | null): { h: number; f: number; icon: number } => {
      const { wrap, btn } = mount(ICON)
      btn.setAttribute('size', size)
      if (tier) wrap.setAttribute('data-tier', tier)
      if (scale) wrap.setAttribute('data-scale', scale)
      return { h: frameHeight(btn), f: fontPx(btn), icon: iconPx(btn) }
    }
    const cells = [
      ['lg', 'content', 'lg'],
      ['md', 'content', 'lg'],
      ['md', null, null],
      ['lg', null, null],
      ['sm', 'widget', 'sm'],
    ] as const
    for (const [size, tier, scale] of cells) {
      const r = resolve(tier ?? 'product', scale ?? 'md', size)
      const got = read(size, tier, scale)
      expect(got, `${size} @ ${tier ?? 'root'} / ${scale ?? 'md'}`).toEqual({ h: r.height, f: r.type.control, icon: r.iconBox })
      expect(Number.isInteger(got.f) && Number.isInteger(got.icon), 'derived values are whole px (M7)').toBe(true)
    }
  })

  it('a region data-scale moves the icon to label distance with n: the gutter c plus the label inset n - c (the icon+label variant)', () => {
    const { wrap, btn } = mount(ICON) // md size
    const gutters: number[] = []
    const distances: number[] = []
    for (const scale of ['sm', 'md', 'lg'] as const) {
      wrap.setAttribute('data-scale', scale)
      gutters.push(gapPx(btn))
      distances.push(gapPx(btn) + labelInsetPx(btn))
    }
    // ADR-0245 Amendment 4: the column-gap is the control gutter c, and the label inset n - c makes icon to text n
    expect(gutters).toEqual((['sm', 'md', 'lg'] as const).map((s) => resolve('product', s, 'md').c))
    expect(distances).toEqual((['sm', 'md', 'lg'] as const).map((s) => resolve('product', s, 'md').inset))
    expect(allDistinct(distances), `icon to label did not change across data-scale: ${distances.join()}`).toBe(true)
  })

  it('a region data-scale moves the bare-label FRAME too: block-size 4n, the box margin n and the label inset n - c (one n, ADR-0245 Amendment 4)', () => {
    const { wrap, btn } = mount(BARE) // md size
    for (const scale of ['sm', 'md', 'lg'] as const) {
      wrap.setAttribute('data-scale', scale)
      const r = resolve('product', scale, 'md')
      expect(frameHeight(btn), `height @ ${scale}`).toBeCloseTo(r.height, 0)
      expect(padStartPx(btn), `leading box margin @ ${scale}`).toBeCloseTo(r.inset, 0)
      expect(padEndPx(btn), `trailing box margin @ ${scale}`).toBeCloseTo(r.inset, 0)
      expect(labelInsetPx(btn), `label inset @ ${scale}`).toBeCloseTo(r.labelInset, 0)
      expect(padStartPx(btn) + labelInsetPx(btn), `text edge 2n - c @ ${scale}`).toBeCloseTo(2 * r.n - r.c, 0)
    }
  })

  it('REVERSED anatomy [caret|label|icon]: the inline-pads are SYMMETRIC ½(h−icon) (role-AGNOSTIC), and the LEADING caret glyph = font < icon', () => {
    // ADR-0012: POSITION (slot) ⊥ ROLE (data-role). Put a CARET in the leading slot and an ICON in the
    // trailing slot — the reversed structure. Two laws under proof on the reversed config:
    //   • PADDING is SLOT-PRESENCE-driven (role-AGNOSTIC): both slots present ⇒ start = end = ½(h−icon). The
    //     pad must NOT track which role sits where — the caret leading does not widen/narrow the start pad.
    //   • BTN-CARET on the LEADING edge: the caret GLYPH is font-sized (< the icon-sized cell), centered — the
    //     affordance is not oversized just because it leads (the law holds either edge, not only trailing).
    const { btn } = mount(
      '<ui-button><svg slot="leading" data-role="caret"></svg>Label<span slot="trailing" data-role="icon">●</span></ui-button>',
    )
    const caret = btn.querySelector('[data-role="caret"]') as HTMLElement

    const h = frameHeight(btn) //   md frame (border-box height) = 28
    const font = fontPx(btn) //     md font = 14
    const iconCell = caret.getBoundingClientRect().width // the leading caret CELL is icon-sized = --ui-button-icon = 18

    // [1] symmetric + role-agnostic pads: both slots present ⇒ start = end = ½(h−icon) (= 5 @ md), regardless
    // of which ROLE fills which slot. If start ≠ end here, the padding tracked the role (a real bug — escalate).
    const start = padStartPx(btn)
    const end = padEndPx(btn)
    expect(start, `reversed inline-pads are not symmetric — padding tracked role not slot-presence: ${start} vs ${end}`).toBeCloseTo(end, 1)
    expect(start, 'leading inline-pad is not ½(h−icon)').toBeCloseTo((h - iconCell) / 2, 1)
    expect(end, 'trailing inline-pad is not ½(h−icon)').toBeCloseTo((h - iconCell) / 2, 1)

    // [2] anti-vacuous (BTN-CARET on the LEADING side): the leading caret's GLYPH content box = font (14), and
    // is STRICTLY smaller than its icon-sized cell (18) — NOT the named --ui-ind oversize bug on the lead edge.
    const cs = getComputedStyle(caret)
    const caretContent = caret.getBoundingClientRect().width - px(cs.paddingInlineStart) - px(cs.paddingInlineEnd)
    expect(caretContent, 'leading caret content box is not glyph-sized (the --ui-ind oversize bug on the leading edge)').toBeCloseTo(glyphBox(rootResolve('md')), 0)
    expect(caretContent, 'leading caret glyph is not strictly smaller than its icon-sized cell').toBeLessThan(iconCell)
    // font <= icon cell, not <: the control type n + 6 TIES the 2n icon box at n 6 (an sm control at the root);
    // the strict form held only from n 7 up (skill v2). The glyph assertion above still proves caret < icon.
    expect(font, 'font exceeds the icon cell').toBeLessThanOrEqual(iconCell)
  })

  it('ADR-0036 line-height = font: computed line-height on the host equals font-size (single-line control standard)', () => {
    // ADR-0036 law: a single-line Control-class control sets line-height: 1 (via --md-sys-control-line-height
    // from dimensions.css), so its line box equals the em height and the host grid centers it cleanly.
    // AC1 proof: computed line-height px == computed font-size px. Sampled at two sizes for anti-vacuity
    // (proves line-height tracks font, not a fixed px residual from an ancestor 1.5 inheritance).
    const { btn } = mount(BARE)
    btn.setAttribute('size', 'md')
    const fontMd = fontPx(btn)
    const lhMd = px(getComputedStyle(btn).lineHeight)
    expect(lhMd, 'md line-height is not equal to md font-size').toBeCloseTo(fontMd, 0)

    btn.setAttribute('size', 'sm')
    const fontSm = fontPx(btn)
    const lhSm = px(getComputedStyle(btn).lineHeight)
    expect(lhSm, 'sm line-height is not equal to sm font-size').toBeCloseTo(fontSm, 0)

    // anti-vacuous: the two sizes render different font/line-height (the assertion is not trivially true of any constant)
    expect(fontMd, 'md and sm font-sizes must differ so the line-height proof is non-vacuous').not.toBe(fontSm)
  })

  it('forced-colors keeps the ink + border visible — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const { btn } = mount(BARE)

    // Baseline (BOTH engines, normal mode): the solid button paints a visible (opaque) ink, and its
    // border is the family default `transparent` (alpha 0) — no painted outline yet.
    const baseInk = alphaOf(getComputedStyle(btn).color)
    const baseBorder = alphaOf(getComputedStyle(btn).borderTopColor)
    expect(baseInk, 'ink should be visible in normal mode').toBeGreaterThan(0)
    expect(baseBorder, 'border should be transparent in normal mode (--ui-button-border: transparent)').toBe(0)

    if (server.browser !== 'chromium') {
      // WebKit (this build's other engine) exposes no CDP / forced-colors emulation — the documented
      // cross-engine split. Assert the engine is genuinely NOT in forced-colors (so we are not silently
      // faking the Chromium proof) and stop; the forced-colors leg is proven in Chromium below.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    // Chromium: emulate forced-colors via CDP `Emulation.setEmulatedMedia` — reached straight from the
    // test through @vitest/browser's cdp() (no harness/config change). This is what Playwright's
    // emulateMedia({ forcedColors }) drives under the hood; CDP is Chromium-only by construction.
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      // anti-vacuous: the engine REALLY entered forced-colors, so button.css's `@media (forced-colors:
      // active)` block is the one applying — not a no-op.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      const fcInk = alphaOf(getComputedStyle(btn).color)
      const fcBorder = alphaOf(getComputedStyle(btn).borderTopColor)
      // The ink did NOT vanish — it resolves to an opaque system colour (ButtonText).
      expect(fcInk, 'ink vanished under forced-colors').toBeGreaterThan(0)
      // The outline APPEARED — the FC rule repaints the transparent border to a visible ButtonText
      // (alpha 0 → opaque). The sharp proof the forced-colors block is load-bearing.
      expect(fcBorder, 'border stayed invisible under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset the emulation
    }
  })
})

// ── [icon-only]: the fifth structure — a real slotted adornment with NO label at all ──────────────────
// The gap this closes: `:has()` only matches ELEMENTS, so a bare TEXT-NODE label (the common
// `<svg slot=leading>…</svg>Download` pattern) is invisible to CSS — a slotted icon with an EMPTY label
// still fell into the `[leading | label]` structure (auto 1fr), reserving a dead 1fr track + its h/2
// trailing pad, rendering wider than tall. `icon-only` is the explicit author opt-in that swaps in a
// genuine square. This asserts the WHOLE rendered bounding box (not a per-part px) at every [size], AND
// that the pre-existing `[leading | label]`-with-real-text structure is completely unaffected.
describe('ui-button [icon-only]: a slotted adornment with NO label renders a genuine SQUARE (s14)', () => {
  it('block-size == inline-size (the WHOLE rendered box) at every [size] — the regression this closes', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { btn } = mount(ICON_ONLY)
      btn.setAttribute('size', size)
      const h = frameHeight(btn)
      const w = frameWidth(btn)
      expect(h, `[icon-only size=${size}] height did not resolve to a real px`).toBeGreaterThan(0)
      expect(w, `[icon-only size=${size}] is NOT square: width ${w} != height ${h}`).toBeCloseTo(h, 0)
    }
  })

  it('the rendered inset is SYMMETRIC ½(h−icon) on both sides — no h/2 label pad, no column-gap dead space', () => {
    // Centering rides `justify-content` (no literal padding-inline — computed paddingInlineStart/End read
    // 0), so the inset is measured GEOMETRICALLY off the rendered bounding boxes, not the CSS padding
    // property — the "test the whole shape" precedent.
    const { btn } = mount(ICON_ONLY) // md size
    const h = frameHeight(btn)
    const btnRect = btn.getBoundingClientRect()
    const iconRect = (btn.querySelector('[data-role="icon"]') as HTMLElement).getBoundingClientRect()
    const insetStart = iconRect.left - btnRect.left
    const insetEnd = btnRect.right - iconRect.right
    expect(insetStart, 'leading inset is not ½(h−icon)').toBeCloseTo((h - iconRect.width) / 2, 0)
    expect(insetEnd, 'trailing inset is not ½(h−icon)').toBeCloseTo((h - iconRect.width) / 2, 0)
    expect(insetStart, 'icon-only insets are not symmetric').toBeCloseTo(insetEnd, 0)
  })

  it('REGRESSION GUARD: the [leading | label]-with-real-text structure keeps the control rule: equal host pads n, a label edge of n + the label inset, still wider than tall', () => {
    // Re-derived for ADR-0245 Amendment 4. The old law read "asymmetric host pads" (½(h−icon) against h/2); the
    // host pads are equal at n now and the asymmetry lives on the text: the icon sits n from its edge, the label
    // text n + labelMargin = 2n - c from its edge.
    const { btn } = mount(ICON) // real text label, no icon-only attribute
    const h = frameHeight(btn)
    const w = frameWidth(btn)
    const start = padStartPx(btn)
    const end = padEndPx(btn)
    const n = h / 4
    const c = Math.ceil(n / 4)
    expect(w, 'the real-label case must stay WIDER than the square frame (it carries a label)').toBeGreaterThan(h)
    expect(start, 'the leading pad is the ½(h−icon) slot edge, n').toBeCloseTo(n, 1)
    expect(end, 'the label edge is the box margin, n').toBeCloseTo(n, 1)
    expect(labelInsetPx(btn), 'the label part carries the inset n - c').toBeCloseTo(n - c, 1)
    expect(end + labelInsetPx(btn), 'the text edge is n + labelMargin = 2n - c').toBeCloseTo(2 * n - c, 1)
    expect(end + labelInsetPx(btn), 'the text edge still differs from the icon edge').not.toBeCloseTo(start, 1)
  })
})
