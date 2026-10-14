import { describe, it, expect, afterEach, vi } from 'vitest'
import { page, server } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import '@agent-ui/icons/phosphor'
import '../lib/warm-catalog.ts'
import '../lib/component-preview.ts'
import { browsableNames } from '../lib/a2ui-catalog-tiers.ts'
import { applyScheme } from '../lib/theme-loader.ts'
import { resolve, CFG } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import type { Resolved } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import RULES from '../../scripts/dogfood-rules.json'
import ALLOW from '../../scripts/dogfood-render-allowlist.json'

// REAL-TIMING HEADROOM (vitest.browser.config.ts): four viewport and scheme round trips per page.
vi.setConfig({ testTimeout: 60_000 })

// dogfood-render.browser.test.ts: the render lint (T-0136, layer 1 of .claude/docs/references/dogfood-lint.md).
// It visits every docs demo page and every browsable A2UI catalog widget at 400 and 1000px, light and dark, and
// checks the computed style against the `render` rules of scripts/dogfood-rules.json. Every expected value comes
// from scale.mjs resolve() at the element's register: the nearest data-tier, data-scale, data-size or size and
// data-density on the element or an ancestor (the cascade foundations.gen.css builds), product at scale sm at the
// root. A finding is keyed `demo/<page>#<rule>` or `widget/<Type>#<rule>`; the gate fails on a key that
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
  return resolve(tier ?? 'product', scale ?? 'sm', size ?? 'md', density ?? 'default')
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

/** A corner radius in px (a percentage reads against the box). */
function radiusOf(el: Element, box: DOMRect): number {
  const r = getComputedStyle(el).borderStartStartRadius.split(' ')[0] ?? '0'
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
      const r = radiusOf(el, box)
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
      if (!own || !visible(el)) continue
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

describe('render lint: the gate itself (T-0136)', () => {
  it('every rule measured something across the sweep, and no allowlist entry is stale', () => {
    console.log(`DOGFOOD_FOUND ${ENGINE} ${JSON.stringify([...found].sort())} measured ${JSON.stringify(measured)}`)
    if (visited.size === 0) return // a filtered run visits nothing to judge
    for (const r of RULES.render) expect(measured[r.id], `anti-vacuous: rule ${r.id} measured no element in the whole sweep`).toBeGreaterThan(0)
    const stale = [...allowed].filter((k) => visited.has(k.split('#')[0]!) && !found.has(k))
    expect(stale, 'an allowlist entry this engine no longer finds: delete its line (or add @chromium / @webkit)').toEqual([])
    const unreasoned = Object.entries(ALLOW as Record<string, string>).filter(([, why]) => typeof why !== 'string' || why.trim() === '' || why.startsWith('TODO'))
    expect(unreasoned, 'every allowlist entry carries a reason').toEqual([])
  })
})

// The negative controls: each rule, planted once in a column at the root register, must report; the same column
// without the plant must not. A rule added to dogfood-rules.json without a plant here fails the coverage check.
const PLANTS: Record<string, { bad: string; good: string; width?: number }> = {
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
}

describe('render lint: one injected violation per rule turns it red (negative controls)', () => {
  it('every render rule has a plant, and every rule carries id, adr, selector, measure and expect', () => {
    for (const r of RULES.render) {
      expect(PLANTS[r.id], `rule ${r.id} has no negative control`).toBeDefined()
      for (const k of ['id', 'adr', 'selector', 'measure', 'expect'] as const) expect(typeof r[k] === 'string' && r[k] !== '', `rule ${r.id} carries ${k}`).toBe(true)
    }
  })
  for (const [id, plant] of Object.entries(PLANTS)) {
    it(`${id}: the plant reports, the clean twin does not`, async () => {
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
