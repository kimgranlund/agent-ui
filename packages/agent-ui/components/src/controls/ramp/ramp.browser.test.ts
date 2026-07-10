import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// ramp.browser.test.ts — the cross-engine browser-truth proof (SPEC-N2; jsdom is blind to real color
// resolution AND forced-colors). Runs in BOTH Chromium and WebKit. Covers what jsdom cannot: whole-shape
// (SPEC-R13 AC1), physical cell order + wrapping (SPEC-R6 AC1/AC2), RTL non-mirroring (SPEC-R15 — the
// deliberate departure), and forced-colors honesty (SPEC-R14 AC1).
import '@agent-ui/components/foundation-styles.css'
import './ramp.css'
import './ramp.ts'

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

const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const STEPS = '[{"label":"100","value":"#eef"},{"label":"500","value":"#369"},{"label":"900","value":"#003"}]'

describe('ui-ramp — whole-shape (SPEC-R13 AC1, test-the-whole-shape)', () => {
  it('a bare, unstyled, populated ramp in an unstyled flex row paints a visible, non-collapsed strip >= the floor', () => {
    const row = mount(`<div style="display:flex"><ui-ramp steps='${STEPS}'></ui-ramp></div>`)
    const ramp = row.querySelector('ui-ramp') as HTMLElement
    const floor = tokenPx(ramp, '--ui-ramp-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = ramp.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(floor - 1)
    const firstBox = ramp.querySelector('[data-part="box"]') as HTMLElement
    expect(firstBox.getBoundingClientRect().width, 'the first cell box painted zero width').toBeGreaterThan(0)
  })
})

describe('ui-ramp — physical order + wrapping (SPEC-R6 AC1/AC2)', () => {
  it('cells render left-to-right in steps order', () => {
    const ramp = mount(`<ui-ramp style="inline-size: 400px" steps='${STEPS}'></ui-ramp>`) as HTMLElement
    const boxes = [...ramp.querySelectorAll('[data-part="box"]')] as HTMLElement[]
    expect(boxes).toHaveLength(3)
    const lefts = boxes.map((b) => b.getBoundingClientRect().left)
    expect(lefts[0]).toBeLessThan(lefts[1])
    expect(lefts[1]).toBeLessThan(lefts[2])
  })

  it('a strip wider than its container wraps to a second line; the host never scrolls horizontally', () => {
    const manySteps = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({ label: String(i), value: `hsl(${i * 18}, 50%, 50%)` })),
    )
    const ramp = mount(`<ui-ramp style="inline-size: 200px" steps='${manySteps}'></ui-ramp>`) as HTMLElement
    const boxes = [...ramp.querySelectorAll('[data-part="cell"]')] as HTMLElement[]
    const tops = new Set(boxes.map((b) => Math.round(b.getBoundingClientRect().top)))
    expect(tops.size, 'the strip did not wrap to multiple lines').toBeGreaterThan(1)
    expect(ramp.scrollWidth).toBeLessThanOrEqual(ramp.getBoundingClientRect().width + 1)
  })
})

describe('ui-ramp — real color resolution + scheme pin (SPEC-R2 AC1/AC2, SPEC-N5)', () => {
  it('a --var step value resolves to the real token color', () => {
    const ramp = mount(
      '<ui-ramp steps=\'[{"label":"a","value":"--md-sys-color-primary-container"}]\' scheme="light"></ui-ramp>',
    ) as HTMLElement
    const box = ramp.querySelector('[data-part="box"]') as HTMLElement
    const resolved = getComputedStyle(box).backgroundColor
    expect(resolved.startsWith('var(')).toBe(false)
    expect(alphaOf(resolved)).toBeGreaterThan(0)
  })

  it('scheme="light" vs scheme="dark" on a genuinely divergent role compute DIFFERENT colors across the whole strip', () => {
    const light = mount(
      '<ui-ramp steps=\'[{"label":"a","value":"--md-sys-color-neutral-surface"}]\' scheme="light"></ui-ramp>',
    ) as HTMLElement
    const dark = mount(
      '<ui-ramp steps=\'[{"label":"a","value":"--md-sys-color-neutral-surface"}]\' scheme="dark"></ui-ramp>',
    ) as HTMLElement
    const lightColor = getComputedStyle(light.querySelector('[data-part="box"]') as HTMLElement).backgroundColor
    const darkColor = getComputedStyle(dark.querySelector('[data-part="box"]') as HTMLElement).backgroundColor
    expect(lightColor).not.toBe(darkColor)
  })
})

describe('ui-ramp — RTL (SPEC-R15, the deliberate physical-direction departure)', () => {
  it('under dir="rtl", the strip stays PHYSICALLY left-to-right (the series direction does not mirror)', () => {
    const ramp = mount(`<ui-ramp dir="rtl" style="inline-size: 400px" steps='${STEPS}'></ui-ramp>`) as HTMLElement
    const boxes = [...ramp.querySelectorAll('[data-part="box"]')] as HTMLElement[]
    const lefts = boxes.map((b) => b.getBoundingClientRect().left)
    expect(lefts[0]).toBeLessThan(lefts[1]) // still left-to-right, NOT mirrored
    expect(lefts[1]).toBeLessThan(lefts[2])
  })
})

describe('ui-ramp — forced colors (SPEC-R14 AC1)', () => {
  it('every cell box degrades to a CanvasText border with no painted fill; Chromium emulates (CDP), WebKit asserts baseline', async () => {
    const ramp = mount(`<ui-ramp steps='${STEPS}'></ui-ramp>`) as HTMLElement
    const box = ramp.querySelector('[data-part="box"]') as HTMLElement

    expect(alphaOf(getComputedStyle(box).backgroundColor), 'baseline box is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      expect(alphaOf(getComputedStyle(box).backgroundColor), 'the box painted a fill under forced-colors').toBe(0)
      expect(alphaOf(getComputedStyle(box).borderTopColor), 'the box lost its CanvasText border').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
