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

  it('[scale] compact→spacious CHANGES the frame height + font px (via --ui-scale) — on BOTH variants', () => {
    for (const markup of [BARE, ICON]) {
      const { wrap, btn } = mount(markup) // size stays md (default)
      const heights: number[] = []
      const fonts: number[] = []
      for (const scale of ['compact', 'comfortable', 'spacious'] as const) {
        wrap.setAttribute('scale', scale)
        heights.push(frameHeight(btn))
        fonts.push(fontPx(btn))
      }
      // md base (28/14) × --ui-scale {0.875, 1, 1.25} — [scale] multiplies the WHOLE frame + the font.
      expect(heights[0]).toBeCloseTo(24.5, 1)
      expect(heights[1]).toBeCloseTo(28, 1)
      expect(heights[2]).toBeCloseTo(35, 1)
      expect(fonts[0]).toBeCloseTo(12.25, 1)
      expect(fonts[1]).toBeCloseTo(14, 1)
      expect(fonts[2]).toBeCloseTo(17.5, 1)
      expect(allDistinct(heights), `heights did not change across [scale]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `fonts did not change across [scale]: ${fonts.join()}`).toBe(true)
    }
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
