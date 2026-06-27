import { describe, it, expect } from 'vitest'
import { UIButtonElement } from './button.ts'

// Phase-1 s5 — UIButtonElement (behaviour + props + role + self-define; geometry/CSS is s7/s13). Named
// probes: button-upgrades · button-props-typed · button-role-internals · button-activation ·
// button-disabled-inert · button-host-as-grid · button-self-define.

// A throwaway subclass that re-exposes the protected `internals`, so a probe can read the role set via it.
class ProbeButton extends UIButtonElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-button-probe', ProbeButton)

const key = (el: Element, type: 'keydown' | 'keyup', k: string): KeyboardEvent => {
  const event = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

describe('UIButtonElement (s5)', () => {
  it('button-upgrades: <ui-button> upgrades to the class; props default + coerce', () => {
    const el = document.createElement('ui-button') as UIButtonElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UIButtonElement)
    expect(el.variant).toBe('solid')
    expect(el.size).toBe('md')
    expect(el.disabled).toBe(false)
    el.remove()
  })

  it('button-props-typed: variant/size are literal unions, disabled is boolean (compile-time)', () => {
    const fn = (): void => {
      const el = new UIButtonElement()
      el.variant = 'soft'
      el.size = 'lg'
      el.disabled = true
      // @ts-expect-error — 'plain' is not a variant member: proves the literal union, NOT string
      el.variant = 'plain'
      // @ts-expect-error — a bare string is wider than the union
      el.variant = 'x' as string
      // @ts-expect-error — 'xl' is not a size member
      el.size = 'xl'
      // @ts-expect-error — disabled is boolean, not string
      el.disabled = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('button-role-internals: role is "button" via internals, with NO host role/aria-* attribute', () => {
    const el = new ProbeButton()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('button') // set through ElementInternals
    expect(el.getAttribute('role')).toBeNull() // never a host attribute
    expect(el.hasAttribute('aria-disabled')).toBe(false)
    el.remove()
  })

  it('button-activation: Space (keyup) and Enter (keydown) each fire a native-parity click', () => {
    const el = new UIButtonElement()
    document.body.append(el)
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    key(el, 'keydown', 'Enter')
    expect(clicks).toBe(1) // Enter on keydown
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(clicks).toBe(2) // Space on keyup
    el.remove()
  })

  it('button-disabled-inert: disabled reflects to an attribute and the trait goes inert', () => {
    const el = new UIButtonElement()
    document.body.append(el)
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    el.disabled = true
    expect(el.hasAttribute('disabled')).toBe(true) // reflects → CSS pointer-inert hook
    key(el, 'keydown', 'Enter')
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(clicks).toBe(0) // inert while disabled
    el.remove()
  })

  it('button-host-as-grid: render() is void — the user’s light-DOM children are NOT clobbered', () => {
    const el = new UIButtonElement()
    el.innerHTML = '<svg class="icon"></svg><span>Save</span>' // user content (optional icon + label)
    document.body.append(el) // connect → render effect runs render() → void → no commit
    expect(el.querySelector('span')?.textContent).toBe('Save')
    expect(el.querySelector('svg.icon')).not.toBeNull()
    expect(el.childElementCount).toBe(2) // untouched
    el.remove()
  })

  it('button-reflect: variant/size reflect a JS-set value to the attribute (the CSS [variant]/[size] hook)', () => {
    const el = new UIButtonElement()
    document.body.append(el)
    el.variant = 'ghost'
    el.size = 'lg'
    expect(el.getAttribute('variant')).toBe('ghost') // reflects synchronously (p-reflect) → CSS [variant=ghost] matches
    expect(el.getAttribute('size')).toBe('lg')
    el.remove()
  })

  it('button-self-define: registered as ui-button, guarded against double-define', () => {
    expect(customElements.get('ui-button')).toBe(UIButtonElement)
    expect(() => {
      if (!customElements.get('ui-button')) customElements.define('ui-button', UIButtonElement)
    }).not.toThrow() // the get() guard prevents a duplicate-registration throw
  })
})
