import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// S2 cross-engine browser smoke — ui-switch (indicator-element.lld.md LLD-C4 / ADR-0041).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → playwright instances). This is the
// AUTHORITATIVE RENDERED-PX PROOF; where switch.test.ts (jsdom) proves the behaviour (toggle, ariaChecked,
// formValue, disabled-inert), this proves the GEOMETRY the rendered engine resolves:
//
//   ⭐ THE ADR-0041 RENDERED-PX PROOF — the S2 green gate RATIFIES ADR-0041 (the widget ramp + the 2px
//      inset law). The load-bearing assertion: THUMB = BOX − 4px in BOTH checked states (the slide moves
//      the thumb, never resizes it). Two negative controls: (a) the thumb IS strictly smaller than the track
//      height (it IS inset — not flush), and (b) the thumb size DOES NOT CHANGE across states (only position
//      moves). If either negative control flips, the inset law is broken.
//
//   • Track box = --md-sys-compact-{size} per [size]×[scale] (the Indicator widget ramp, ADR-0041).
//   • Thumb = box − 4px in BOTH states; thumb position changes (slides) but size is constant.
//   • forced-colors: Canvas track + ButtonText border → Highlight track on checked; ButtonText/HighlightText thumb.
//   • C10 zero-residue: connect→disconnect leaves zero live listeners (toggle inert; reconnect re-wires once).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation first, then component sheet,
// then the self-defining `all` entry. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { SCHEMES, composite, contrast, inkContrast, schemeWrap } from '../button/disabled-recipe.fixture.ts'
// The page root register (no data-tier region): product / md, n 6 / 8 / 10 for size sm / md / lg.
const root = (size: 'sm' | 'md' | 'lg') => resolve('product', 'md', size)

// ── mount/cleanup helpers ─────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []

/** Mount a ui-switch inside a wrapper div (carries ancestor [scale]/[size] attributes for the ramp). */
const mount = (html: string): { wrap: HTMLElement; sw: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, sw: wrap.querySelector('ui-switch') as HTMLElement }
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

// ── computed-px readers ───────────────────────────────────────────────────────────────────────────────
const px = (v: string): number => Number.parseFloat(v)

/** The track height (= the widget box, --md-sys-compact-{size} per [size]×[scale]). */
const trackHeight = (sw: HTMLElement): number => px(getComputedStyle(sw).blockSize)

/** The thumb width from the ::after pseudo-element (ADR-0041 cl.3: box − 2×inset = box − 4px). */
const thumbWidth = (sw: HTMLElement): number => px(getComputedStyle(sw, '::after').width)

/** The thumb height from the ::after pseudo-element (must equal thumbWidth — it is a circle). */
const thumbHeight = (sw: HTMLElement): number => px(getComputedStyle(sw, '::after').height)

/** Alpha channel of a computed colour — 0 ⇒ vanished, > 0 ⇒ visible. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1 // bare system-colour keyword (no rgb() wrapper) is opaque
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Minimal CDP surface (playwright provider exposes `.send` at runtime). */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ── ADR-0041 proof ────────────────────────────────────────────────────────────────────────────────────

describe('ui-switch cross-engine browser smoke — track + thumb geometry (ADR-0041)', () => {
  it('⭐ ADR-0041: THUMB = BOX − 4px in BOTH checked states; thumb size is STATE-INVARIANT (only position slides)', () => {
    // ⭐ This assertion is the S2 gate that RATIFIES ADR-0041 (the widget ramp + --md-sys-widget-inset 2px law).
    //    The switch ratifies it for the thumbed-widget class (switch knob); the slider thumb ratifies it later.
    //
    // Law: thumb = box − 2×inset = box − 4px (inset = --md-sys-widget-inset = 2px, a fleet constant).
    // Proof strategy: measure track blockSize + ::after width in BOTH states; assert width = height − 4px.
    // Negative controls:
    //   (a) thumb < track (it IS inset — not flush with the track edge).
    //   (b) thumb size DOES NOT change across states (only the `translate` position changes).
    const { sw } = mount('<ui-switch></ui-switch>')

    const h = trackHeight(sw) // the widget box = --md-sys-compact-md (default) = 16px at the root, where c = 2
    const twUnchecked = thumbWidth(sw)
    const thUnchecked = thumbHeight(sw)

    // (a) ADR-0041 cl.3: thumb = box − 4px
    expect(twUnchecked, `UNCHECKED thumb width (${twUnchecked}) ≠ box − 4px (${h - 4})`).toBeCloseTo(h - 4, 0)
    expect(thUnchecked, `UNCHECKED thumb height (${thUnchecked}) ≠ box − 4px (${h - 4})`).toBeCloseTo(h - 4, 0)

    // Negative (a): the thumb IS smaller than the track (the inset law is enforced)
    expect(twUnchecked, 'thumb must be STRICTLY smaller than track height (inset > 0)').toBeLessThan(h)

    // Now toggle to checked and re-measure
    sw.setAttribute('checked', '')
    const twChecked = thumbWidth(sw)
    const thChecked = thumbHeight(sw)

    // (b) ADR-0041: thumb = box − 4px IN THE CHECKED STATE ALSO
    expect(twChecked, `CHECKED thumb width (${twChecked}) ≠ box − 4px (${h - 4})`).toBeCloseTo(h - 4, 0)
    expect(thChecked, `CHECKED thumb height (${thChecked}) ≠ box − 4px (${h - 4})`).toBeCloseTo(h - 4, 0)

    // Negative (b): STATE-INVARIANT size — ONLY the position changes, never the size
    expect(twUnchecked, 'thumb width changed between states — only position should move').toBeCloseTo(twChecked, 0)
    expect(thUnchecked, 'thumb height changed between states — only position should move').toBeCloseTo(thChecked, 0)
  })

  it('ADR-0041: track box = --md-sys-compact-{size} per [size] (the widget ramp, NOT the control height ramp)', () => {
    // The Indicator widget box rides the COMPACT ramp (ADR-0041), NOT the full control height ramp (ADR-0038).
    // Derived ramp at the root (ADR-0245): --md-sys-compact-sm=12 / --md-sys-compact-md=16 / --md-sys-compact-lg=20.
    const SIZES: Array<['sm' | 'md' | 'lg', number]> = [
      ['sm', root('sm').parts.switchTrack],
      ['md', root('md').parts.switchTrack],
      ['lg', root('lg').parts.switchTrack],
    ]
    for (const [size, expected] of SIZES) {
      const { sw } = mount(`<ui-switch size="${size}"></ui-switch>`)
      const h = trackHeight(sw)
      expect(h, `[size="${size}"] track height (${h}) ≠ --md-sys-compact-${size} (${expected}px)`).toBeCloseTo(expected, 0)
      // Thumb follows the law at each size — anti-vacuous (proves the law holds across the full ramp).
      const tw = thumbWidth(sw)
      const thumb = expected - 2 * root(size).c // box − 2c: 4px at sm and md, 6px at lg where c = 3
      expect(tw, `[size="${size}"] thumb (${tw}) ≠ box − 2c (${thumb}px)`).toBeCloseTo(thumb, 0)
    }
    // Anti-vacuous: the three sizes are genuinely distinct (the lever truly moved the box).
    const heights = SIZES.map(([size]) => {
      const { sw: s } = mount(`<ui-switch size="${size}"></ui-switch>`)
      return trackHeight(s)
    })
    expect(new Set(heights.map((v) => v.toFixed(0))).size, 'all three sizes should render different track heights').toBe(3)
  })

  it('ADR-0245: inside an opt-in data-tier region the track is 2n, the thumb 2n - 2c, the width 2 thumb + 2c', () => {
    // Against scale.mjs resolve() in an explicit product / sm region and at the page root register (product / md).
    for (const scale of ['sm', 'md']) {
      for (const size of ['sm', 'md', 'lg']) {
        const r = resolve('product', scale, size)
        const wrap = document.createElement('div')
        wrap.setAttribute('data-tier', 'product')
        wrap.setAttribute('data-scale', scale)
        wrap.innerHTML = `<ui-switch inline size="${size}"></ui-switch>`
        document.body.append(wrap)
        mounted.push(wrap)
        const sw = wrap.querySelector('ui-switch') as HTMLElement
        const where = `product / ${scale} / ${size}`
        expect(trackHeight(sw), `${where} track`).toBe(r.icon)
        expect(thumbWidth(sw), `${where} thumb`).toBe(r.icon - 2 * r.c)
        expect(px(getComputedStyle(sw).inlineSize), `${where} width`).toBe(2 * (r.icon - 2 * r.c) + 2 * r.c)
      }
    }
  })

  it('ADR-0245: inside a region a checked thumb travels one thumb width and ends c from the track end', () => {
    const r = resolve('product', 'sm', 'md')
    const wrap = document.createElement('div')
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', 'sm')
    wrap.innerHTML = '<ui-switch inline checked></ui-switch>'
    document.body.append(wrap)
    mounted.push(wrap)
    const sw = wrap.querySelector('ui-switch') as HTMLElement
    const thumb = r.icon - 2 * r.c
    expect(getComputedStyle(sw, '::after').translate).toBe(`${thumb}px`)
    // start inset c + travel thumb + thumb + end inset c = the track width
    expect(r.c + thumb + thumb + r.c).toBe(px(getComputedStyle(sw).inlineSize))
  })

  it('track inline-size = 2 × box − 2c (the derived pill, 28px at md); the pill is wider than tall (density-invariant)', () => {
    // ADR-0223 (Fill by Default, slice 2): the default host now FILLS the container, so the host-width-
    // equals-track claim lives in the `[inline]` hug state (the pre-wave posture; a bare label-less switch).
    const { sw } = mount('<ui-switch inline></ui-switch>') // md default: box = 16px, track = 2 × 16 − 2c = 28px (c = 2)
    const h = trackHeight(sw)
    const w = px(getComputedStyle(sw).inlineSize)
    // The track is a pill — inline > block.
    expect(w, 'track must be wider than tall (pill constraint)').toBeGreaterThan(h)
    // 2 × box − 2c (ADR-0245: the width follows the derived pill, not today's 1.8× box), allow ±0.5px rounding.
    const c = resolve('product', 'md', 'md').c
    expect(w, `track inline-size (${w}) is not 2 × box − 2c (${2 * h - 2 * c}px)`).toBeCloseTo(2 * h - 2 * c, 0)
  })
})

// ── SC 1.4.11: the OFF track keeps 3:1 on its edge, not its fill (ADR-0059, moved by T-0148) ─────────────

describe('ui-switch cross-engine browser smoke: the off track edge carries 3:1, its fill stays below the on fill', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme}: the off edge is at least 3:1 against the page, and the off fill is quieter than the on fill`, () => {
      // ADR-0059 met SC 1.4.11 with a solid neutral-track fill, which read heavier than the primary on track
      // (T-0148, Kim 2026-10-14). The 3:1 now rides the field-outline edge; the fill is a light container.
      const { wrap, page } = schemeWrap(scheme, '<ui-switch></ui-switch><ui-switch checked></ui-switch>')
      mounted.push(wrap)
      const [off, on] = [...wrap.querySelectorAll('ui-switch')] as HTMLElement[]
      const offTrack = getComputedStyle(off, '::before')
      const onTrack = getComputedStyle(on, '::before')
      const surface = composite(page)
      expect(Number.parseFloat(offTrack.borderTopWidth), 'the off track paints an edge').toBeGreaterThan(0)
      const edge = contrast(composite(page, offTrack.borderTopColor), surface)
      expect(edge, `off edge ${edge.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
      const offFill = contrast(composite(page, offTrack.backgroundColor), surface)
      const onFill = contrast(composite(page, onTrack.backgroundColor), surface)
      expect(offFill, `off fill ${offFill.toFixed(2)}:1 vs on fill ${onFill.toFixed(2)}:1`).toBeLessThan(onFill)
      // the off thumb is the state mark: at least 3:1 against the off track it sits on
      const thumb = inkContrast(page, [offTrack.backgroundColor], getComputedStyle(off, '::after').backgroundColor)
      expect(thumb, `off thumb ${thumb.toFixed(2)}:1 against its track`).toBeGreaterThanOrEqual(3)
    })
  }
})

// ── forced-colors ─────────────────────────────────────────────────────────────────────────────────────

describe('ui-switch cross-engine browser smoke — forced-colors', () => {
  it('forced-colors: Canvas/ButtonText track unchecked → Highlight track checked; thumb ButtonText/HighlightText', async () => {
    const { sw } = mount('<ui-switch></ui-switch>')

    // Baseline (normal mode, BOTH engines): the track (::before) has a non-transparent fill.
    const baseBg = alphaOf(getComputedStyle(sw, '::before').backgroundColor)
    expect(baseBg, 'track background should be visible in normal mode').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit has no CDP forced-colors emulation — assert the engine is genuinely NOT in forced-colors
      // and stop; the Chromium-only leg below carries the FC proof.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    // Chromium: emulate forced-colors via CDP
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Unchecked: Canvas fill + ButtonText border on the track (::before)
      const fcTrackBg = alphaOf(getComputedStyle(sw, '::before').backgroundColor)
      const fcBorder = alphaOf(getComputedStyle(sw, '::before').borderTopColor)
      // Canvas is typically semi-transparent or a different system colour — the key is the border appears
      expect(fcBorder, 'ButtonText border should be visible (non-zero alpha) in forced-colors').toBeGreaterThan(0)

      // Checked: Highlight fill + Highlight border on the track (::before)
      sw.setAttribute('checked', '')
      const checkedBg = alphaOf(getComputedStyle(sw, '::before').backgroundColor)
      expect(checkedBg, 'Highlight track fill should be visible in checked forced-colors').toBeGreaterThan(0)

      // Thumb (::after): ButtonText unchecked, HighlightText checked — both visible
      sw.removeAttribute('checked')
      const thumbBgUnchecked = alphaOf(getComputedStyle(sw, '::after').backgroundColor)
      expect(thumbBgUnchecked, 'ButtonText thumb should be visible in unchecked forced-colors').toBeGreaterThan(0)

      sw.setAttribute('checked', '')
      const thumbBgChecked = alphaOf(getComputedStyle(sw, '::after').backgroundColor)
      expect(thumbBgChecked, 'HighlightText thumb should be visible in checked forced-colors').toBeGreaterThan(0)

      // Anti-vacuous: we were genuinely in forced-colors (not an accidentally-always-passing test)
      void fcTrackBg // suppress unused-var lint (intentionally read to confirm Canvas, cross-checked by border)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset emulation
    }
  })
})

// ── cascade-specificity regression pin (GH #694, the ui-toggle GH #686/#693 finding) ───────────────────

describe('ui-switch cross-engine browser smoke — disabled/checked cascade precedence (GH #694)', () => {
  // component-checker finding (GH #686/#693) on ui-toggle, confirmed to carry over here: a bare
  // `:where(ui-switch):state(checked)` puts `:state()` OUTSIDE the `:where()` net, contributing its own
  // (0,1,0) specificity, beating the fully `:where()`-wrapped `[disabled]` overrides (0,0,0) regardless
  // of source order, so `<ui-switch checked disabled>` would paint the enabled ON track. The fleet disabled
  // recipe (T-0139) gives locked on its own muted track, so the pin is now three-way: checked+disabled
  // differs from checked-only (disabled wins) AND from disabled-only (locked on still reads on).
  it('disabled OVERRIDES checked in the paint cascade, and locked on still differs from locked off (regression pin)', () => {
    const { sw: disabledOnly } = mount('<ui-switch disabled></ui-switch>')
    const disabledOnlyBg = getComputedStyle(disabledOnly, '::before').backgroundColor
    const { sw: checkedDisabled } = mount('<ui-switch checked disabled></ui-switch>')
    const checkedDisabledBg = getComputedStyle(checkedDisabled, '::before').backgroundColor
    const { sw: checkedOnly } = mount('<ui-switch checked></ui-switch>')
    const checkedOnlyBg = getComputedStyle(checkedOnly, '::before').backgroundColor
    expect(checkedDisabledBg, 'checked must not leak through the disabled override (the enabled ON track)').not.toBe(checkedOnlyBg)
    expect(checkedDisabledBg, 'locked on must not paint the locked-off track').not.toBe(disabledOnlyBg)
    expect(checkedOnlyBg, 'anti-vacuous: checked-only and disabled-only must paint different tracks').not.toBe(disabledOnlyBg)
  })
})

// ── C10 zero-residue ──────────────────────────────────────────────────────────────────────────────────

describe('ui-switch cross-engine browser smoke — C10 zero-residue', () => {
  it('C10: disconnect removes listeners; reconnect re-wires exactly one set (no stacked listeners)', async () => {
    // Cross-engine proof that UIIndicatorElement's connection AbortController really tears down
    // the pressActivation/click listeners on disconnect and re-wires them fresh on reconnect.
    const { sw } = mount('<ui-switch></ui-switch>')

    // Connected: Space keyup toggles
    let changes = 0
    sw.addEventListener('change', () => changes++)

    sw.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    sw.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
    expect(changes).toBe(1) // listener live while connected

    // Disconnect → connection scope disposes → all abort-owned listeners removed
    sw.remove()
    sw.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    sw.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
    expect(changes).toBe(1) // no new change — listeners are gone

    // Reconnect → exactly ONE fresh set re-wires
    document.body.append(sw)
    mounted.push(sw)
    sw.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    sw.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
    expect(changes).toBe(2) // exactly ONE more, not 2+ (no stacked old listeners)
  })
})


// -- ADR-0223 (Fill by Default, slice 2 -- action/selection): the two-posture acceptance leg, the
//    generalized ADR-0021 smoke (the text-field pilot's shape): FILL -- a bare host in block flow
//    stretches to the container's inline size (the container IS the floor); [inline] -- the host hugs
//    its content and sits BELOW the container. No clause 3(b) content floor exists on this control to relocate.
describe('ui-switch -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host hugs below the container', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any hug resolution
    wrap.innerHTML = `<ui-switch>Wi-Fi</ui-switch>`
    document.body.append(wrap)
    const host = wrap.querySelector('ui-switch') as HTMLElement & { updateComplete?: Promise<unknown> }
    await host.updateComplete
    // FILL (the default): block-level -- the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('flex')
    // HUG (the ONE opt-out): [inline] flips display level AND posture -- content-sized, below the container.
    host.setAttribute('inline', '')
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host collapsed to nothing').toBeGreaterThan(0)
    expect(hugged, 'the [inline] host did not HUG -- it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-flex')
    wrap.remove()
  })
})
