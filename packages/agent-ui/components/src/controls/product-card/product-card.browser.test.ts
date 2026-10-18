import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { rootResolve } from '../../../../../../scripts/lib/foundations-rules.mjs'
import type { UIProductCardElement } from '@agent-ui/components/controls/product-card'

/** The derived root register (product / md / md, ADR-0245 Amendment 8). */
const ROOT = rootResolve('md')
/** The explicit product / sm region the foundations pair below mounts into. */
const SM = resolve('product', 'sm', 'md')

// product-card.browser.test.ts: cross-engine (Chromium + WebKit) rendered truth for ui-product-card
// (ADR-0243). jsdom pins the declared rules (product-card.test.ts); this proves the geometry: the 16:10
// media box holds its height before the image loads, the two-line title clamp, fill by default versus the
// `inline` hug (ADR-0223), and a real user click emitting `action`.
//
// Side-effect imports in the load-bearing CSS order (ADR-0003): foundation roles and the dimensional
// ramp first, then the component sheets (via `all.css`), then the self-defining `all` entry.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const mounted: HTMLElement[] = []
const mount = async (markup: string, width = 400): Promise<{ wrap: HTMLElement; card: UIProductCardElement }> => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = `${width}px`
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const card = wrap.querySelector('ui-product-card') as UIProductCardElement
  await card.updateComplete
  return { wrap, card }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const part = (card: Element, name: string): HTMLElement => card.querySelector(`[data-part="${name}"]`) as HTMLElement

describe('ui-product-card: rendered geometry', () => {
  it('the media box reserves its 16:10 height before the image loads', async () => {
    // A src that never resolves to pixels: the box must already hold its height.
    const { card } = await mount(`<ui-product-card title="Suite" image="/__product-card-never-loads__.png"></ui-product-card>`)
    const img = part(card, 'image') as HTMLImageElement
    expect(img.naturalWidth).toBe(0)
    const media = part(card, 'media').getBoundingClientRect()
    expect(media.width).toBeGreaterThan(0)
    expect(Math.abs(media.height - (media.width * 10) / 16)).toBeLessThan(1.5)
  })

  it('T-0142: a badge over the image takes an opaque fill; the icon header is media, at least the title line tall', async () => {
    const { card } = await mount(`<ui-product-card title="Suite" image="/__product-card-never-loads__.png" badge="Best rate" badge-intent="success"></ui-product-card>`)
    const fill = getComputedStyle(part(card, 'badge')).backgroundColor
    // The alpha of any computed colour form: `rgba(r, g, b, a)` or a `/ a` slash alpha (color(), oklch()).
    const alpha = Number(fill.match(/\/\s*([\d.]+)\s*\)$/)?.[1] ?? fill.match(/^rgba\([^)]*,\s*([\d.]+)\)$/)?.[1] ?? 1)
    expect(alpha, `an opaque overlay fill, got ${fill}`).toBe(1)
    const { card: tile } = await mount(`<ui-product-card title="Bronze astrolabe" icon="star"></ui-product-card>`)
    const icon = part(tile, 'icon').getBoundingClientRect()
    const titleLine = parseFloat(getComputedStyle(part(tile, 'title')).lineHeight)
    expect(icon.height).toBeGreaterThanOrEqual(titleLine)
  })

  it('the title clamps at two lines', async () => {
    const long = 'Merino travel sweater, charcoal, relaxed fit with a long title that clamps at two lines and keeps going well past it'
    const { card } = await mount(`<ui-product-card title="${long}"></ui-product-card>`, 240)
    const title = part(card, 'title')
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight)
    expect(lineHeight).toBeGreaterThan(0)
    const height = title.getBoundingClientRect().height
    expect(height).toBeLessThanOrEqual(lineHeight * 2 + 1)
    expect(height).toBeGreaterThan(lineHeight * 1.5)
    expect(title.scrollHeight).toBeGreaterThan(title.clientHeight)
  })

  it('fills its container by default and hugs its content with inline', async () => {
    const fill = await mount(`<ui-product-card title="Suite" price="$312"></ui-product-card>`)
    expect(getComputedStyle(fill.card).display).toBe('flex')
    expect(Math.round(fill.card.getBoundingClientRect().width)).toBe(400)

    const hug = await mount(`<ui-product-card title="Suite" price="$312" inline></ui-product-card>`)
    expect(getComputedStyle(hug.card).display).toBe('inline-flex')
    expect(hug.card.getBoundingClientRect().width).toBeLessThan(400)
    expect(hug.card.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it('the body follows the ADR-0046 box model: ink 19px inline, 13px from the bottom edge, rows 8px apart (Amendment 7)', async () => {
    const { card } = await mount(`<ui-product-card title="Suite" subtitle="Sleeps 2" price="$312"></ui-product-card>`)
    const host = card.getBoundingClientRect()
    // border 1px + the 6px box inset + the region padding (12px inline, 6px block)
    expect(part(card, 'title').getBoundingClientRect().left - host.left).toBeCloseTo(19, 0)
    expect(host.bottom - part(card, 'body').getBoundingClientRect().bottom).toBeCloseTo(1, 0)
    expect(host.bottom - part(card, 'price-row').getBoundingClientRect().bottom).toBeCloseTo(13, 0)
    expect(part(card, 'subtitle').getBoundingClientRect().top - part(card, 'title').getBoundingClientRect().bottom).toBeCloseTo(8, 0)
  })

  it('the action sits at the derived 4n height, the control font (ADR-0243 Amendment 2)', async () => {
    const { card } = await mount(`<ui-product-card title="Suite" price="$312" action-label="Book" action='{"action":"book"}'></ui-product-card>`)
    const action = part(card, 'action')
    expect(action.getBoundingClientRect().height).toBe(ROOT.h)
    expect(getComputedStyle(action).fontSize).toBe(`${ROOT.type.control}px`)
  })

  it('selected draws a 2px primary outline and a transparent ghost action; disabled greys the media and fades the action', async () => {
    const IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10" fill="#6b8fb3"/></svg>')
    const { card } = await mount(`<ui-product-card title="Suite" image="${IMG}" price="$198" action-label="Selected" action='{"action":"book"}' selected></ui-product-card>`)
    const cs = getComputedStyle(card)
    expect(cs.outlineStyle).toBe('solid')
    expect(cs.outlineWidth).toBe('2px')
    expect(getComputedStyle(part(card, 'action')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(part(card, 'media')).filter).toBe('none')
    card.selected = false
    card.disabled = true
    await card.updateComplete
    expect(getComputedStyle(card).outlineStyle).toBe('none')
    expect(getComputedStyle(part(card, 'media')).filter).toBe('grayscale(1)')
    expect((part(card, 'action') as HTMLButtonElement).disabled).toBe(true)
    expect(getComputedStyle(part(card, 'action')).opacity).toBe('0.45') // the faded pill, still a visible primary fill
    expect(getComputedStyle(part(card, 'action')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('the stars are a readonly ui-rating out of the tab order, filled to the fraction, n clear of the number (T-0146)', async () => {
    const { card } = await mount(`<ui-product-card title="Suite" rating="3.5" price="$1" action-label="Book"></ui-product-card>`)
    const rating = card.querySelector('ui-rating') as HTMLElement
    await (rating as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    expect(rating.style.getPropertyValue('--value-pct')).toBe('70')
    // Inert: the composed slider cannot take focus, so it is never a tab stop.
    rating.focus()
    expect(document.activeElement).not.toBe(rating)
    const starsBox = part(card, 'rating-stars').getBoundingClientRect()
    const valueBox = part(card, 'rating-value').getBoundingClientRect()
    expect(valueBox.left - starsBox.right).toBeGreaterThanOrEqual(Number.parseFloat(getComputedStyle(part(card, 'rating')).columnGap) - 0.5)
    expect(starsBox.height).toBeGreaterThan(0)
  })

  it('a real click on the action button emits action with the action payload', async () => {
    const payload = { action: 'book', context: { room: 'harbour' } }
    const { card } = await mount(`<ui-product-card title="Suite" price="$312" action-label="Book"></ui-product-card>`)
    card.action = payload
    await card.updateComplete
    const seen: unknown[] = []
    card.addEventListener('action', (e) => seen.push((e as CustomEvent).detail))
    await userEvent.click(part(card, 'title'))
    expect(seen).toEqual([])
    await userEvent.click(part(card, 'action'))
    expect(seen).toEqual([payload])
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

describe('ui-product-card: ADR-0245 derived foundations, dark launch', () => {
  it('reads today\'s value outside a data-tier region and the derived value inside', () => {
    const { out, inside } = foundationsPair('ui-product-card', 'title="Suite" price="$312" selected')
    expect(lengthOf(out, '--ui-product-card-icon-size')).toBe(36) // T-0142: media, the 4n control height
    expect(lengthOf(inside, '--ui-product-card-icon-size')).toBe(SM.h)
    expect(lengthOf(inside, '--ui-product-card-rating-gap')).toBe(SM.n) // T-0146: stars n clear of the number
    for (const el of [out, inside]) {
      expect(lengthOf(el, '--ui-product-card-selected-outline-width')).toBe(2)
    }
  })
})

// T-0352: the action part declares its own step (`data-size="md"`, the card's control step), so its height
// and font resolve on the part against the region's ramp like any control, never the card's own n. The
// legacy opt-out keeps the old large step (36px); every region (the root, product and widget at scales sm /
// md / lg) gives scale.mjs's md step there; a card carrying its own data-size moves nothing; a host or
// ancestor override of the token still reaches the button.
const REGIONS = [
  ['root', '', resolve('product', 'md', 'md')],
  ['product-sm', 'data-tier="product" data-scale="sm"', resolve('product', 'sm', 'md')],
  ['product-lg', 'data-tier="product" data-scale="lg"', resolve('product', 'lg', 'md')],
  ['widget-sm', 'data-tier="widget" data-scale="sm"', resolve('widget', 'sm', 'md')],
  ['widget-md', 'data-tier="widget" data-scale="md"', resolve('widget', 'md', 'md')],
  ['widget-lg', 'data-tier="widget" data-scale="lg"', resolve('widget', 'lg', 'md')],
] as const
const offer = (extra = ''): string => `<ui-product-card title="Suite" price="$312" action-label="Book" action='{"action":"book"}' ${extra}></ui-product-card>`

describe('ui-product-card: the action part declares its own size step (T-0352)', () => {
  it('holds the md step in every region, whatever the card\'s own size', async () => {
    const { wrap } = await mount(`<div data-foundations="legacy">${offer()}</div>` + REGIONS.map(([id, attrs]) => `<div id="${id}" ${attrs}>${offer()}${offer('data-size="lg"')}</div>`).join(''))
    const legacy = part(wrap.querySelector('[data-foundations] ui-product-card')!, 'action')
    expect(legacy.getBoundingClientRect().height).toBe(36)
    expect(getComputedStyle(legacy).fontSize).toBe('16px') // the legacy font, through --ui-product-card-action-font-legacy
    for (const [id, , step] of REGIONS) {
      const hosts = wrap.querySelectorAll(`#${id} ui-product-card`)
      expect(hosts.length, id).toBe(2)
      for (const host of hosts) {
        const action = part(host, 'action')
        const label = `${id} ${host.getAttribute('data-size') ?? 'bare'}`
        expect(action.getAttribute('data-size')).toBe('md')
        expect(action.getBoundingClientRect().height, label).toBe(step.h)
        expect(getComputedStyle(action).fontSize, label).toBe(`${step.type.control}px`)
      }
    }
  })

  it('a host or ancestor override of the action tokens still reaches the button', async () => {
    const { wrap } = await mount(
      offer('id="host" style="--ui-product-card-action-height: 40px; --ui-product-card-action-font: 17px"') +
        `<div style="--ui-product-card-action-height: 44px">${offer('id="ancestor"')}</div>`,
    )
    const host = part(wrap.querySelector('#host')!, 'action')
    expect(host.getBoundingClientRect().height).toBe(40)
    expect(getComputedStyle(host).fontSize).toBe('17px')
    expect(part(wrap.querySelector('#ancestor')!, 'action').getBoundingClientRect().height).toBe(44)
  })
})
