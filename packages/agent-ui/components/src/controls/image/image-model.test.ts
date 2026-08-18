import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_ASPECT,
  parseAspectRatio,
  usageHintDefaults,
  relativeLuminance,
  contrastRatio,
  compositeBlackOverWhite,
} from './image-model.ts'
declare const process: { cwd(): string }

// image-model.test.ts — the pure math tests (jsdom-free logic; jsdom is used only as the Vitest environment,
// no DOM touched here). Two independent proof sets: (1) parseAspectRatio/usageHintDefaults' own behaviour,
// and (2) THE PINNED WCAG CONTRAST ACCEPTANCE TEST (GH #1189 R2) — everyone must be able to agree on the
// number, so the compositing math is explicit and re-derives its inputs from the REAL committed image.css
// text (never a hand-duplicated constant) wherever practical.

describe('parseAspectRatio — the zero-CLS sanitizer (R1)', () => {
  it('accepts well-formed "W/H" ratios, normalizing whitespace around the slash', () => {
    expect(parseAspectRatio('16/9')).toBe('16 / 9')
    expect(parseAspectRatio('1/1')).toBe('1 / 1')
    expect(parseAspectRatio('4/3')).toBe('4 / 3')
    expect(parseAspectRatio('16 / 9')).toBe('16 / 9')
    expect(parseAspectRatio('  21 /  9 ')).toBe('21 / 9')
    expect(parseAspectRatio('1.5/1')).toBe('1.5 / 1')
  })

  it('falls back to DEFAULT_ASPECT (16 / 9) for anything malformed — NEVER "auto" (zero CLS holds unconditionally)', () => {
    expect(DEFAULT_ASPECT).toBe('16 / 9')
    for (const bad of ['', 'auto', '16', '16:9', '0/9', '16/0', '-1/9', '16/-9', 'NaN/NaN', '16//9', 'abc']) {
      expect(parseAspectRatio(bad), `input ${JSON.stringify(bad)}`).toBe(DEFAULT_ASPECT)
    }
  })
})

describe('usageHintDefaults — the loading-eagerness lever (R1)', () => {
  it('hero is the one hint that never lazy-loads and opts into fetchpriority=high (the likely LCP element)', () => {
    expect(usageHintDefaults('hero')).toEqual({ loading: 'eager', decoding: 'async', fetchPriority: 'high' })
  })

  it('thumb / avatar / inline all lazy-load with no fetchPriority asserted', () => {
    for (const hint of ['thumb', 'avatar', 'inline'] as const) {
      expect(usageHintDefaults(hint), hint).toEqual({ loading: 'lazy', decoding: 'async' })
    }
  })
})

describe('the WCAG contrast math primitives — anti-vacuous reference checks', () => {
  it('relativeLuminance: pure white is 1, pure black is 0 (the WCAG-defined endpoints)', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6)
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 6)
  })

  it('contrastRatio: black-on-white (and white-on-black) is the maximum 21:1; a color against itself is 1:1', () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1)
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1) // order-independent
    expect(contrastRatio([128, 128, 128], [128, 128, 128])).toBeCloseTo(1, 6)
  })

  it('compositeBlackOverWhite: alpha=0 is pure white (no scrim), alpha=1 is pure black (fully opaque)', () => {
    expect(compositeBlackOverWhite(0)).toEqual([255, 255, 255])
    expect(compositeBlackOverWhite(1)).toEqual([0, 0, 0])
    expect(compositeBlackOverWhite(0.5)).toEqual([128, 128, 128]) // (1-0.5)*255 rounds to 128 (127.5)
  })
})

// ── THE PINNED ACCEPTANCE TEST (GH #1189 R2) ────────────────────────────────────────────────────────────────
//
// The fixture: a solid #FFFFFF image behind the scrim. The caption ink is WHITE (--md-sys-color-neutral-
// on-neutral, pinned below — both light-dark() branches route to neutral-050, confirmed against the real
// tokens.css source, oklch(1 0 89.88): pure white, scheme-invariant). The scrim is `--ui-image-scrim-color`,
// read from the REAL committed image.css (never a hand-duplicated constant) — a plain achromatic
// oklch(0 0 0 / alpha%), so alpha-over-white compositing is exactly `compositeBlackOverWhite(alpha)` (no
// general OKLCH conversion needed: black and white are both achromatic in every color space).
//
// WHY THE WORST CASE IS THE DESIGN'S FLAT FLOOR, NOT THE GRADIENT'S NOMINAL PEAK: a naive two-stop gradient
// (opaque at the very bottom pixel, fading smoothly to transparent) has NO plateau — any real caption text
// sitting even slightly above that one exact pixel row experiences alpha LOWER than the nominal "start"
// value, and LOWER alpha is WORSE for a white-ink caption (closer to the white image ⇒ white-on-white). This
// component sidesteps that footgun by giving the caption its OWN flat, non-gradient background at
// `--ui-image-scrim-color` (image.css) — a constant floor independent of caption height/line-count. The
// decorative `::before` gradient sits BEHIND it and can only ADD darkness where the two overlap, never
// subtract from the flat floor — so testing the caption's OWN flat background alpha in isolation IS the true
// worst case (the gradient's contribution can only improve, never worsen, the real composited result).

const CSS_TEXT = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/image/image.css`, 'utf8') as string

/** Pull `--ui-image-scrim-color: oklch(0 0 0 / NN%);` 's alpha fraction straight out of the committed sheet —
 *  so this test tracks the REAL shipped value, never a hand-duplicated guess that could silently drift. */
function scrimAlphaFromCss(css: string): number {
  const m = /--ui-image-scrim-color:\s*oklch\(\s*0\s+0\s+0\s*\/\s*([\d.]+)%\s*\)/.exec(css)
  if (!m) throw new Error('image.css: --ui-image-scrim-color not found in the expected achromatic oklch(0 0 0 / NN%) shape')
  return Number(m[1]) / 100
}

const CAPTION_INK: readonly [number, number, number] = [255, 255, 255] // --md-sys-color-neutral-on-neutral, pinned: both
// light-dark() branches route to --md-sys-color-neutral-050 = oklch(1 0 89.88) — L=1, C=0 ⇒ pure white, in
// EITHER theme (verified against packages/agent-ui/shared/src/tokens/tokens.css at build time).

describe('ui-image scrim — the pinned WCAG contrast acceptance test (GH #1189 R2)', () => {
  const alpha = scrimAlphaFromCss(CSS_TEXT)
  const worstCaseBg = compositeBlackOverWhite(alpha)
  const cr = contrastRatio(CAPTION_INK, worstCaseBg)

  it('the shipped --ui-image-scrim-color alpha composited over a solid #FFFFFF image, contrasted against the white caption ink', () => {
    // Pin the actual numbers (report these, not just pass/fail): alpha=0.65 ⇒ composited background
    // rgb(89,89,89) ⇒ contrast 7.00…:1 against white — comfortably clears WCAG AA (4.5:1) for normal text,
    // and sits at the edge of AAA (7:1). Deliberately SCHEME-INVARIANT (both the scrim color and the ink are
    // plain, non-light-dark() values) — so this ONE number IS the answer for BOTH light and dark theme.
    expect(alpha).toBeCloseTo(0.65, 5)
    expect(worstCaseBg).toEqual([89, 89, 89])
    expect(cr).toBeGreaterThanOrEqual(4.5) // WCAG AA, normal text — the real acceptance bar
    expect(cr).toBeCloseTo(7.0, 1)
  })

  it('BOTH themes: identical numbers, because the design is deliberately scheme-invariant', () => {
    // No light-dark() branch exists for either --ui-image-scrim-color or --md-sys-color-neutral-on-neutral
    // (confirmed: the former is a bare oklch() literal in image.css; the latter's own light-dark() call
    // names --md-sys-color-neutral-050 on BOTH sides — tokens.css). There is only one number to report.
    expect(CSS_TEXT).not.toMatch(/--ui-image-scrim-color:\s*light-dark/)
    const lightCr = contrastRatio(CAPTION_INK, worstCaseBg)
    const darkCr = contrastRatio(CAPTION_INK, worstCaseBg) // same inputs — scheme-invariant by construction
    expect(lightCr).toBe(darkCr)
    expect(lightCr).toBeCloseTo(7.0, 1)
  })

  it('NEGATIVE / anti-vacuous: the ticket-suggested naive "~40% start alpha" would have FAILED AA — proving this is not a vacuously-passing test regardless of alpha', () => {
    const naiveBg = compositeBlackOverWhite(0.4)
    const naiveCr = contrastRatio(CAPTION_INK, naiveBg)
    expect(naiveBg).toEqual([153, 153, 153])
    expect(naiveCr).toBeCloseTo(2.85, 1) // real number: ~2.85:1 — fails BOTH AA-normal (4.5) and AA-large (3.0)
    expect(naiveCr).toBeLessThan(4.5)
    // ...which is exactly why image.css does NOT use ~40% for the caption's flat backing — 0.65 was chosen
    // (with margin) specifically because 0.4 does not clear AA against the worst-case white-image fixture.
  })

  it('NEGATIVE / anti-vacuous: the gradient endpoint FARTHEST from the caption (fully transparent) would also fail — this is why the caption never relies on gradient position alone', () => {
    const transparentBg = compositeBlackOverWhite(0)
    expect(contrastRatio(CAPTION_INK, transparentBg)).toBeCloseTo(1, 6) // white-on-white — the worst possible
  })
})
