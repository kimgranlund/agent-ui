import { describe, it, expect } from 'vitest'
import { inspect } from '@agent-ui/components'
import { UIRowElement } from './row.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { UIFormElement } from '../../dom/form.ts'

// s3 — UIRowElement, the canonical layout primitive (ADR-0016; decomp g9-containers s3). BEHAVIOUR probes
// (jsdom): the element is `static props` (the surfaceProps + flexProps spread) + a self-define and nothing
// more — so these pin the contract jsdom CAN see: upgrades + defaults · the six props reflect (the CSS
// `[align]`/`[gap]`/… mapping HOOK — the computed flex px is the browser smoke) · the props are typed literal
// unions (a `@ts-expect-error` proves a bare number / arbitrary keyword is rejected) · the host carries NO
// ARIA role/attribute (a pure layout container) · render() stays VOID so host-as-flex never clobbers the
// children · self-defines once · zero residue across connect/disconnect. The flex mapping APPLIED (computed
// align-items/justify-content/gap px) + the container-query reflow are row.browser.test.ts.

// A throwaway subclass re-exposing the protected `internals`, so a probe can assert ui-row sets NO role.
class ProbeRow extends UIRowElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-row-probe', ProbeRow)

describe('UIRowElement — upgrade + defaults (s3)', () => {
  it('row-upgrades: <ui-row> upgrades to the class; the six props default to the neutral base / flex defaults', () => {
    const el = document.createElement('ui-row') as UIRowElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UIRowElement)
    expect(el).toBeInstanceOf(UIContainerElement) // the surface base
    // surfaceProps defaults (ADR-0015 — 0 = the neutral, transparent base) + flexProps defaults (ADR-0016)
    expect([el.elevation, el.brightness]).toEqual(['0', '0'])
    expect([el.align, el.justify, el.gap, el.wrap]).toEqual(['start', 'start', 'none', false])
    el.remove()
  })

  it('row-not-form: ui-row is NOT form-associated (a structural container contributes nothing to a form)', () => {
    const el = new UIRowElement()
    expect(el).not.toBeInstanceOf(UIFormElement)
    expect('formAssociated' in UIRowElement).toBe(false) // the base never opts in; the platform runs no form lifecycle
    expect('validity' in el).toBe(false)
  })

  it('row-props-shape: static props is exactly the surfaceProps + flexProps spread, in order', () => {
    // the canonical layout-primitive shape — no own prop, just the shared grammar (DRY: one grammar, N consumers)
    expect(Object.keys(UIRowElement.props)).toEqual(['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap'])
  })
})

describe('UIRowElement — props reflect (the CSS attribute-selector hook) (s3)', () => {
  it('row-reflect: a JS-set value reflects to the attribute so [align]/[justify]/[gap]/[elevation] match', () => {
    const el = new UIRowElement()
    document.body.append(el)
    el.align = 'center'
    el.justify = 'between'
    el.gap = 'md'
    el.elevation = '2'
    el.brightness = '-1'
    expect(el.getAttribute('align')).toBe('center') // → CSS [align=center] repoints --ui-row-align
    expect(el.getAttribute('justify')).toBe('between')
    expect(el.getAttribute('gap')).toBe('md')
    expect(el.getAttribute('elevation')).toBe('2')
    expect(el.getAttribute('brightness')).toBe('-1')

    el.wrap = true
    expect(el.hasAttribute('wrap')).toBe(true) // boolean presence → [wrap] → flex-wrap: wrap
    el.wrap = false
    expect(el.hasAttribute('wrap')).toBe(false) // boolean-false removes the attribute
    el.remove()
  })

  it('row-default-unset: a fresh row carries NO surface/flex attribute (an unset row adds no plane / no opinion)', () => {
    const el = new UIRowElement()
    for (const a of ['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap']) {
      expect(el.hasAttribute(a), `default ${a} must not reflect`).toBe(false)
    }
  })

  it('row-attr-coerce: an inbound out-of-range surface step snaps to the neutral base (enumType.from → values[0])', () => {
    const el = new UIRowElement()
    document.body.append(el)
    el.setAttribute('elevation', '3')
    expect(el.elevation).toBe('3')
    el.setAttribute('elevation', '9') // out of range → snaps to values[0] = '0'
    expect(el.elevation).toBe('0')
    el.remove()
  })
})

describe('UIRowElement — typed literal unions (compile-time) (s3)', () => {
  it('row-props-typed: surface axes are signed string unions, flex props are keyword unions, wrap is boolean', () => {
    const fn = (): void => {
      const el = new UIRowElement()
      el.elevation = '2'
      el.align = 'center'
      el.justify = 'between'
      el.gap = '2xl'
      el.wrap = true
      // @ts-expect-error — elevation is the literal union '-3'…'3' (typed strings), NOT a bare number
      el.elevation = 2
      // @ts-expect-error — align is a fixed keyword union; an arbitrary string is rejected
      el.align = 'middle'
      // @ts-expect-error — justify member must be in the union
      el.justify = 'space-between'
      // @ts-expect-error — gap is a fixed step union
      el.gap = 'huge'
      // @ts-expect-error — wrap is boolean, not string
      el.wrap = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })
})

describe('UIRowElement — pure layout container: no ARIA, host-as-flex (s3)', () => {
  it('row-no-role: the row exposes NO role — internals.role is null and there is no host role/aria-* attribute', () => {
    const el = new ProbeRow()
    document.body.append(el)
    expect(el.probeInternals.role).toBeNull() // a generic layout wrapper sets no role (contrast ui-list → 'list')
    expect(el.getAttribute('role')).toBeNull() // never a host role attribute
    expect([...el.attributes].some((a) => a.name.startsWith('aria-'))).toBe(false) // no host aria-* attribute
    el.remove()
  })

  it('row-host-as-flex: render() is void — the user’s light-DOM children (the flex items) are NOT clobbered', () => {
    const el = new UIRowElement()
    el.innerHTML = '<span>a</span><span>b</span><span>c</span>' // the flex items
    document.body.append(el) // connect → render effect runs render() → void → no commit
    expect(el.childElementCount).toBe(3)
    expect([...el.children].map((c) => c.textContent)).toEqual(['a', 'b', 'c']) // untouched
    el.remove()
  })

  it('row-self-define: registered as ui-row, guarded against double-define', () => {
    expect(customElements.get('ui-row')).toBe(UIRowElement)
    expect(() => {
      if (!customElements.get('ui-row')) customElements.define('ui-row', UIRowElement)
    }).not.toThrow() // the get() guard prevents a duplicate-registration throw
  })
})

describe('UIRowElement — zero residue across connect/disconnect (s3)', () => {
  it('row-zero-residue: connect→disconnect→reconnect leaves the children intact and no leaked state', () => {
    // ui-row installs no traits/effects/listeners (it is `static props` + self-define), so the meaningful
    // residue claim is structural: the host survives the lifecycle cleanly and a reflected prop still tracks.
    const el = new ProbeRow()
    el.innerHTML = '<span>x</span>'
    document.body.append(el)
    expect(el.childElementCount).toBe(1)
    expect(inspect).toBeTypeOf('function') // (kernel handle available — the base's connection scope is the residue owner)

    el.remove() // disconnect → the base connection scope disposes (no effects to leak here)
    el.gap = 'lg' // mutate while disconnected
    document.body.append(el) // reconnect → upgrades cleanly, the reflected value still drives the attribute
    expect(el.getAttribute('gap')).toBe('lg')
    expect(el.childElementCount).toBe(1) // children preserved across the cycle
    el.remove()
  })
})
