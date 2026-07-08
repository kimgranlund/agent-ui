import { describe, it, expect } from 'vitest'
import { UIColumnElement } from './column.ts'
import { UIContainerElement } from '../../dom/container.ts'

// s4 — UIColumnElement (behaviour + props + self-define; the rendered flex mapping is the browser smoke). Named
// probes: column-upgrades · column-props-typed · column-no-aria · column-reflect · column-host-as-flex ·
// column-self-define · column-zero-residue. jsdom can NOT compute layout, so the flex mapping is asserted only
// at the reflection seam here (the [attr] hook the CSS keys off); the computed align-items/flex-direction change
// and the container-query reflow are column.browser.test.ts.

// A throwaway subclass that re-exposes the protected `internals`, so a probe can prove the role rides NOTHING
// (a layout primitive sets neither a host role attribute nor internals.role — like a <div>).
class ProbeColumn extends UIColumnElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-column-probe', ProbeColumn)

describe('UIColumnElement (s4)', () => {
  it('column-upgrades: <ui-column> upgrades to the class; flex/surface props default + coerce', () => {
    const el = document.createElement('ui-column') as UIColumnElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UIColumnElement)
    expect(el).toBeInstanceOf(UIContainerElement) // the surface base
    // surfaceProps defaults (the neutral base) + flexProps defaults (the A2UI grammar defaults)
    expect([el.elevation, el.brightness]).toEqual(['0', '0'])
    // ADR-0030: align default changed from 'start' to 'stretch' (cross-axis direction-appropriate override)
    // stretch (the column-local sizing opt-in) defaults OFF — a column shrink-wraps to content until asked to fill
    expect([el.align, el.justify, el.gap, el.wrap, el.stretch]).toEqual(['stretch', 'start', 'none', false, false])
    // ADR-0096: reflow defaults to 'locked' (the deliberate default flip) — the wide→row switch is now opt-in
    expect(el.reflow).toBe('locked')
    el.remove()
  })

  it('column-props-typed: the flex/surface props are literal unions / boolean (compile-time)', () => {
    const fn = (): void => {
      const el = new UIColumnElement()
      el.align = 'end'
      el.justify = 'between'
      el.gap = '2xl'
      el.elevation = '2'
      el.wrap = true
      el.stretch = true // the column-local boolean sizing opt-in
      el.reflow = 'auto' // the ADR-0096 reflow gate
      // @ts-expect-error — stretch is boolean, not string
      el.stretch = 'yes'
      // @ts-expect-error — reflow is the 2-member enum 'locked'|'auto', not an arbitrary string
      el.reflow = 'sometimes'
      // @ts-expect-error — 'center' is NOT allowed on ui-column (Kim's directive narrowed the enum — center removed)
      el.align = 'center'
      // @ts-expect-error — 'middle' is not an align member: proves the literal union, NOT string
      el.align = 'middle'
      // @ts-expect-error — a bare string is wider than the union
      el.justify = 'x' as string
      // @ts-expect-error — elevation is the typed-string union '-3'…'3', NOT a bare number
      el.elevation = 2
      // @ts-expect-error — wrap is boolean, not string
      el.wrap = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('column-no-aria: a layout primitive sets NO role — not a host attr, not internals.role', () => {
    const el = new ProbeColumn()
    document.body.append(el)
    expect(el.probeInternals.role).toBeNull() // never set internals.role — it is presentational, like a <div>
    expect(el.getAttribute('role')).toBeNull() // and never a host role attribute
    expect(el.hasAttribute('aria-label')).toBe(false)
    el.remove()
  })

  it('column-reflect: align/justify/gap reflect their value; wrap reflects boolean presence (the CSS hooks)', () => {
    const el = new UIColumnElement()
    document.body.append(el)
    el.align = 'end'
    el.justify = 'between'
    el.gap = 'md'
    el.elevation = '2'
    expect(el.getAttribute('align')).toBe('end') // reflects synchronously → CSS [align=end] matches
    expect(el.getAttribute('justify')).toBe('between')
    expect(el.getAttribute('gap')).toBe('md')
    expect(el.getAttribute('elevation')).toBe('2')

    el.wrap = true
    expect(el.hasAttribute('wrap')).toBe(true) // boolean presence → CSS [wrap] matches
    el.wrap = false
    expect(el.hasAttribute('wrap')).toBe(false) // boolean-false removes the attribute
    el.remove()
  })

  it('column-stretch-reflect: stretch reflects boolean presence (the CSS [stretch] sizing hook)', () => {
    const el = new UIColumnElement()
    document.body.append(el)
    expect(el.stretch).toBe(false) // default off
    expect(el.hasAttribute('stretch')).toBe(false)
    el.stretch = true
    expect(el.hasAttribute('stretch')).toBe(true) // boolean presence → CSS :scope[stretch] matches (width: stretch)
    el.stretch = false
    expect(el.hasAttribute('stretch')).toBe(false) // boolean-false removes the attribute
    // and the attribute drives the prop (jsdom can't compute the width; the fill is column.browser.test.ts)
    el.setAttribute('stretch', '')
    expect(el.stretch).toBe(true)
    el.remove()
  })

  it('column-reflow-reflect: reflow is a reflected 2-member enum (locked default + snap target), settable to auto', () => {
    const el = new UIColumnElement()
    document.body.append(el)
    expect(el.reflow).toBe('locked') // ADR-0096 default flip
    expect(el.hasAttribute('reflow')).toBe(false) // default is NOT reflected (ADR-0005)
    el.reflow = 'auto'
    expect(el.getAttribute('reflow')).toBe('auto') // reflects — drives the CSS [reflow='auto'] repoint
    el.setAttribute('reflow', 'bogus') // out of range → snaps to values[0] = 'locked'
    expect(el.reflow).toBe('locked')
    el.remove()
  })

  it('column-snap: an out-of-range surface attribute snaps to the neutral base (enum, not number)', () => {
    const el = new UIColumnElement()
    document.body.append(el)
    el.setAttribute('elevation', '3')
    expect(el.elevation).toBe('3')
    el.setAttribute('elevation', '9') // out of range → enumType.from falls to values[0] = '0'
    expect(el.elevation).toBe('0')
    el.remove()
  })

  it('column-no-center: align="center" is REJECTED — the narrowed enum snaps it to the stretch base (Kim directive)', () => {
    const el = new UIColumnElement()
    document.body.append(el)
    el.setAttribute('align', 'center') // center is NOT a ui-column align value (removed from the enum)
    expect(el.align).toBe('stretch') // enumType.from('center') ∉ values → snaps to values[0] = 'stretch'
    el.setAttribute('align', 'end') // a valid value still coerces normally
    expect(el.align).toBe('end')
    el.remove()
  })

  it('column-host-as-flex: render() is void — the user’s light-DOM children are NOT clobbered', () => {
    const el = new UIColumnElement()
    el.innerHTML = '<span class="a">one</span><span class="b">two</span>' // user content laid out by the flex column
    document.body.append(el) // connect → render effect runs the inherited VOID render() → no commit
    expect(el.querySelector('span.a')?.textContent).toBe('one')
    expect(el.querySelector('span.b')?.textContent).toBe('two')
    expect(el.childElementCount).toBe(2) // untouched
    el.remove()
  })

  it('column-self-define: registered as ui-column, guarded against double-define', () => {
    expect(customElements.get('ui-column')).toBe(UIColumnElement)
    expect(() => {
      if (!customElements.get('ui-column')) customElements.define('ui-column', UIColumnElement)
    }).not.toThrow() // the get() guard prevents a duplicate-registration throw
  })

  it('column-zero-residue: connect→disconnect→reconnect leaves the children intact and throws nothing', () => {
    // A layout primitive installs no connected() effects/listeners (the base s2 proves the connection scope is
    // zero-residue); this guards that the bare element survives the full cycle without clobbering its children.
    const el = new UIColumnElement()
    el.innerHTML = '<span>keep</span>'
    expect(() => {
      document.body.append(el)
      el.remove()
      document.body.append(el)
    }).not.toThrow()
    expect(el.querySelector('span')?.textContent).toBe('keep')
    el.remove()
  })
})
