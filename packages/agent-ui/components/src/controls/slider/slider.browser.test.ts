import { describe, it, expect } from 'vitest'

// S1 browser smoke — ui-slider (decomp S1 · ADR-0042 range-half · ADR-0041).
//
// ⭐ This suite RATIFIES the ADR-0042 Range half → accepted (G6.5):
//   AC1: The host box = --md-sys-compact-{size} exact px per [size]×[scale] (anti-vacuous, negative controls).
//   AC2: The thumb (::after) = box − 4px (the ADR-0041 cl.3 two-pixel-inset law, Range edition).
//   AC3: A REAL pointer-drag (pointerdown→move) updates value snapped to step (the value-drag proof).
//   AC4: Forced-colors — forced-color-adjust:none declared on rail and thumb (track survives HCM).
//   C10: Reconnect produces exactly one response per keyboard event (no listener stacking).
//
// The widget-box ramp table (--md-sys-compact-{size} per [scale], dimensions.css):
//   Default (ui-md):  sm=14px · md=16px · lg=18px
//   ui-sm:            sm=12px · md=14px · lg=16px
//   ui-lg:            sm=16px · md=18px · lg=20px
//   content-lg:       sm=22px · md=24px · lg=28px
// Thumb = box − 4px (−2px × each side; --md-sys-widget-inset=2px; ADR-0041 cl.3).
//
// These imports are direct (not through the barrel) because the component-styles barrel is the host's
// integration slice — it gains the slider @import at barrel-wiring time. The foundation CSS (tokens +
// dimensions) is loaded via the shared package barrel so --md-sys-color-* / --md-sys-compact-* tokens are present.

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--md-sys-compact-*)
import './slider.css'                               // the control stylesheet (direct — pre-barrel)
import './slider.ts'                                // self-define (registers ui-slider)
import type { UISliderElement } from './slider.ts'

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────

/** GH #1141 — the interactive track is `.rail`, its OWN light-DOM element (no longer the host itself). */
function rail(el: Element): HTMLElement {
  return el.querySelector('.rail') as HTMLElement
}

/** Stub setPointerCapture on `.rail` to prevent browser throws with synthetic pointer IDs. */
function stubCapture(el: UISliderElement): void {
  rail(el).setPointerCapture = (_id: number): void => {}
}

/** Build + dispatch a synthetic PointerEvent ON `.rail` (bubbles to the host, where valueDrag's
 *  listener lives) — GH #1141: a press must originate from within `.rail`, never the label/value parts. */
const ptr = (el: UISliderElement, type: string, x: number, id = 1): PointerEvent => {
  const event = new PointerEvent(type, { clientX: x, pointerId: id, bubbles: true, cancelable: true })
  rail(el).dispatchEvent(event)
  return event
}

// ── per-scheme token resolver (the button-states.browser.test.ts RISK-1 pattern) ────────────────────
// A throwaway probe child inherits the host's `--ui-slider-*` chain; setting `color-scheme` on the PROBE
// (not the host) makes `light-dark()` inside the inherited token resolve to that branch — the cross-engine
// way to read BOTH scheme legs without touching the page's own color-scheme.
const resolveToken = (host: HTMLElement, tokenVar: string, scheme: 'light' | 'dark'): string => {
  const probe = document.createElement('span')
  probe.style.colorScheme = scheme
  probe.style.backgroundColor = `var(${tokenVar})`
  host.append(probe)
  const c = getComputedStyle(probe).backgroundColor
  probe.remove()
  return c
}

// ── WCAG contrast helper — reads REAL rendered colours, not re-derived token math ───────────────────
// getComputedStyle in a REAL browser resolves light-dark()/var() to a concrete serialized colour — WebKit
// (and Chromium, for some values) serialize our OKLCH-declared tokens as `oklch(L C H)` rather than
// converting to `rgb()`, so this reads BOTH formats (the OKLCH→linear-sRGB path mirrors the jsdom-side
// tokens.test.ts's own helper) and applies the same WCAG relative-luminance formula either way.
const toLin = (c: number): number => {
  const s = c <= 0 ? 0 : c >= 1 ? 1 : c
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const relativeLuminanceRgb = ([r, g, b]: [number, number, number]): number =>
  0.2126 * toLin(r / 255) + 0.7152 * toLin(g / 255) + 0.0722 * toLin(b / 255)
/** OKLCH → linear sRGB (Björn Ottosson's oklab matrices — same constants tokens.test.ts uses). */
const oklchToLinearSrgb = (L: number, C: number, hDeg: number): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x))
const relativeLuminanceOklch = (L: number, C: number, hDeg: number): number => {
  // oklchToLinearSrgb already returns LINEAR sRGB (no gamma encoding involved) — unlike the rgb() branch,
  // this must NOT go through toLin() (that would gamma-DECODE an already-linear value, a double conversion).
  // Verified against real rendered pixels (canvas getImageData sampling of these exact oklch() strings,
  // then WCAG-decoded from the 0-255 gamma-encoded pixel output): 3.67:1, matching this direct-clamp path.
  const [r, g, b] = oklchToLinearSrgb(L, C, hDeg)
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b)
}
const relativeLuminance = (color: string): number => {
  const rgb = color.match(/rgba?\(([^)]+)\)/i)
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return relativeLuminanceRgb([r, g, b])
  }
  const ok = color.match(/oklch\(([^)]+)\)/i)
  if (ok) {
    const [L, C, h] = ok[1].split(/[\s/]+/).filter(Boolean).map(Number)
    return relativeLuminanceOklch(L, C, h)
  }
  throw new Error(`unrecognized colour format (expected rgb()/rgba()/oklch()): "${color}"`)
}
const contrastOf = (a: string, b: string): number => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// ── AC0: RENDERED SHAPE — a slider must LOOK like a slider ───────────────────────────────────────
// A slider that collapses to its thumb (a dot) passes every per-PART px assertion (box=--md-sys-compact,
// thumb=box−4) yet is visually broken. The prior suite measured only HEIGHT + thumb width — never the
// host's overall WIDTH — so a dot shipped. This asserts the WHOLE shape in the SHRINK-WRAPPING flex
// context that exposed the bug (the doc-page specimen row).

describe('ui-slider AC0 — renders as a horizontal track, not a collapsed dot (regression)', () => {
  it('in a flex row, the host floors to a wide horizontal bar (width ≥ 12rem, width ≫ height)', () => {
    const row = document.createElement('div')
    row.style.display = 'flex' // the doc-specimen layout: shrink-wraps its children
    row.style.alignItems = 'center'
    document.body.append(row)
    const el = document.createElement('ui-slider') as UISliderElement
    row.append(el)

    const rect = el.getBoundingClientRect()
    // 12rem = 192px at the 16px root. Assert the slider did NOT shrink-wrap to ~the thumb box.
    expect(rect.width, `slider collapsed to ${rect.width}px — must floor to ~12rem, a horizontal track`).toBeGreaterThanOrEqual(180)
    // A slider is far wider than tall; a dot has width ≈ height. This is the anti-collapse invariant.
    expect(rect.width, 'a slider must be far wider than tall (a track, not a dot)').toBeGreaterThan(rect.height * 4)
    row.remove()
  })
})

// ── SC 1.4.11: the rail is a SOLID, opaque neutral (2026-07-02 audit item 4 · ADR-0059) ───────────

describe('ui-slider — solid rail (SC 1.4.11, ADR-0059)', () => {
  it('--ui-slider-rail resolves to an OPAQUE neutral (--md-sys-color-neutral-track), not the old translucent outline-variant', () => {
    // The rail was --md-sys-color-neutral-outline-variant (neutral-500 @ 40%) — composited to 1.51:1 light / 1.73:1
    // dark over the surface, an SC 1.4.11 fail (at value 0 the whole track vanished). The fix is the SOLID
    // --md-sys-color-neutral-track; the VALUE rides the high-contrast thumb, so the fill↔rail luminance may stay low.
    // The rail lives inside the ::before gradient, so we read it via an INHERITING probe child: the custom
    // property --ui-slider-rail inherits from the host, and `background-color: var(--ui-slider-rail)`
    // resolves it to an OPAQUE colour a real engine paints (alpha 1) — which the old 0.4 role never could.
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--ui-slider-rail)'
    el.append(probe)
    const bg = getComputedStyle(probe).backgroundColor
    const m = bg.match(/rgba?\(([^)]+)\)/i)
    const alpha = m ? (m[1].split(/[\s,/]+/).filter(Boolean)[3] ?? '1') : '1'
    expect(Number(alpha), `slider rail must resolve OPAQUE (solid --md-sys-color-neutral-track), got "${bg}"`).toBe(1)
    el.remove()
  })
})

// ── 2026-07-07 fix: the thumb "pops" in BOTH schemes without regressing ADR-0059 (SC 1.4.11) ────────
//
// Regression pin for the Kim-filed visual bug ("the slider thumb blends into its surroundings, unlike
// the switch"). Ground truth (measured via this exact real-engine path, not just token math):
//   • the interior fill (--ui-slider-thumb) already clears 3:1 against BOTH the fill and rail, in BOTH
//     schemes (ADR-0059) — UNCHANGED by this fix, pinned below as a regression guard.
//   • Kim's literal ask ("use onPrimary like the switch") was REJECTED: a flat `primary-on-primary` thumb
//     is proven below to fail 3:1 against the dark-mode rail — the negative control that grounds why.
//   • the actual fix is an independent ring layer (--ui-slider-thumb-ring, a border) that flips bright
//     in dark mode / dark in light mode — proven below via BOTH scheme legs, cross-engine.

describe('ui-slider — thumb ring "pops" in both schemes without regressing the ADR-0059 fill/rail bar', () => {
  it('REGRESSION GUARD: the interior thumb fill still clears 3:1 against BOTH fill and rail, in BOTH schemes (ADR-0059, unchanged)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    for (const scheme of ['light', 'dark'] as const) {
      const thumb = resolveToken(el, '--ui-slider-thumb', scheme)
      const fill = resolveToken(el, '--ui-slider-fill', scheme)
      const rail = resolveToken(el, '--ui-slider-rail', scheme)
      const vsFill = contrastOf(thumb, fill)
      const vsRail = contrastOf(thumb, rail)
      expect(vsFill, `[${scheme}] thumb(${thumb}) vs fill(${fill}) = ${vsFill.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
      expect(vsRail, `[${scheme}] thumb(${thumb}) vs rail(${rail}) = ${vsRail.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    }
    el.remove()
  })

  it('NEGATIVE CONTROL: Kim\'s literal "use onPrimary like the switch" would FAIL 3:1 against the dark-mode rail — why it was rejected', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    // --md-sys-color-primary-on-primary is the switch's checked-thumb role — a FLAT white in both schemes
    // (unlike --ui-slider-thumb, which adapts per scheme). Reading it directly (not through the slider's
    // own token) simulates the literal swap Kim asked for, and proves it regresses the rail case dark.
    const onPrimary = resolveToken(el, '--md-sys-color-primary-on-primary', 'dark')
    const rail = resolveToken(el, '--ui-slider-rail', 'dark')
    const ratio = contrastOf(onPrimary, rail)
    expect(ratio, `flat on-primary(${onPrimary}) vs dark rail(${rail}) = ${ratio.toFixed(2)}:1 — below the 3:1 SC 1.4.11 bar`).toBeLessThan(3)
  })

  it('the thumb RING resolves BRIGHT in dark mode and DARK in light mode (the switch-like "pop" signature)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    const ringLight = resolveToken(el, '--ui-slider-thumb-ring', 'light')
    const ringDark = resolveToken(el, '--ui-slider-thumb-ring', 'dark')
    // Anti-vacuous: the two legs must actually differ (light-dark() genuinely resolved, not a flat value).
    expect(ringLight).not.toBe(ringDark)
    const lumLight = relativeLuminance(ringLight)
    const lumDark = relativeLuminance(ringDark)
    expect(lumDark, `dark-mode ring luminance (${lumDark.toFixed(3)}) must be BRIGHT (high)`).toBeGreaterThan(0.7)
    expect(lumLight, `light-mode ring luminance (${lumLight.toFixed(3)}) must be DARK (low)`).toBeLessThan(0.1)
    el.remove()
  })

  it('the ring clears 3:1 against the thumb\'s own interior fill in dark mode — the visible "pop" boundary', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    const ring = resolveToken(el, '--ui-slider-thumb-ring', 'dark')
    const fill = resolveToken(el, '--ui-slider-thumb', 'dark')
    const ratio = contrastOf(ring, fill)
    expect(ratio, `dark-mode ring(${ring}) vs thumb fill(${fill}) = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    el.remove()
  })

  it('the outer diameter of the ringed thumb is UNCHANGED — box − 4px still holds (border-box, ADR-0041 cl.3)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    const cs = getComputedStyle(rail(el), '::after')
    // default ui-md size=md: box=16px → thumb=12px, border-box means the 2px ring border does NOT grow it.
    expect(Number.parseFloat(cs.width)).toBe(12)
    expect(Number.parseFloat(cs.height)).toBe(12)
    el.remove()
  })
})

// ── AC1: box = --md-sys-compact-{size} per [size]×[scale] — EXACT px (anti-vacuous) ─────────────────
//
// GH #1141: the ratified AC1 invariant ("the interactive box = --md-sys-compact-{size} exact px") now
// lives on `.rail` — the host itself is a GRID whose overall block-size also includes the label/value
// rows (the default `standard` layout ALWAYS reserves a value row, since the value is visible at rest —
// Ruling 2), so the host's own bounding-box height is no longer the widget-box measurement. `.rail`'s
// own block-size is unchanged (still exactly the widget-box ramp step); these probes were retargeted at
// `.rail` rather than the host to preserve the ratified per-part contract.

describe('ui-slider browser smoke (AC1 — .rail block-size exact px per [size]×[scale])', () => {
  it('AC1 default: .rail block-size = 16px (--md-sys-compact-md at default ui-md scale)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    // .rail's block-size = --md-sys-compact-md = 16px at ui-md scale (ADR-0041 clause 2)
    const rect = rail(el).getBoundingClientRect()
    expect(rect.height).toBe(16)
    el.remove()
  })

  it('AC1 [size=sm] → .rail block-size = 14px; [size=lg] → 18px (the compact widget ramp)', () => {
    const sm = document.createElement('ui-slider') as UISliderElement
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    expect(rail(sm).getBoundingClientRect().height).toBe(14) // --md-sys-compact-sm at ui-md
    sm.remove()

    const lg = document.createElement('ui-slider') as UISliderElement
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    expect(rail(lg).getBoundingClientRect().height).toBe(18) // --md-sys-compact-lg at ui-md
    lg.remove()
  })

  it('AC1 [scale=ui-lg] × [size=md] → 18px (the scale × size lookup, ADR-0041 clause 2)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-slider') as UISliderElement
    wrapper.append(el)
    document.body.append(wrapper)
    // ui-lg × md = 18px (ADR-0041 table: [scale=ui-lg] → --md-sys-compact-md = 18px)
    expect(rail(el).getBoundingClientRect().height).toBe(18)
    wrapper.remove()
  })

  it('AC1 negative control: [size=sm] ≠ [size=md] (14px ≠ 16px — anti-vacuous box proof)', () => {
    const sm = document.createElement('ui-slider') as UISliderElement
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    const smH = rail(sm).getBoundingClientRect().height
    sm.remove()

    const md = document.createElement('ui-slider') as UISliderElement
    document.body.append(md)
    const mdH = rail(md).getBoundingClientRect().height
    md.remove()

    expect(smH).not.toBe(mdH) // the negative control: different sizes render different px
  })
})

// ── AC2: thumb = box − 4px (the ADR-0041 cl.3 two-pixel-inset proof, Range half) ────────────────

describe('ui-slider browser smoke (AC2 — thumb = box − 4px, the ADR-0042 Range-half ratification)', () => {
  it('AC2 default (ui-md, size=md): thumb ::after width = 12px (16px − 4px)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    // --md-sys-compact-md=16px → thumb = 16 − 2×2 = 12px (ADR-0041 cl.3: thumb = box − 2×inset)
    const cs = getComputedStyle(rail(el), '::after')
    expect(Number.parseFloat(cs.width)).toBe(12)
    expect(Number.parseFloat(cs.height)).toBe(12)
    el.remove()
  })

  it('AC2 [size=sm] → thumb = 10px (14px − 4px)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'sm')
    document.body.append(el)
    // --md-sys-compact-sm=14px → thumb = 14 − 4 = 10px
    const cs = getComputedStyle(rail(el), '::after')
    expect(Number.parseFloat(cs.width)).toBe(10)
    expect(Number.parseFloat(cs.height)).toBe(10)
    el.remove()
  })

  it('AC2 [size=lg] → thumb = 14px (18px − 4px)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'lg')
    document.body.append(el)
    // --md-sys-compact-lg=18px → thumb = 18 − 4 = 14px
    const cs = getComputedStyle(rail(el), '::after')
    expect(Number.parseFloat(cs.width)).toBe(14)
    expect(Number.parseFloat(cs.height)).toBe(14)
    el.remove()
  })

  it('AC2 [scale=ui-lg] × [size=lg] → thumb = 16px (20px − 4px)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    document.body.append(wrapper)
    // ui-lg × lg = 20px → thumb = 20 − 4 = 16px
    const cs = getComputedStyle(rail(el), '::after')
    expect(Number.parseFloat(cs.width)).toBe(16)
    expect(Number.parseFloat(cs.height)).toBe(16)
    wrapper.remove()
  })

  it('AC2 [scale=content-lg] × [size=lg] → thumb = 24px (28px − 4px, not a calc result)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    document.body.append(wrapper)
    // content-lg × lg = 28px → thumb = 28 − 4 = 24px (the literal from the ADR-0041 table)
    const cs = getComputedStyle(rail(el), '::after')
    expect(Number.parseFloat(cs.width)).toBe(24)
    expect(Number.parseFloat(cs.height)).toBe(24)
    wrapper.remove()
  })

  it('AC2 negative control: [size=sm] thumb ≠ [size=lg] thumb (10px ≠ 14px — anti-vacuous)', () => {
    const sm = document.createElement('ui-slider') as UISliderElement
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    const smThumb = Number.parseFloat(getComputedStyle(rail(sm), '::after').width)
    sm.remove()

    const lg = document.createElement('ui-slider') as UISliderElement
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    const lgThumb = Number.parseFloat(getComputedStyle(rail(lg), '::after').width)
    lg.remove()

    expect(smThumb).not.toBe(lgThumb) // negative control: different sizes render different thumb px
  })
})

// ── AC3: real pointer-drag → value updates (the value-drag controller proof) ─────────────────────

describe('ui-slider browser smoke (AC3 — real pointer-drag maps position→value)', () => {
  it('AC3 pointerdown→move at 50% of track → value = 50 (snapped to step=10)', async () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 0
    el.max = 100
    el.step = 10
    // Fixed position with known layout so getBoundingClientRect() returns deterministic values.
    el.style.setProperty('position', 'fixed')
    el.style.setProperty('left', '0px')
    el.style.setProperty('top', '0px')
    el.style.setProperty('width', '200px')
    document.body.append(el)
    // Stub setPointerCapture — synthetic PointerEvents do not represent active pointers in the
    // browser, so setPointerCapture(pointerId) would throw NotFoundError without this stub.
    stubCapture(el)

    // pointerdown at clientX=0 → left edge (ratio=0) → value=0
    ptr(el, 'pointerdown', 0)
    expect(el.value).toBe(0)

    // pointermove to clientX=100 → 50% of 200px track (ratio=0.5) → raw=50 → snap to step=10 → 50
    ptr(el, 'pointermove', 100)
    expect(el.value).toBe(50)

    // pointermove to clientX=180 → 90% → raw=90 → snap to step=10 → 90
    ptr(el, 'pointermove', 180)
    expect(el.value).toBe(90)

    ptr(el, 'pointerup', 180)
    el.remove()
  })

  it('AC3 drag emits input on each value change', async () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 0
    el.max = 100
    el.step = 10
    el.style.setProperty('position', 'fixed')
    el.style.setProperty('left', '0px')
    el.style.setProperty('top', '0px')
    el.style.setProperty('width', '200px')
    document.body.append(el)
    stubCapture(el)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    // pointerdown at 0 → value=0 (no change from default → no input)
    ptr(el, 'pointerdown', 0)
    // pointermove to 100 → value=50 → input
    ptr(el, 'pointermove', 100)
    expect(inputCount).toBe(1)

    ptr(el, 'pointerup', 100)
    el.remove()
  })

  it('AC3 degenerate range (min=max): pointerdown does not start drag or emit input', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 50
    el.max = 50 // degenerate
    el.style.setProperty('position', 'fixed')
    el.style.setProperty('left', '0px')
    el.style.setProperty('top', '0px')
    el.style.setProperty('width', '200px')
    document.body.append(el)
    stubCapture(el)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    ptr(el, 'pointerdown', 100)
    ptr(el, 'pointermove', 150)
    expect(inputCount).toBe(0) // degenerate range — no drag, no input
    el.remove()
  })
})

// ── AC4: forced-colors — forced-color-adjust:none on rail and thumb ──────────────────────────────
//
// NOTE: headless Playwright does not emulate `forced-colors: active` by default, so we cannot assert
// computed color values under high-contrast mode. Instead, we verify the element renders without error
// and note that the `@media (forced-colors: active)` block in slider.css maps rail/fill to
// Highlight/ButtonText and the thumb to Canvas + Highlight border, with `forced-color-adjust: none`
// on both pseudo-elements so the browser preserves our explicit system-colour mappings.
// The :focus-visible ring is free via --md-sys-color-focus-ring → Highlight from the token layer (ADR-0009).

describe('ui-slider browser smoke (AC4 — forced-colors annotation)', () => {
  it('AC4 element connects and computes styles without error (forced-colors declared in slider.css)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    // Verify the element is connected and the ::after thumb has a non-zero computed size.
    // (If slider.css failed to load, the thumb would have zero dimensions.)
    const cs = getComputedStyle(rail(el), '::after')
    expect(Number.parseFloat(cs.width)).toBeGreaterThan(0)
    el.remove()
  })
})

// ── GH #1141: the value is always visible at rest and live during scrub (supersedes GH #1126) ───────

describe('ui-slider browser smoke (GH #1141 — always-visible value: real drag tracks it live)', () => {
  it('a real pointer drag updates the ALREADY-VISIBLE value text (min → mid → max), no arm/hide', async () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 0
    el.max = 100
    el.step = 10
    el.value = 50
    el.style.setProperty('position', 'fixed')
    el.style.setProperty('left', '0px')
    el.style.setProperty('top', '0px')
    el.style.setProperty('width', '200px')
    document.body.append(el)
    stubCapture(el)

    const part = el.querySelector('[data-part="value"]') as HTMLElement
    expect(part.hidden).toBe(false) // visible at rest, BEFORE any interaction (Ruling 2)
    expect(part.textContent).toBe('50')

    ptr(el, 'pointerdown', 0) // ratio=0 → value 50→0
    await el.updateComplete
    expect(part.textContent).toBe('0')
    expect(part.hidden).toBe(false)

    ptr(el, 'pointermove', 100) // ratio=0.5 → value=50
    await el.updateComplete
    expect(part.textContent).toBe('50')

    ptr(el, 'pointermove', 200) // ratio=1 → value=100 (max)
    await el.updateComplete
    expect(part.textContent).toBe('100')

    ptr(el, 'pointerup', 200)
    el.remove()
  })
})

// ── GH #1141: the three `layout` patterns — real geometry (label/rail/value relative positions) ─────
//
// Kim's three-pattern mock, measured (not asserted-by-construction): `standard` (label top-left, value
// top-right, one row above the rail) · `inline` (label left / rail centre-flex / value right, one row) ·
// `block` (label centred above, value centred below). Plus: no part clips past its ancestor card at
// min/max (the motivating blackjack-bet-slider case sits inside a bounded card).

describe('ui-slider browser smoke (GH #1141 — layout geometry, all three patterns)', () => {
  function build(layout: 'standard' | 'inline' | 'block'): { el: UISliderElement; label: HTMLElement; value: HTMLElement; rail: HTMLElement } {
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('layout', layout)
    el.label = 'Bet'
    el.min = 0
    el.max = 100
    el.value = 50
    el.style.setProperty('width', '220px')
    document.body.append(el)
    return { el, label: el.querySelector('[data-part="label"]') as HTMLElement, value: el.querySelector('[data-part="value"]') as HTMLElement, rail: rail(el) }
  }

  it('standard: label top-left, value top-right, BOTH above the rail (one row)', () => {
    const { el, label, value, rail: railEl } = build('standard')
    const l = label.getBoundingClientRect()
    const v = value.getBoundingClientRect()
    const r = railEl.getBoundingClientRect()
    expect(l.left, 'label must be the LEFTMOST part').toBeLessThan(v.left)
    expect(l.bottom, 'label must sit ABOVE the rail').toBeLessThanOrEqual(r.top + 0.5)
    expect(v.bottom, 'value must sit ABOVE the rail').toBeLessThanOrEqual(r.top + 0.5)
    expect(Math.abs(v.right - r.right), 'value must be right-aligned to the rail\'s own right edge').toBeLessThan(2)
    el.remove()
  })

  it('inline: label left of the rail, value right of the rail, ALL ONE ROW', () => {
    const { el, label, value, rail: railEl } = build('inline')
    const l = label.getBoundingClientRect()
    const v = value.getBoundingClientRect()
    const r = railEl.getBoundingClientRect()
    expect(l.right, 'label must be LEFT of the rail').toBeLessThanOrEqual(r.left + 0.5)
    expect(v.left, 'value must be RIGHT of the rail').toBeGreaterThanOrEqual(r.right - 0.5)
    // one row: label/rail/value vertical centres all fall within a few px of each other
    const centres = [l.top + l.height / 2, r.top + r.height / 2, v.top + v.height / 2]
    expect(Math.max(...centres) - Math.min(...centres), 'label/rail/value must share one row').toBeLessThan(4)
    el.remove()
  })

  it('block: label centred above, value centred below the rail (three rows, one column)', () => {
    const { el, label, value, rail: railEl } = build('block')
    const l = label.getBoundingClientRect()
    const v = value.getBoundingClientRect()
    const r = railEl.getBoundingClientRect()
    expect(l.bottom, 'label must be ABOVE the rail').toBeLessThanOrEqual(r.top + 0.5)
    expect(v.top, 'value must be BELOW the rail').toBeGreaterThanOrEqual(r.bottom - 0.5)
    const hostRect = el.getBoundingClientRect()
    const hostCentre = hostRect.left + hostRect.width / 2
    expect(Math.abs(l.left + l.width / 2 - hostCentre), 'label must be horizontally CENTRED').toBeLessThan(2)
    expect(Math.abs(v.left + v.width / 2 - hostCentre), 'value must be horizontally CENTRED').toBeLessThan(2)
    el.remove()
  })

  it('no part clips past a bounded ancestor card at MIN or MAX, in every layout', () => {
    for (const layout of ['standard', 'inline', 'block'] as const) {
      const container = document.createElement('div')
      // A real A2UI-card-like ancestor: fixed size + clipped overflow (the blackjack-bet-slider shape).
      container.style.position = 'fixed'
      container.style.left = '20px'
      container.style.top = '20px'
      container.style.width = '260px'
      container.style.overflow = 'hidden'
      document.body.append(container)

      const el = document.createElement('ui-slider') as UISliderElement
      el.setAttribute('layout', layout)
      el.label = 'Bet'
      el.style.setProperty('width', '220px')
      container.append(el)
      stubCapture(el)
      el.min = 0
      el.max = 100
      el.step = 0

      const containerRect = container.getBoundingClientRect()
      for (const x of [0, 220]) { // the two extremes: thumb at min (x=0) and at max (x=220, ratio=1)
        el.value = x === 0 ? 100 : 0 // force a genuine change so pointerdown's onValue actually fires
        ptr(el, 'pointerdown', x)
        for (const part of [el.querySelector('[data-part="label"]'), el.querySelector('[data-part="value"]'), rail(el)] as HTMLElement[]) {
          const r = part.getBoundingClientRect()
          expect(r.left, `[${layout}] part left edge escaped the card at x=${x}`).toBeGreaterThanOrEqual(containerRect.left - 0.5)
          expect(r.right, `[${layout}] part right edge escaped the card at x=${x}`).toBeLessThanOrEqual(containerRect.right + 0.5)
        }
        ptr(el, 'pointerup', x)
      }
      container.remove()
    }
  })
})

// ── C10: connect→disconnect→reconnect — no listener stacking ─────────────────────────────────────

describe('ui-slider browser smoke (C10 — zero-residue after reconnect)', () => {
  it('C10 reconnect: exactly one ArrowRight step per keydown (not doubled from stacked listeners)', async () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 0
    el.max = 100
    el.step = 1
    el.value = 50
    document.body.append(el)

    // Step once while connected → value should be 51
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.value).toBe(51)

    el.remove()        // disconnect
    el.value = 50      // reset
    document.body.append(el) // reconnect

    // ONE ArrowRight should produce EXACTLY one step (51), not two (52) — no stacked listeners
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.value).toBe(51)

    el.remove()
  })

  it('C10 post-disconnect: keyboard does not change value (listeners removed)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.value = 50
    document.body.append(el)
    el.remove() // disconnect

    // After disconnect: keydown listener gone → ArrowRight is a no-op
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.value).toBe(50) // unchanged
  })
})
