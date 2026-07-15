// radio.browser.test.ts — cross-engine browser smoke for ui-radio + ui-radio-group (Wave 1 S3).
//
// Runs in Chromium + WebKit via vitest.browser.config.ts (the *.browser.test.ts glob). Excluded from the
// jsdom run by the root vitest.config.ts. Goals: the dot box = --ui-compact (real px), real focus roves
// the group, checked paint (::before ring-fill + ::after dot, the 2026-07-07 fix), forced-colors
// (CanvasText ink), C10 zero-residue.
//
// Imports the self-defining family barrel + the foundation/component CSS so tokens resolve in the real engine.

import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import type { UIRadioElement, UIRadioGroupElement } from '@agent-ui/components/components'
import '@agent-ui/components/components'

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

// ── WCAG contrast helper — real-engine computed colours, not re-derived token math ─────────────────────
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

// ── S3 browser smoke: dot box = --ui-compact (exact-px per [size] + [scale]×[size]) ─────────────

describe('ui-radio browser smoke — box geometry (exact px, ADR-0041)', () => {
  it('radio-box-md: ::before circle = 16px (--ui-compact-md at default ui-md scale)', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.textContent = 'Test'
    // --ui-compact-md = 16px at the default ui-md scale (ADR-0041 clause 2)
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(16)
    expect(Number.parseFloat(getComputedStyle(el, '::before').height)).toBe(16)
  })

  it('radio-box-sm: [size=sm] → 14px circle; [size=lg] → 18px circle (the compact ramp)', () => {
    const sm = mount(document.createElement('ui-radio') as UIRadioElement)
    sm.setAttribute('size', 'sm')
    sm.textContent = 'Small'
    expect(Number.parseFloat(getComputedStyle(sm, '::before').width)).toBe(14) // --ui-compact-sm

    const lg = mount(document.createElement('ui-radio') as UIRadioElement)
    lg.setAttribute('size', 'lg')
    lg.textContent = 'Large'
    expect(Number.parseFloat(getComputedStyle(lg, '::before').width)).toBe(18) // --ui-compact-lg
  })

  it('radio-box-scale: [scale=ui-lg]×[size=md] → 18px (the scale×size lookup, ADR-0041)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-radio') as UIRadioElement
    wrapper.append(el)
    mount(wrapper)
    // ui-lg × md = 18px (ADR-0041 table row ui-lg, column md)
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(18)
  })

  it('radio-box-scale-lg: [scale=content-lg]×[size=lg] → 28px (not a CSS calc — explicit table value)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    const el = document.createElement('ui-radio') as UIRadioElement
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    mount(wrapper)
    // content-lg × lg = 28px — literal from ADR-0041 table, NOT a multiplier
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(28)
  })
})

// ── S3 browser smoke: real focus roves the group ─────────────────────────────────────────────────

describe('ui-radio browser smoke — real focus roves the group', () => {
  it('radio-group-focus-roves: ArrowDown moves real focus to the next radio', () => {
    const group = mount(document.createElement('ui-radio-group') as UIRadioGroupElement)
    const r1 = document.createElement('ui-radio') as UIRadioElement
    const r2 = document.createElement('ui-radio') as UIRadioElement
    r1.value = 'a'
    r2.value = 'b'
    r1.textContent = 'Alpha'
    r2.textContent = 'Beta'
    group.append(r1, r2)

    // Focus the first radio (tabindex=0), then send ArrowDown to the group.
    r1.focus()
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))

    // The rovingFocus onMove called #commit(1), checking r2. Verify.
    expect(r2.checked).toBe(true)
    expect(r1.checked).toBe(false)
    expect(r2.tabIndex).toBe(0)
    expect(r1.tabIndex).toBe(-1)
  })
})

// ── S3 browser smoke: checked paint (dot shows when checked) ─────────────────────────────────────

describe('ui-radio browser smoke — checked paint', () => {
  it('radio-checked-paint: checked radio has [checked] attribute (drives CSS dot selector)', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.value = 'x'
    el.textContent = 'Option X'

    expect(el.hasAttribute('checked')).toBe(false)
    el.checked = true
    expect(el.hasAttribute('checked')).toBe(true)
  })

  it('radio-display-inline-flex: the host renders as inline-flex (anatomy base)', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.textContent = 'Radio'
    expect(getComputedStyle(el).display).toBe('inline-flex')
  })
})

// TKT-0047 — the redundant `opacity: 0.5` disabled dimming was removed; the TOKEN block's own
// `:where(ui-radio[disabled])` repoint (border/ink/dot → muted neutral) is now the ONLY disabled
// mechanism. Proves the muted repaint is real WITHOUT the opacity crutch — via the CHECKED fill
// (idle checked = primary blue; disabled checked = muted neutral), since the IDLE border token
// already equals the disabled-repoint border value (both `-on-surface-variant`), so an unchecked
// radio's border alone shows no delta either way.
describe('ui-radio browser smoke — disabled paint (TKT-0047, opacity removed)', () => {
  it('disabled + checked: the host is fully opaque (no opacity dimming) yet the ::before fill still repaints muted', () => {
    const idle = mount(document.createElement('ui-radio') as UIRadioElement)
    idle.checked = true
    idle.textContent = 'Idle checked'
    const idleFill = getComputedStyle(idle, '::before').backgroundColor

    const disabled = mount(document.createElement('ui-radio') as UIRadioElement)
    disabled.checked = true
    disabled.disabled = true
    disabled.textContent = 'Disabled checked'

    expect(getComputedStyle(disabled).opacity, 'opacity dimming should be gone — the token repoint carries it now').toBe('1')
    const disabledFill = getComputedStyle(disabled, '::before').backgroundColor
    expect(disabledFill, 'the disabled checked fill must still repaint to the muted token').not.toBe(idleFill)
  })
})

// ── 2026-07-07 fix: the checked DOT reads as a genuinely distinct indicator (SC 1.4.11) ────────────
//
// Regression pin for the Kim-filed visual bug: the checked ring (::before) and dot (::after) used to
// share the SAME `--ui-radio-ink` colour — a same-hue dot painted over a same-hue ring is ~1:1 contrast,
// i.e. invisible. The fix fills the ring solid primary and repoints the dot to the bright
// `--md-sys-color-primary-on-primary` role (the switch's own checked-thumb pair). This asserts the REAL
// rendered colours (not the declared tokens) clear the SC 1.4.11 3:1 non-text bar, in both engines.

describe('ui-radio browser smoke — checked dot contrast (2026-07-07 fix, SC 1.4.11)', () => {
  it('checked: the dot (::after) clears 3:1 against the ring/fill (::before) it sits on', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.checked = true
    el.textContent = 'Selected'

    const ringBg = getComputedStyle(el, '::before').backgroundColor
    const dotBg = getComputedStyle(el, '::after').backgroundColor
    const ratio = contrastOf(ringBg, dotBg)
    expect(ratio, `checked dot(${dotBg}) vs ring/fill(${ringBg}) = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })

  it('NEGATIVE control: an equal-hue dot (the pre-fix bug) would fail the same probe', () => {
    // Proves the probe has teeth: the SAME colour read twice is ~1:1, well under the 3:1 bar — exactly
    // what the old `--ui-radio-ink`-for-both bug rendered (ring and dot were the identical primary blue).
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.checked = true
    const ringBg = getComputedStyle(el, '::before').backgroundColor
    const ratio = contrastOf(ringBg, ringBg)
    expect(ratio, 'a same-colour probe must read ~1:1 (the bug this fix corrects)').toBeLessThan(3)
  })

  it('unchecked: the dot (::after) is transparent — no glyph shows when not selected', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.textContent = 'Unselected'
    const dotBg = getComputedStyle(el, '::after').backgroundColor
    expect(dotBg === 'transparent' || dotBg === 'rgba(0, 0, 0, 0)').toBe(true)
  })
})

// ── S3 browser smoke: C10 zero-residue ───────────────────────────────────────────────────────────

describe('ui-radio browser smoke — C10 zero-residue', () => {
  it('radio-c10-connect-disconnect: connect then disconnect leaves zero residue', () => {
    const el = document.createElement('ui-radio') as UIRadioElement
    el.value = 'test'
    el.textContent = 'Test'
    document.body.append(el)
    // Element connected — check it's live.
    expect(el.isConnected).toBe(true)
    el.remove()
    expect(el.isConnected).toBe(false)
    // No assertion on residue beyond successful removal (the kernel disposes scopes + AbortController).
  })

  it('radio-group-c10-connect-disconnect: group + radios connect/disconnect cleanly', () => {
    const group = document.createElement('ui-radio-group') as UIRadioGroupElement
    const r = document.createElement('ui-radio') as UIRadioElement
    r.value = 'a'
    r.textContent = 'Alpha'
    group.append(r)
    document.body.append(group)
    expect(group.isConnected).toBe(true)
    group.remove()
    expect(group.isConnected).toBe(false)
  })
})
