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
import type { Resolved, Step, Tier } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import { ROOT_REGISTER, STEP, glyphBox, hasOwner } from '../../scripts/lib/foundations-rules.mjs'
import RULES from '../../scripts/dogfood-rules.json'
import ALLOW from '../../scripts/dogfood-render-allowlist.json'

// REAL-TIMING HEADROOM (vitest.browser.config.ts): four viewport and scheme round trips per page.
vi.setConfig({ testTimeout: 60_000 })

// dogfood-render.browser.test.ts: the render lint (T-0136, layer 1 of .claude/docs/references/dogfood-lint.md).
// It visits every docs demo page, every browsable A2UI catalog widget and every persona seed with a persona widget
// (T-0144) at 400 and 1000px, light and dark, and checks the computed style against the `render` rules of
// scripts/dogfood-rules.json. Every geometry value comes from scale.mjs resolve() at the element's register: the
// nearest data-tier, data-scale, data-size or size and data-density on the element or an ancestor (the cascade
// foundations.gen.css builds), the shared ROOT_REGISTER at the root (scripts/lib/foundations-rules.mjs, ADR-0245
// Amendment 8), and widget at scale md on an A2UI canvas (the renderer stamps it). A finding is keyed `demo/<page>#<rule>`,
// `widget/<Type>#<rule>` or `persona/<seed>#<rule>`; the gate fails on a key that
// scripts/dogfood-render-allowlist.json does not list, and on a listed key this engine no longer finds (stale). A
// key that holds in one engine only carries `@chromium` or `@webkit`. Every reason names its owner, a T-NNNN, an
// ADR-NNNN or a ruling (T-0170, hasOwner). A permanent specimen is not debt: it carries
// `data-dogfood-ok="<rule>"` and a non-empty `data-dogfood-reason` on the element (T-0170; honoured by nested-card).
// The last block is the negative control: one injected violation per rule, each of which must turn its rule red.

type Rule = (typeof RULES.render)[number]
type Finding = { rule: string; detail: string }
type Ctx = { width: number; column: Element }

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
/** Wait for every finite animation and CSS transition to finish. A control that slides in on mount (ui-drill-panel's
 *  `@starting-style` translateX, T-0244) is measured mid-flight otherwise, and its box depends on host load. */
const settled = async (): Promise<void> => {
  await raf()
  for (let pass = 0; pass < 5; pass++) {
    const running = document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
    if (running.length === 0) return
    await Promise.all(running.map((a) => a.finished.catch(() => undefined)))
    await raf()
  }
}
const TOL = 0.5
const STEPS = new Set(['sm', 'md', 'lg'])
const TIERS = new Set(Object.keys(CFG.tiers))
const DENSITIES = new Set(Object.keys(CFG.density))
const WIDTHS = [400, 1000]
const SCHEMES = ['light', 'dark'] as const
const ENGINE = server.browser
// disabled-edge and avatar-disc (dogfood-rules.json `expect`): the least contrast a silhouette keeps against its surface
const SILHOUETTE_MIN = 1.3

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
  return resolve(tier ?? ROOT_REGISTER.tier, scale ?? ROOT_REGISTER.scale, size ?? 'md', density ?? 'default')
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
const STILL_ATTR = 'data-dogfood-still'
const STILL = Object.assign(document.createElement('style'), {
  textContent: `[${STILL_ATTR}], [${STILL_ATTR}]::before, [${STILL_ATTR}]::after, [${STILL_ATTR}] *, [${STILL_ATTR}] *::before, [${STILL_ATTR}] *::after { transition: none !important }`,
})
async function lifted<T>(el: HTMLElement, attr: string, fn: () => T): Promise<T> {
  const was = el.getAttribute(attr)
  // transitions off for this subtree only: a part (an OTP cell) may transition its own ink
  if (!STILL.isConnected) document.head.append(STILL)
  el.setAttribute(STILL_ATTR, '')
  el.removeAttribute(attr)
  await whenFlushed() // a field's :state(disabled) follows its prop in an effect; let that batch run before the read
  try {
    return fn()
  } finally {
    if (was !== null) el.setAttribute(attr, was)
    await whenFlushed()
    for (const n of [el, ...el.querySelectorAll('*')]) getComputedStyle(n).color // settle the restored style while transitions are still off
    el.removeAttribute(STILL_ATTR)
  }
}
/** A colour token as `el` resolves it (light-dark() and var() included), read through a property no control
 *  transitions or paints from, then put back. */
function tokenColor(el: HTMLElement, name: string): Rgba {
  const was = el.style.getPropertyValue('column-rule-color')
  el.style.setProperty('column-rule-color', `var(${name})`)
  try {
    return rgbaOf(getComputedStyle(el).columnRuleColor)
  } finally {
    if (was) el.style.setProperty('column-rule-color', was)
    else el.style.removeProperty('column-rule-color')
  }
}
/** True when a box paints anything of its own: a fill, an image, a visible border or a shadow. A pseudo-element
 *  whose content is none or normal generates no box, whatever its other styles say. */
function paints(cs: CSSStyleDeclaration, pseudo = false): boolean {
  if (cs.display === 'none' || cs.visibility === 'hidden') return false
  if (pseudo && (cs.content === 'none' || cs.content === 'normal')) return false
  if (rgbaOf(cs.backgroundColor).a > 0 || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') return true
  return (['Top', 'Right', 'Bottom', 'Left'] as const).some((s) => px(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && rgbaOf(cs[`border${s}Color`]).a > 0)
}
/** The cap height of an element's computed font: the ascent of H on a canvas set in that font. */
let typeCanvas: CanvasRenderingContext2D | null = null
function capHeight(el: Element): number {
  const cs = getComputedStyle(el)
  typeCanvas ??= document.createElement('canvas').getContext('2d')!
  typeCanvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  return typeCanvas.measureText('H').actualBoundingBoxAscent
}
/** A named number a rule row carries beside its prose (a threshold or a factor), never a repeated literal. */
const param = (id: string, key: string): number => {
  const v = (RULES.render.find((r: Rule) => r.id === id) as Record<string, unknown> | undefined)?.[key]
  if (typeof v !== 'number') throw new Error(`dogfood-rules.json: render rule ${id} has no number ${key}`)
  return v
}
const LAYOUT = new Set((RULES.render.find((r: Rule) => r.id === 'icon-box') as { layout?: string[] } | undefined)?.layout ?? [])
/** The nearest ui-* ancestor of `el` (not `el` itself), or null. */
function hostOf(el: Element): Element | null {
  for (let up = el.parentElement; up; up = up.parentElement) if (up.localName.startsWith('ui-')) return up
  return null
}
const isRtl = (el: Element): boolean => getComputedStyle(el).direction === 'rtl'
const scrollsX = (el: Element): boolean => {
  const x = getComputedStyle(el).overflowX
  return x === 'auto' || x === 'scroll'
}
// The indicator controls whose box is the host's ::before (disabled-edge); every other disabled-edge match is a field frame.
const INDICATORS = new Set(['ui-switch', 'ui-checkbox', 'ui-radio'])
// The entry fields' boxes (the frame field-outline.browser.test.ts reads): the host for a text-field or textarea,
// the part for a cell, a trigger or an editor.
const FIELD_BOXES = "ui-text-field, ui-textarea, ui-otp-field > [data-part='cell'], ui-select > [data-part='trigger'], ui-combo-box > [data-part='editor']"
// The chart chips (chart-axis.css cl.2): the value-scale and category pills and the highlight callout.
const CHART_CHIPS = ['ui-column-chart', 'ui-line-chart'].map((c) => `${c} :is([data-part='tick-label'], [data-part='category-label'], [data-part='callout'])`).join(', ')
const fieldHost = (el: Element): HTMLElement => (el.localName.startsWith('ui-') ? el : el.parentElement!) as HTMLElement
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
const CHECKS: Record<string, (root: Element, ctx: Ctx) => string[] | Promise<string[]>> = {
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
      if (el.parentElement?.closest('ui-card') && !specimen(el, 'nested-card')) out.push(`${tagOf(el)} inside a ui-card`)
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
      const want = glyphBox(r) // T-0143: the glyph box floors at GLYPH_FLOOR (Kim's ruling)
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
  async 'disabled-ink'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['disabled-ink'])) {
      // an empty field part shows no ink to quiet (an empty OTP cell, an editor with no value)
      if (!el.localName.startsWith('ui-') && (el.textContent ?? '').trim() === '') continue
      const off = visible(el) ? inkRatio(el) : null
      if (off === null) continue
      // a field part's disabled lives on its host (T-0168): lift it there, and read the part
      const on = await lifted((el.closest('[disabled]') ?? el) as HTMLElement, 'disabled', () => inkRatio(el))
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
    // a switch track, checkbox box or radio ring is the host's ::before; a field's frame is its own box (T-0168)
    for (const el of each(root, SELECTOR['disabled-edge']!)) {
      const own = INDICATORS.has(el.localName)
      const box = getComputedStyle(el, own ? '::before' : undefined)
      const surface = visible(el) ? backdrop(own ? el : el.parentElement) : null
      const layers = layersOf(box)
      if (!surface || !layers || box.display === 'none' || px(box.width) <= 0) continue
      measured['disabled-edge']++
      const fill = flatten(layers, surface)
      const edge = px(box.borderTopWidth) > 0 ? over(rgbaOf(box.borderTopColor), fill) : fill
      const ratio = Math.max(contrast(fill, surface), contrast(edge, surface))
      if (ratio < SILHOUETTE_MIN) out.push(`${tagOf(el)} disabled edge ${fmt(ratio)}:1 against its surface`)
    }
    return out
  },
  async 'disabled-toggle-fill'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-toggle[disabled]:not([pressed])')) {
      if (!visible(el) || el.matches(':state(pressed)')) continue
      const off = backdrop(el)
      const on = await lifted(el as HTMLElement, 'disabled', () => backdrop(el))
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
      if (ratio < SILHOUETTE_MIN) out.push(`${tagOf(el)} disc ${fmt(ratio)}:1 against its surface`)
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
    for (const el of each(root, "ui-game-hud [data-part='glyph'], ui-result-card [data-part='glyph'], ui-product-card [data-part='rating-stars']")) {
      if (el.closest('ui-badge')) continue // a status badge's mark keeps the badge rhythm (2c, Amendment 4), not the stat gap (T-0170)
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
  // T-0168: the 2026-10-13/14 rulings and the round-3 proposals (T-0146 to T-0150) that measure mechanically.
  'field-outline'(root) {
    const out: string[] = []
    const min = param('field-outline', 'boundaryMin')
    for (const el of each(root, FIELD_BOXES)) {
      const host = fieldHost(el)
      const resting = !host.matches('[disabled], :state(disabled), :focus-within, :state(user-invalid)') && !el.hasAttribute('data-active')
      const surface = resting && visible(el) ? backdrop(el.parentElement) : null
      if (!surface) continue
      measured['field-outline']++
      const cs = getComputedStyle(el)
      if (px(cs.borderTopWidth) <= 0 || cs.borderTopStyle === 'none') {
        out.push(`${tagOf(el)} paints no resting boundary`)
        continue
      }
      const ratio = contrast(over(rgbaOf(cs.borderTopColor), surface), surface)
      if (ratio < min - 0.005) out.push(`${tagOf(el)} resting edge ${fmt(ratio)}:1 against its surface, want ${min}:1`)
    }
    return out
  },
  async 'slider-disabled'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['slider-disabled']!) as HTMLElement[]) {
      const rail = el.querySelector('.rail')
      const surface = visible(el) && rail ? backdrop(el) : null
      if (!surface || !rail) continue
      measured['slider-disabled']++
      const ratio = contrast(over(tokenColor(el, '--ui-slider-fill'), surface), over(tokenColor(el, '--ui-slider-rail'), surface))
      if (ratio < SILHOUETTE_MIN) out.push(`${tagOf(el)} disabled fill ${fmt(ratio)}:1 against its rail`)
      const thumb = (): number => px(getComputedStyle(rail, '::after').blockSize)
      const off = thumb()
      const on = await lifted(el, 'disabled', thumb)
      if (off > on + TOL) out.push(`${tagOf(el)} disabled thumb ${fmt(off)}px taller than enabled ${fmt(on)}px`)
    }
    return out
  },
  'switch-off-edge'(root) {
    const out: string[] = []
    const min = param('field-outline', 'boundaryMin')
    for (const el of each(root, 'ui-switch:not([disabled])') as HTMLElement[]) {
      if (el.matches(':state(checked), :state(disabled)')) continue
      const track = getComputedStyle(el, '::before')
      const surface = visible(el) ? backdrop(el) : null
      const layers = layersOf(track)
      if (!surface || !layers || track.display === 'none' || px(track.width) <= 0) continue
      measured['switch-off-edge']++
      const edge = px(track.borderTopWidth) > 0 ? contrast(over(rgbaOf(track.borderTopColor), surface), surface) : 1
      if (edge < min - 0.005) out.push(`${tagOf(el)} off track edge ${fmt(edge)}:1 against its surface, want ${min}:1`)
      const offFill = contrast(flatten(layers, surface), surface)
      const onFill = contrast(over(tokenColor(el, '--md-sys-color-primary'), surface), surface)
      if (offFill >= onFill) out.push(`${tagOf(el)} off fill ${fmt(offFill)}:1 not quieter than the on fill ${fmt(onFill)}:1`)
    }
    return out
  },
  'icon-box'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-icon')) {
      const box = visible(el)
      if (!box) continue
      measured['icon-box']++
      const host = hostOf(el)
      const inside = el.parentElement?.closest('[data-tier]') != null || (host !== null && !LAYOUT.has(host.localName))
      const want = inside ? registerOf(el).icon : px(getComputedStyle(el).fontSize)
      if (Math.abs(box.width - want) > TOL || Math.abs(box.height - want) > TOL) {
        out.push(`${tagOf(el)} ${fmt(box.width)}x${fmt(box.height)} ${inside ? `inside <${host?.localName ?? 'data-tier'}>` : 'in prose'} want ${fmt(want)}`)
      }
    }
    return out
  },
  'calendar-cap'(root) {
    const out: string[] = []
    const tracks = param('calendar-cap', 'tracks')
    const factor = param('calendar-cap', 'trackFactor')
    for (const panel of each(root, "ui-calendar [data-part='panel']")) {
      const host = panel.closest('ui-calendar')!
      const grid = panel.querySelector("[data-part='grid']")
      const box = visible(panel)
      const gridBox = grid ? visible(grid) : null
      const n = cascadeN(host)
      if (!box || !grid || !gridBox || n === null) continue
      measured['calendar-cap']++
      const cap = tracks * factor * 4 * n + (tracks - 1) * px(getComputedStyle(grid).columnGap)
      if (gridBox.width > cap + TOL) out.push(`${tagOf(panel)} grid ${fmt(gridBox.width)}px past the cap ${fmt(cap)}px`)
      // the host's content-box start edge, on the inline side its direction names
      const hostCs = getComputedStyle(host)
      const hostBox = host.getBoundingClientRect()
      const off = isRtl(host)
        ? hostBox.right - px(hostCs.borderRightWidth) - px(hostCs.paddingRight) - box.right
        : box.left - (hostBox.left + px(hostCs.borderLeftWidth) + px(hostCs.paddingLeft))
      if (Math.abs(off) > TOL) out.push(`${tagOf(panel)} starts ${fmt(off)}px off the host's start edge`)
    }
    return out
  },
  'table-pager'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-pagination')) {
      const host = hostOf(el)
      if (!visible(el) || host === null || LAYOUT.has(host.localName)) continue // a page's own pager is not a control's
      measured['table-pager']++
      for (let up = el.parentElement; up && up !== host.parentElement; up = up.parentElement) {
        if (scrollsX(up)) {
          out.push(`${tagOf(el)} inside the scroll frame ${tagOf(up)} of <${host.localName}>`)
          break
        }
      }
    }
    return out
  },
  'table-scroll-cue'(root) {
    const out: string[] = []
    for (const el of each(root, "ui-table [data-part='scroll']")) {
      if (!visible(el) || el.scrollWidth <= el.clientWidth + 1) continue
      measured['table-scroll-cue']++
      const cs = getComputedStyle(el)
      const mask = cs.maskImage || cs.getPropertyValue('-webkit-mask-image')
      if (!mask || mask === 'none') out.push(`${tagOf(el)} overflows by ${el.scrollWidth - el.clientWidth}px with no edge cue`)
    }
    return out
  },
  'ring-parity'(root) {
    const out: string[] = []
    // a ring tile often sits in its own figure, so the row is the nearest ancestor that holds two or more rings
    const rings = each(root, "ui-stat[variant='ring'] [data-part='ring']")
    const rows = new Map<Element, DOMRect[]>()
    for (const el of rings) {
      const box = visible(el)
      let row = el.closest('ui-stat')!.parentElement
      while (row && row !== root && rings.filter((r) => row!.contains(r)).length < 2) row = row.parentElement
      if (!box || !row) continue
      rows.set(row, [...(rows.get(row) ?? []), box])
    }
    for (const [parent, rings] of rows) {
      if (rings.length < 2) continue
      measured['ring-parity']++
      const line = rings.filter((b) => sameLine(b, rings[0]!))
      if (line.some((b) => Math.abs(b.width - line[0]!.width) > TOL)) out.push(`${tagOf(parent)} ring diameters ${line.map((b) => fmt(b.width)).join(', ')} on one line`)
    }
    return out
  },
  'legend-gap'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-gauge')) {
      const shapes = [...el.querySelectorAll("[data-part='rings'] circle")].map(visible).filter((b): b is DOMRect => b !== null)
      const row = [...el.querySelectorAll("[data-part='legend'] > *")].map(visible).find((b): b is DOMRect => b !== null)
      if (shapes.length === 0 || !row) continue
      const ring = shapes.reduce((a, b) => (b.width > a.width ? b : a))
      if (row.top >= ring.bottom) continue // the legend wrapped under the rings (T-0141)
      measured['legend-gap']++
      // the rings sit on the gauge's start edge in either direction, so the legend's side follows the row's centre
      const after = row.left + row.width / 2 > ring.left + ring.width / 2
      const gap = after ? row.left - ring.right : ring.left - row.right
      const max = 2 * registerOf(el).n
      if (gap < -TOL || gap > max + TOL) out.push(`${tagOf(el)} legend ${fmt(gap)}px from its outer ring, want 0 to ${max}`)
    }
    return out
  },
  'series-separation'(root) {
    const out: string[] = []
    const min = param('series-separation', 'seriesMin')
    for (const el of each(root, SELECTOR['series-separation']!) as HTMLElement[]) {
      const surface = visible(el) ? backdrop(el) : null
      if (!surface) continue
      measured['series-separation']++
      const ratio = contrast(over(tokenColor(el, '--ui-chart-series-1-ink'), surface), over(tokenColor(el, '--ui-chart-series-2-ink'), surface))
      if (ratio < min - 0.005) out.push(`${tagOf(el)} series 1 and 2 ${fmt(ratio)}:1 apart, want ${min}:1`)
    }
    return out
  },
  'chip-opaque'(root) {
    const out: string[] = []
    for (const el of each(root, CHART_CHIPS)) {
      const cs = getComputedStyle(el)
      const own = layersOf(cs)
      // only a chip with a fill of its own: a border-only or shadow-only chip has no fill to be opaque
      if (!visible(el) || own === null || own.every((l) => l.a === 0)) continue
      measured['chip-opaque']++
      const fill = flatten(own, NONE)
      if (fill.a < 0.999) out.push(`${tagOf(el)} chip fill alpha=${fmt(fill.a)}`)
      else if (inkContrast(rgbaOf(cs.color), fill) < param('chip-opaque', 'inkMin')) out.push(`${tagOf(el)} chip ink ${fmt(inkContrast(rgbaOf(cs.color), fill))}:1`)
    }
    return out
  },
  'chart-empty-mark'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-bar-chart, ui-column-chart, ui-gauge')) {
      const data = (el as HTMLElement & { data?: unknown }).data
      // an empty host that collapses to no height is itself the blank box, so only its inline size gates the read
      if (!Array.isArray(data) || data.length > 0 || el.getBoundingClientRect().width <= 0) continue
      measured['chart-empty-mark']++
      const marked =
        paints(getComputedStyle(el, '::before'), true) ||
        [...el.querySelectorAll('*')].some((n) => {
          if (!visible(n)) return false
          const cs = getComputedStyle(n)
          if (n instanceof SVGGeometryElement) return cs.visibility !== 'hidden' && ((cs.stroke !== 'none' && px(cs.strokeWidth) > 0) || (cs.fill !== 'none' && rgbaOf(cs.fill).a > 0))
          return paints(cs) || paints(getComputedStyle(n, '::before'), true)
        })
      if (!marked) out.push(`${tagOf(el)} with no data paints nothing`)
    }
    return out
  },
  'diverging-zero'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-bar-chart [data-origin]')) {
      if (!visible(el)) continue
      measured['diverging-zero']++
      const rule = getComputedStyle(el, '::before')
      const drawn = paints(rule, true) && (px(rule.borderInlineStartWidth) > 0 || px(rule.borderLeftWidth) > 0)
      if (!drawn) out.push(`${tagOf(el)} diverging track draws no zero rule`)
    }
    return out
  },
  'placeholder-dots'(root) {
    const out: string[] = []
    for (const el of each(root, '[placeholder], [aria-placeholder], [data-placeholder]')) {
      const text = (el.getAttribute('placeholder') ?? el.getAttribute('aria-placeholder') ?? el.getAttribute('data-placeholder') ?? '').trim()
      if (text === '') continue
      measured['placeholder-dots']++
      if (/(?:^|[^.])\.\.$/.test(text)) out.push(`${tagOf(el)} placeholder "${text}" ends in two periods`)
    }
    return out
  },
  'picker-dash'(root) {
    const out: string[] = []
    for (const el of each(root, SELECTOR['picker-dash']!)) {
      if (!visible(el)) continue
      measured['picker-dash']++
      const text = (el.textContent ?? '').trim()
      if (text.includes('\u2014')) out.push(`${tagOf(el)} label "${text.slice(0, 40)}" carries an em dash`)
    }
    return out
  },
  'caption-in-specimen'(root) {
    const out: string[] = []
    for (const el of each(root, '.demo-caption')) {
      if (!visible(el)) continue
      measured['caption-in-specimen']++
      const figure = el.closest('.demo-figure')
      for (let up = el.parentElement; up && up !== figure && up !== root; up = up.parentElement) {
        if (up.localName.startsWith('ui-') && (figure !== null || !LAYOUT.has(up.localName))) {
          out.push(`.demo-caption "${(el.textContent ?? '').trim().slice(0, 24)}" inside the specimen <${up.localName}>`)
          break
        }
      }
    }
    return out
  },
  'figure-parity'(root) {
    const out: string[] = []
    for (const parent of new Set(each(root, '.demo-figure').map((f) => f.parentElement!))) {
      const figures = [...parent.children].filter((c) => c.classList.contains('demo-figure')).map(visible).filter((b): b is DOMRect => b !== null)
      if (figures.length < 2) continue
      measured['figure-parity']++
      for (const b of figures) {
        const first = figures.find((a) => sameLine(a, b))!
        if (Math.abs(b.top - first.top) > param('figure-parity', 'edgeTol')) out.push(`${tagOf(parent)} figure top ${fmt(b.top - first.top)}px off its row`)
      }
    }
    return out
  },
  'overline-gap'(root) {
    const out: string[] = []
    for (const el of each(root, "ui-text[variant='overline']")) {
      const box = visible(el)
      const prev = el.previousElementSibling ? visible(el.previousElementSibling) : null
      const next = el.nextElementSibling ? visible(el.nextElementSibling) : null
      if (!box || !prev || !next || prev.bottom > box.top + TOL || next.top < box.bottom - TOL) continue
      measured['overline-gap']++
      const before = box.top - prev.bottom
      const after = next.top - box.bottom
      if (after >= before) out.push(`${tagOf(el)} ${fmt(after)}px above its block, ${fmt(before)}px below the previous`)
    }
    return out
  },
  'avatar-cluster'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-avatar')) {
      const next = el.nextElementSibling
      const a = visible(el)
      const b = next?.localName === 'ui-avatar' ? visible(next) : null
      if (!a || !b || !sameLine(a, b)) continue
      const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      if (overlap <= TOL) continue
      measured['avatar-cluster']++
      if (overlap > a.width / param('avatar-cluster', 'widthDivisor') + TOL) out.push(`${tagOf(next!)} covers ${fmt(overlap)}px of a ${fmt(a.width)}px neighbour`)
      const cs = getComputedStyle(next!)
      const ring = cs.boxShadow !== 'none' || (cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0) || px(cs.borderTopWidth) > 0
      if (!ring) out.push(`${tagOf(next!)} overlaps its neighbour with no ring`)
    }
    return out
  },
  'supporting-ink'(root) {
    const out: string[] = []
    for (const el of each(root, '.demo-supporting')) {
      let title = el.previousElementSibling
      while (title && (!visible(title) || !TEXTY.has(title.localName) || (title.textContent ?? '').trim() === '')) title = title.previousElementSibling
      const own = visible(el) && title ? inkRatio(el) : null
      const theirs = own !== null && title ? inkRatio(title) : null
      if (own === null || theirs === null) continue
      measured['supporting-ink']++
      if (own >= theirs - 0.01) out.push(`${tagOf(el)} ink ${fmt(own)}:1 not quieter than its title's ${fmt(theirs)}:1`)
    }
    return out
  },
  'board-letter'(root) {
    const out: string[] = []
    for (const cell of each(root, "ui-board-grid [data-part='cell']")) {
      const box = visible(cell)
      if (!box) continue
      const walk = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
      let letter: Element | null = null
      for (let t = walk.nextNode(); t && !letter; t = walk.nextNode()) if (/^\p{Lu}$/u.test((t.textContent ?? '').trim())) letter = t.parentElement
      if (!letter) continue
      measured['board-letter']++
      const cap = capHeight(letter)
      if (cap < box.height / param('board-letter', 'cellDivisor') - TOL) out.push(`${tagOf(cell)} letter cap height ${fmt(cap)}px in a ${fmt(box.height)}px cell`)
    }
    return out
  },
  'unframed-inset'(root) {
    const out: string[] = []
    for (const el of each(root, 'ui-board-grid')) {
      const box = visible(el)
      if (!box || paints(getComputedStyle(el))) continue
      const first = [...el.querySelectorAll("[data-part='cell']")].map(visible).find((b): b is DOMRect => b !== null)
      if (!first) continue
      measured['unframed-inset']++
      const inset = isRtl(el) ? box.right - first.right : first.left - box.left
      if (Math.abs(inset) > param('unframed-inset', 'edgeTol')) out.push(`${tagOf(el)} paints no frame but its first cell starts ${fmt(inset)}px in`)
    }
    return out
  },
}

/** A permanent specimen's marker (T-0170): the element lists `rule` in data-dogfood-ok and says why. */
export function specimen(el: Element, rule: string): boolean {
  const ok = (el.getAttribute('data-dogfood-ok') ?? '').split(/\s+/)
  return ok.includes(rule) && (el.getAttribute('data-dogfood-reason') ?? '').trim() !== ''
}

/** Every rule's findings in one root at one viewport. */
async function lint(root: Element, ctx: Ctx): Promise<Finding[]> {
  const out: Finding[] = []
  for (const r of RULES.render) for (const detail of await CHECKS[r.id]!(root, ctx)) out.push({ rule: r.id, detail })
  return out
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
      await settled()
      for (const f of await lint(scope(), { width, column: column() })) {
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
      expect(surface().getAttribute('data-scale'), 'the canvas register is widget / md').toBe('md')
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
      expect(surface().getAttribute('data-scale'), 'the canvas register is widget / md').toBe('md')
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
    const unreasoned = Object.entries(ALLOW as Record<string, string>).filter(([, why]) => !hasOwner(why))
    expect(unreasoned, 'every allowlist entry names its owner: a T-NNNN, an ADR-NNNN or a ruling (T-0170)').toEqual([])
  })
  it('the owner check bites: a reason with no ticket, ADR or ruling fails (T-0170)', () => {
    expect(hasOwner('day one: the split-pane lane stacks it')).toBe(false)
    expect(hasOwner('TODO: T-0187')).toBe(false)
    expect(hasOwner('owner T-0187: the specimen overflows at 400px')).toBe(true)
    expect(hasOwner("Kim's ruling 2026-10-14")).toBe(true)
  })
})

// The negative controls: each rule, planted once in a column at the root register, must report; the same column
// without the plant must not. A rule added to dogfood-rules.json without a plant here fails the coverage check.
const GAUGE = `<ui-gauge data='[{"label":"CPU","value":72}]'></ui-gauge>`
// a table wider than the 300px plant column: sixteen numeric columns never wrap below their figures
const WIDE_KEYS = Array.from({ length: 16 }, (_, i) => `m${i + 1}`)
const WIDE_COLUMNS = JSON.stringify(WIDE_KEYS.map((key) => ({ key, label: key.toUpperCase(), type: 'number' })))
const WIDE_ROWS = JSON.stringify([Object.fromEntries(WIDE_KEYS.map((key, i) => [key, 100000 + i]))])
const WIDE_ROWS_3 = JSON.stringify([0, 1, 2].map((r) => Object.fromEntries(WIDE_KEYS.map((key, i) => [key, 100000 * (r + 1) + i]))))
const LETTERS = JSON.stringify(['S', 'L', 'A'].map((mark, col) => ({ row: 0, col, mark })))
const PLANTS: Record<string, { bad: string; good: string; width?: number; rule?: string; setup?: (column: HTMLElement) => void }> = {
  register: { bad: '<ui-button style="--md-sys-height: 52px">Save</ui-button>', good: '<ui-button>Save</ui-button>' },
  'pill-radius': { bad: '<ui-button style="border-radius: 2px">Save</ui-button>', good: '<ui-button>Save</ui-button>' },
  'icon-square': { bad: '<ui-button><ui-icon name="plus"></ui-icon></ui-button>', good: '<ui-button icon-only aria-label="Add"><ui-icon name="plus"></ui-icon></ui-button>' },
  'type-floor': { bad: '<p style="font-size: 7px">Tiny</p>', good: '<p>Body</p>' },
  column: { bad: '<div style="inline-size: 700px">Wide</div>', good: '<div>Narrow</div>', width: 400 },
  'nested-card': { bad: '<ui-card><ui-card>Inner</ui-card></ui-card>', good: '<ui-card>One</ui-card>' },
  // T-0170: the specimen marker needs both the rule id and a reason; either alone stays red
  'nested-card marker without a reason': {
    rule: 'nested-card',
    bad: '<ui-card><ui-card data-dogfood-ok="nested-card">No reason</ui-card></ui-card>',
    good: '<ui-card><ui-card data-dogfood-ok="nested-card" data-dogfood-reason="a specimen">Marked</ui-card></ui-card>',
  },
  'nested-card marker for another rule': {
    rule: 'nested-card',
    bad: '<ui-card><ui-card data-dogfood-ok="card-radius" data-dogfood-reason="a specimen">Other rule</ui-card></ui-card>',
    good: '<ui-card><ui-card data-dogfood-ok="card-radius nested-card" data-dogfood-reason="a specimen">Both rules</ui-card></ui-card>',
  },
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
  // T-0168: the extended rules, one plant per new reach, and the new rules
  'pill-radius suggestion chip': {
    rule: 'pill-radius',
    bad: `<ui-suggestions style="--ui-suggestions-chip-radius: 2px" suggestions='[{"label":"Late checkout"},{"label":"Book a table"}]'></ui-suggestions>`,
    good: `<ui-suggestions suggestions='[{"label":"Late checkout"},{"label":"Book a table"}]'></ui-suggestions>`,
  },
  'disabled-ink on a field': { rule: 'disabled-ink', bad: '<ui-text-field disabled value="Ada" style="--ui-text-field-ink: rgb(0, 0, 0)"></ui-text-field>', good: '<ui-text-field disabled value="Ada"></ui-text-field>' },
  // an OTP cell transitions its own ink, so the enabled read needs the subtree's transitions off (lifted)
  'disabled-ink on an OTP cell': {
    rule: 'disabled-ink',
    bad: '<ui-otp-field length="4" disabled value="48" style="--ui-otp-field-cell-ink-disabled: var(--md-sys-color-neutral-on-surface-variant)"></ui-otp-field>',
    good: '<ui-otp-field length="4" disabled value="48"></ui-otp-field>',
  },
  'disabled-edge on a field': { rule: 'disabled-edge', bad: '<ui-text-field disabled style="--ui-text-field-border: transparent; --ui-text-field-bg: transparent"></ui-text-field>', good: '<ui-text-field disabled></ui-text-field>' },
  'glyph-gap on a rating': {
    rule: 'glyph-gap',
    bad: '<ui-product-card title="Garden room" price="$180" rating="4.6" style="--ui-product-card-rating-gap: 0px"></ui-product-card>',
    good: '<ui-product-card title="Garden room" price="$180" rating="4.6"></ui-product-card>',
  },
  'field-outline': { bad: '<ui-text-field label="Name" style="--ui-text-field-border: rgb(232, 232, 232)"></ui-text-field>', good: '<ui-text-field label="Name"></ui-text-field>' },
  'slider-disabled': { bad: '<ui-slider disabled value="40" style="--ui-slider-fill: var(--ui-slider-rail)"></ui-slider>', good: '<ui-slider disabled value="40"></ui-slider>' },
  'slider-disabled thumb': { rule: 'slider-disabled', bad: '<style>ui-slider.planted[disabled] { --ui-slider-box: 40px }</style><ui-slider class="planted" disabled value="40"></ui-slider>', good: '<ui-slider disabled value="40"></ui-slider>' },
  'switch-off-edge': { bad: '<ui-switch style="--ui-switch-track-edge: transparent"></ui-switch>', good: '<ui-switch></ui-switch>' },
  'switch-off-edge fill': { rule: 'switch-off-edge', bad: '<ui-switch style="--ui-switch-track: rgb(0, 0, 0)"></ui-switch>', good: '<ui-switch></ui-switch>' },
  'icon-box': { bad: '<p>Saved <ui-icon name="check" style="inline-size: 30px; block-size: 30px"></ui-icon></p>', good: '<p>Saved <ui-icon name="check"></ui-icon></p>' },
  'icon-box in a region': { rule: 'icon-box', bad: '<div data-tier="widget" data-scale="md"><ui-icon name="check" style="--md-sys-icon-size: 1em; font-size: 30px"></ui-icon></div>', good: '<div data-tier="widget" data-scale="md"><ui-icon name="check" style="font-size: 30px"></ui-icon></div>' },
  'calendar-cap': {
    bad: '<style>ui-calendar.planted [data-part="panel"] { max-inline-size: none }</style><div style="inline-size: 900px"><ui-calendar class="planted" value="2026-10-14"></ui-calendar></div>',
    good: '<div style="inline-size: 900px"><ui-calendar value="2026-10-14"></ui-calendar></div>',
    width: 1000,
  },
  'calendar-cap start edge': {
    rule: 'calendar-cap',
    bad: '<style>ui-calendar.planted [data-part="panel"] { margin-inline: auto }</style><div style="inline-size: 900px"><ui-calendar class="planted" value="2026-10-14"></ui-calendar></div>',
    good: '<div style="inline-size: 900px"><ui-calendar value="2026-10-14"></ui-calendar></div>',
    width: 1000,
  },
  'table-pager': {
    bad: `<ui-table label="Rooms" page-size="1" columns='${WIDE_COLUMNS}' rows='${WIDE_ROWS_3}'></ui-table>`,
    good: `<ui-table label="Rooms" page-size="1" columns='${WIDE_COLUMNS}' rows='${WIDE_ROWS_3}'></ui-table>`,
    // the plant moves the composed footer (and its pager) into the table's own scroll frame
    setup: (column) => column.querySelector("ui-table [data-part='scroll']")?.append(column.querySelector("ui-table [data-part='footer']")!),
  },
  'table-scroll-cue': {
    bad: `<style>ui-table.planted [data-part='scroll'] { mask-image: none !important; -webkit-mask-image: none !important }</style><ui-table class="planted" label="Rooms" columns='${WIDE_COLUMNS}' rows='${WIDE_ROWS}'></ui-table>`,
    good: `<ui-table label="Rooms" columns='${WIDE_COLUMNS}' rows='${WIDE_ROWS}'></ui-table>`,
  },
  'ring-parity': {
    bad: '<div style="display: flex"><ui-stat variant="ring" label="Occupancy" figure="82%" percent="82"></ui-stat><ui-stat variant="ring" label="Spa" figure="40%" percent="40" style="--ui-stat-ring-size: 4em"></ui-stat></div>',
    good: '<div style="display: flex"><ui-stat variant="ring" label="Occupancy" figure="82%" percent="82"></ui-stat><ui-stat variant="ring" label="Spa" figure="40%" percent="40"></ui-stat></div>',
  },
  'legend-gap': {
    bad: `<div style="inline-size: 640px"><style>ui-gauge.planted [data-part='legend'] { padding-inline-start: 420px !important }</style><ui-gauge class="planted" data='[{"label":"CPU","value":72},{"label":"Memory","value":40}]'></ui-gauge></div>`,
    good: `<div style="inline-size: 640px"><ui-gauge data='[{"label":"CPU","value":72},{"label":"Memory","value":40}]'></ui-gauge></div>`,
  },
  'series-separation': {
    bad: `<ui-bar-chart style="--ui-chart-series-2-ink: var(--ui-chart-series-1-ink)" data='[{"label":"Q1","value":4}]'></ui-bar-chart>`,
    good: `<ui-bar-chart data='[{"label":"Q1","value":4}]'></ui-bar-chart>`,
  },
  'chip-opaque': {
    bad: `<ui-column-chart highlight="0" style="--ui-column-chart-chip-bg: rgb(0 0 0 / 0.2)" data='[{"label":"Jan","values":[3,2]},{"label":"Feb","values":[4,1]}]'></ui-column-chart>`,
    good: `<ui-column-chart highlight="0" data='[{"label":"Jan","values":[3,2]},{"label":"Feb","values":[4,1]}]'></ui-column-chart>`,
  },
  'chart-empty-mark': { bad: '<style>ui-bar-chart.planted:empty::before { display: none }</style><ui-bar-chart class="planted" data="[]"></ui-bar-chart>', good: '<ui-bar-chart data="[]"></ui-bar-chart>' },
  'diverging-zero': {
    bad: `<style>ui-bar-chart.planted [data-origin]::before { display: none }</style><ui-bar-chart class="planted" data='[{"label":"Churn","value":-3},{"label":"Seats","value":5}]'></ui-bar-chart>`,
    good: `<ui-bar-chart data='[{"label":"Churn","value":-3},{"label":"Seats","value":5}]'></ui-bar-chart>`,
  },
  // T-0168 review: the checks that could not fire before
  'chart-empty-mark with a contentless before': {
    rule: 'chart-empty-mark',
    bad: '<style>ui-bar-chart.planted:empty::before { content: none !important }</style><ui-bar-chart class="planted" data="[]"></ui-bar-chart>',
    good: '<ui-bar-chart data="[]"></ui-bar-chart>',
  },
  'diverging-zero with a contentless before': {
    rule: 'diverging-zero',
    bad: `<style>ui-bar-chart.planted [data-origin]::before { content: none !important }</style><ui-bar-chart class="planted" data='[{"label":"Churn","value":-3},{"label":"Seats","value":5}]'></ui-bar-chart>`,
    good: `<ui-bar-chart data='[{"label":"Churn","value":-3},{"label":"Seats","value":5}]'></ui-bar-chart>`,
  },
  'picker-dash on a ui-tab': { rule: 'picker-dash', bad: '<ui-tabs><ui-tab>Auto \u2014 fastest</ui-tab></ui-tabs>', good: '<ui-tabs><ui-tab>Auto, fastest</ui-tab></ui-tabs>' },
  'picker-dash on a ui-radio': {
    rule: 'picker-dash',
    bad: '<ui-radio-group label="Mode"><ui-radio value="a">Auto \u2014 fastest</ui-radio></ui-radio-group>',
    good: '<ui-radio-group label="Mode"><ui-radio value="a">Auto, fastest</ui-radio></ui-radio-group>',
  },
  // a border-only chip has no fill to be opaque: the twin must pass, the translucent fill must not
  'chip-opaque border-only twin': {
    rule: 'chip-opaque',
    bad: `<ui-column-chart highlight="0" style="--ui-column-chart-chip-bg: rgb(0 0 0 / 0.2)" data='[{"label":"Jan","values":[3,2]},{"label":"Feb","values":[4,1]}]'></ui-column-chart>`,
    good: `<style>ui-column-chart.planted [data-part] { background: none !important; border: 1px solid currentColor }</style><ui-column-chart class="planted" data='[{"label":"Jan","values":[3,2]},{"label":"Feb","values":[4,1]}]'></ui-column-chart>`,
  },
  'calendar-cap start edge, rtl': {
    rule: 'calendar-cap',
    bad: '<style>ui-calendar.planted [data-part="panel"] { margin-inline: auto }</style><div dir="rtl" style="inline-size: 900px"><ui-calendar class="planted" value="2026-10-14"></ui-calendar></div>',
    good: '<div dir="rtl" style="inline-size: 900px"><ui-calendar value="2026-10-14"></ui-calendar></div>',
    width: 1000,
  },
  'legend-gap, rtl': {
    rule: 'legend-gap',
    bad: `<div dir="rtl" style="inline-size: 640px"><style>ui-gauge.planted [data-part='legend'] { padding-inline-start: 420px !important }</style><ui-gauge class="planted" data='[{"label":"CPU","value":72},{"label":"Memory","value":40}]'></ui-gauge></div>`,
    good: `<div dir="rtl" style="inline-size: 640px"><ui-gauge data='[{"label":"CPU","value":72},{"label":"Memory","value":40}]'></ui-gauge></div>`,
  },
  'unframed-inset, rtl': {
    rule: 'unframed-inset',
    bad: `<div dir="rtl"><ui-board-grid rows="1" cols="3" style="padding: 6px" cells='${LETTERS}'></ui-board-grid></div>`,
    good: `<div dir="rtl"><ui-board-grid rows="1" cols="3" cells='${LETTERS}'></ui-board-grid></div>`,
  },
  'placeholder-dots': { bad: '<ui-text-field placeholder="Ask anything.."></ui-text-field>', good: '<ui-text-field placeholder="Ask anything..."></ui-text-field>' },
  'picker-dash': { bad: '<ui-button>Auto \u2014 fastest</ui-button>', good: '<ui-button>Auto, fastest</ui-button>' },
  'caption-in-specimen': {
    bad: '<figure class="demo-figure"><ui-card>Ada Lovelace <span class="demo-caption">Engineer</span></ui-card><figcaption class="demo-caption">[variant=outlined]</figcaption></figure>',
    good: '<figure class="demo-figure"><ui-card>Ada Lovelace <span>Engineer</span></ui-card><figcaption class="demo-caption">[variant=outlined]</figcaption></figure>',
  },
  'figure-parity': {
    bad: '<div style="display: flex; align-items: flex-end"><figure class="demo-figure" style="margin: 0; block-size: 120px">A</figure><figure class="demo-figure" style="margin: 0; block-size: 80px">B</figure></div>',
    good: '<div style="display: flex; align-items: flex-start"><figure class="demo-figure" style="margin: 0; block-size: 120px">A</figure><figure class="demo-figure" style="margin: 0; block-size: 80px">B</figure></div>',
  },
  'overline-gap': {
    bad: '<p style="margin: 0">Intro</p><ui-text variant="overline" style="display: block; margin-block: 0 24px">What changed</ui-text><p style="margin: 0">Body</p>',
    good: '<p style="margin: 0">Intro</p><ui-text variant="overline" style="display: block; margin-block: 24px 0">What changed</ui-text><p style="margin: 0">Body</p>',
  },
  'avatar-cluster': {
    bad: '<div style="display: flex"><ui-avatar identity="Ada Lovelace" size="sm"></ui-avatar><ui-avatar identity="Grace Hopper" size="sm" style="margin-inline-start: -16px"></ui-avatar></div>',
    good: '<div style="display: flex"><ui-avatar identity="Ada Lovelace" size="sm"></ui-avatar><ui-avatar identity="Grace Hopper" size="sm" style="margin-inline-start: calc(-0.25 * var(--ui-avatar-size)); box-shadow: 0 0 0 2px white"></ui-avatar></div>',
  },
  'supporting-ink': {
    bad: '<div><ui-text>Ada Lovelace</ui-text><ui-text class="demo-supporting" style="--ui-text-color: rgb(0, 0, 0)">Engineer</ui-text></div>',
    good: '<div><ui-text>Ada Lovelace</ui-text><ui-text class="demo-supporting" style="--ui-text-color: var(--md-sys-color-neutral-on-surface-variant)">Engineer</ui-text></div>',
  },
  'board-letter': {
    bad: `<ui-board-grid rows="1" cols="3" style="--ui-board-grid-mark-size: 8px" cells='${LETTERS}'></ui-board-grid>`,
    good: `<ui-board-grid rows="1" cols="3" cells='${LETTERS}'></ui-board-grid>`,
  },
  'unframed-inset': {
    bad: `<ui-board-grid rows="1" cols="3" style="padding: 6px" cells='${LETTERS}'></ui-board-grid>`,
    good: `<ui-board-grid rows="1" cols="3" cells='${LETTERS}'></ui-board-grid>`,
  },
}

describe('render lint: one injected violation per rule turns it red (negative controls)', () => {
  it('every render rule has a plant, and every rule carries id, source, selector, measure and expect', () => {
    for (const r of RULES.render) {
      expect(PLANTS[r.id], `rule ${r.id} has no negative control`).toBeDefined()
      for (const k of ['id', 'source', 'selector', 'measure', 'expect'] as const) expect(typeof r[k] === 'string' && r[k] !== '', `rule ${r.id} carries ${k}`).toBe(true)
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
      plant.setup?.(column)
      await raf()
      expect((await CHECKS[id]!(column, { width, column })).length, `${id}: the injected violation is found`).toBeGreaterThan(0)
      column.innerHTML = plant.good
      await raf()
      expect(await CHECKS[id]!(column, { width, column }), `${id}: the clean twin passes`).toEqual([])
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
    const root = registerOf(document.body)
    expect([root.tier, root.scale], 'the root default').toEqual([ROOT_REGISTER.tier, ROOT_REGISTER.scale])
  })

  it('the page root register the cascade renders is the shared ROOT_REGISTER', () => {
    // read off the document's own computed :root inputs (foundations.gen.css), never off registerOf's fallback
    const cs = getComputedStyle(document.documentElement)
    const num = (name: string): number => Number(cs.getPropertyValue(`--md-sys-${name}`).trim())
    const row = [num('tier-n0'), num('tier-a'), num('tier-k'), num('tier-g')]
    const tier = (Object.keys(CFG.tiers) as Tier[]).find((t) => CFG.tiers[t].every((v, i) => v === row[i]))
    const scale = (Object.keys(STEP) as Step[]).find((k) => STEP[k] === num('scale-s'))
    expect([tier, scale], `the rendered :root inputs ${JSON.stringify(row)} scale ${num('scale-s')}`).toEqual([ROOT_REGISTER.tier, ROOT_REGISTER.scale])
    expect(cascadeN(document.body), 'the root n the cascade carries').toBe(resolve(ROOT_REGISTER.tier, ROOT_REGISTER.scale).n)
  })
})
