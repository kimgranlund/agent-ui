import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// stat.browser.test.ts — the cross-engine browser-truth proof for ui-stat (SPEC-N2: jsdom is blind to
// painted geometry and computed-style ink). Covers what jsdom cannot: the whole-shape floor (SPEC-R10
// AC1), the delta's DIRECTION-AS-TEXT announcement — visually hidden yet real, and computed-style
// PROOF that direction never carries by color (SPEC-R9 AC2, the ADR-0057 predicate: "if the only
// difference … is color values, the surface fails" — inverted here, direction differs by glyph
// orientation + sign + word while ink stays IDENTICAL) — and forced-colors (SPEC-R15 AC1).
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then this control's own sheet, then the self-defining module. controls/stat/ is not yet
// exported from controls/index.ts (that barrel edit is the LLD-C10 shared-file integration slice, a
// separate wave from this folder) — direct (pre-barrel) imports, the sparkline/bar-chart precedent.
import '@agent-ui/components/foundation-styles.css'
import './stat.css'
import './stat.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-stat') as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const tokenPx = (el: HTMLElement, name: string): number => px(getComputedStyle(el).getPropertyValue(name))

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-stat — whole-shape floor (SPEC-R10 AC1, test-the-whole-shape)', () => {
  it('a bare, populated stat in an unstyled flex row paints a visible, non-collapsed box >= the min-inline-size floor', () => {
    const el = mount('<ui-stat label="Revenue" value="48200" delta="12" caption="vs last month"></ui-stat>')
    const floor = tokenPx(el, '--ui-stat-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = el.getBoundingClientRect()
    expect(box.width, 'the tile collapsed below its whole-shape floor in a flex row').toBeGreaterThanOrEqual(floor - 1)
    expect(box.height, 'the tile painted zero height').toBeGreaterThan(0)
    // the WHOLE gestalt: every part actually painted, not just the host box.
    for (const part of ['label', 'value', 'delta', 'caption']) {
      const node = el.querySelector(`[data-part="${part}"]`) as HTMLElement
      expect(node.getBoundingClientRect().width, `${part} painted zero width`).toBeGreaterThan(0)
    }
  })

  it('a minimal stat (label + value only) still paints — delta/caption are absent, not zero-size', () => {
    const el = mount('<ui-stat label="Uptime" value="99.98%"></ui-stat>')
    const box = el.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    expect(el.querySelector('[data-part="delta"]')).toBeNull()
    expect(el.querySelector('[data-part="caption"]')).toBeNull()
  })

  it('the value register resolves LARGER than the caption register (component-review corrective: the ' +
     'typescale tokens are asserted "verified at build" in a comment, never gated — a renamed/absent ' +
     '--md-sys-typescale-headline-small-* token would silently inherit body size and the whole-shape ' +
     'test above would not catch it, since it only checks width > 0)', () => {
    const el = mount('<ui-stat label="Revenue" value="48200" caption="vs last month"></ui-stat>')
    const valueSize = px(getComputedStyle(el.querySelector('[data-part="value"]') as HTMLElement).fontSize)
    const captionSize = px(getComputedStyle(el.querySelector('[data-part="caption"]') as HTMLElement).fontSize)
    expect(valueSize, 'the headline-small register did not resolve larger than the caption register').toBeGreaterThan(captionSize)
  })
})

describe('ui-stat — delta direction as text, never color (SPEC-R9 AC1/AC2)', () => {
  it('the direction word is real text — present but VISUALLY collapsed to a 1px sr-only box', () => {
    const el = mount('<ui-stat label="Revenue" value="100" delta="12"></ui-stat>')
    const word = el.querySelector('[data-part="delta-word"]') as HTMLElement
    expect(word.textContent, 'the word must be real text, not injected via CSS content').toContain('up')
    const rect = word.getBoundingClientRect()
    // the sr-only recipe (position:absolute + 1px box + clip-path inset) collapses the PAINTED box to
    // ~1px while the text stays in the DOM/AX tree — this is what distinguishes it from display:none
    // (which would drop it from the accessibility tree entirely).
    expect(rect.width, 'the direction word must not occupy visible layout space').toBeLessThanOrEqual(2)
  })

  it('up vs down deltas differ by glyph orientation + sign + word — computed ink is IDENTICAL (no color channel)', () => {
    const up = mount('<ui-stat label="A" value="1" delta="12"></ui-stat>')
    const down = mount('<ui-stat label="B" value="1" delta="-12"></ui-stat>')

    const upRegion = up.querySelector('[data-part="delta"]') as HTMLElement
    const downRegion = down.querySelector('[data-part="delta"]') as HTMLElement
    expect(getComputedStyle(upRegion).color).toBe(getComputedStyle(downRegion).color)

    const upGlyph = upRegion.querySelector('[data-part="delta-glyph"]') as HTMLElement
    const downGlyph = downRegion.querySelector('[data-part="delta-glyph"]') as HTMLElement
    expect(getComputedStyle(upGlyph).backgroundColor).toBe(getComputedStyle(downGlyph).backgroundColor)
    // the two glyphs are still visually DISTINCT — by shape (clip-path), not color.
    expect(getComputedStyle(upGlyph).clipPath).not.toBe(getComputedStyle(downGlyph).clipPath)
  })

  it('delta=0 renders NO glyph node at all (no arrow for "unchanged") — flat is absence, not a third shape', () => {
    const el = mount('<ui-stat label="A" value="1" delta="0"></ui-stat>')
    const region = el.querySelector('[data-part="delta"]') as HTMLElement
    expect(region.getAttribute('data-dir')).toBe('flat')
    expect(region.querySelector('[data-part="delta-glyph"]')).toBeNull()
  })
})

describe('ui-stat — variant="ring" (GH#1208): renders, percent maps to arc via computed background, both themes', () => {
  it('the ring paints a non-collapsed square box at the --ui-stat-ring-size diameter', () => {
    const el = mount('<ui-stat variant="ring" label="Storage" value="72%" percent="72"></ui-stat>')
    const ring = el.querySelector('[data-part="ring"]') as HTMLElement
    const size = tokenPx(el, '--ui-stat-ring-size')
    expect(size, 'anti-vacuous: the ring-size token must resolve to a real px value').toBeGreaterThan(0)
    const box = ring.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    // roughly square (a donut, not a squashed oval) and roughly at the token's diameter
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1)
    expect(box.width).toBeGreaterThanOrEqual(size - 1)
  })

  it('percent maps to the arc via computed background: two different percentages paint DIFFERENT gradients', () => {
    const low = mount('<ui-stat variant="ring" percent="10"></ui-stat>')
    const high = mount('<ui-stat variant="ring" percent="90"></ui-stat>')
    const lowRing = low.querySelector('[data-part="ring"]') as HTMLElement
    const highRing = high.querySelector('[data-part="ring"]') as HTMLElement

    const lowBg = getComputedStyle(lowRing).backgroundImage
    const highBg = getComputedStyle(highRing).backgroundImage
    expect(lowBg, 'the ring must paint a real conic-gradient, not a flat fill').toContain('conic-gradient')
    expect(lowBg, 'different percentages must paint different gradients (percent actually drives the arc)').not.toBe(highBg)
  })

  it('percent=0 and percent=100 are the honest degenerate ends — still a real conic-gradient, no NaN/undefined leaking into the paint', () => {
    const empty = mount('<ui-stat variant="ring" percent="0"></ui-stat>')
    const full = mount('<ui-stat variant="ring" percent="100"></ui-stat>')
    for (const el of [empty, full]) {
      const ring = el.querySelector('[data-part="ring"]') as HTMLElement
      const bg = getComputedStyle(ring).backgroundImage
      expect(bg).toContain('conic-gradient')
      expect(bg.toLowerCase()).not.toContain('nan')
    }
  })

  it('the progress ink and track ink resolve to distinct, non-transparent colors in BOTH color schemes ' +
     '(read off the actual PAINTED gradient, not the raw custom-property text — a custom property\'s ' +
     'computed value does not reliably substitute nested var()s the same way a real paint property does)', () => {
    // tokens.css resolves color roles through oklch()/light-dark() (not rgb()) — match any CSS color
    // FUNCTION generically rather than assuming a specific notation (the fleet's real token chain).
    const colorTokens = (css: string): string[] =>
      [...css.matchAll(/(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)/gi)].map((m) => m[0])

    for (const scheme of ['light', 'dark'] as const) {
      const wrap = document.createElement('div')
      wrap.style.colorScheme = scheme
      wrap.innerHTML = '<ui-stat variant="ring" percent="50"></ui-stat>'
      document.body.append(wrap)
      mounted.push(wrap)
      const ring = wrap.querySelector('[data-part="ring"]') as HTMLElement
      const bg = getComputedStyle(ring).backgroundImage
      const tokens = colorTokens(bg)
      expect(tokens.length, `${scheme} mode must paint at least two resolved colors (progress + track)`).toBeGreaterThanOrEqual(2)
      expect(tokens[0], 'progress and track must be visually distinct roles').not.toBe(tokens[1])
      for (const t of tokens) expect(t, `${scheme} mode must not paint fully-transparent ink`).not.toBe('rgba(0, 0, 0, 0)')
    }
  })
})

describe('ui-stat — forced colors (SPEC-R15 AC1)', () => {
  it('the delta glyph survives in a system ink under forced-colors — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-stat label="Revenue" value="100" delta="12"></ui-stat>')
    const glyph = el.querySelector('[data-part="delta-glyph"]') as HTMLElement

    // Baseline (BOTH engines): the glyph is a painted, non-transparent background (currentColor ink).
    expect(getComputedStyle(glyph).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const glyphColor = getComputedStyle(glyph).backgroundColor
      expect(glyphColor, 'the delta glyph vanished under forced-colors').not.toBe('rgba(0, 0, 0, 0)')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })

  it('the GH#1208 ring degrades to a plain solid-ink outline under forced-colors — Chromium emulates; WebKit asserts baseline', async () => {
    const el = mount('<ui-stat variant="ring" percent="50"></ui-stat>')
    const ring = el.querySelector('[data-part="ring"]') as HTMLElement

    // Baseline (BOTH engines): the ring is a real painted gradient, not a border, outside forced-colors.
    expect(getComputedStyle(ring).backgroundImage).toContain('conic-gradient')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const style = getComputedStyle(ring)
      // the honest degrade: no attempted gradient (a two-tone shape cannot survive as one system ink) —
      // a plain solid-CanvasText outline instead (stat.css's forced-colors block).
      expect(style.backgroundImage, 'the ring must not attempt a gradient under forced-colors').toBe('none')
      expect(style.borderTopWidth, 'the ring must fall back to a real bordered outline').not.toBe('0px')
      expect(style.borderTopColor, 'the ring outline vanished under forced-colors').not.toBe('rgba(0, 0, 0, 0)')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
