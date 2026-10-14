import { describe, it, expect, afterEach, vi } from 'vitest'
import { page, server } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import '@agent-ui/icons/phosphor'
import '../lib/warm-catalog.ts'
import '../lib/component-preview.ts'
import { createRenderer } from '@agent-ui/a2ui'
import { allPersonaSeeds } from '@agent-ui/a2ui/examples'
import { whenFlushed } from '@agent-ui/components'
import { browsableNames, typesInSeed } from '../lib/a2ui-catalog-tiers.ts'
import { applyScheme } from '../lib/theme-loader.ts'
import { parseCss, over, flatten, contrast, inkContrast, flatLayers, CANVAS_LIGHT, CANVAS_DARK } from '../lib/dogfood-contrast.ts'
import type { Rgba } from '../lib/dogfood-contrast.ts'
import { resolve, CFG } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import type { Resolved } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import RULES from '../../scripts/dogfood-rules.json'
import ALLOW from '../../scripts/dogfood-render-allowlist.json'

// REAL-TIMING HEADROOM (vitest.browser.config.ts): four viewport and scheme round trips per page.
vi.setConfig({ testTimeout: 60_000 })

// dogfood-render.browser.test.ts: the render lint (T-0136, layer 1 of .claude/docs/references/dogfood-lint.md).
// It visits every docs demo page, every browsable A2UI catalog widget and every persona seed with a persona widget
// (T-0144) at 400 and 1000px, light and dark, and checks the computed style against the `render` rules of
// scripts/dogfood-rules.json. Every geometry value comes from scale.mjs resolve() at the element's register: the
// nearest data-tier, data-scale, data-size or size and data-density on the element or an ancestor (the cascade
// foundations.gen.css builds), product at scale md at the root (ADR-0245 Amendment 8). A finding is keyed `demo/<page>#<rule>`,
// `widget/<Type>#<rule>` or `persona/<seed>#<rule>`; the gate fails on a key that
// scripts/dogfood-render-allowlist.json does not list, and on a listed key this engine no longer finds (stale). A
// key that holds in one engine only carries `@chromium` or `@webkit`. The last block is the negative control: one
// injected violation per rule, each of which must turn its rule red.

type Rule = (typeof RULES.render)[number]
type Finding = { rule: string; detail: string }
type Ctx = { width: number; column: Element }

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const TOL = 0.5
const STEPS = new Set(['sm', 'md', 'lg'])
const TIERS = new Set(Object.keys(CFG.tiers))
const DENSITIES = new Set(Object.keys(CFG.density))
const WIDTHS = [400, 1000]
const SCHEMES = ['light', 'dark'] as const
const ENGINE = server.browser

const px = (v: string): number => parseFloat(v) || 0
const tagOf = (el: Element): string => {
  const part = el.getAttribute('data-part')
  return `<${el.localName}${part ? `[${part}]` : ''}>`
}
const visible = (el: Element): DOMRect | null => {
  const box = el.getBoundingClientRect()
  return box.width > 0 && box.height > 0 ? box : null
}

/** The register an element sits at: each axis from its nearest carrier, the root default otherwise. */
export function registerOf(el: Element): Resolved {
  let tier: string | null = null
  let scale: string | null = null
  let size: string | null = null
  let density: string | null = null
  for (let up: Element | null = el; up; up = up.parentElement) {
    if (tier === null && TIERS.has(up.getAttribute('data-tier') ?? '')) tier = up.getAttribute('data-tier')
    if (scale === null && STEPS.has(up.getAttribute('data-scale') ?? '')) scale = up.getAttribute('data-scale')
    if (size === null) {
      const z = up.getAttribute('data-size') ?? up.getAttribute('size')
      if (z !== null && STEPS.has(z)) size = z
    }
    if (density === null && DENSITIES.has(up.getAttribute('data-density') ?? '')) density = up.getAttribute('data-density')
  }
  return resolve(tier ?? 'product', scale ?? 'md', size ?? 'md', density ?? 'default')
}

let probe: HTMLElement | null = null
/** The element's cascade n: its computed --md-sys-height (var()s already substituted) laid out on a probe. */
function cascadeN(el: Element): number | null {
  const height = getComputedStyle(el).getPropertyValue('--md-sys-height').trim()
  if (!height) return null
  probe ??= Object.assign(document.createElement('div'), { style: 'position:absolute; block-size:1px; visibility:hidden' })
  if (!probe.isConnected) document.documentElement.append(probe)
  probe.style.inlineSize = height
  return probe.getBoundingClientRect().width / 4
}

/** A corner radius in px (a percentage reads against the box), of the element or its pseudo. */
function radiusOf(el: Element, box: DOMRect, pseudo?: string): number {
  const r = getComputedStyle(el, pseudo).borderStartStartRadius.split(' ')[0] ?? '0'
  return r.endsWith('%') ? (px(r) / 100) * Math.min(box.width, box.height) : px(r)
}

const legacy = (el: Element): boolean => el.closest('[data-foundations="legacy"]') !== null
const each = (root: Element, selector: string): Element[] => [...root.querySelectorAll(selector)].filter((el) => !legacy(el))

/** demo-overflow-400's predicate: every element of `scope` whose box ends past the column (4px slack), unless an
 *  overflow-x frame inside the scope holds it. A demo's scope is its column; a widget's is its A2UI surface, so the
 *  preview artboard's own scroller never excuses a widget that cannot fit the column. */
function escapees(column: Element, scope: Element = column): string[] {
  const limit = column.getBoundingClientRect().right + 4
  const stop = scope === column ? column : scope.parentElement
  const out: string[] = []
  for (const node of scope.querySelectorAll('*')) {
    const box = node.getBoundingClientRect()
    if (box.width === 0 || box.right <= limit) continue
    let framed = false
    for (let up = node.parentElement; up && up !== stop; up = up.parentElement) {
      const overflowX = getComputedStyle(up).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') { framed = true; break }
    }
    if (!framed) out.push(`${tagOf(node)} right=${Math.round(box.right)} limit=${Math.round(limit)}`)
  }
  return out
}

// The browser's default link colours (light and dark, link and visited) as computed rgb() with spaces removed.
const UA_LINK = new Set(['rgb(0,0,238)', 'rgb(85,26,139)', 'rgb(158,158,255)', 'rgb(208,173,240)'])

// The contrast rules' readers (T-0144). Each painted layer resolves to channels through site/lib/dogfood-contrast.ts,
// or, for a form that module does not parse (lab(), color-mix()), through the engine itself on a 1px canvas.
let pixel: CanvasRenderingContext2D | null = null
const colors = new Map<string, Rgba>()
function rgbaOf(css: string): Rgba {
  const hit = colors.get(css)
  if (hit) return hit
  let c = parseCss(css)
  if (c === null) {
    pixel ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })!
    pixel.clearRect(0, 0, 1, 1)
    pixel.fillStyle = 'transparent'
    pixel.fillStyle = css
    pixel.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data as unknown as [number, number, number, number]
    c = { r: r / 255, g: g / 255, b: b / 255, a: a / 255 }
  }
  colors.set(css, c)
  return c
}
const NONE: Rgba = { r: 0, g: 0, b: 0, a: 0 }
const same = (a: Rgba, b: Rgba): boolean => Math.abs(a.r - b.r) <= 2 / 255 && Math.abs(a.g - b.g) <= 2 / 255 && Math.abs(a.b - b.b) <= 2 / 255 && Math.abs(a.a - b.a) <= 0.01
/** A box's own paint, topmost first: its flat gradient layers over its background-color; null for a real image. */
function layersOf(cs: CSSStyleDeclaration): Rgba[] | null {
  const images = flatLayers(cs.backgroundImage)
  return images === null ? null : [...images.map(rgbaOf), rgbaOf(cs.backgroundColor)]
}
function canvasColor(): Rgba {
  const scheme = getComputedStyle(document.documentElement).colorScheme
  const dark = scheme === 'dark' || (scheme.includes('dark') && scheme.includes('light') && matchMedia('(prefers-color-scheme: dark)').matches)
  return dark ? CANVAS_DARK : CANVAS_LIGHT
}
/** The opaque colour an element paints, over every ancestor's paint down to the first opaque layer
 *  or the canvas; null when a real image sits in the stack, which no single colour stands for. */
function backdrop(el: Element | null): Rgba | null {
  const layers: Rgba[] = []
  for (let up = el; up; up = up.parentElement) {
    const own = layersOf(getComputedStyle(up))
    if (own === null) return null
    layers.push(...own)
    if (own.some((l) => l.a >= 1)) break
  }
  return flatten(layers, canvasColor())
}
/** Read `fn` with `attr` lifted from `el`, then put it back as it was. Transitions are off for the round trip, or the
 *  read would return the transition's start value (the disabled colours) instead of the enabled ones. */
function lifted<T>(el: HTMLElement, attr: string, fn: () => T): T {
  const was = el.getAttribute(attr)
  const transition = el.style.transition
  el.style.transition = 'none'
  el.removeAttribute(attr)
  try {
    return fn()
  } finally {
    if (was !== null) el.setAttribute(attr, was)
    getComputedStyle(el).color // settle the restored style while transitions are still off
    el.style.transition = transition
  }
}
const inkRatio = (el: Element): number | null => {
  const fill = backdrop(el)
  return fill === null ? null : inkContrast(rgbaOf(getComputedStyle(el).color), fill)
}
const sameLine = (a: DOMRect, b: DOMRect): boolean => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > Math.min(a.height, b.height) / 2
const overlaps = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
const fmt = (n: number): string => (Math.round(n * 100) / 100).toString()
// Elements that read as running text, so a p after one is prose after prose, not a note under a box.
const TEXTY = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'dl', 'blockquote', 'span', 'a', 'em', 'strong', 'code', 'small', 'label', 'br', 'ui-text', 'figcaption', 'legend'])

const SELECTOR = Object.fromEntries(RULES.render.map((r: Rule) => [r.id, r.selector]))
const measured: Record<string, number> = Object.fromEntries(RULES.render.map((r: Rule) => [r.id, 0]))

/** One check per render rule: (column, ctx) -> findings. Each counts what it measured (anti-vacuous). */
const CHECKS: Record<string, (root: Element, ctx: Ctx) => string[]> = {
  register(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR.register)) {
      const n = cascadeN(el)
      if (n === null || !visible(el)) continue
      measured.register++
      const want = registerOf(el).n
      if (Math.abs(n - want) > 0.01) out.push(`${tagOf(el)} n=${n} register n=${want}`)
    }
    return out
  },
  'pill-radius'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['pill-radius'])) {
      const box = visible(el)
      if (!box) continue
      measured['pill-radius']++
      // the segmented control's track outline is its ::after overlay (bug #1380); the host paints no corner
      const r = radiusOf(el, box, el.localName === 'ui-segmented-control' ? '::after' : undefined)
      if (r < box.height / 2 - TOL) out.push(`${tagOf(el)} radius=${r} height=${Math.round(box.height)}`)
    }
    return out
  },
  'icon-square'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-button')) {
      const box = visible(el)
      if (!box || el.querySelector('ui-icon') === null || (el.textContent ?? '').trim() !== '') continue
      measured['icon-square']++
      if (Math.abs(box.width - box.height) > TOL) out.push(`${tagOf(el)} ${Math.round(box.width)}x${Math.round(box.height)}`)
    }
    return out
  },
  'type-floor'(root) {
    const out: string[] = []
    for (const el of each(root, '*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '')
      // a glyph is not text (ADR-0245 Amendment 6): it sits in its glyph box, which glyph-box checks
      if (!own || !visible(el) || el.closest(SELECTOR['glyph-box']!.replace(/ svg\b/, '')) !== null) continue
      measured['type-floor']++
      const size = px(getComputedStyle(el).fontSize)
      if (size < CFG.floor - 0.01) out.push(`${tagOf(el)} font-size=${size}`)
    }
    return out
  },
  column(root, ctx) {
    if (ctx.width !== 400) return []
    measured.column++
    return escapees(ctx.column, root)
  },
  'nested-card'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-card')) {
      measured['nested-card']++
      if (el.parentElement?.closest('ui-card')) out.push(`${tagOf(el)} inside a ui-card`)
    }
    return out
  },
  'control-height'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['control-height'])) {
      const box = visible(el)
      if (!box) continue
      measured['control-height']++
      const want = registerOf(el).h
      if (Math.abs(box.height - want) > TOL) out.push(`${tagOf(el)} height=${Math.round(box.height * 10) / 10} want ${want}`)
    }
    return out
  },
  'text-edge'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['text-edge'])) {
      // a toggle's label is its own anonymous content; a button or field's text slot must lead its host
      const host = el.localName === 'ui-toggle' ? el : el.parentElement!
      const leads = host === el ? host.firstElementChild === null : host.firstElementChild === el
      if (!visible(el) || !leads) continue
      measured['text-edge']++
      const r = registerOf(host)
      const edge = px(getComputedStyle(host).paddingInlineStart) + (host === el ? 0 : px(getComputedStyle(el).paddingInlineStart))
      const want = 2 * r.n - r.c
      if (Math.abs(edge - want) > TOL) out.push(`${tagOf(host)} text edge=${edge} want ${want}`)
    }
    return out
  },
  'card-radius'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-card')) {
      const box = visible(el)
      if (!box) continue
      measured['card-radius']++
      const want = registerOf(el).card.radius
      const r = radiusOf(el, box)
      if (Math.abs(r - want) > TOL) out.push(`${tagOf(el)} radius=${r} want ${want}`)
    }
    return out
  },
  'panel-radius'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['panel-radius'])) {
      const box = visible(el)
      if (!box) continue
      measured['panel-radius']++
      const reg = registerOf(el)
      const want = 2 * reg.n + reg.c
      const r = radiusOf(el, box)
      if (Math.abs(r - want) > TOL) out.push(`${tagOf(el)} radius=${r} want ${want}`)
    }
    return out
  },
  'badge-hug'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['badge-hug']) as HTMLElement[]) {
      const box = visible(el)
      if (!box) continue
      measured['badge-hug']++
      // the max-content width, read on the badge itself and restored in the same frame
      const prior = el.style.inlineSize
      el.style.inlineSize = 'max-content'
      const want = el.getBoundingClientRect().width
      el.style.inlineSize = prior
      if (box.width > want + 1) out.push(`${tagOf(el)} width=${Math.round(box.width)} max-content=${Math.round(want)}`)
    }
    return out
  },
  'option-indicator'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['option-indicator'])) {
      if (!visible(el)) continue
      measured['option-indicator']++
      const before = getComputedStyle(el, '::before')
      if (before.display === 'none' || px(before.width) <= 0) out.push(`${tagOf(el)} aria-selected=${el.getAttribute('aria-selected')} shows no indicator`)
    }
    return out
  },
  'inline-text'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['inline-text'])) {
      if (el.hasAttribute('truncate') || !visible(el)) continue
      measured['inline-text']++
      const display = getComputedStyle(el).display
      if (display !== 'inline') out.push(`${tagOf(el)} as=${el.getAttribute('as')} display=${display} inside running text`)
    }
    return out
  },
  'adornment-gap'(root) {
    const out: string[] = []
    for (const cell of each(root, SELECTOR['adornment-gap'])) {
      const boxes = [...cell.children].map((c) => visible(c)).filter((b): b is DOMRect => b !== null).sort((a, b) => a.left - b.left)
      if (boxes.length < 2) continue
      measured['adornment-gap']++
      const want = registerOf(cell).c
      for (let i = 1; i < boxes.length; i++) {
        const gap = boxes[i]!.left - boxes[i - 1]!.right
        if (gap < want - TOL) out.push(`${tagOf(cell.parentElement!)} adornment gap=${Math.round(gap * 10) / 10} want ${want}`)
      }
    }
    return out
  },
  // T-0141 (the part-c review): the rules below came from measurable review findings.
  'link-ink'(root) {
    const out: string[] = []
    for (const el of each(root, 'a[href]')) {
      if (!visible(el)) continue
      let host: Element | null = el.parentElement
      while (host && !host.localName.startsWith('ui-')) host = host.parentElement
      if (!host) continue
      measured['link-ink']++
      const color = getComputedStyle(el).color
      if (UA_LINK.has(color.replace(/\s+/g, ''))) out.push(`${tagOf(el)} in <${host.localName}> color=${color}`)
    }
    return out
  },
  'entry-cell-radius'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['entry-cell-radius'])) {
      const box = visible(el)
      if (!box) continue
      measured['entry-cell-radius']++
      const want = registerOf(el).n
      const r = radiusOf(el, box)
      if (Math.abs(r - want) > TOL) out.push(`${tagOf(el)} radius=${r} want ${want}`)
    }
    return out
  },
  'glyph-box'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['glyph-box'])) {
      const box = visible(el)
      if (!box) continue
      measured['glyph-box']++
      const r = registerOf(el)
      const want = Math.max(8, 2 * r.n - 2 * r.c) // T-0143: the glyph box floors at 8px (Kim's ruling)
      if (Math.abs(box.width - want) > TOL || Math.abs(box.height - want) > TOL) out.push(`${tagOf(el)} ${Math.round(box.width * 10) / 10}x${Math.round(box.height * 10) / 10} want ${want}`)
    }
    return out
  },
  'dash-scale'(root) {
    const out: string[] = []
    for (const el of each(root, 'circle, ellipse, line, path, polygon, polyline, rect')) {
      if (!visible(el)) continue
      measured['dash-scale']++
      const cs = getComputedStyle(el)
      if (cs.vectorEffect === 'non-scaling-stroke' && cs.strokeDasharray !== 'none') out.push(`${tagOf(el)} non-scaling-stroke with dasharray ${cs.strokeDasharray}`)
    }
    return out
  },
  // T-0144: the measurable rules the T-0138 to T-0142 lanes proposed; the colour ones read dogfood-contrast.ts.
  'disabled-ink'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['disabled-ink'])) {
      const off = visible(el) ? inkRatio(el) : null
      if (off === null) continue
      const on = lifted(el as HTMLElement, 'disabled', () => inkRatio(el))
      if (on === null) continue
      measured['disabled-ink']++
      if (off >= on - 0.01) out.push(`${tagOf(el)} disabled ink ${fmt(off)}:1 not below enabled ${fmt(on)}:1`)
    }
    return out
  },
  'disabled-ghost'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['disabled-ghost'])) {
      if (!visible(el)) continue
      measured['disabled-ghost']++
      const cs = getComputedStyle(el)
      if (rgbaOf(cs.backgroundColor).a > 0 || cs.backgroundImage !== 'none') out.push(`${tagOf(el)} background=${cs.backgroundColor} ${cs.backgroundImage}`)
    }
    return out
  },
  'disabled-edge'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-switch[disabled], ui-checkbox[disabled], ui-radio[disabled]')) {
      const box = getComputedStyle(el, '::before')
      const surface = visible(el) ? backdrop(el) : null
      const own = layersOf(box)
      if (!surface || !own || box.display === 'none' || px(box.width) <= 0) continue
      measured['disabled-edge']++
      const fill = flatten(own, surface)
      const edge = px(box.borderTopWidth) > 0 ? over(rgbaOf(box.borderTopColor), fill) : fill
      const ratio = Math.max(contrast(fill, surface), contrast(edge, surface))
      if (ratio < 1.3) out.push(`${tagOf(el)} disabled edge ${fmt(ratio)}:1 against its surface`)
    }
    return out
  },
  'disabled-toggle-fill'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-toggle[disabled]:not([pressed])')) {
      if (!visible(el) || el.matches(':state(pressed)')) continue
      const off = backdrop(el)
      const on = lifted(el as HTMLElement, 'disabled', () => backdrop(el))
      if (!off || !on) continue
      measured['disabled-toggle-fill']++
      if (!same(off, on)) out.push(`${tagOf(el)} disabled unpressed fill differs from enabled unpressed`)
    }
    return out
  },
  'button-text-ink'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-button ui-text')) {
      if (!visible(el)) continue
      measured['button-text-ink']++
      const want = getComputedStyle(el.closest('ui-button')!).color
      const got = getComputedStyle(el).color
      if (!same(rgbaOf(got), rgbaOf(want))) out.push(`${tagOf(el)} color=${got} button ink ${want}`)
    }
    return out
  },
  'avatar-disc'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-avatar')) {
      if (!visible(el) || el.querySelector('img') !== null) continue
      const disc = backdrop(el)
      const surface = backdrop(el.parentElement)
      if (!disc || !surface) continue
      measured['avatar-disc']++
      const ratio = contrast(disc, surface)
      if (ratio < 1.3) out.push(`${tagOf(el)} disc ${fmt(ratio)}:1 against its surface`)
    }
    return out
  },
  'badge-overlay'(root) {
    const out: string[] = []
    const media = each(root, "img, ui-image, [data-part='image']").map(visible).filter((b): b is DOMRect => b !== null)
    for (const el of each(root, 'ui-badge')) {
      const box = visible(el)
      const cs = getComputedStyle(el)
      if (!box || (cs.position !== 'absolute' && cs.position !== 'fixed') || !media.some((m) => overlaps(box, m))) continue
      measured['badge-overlay']++
      const own = layersOf(cs)
      const fill = own === null ? NONE : flatten(own, NONE)
      if (fill.a < 0.999) out.push(`${tagOf(el)} over an image: fill alpha=${fmt(fill.a)}`)
      else if (inkContrast(rgbaOf(cs.color), fill) < 4.5) out.push(`${tagOf(el)} over an image: ink ${fmt(inkContrast(rgbaOf(cs.color), fill))}:1`)
    }
    return out
  },
  'button-identity'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-button')) {
      if (!visible(el)) continue
      measured['button-identity']++
      const icon = [...el.querySelectorAll('ui-icon, ui-glyph, svg, img')].some((n) => visible(n) && getComputedStyle(n).visibility !== 'hidden')
      if (icon) continue
      let text = false
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let t = walk.nextNode(); t && !text; t = walk.nextNode()) {
        if ((t.textContent ?? '').trim() === '' || !visible(t.parentElement!) || getComputedStyle(t.parentElement!).visibility === 'hidden') continue
        const range = document.createRange()
        range.selectNodeContents(t)
        text = range.getBoundingClientRect().width > 0
      }
      if (!text) out.push(`${tagOf(el)} paints no icon and no label`)
    }
    return out
  },
  'action-group'(root) {
    const out: string[] = []
    for (const parent of new Set(each(root, 'ui-button').map((b) => b.parentElement!))) {
      const cs = getComputedStyle(parent)
      if (!cs.display.includes('flex') || cs.flexDirection.startsWith('column')) continue
      const kids = [...parent.children].map((c) => [c, visible(c)] as const).filter((p): p is readonly [Element, DOMRect] => p[1] !== null)
      // the group runs from the first button to the last; content between them (a pager's ellipsis) is part of it
      const first = kids.findIndex(([c]) => c.localName === 'ui-button')
      const last = kids.findLastIndex(([c]) => c.localName === 'ui-button')
      const group = kids.slice(first, last + 1).filter(([c]) => c.localName === 'ui-button')
      const buttons = group.map(([, b]) => b)
      const others = [...kids.slice(0, first), ...kids.slice(last + 1)].map(([, b]) => b)
      if (buttons.length < 2 || others.length === 0) continue
      measured['action-group']++
      if (buttons.every((b) => sameLine(b, buttons[0]!))) continue
      const names = group.map(([c]) => (c.textContent ?? '').trim().slice(0, 16) || c.getAttribute('aria-label') || '?').join(' | ')
      if (buttons.some((b) => others.some((o) => sameLine(b, o)))) out.push(`${tagOf(parent)} buttons [${names}] split across lines beside other content`)
    }
    return out
  },
  'prose-gap'(root) {
    const out: string[] = []
    for (const p of each(root, 'p')) {
      const prev = p.previousElementSibling
      const box = visible(p)
      const above = prev && !TEXTY.has(prev.localName) ? visible(prev) : null
      if (!box || !prev || !above || above.top >= box.top || above.right <= box.left || box.right <= above.left) continue
      const pos = getComputedStyle(prev).position
      if (pos === 'absolute' || pos === 'fixed') continue
      measured['prose-gap']++
      const want = registerOf(p).n
      const gap = box.top - above.bottom
      if (gap < want - TOL) out.push(`<p> ${fmt(gap)}px under ${tagOf(prev)} want ${want}`)
    }
    return out
  },
  'glyph-gap'(root) {
    const out: string[] = []
    for (const el of each(root, "ui-game-hud [data-part='glyph'], ui-result-card [data-part='glyph']")) {
      const box = visible(el)
      const next = el.nextElementSibling
      const label = next ? visible(next) : null
      if (!box || !label || !sameLine(box, label)) continue
      measured['glyph-gap']++
      const want = cascadeN(el) ?? registerOf(el).n // the n the glyph's own cascade carries (a stat may sit a step down)
      const gap = label.left - box.right
      if (gap < want - TOL) out.push(`${tagOf(el)} gap=${fmt(gap)} want ${want}`)
    }
    return out
  },
  'scroll-clip'(root, ctx) {
    if (ctx.width !== 400) return []
    const out: string[] = []
    for (const el of each(root, 'ui-card')) {
      const box = visible(el)
      if (!box) continue
      measured['scroll-clip']++
      let frame: Element | null = null
      for (let up = el.parentElement; up && up !== root.parentElement; up = up.parentElement) {
        const x = getComputedStyle(up).overflowX
        if (x === 'auto' || x === 'scroll') {
          frame = up
          break
        }
      }
      if (!frame || frame.localName.startsWith('ui-') || frame.hasAttribute('data-part') || frame.closest('ui-swiper, ui-carousel') !== null) continue
      const edge = frame.getBoundingClientRect().right
      if (box.right > edge + 4) out.push(`${tagOf(el)} right=${Math.round(box.right)} cut by its scroller at ${Math.round(edge)}`)
    }
    return out
  },
}

/** Every rule's findings in one root at one viewport. */
function lint(root: Element, ctx: Ctx): Finding[] {
  return RULES.render.flatMap((r: Rule) => CHECKS[r.id]!(root, ctx).map((detail) => ({ rule: r.id, detail })))
}

/** The allowlist keys that apply to this engine, without their engine suffix. */
const allowed = new Set(
  Object.keys(ALLOW)
    .filter((k) => !k.includes('@') || k.endsWith(`@${ENGINE}`))
    .map((k) => k.replace(/@\w+$/, '')),
)
const found = new Set<string>()
const visited = new Set<string>()

/** Lint a mounted subject across both widths and both schemes; returns the unlisted findings. */
async function sweep(subject: string, scope: () => Element, column: () => Element, scheme: (s: 'light' | 'dark') => void): Promise<string[]> {
  visited.add(subject)
  const hits = new Map<string, string>()
  for (const width of WIDTHS) {
    await page.viewport(width, 900)
    for (const s of SCHEMES) {
      scheme(s)
      await raf()
      for (const f of lint(scope(), { width, column: column() })) {
        const key = `${subject}#${f.rule}`
        if (!hits.has(key)) hits.set(key, `${key} at ${width}px ${s}: ${f.detail}`)
      }
    }
  }
  for (const key of hits.keys()) found.add(key)
  return [...hits].filter(([key]) => !allowed.has(key)).map(([, line]) => line)
}

afterEach(async () => {
  document.body.innerHTML = ''
  document.documentElement.style.colorScheme = ''
  await page.viewport(414, 896) // restore the fleet default (ADR-0150 cl.5)
})

const DEMOS = import.meta.glob('./*-demo.ts')

describe('render lint: every docs demo page (T-0136)', () => {
  for (const [file, load] of Object.entries(DEMOS)) {
    const name = file.replace(/^\.\//, '').replace(/\.ts$/, '')
    it(`demo/${name}`, async () => {
      document.body.innerHTML = ''
      await page.viewport(400, 900)
      await load()
      await raf()
      const column = () => document.querySelector('[data-page-content]') as HTMLElement
      expect(column(), 'anti-vacuous: the page mounted its content column').not.toBeNull()
      const provider = document.querySelector('ui-theme-provider') as (HTMLElement & { scheme: string }) | null
      const unlisted = await sweep(`demo/${name}`, column, column, (s) => (provider ? applyScheme(provider, s) : (document.documentElement.style.colorScheme = s)))
      expect(unlisted, 'a dogfood finding not in scripts/dogfood-render-allowlist.json').toEqual([])
    })
  }
})

describe('render lint: every browsable A2UI catalog widget (T-0136)', () => {
  for (const name of browsableNames()) {
    it(`widget/${name}`, async () => {
      const preview = document.createElement('component-preview')
      preview.setAttribute('mode', 'a2ui')
      preview.setAttribute('target', name)
      document.body.append(preview)
      await raf()
      // the scope is the A2UI surface; the column is the preview's full-width canvas pane (398px at a 400px viewport)
      const surface = () => preview.querySelector('.canvas-surface [data-a2ui-surface]') as HTMLElement
      const pane = () => preview.querySelector('.preview-canvas') as HTMLElement
      expect(surface(), `anti-vacuous: the ${name} preview rendered an A2UI surface`).not.toBeNull()
      expect(pane(), 'anti-vacuous: the preview has its canvas pane').not.toBeNull()
      expect(surface().getAttribute('data-tier'), 'the canvas register (ADR-0245 Amendment 2)').toBe('widget')
      const unlisted = await sweep(`widget/${name}`, surface, pane, (s) => (document.documentElement.style.colorScheme = s))
      expect(unlisted, 'a dogfood finding not in scripts/dogfood-render-allowlist.json').toEqual([])
    })
  }
})

// The persona catalog widgets (T-0144): each persona seed that renders one of them (on the agent-ui and the
// a2ui-basic base), through a real renderer at the canvas register the renderer stamps (widget, scale md). The column is the mount, sized like the
// preview's canvas pane.
const PERSONA_TYPES = ['BookingForm', 'BookingConfirmation', 'CardTable', 'QuestionCard', 'ContrastPair']
const PERSONA_SEEDS = allPersonaSeeds.filter((s) => PERSONA_TYPES.some((t) => typesInSeed(s).has(t)))

describe('render lint: every persona seed with a persona widget (T-0144)', () => {
  it('the persona seeds cover every persona widget', () => {
    expect(PERSONA_TYPES.filter((t) => !PERSONA_SEEDS.some((s) => typesInSeed(s).has(t)))).toEqual([])
  })
  for (const seed of PERSONA_SEEDS) {
    it(`persona/${seed.name}`, async () => {
      const pane = document.createElement('div')
      pane.style.inlineSize = '100%'
      document.body.append(pane)
      const host = createRenderer()
      host.mount(pane)
      await host.preload(seed.catalogId)
      for (const message of seed.messages) host.ingestMessage(message as Parameters<typeof host.ingestMessage>[0])
      host.finalize(seed.surfaceId)
      await whenFlushed()
      await raf()
      const surface = () => pane.querySelector('[data-a2ui-surface]') as HTMLElement
      expect(surface(), `anti-vacuous: ${seed.name} rendered an A2UI surface`).not.toBeNull()
      expect(surface().getAttribute('data-tier'), 'the canvas register (ADR-0245 Amendment 2)').toBe('widget')
      const unlisted = await sweep(`persona/${seed.name}`, surface, () => pane, (s) => (document.documentElement.style.colorScheme = s))
      host.dispose()
      expect(unlisted, 'a dogfood finding not in scripts/dogfood-render-allowlist.json').toEqual([])
    })
  }
})

describe('render lint: the gate itself (T-0136)', () => {
  it('every rule measured something across the sweep, and no allowlist entry is stale', () => {
    console.log(`DOGFOOD_FOUND ${ENGINE} ${JSON.stringify([...found].sort())} measured ${JSON.stringify(measured)}`)
    // a filtered run (-t) judges only the subjects it visited; the anti-vacuous count needs the whole sweep
    if (visited.size === Object.keys(DEMOS).length + browsableNames().length + PERSONA_SEEDS.length) {
      for (const r of RULES.render) expect(measured[r.id], `anti-vacuous: rule ${r.id} measured no element in the whole sweep`).toBeGreaterThan(0)
    }
    const stale = [...allowed].filter((k) => visited.has(k.split('#')[0]!) && !found.has(k))
    expect(stale, 'an allowlist entry this engine no longer finds: delete its line (or add @chromium / @webkit)').toEqual([])
    const unreasoned = Object.entries(ALLOW as Record<string, string>).filter(([, why]) => typeof why !== 'string' || why.trim() === '' || why.startsWith('TODO'))
    expect(unreasoned, 'every allowlist entry carries a reason').toEqual([])
  })
})

// The negative controls: each rule, planted once in a column at the root register, must report; the same column
// without the plant must not. A rule added to dogfood-rules.json without a plant here fails the coverage check.
const GAUGE = `<ui-gauge data='[{"label":"CPU","value":72}]'></ui-gauge>`
const PLANTS: Record<string, { bad: string; good: string; width?: number; rule?: string }> = {
  register: { bad: '<ui-button style="--md-sys-height: 52px">Save</ui-button>', good: '<ui-button>Save</ui-button>' },
  'pill-radius': { bad: '<ui-button style="border-radius: 2px">Save</ui-button>', good: '<ui-button>Save</ui-button>' },
  'icon-square': { bad: '<ui-button><ui-icon name="plus"></ui-icon></ui-button>', good: '<ui-button icon-only aria-label="Add"><ui-icon name="plus"></ui-icon></ui-button>' },
  'type-floor': { bad: '<p style="font-size: 7px">Tiny</p>', good: '<p>Body</p>' },
  column: { bad: '<div style="inline-size: 700px">Wide</div>', good: '<div>Narrow</div>', width: 400 },
  'nested-card': { bad: '<ui-card><ui-card>Inner</ui-card></ui-card>', good: '<ui-card>One</ui-card>' },
  'control-height': { bad: '<ui-button style="block-size: 37px">Save</ui-button>', good: '<ui-button>Save</ui-button>' },
  'text-edge': { bad: '<ui-button style="padding-inline: 3px">Save</ui-button>', good: '<ui-button>Save</ui-button>' },
  'card-radius': { bad: '<ui-card style="border-radius: 3px">One</ui-card>', good: '<ui-card>One</ui-card>' },
  'panel-radius': { bad: '<ui-multi-select style="border-radius: 1px"><ui-option value="a">A</ui-option></ui-multi-select>', good: '<ui-multi-select><ui-option value="a">A</ui-option></ui-multi-select>' },
  'badge-hug': { bad: '<div style="display: flex; flex-direction: column"><ui-badge style="max-inline-size: none">3</ui-badge></div>', good: '<div style="display: flex; flex-direction: column"><ui-badge>3</ui-badge></div>' },
  'option-indicator': {
    bad: '<style>ui-multi-select > [role=option]::before { display: none }</style><ui-multi-select><div role="option" value="a">A</div></ui-multi-select>',
    good: '<ui-multi-select><div role="option" value="a">A</div></ui-multi-select>',
  },
  'inline-text': { bad: '<p>Read the <ui-text as="a" href="https://example.com" style="display: block">record</ui-text> now.</p>', good: '<p>Read the <ui-text as="a" href="https://example.com">record</ui-text> now.</p>' },
  'adornment-gap': {
    bad: '<style>ui-text-field [data-role=stepper] { gap: 0 !important }</style><ui-text-field type="number" value="5"></ui-text-field>',
    good: '<ui-text-field type="number" value="5"></ui-text-field>',
  },
  'entry-cell-radius': { bad: '<ui-otp-field length="4" style="--ui-otp-field-radius: 12px"></ui-otp-field>', good: '<ui-otp-field length="4"></ui-otp-field>' },
  'glyph-box': { bad: '<ui-glyph symbol="check" style="--ui-glyph-slot: 30px"></ui-glyph>', good: '<ui-glyph symbol="check"></ui-glyph>' },
  // at n 5 (product / sm at size sm; the root is product / md since Amendment 8) the bare formula 2n - 2c is 6px, the floor 8px (T-0143); ui-glyph centres the floored box in its 2n slot
  // (inset (2n - glyph box) / 2 = 1px), so the plant restores the old inset c (2px) a side and draws the unfloored 6px mark
  'glyph-box at n 5': {
    rule: 'glyph-box',
    bad: '<div data-scale="sm" size="sm"><ui-glyph symbol="check" style="--ui-glyph-inset: 2px"></ui-glyph></div>',
    good: '<div data-scale="sm" size="sm"><ui-glyph symbol="check"></ui-glyph></div>',
  },
  'dash-scale': { bad: GAUGE + '<style>ui-gauge [data-part="progress"] { vector-effect: non-scaling-stroke }</style>', good: GAUGE },
  'link-ink': { bad: '<ui-row><a href="#a">Raw link</a></ui-row>', good: '<ui-breadcrumb><a href="#a">Home</a><span>Here</span></ui-breadcrumb>' },
  'disabled-ink': { bad: '<ui-button disabled style="--ui-button-ink: rgb(0, 0, 0); --ui-button-bg: rgb(255, 255, 255)">Save</ui-button>', good: '<ui-button disabled>Save</ui-button>' },
  'disabled-ghost': { bad: '<ui-button variant="ghost" disabled style="--ui-button-bg: rgb(220, 220, 220)">Previous</ui-button>', good: '<ui-button variant="ghost" disabled>Previous</ui-button>' },
  'disabled-edge': { bad: '<ui-switch disabled style="--ui-switch-track: transparent; --ui-switch-track-edge: transparent"></ui-switch>', good: '<ui-switch disabled></ui-switch>' },
  'disabled-toggle-fill': { bad: '<style>ui-toggle.planted[disabled] { --ui-toggle-bg: rgb(136, 136, 136) }</style><ui-toggle class="planted" disabled>Bell</ui-toggle>', good: '<ui-toggle disabled>Bell</ui-toggle>' },
  'button-text-ink': { bad: '<ui-button><ui-text style="color: rgb(255, 0, 0)">Save</ui-text></ui-button>', good: '<ui-button><ui-text>Save</ui-text></ui-button>' },
  'avatar-disc': { bad: '<ui-avatar identity="Ada Lovelace" style="--ui-avatar-plane: transparent; --ui-avatar-plane-base: transparent"></ui-avatar>', good: '<ui-avatar identity="Ada Lovelace"></ui-avatar>' },
  'badge-overlay': {
    bad: '<div style="position: relative"><div data-part="image" style="block-size: 120px"></div><ui-badge style="position: absolute; inset: 8px auto auto 8px; --ui-badge-fill: rgb(0 0 0 / 0.1)">Best rate</ui-badge></div>',
    good: '<div style="position: relative"><div data-part="image" style="block-size: 120px"></div><ui-badge style="position: absolute; inset: 8px auto auto 8px; --ui-badge-fill: var(--md-sys-color-neutral-surface)">Best rate</ui-badge></div>',
  },
  'button-identity': { bad: '<ui-button><span style="display: none">Provider</span></ui-button>', good: '<ui-button>Provider</ui-button>' },
  'action-group': {
    bad: '<div style="display: flex; flex-wrap: wrap; align-items: center"><span style="flex: 1 1 auto">Bankroll 1,000 and bet 50</span><ui-button inline>Hit</ui-button><ui-button inline>Stand</ui-button><ui-button inline>Double</ui-button></div>',
    good: '<div style="display: flex; flex-wrap: wrap; align-items: center"><span style="flex: 1 0 100%">Bankroll 1,000 and bet 50</span><ui-button inline>Hit</ui-button><ui-button inline>Stand</ui-button><ui-button inline>Double</ui-button></div>',
  },
  'prose-gap': { bad: '<ui-card>Specimen</ui-card><p style="margin: 0">A note under it.</p>', good: '<ui-card>Specimen</ui-card><p style="margin: 16px 0 0">A note under it.</p>' },
  'glyph-gap': {
    bad: `<ui-game-hud style="--ui-game-hud-glyph-gap: 0px" stats='[{"label":"Chips","value":5,"intent":"success"}]'></ui-game-hud>`,
    good: `<ui-game-hud stats='[{"label":"Chips","value":5,"intent":"success"}]'></ui-game-hud>`,
  },
  'scroll-clip': {
    bad: '<div style="display: flex; gap: 8px; overflow-x: auto"><ui-card style="flex: none; inline-size: 200px">A</ui-card><ui-card style="flex: none; inline-size: 200px">B</ui-card></div>',
    good: '<div style="display: flex; flex-wrap: wrap; gap: 8px; overflow-x: auto"><ui-card style="flex: none; inline-size: 140px">A</ui-card><ui-card style="flex: none; inline-size: 140px">B</ui-card></div>',
    width: 400,
  },
}

describe('render lint: one injected violation per rule turns it red (negative controls)', () => {
  it('every render rule has a plant, and every rule carries id, adr, selector, measure and expect', () => {
    for (const r of RULES.render) {
      expect(PLANTS[r.id], `rule ${r.id} has no negative control`).toBeDefined()
      for (const k of ['id', 'adr', 'selector', 'measure', 'expect'] as const) expect(typeof r[k] === 'string' && r[k] !== '', `rule ${r.id} carries ${k}`).toBe(true)
    }
  })
  for (const [name, plant] of Object.entries(PLANTS)) {
    const id = plant.rule ?? name
    it(`${name}: the plant reports, the clean twin does not`, async () => {
      const width = plant.width ?? 400
      await page.viewport(width, 900)
      const column = document.createElement('div')
      column.style.inlineSize = '300px'
      document.body.append(column)
      column.innerHTML = plant.bad
      await raf()
      expect(CHECKS[id]!(column, { width, column }).length, `${id}: the injected violation is found`).toBeGreaterThan(0)
      column.innerHTML = plant.good
      await raf()
      expect(CHECKS[id]!(column, { width, column }), `${id}: the clean twin passes`).toEqual([])
    })
  }
  it('the register walker reads the nearest carrier of each axis', () => {
    const outer = document.createElement('div')
    outer.setAttribute('data-tier', 'widget')
    outer.setAttribute('data-scale', 'md')
    outer.innerHTML = '<div size="lg"><span data-density="compact"><b></b></span></div>'
    document.body.append(outer)
    const r = registerOf(outer.querySelector('b')!)
    expect([r.tier, r.scale, r.size, r.density]).toEqual(['widget', 'md', 'lg', 'compact'])
    expect(registerOf(document.body).tier, 'the root default').toBe('product')
  })
})
