import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
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
// axes (elevation/brightness) + the `scrollable` signal and ui-card-content the `scrollable` scroll-mode signal,
// both reflecting · render() stays void so the agent's region children are never clobbered · the opt-in ARIA
// role rides internals, never
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

// ── props: ui-card = surfaceProps + scrollable (NO flexProps); ui-card-content = scrollable (mask automatic) ────

describe('ui-card — surface axes only (NO flexProps)', () => {
  it('static props is { elevation, brightness, scrollable } — the surfaceProps spread + the scroll signal, no flexProps', () => {
    expect(Object.keys(UICardElement.props)).toEqual(['elevation', 'brightness', 'scrollable'])
  })

  it('scrollable is a boolean prop defaulting false, reflecting to a bare `scrollable` attribute (the scroll-mode CSS hook)', () => {
    const el = new UICardElement()
    expect(el.scrollable).toBe(false)
    expect(el.hasAttribute('scrollable')).toBe(false)
    el.scrollable = true
    expect(el.getAttribute('scrollable')).toBe('') // boolean-true → bare attribute present
    el.scrollable = false
    expect(el.hasAttribute('scrollable')).toBe(false) // boolean-false removes it
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

describe('ui-card-content — the scroll-mode signal reflects (puts the CARD into scroll mode; the mask is automatic)', () => {
  it('static props is { scrollable } — one boolean, defaulting false (the scroll-fade opt-in prop is retired)', () => {
    // REVISED 2026-07-04 (Kim): the edge-fade mask is now AUTOMATIC in scroll mode — no `scroll-fade` prop.
    expect(Object.keys(UICardContentElement.props)).toEqual(['scrollable'])
    const el = new UICardContentElement()
    // `scrollable` (NOT `scroll`) — `scroll` would shadow the native Element.scroll() method (TS 2320/2416);
    // `scrollable` has no native collision, so it is a fully-typed reflecting prop (no cast needed).
    expect(el.scrollable).toBe(false)
  })

  it('scrollable reflects to a `scrollable` attribute (the A2UI-mapped / direct scroll-mode signal)', () => {
    const el = new UICardContentElement()
    el.scrollable = true
    expect(el.hasAttribute('scrollable')).toBe(true)
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

// ── keyboard operability (WCAG 2.1.1 — ADR-0046 Amendment 6) ─────────────────────────────────────
// card.css hides ui-card-content's native scrollbar in scroll mode; the fade becomes the sole scroll
// affordance. connected() compensates with a REACTIVE tabindex="0" + role=group whenever inScrollMode() is
// true (mirroring scrollFade's own gate) — pinned here in jsdom; the actual keyboard-scroll BEHAVIOUR (arrow/
// Page keys) is a real-engine concern, proven in card.browser.test.ts.

// A probe re-exposing the protected `internals`, mirroring ProbeCard above.
class ProbeCardContent extends UICardContentElement {
  get internalsProbe(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-card-content-probe', ProbeCardContent)

describe('ui-card-content — scroll-mode keyboard operability (tabindex=0 + role=group, reactive)', () => {
  it('NOT in scroll mode: no tabindex attribute, no role', () => {
    const el = new ProbeCardContent()
    document.body.append(el)
    expect(el.hasAttribute('tabindex')).toBe(false)
    expect(el.internalsProbe.role == null || el.internalsProbe.role === '').toBe(true)
    el.remove()
  })

  it('the OWN scrollable=true (standalone, no ui-card parent) arms tabindex=0 + role=group', () => {
    const el = new ProbeCardContent()
    el.scrollable = true
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.internalsProbe.role).toBe('group')
    el.remove()
  })

  it('the PARENT <ui-card scrollable> (read once at connect, mirrors the fade arming) also arms tabindex/role', () => {
    const card = document.createElement('ui-card')
    card.setAttribute('scrollable', '')
    const content = new ProbeCardContent()
    card.append(content)
    document.body.append(card)
    expect(content.getAttribute('tabindex')).toBe('0')
    expect(content.internalsProbe.role).toBe('group')
    card.remove()
  })

  it('toggling the OWN scrollable signal LIVE reactively toggles tabindex/role (unlike the parent attribute)', async () => {
    const el = new ProbeCardContent()
    document.body.append(el)
    expect(el.hasAttribute('tabindex')).toBe(false)
    el.scrollable = true
    await whenFlushed() // the effect's re-run on a dependency CHANGE is microtask-batched (only its FIRST
    // run, at connect, is synchronous) — the scheduler.ts convention every other reactive-toggle probe uses.
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.internalsProbe.role).toBe('group')
    el.scrollable = false
    await whenFlushed()
    expect(el.hasAttribute('tabindex')).toBe(false)
    expect(el.internalsProbe.role == null || el.internalsProbe.role === '').toBe(true)
    el.remove()
  })

  it('a HEADERLESS scrollable region never throws (ariaLabelledByElements is feature-detected — unsupported in jsdom)', () => {
    const card = document.createElement('ui-card')
    card.setAttribute('scrollable', '')
    const content = new ProbeCardContent()
    card.append(content)
    expect(() => document.body.append(card)).not.toThrow()
    expect(content.getAttribute('tabindex')).toBe('0')
    card.remove()
  })

  it('a scrollable region WITH a ui-card-header sibling never throws (the labelling branch is exercised, not just skipped)', () => {
    const card = document.createElement('ui-card')
    card.setAttribute('scrollable', '')
    card.innerHTML = '<ui-card-header>Title</ui-card-header>'
    const content = new ProbeCardContent()
    card.append(content)
    expect(() => document.body.append(card)).not.toThrow()
    expect(content.getAttribute('tabindex')).toBe('0')
    card.remove()
  })
})

// ── the EXPLICIT keydown handler — arithmetic + target-guard (the actual rendered scrolling is a real-engine
// concern, card.browser.test.ts; this pins the decision logic jsdom CAN evaluate) ────────────────────────────

describe('ui-card-content — the EXPLICIT scroll-mode keydown handler (deterministic, not a platform-default gamble)', () => {
  it('ArrowDown/ArrowUp move scrollTop by exactly 40px each, and call preventDefault', () => {
    const el = new ProbeCardContent()
    el.scrollable = true
    document.body.append(el)
    el.scrollTop = 100
    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    el.dispatchEvent(down)
    expect(el.scrollTop).toBe(140)
    expect(down.defaultPrevented).toBe(true)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    expect(el.scrollTop).toBe(100)
    el.remove()
  })

  it('Home jumps to 0; End jumps to scrollHeight', () => {
    const el = new ProbeCardContent()
    el.scrollable = true
    document.body.append(el)
    el.scrollTop = 100
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
    expect(el.scrollTop).toBe(0)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(el.scrollTop).toBe(el.scrollHeight)
    el.remove()
  })

  it('an UNRELATED key is left alone — not prevented, scrollTop untouched', () => {
    const el = new ProbeCardContent()
    el.scrollable = true
    document.body.append(el)
    el.scrollTop = 40
    const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    expect(el.scrollTop).toBe(40)
    el.remove()
  })

  it('a key event from a DESCENDANT is ignored — never hijacks a child control\'s own arrow-key use (target-guarded)', () => {
    const el = new ProbeCardContent()
    el.scrollable = true
    el.innerHTML = '<button id="btn">go</button>'
    document.body.append(el)
    el.scrollTop = 100
    const btn = el.querySelector('#btn') as HTMLElement
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    btn.dispatchEvent(ev)
    expect(el.scrollTop, 'scrolled from a key event whose target was a descendant, not this region').toBe(100)
    expect(ev.defaultPrevented).toBe(false)
    el.remove()
  })

  it('NOT in scroll mode: the handler no-ops (attached, but inScrollMode() gates it)', () => {
    const el = new ProbeCardContent()
    document.body.append(el)
    el.scrollTop = 40
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(el.scrollTop).toBe(40)
    el.remove()
  })

  it('DISCONNECT tears down BOTH the keydown listener and the reactive tabindex/role effect — no leak (mirrors scroll-fade.test.ts\'s own residue proof)', async () => {
    const el = new ProbeCardContent()
    el.scrollable = true
    document.body.append(el)
    expect(el.getAttribute('tabindex'), 'setup: tabindex was not armed').toBe('0')
    expect(el.internalsProbe.role, 'setup: role was not armed').toBe('group')

    el.scrollTop = 100
    el.remove() // disconnect → this.listen's auto-remove + this.effect's cleanup should both fire

    // The keydown listener is gone — dispatching directly on the (now-detached) element is a no-op.
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(el.scrollTop, 'a keydown fired after disconnect — the listener leaked').toBe(100)

    // The reactive effect is gone — toggling `scrollable` on the detached element no longer reacts. A LIVE
    // (leaked) effect would immediately strip tabindex/role the instant `scrollable` goes false; a properly
    // disposed one leaves the (now-irrelevant, stale) attribute exactly as it was at disconnect.
    el.scrollable = false
    expect(el.getAttribute('tabindex'), 'tabindex changed after disconnect — the effect leaked').toBe('0')
    expect(el.internalsProbe.role, 'role changed after disconnect — the effect leaked').toBe('group')

    // Reconnecting re-arms both, same as the rest of the family (ProbeCard's own reconnect precedent).
    document.body.append(el)
    el.scrollable = true
    await whenFlushed() // the fresh effect's re-run on this CHANGE (not its initial connect-time run) is microtask-batched
    expect(el.getAttribute('tabindex'), 'tabindex did not re-arm on reconnect').toBe('0')
    el.remove()
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
