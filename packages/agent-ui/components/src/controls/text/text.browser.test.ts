import { describe, it, expect } from 'vitest'
import { server, cdp } from '@vitest/browser/context'

// ADR-0025 — ui-text cross-engine browser smoke. jsdom computes no real font metrics, so the REAL
// proofs live here: the typographic ramp resolves to distinct computed font-sizes per variant, and the
// heading role/ariaLevel is set for h1-h5 via ElementInternals. Runs in BOTH Chromium and WebKit via
// vitest.browser.config.ts → playwright instances.
//
// CSS wiring is SELF-CONTAINED: foundation-styles (the --c-* roles + the --ui-type-* ramp from
// dimensions.css) then component-styles (text.css), then the self-defining module. Vite resolves the
// bare specifier + the relative sheets and injects them.
import '@agent-ui/components/foundation-styles.css' // the --c-* roles + the --ui-type-* typographic ramp
import '@agent-ui/components/component-styles.css' // includes text.css (added to the barrel)
import '@agent-ui/components/components' // self-defines ui-text + the whole family

// Probe subclass re-exposing internals for the heading-role assertion.
import { UITextElement } from './text.ts'

/** A CDP session for Chromium-only emulation probes. */
type CdpSession = { send(method: string, params?: object): Promise<unknown> }

class BrowserProbeText extends UITextElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
// Guard against double-define if this module is re-loaded in the same browser page.
if (!customElements.get('ui-text-browser-probe')) {
  customElements.define('ui-text-browser-probe', BrowserProbeText)
}

describe('ui-text browser-truth harness (ADR-0025)', () => {
  it('mounts ui-text and a real engine resolves font-size to a computed px (anti-vacuous)', () => {
    const el = document.createElement('ui-text')
    el.textContent = 'Body text'
    document.body.append(el)

    // body variant (default) — --ui-text-size → --ui-type-body-size → calc(16px * var(--ui-scale)).
    // If the foundation/component CSS or the token chain hadn't resolved, blockSize/fontSize would not be px.
    const cs = getComputedStyle(el)
    const fontSize = cs.fontSize
    expect(fontSize).toMatch(/px$/)
    expect(Number.parseFloat(fontSize)).toBeGreaterThan(0)
    // body at scale=1 is 16px (ADR-0025 cl.3 ramp)
    expect(Number.parseFloat(fontSize)).toBeCloseTo(16, 0)

    el.remove()
  })

  it('h1 variant resolves to a LARGER font-size than body (the type ramp is live)', () => {
    const h1 = document.createElement('ui-text')
    h1.setAttribute('variant', 'h1')
    h1.textContent = 'Heading'
    document.body.append(h1)

    const body = document.createElement('ui-text')
    body.textContent = 'Body'
    document.body.append(body)

    const h1Size = Number.parseFloat(getComputedStyle(h1).fontSize)
    const bodySize = Number.parseFloat(getComputedStyle(body).fontSize)

    // h1 is 40px (scale 1), body is 16px — the ramp truly resolved (anti-vacuous: different sizes)
    expect(h1Size).toBeGreaterThan(bodySize)
    expect(h1Size).toBeCloseTo(40, 0)

    h1.remove()
    body.remove()
  })

  it('each heading variant (h1-h5) produces a distinct, descending font-size', () => {
    const variants = ['h1', 'h2', 'h3', 'h4', 'h5'] as const
    const sizes: number[] = []

    for (const v of variants) {
      const el = document.createElement('ui-text')
      el.setAttribute('variant', v)
      el.textContent = v
      document.body.append(el)
      sizes.push(Number.parseFloat(getComputedStyle(el).fontSize))
      el.remove()
    }

    // Each level is strictly smaller than the previous (h1 > h2 > h3 > h4 > h5)
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i], `${variants[i]} is not smaller than ${variants[i - 1]}`).toBeLessThan(sizes[i - 1] as number)
    }
    // caption is smaller than body
    const captionEl = document.createElement('ui-text')
    captionEl.setAttribute('variant', 'caption')
    captionEl.textContent = 'caption'
    document.body.append(captionEl)
    const captionSize = Number.parseFloat(getComputedStyle(captionEl).fontSize)
    captionEl.remove()

    const bodyEl = document.createElement('ui-text')
    bodyEl.textContent = 'body'
    document.body.append(bodyEl)
    const bodySize = Number.parseFloat(getComputedStyle(bodyEl).fontSize)
    bodyEl.remove()

    expect(captionSize).toBeLessThan(bodySize) // caption 13px < body 16px
  })

  it('h1-h5: role=heading + ariaLevel 1-5 set via internals in a real engine', async () => {
    const cases: Array<[string, string]> = [['h1', '1'], ['h2', '2'], ['h3', '3'], ['h4', '4'], ['h5', '5']]
    for (const [v, expectedLevel] of cases) {
      const el = document.createElement('ui-text-browser-probe') as BrowserProbeText
      el.setAttribute('variant', v)
      el.textContent = v
      document.body.append(el)
      await el.updateComplete
      expect(el.probeInternals.role, `${v}: role`).toBe('heading')
      expect(el.probeInternals.ariaLevel, `${v}: ariaLevel`).toBe(expectedLevel)
      el.remove()
    }
  })

  it('body/caption: no role and no ariaLevel (generic styled text)', async () => {
    for (const v of ['body', 'caption']) {
      const el = document.createElement('ui-text-browser-probe') as BrowserProbeText
      el.setAttribute('variant', v)
      el.textContent = v
      document.body.append(el)
      await el.updateComplete
      expect(el.probeInternals.role, `${v}: no role`).toBeNull()
      expect(el.probeInternals.ariaLevel, `${v}: no ariaLevel`).toBeNull()
      el.remove()
    }
  })

  it('user-select is ENABLED: display text is selectable in a real engine', () => {
    const el = document.createElement('ui-text')
    el.textContent = 'Selectable'
    document.body.append(el)

    // ui-text is the inverse of ui-button (which disables user-select). The real engine must compute
    // `text` (or its inherited equivalent) — not `none`.
    const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitUserSelect?: string }
    const val = cs.userSelect || cs.webkitUserSelect || ''
    expect(val).not.toBe('none')

    el.remove()
  })
})

// ── C6/C9 subtree-[scale] proof (ADR-0025 cl.3 / the * ramp pre-substitution law) ─────────────────
// The --ui-type-*-size tokens are declared on `*` (not :root) so each element re-substitutes the
// --ui-scale it inherits from its subtree ancestor. A [scale=content-lg] wrapper re-multiplies them:
// h1 at scale=1 is 40px; at scale=1.75 it must become 70px. Proves the dimensions.css `*` law works
// in a real engine (where the pre-substitution can only be confirmed through computed px).

describe('ui-text subtree-[scale] — the --ui-type-* size re-multiplies for a scaled ancestor (C6/C9)', () => {
  it('h1 under [scale=content-lg] resolves to 70px (40px × 1.75 — the * pre-substitution law)', () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('scale', 'content-lg') // --ui-scale → 1.75
    document.body.append(wrap)

    const el = document.createElement('ui-text')
    el.setAttribute('variant', 'h1')
    el.textContent = 'Scaled heading'
    wrap.append(el)

    // baseline without scale: h1 = 40px at scale 1
    const scaledSize = Number.parseFloat(getComputedStyle(el).fontSize)
    // at scale 1.75: 40 × 1.75 = 70px
    expect(scaledSize).toBeCloseTo(70, 0) // the * ramp re-multiplied (anti-vacuous: not the 40px baseline)

    wrap.remove()
  })

  it('the scaled font-size differs from the unscaled baseline (anti-vacuous: the ramp is live)', () => {
    const unscaled = document.createElement('ui-text')
    unscaled.setAttribute('variant', 'h1')
    unscaled.textContent = 'baseline'
    document.body.append(unscaled)
    const basePx = Number.parseFloat(getComputedStyle(unscaled).fontSize)
    unscaled.remove()

    const wrap = document.createElement('div')
    wrap.setAttribute('scale', 'ui-sm') // --ui-scale → 0.875 (a SMALLER multiplier for clear contrast)
    document.body.append(wrap)
    const scaled = document.createElement('ui-text')
    scaled.setAttribute('variant', 'h1')
    scaled.textContent = 'ui-sm'
    wrap.append(scaled)
    const compactPx = Number.parseFloat(getComputedStyle(scaled).fontSize)
    wrap.remove()

    // ui-sm (×0.875) is smaller than baseline (×1) — the ramp genuinely re-multiplied in a real engine
    expect(compactPx).toBeLessThan(basePx)
    expect(compactPx).toBeCloseTo(basePx * 0.875, 0)
  })
})

// ── C8/C9 forced-colors browser leg (ADR-0025 cl.3 / text.css forced-colors block) ─────────────────
// text.css declares `@media (forced-colors: active) { :scope { color: CanvasText } }`. A bare color
// token (--c-neutral-on-surface) could be replaced by the system; CanvasText is the platform's WHCM
// text keyword, guaranteed opaque. Chromium emulates via CDP; WebKit has no CDP forced-colors support
// (the documented engine split — the card/tabs browser harness convention).

describe('ui-text forced-colors — CanvasText mapping keeps display text visible (C8/C9)', () => {
  it('forced-colors @media block keeps display text visible — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = document.createElement('ui-text')
    el.textContent = 'High-contrast visible text'
    document.body.append(el)

    // Baseline (BOTH engines): text colour is painted (has alpha > 0 from --c-neutral-on-surface).
    const alphaOf = (color: string): number => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(color)
      if (m) return m[4] !== undefined ? Number(m[4]) : 1
      return color !== '' && color !== 'transparent' ? 1 : 0
    }
    expect(alphaOf(getComputedStyle(el).color), 'baseline text colour is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP forced-colors emulation (the documented cross-engine split — the card
      // harness convention). Assert we are genuinely NOT in forced-colors (so we are not faking the
      // Chromium proof) and stop; the forced-colors leg is proven in Chromium.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      el.remove()
      return
    }

    // Chromium: emulate forced-colors via CDP — text.css's @media (forced-colors: active) overrides
    // color to CanvasText (a system colour), so the ink survives WHCM (alpha stays > 0).
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(el).color), 'display text colour vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }

    el.remove()
  })
})
