import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// swatch.browser.test.ts — the cross-engine browser-truth proof (SPEC-N2; jsdom is blind to real color
// resolution AND forced-colors). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what
// jsdom cannot: whole-shape (SPEC-R13 AC1), real getComputedStyle color resolution incl. the --var lane
// (SPEC-R2 AC1), scheme-pin divergence on a genuinely light-dark()-divergent role (SPEC-R2 AC2, SPEC-N5), and
// forced-colors honesty (SPEC-R14 AC1).
import '@agent-ui/components/foundation-styles.css'
import './swatch.css'
import './swatch.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const tokenPx = (el: HTMLElement, name: string): number => px(getComputedStyle(el).getPropertyValue(name))

/** Alpha of a computed colour — 0 ⇒ vanished, > 0 ⇒ painted. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-swatch — whole-shape (SPEC-R13 AC1, test-the-whole-shape)', () => {
  it('a bare, unstyled swatch in an unstyled flex row paints a visible, non-collapsed box >= the token floor', () => {
    const row = mount('<div style="display:flex"><ui-swatch value="#336699" label="x"></ui-swatch></div>')
    const el = row.querySelector('ui-swatch') as HTMLElement
    const floor = tokenPx(el, '--ui-swatch-box-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    const rect = box.getBoundingClientRect()
    expect(rect.width, 'the box collapsed below its whole-shape floor in a flex row').toBeGreaterThanOrEqual(floor - 1)
    expect(rect.height).toBeGreaterThanOrEqual(floor - 1)
  })

  it('a bare, unset swatch (no value/label) still paints a non-collapsed box (the honest empty state)', () => {
    const row = mount('<div style="display:flex"><ui-swatch></ui-swatch></div>')
    const el = row.querySelector('ui-swatch') as HTMLElement
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(box.getBoundingClientRect().width).toBeGreaterThan(0)
  })
})

describe('ui-swatch — real color resolution (SPEC-R2 AC1)', () => {
  it('a --var value resolves to the token\'s real computed color, not the literal string', () => {
    const el = mount('<ui-swatch value="--md-sys-color-primary-container" scheme="light"></ui-swatch>') as HTMLElement
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    const resolved = getComputedStyle(box).backgroundColor
    expect(resolved).not.toBe('')
    expect(resolved.startsWith('var(')).toBe(false) // a REAL resolved color, never the literal var() string
    // The resolved color equals the token read directly off a probe element under the same scheme.
    const probe = document.createElement('div')
    probe.style.colorScheme = 'light'
    probe.style.background = 'var(--md-sys-color-primary-container)'
    document.body.append(probe)
    expect(resolved).toBe(getComputedStyle(probe).backgroundColor)
    probe.remove()
  })

  it('a literal color value resolves to that exact color', () => {
    const el = mount('<ui-swatch value="rgb(51, 102, 153)"></ui-swatch>') as HTMLElement
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(getComputedStyle(box).backgroundColor).toBe('rgb(51, 102, 153)')
  })
})

describe('ui-swatch — scheme-pin divergence (SPEC-R2 AC2, SPEC-N5)', () => {
  it('scheme="light" vs scheme="dark" on a genuinely light-dark()-divergent role compute DIFFERENT colors', () => {
    // SPEC-N5: --md-sys-color-neutral-surface is a real light-dark()-divergent role (NOT a scheme-invariant
    // one) — picking a scheme-invariant role here would make this assertion pass vacuously.
    const light = mount('<ui-swatch value="--md-sys-color-neutral-surface" scheme="light"></ui-swatch>') as HTMLElement
    const dark = mount('<ui-swatch value="--md-sys-color-neutral-surface" scheme="dark"></ui-swatch>') as HTMLElement
    const lightBox = light.querySelector('[data-part="box"]') as HTMLElement
    const darkBox = dark.querySelector('[data-part="box"]') as HTMLElement
    const lightColor = getComputedStyle(lightBox).backgroundColor
    const darkColor = getComputedStyle(darkBox).backgroundColor
    expect(lightColor, 'anti-vacuous: both must resolve to real colors').not.toBe('')
    expect(lightColor).not.toBe(darkColor)
  })

  it('scheme="auto" sets no color-scheme override (inherits ambient)', () => {
    const el = mount('<ui-swatch value="--md-sys-color-neutral-surface"></ui-swatch>') as HTMLElement
    const box = el.querySelector('[data-part="box"]') as HTMLElement
    expect(getComputedStyle(box).colorScheme).not.toContain('only') // no forced override; ambient value applies
  })
})

describe('ui-swatch — forced colors (SPEC-R14 AC1)', () => {
  it('the box degrades to a CanvasText border with no painted fill; Chromium emulates (CDP), WebKit asserts the baseline', async () => {
    const el = mount('<ui-swatch value="#336699" label="primary-500"></ui-swatch>') as HTMLElement
    const box = el.querySelector('[data-part="box"]') as HTMLElement

    // Baseline (BOTH engines): the box is a painted, non-transparent background outside forced-colors.
    expect(alphaOf(getComputedStyle(box).backgroundColor), 'baseline box is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const boxColor = getComputedStyle(box).backgroundColor
      expect(alphaOf(boxColor), 'the box painted a fill under forced-colors (must degrade to border-only)').toBe(0)
      expect(alphaOf(getComputedStyle(box).borderTopColor), 'the box lost its CanvasText border under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }
  })
})
