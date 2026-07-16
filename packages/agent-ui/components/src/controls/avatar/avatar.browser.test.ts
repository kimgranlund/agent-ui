import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// avatar.browser.test.ts — the cross-engine browser-truth proof for ui-avatar (SPEC-N2: jsdom is blind to
// painted geometry, computed-style ink, and WHCM). Covers: the compact-ramp widget-box geometry under
// [size]×[scale] (SPEC-R20 AC1, the ADR-0041 lookup), the no-hue identity surface (SPEC-R7 AC1 — two
// different `name`s compute an IDENTICAL plane/ink pair, and the initials text clears AA against it), and
// forced-colors (SPEC-R19 AC1 — the circle boundary survives WHCM).
//
// Direct (pre-barrel) imports — controls/avatar/ is not yet wired into controls/index.ts /
// component-styles.css (that's the LLD-C11 shared-file integration slice, a separate wave).
import '@agent-ui/components/foundation-styles.css'
import './avatar.css'
import './avatar.ts'
import '../icon/icon.css'
import '../icon/icon.ts'

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-avatar') as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-avatar — compact-ramp widget-box geometry (SPEC-R20 AC1, ADR-0041)', () => {
  it('default (size=md, no ancestor [scale]) → 16×16 box (--ui-compact-md at ui-md scale)', () => {
    const el = mount('<ui-avatar identity="Ada Lovelace"></ui-avatar>')
    const box = el.getBoundingClientRect()
    expect(box.width).toBe(16)
    expect(box.height).toBe(16)
  })

  it('[size=sm] → 14px box; [size=lg] → 18px box (the compact ramp)', () => {
    const sm = mount('<ui-avatar identity="Ada Lovelace" size="sm"></ui-avatar>')
    expect(sm.getBoundingClientRect().width).toBe(14)

    const lg = mount('<ui-avatar identity="Ada Lovelace" size="lg"></ui-avatar>')
    expect(lg.getBoundingClientRect().width).toBe(18)
  })

  it('[scale=ui-lg] × [size=md] → 18px (the scale × size lookup, ADR-0041 clause 2)', () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('scale', 'ui-lg')
    wrap.innerHTML = '<ui-avatar identity="Ada Lovelace"></ui-avatar>'
    document.body.append(wrap)
    mounted.push(wrap)
    const el = wrap.querySelector('ui-avatar') as HTMLElement
    expect(el.getBoundingClientRect().width).toBe(18)
  })

  it('the box is a true CIRCLE (border-radius 50%) at every size', () => {
    const el = mount('<ui-avatar identity="Ada Lovelace"></ui-avatar>')
    expect(getComputedStyle(el).borderRadius).toBe('50%')
  })
})

describe('ui-avatar — whole-shape: every fallback link actually paints (test-the-whole-shape)', () => {
  it('the person glyph fills a non-zero area inside the box', () => {
    const el = mount('<ui-avatar></ui-avatar>')
    const icon = el.querySelector('ui-icon') as HTMLElement
    expect(icon).not.toBeNull()
    const rect = icon.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('the initials span fills a non-zero area inside the box', () => {
    const el = mount('<ui-avatar identity="Ada Lovelace"></ui-avatar>')
    const initials = el.querySelector('[data-part="initials"]') as HTMLElement
    const rect = initials.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('the image fills the whole box (object-fit: cover)', () => {
    const el = mount('<ui-avatar identity="Ada Lovelace" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7"></ui-avatar>')
    const img = el.querySelector('img') as HTMLElement
    const boxRect = el.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    expect(imgRect.width).toBeCloseTo(boxRect.width, 0)
    expect(imgRect.height).toBeCloseTo(boxRect.height, 0)
  })
})

// ── no-hue identity surface — plane/ink equality + AA probe (SPEC-R7 AC1) ────────────────────────────
// The LLD's own posture: ONE neutral pair, AA-verifiable once. This measures the REAL rendered ratio,
// and asserts two different `name`s compute an IDENTICAL plane/ink pair (the ADR-0057 no-hue-identity law).

const toLin = (c: number): number => {
  const s = c <= 0 ? 0 : c >= 1 ? 1 : c
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
/** OKLCH → linear sRGB (Björn Ottosson's oklab matrices — the slider/badge browser-test precedent). */
const oklchToLinearSrgb = (L: number, C: number, hDeg: number): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Parse a computed colour string (`rgb()`/`rgba()`/`oklch()`) into LINEAR-light [r,g,b] (opaque-only —
 *  the avatar plane/ink tokens never carry alpha, so no compositing step is needed here). */
function parseOpaqueColor(color: string): [number, number, number] {
  const rgbM = color.match(/rgba?\(([^)]+)\)/i)
  if (rgbM) {
    const [r, g, b] = rgbM[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return [toLin(r / 255), toLin(g / 255), toLin(b / 255)]
  }
  const okM = color.match(/oklch\(([^)]+)\)/i)
  if (okM) {
    const [L, C, H] = okM[1].trim().split('/')[0].split(/\s+/).filter(Boolean).map(Number)
    return oklchToLinearSrgb(L, C, H)
  }
  throw new Error(`unrecognized colour format (expected rgb()/rgba()/oklch()): "${color}"`)
}

const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
  const cl = (x: number): number => Math.max(0, Math.min(1, x))
  return 0.2126 * cl(r) + 0.7152 * cl(g) + 0.0722 * cl(b)
}
const contrastOf = (a: [number, number, number], b: [number, number, number]): number => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('ui-avatar — no-hue identity surface (SPEC-R7 AC1)', () => {
  it('two avatars with DIFFERENT names compute IDENTICAL plane + ink (no hash-color identity)', () => {
    const a = mount('<ui-avatar identity="Ada Lovelace"></ui-avatar>')
    const b = mount('<ui-avatar identity="Grace Hopper"></ui-avatar>')
    const csA = getComputedStyle(a)
    const csB = getComputedStyle(b)
    expect(csA.backgroundColor).toBe(csB.backgroundColor)
    expect(csA.color).toBe(csB.color)
  })

  it('the initials ink clears AA (>= 4.5:1) against the fallback plane', () => {
    const el = mount('<ui-avatar identity="Ada Lovelace"></ui-avatar>')
    const cs = getComputedStyle(el)
    const plane = parseOpaqueColor(cs.backgroundColor)
    const ink = parseOpaqueColor(cs.color)
    expect(contrastOf(plane, ink)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('ui-avatar — forced colors (SPEC-R19 AC1)', () => {
  it('the circle boundary survives under forced-colors — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-avatar identity="Ada Lovelace"></ui-avatar>')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const border = getComputedStyle(el).borderTopWidth
      expect(Number.parseFloat(border), 'the circle boundary did not gain a system-ink border under WHCM').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
