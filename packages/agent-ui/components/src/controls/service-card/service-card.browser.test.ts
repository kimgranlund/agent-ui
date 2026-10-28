import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIServiceCardElement } from '@agent-ui/components/controls/service-card'

// service-card.browser.test.ts — the cross-engine (Chromium + WebKit) browser-truth probes for
// ui-service-card (ADR-0224). jsdom cannot prove paint/geometry/WHCM (service-card.test.ts pins the
// DECLARED rules) — this is the authoritative rendered-px + rendered-colour proof: the availability
// flip's dot/title-mute/action PIXELS in both states, the ADR-0223 two-posture geometry law (fill
// default / [inline] hug), the menu-slot presence-driven column, a REAL user click (not a synthetic
// dispatchEvent) proving the disabled chip is genuinely inert to a real gesture, and forced-colors.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then the component sheet (via `all.css`, which carries
// service-card.css), then the self-defining `all` entry.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; card: UIServiceCardElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, card: wrap.querySelector('ui-service-card') as UIServiceCardElement }
}
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** Alpha of a computed colour — 0 ⇒ vanished/transparent, > 0 ⇒ painted (a bare system-colour keyword is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent' || color === 'none') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

// ── ADR-0223 two postures (fill default / [inline] hug) ─────────────────────────────────────────────

describe('ui-service-card — ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host is block-level narrower + inline-level (hug)', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container — wider than the card's own natural content width
    wrap.innerHTML = `<ui-service-card name="Claims Agent" path="/claims-agent-service" description="Handles intake."></ui-service-card>`
    document.body.append(wrap)
    mounted.push(wrap)
    const host = wrap.querySelector('ui-service-card') as HTMLElement & { updateComplete: Promise<unknown> }
    await host.updateComplete

    // FILL (the default): block-level — the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('grid')

    // HUG (the ONE opt-out): [inline] flips display level; no floor is minted (the card's own content
    // already gives inline-grid a meaningful shrink-to-fit width — see service-card.css's own banner).
    host.setAttribute('inline', '')
    await (host as unknown as { updateComplete: Promise<unknown> }).updateComplete
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host did not HUG — it still fills the container').toBeLessThan(containerWidth)
    expect(hugged, 'the [inline] host collapsed to zero').toBeGreaterThan(0)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-grid')
  })
})

// ── the availability law — pixel truth, both states (cl.4) ──────────────────────────────────────────

describe('ui-service-card — the availability law, pixel truth (ADR-0224 cl.4)', () => {
  it('available: success-tinted status dot + full-ink title; unavailable: neutral dot + muted title — ONE write flips both', async () => {
    const { card } = mount(`<ui-service-card name="Claims Agent" available></ui-service-card>`)
    await card.updateComplete
    const dot = card.querySelector('[data-part="status"]') as Element

    const availableDot = getComputedStyle(dot).backgroundColor
    const availableTitle = getComputedStyle(card.querySelector('[data-part="title"]') as Element).color

    card.available = false
    await card.updateComplete
    const unavailableDot = getComputedStyle(dot).backgroundColor
    const unavailableTitle = getComputedStyle(card.querySelector('[data-part="title"]') as Element).color

    expect(unavailableDot, 'the status dot colour did not change on the availability flip').not.toBe(availableDot)
    expect(unavailableTitle, 'the title ink did not mute on the availability flip').not.toBe(availableTitle)
  })

  it('the action background repoints together with the dot/title (the whole cascade, one write)', async () => {
    const { card } = mount(`<ui-service-card name="Claims Agent" available></ui-service-card>`)
    await card.updateComplete
    const btn = card.querySelector('[data-part="action"]') as HTMLElement
    const availableBg = getComputedStyle(btn).backgroundColor

    card.available = false
    await card.updateComplete
    const unavailableBg = getComputedStyle(btn).backgroundColor
    expect(unavailableBg, 'the action chip background did not repoint on the availability flip').not.toBe(availableBg)
  })
})

// ── a REAL user gesture proves the disabled chip is genuinely inert (native platform, not simulated) ──

describe('ui-service-card — real click activation (native platform inertness)', () => {
  it('a real user click on the available action fires `action` on the host', async () => {
    const { card } = mount(`<ui-service-card name="Claims Agent" available></ui-service-card>`)
    await card.updateComplete
    let count = 0
    card.addEventListener('action', () => count++)
    await userEvent.click(card.querySelector('[data-part="action"]') as HTMLElement)
    expect(count).toBe(1)
  })

  // NOTE: no "real userEvent.click on the disabled chip" test — Playwright's own actionability wait
  // (part of `userEvent.click`) BLOCKS on "element is enabled" before ever attempting the click, so a
  // genuinely disabled target never resolves at all; the call times out rather than completing (measured
  // — both engines), which is Playwright's own confirmation that a real user gesture cannot reach it, not
  // a test bug to route around. jsdom's `.click()`-method probe (service-card.test.ts) already pins the
  // spec-level disabled-refuses-activation contract (verified to match real-engine behaviour); the tab-
  // order + forced-colors probes below cover what a real engine adds beyond that.

  it('the disabled action is out of the tab order (native platform, zero traits)', async () => {
    const { card } = mount(`<ui-service-card name="Claims Agent"></ui-service-card>`)
    card.available = false
    await card.updateComplete
    const btn = card.querySelector('[data-part="action"]') as HTMLButtonElement
    btn.focus()
    expect(document.activeElement).not.toBe(btn) // a real disabled <button> refuses focus — native platform behaviour
  })
})

// ── the menu slot — presence-driven column, top-right, stays live when unavailable (cl.3/cl.4) ────────

describe('ui-service-card — the optional menu slot (cl.3)', () => {
  it('present: a second grid column opens, the menu sits top-right; absent: single column', async () => {
    const bare = mount(`<ui-service-card name="A"></ui-service-card>`)
    await bare.card.updateComplete
    expect(getComputedStyle(bare.card).gridTemplateColumns.split(' ').length, 'a bare card must have exactly one column').toBe(1)

    const withMenu = mount(
      `<ui-service-card name="B"><button slot="menu" aria-label="More">···</button></ui-service-card>`,
    )
    await withMenu.card.updateComplete
    expect(getComputedStyle(withMenu.card).gridTemplateColumns.split(' ').length, 'a card with a menu must gain a second column').toBe(2)
    const menu = withMenu.card.querySelector('[slot="menu"]') as HTMLElement
    const body = withMenu.card.querySelector('[data-part="body"]') as HTMLElement
    expect(menu.getBoundingClientRect().left, 'the menu is not to the right of the body').toBeGreaterThan(body.getBoundingClientRect().left)
    expect(Math.round(menu.getBoundingClientRect().top), 'the menu is not top-aligned with the heading row').toBe(
      Math.round((withMenu.card.querySelector('[data-part="heading"]') as HTMLElement).getBoundingClientRect().top),
    )
  })

  it('a real click on the menu button still fires while the card is unavailable', async () => {
    const { card } = mount(`<ui-service-card name="B"><button slot="menu" aria-label="More">···</button></ui-service-card>`)
    card.available = false
    await card.updateComplete
    const menu = card.querySelector('[slot="menu"]') as HTMLButtonElement
    let count = 0
    menu.addEventListener('click', () => count++)
    await userEvent.click(menu)
    expect(count).toBe(1)
    expect(menu.disabled).toBe(false)
  })
})

// ── forced-colors (cl.6) ─────────────────────────────────────────────────────────────────────────

describe('ui-service-card forced-colors (ADR-0224 cl.6)', () => {
  it('the perimeter outline + status dot survive under forced-colors — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const { card } = mount(`<ui-service-card name="Claims Agent" available></ui-service-card>`)
    await card.updateComplete
    const dot = card.querySelector('[data-part="status"]') as HTMLElement

    // Baseline (BOTH engines): a real perimeter border + a real dot fill.
    expect(alphaOf(getComputedStyle(card).borderInlineStartColor), 'baseline perimeter outline is invisible').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(dot).backgroundColor), 'baseline dot fill is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(card).borderInlineStartColor), 'the perimeter outline vanished under forced-colors').toBeGreaterThan(0)
      expect(px(getComputedStyle(dot).borderTopWidth), 'the status dot did not gain a border under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })

  it('the disabled action chip reads GrayText under forced-colors — free from the platform, no component rule', async () => {
    if (server.browser !== 'chromium') return
    const { card } = mount(`<ui-service-card name="Claims Agent"></ui-service-card>`)
    card.available = false
    await card.updateComplete
    const btn = card.querySelector('[data-part="action"]') as HTMLButtonElement

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(btn.disabled).toBe(true) // the real platform state the GrayText treatment rides
      expect(alphaOf(getComputedStyle(btn).color), 'the disabled chip label vanished entirely under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ADR-0245 geometry pin (clause 10c), part-level since T-0352: the action part declares its own md step
// (`data-size="md"`), so its height, font and glyph gap resolve on the part against the region's ramp like
// any control, never the card's own n. The legacy opt-out keeps today's 24px; every region (the root, product
// and widget at scales sm / md / lg) gives the model's md step there; a card carrying its own data-size moves
// nothing; a host or ancestor override of the token still reaches the button. The legacy gap is read
// through layout (`inline-size: var(<token>)`) on the action itself.
const lengthOf = (el: HTMLElement, token: string): number => {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;block-size:1px;inline-size:var(${token});`
  el.append(probe)
  const width = Number.parseFloat(getComputedStyle(probe).inlineSize)
  probe.remove()
  return width
}
const actionOf = (card: Element): HTMLElement => card.querySelector<HTMLElement>("[data-part='action']")!
const REGIONS = [
  ['root', '', resolve('product', 'md', 'md')],
  ['product-sm', 'data-tier="product" data-scale="sm"', resolve('product', 'sm', 'md')],
  ['product-lg', 'data-tier="product" data-scale="lg"', resolve('product', 'lg', 'md')],
  ['widget-sm', 'data-tier="widget" data-scale="sm"', resolve('widget', 'sm', 'md')],
  ['widget-md', 'data-tier="widget" data-scale="md"', resolve('widget', 'md', 'md')],
  ['widget-lg', 'data-tier="widget" data-scale="lg"', resolve('widget', 'lg', 'md')],
] as const

describe('ui-service-card: the action part declares its own size step (T-0352)', () => {
  it('holds the md step in every region, whatever the card\'s own size', () => {
    const card = '<ui-service-card name="Claims Agent" available></ui-service-card>'
    const big = '<ui-service-card name="Claims Agent" available data-size="lg"></ui-service-card>'
    const { wrap } = mount(`<div data-foundations="legacy">${card}</div>` + REGIONS.map(([id, attrs]) => `<div id="${id}" ${attrs}>${card}${big}</div>`).join(''))
    const legacy = actionOf(wrap.querySelector('[data-foundations] ui-service-card')!)
    expect(legacy.getBoundingClientRect().height).toBe(24)
    expect(getComputedStyle(legacy).fontSize).toBe('13px') // the legacy font, through --ui-service-card-action-font-legacy
    expect(Number.parseFloat(getComputedStyle(legacy).columnGap)).toBe(lengthOf(legacy, '--md-sys-gap-sm'))
    for (const [id, , step] of REGIONS) {
      const hosts = wrap.querySelectorAll(`#${id} ui-service-card`)
      expect(hosts.length, id).toBe(2)
      for (const host of hosts) {
        const action = actionOf(host)
        const label = `${id} ${host.getAttribute('data-size') ?? 'bare'}`
        expect(action.getAttribute('data-size')).toBe('md')
        expect(action.getBoundingClientRect().height, label).toBe(step.height)
        expect(getComputedStyle(action).fontSize, label).toBe(`${step.type.control}px`)
        expect(getComputedStyle(action).columnGap, label).toBe(`${step.n}px`)
      }
    }
  })

  it('a host or ancestor override of the action tokens still reaches the button', () => {
    const { wrap } = mount(
      '<ui-service-card id="host" name="Claims Agent" available style="--ui-service-card-action-height: 40px; --ui-service-card-action-font: 17px"></ui-service-card>' +
        '<div style="--ui-service-card-action-height: 44px"><ui-service-card id="ancestor" name="Claims Agent" available></ui-service-card></div>',
    )
    const host = actionOf(wrap.querySelector('#host')!)
    expect(host.getBoundingClientRect().height).toBe(40)
    expect(getComputedStyle(host).fontSize).toBe('17px')
    expect(actionOf(wrap.querySelector('#ancestor')!).getBoundingClientRect().height).toBe(44)
  })
})
