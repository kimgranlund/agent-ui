import { describe, it, expect } from 'vitest'
import { UIElement } from './element.ts'

// e-internals (rubric element.md D6). ARIA is set ONLY through ElementInternals (never host attributes),
// internals are acquired once, and light DOM is the default with a `static shadow` opt-in. Named probes:
// attachInternals-once · aria-internals-only · no-host-aria · read-back · light-dom-default · static-shadow.
//
// jsdom reality (verified before writing): jsdom supports attachInternals (+ the second-call throw),
// `internals.role`/`internals.ariaChecked` WITH read-back, host-attribute absence, and attachShadow — so
// every D6 fact here is jsdom-checkable. The only piece jsdom can't give is the full ACCESSIBILITY-TREE
// read-back (computed role/state as an AX client sees it); that is browser-smoke (G5+). The read-back
// proven here is via the INTERNALS surface (the IDL reflection), which is one of the two D6=5 surfaces.

class IntEl extends UIElement {
  // Re-expose the protected seam so a probe can read the single handle directly.
  get probe(): ElementInternals {
    return this.internals
  }
  // Controls set ARIA THROUGH internals; these stand in for that.
  setAria(): void {
    this.internals.role = 'switch'
    this.internals.ariaChecked = 'true'
  }
  setRoleAndChecked(role: string, checked: string): void {
    this.internals.role = role
    this.internals.ariaChecked = checked
  }
}
customElements.define('ui-int', IntEl)

class ShadowIntEl extends UIElement {
  static shadow = true
}
customElements.define('ui-int-shadow', ShadowIntEl)

describe('e-internals — internals-only ARIA + light-DOM render root (D6)', () => {
  it('attachInternals-once: a single stable handle; a second attachInternals() throws (D6=3)', () => {
    const el = new IntEl()
    expect(typeof el.probe).toBe('object')
    expect(el.probe).toBe(el.probe) // the same handle every access
    expect(() => el.attachInternals()).toThrow() // re-acquisition is forbidden → single acquisition
  })

  it('aria-internals-only: ARIA is set through the protected internals seam (D6=3)', () => {
    const el = new IntEl()
    el.setAria() // internals.role / internals.ariaChecked, via `this.internals`
    expect(el.probe.role).toBe('switch')
    expect(el.probe.ariaChecked).toBe('true')
  })

  it('no-host-aria: ARIA set via internals leaves the host with NO role/aria-* attribute (D6=3)', () => {
    const el = new IntEl()
    el.setAria()
    expect(el.getAttribute('role')).toBeNull()
    expect(el.getAttribute('aria-checked')).toBeNull()
    expect(el.hasAttributes()).toBe(false) // the host is truly clean — ARIA never touched an attribute
  })

  it('read-back: internals-set ARIA reads back via the internals surface (D6=5; AX-tree read-back is browser-smoke)', () => {
    const el = new IntEl()
    el.setRoleAndChecked('button', 'mixed')
    expect(el.probe.role).toBe('button')
    expect(el.probe.ariaChecked).toBe('mixed')
  })

  it('light-dom-default: no shadow root by default; renderRoot is the host (D6=5)', () => {
    const el = new IntEl()
    expect(el.shadowRoot).toBeNull() // light DOM — no attachShadow happened
    expect(el.renderRoot).toBe(el) // render commits into the host itself
  })

  it('static-shadow: `static shadow = true` attaches a shadow root; renderRoot is it (D6=5)', () => {
    const el = new ShadowIntEl()
    expect(el.shadowRoot).not.toBeNull()
    expect(el.renderRoot).toBe(el.shadowRoot)
  })
})
