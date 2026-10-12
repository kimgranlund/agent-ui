import { describe, it, expect, afterEach } from 'vitest'
import { UIProductCardElement } from './product-card.ts'

// product-card.test.ts: jsdom probes for ui-product-card (ADR-0243). jsdom cannot prove paint or geometry
// (product-card.browser.test.ts owns that); this pins the declared behaviour: typed props, ARIA via
// internals, the presence law for every optional part, and the action event.

class ProbeProductCard extends UIProductCardElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-product-card-probe', ProbeProductCard)

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

async function make(init: Partial<UIProductCardElement> = {}, children = ''): Promise<ProbeProductCard> {
  const el = new ProbeProductCard()
  el.innerHTML = children
  Object.assign(el, init)
  document.body.append(el)
  mounted.push(el)
  await el.updateComplete
  return el
}

const q = (el: Element, name: string): HTMLElement | null => el.querySelector(`[data-part="${name}"]`)
const ACTION = { action: 'book', context: { room: 'harbour' } }

describe('UIProductCardElement: upgrade and typed props', () => {
  it('upgrades to the class with the descriptor defaults', () => {
    const el = document.createElement('ui-product-card') as UIProductCardElement
    expect(el).toBeInstanceOf(UIProductCardElement)
    expect(el.title).toBe('')
    expect(el.rating).toBe(0)
    expect(el.badgeIntent).toBe('neutral')
    expect(el.actionLabel).toBe('Select')
    expect(el.action).toBeNull()
    expect(el.inline).toBe(false)
    expect(el.priceOld).toBe('')
    expect(el.ratingCount).toBe(0)
    expect(el.selected).toBe(false)
    expect(el.disabled).toBe(false)
  })

  it('self-defines as ui-product-card, guarded against double-define', () => {
    expect(customElements.get('ui-product-card')).toBe(UIProductCardElement)
  })

  it('kebab attributes coerce in: image-alt, price-note, badge-intent, action-label, action JSON', async () => {
    const el = await make()
    el.setAttribute('image-alt', 'Suite')
    el.setAttribute('price-note', '/ night')
    el.setAttribute('badge-intent', 'success')
    el.setAttribute('action-label', 'Book')
    el.setAttribute('action', JSON.stringify(ACTION))
    el.setAttribute('rating', '4.8')
    await el.updateComplete
    expect(el.imageAlt).toBe('Suite')
    expect(el.priceNote).toBe('/ night')
    expect(el.badgeIntent).toBe('success')
    expect(el.actionLabel).toBe('Book')
    expect(el.action).toEqual(ACTION)
    expect(el.rating).toBe(4.8)
  })

  it('inline reflects as boolean presence (ADR-0223 R2)', async () => {
    const el = await make({ inline: true })
    expect(el.hasAttribute('inline')).toBe(true)
  })

  it('selected and disabled reflect as boolean presence; price-old and rating-count coerce in (ADR-0243 Amendment 2)', async () => {
    const el = await make({ selected: true, disabled: true })
    expect(el.hasAttribute('selected')).toBe(true)
    expect(el.hasAttribute('disabled')).toBe(true)
    el.setAttribute('price-old', '$120')
    el.setAttribute('rating-count', '318')
    await el.updateComplete
    expect(el.priceOld).toBe('$120')
    expect(el.ratingCount).toBe(318)
  })
})

describe('UIProductCardElement: anatomy and presence', () => {
  it('image media: an img with src and alt, no icon; empty imageAlt is decorative alt=""', async () => {
    const el = await make({ title: 'Suite', image: 'https://example.test/a.jpg', imageAlt: 'Harbour suite', icon: 'star' })
    const img = q(el, 'media')!.querySelector('img[data-part="image"]') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('https://example.test/a.jpg')
    expect(img.alt).toBe('Harbour suite')
    expect(q(el, 'icon')).toBeNull()
    el.imageAlt = ''
    await el.updateComplete
    expect(img.hasAttribute('alt')).toBe(true)
    expect(img.getAttribute('alt')).toBe('')
  })

  it('icon header: no image plus icon renders a ui-icon in media and no img', async () => {
    const el = await make({ title: 'Astrolabe', icon: 'star' })
    const media = q(el, 'media')!
    const icon = media.querySelector('[data-part="icon"]') as HTMLElement & { glyph: string }
    expect(icon.tagName).toBe('UI-ICON')
    expect(icon.glyph).toBe('star')
    expect(media.querySelector('img')).toBeNull()
  })

  it('no image and no icon renders no media part; media precedes body', async () => {
    const el = await make({ title: 'Plain' })
    expect(q(el, 'media')).toBeNull()
    el.image = 'https://example.test/b.jpg'
    await el.updateComplete
    expect(el.firstElementChild?.getAttribute('data-part')).toBe('media')
    expect(el.children[1]?.getAttribute('data-part')).toBe('body')
  })

  it('exhibit tile: no price and no action renders no price-row and no button', async () => {
    const el = await make({ title: 'Bronze astrolabe', subtitle: 'Gallery 3', icon: 'star' })
    expect(q(el, 'price-row')).toBeNull()
    expect(el.querySelector('button')).toBeNull()
    expect(q(el, 'price')).toBeNull()
    expect(q(el, 'badge')).toBeNull()
  })

  it('price row: price and note, with the action button only when action is non-null', async () => {
    const el = await make({ title: 'Suite', price: '$312', priceNote: '/ night' })
    const row = q(el, 'price-row')!
    expect(q(row, 'price')!.textContent).toBe('$312')
    expect(q(row, 'price-note')!.textContent).toBe('/ night')
    expect(row.querySelector('button')).toBeNull()
    el.action = ACTION
    await el.updateComplete
    const button = row.querySelector('button[data-part="action"]') as HTMLButtonElement
    expect(button.type).toBe('button')
    expect(button.textContent).toBe('Select')
    expect(button.getAttribute('aria-label')).toBe('Select Suite')
    el.title = ''
    await el.updateComplete
    expect(button.getAttribute('aria-label')).toBe('Select')
  })

  it('body order: title, subtitle, rating, badge, price-row', async () => {
    const el = await make({ title: 'T', subtitle: 'S', rating: 4, badge: 'B', price: '$1' })
    const order = [...q(el, 'body')!.children].map((c) => c.getAttribute('data-part'))
    expect(order).toEqual(['title', 'subtitle', 'rating', 'badge', 'price-row'])
  })

  it('rating text reads "4.8" plus "out of 5", the stars are aria-hidden, and rating 0 renders no rating part', async () => {
    const el = await make({ title: 'Suite', rating: 4.8 })
    const rating = q(el, 'rating')!
    expect(q(rating, 'rating-value')!.textContent).toBe('4.8')
    expect(rating.textContent).toContain('out of 5')
    expect(q(rating, 'rating-stars')!.getAttribute('aria-hidden')).toBe('true')
    el.rating = 0
    await el.updateComplete
    expect(q(el, 'rating')).toBeNull()
  })

  it('rating draws five stars filled to the nearest half: full, half or empty (ADR-0243 Amendment 2)', async () => {
    const fills = (el: Element): string => [...el.querySelectorAll('[data-part="rating-star"]')].map((s) => s.getAttribute('data-fill')![0]).join('')
    const glyphs = (el: Element): string => q(el, 'rating-stars')!.textContent!
    const el = await make({ title: 'Suite', rating: 4.8 })
    expect(fills(el)).toBe('fffff')
    expect(glyphs(el)).toBe('\u2605\u2605\u2605\u2605\u2605')
    el.rating = 4.2
    await el.updateComplete
    expect(fills(el)).toBe('ffffe')
    expect(glyphs(el)).toBe('\u2605\u2605\u2605\u2605\u2606')
    el.rating = 3.5
    await el.updateComplete
    expect(fills(el)).toBe('fffhe')
    el.rating = 0.4
    await el.updateComplete
    expect(fills(el)).toBe('heeee')
    el.rating = 9
    await el.updateComplete
    expect(fills(el)).toBe('fffff')
  })

  it('rating-count renders "(318)" after the number only when above zero', async () => {
    const el = await make({ title: 'Sweater', rating: 4.2 })
    expect(q(el, 'rating-count')).toBeNull()
    el.ratingCount = 1318
    await el.updateComplete
    const count = q(el, 'rating-count')!
    expect(count.textContent).toBe('(1,318)')
    expect(q(el, 'rating')!.lastElementChild).toBe(count)
    el.ratingCount = 0
    await el.updateComplete
    expect(q(el, 'rating-count')).toBeNull()
  })

  it('price-old renders a struck <s> after the price, announced with a hidden "was", only when set', async () => {
    const el = await make({ title: 'Sweater', price: '$89', priceNote: 'today', action: ACTION })
    expect(q(el, 'price-old')).toBeNull()
    el.priceOld = '$120'
    await el.updateComplete
    const old = q(el, 'price-old')!
    expect(old.tagName).toBe('S')
    expect(old.textContent).toBe('was $120')
    expect(q(old, 'price-old-text')!.textContent).toBe('was ')
    expect([...q(el, 'price-row')!.children].map((c) => c.getAttribute('data-part'))).toEqual(['price', 'price-old', 'price-note', 'action'])
    el.priceOld = ''
    await el.updateComplete
    expect(q(el, 'price-old')).toBeNull()
  })

  it('disabled disables the real action button and clears it again; selected leaves the button enabled', async () => {
    const el = await make({ title: 'Penthouse', price: '$640', action: ACTION, actionLabel: 'Unavailable', disabled: true })
    const button = q(el, 'action') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    el.disabled = false
    el.selected = true
    await el.updateComplete
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe('Unavailable')
  })

  it('badge label and intent are forwarded to the internal ui-badge', async () => {
    const el = await make({ title: 'Suite', badge: 'Best rate', badgeIntent: 'success' })
    const badge = q(el, 'badge') as HTMLElement & { label: string; intent: string }
    expect(badge.tagName).toBe('UI-BADGE')
    expect(badge.label).toBe('Best rate')
    expect(badge.intent).toBe('success')
    el.badgeIntent = 'warning'
    await el.updateComplete
    expect(badge.intent).toBe('warning')
  })

  it('a consumer child stays a direct host child placed after the body', async () => {
    const el = await make({ title: 'Suite', image: 'https://example.test/a.jpg' }, '<p id="extra">Extra</p>')
    const parts = [...el.children].map((c) => c.getAttribute('data-part') ?? c.id)
    expect(parts).toEqual(['media', 'body', 'extra'])
  })

  it('a reconnect reuses the same parts (idempotent build)', async () => {
    const el = await make({ title: 'Suite' })
    const body = q(el, 'body')
    el.remove()
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelectorAll('[data-part="body"]').length).toBe(1)
    expect(q(el, 'body')).toBe(body)
  })
})

describe('UIProductCardElement: ARIA and events', () => {
  it('role group with ariaLabel from title, no host role or aria attribute', async () => {
    const el = await make({ title: 'Harbour Suite' })
    expect(el.probeInternals.role).toBe('group')
    expect(el.probeInternals.ariaLabel).toBe('Harbour Suite')
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('emits action with the action prop as detail; a click on the title emits nothing', async () => {
    const el = await make({ title: 'Suite', price: '$1', action: ACTION })
    const seen: unknown[] = []
    el.addEventListener('action', (e) => seen.push((e as CustomEvent).detail))
    q(el, 'title')!.click()
    expect(seen).toEqual([])
    ;(q(el, 'action') as HTMLButtonElement).click()
    expect(seen).toEqual([ACTION])
  })

  it('a disabled card emits no action from its button', async () => {
    const el = await make({ title: 'Penthouse', price: '$640', action: ACTION, disabled: true })
    let count = 0
    el.addEventListener('action', () => count++)
    ;(q(el, 'action') as HTMLButtonElement).click()
    expect(count).toBe(0)
  })

  it('emits action exactly once per click across a reconnect', async () => {
    const el = await make({ title: 'Suite', action: ACTION })
    el.remove()
    document.body.append(el)
    await el.updateComplete
    let count = 0
    el.addEventListener('action', () => count++)
    ;(q(el, 'action') as HTMLButtonElement).click()
    expect(count).toBe(1)
  })
})
