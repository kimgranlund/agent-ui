import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from '@vitest/browser/context'

// Phase-1 s13 — the CROSS-ENGINE geometry + forced-colors smoke (the gold geometry PROOF; goals §G5 DoD).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances). Where the
// s11 static probe (button-geometry.test.ts) pins the DECLARED calc()s, this pins the RENDERED px a real
// engine resolves — and it is ANTI-VACUOUS BOTH WAYS: it asserts the px genuinely CHANGE where the law
// says they must, and stay INVARIANT where the law says they must not.
//
// The two laws under proof (references/geometry.md · ADR-0006 host-as-grid):
//   • FRAME ∝ height — block-size + the h/2 inline-pads ride [size] and [scale] (--ui-scale), NOT density.
//   • RHYTHM ∝ font — the icon↔label gap (--ui-gap) rides [density] (the ONE density-bearing quantity).
// The sharp ADR-0006 pair: [density] MOVES the icon+label gap but leaves the bare-label FRAME untouched.
//
// Side-effect imports — same load-bearing CSS order as the s12 harness (ADR-0003): foundation roles +
// dimensional ramp FIRST, then the component sheet, then the self-defining family barrel. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// ── markup: the two variants the smoke proves in parallel ───────────────────────────────────────────
const BARE = '<ui-button>Label</ui-button>' //                          slotless — density-INVARIANT frame
const ICON = '<ui-button><span slot="leading" data-role="icon">●</span>Label</ui-button>' // host-as-grid — density-BEARING gap

// ── mount/cleanup: each button rides a wrapper that carries the [scale]/[density] ancestor attributes
// (dimensions.css keys off bare `[scale="…"]`/`[density="…"]`; custom props inherit down to the host). ──
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
const fontPx = (btn: HTMLElement): number => px(getComputedStyle(btn).fontSize)
const gapPx = (btn: HTMLElement): number => px(getComputedStyle(btn).columnGap) // the icon↔label rhythm
const padStartPx = (btn: HTMLElement): number => px(getComputedStyle(btn).paddingInlineStart)
const padEndPx = (btn: HTMLElement): number => px(getComputedStyle(btn).paddingInlineEnd)

/** Alpha channel of a computed colour — 0 ⇒ the ink/border has VANISHED, > 0 ⇒ it is still painted. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1 // a bare system-colour keyword (no rgb() wrapper) is opaque/visible
  const parts = m[1].split(/[\s,/]+/).filter(Boolean) // handles `r, g, b, a` and `r g b / a`
  return parts.length >= 4 ? Number(parts[3]) : 1
}

const allDistinct = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === xs.length
const allEqual = (xs: number[]): boolean => xs.every((x) => x === xs[0])

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
      // The control-band ramp @ scale 1 (geometry-sizing-spec §1): height 24·28·36, font 13·14·16.
      expect(heights[0]).toBeCloseTo(24, 0)
      expect(heights[1]).toBeCloseTo(28, 0)
      expect(heights[2]).toBeCloseTo(36, 0)
      expect(fonts[0]).toBeCloseTo(13, 0)
      expect(fonts[1]).toBeCloseTo(14, 0)
      expect(fonts[2]).toBeCloseTo(16, 0)
      // anti-vacuous: the three steps are genuinely DISTINCT px — the [size] lever truly moved the frame.
      expect(allDistinct(heights), `heights did not change across [size]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `fonts did not change across [size]: ${fonts.join()}`).toBe(true)
    }
  })

  it('[scale] ui-sm→content-lg: HEIGHT climbs linearly while FONT STEPS to the §1-SET integers (ADR-0035) — md base, BOTH variants', () => {
    // md base height 28 × --ui-scale (LINEAR); md font = the §1-SET --ui-font-md per tier (ADR-0035, was pow).
    // The font STEPS — adjacent tiers SHARE a value (ui-md/ui-lg both 14, content-sm/md both 16) while the height
    // climbs continuously: the accepted §1-set stepping (NOT pow's smooth curve). content-lg/md = 18, NOT the old
    // linear 24.5 or pow's 18.01. So heights are all-distinct; the fonts are NOT (the plateau is the proof).
    const TIERS: Array<[string, number, number]> = [
      ['ui-sm', 24.5, 13],
      ['ui-md', 28, 14],
      ['ui-lg', 31.5, 14],
      ['content-sm', 38.5, 16],
      ['content-md', 42, 16],
      ['content-lg', 49, 18],
    ]
    for (const markup of [BARE, ICON]) {
      const { wrap, btn } = mount(markup) // size stays md (default)
      const heights: number[] = []
      const fonts: number[] = []
      for (const [tier, h, f] of TIERS) {
        wrap.setAttribute('scale', tier)
        const gotH = frameHeight(btn)
        const gotF = fontPx(btn)
        expect(gotH, `height @ [scale="${tier}"]`).toBeCloseTo(h, 1)
        expect(gotF, `font @ [scale="${tier}"] is not the §1-SET integer`).toBe(f) // EXACT (no pow decimal)
        heights.push(gotH)
        fonts.push(gotF)
      }
      // height climbs continuously (all-distinct, LINEAR); font STEPS to the §1 set (NOT all-distinct — the
      // deliberate ADR-0035 plateau: a font shared across adjacent [scale] tiers while the box keeps growing).
      expect(allDistinct(heights), `heights did not change across the six [scale] tiers: ${heights.join()}`).toBe(true)
      expect(new Set(fonts).size, `font should STEP to the §1 set (adjacent tiers share): ${fonts.join()}`).toBeLessThan(fonts.length)
    }
  })

  it('ADR-0035 §1-SET fonts/icons: [scale] renders the EXACT §1 integers (NOT pow decimals) — the user\'s lg×content-lg case', () => {
    // ADR-0035 supersedes ADR-0033's pow with explicit §1-SET tables: lg×content-lg → font 20 / icon 28 (the §1
    // 64-row), NOT pow's 20.6 / 27.7; height stays linear (63). The NEGATIVE control is the INTEGER itself — a
    // literal …12·13·14·16·18·20px resolves to an exact integer px, so any decimal would mean pow survived.
    const iconPx = (b: HTMLElement): number =>
      px(getComputedStyle(b.querySelector('[data-role="icon"]') as HTMLElement).width) // explicit inline-size → exact px
    const read = (size: string, scale: string | null): { h: number; f: number; icon: number } => {
      const { wrap, btn } = mount(ICON)
      btn.setAttribute('size', size)
      if (scale) wrap.setAttribute('scale', scale)
      return { h: frameHeight(btn), f: fontPx(btn), icon: iconPx(btn) }
    }

    // ── THE USER'S CASE — [size=lg][scale=content-lg]: font EXACTLY 20 (not 20.6), icon EXACTLY 28 (not 27.7) ──
    const lgCL = read('lg', 'content-lg')
    expect(lgCL.h, 'lg×content-lg height (LINEAR 36×1.75)').toBeCloseTo(63, 0)
    expect(lgCL.f, 'lg×content-lg font is not the §1-SET 20').toBe(20)
    expect(lgCL.icon, 'lg×content-lg icon is not the §1-SET 28').toBe(28)
    // NEGATIVE control (AC3/AC4): the rendered values are INTEGERS — pow's 20.6/27.7 are gone, not just absent
    expect(Number.isInteger(lgCL.f), `font ${lgCL.f} is not an integer — pow survived`).toBe(true)
    expect(Number.isInteger(lgCL.icon), `icon ${lgCL.icon} is not an integer — pow survived`).toBe(true)

    // ── [size=md][scale=content-lg]: font 18 (not pow 18.01), height 49 (linear) ─────────────────────────
    const mdCL = read('md', 'content-lg')
    expect(mdCL.h, 'md×content-lg height (28×1.75)').toBeCloseTo(49, 0)
    expect(mdCL.f, 'md×content-lg font is not the §1-SET 18').toBe(18)

    // ── default ([size=md], no [scale]): font 14 / height 28 — BYTE-IDENTICAL (AC2) ──────────────────────
    const mdDefault = read('md', null)
    expect(mdDefault.f, 'md default font (byte-identical)').toBe(14)
    expect(mdDefault.h, 'md default height (unchanged)').toBeCloseTo(28, 0)

    // ── [size=lg] scale 1 (ui-md): the §1 LG row is unchanged — font 16, icon 20 ─────────────────────────
    const lgBase = read('lg', 'ui-md')
    expect(lgBase.f, 'lg scale-1 font (unchanged §1 LG row)').toBe(16)
    expect(lgBase.icon, 'lg scale-1 icon (unchanged §1 LG row)').toBe(20)

    // ── AC1 sample — [size=sm][scale=ui-sm]: the smallest §1 font is 12 ──────────────────────────────────
    expect(read('sm', 'ui-sm').f, 'sm×ui-sm font is not the §1-SET 12').toBe(12)
  })

  it('[density] compact→spacious CHANGES the icon↔label gap (--ui-gap) — the icon+label variant', () => {
    const { wrap, btn } = mount(ICON) // md size, scale comfortable (1)
    const gaps: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      wrap.setAttribute('density', density)
      gaps.push(gapPx(btn))
    }
    // gap_md = font_md / 2 × --ui-density = 7 × {0.5, 1, 1.5} @ scale 1 (the one density-bearing quantity).
    expect(gaps[0]).toBeCloseTo(3.5, 1)
    expect(gaps[1]).toBeCloseTo(7, 1)
    expect(gaps[2]).toBeCloseTo(10.5, 1)
    expect(allDistinct(gaps), `gap did not change across [density]: ${gaps.join()}`).toBe(true)
  })

  it('[density] does NOT change the bare-label FRAME — block-size + the h/2 inline-pads are INVARIANT', () => {
    const { wrap, btn } = mount(BARE) // md size, scale comfortable (1)
    const heights: number[] = []
    const padStarts: number[] = []
    const padEnds: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      wrap.setAttribute('density', density)
      heights.push(frameHeight(btn))
      padStarts.push(padStartPx(btn))
      padEnds.push(padEndPx(btn))
    }
    // md frame @ scale 1: block-size 28, both h/2 inline-pads = 14. Density rides the GAP only
    // (geometry.md), so a slotless button's FRAME must be byte-identical across every density step.
    expect(heights[1]).toBeCloseTo(28, 0)
    expect(padStarts[1]).toBeCloseTo(14, 0)
    expect(padEnds[1]).toBeCloseTo(14, 0)
    expect(allEqual(heights), `[density] moved the bare frame height: ${heights.join()}`).toBe(true)
    expect(allEqual(padStarts), `[density] moved the leading h/2 pad: ${padStarts.join()}`).toBe(true)
    expect(allEqual(padEnds), `[density] moved the trailing h/2 pad: ${padEnds.join()}`).toBe(true)
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
    expect(caretContent, 'leading caret content box is not font-sized (the --ui-ind oversize bug on the leading edge)').toBeCloseTo(font, 0)
    expect(caretContent, 'leading caret glyph is not strictly smaller than its icon-sized cell').toBeLessThan(iconCell)
    expect(font, 'font is not strictly smaller than the icon cell').toBeLessThan(iconCell)
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
