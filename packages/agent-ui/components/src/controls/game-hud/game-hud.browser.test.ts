import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { glyphBox, rootResolve } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)

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

describe('ui-game-hud: the ADR-0046 box model (Amendment 7)', () => {
  it('ink sits 19px inline and 13px block from the outer edge; header, progress and stats are 8px apart', async () => {
    const el = hud(container('480px'), (h) => {
      h.title = 'Dungeon level 3'
      h.stats = [{ label: 'HP', value: 9 }]
      h.progress = { value: 3, max: 8, label: 'Rooms cleared' }
    })
    await el.updateComplete
    const host = el.getBoundingClientRect()
    const box = (name: string): DOMRect => (el.querySelector(`[data-part="${name}"]`) as HTMLElement).getBoundingClientRect()
    // border 1px + the 6px box inset + the region padding (12px inline, 6px block)
    expect(box('header').left - host.left).toBeCloseTo(19, 0)
    expect(box('header').top - host.top).toBeCloseTo(13, 0)
    expect(host.right - box('stats').right).toBeCloseTo(19, 0)
    expect(box('progress').top - box('header').bottom).toBeCloseTo(8, 0)
    expect(box('stats').top - box('progress').bottom).toBeCloseTo(8, 0)
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
    // the shapes are the ui-glyph marks of the shared intent table (T-0351): drawn paths, pairwise distinct
    const marks = glyphs.map((g) => g.querySelector('svg path')?.getAttribute('d'))
    for (const [i, g] of glyphs.entries()) {
      expect(getComputedStyle(g).display, `${intents[i]} glyph is not painted`).not.toBe('none')
      expect(g.getBoundingClientRect().width).toBeGreaterThan(0)
      expect(marks[i], `${intents[i]} glyph draws no mark`).toBeTruthy()
    }
    expect(new Set(marks).size).toBe(intents.length)
    const delta = el.querySelector('[data-intent="success"] [data-part="delta"]') as HTMLElement
    expect(getComputedStyle(delta).color, 'the glyph strokes in the same intent ink as the delta').toBe(getComputedStyle(glyphs[0]!).color)
  })

  it('a stat glyph is its own glyph box n + 6, n clear of its label (ADR-0245 Amendment 6)', async () => {
    const r = rootResolve('md') // the root register (ADR-0245 Amendment 8)
    const el = hud(container('640px'), (h) => {
      h.stats = [{ label: 'Chips', value: 1, intent: 'success' }]
    })
    await el.updateComplete
    const glyph = el.querySelector('[data-part="glyph"]') as HTMLElement
    const label = el.querySelector('[data-part="stat"] [data-part="label"]') as HTMLElement
    const box = glyph.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([glyphBox(r), glyphBox(r)])
    expect(label.getBoundingClientRect().left - box.right, 'glyph to label gap').toBeCloseTo(r.n, 0)
    expect(r.n, 'anti-vacuous: n is not the old c gap').toBeGreaterThan(r.c)
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
    expect(glyph.getAttribute('symbol'), 'the badge mark is the ui-glyph warning mark (T-0351)').toBe('warning')
    expect(glyph.querySelector('svg path')?.getAttribute('d')).toBeTruthy()
    expect(glyph.getBoundingClientRect().width).toBeGreaterThan(0)
  })
})

// ADR-0245 geometry pin (clause 10c): the migrated tokens read the derived foundation inside an opt-in
// data-tier region and today's value outside it. Values are scale.mjs resolve('product', 'sm', 'md'): n 6,
// height 24, c 2, icon box 12, radius 6. Lengths are read through layout (`inline-size: var(<token>)`).
const lengthOf = (host: HTMLElement, token: string): number => {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;block-size:1px;inline-size:var(${token});`
  host.append(probe)
  const width = Number.parseFloat(getComputedStyle(probe).inlineSize)
  probe.remove()
  return width
}
const foundationsPair = (tag: string, attrs: string): { out: HTMLElement; inside: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = `<div data-foundations="legacy"><${tag} ${attrs}></${tag}></div><div data-tier="product" data-scale="sm"><${tag} ${attrs}></${tag}></div>`
  document.body.append(wrap)
  mounted.push(wrap)
  const [out, inside] = Array.from(wrap.querySelectorAll<HTMLElement>(tag)) as [HTMLElement, HTMLElement]
  return { out, inside }
}

describe('ui-game-hud: ADR-0245 derived foundations, dark launch', () => {
  it('reads today\'s value outside a data-tier region and the derived value inside', () => {
    const { out, inside } = foundationsPair('ui-game-hud', 'title="Table 4"')
    for (const el of [out, inside]) expect(lengthOf(el, '--ui-game-hud-stat-gap')).toBe(2)
    expect(lengthOf(out, '--ui-game-hud-stat-radius')).toBe(lengthOf(out, '--md-sys-shape-corner-base') - 2)
    expect(lengthOf(inside, '--ui-game-hud-stat-radius')).toBe(resolve('product', 'sm', 'md').n)
  })
})
