import { describe, it, expect, afterEach } from 'vitest'

// game-hud.browser.test.ts: the real-engine painted proof for ui-game-hud (ADR-0243, GameHud fork sheet).
// jsdom is blind to layout, so this covers the whole-shape fill and hug, the stat wrap with no overflow,
// the progress fill width, and the pairwise-distinct intent glyph shapes.
//
// Side-effect imports, load-bearing order (ADR-0003): foundation roles and ramps first, then the sheet
// (whose prologue imports badge.css), then the control (which self-defines ui-badge too).
import '@agent-ui/components/foundation-styles.css'
import './game-hud.css'
import './game-hud.ts'
import type { UIGameHudElement } from './game-hud.ts'

const mounted: HTMLElement[] = []
const container = (width: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:${width}; padding:0; margin:0;`
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const hud = (parent: HTMLElement, init: (el: UIGameHudElement) => void): UIGameHudElement => {
  const el = document.createElement('ui-game-hud') as UIGameHudElement
  init(el)
  parent.append(el)
  return el
}

describe('ui-game-hud: sizing (ADR-0223)', () => {
  it('fills its container by default and hugs under inline', async () => {
    const wrap = container('640px')
    const fill = hud(wrap, (el) => {
      el.title = 'Table 4'
      el.status = 'Your turn'
      el.stats = [{ label: 'Bet', value: 50 }]
    })
    await fill.updateComplete
    const wrapBox = wrap.getBoundingClientRect()
    const fillBox = fill.getBoundingClientRect()
    expect(fillBox.height, 'the HUD painted zero height').toBeGreaterThan(0)
    expect(fillBox.width).toBeCloseTo(wrapBox.width, 0)

    const hug = hud(wrap, (el) => {
      el.title = 'Table 4'
      el.status = 'Your turn'
      el.stats = [{ label: 'Bet', value: 50 }]
      el.inline = true
    })
    await hug.updateComplete
    const hugBox = hug.getBoundingClientRect()
    expect(hug.hasAttribute('inline')).toBe(true)
    expect(hugBox.width).toBeGreaterThan(0)
    expect(hugBox.width).toBeLessThan(wrapBox.width / 2)
  })
})

describe('ui-game-hud: stat wrap', () => {
  it('six stats wrap inside a 320px container with no horizontal overflow', async () => {
    const wrap = container('320px')
    const el = hud(wrap, (h) => {
      h.title = 'Science round'
      h.stats = Array.from({ length: 6 }, (_, i) => ({ label: `Stat ${i + 1}`, value: 1000 * (i + 1), delta: i - 2 }))
    })
    await el.updateComplete
    const stats = el.querySelector('[data-part="stats"]') as HTMLElement
    const tiles = Array.from(el.querySelectorAll('[data-part="stat"]')) as HTMLElement[]
    expect(tiles).toHaveLength(6)
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth)
    expect(stats.scrollWidth).toBeLessThanOrEqual(stats.clientWidth)
    const hostBox = el.getBoundingClientRect()
    const rows = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top)))
    expect(rows.size, 'the tiles did not wrap onto more than one row').toBeGreaterThan(1)
    for (const tile of tiles) {
      const box = tile.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      expect(box.right).toBeLessThanOrEqual(hostBox.right + 0.5)
      expect(box.left).toBeGreaterThanOrEqual(hostBox.left - 0.5)
    }
  })
})

describe('ui-game-hud: progress', () => {
  it('the progress fill width tracks value over max', async () => {
    const wrap = container('480px')
    const el = hud(wrap, (h) => {
      h.progress = { value: 9, max: 24, label: 'HP' }
    })
    await el.updateComplete
    const track = el.querySelector('[data-part="progress-track"]') as HTMLElement
    const fill = el.querySelector('[data-part="progress-fill"]') as HTMLElement
    const ratio = (): number => fill.getBoundingClientRect().width / track.getBoundingClientRect().width
    expect(track.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(track.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(ratio()).toBeCloseTo(9 / 24, 2)
    fill.style.transition = 'none'
    el.progress = { value: 18, max: 24, label: 'HP' }
    await el.updateComplete
    expect(ratio()).toBeCloseTo(18 / 24, 2)
  })
})

describe('ui-game-hud: intent glyphs', () => {
  it('stat intent glyphs are pairwise distinct shapes', async () => {
    const wrap = container('640px')
    const intents = ['success', 'danger', 'warning', 'info'] as const
    const el = hud(wrap, (h) => {
      h.stats = intents.map((intent) => ({ label: intent, value: 1, delta: 1, intent }))
    })
    await el.updateComplete
    const glyphs = intents.map((intent) => el.querySelector(`[data-intent="${intent}"] [data-part="glyph"]`) as HTMLElement)
    const clips = glyphs.map((g) => getComputedStyle(g).clipPath)
    for (const [i, g] of glyphs.entries()) {
      expect(getComputedStyle(g).display, `${intents[i]} glyph is not painted`).not.toBe('none')
      expect(g.getBoundingClientRect().width).toBeGreaterThan(0)
      expect(clips[i]).not.toBe('none')
    }
    expect(new Set(clips).size).toBe(intents.length)
    const delta = el.querySelector('[data-intent="success"] [data-part="delta"]') as HTMLElement
    expect(getComputedStyle(delta).color).toBe(getComputedStyle(glyphs[0]!).backgroundColor)
  })

  it('the status badge renders its intent glyph', async () => {
    const wrap = container('480px')
    const el = hud(wrap, (h) => {
      h.status = 'Wounded'
      h.statusIntent = 'warning'
    })
    await el.updateComplete
    const badge = el.querySelector('[data-part="status"]') as HTMLElement
    await (badge as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    expect(badge.localName).toBe('ui-badge')
    expect(badge.getAttribute('intent')).toBe('warning')
    const glyph = badge.querySelector('[data-part="glyph"]') as HTMLElement
    expect(getComputedStyle(glyph).display).not.toBe('none')
    expect(getComputedStyle(glyph).clipPath).toMatch(/polygon/)
    expect(glyph.getBoundingClientRect().width).toBeGreaterThan(0)
  })
})
