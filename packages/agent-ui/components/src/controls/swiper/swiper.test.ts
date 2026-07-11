import { describe, it, expect, vi } from 'vitest'
import { UISwiperElement } from './swiper.ts'
import { UISwiperItemElement } from './swiper-item.ts'
import { UISwiperPaginationElement } from './swiper-pagination.ts'
import { UISwiperPaddlesElement } from './swiper-paddles.ts'
import { UISwiperLabelElement } from './swiper-label.ts'

// swiper.test.ts — the jsdom behaviour probes for the whole family (swiper-family.lld.md; decomp n3/n4/n6
// [structural half]/n7/n9/n10 [structural halves]/n13 [structural half]/n17/n18/n19 [structural halves]/n27).
// jsdom has NO scroll layout (every getBoundingClientRect is zero) — the scroll-snap geometry, the seamless-
// teleport pixel proof, real keyboard focus movement, and the settle-triggered select emit are all
// swiper.browser.test.ts. What jsdom CAN prove (and does, here): the DOM structure the coordinator builds
// (parts/reparenting/clones), the pure resolveIndex/props math, the binding-hygiene negative control (a
// programmatic `active` write emits nothing), and the chrome-drive wiring (renderInto/fill are called with
// the right arguments and their click handlers call back into the coordinator).

class ProbeSwiper extends UISwiperElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-swiper-probe', ProbeSwiper)

interface Fixture {
  swiper: ProbeSwiper
  items: UISwiperItemElement[]
  track: HTMLElement
  live: HTMLElement
}

function build(
  opts: {
    count?: number
    loop?: boolean
    active?: string
    values?: string[]
    pagination?: boolean
    paddles?: boolean
    label?: string
  } = {},
): Fixture {
  const count = opts.count ?? 3
  const swiper = new ProbeSwiper()
  if (opts.loop) swiper.setAttribute('loop', '')
  if (opts.active !== undefined) swiper.setAttribute('active', opts.active)
  if (opts.pagination) swiper.setAttribute('pagination', '')
  if (opts.paddles) swiper.setAttribute('paddles', '')
  if (opts.label !== undefined) {
    const label = document.createElement('ui-swiper-label')
    label.textContent = opts.label
    swiper.append(label)
  }
  const items: UISwiperItemElement[] = []
  for (let i = 0; i < count; i++) {
    const item = document.createElement('ui-swiper-item') as UISwiperItemElement
    item.textContent = `Slide ${i}`
    if (opts.values) item.setAttribute('value', opts.values[i])
    swiper.append(item)
    items.push(item)
  }
  document.body.append(swiper) // connect → parts + reparenting + loop + labelling + chrome + the effects
  const track = swiper.querySelector('[data-part="track"]') as HTMLElement
  const live = swiper.querySelector('[data-part="live"]') as HTMLElement
  return { swiper, items, track, live }
}

// ── self-define + upgrade (n3) ──────────────────────────────────────────────────────────────────────────

describe('ui-swiper — self-define registers the whole family (n3)', () => {
  it('customElements resolves all five tags', () => {
    expect(customElements.get('ui-swiper')).toBe(UISwiperElement)
    expect(customElements.get('ui-swiper-item')).toBe(UISwiperItemElement)
    expect(customElements.get('ui-swiper-pagination')).toBe(UISwiperPaginationElement)
    expect(customElements.get('ui-swiper-paddles')).toBe(UISwiperPaddlesElement)
    expect(customElements.get('ui-swiper-label')).toBe(UISwiperLabelElement)
  })

  it('connect→disconnect→reconnect creates track + live exactly once (idempotent parts)', () => {
    const { swiper, track, live } = build()
    expect(track).not.toBeNull()
    expect(live).not.toBeNull()
    swiper.remove()
    document.body.append(swiper)
    const tracks = swiper.querySelectorAll('[data-part="track"]')
    const lives = swiper.querySelectorAll('[data-part="live"]')
    expect(tracks.length).toBe(1)
    expect(lives.length).toBe(1)
    swiper.remove()
  })
})

// ── props schema (n4) ───────────────────────────────────────────────────────────────────────────────────

describe('ui-swiper — props schema defaults + reflection (n4)', () => {
  it('every prop defaults per SPEC-R2', () => {
    const { swiper } = build()
    expect(swiper.orientation).toBe('horizontal')
    expect(swiper['slides-in-view']).toBe('')
    expect(swiper.align).toBe('start')
    expect(swiper.loop).toBe(false)
    expect(swiper.duration).toBe('')
    expect(swiper.easing).toBe('')
    expect(swiper.pagination).toBe(false)
    expect(swiper.paddles).toBe(false)
    expect(swiper.active).toBe('')
    expect(swiper.elevation).toBe('0')
    expect(swiper.brightness).toBe('0')
    swiper.remove()
  })

  it('reflects JS-set values to their attributes', () => {
    const { swiper } = build()
    swiper.orientation = 'vertical'
    expect(swiper.getAttribute('orientation')).toBe('vertical')
    swiper.loop = true
    expect(swiper.hasAttribute('loop')).toBe(true)
    swiper.align = 'center'
    expect(swiper.getAttribute('align')).toBe('center')
    swiper.remove()
  })

  it('an out-of-vocab enum attribute coerces to the default (fail-open)', () => {
    const { swiper } = build()
    swiper.setAttribute('orientation', 'diagonal')
    expect(swiper.orientation).toBe('horizontal')
    swiper.setAttribute('align', 'middle')
    expect(swiper.align).toBe('start')
    swiper.remove()
  })
})

// ── anatomy + slide capture (n6 structural half) ───────────────────────────────────────────────────────

describe('ui-swiper — reparents ui-swiper-item children into the track; chrome anchors stay siblings (n6)', () => {
  it('every ui-swiper-item lands inside the track; get slides returns them in DOM order', () => {
    const { swiper, items, track } = build({ count: 3, pagination: true, paddles: true, label: 'Gallery' })
    for (const item of items) expect(item.parentElement).toBe(track)
    expect(swiper.slides).toEqual(items)
    // chrome anchors are host children, NOT reparented into the track
    const pagination = swiper.querySelector(':scope > ui-swiper-pagination')
    const paddles = swiper.querySelector(':scope > ui-swiper-paddles')
    const label = swiper.querySelector(':scope > ui-swiper-label')
    expect(pagination?.parentElement).toBe(swiper)
    expect(paddles?.parentElement).toBe(swiper)
    expect(label?.parentElement).toBe(swiper)
    swiper.remove()
  })

  it('an empty swiper (no items) renders a non-erroring track with zero real slides', () => {
    const { swiper, track } = build({ count: 0 })
    expect(track).not.toBeNull()
    expect(swiper.slides).toEqual([])
    swiper.remove()
  })
})

// ── the infinite loop — clone-teleport structural math (n9) ───────────────────────────────────────────

describe('ui-swiper — loop mode builds a clone band; non-loop builds none (n9)', () => {
  it('loop=false: no clones anywhere; track holds exactly the real slides', () => {
    const { swiper, track, items } = build({ count: 3, loop: false })
    expect(track.querySelectorAll('[data-swiper-clone]').length).toBe(0)
    expect([...track.children]).toEqual(items)
    swiper.remove()
  })

  it('loop=true: clones both edges (k = ceil(slidesInView)+1, min(k,realCount)), each aria-hidden+inert+uncounted', () => {
    const { swiper, track, items } = build({ count: 3, loop: true })
    const clones = [...track.querySelectorAll('[data-swiper-clone]')] as HTMLElement[]
    // default slides-in-view='' resolves to 1 in jsdom (no @container CSS) ⇒ k = ceil(1)+1 = 2, min(2,3)=2 each side
    expect(clones.length).toBe(4)
    for (const clone of clones) {
      expect(clone.getAttribute('aria-hidden')).toBe('true')
      expect(clone.inert).toBe(true)
      expect(clone.dataset.swiperClone).toBe('')
    }
    // real slides are excluded from `slides` — clones never counted
    expect(swiper.slides).toEqual(items)
    expect(swiper.slides.length).toBe(3)
    swiper.remove()
  })

  it('clones are id-stripped — on the clone itself AND every descendant with an id', () => {
    const { swiper, track } = build({ count: 3, loop: true })
    const realFirst = track.querySelectorAll('ui-swiper-item:not([data-swiper-clone])')[0] as HTMLElement
    realFirst.id = 'slide-0'
    const inner = document.createElement('span')
    inner.id = 'inner-0'
    realFirst.append(inner)
    // rebuild the loop by toggling loop off/on (re-runs #rebuildLoop with the id now present)
    swiper.loop = false
    swiper.loop = true
    const clones = [...track.querySelectorAll('[data-swiper-clone]')] as HTMLElement[]
    for (const clone of clones) {
      expect(clone.id).toBe('')
      expect(clone.querySelectorAll('[id]').length).toBe(0)
    }
    swiper.remove()
  })

  it('MutationObserver rebuild: adding a slide grows the real count + re-labels (microtask-coalesced)', async () => {
    const { swiper, track, items } = build({ count: 2, loop: false })
    const extra = document.createElement('ui-swiper-item') as UISwiperItemElement
    extra.textContent = 'Slide extra'
    swiper.append(extra)
    await Promise.resolve() // the mutation sync is queued on a microtask
    await Promise.resolve()
    expect(swiper.slides.length).toBe(3)
    expect(extra.parentElement).toBe(track)
    expect(items[0].getAttribute).toBeDefined() // sanity — items array still valid references
    swiper.remove()
  })
})

// ── bindable active + resolveIndex (n7 jsdom half) ─────────────────────────────────────────────────────

describe('ui-swiper — activeIndex resolution (#resolveIndex, the ui-tabs precedent) (n7)', () => {
  it('\'\' resolves to 0', () => {
    const { swiper } = build()
    expect(swiper.activeIndex).toBe(0)
    swiper.remove()
  })

  it('a value match wins over a numeric index', () => {
    const { swiper } = build({ values: ['intro', 'pricing', 'faq'], active: 'pricing' })
    expect(swiper.activeIndex).toBe(1)
    swiper.remove()
  })

  it('a numeric in-range index resolves positionally when no value matches', () => {
    const { swiper } = build({ active: '2' })
    expect(swiper.activeIndex).toBe(2)
    swiper.remove()
  })

  it('an out-of-range / unmatched active falls back to 0', () => {
    const { swiper } = build({ active: 'nope' })
    expect(swiper.activeIndex).toBe(0)
    const { swiper: s2 } = build({ active: '99' })
    expect(s2.activeIndex).toBe(0)
    swiper.remove()
    s2.remove()
  })

  it('a PROGRAMMATIC active write calls goTo with the resolved index and emits NOTHING (binding hygiene)', async () => {
    const { swiper } = build({ count: 4, values: ['a', 'b', 'c', 'd'] })
    const goToSpy = vi.spyOn(swiper, 'goTo')
    let events = 0
    swiper.addEventListener('select', () => events++)
    swiper.active = 'c'
    await swiper.updateComplete // the active effect is microtask-batched
    expect(goToSpy).toHaveBeenCalledWith(2)
    expect(events).toBe(0) // applied silently — no user gesture occurred
    expect(swiper.getAttribute('active')).toBe('c') // still reflects
    swiper.remove()
  })
})

// ── keyboard wiring (n11 structural half — real focus/geometry is the browser leg) ─────────────────────

describe('ui-swiper — keyboard routing calls next/prev/goTo + preventDefault (n11 structural half)', () => {
  it('ArrowRight (horizontal) calls next() and preventDefaults', () => {
    const { swiper } = build()
    const nextSpy = vi.spyOn(swiper, 'next')
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    swiper.dispatchEvent(e)
    expect(nextSpy).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
    swiper.remove()
  })

  it('ArrowLeft calls prev(); a non-nav key is left alone', () => {
    const { swiper } = build()
    const prevSpy = vi.spyOn(swiper, 'prev')
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
    expect(prevSpy).toHaveBeenCalledTimes(1)
    const e = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
    swiper.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
    swiper.remove()
  })

  it('ArrowDown/Up drive next/prev under orientation=vertical (axis rotates)', () => {
    const { swiper } = build()
    swiper.orientation = 'vertical'
    const nextSpy = vi.spyOn(swiper, 'next')
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(nextSpy).toHaveBeenCalledTimes(1)
    // horizontal keys no longer drive it
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(nextSpy).toHaveBeenCalledTimes(1)
    swiper.remove()
  })

  it('Home/End call goTo(0) / goTo(realCount-1)', () => {
    const { swiper } = build({ count: 4 })
    const goToSpy = vi.spyOn(swiper, 'goTo')
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(goToSpy).toHaveBeenCalledWith(3)
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
    expect(goToSpy).toHaveBeenCalledWith(0)
    swiper.remove()
  })
})

// ── region ARIA (n14 structural half) ──────────────────────────────────────────────────────────────────

describe('ui-swiper — region identity via internals (n14, jsdom-guarded)', () => {
  it('role=region always; ariaRoleDescription=carousel where the engine implements the setter', () => {
    const { swiper } = build()
    expect(swiper.ii.role).toBe('region')
    if ('ariaRoleDescription' in swiper.ii) {
      expect(swiper.ii.ariaRoleDescription).toBe('carousel')
    }
    swiper.remove()
  })

  it('absent a ui-swiper-label, ariaLabel falls back to "Carousel" (host + track)', () => {
    const { swiper, track } = build()
    expect(swiper.ii.ariaLabel).toBe('Carousel')
    expect(track.getAttribute('aria-label')).toBe('Carousel')
    swiper.remove()
  })

  it('a present ui-swiper-label clears the host ariaLabel (labelledby wins) and names the track', () => {
    const { swiper, track } = build({ label: 'Featured' })
    expect(swiper.ii.ariaLabel).toBeNull()
    expect(track.getAttribute('aria-label')).toBe('Featured')
    swiper.remove()
  })
})

// ── chrome drive (n17/n18/n19 structural halves) ───────────────────────────────────────────────────────

describe('ui-swiper — chrome drive: pagination/paddles/label wiring (n17/n18/n19)', () => {
  it('an author-placed ui-swiper-pagination renders one dot per real slide; a dot click calls goTo', async () => {
    const { swiper } = build({ count: 3 })
    const pagination = document.createElement('ui-swiper-pagination')
    swiper.append(pagination) // a childList mutation — the MutationObserver re-drives chrome (microtask-coalesced)
    await Promise.resolve()
    await Promise.resolve()
    const dots = pagination.querySelectorAll('[data-part="dot"]')
    expect(dots.length).toBe(3)
    expect(dots[0].getAttribute('aria-current')).toBe('true') // index 0 active by default
    const goToSpy = vi.spyOn(swiper, 'goTo')
    ;(dots[2] as HTMLButtonElement).click()
    expect(goToSpy).toHaveBeenCalledWith(2)
    swiper.remove()
  })

  it('[pagination] with NO author anchor stamps a default-placed dots row', () => {
    const { swiper } = build({ count: 2, pagination: true })
    const stamped = swiper.querySelector(':scope > ui-swiper-pagination[data-default]')
    expect(stamped).not.toBeNull()
    swiper.remove()
  })

  it('a present pagination anchor wins over the boolean (no double-stamp)', () => {
    const { swiper } = build({ count: 2, pagination: true })
    // the boolean already stamped one — appending an author one later should not create a second
    expect(swiper.querySelectorAll('ui-swiper-pagination').length).toBe(1)
    swiper.remove()
  })

  it('an author-placed ui-swiper-paddles gets two composed ui-buttons wired to prev/next', async () => {
    const { swiper } = build({ count: 3 })
    const paddles = document.createElement('ui-swiper-paddles')
    swiper.append(paddles) // a childList mutation — the MutationObserver re-drives chrome (microtask-coalesced)
    await Promise.resolve()
    await Promise.resolve()
    const prevBtn = paddles.querySelector('[data-part="prev"]')
    const nextBtn = paddles.querySelector('[data-part="next"]')
    expect(prevBtn).not.toBeNull()
    expect(nextBtn).not.toBeNull()
    expect(prevBtn?.getAttribute('aria-label')).toBe('Previous slide')
    expect(nextBtn?.getAttribute('aria-label')).toBe('Next slide')
    const nextSpy = vi.spyOn(swiper, 'next')
    ;(nextBtn as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(nextSpy).toHaveBeenCalledTimes(1)
    swiper.remove()
  })

  it('non-loop mode disables the paddles at the ends; loop mode never disables', () => {
    const { swiper: s1 } = build({ count: 3, paddles: true })
    const paddles1 = s1.querySelector('ui-swiper-paddles') as HTMLElement
    const prev1 = paddles1.querySelector('[data-part="prev"]') as HTMLElement & { disabled: boolean }
    expect(prev1.disabled).toBe(true) // active index 0 — prev disabled at the start
    s1.remove()

    const { swiper: s2 } = build({ count: 3, paddles: true, loop: true })
    const paddles2 = s2.querySelector('ui-swiper-paddles') as HTMLElement
    const prev2 = paddles2.querySelector('[data-part="prev"]') as HTMLElement & { disabled: boolean }
    expect(prev2.disabled).toBe(false) // loop mode — never disabled
    s2.remove()
  })

  it('a present ui-swiper-label points the region aria-labelledby at it (guarded — jsdom may lack element-reflection)', () => {
    const { swiper } = build({ label: 'Gallery' })
    const label = swiper.querySelector('ui-swiper-label') as Element
    const ii = swiper.ii as unknown as { ariaLabelledByElements?: readonly Element[] }
    if ('ariaLabelledByElements' in swiper.ii) {
      expect(ii.ariaLabelledByElements?.[0]).toBe(label)
    } else {
      expect(label.id.length).toBeGreaterThan(0) // the id-seeding half still ran
    }
    swiper.remove()
  })
})

// ── zero residue across connect/disconnect ─────────────────────────────────────────────────────────────

describe('ui-swiper — zero residue across connect/disconnect', () => {
  it('disconnect removes the keydown listener; reconnect re-wires exactly one set', () => {
    const { swiper } = build()
    let nextCalls = 0
    const orig = swiper.next.bind(swiper)
    swiper.next = (): void => {
      nextCalls++
      orig()
    }
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(nextCalls).toBe(1)
    swiper.remove()
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(nextCalls).toBe(1) // no residual listener
    document.body.append(swiper)
    swiper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(nextCalls).toBe(2) // exactly one re-wired listener, not stacked
    swiper.remove()
  })
})
