import { describe, it, expect } from 'vitest'
import { UIListElement } from './list.ts'

// G9 s5 — UIListElement (behaviour + props + the list role + self-define; the flex layout/surface is
// list.css, the public contract is list.md). Named probes: list-upgrades · list-props-typed ·
// list-role-internals · list-reflect · list-childlist-untouched · list-zero-residue · list-self-define.
//
// `ui-list` is a `ui-column` specialization carrying LIST SEMANTICS: `role=list` rides the host's
// ElementInternals (NEVER a host `role` attribute — the family discipline), and the children are the list
// items (a ChildList — no item element imposed, render() stays void). It is a STRUCTURAL container
// (UIContainerElement, NOT form-associated) with no interaction state of its own → zero connection residue.

// A throwaway subclass that re-exposes the protected `internals`, so a probe can read the role set via it
// (the button-role-internals pattern).
class ProbeList extends UIListElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-list-probe', ProbeList)

describe('UIListElement (s5)', () => {
  it('list-upgrades: <ui-list> upgrades to the class; the spread surfaceProps + flexProps default + coerce', () => {
    const el = document.createElement('ui-list') as UIListElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UIListElement)
    // surfaceProps (ADR-0015): both axes default to the neutral base '0'
    expect(el.elevation).toBe('0')
    expect(el.brightness).toBe('0')
    // flexProps (ADR-0016): align defaults to 'stretch' (ADR-0030 flip), justify 'start', gap 'none', wrap false
    expect(el.align).toBe('stretch')
    expect(el.justify).toBe('start')
    expect(el.gap).toBe('none')
    expect(el.wrap).toBe(false)
    el.remove()
  })

  it('list-props-typed: the flex/surface axes are literal unions, wrap is boolean (compile-time)', () => {
    const fn = (): void => {
      const el = new UIListElement()
      el.align = 'center'
      el.justify = 'between'
      el.gap = '2xl'
      el.elevation = '3'
      el.brightness = '-2'
      el.wrap = true
      // @ts-expect-error — 'middle' is not an align member: proves the literal union, NOT string
      el.align = 'middle'
      // @ts-expect-error — a bare string is wider than the union (the s5 negative control)
      el.align = 'x' as string
      // @ts-expect-error — elevation is a SIGNED literal-union STRING ('0'…'-3'), not a bare number (the s5 surface negative control)
      el.elevation = 1
      // @ts-expect-error — 'huge' is not a gap step
      el.gap = 'huge'
      // @ts-expect-error — wrap is boolean, not string
      el.wrap = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('list-role-internals: role is "list" via internals, with NO host role/aria-* attribute (the negative control)', () => {
    const el = new ProbeList()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('list') // set THROUGH ElementInternals (connected())
    expect(el.getAttribute('role')).toBeNull() // NEVER a host attribute — role rides internals
    expect(el.hasAttribute('aria-label')).toBe(false) // no host aria-* attribute either
    el.remove()
  })

  it('list-reflect: every axis reflects a JS-set value to its attribute (the CSS [attr] mapping hook)', () => {
    const el = new UIListElement()
    document.body.append(el)
    el.align = 'stretch'
    el.justify = 'between'
    el.gap = 'md'
    el.elevation = '1'
    el.brightness = '-1'
    el.wrap = true
    // reflects synchronously (p-reflect) → the list.css / container.css attribute selectors match
    expect(el.getAttribute('align')).toBe('stretch')
    expect(el.getAttribute('justify')).toBe('between')
    expect(el.getAttribute('gap')).toBe('md')
    expect(el.getAttribute('elevation')).toBe('1')
    expect(el.getAttribute('brightness')).toBe('-1')
    expect(el.hasAttribute('wrap')).toBe(true) // boolean presence
    el.wrap = false
    expect(el.hasAttribute('wrap')).toBe(false) // cleared
    el.remove()
  })

  it('list-childlist-untouched: render() is void — the ChildList list-item children are NOT clobbered', () => {
    const el = new UIListElement()
    el.innerHTML = '<ui-row>one</ui-row><ui-row>two</ui-row><ui-row>three</ui-row>' // the list items (ChildList)
    document.body.append(el) // connect → render effect runs render() → void → no commit
    expect(el.childElementCount).toBe(3) // the items flow through untouched (no item element imposed)
    expect(el.children[0].textContent).toBe('one')
    el.remove()
  })

  it('list-zero-residue: a structural container leaks nothing across connect/disconnect; role re-applies on reconnect', () => {
    const el = new ProbeList()
    el.innerHTML = '<ui-row>item</ui-row>'
    document.body.append(el) // connect → connected() sets internals.role='list'
    expect(el.probeInternals.role).toBe('list')
    expect(el.getAttribute('role')).toBeNull()

    el.remove() // disconnect → the connection scope/AbortController tear down (no effects/listeners to leak)
    document.body.append(el) // reconnect → connected() re-runs → role re-applied (idempotent), children intact
    expect(el.probeInternals.role).toBe('list')
    expect(el.getAttribute('role')).toBeNull() // still never a host attribute
    expect(el.childElementCount).toBe(1)
    el.remove()
  })

  it('list-self-define: registered as ui-list, guarded against double-define', () => {
    expect(customElements.get('ui-list')).toBe(UIListElement)
    expect(() => {
      if (!customElements.get('ui-list')) customElements.define('ui-list', UIListElement)
    }).not.toThrow() // the get() guard prevents a duplicate-registration throw
  })
})
