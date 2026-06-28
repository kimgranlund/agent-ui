import { describe, it, expect } from 'vitest'
import { UIElement, UIFormElement } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { UICardElement } from './card.ts'
import { UICardHeaderElement } from './card-header.ts'
import { UICardContentElement } from './card-content.ts'
import { UICardFooterElement } from './card-footer.ts'

// G9 s7 — the ui-card FAMILY jsdom behaviour probes (decomp g9-containers s7; ADR-0015 surface / ADR-0018
// nested radius). jsdom reality: it cannot evaluate @scope, the grid, `:has()` or computed geometry — those
// are the cross-engine card.browser.test.ts. Here we pin the FOUR-element contract that IS observable in jsdom:
// each element self-defines + extends the container base (NOT form-associated) · ui-card folds the surface
// axes (elevation/brightness) and ui-card-content the scroll/scroll-fade hooks, both reflecting · render()
// stays void so the agent's region children are never clobbered · the opt-in ARIA role rides internals, never
// a host attribute · connect→disconnect is residue-free and re-arms on reconnect.

// A probe re-exposing the protected `internals` so the opt-in role (set in connected()) is readable.
class ProbeCard extends UICardElement {
  get internalsProbe(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-card-probe', ProbeCard)

// ── the four elements register + extend the container base (the first non-form family) ────────

describe('ui-card family — four elements, all UIContainerElement, none form-associated', () => {
  const cases = [
    ['ui-card', UICardElement],
    ['ui-card-header', UICardHeaderElement],
    ['ui-card-content', UICardContentElement],
    ['ui-card-footer', UICardFooterElement],
  ] as const

  it('all four self-define on import (the side-effect register)', () => {
    for (const [tag, Ctor] of cases) expect(customElements.get(tag), `${tag} not registered`).toBe(Ctor)
  })

  it('each extends UIContainerElement (→ UIElement) and is NOT a UIFormElement', () => {
    for (const [, Ctor] of cases) {
      const el = new Ctor()
      expect(el).toBeInstanceOf(UIElement)
      expect(el).toBeInstanceOf(UIContainerElement)
      expect(el).not.toBeInstanceOf(UIFormElement)
    }
    // the base never opts into form association — no static formAssociated leaks to the family
    expect('formAssociated' in UICardElement).toBe(false)
  })

  it('reuses the inherited single ElementInternals handle — a second attachInternals() throws', () => {
    expect(() => new UICardElement().attachInternals()).toThrow()
  })
})

// ── props: ui-card = surfaceProps only (NO flexProps); ui-card-content = scroll/scroll-fade ────

describe('ui-card — surface axes only (NO flexProps)', () => {
  it('static props is exactly { elevation, brightness } — the surfaceProps spread, no align/justify/gap/wrap', () => {
    expect(Object.keys(UICardElement.props)).toEqual(['elevation', 'brightness'])
  })

  it('elevation/brightness default to the neutral base 0 and carry no attribute when unset', () => {
    const el = new UICardElement()
    expect([el.elevation, el.brightness]).toEqual(['0', '0'])
    expect(el.hasAttribute('elevation')).toBe(false)
    expect(el.hasAttribute('brightness')).toBe(false)
  })

  it('elevation/brightness reflect their string value to the attribute (JS-set drives the CSS repoint)', () => {
    const el = new UICardElement()
    el.elevation = '2'
    el.brightness = '-1'
    expect(el.getAttribute('elevation')).toBe('2')
    expect(el.getAttribute('brightness')).toBe('-1')
    el.elevation = '0' // 0 is a real member — it reflects (the explicit neutral base), it does not remove
    expect(el.getAttribute('elevation')).toBe('0')
  })

  it('rejects a bare-number elevation at COMPILE time (typed literal union, not number)', () => {
    const el = new UICardElement()
    // @ts-expect-error — elevation is the literal union '-3'…'3' (typed strings), NOT a bare number
    el.elevation = 2
    el.elevation = '2' // the valid form compiles
    expect(el.elevation).toBe('2')
  })
})

describe('ui-card-content — the scrollable / scroll-fade hooks reflect', () => {
  it('static props is { scrollable, scrollFade }, both boolean, defaulting false', () => {
    expect(Object.keys(UICardContentElement.props)).toEqual(['scrollable', 'scrollFade'])
    const el = new UICardContentElement()
    // `scrollable` (NOT `scroll`) — `scroll` would shadow the native Element.scroll() method (TS 2320/2416);
    // `scrollable` has no native collision, so it is a fully-typed reflecting prop (no cast needed).
    expect(el.scrollable).toBe(false)
    expect(el.scrollFade).toBe(false)
  })

  it('scrollable reflects to a `scrollable` attribute; scrollFade reflects to the kebab `scroll-fade` attribute', () => {
    const el = new UICardContentElement()
    el.scrollable = true
    el.scrollFade = true
    expect(el.hasAttribute('scrollable')).toBe(true)
    expect(el.hasAttribute('scroll-fade')).toBe(true) // camelCase prop → hyphenated DOM attribute (the CSS hook)
    el.scrollable = false
    expect(el.hasAttribute('scrollable')).toBe(false) // boolean-false removes the attribute
  })

  it('header/footer carry NO props (the leading/label/trailing anatomy is pure CSS, no observedAttributes)', () => {
    expect('props' in UICardHeaderElement).toBe(false)
    expect('props' in UICardFooterElement).toBe(false)
    expect(UICardHeaderElement.observedAttributes).toEqual([])
    expect(UICardFooterElement.observedAttributes).toEqual([])
  })
})

// ── render() stays void — the agent's region children are never clobbered ──────────────────────

describe('ui-card — render() stays void (the regions are the content)', () => {
  it('keeps the author-composed region sub-elements as its only children (no wrapper rendered)', async () => {
    const card = document.createElement('ui-card')
    card.innerHTML =
      '<ui-card-header>Title</ui-card-header><ui-card-content>Body</ui-card-content><ui-card-footer>Foot</ui-card-footer>'
    document.body.append(card)
    await (card as UICardElement).updateComplete
    const childTags = [...card.children].map((c) => c.tagName.toLowerCase())
    expect(childTags).toEqual(['ui-card-header', 'ui-card-content', 'ui-card-footer'])
    card.remove()
  })
})

// ── ARIA — opt-in role rides internals, NEVER a host attribute ────────────────────────────────

describe('ui-card — opt-in ARIA role (group, only when named)', () => {
  it('an UNNAMED card has NO role (a generic container) and no host role attribute', () => {
    const el = new ProbeCard()
    document.body.append(el)
    expect(el.internalsProbe.role == null || el.internalsProbe.role === '').toBe(true)
    expect(el.getAttribute('role')).toBeNull()
    el.remove()
  })

  it('a card with aria-label reads as role=group THROUGH internals (never a host role attribute)', () => {
    const el = new ProbeCard()
    el.setAttribute('aria-label', 'Summary')
    document.body.append(el)
    expect(el.internalsProbe.role).toBe('group')
    expect(el.getAttribute('role')).toBeNull() // the host NEVER carries a role attribute
    el.remove()
  })

  it('aria-labelledby (not just aria-label) equally opts the card into role=group', () => {
    const el = new ProbeCard()
    el.setAttribute('aria-labelledby', 'heading-id')
    document.body.append(el)
    expect(el.internalsProbe.role).toBe('group')
    el.remove()
  })
})

// ── lifecycle — residue-free + re-arms on reconnect ───────────────────────────────────────────

describe('ui-card — connect/disconnect/reconnect', () => {
  it('connects + disconnects without throwing and re-applies the opt-in role on reconnect', () => {
    const el = new ProbeCard()
    el.setAttribute('aria-label', 'Summary')
    document.body.append(el)
    expect(el.internalsProbe.role).toBe('group')
    el.remove() // no residue to leak — the card owns no effects/listeners
    expect(() => document.body.append(el)).not.toThrow()
    expect(el.internalsProbe.role).toBe('group') // connected() re-ran, role re-armed
    el.remove()
  })
})
