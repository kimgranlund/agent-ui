import { describe, it, expect } from 'vitest'
import { UIButtonElement } from './button.ts'

// Phase-1 s5 — UIButtonElement (behaviour + props + role + self-define; geometry/CSS is s7/s13). Named
// probes: button-upgrades · button-props-typed · button-role-internals · button-activation ·
// button-disabled-inert · button-render-void · button-self-define. The label-wrapper mechanism
// (ADR-0133) gets its own describe block below (button-label-wrapper-*), the ui-text `#heal` precedent.

/** Wait one microtask tick — long enough for a MutationObserver callback queued earlier to run (FIFO). */
const tick = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

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

  it('button-tabbable-default: focusable by default (tabindex=0) — the tabbable trait (ADR-0010)', () => {
    const el = new UIButtonElement()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0') // role=button focus parity; lets the focus ring show
    el.remove()
  })

  it('button-disabled-untabbable: disabled removes the host from the tab order (native parity)', async () => {
    const el = new UIButtonElement()
    document.body.append(el)
    el.disabled = true
    await el.updateComplete // the tabbable effect re-runs are microtask-batched — wait for the flush
    expect(el.hasAttribute('tabindex')).toBe(false) // disabled → not keyboard-focusable, like <button disabled>
    el.remove()
  })

  it('button-aria-disabled: ariaDisabled reflects the disabled prop via internals (announced / omitted)', async () => {
    const el = new ProbeButton()
    document.body.append(el)
    expect(el.probeInternals.ariaDisabled).toBeNull() // enabled → AX state omitted (initial run, synchronous)

    el.disabled = true
    await el.updateComplete
    expect(el.probeInternals.ariaDisabled).toBe('true') // disabled → announced to AT

    el.disabled = false
    await el.updateComplete
    expect(el.probeInternals.ariaDisabled).toBeNull() // re-enabled → omitted again
    expect(el.hasAttribute('aria-disabled')).toBe(false) // never a host attribute — internals only
    el.remove()
  })

  it('button-render-void: render() is void — the user’s light-DOM content is preserved, not clobbered', () => {
    const el = new UIButtonElement()
    el.innerHTML = '<svg slot="leading" data-role="icon"></svg>Download' // realistic anatomy (button.md)
    document.body.append(el) // connect → render effect runs render() → void → no commit
    expect(el.textContent?.trim()).toBe('Download') // the full accessible text survives
    expect(el.querySelector('svg[slot="leading"]')).not.toBeNull() // the adornment survives
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

// TKT-0042 / ADR-0133 — the label wrapper mechanism (jsdom-level logic pins; the ui-text #restamp/#heal
// precedent). Cross-engine rendered ellipsis + byte-identical geometry are the browser suite's job
// (button-label-overflow.browser.test.ts) — jsdom proves the DOM-shape mechanics just as well and faster.
describe('UIButtonElement — the label wrapper (ADR-0133)', () => {
  it('button-label-wrapper: a bare label is adopted into a real <span data-part="label">, moved not cloned; the leading adornment stays a direct, untouched child', () => {
    const el = new UIButtonElement()
    el.innerHTML = '<svg slot="leading" data-role="icon"></svg>Download'
    document.body.append(el)
    const label = el.querySelector('[data-part="label"]')
    expect(label?.tagName).toBe('SPAN')
    expect(label?.textContent).toBe('Download')
    expect(el.childElementCount).toBe(2) // [leading svg, label span] — the two-region anatomy
    expect(el.children[0]?.getAttribute('slot')).toBe('leading') // adornment order preserved, NOT swept into the wrapper
    expect(el.children[1]).toBe(label) // wrapper sits after the leading adornment
    expect(el.textContent?.trim()).toBe('Download') // accessible name unaffected by the wrapper
    el.remove()
  })

  it('button-label-wrapper-whitespace: authored PRETTY-PRINTED markup (whitespace BEFORE the leading adornment) does not invert the anatomy (component-review MEDIUM-1)', () => {
    const el = new UIButtonElement()
    // a multiline template literal — the realistic authoring shape a whitespace-blind anchor breaks: a
    // whitespace-only text node lands as the FIRST child, ahead of the leading adornment.
    el.innerHTML = `
      <svg slot="leading" data-role="icon"></svg>Download
    `
    document.body.append(el)
    const label = el.querySelector('[data-part="label"]')
    expect(el.childElementCount).toBe(2) // [leading svg, label span] — still exactly the two-region anatomy
    expect(el.children[0]?.getAttribute('slot'), 'the leading adornment must stay FIRST — not pushed behind the label').toBe('leading')
    expect(el.children[1]).toBe(label) // the wrapper sits AFTER the leading adornment, not before it
    expect(label?.textContent?.trim()).toBe('Download') // the whitespace strays were swept into the wrapper, harmlessly
    el.remove()
  })

  it('button-label-wrapper-icon-only: no label content ⇒ no wrapper is created (the square anatomy stays untouched)', () => {
    const el = new UIButtonElement()
    el.innerHTML = '<svg slot="leading" data-role="icon"></svg>'
    el.setAttribute('icon-only', '')
    document.body.append(el)
    expect(el.querySelector('[data-part="label"]')).toBeNull()
    expect(el.childElementCount).toBe(1) // just the icon — no empty wrapper pollutes the single-column grid
    el.remove()
  })

  it('button-label-wrapper-stream: a text node appended directly to the host after connect is healed into the wrapper', async () => {
    const el = new UIButtonElement()
    document.body.append(el) // connects with no children yet — the parser-streamed case
    await tick()
    expect(el.querySelector('[data-part="label"]')).toBeNull() // nothing to wrap yet

    el.appendChild(document.createTextNode('Streamed in later')) // lands on the HOST, not the wrapper
    await tick()
    await tick()
    const label = el.querySelector('[data-part="label"]')
    expect(label?.textContent).toBe('Streamed in later')
    expect(el.childElementCount).toBe(1) // exactly one direct child (the wrapper)
    el.remove()
  })

  it('button-label-wrapper-clobber: a raw host.textContent write (the A2UI buttonFactory `label` pattern) destroys the wrapper; heal rebuilds it fresh', async () => {
    const el = new UIButtonElement()
    el.textContent = 'Original'
    document.body.append(el)
    await tick()
    const originalLabel = el.querySelector('[data-part="label"]')
    expect(originalLabel?.textContent).toBe('Original')

    el.textContent = 'Bound label' // buttonFactory: el.textContent = value — replaces ALL children, wrapper included
    await tick()
    await tick()
    const healedLabel = el.querySelector('[data-part="label"]')
    expect(healedLabel).not.toBeNull()
    expect(healedLabel).not.toBe(originalLabel) // a FRESH wrapper — the stale one is never reused
    expect(healedLabel?.textContent).toBe('Bound label')
    expect(el.childElementCount).toBe(1)
    el.remove()
  })
})

// Phase-1 s11 — the button-level zero-residue probe (the connect→disconnect residue check the s5 suite
// above does not cover). button-activation proves the listeners are LIVE while connected; this proves they
// are abort-OWNED: disconnect tears down `pressActivation`'s keydown/keyup (via the connection AbortSignal),
// and a reconnect re-wires exactly one set — no leaked listener stacks across the cycle. (Subscriber-count
// residue is proven at the base in dom/element-hooks.test.ts s2; the button's no-op render() subscribes to
// nothing, so there is no prop-signal subscriber to leak — the keyboard listeners ARE the button's residue.)
// ADR-0133 adds a second residue source, the label-wrapper's MutationObserver — a raw platform observer,
// so its teardown is proven by hand below (the ui-text `text-effects-residue` precedent), not by the
// scope-owned `this.effect`/`this.listen` machinery the other two probes rely on.
describe('UIButtonElement — zero residue across connect/disconnect (s11)', () => {
  it('button-zero-residue: disconnect removes pressActivation listeners; reconnect re-wires exactly one', () => {
    const el = new UIButtonElement()
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    document.body.append(el) // connect → connected() wires pressActivation on the connection AbortSignal
    key(el, 'keydown', 'Enter')
    expect(clicks).toBe(1) // the listener is live while connected

    el.remove() // disconnect → ac.abort() removes the keydown/keyup listeners
    key(el, 'keydown', 'Enter')
    expect(clicks).toBe(1) // no new click — the listener was abort-owned and torn down (zero live listeners)

    document.body.append(el) // reconnect → connected() re-runs on a FRESH AbortController
    key(el, 'keydown', 'Enter')
    expect(clicks).toBe(2) // exactly ONE more — a single re-wired listener, not a leaked old one stacked atop it
    el.remove()
  })

  it('button-effects-residue: the tabbable + ariaDisabled effects die on disconnect, re-install once on reconnect', async () => {
    const el = new ProbeButton()
    document.body.append(el) // connect → connected() installs the scope-owned tabbable + ariaDisabled effects
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false) // tabbable effect live: disabled removed the tabindex
    expect(el.probeInternals.ariaDisabled).toBe('true') // ariaDisabled effect live: announced

    el.remove() // disconnect → the connection scope is disposed → both effects die with it
    el.disabled = false // mutate the disabled signal while disconnected
    await el.updateComplete // give any leaked effect a chance to flush
    expect(el.hasAttribute('tabindex')).toBe(false) // a leaked tabbable effect would re-add tabindex; none does
    expect(el.probeInternals.ariaDisabled).toBe('true') // a leaked ariaDisabled effect would clear it; none does

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh pair of effects installs (sync)
    expect(el.getAttribute('tabindex')).toBe('0') // re-applied from the now-enabled signal — not stacked
    expect(el.probeInternals.ariaDisabled).toBeNull() // re-applied → omitted
    el.remove()
  })

  it('button-label-observer-residue: the label-wrapper MutationObserver dies on disconnect, re-installs once on reconnect', async () => {
    const el = new UIButtonElement()
    document.body.append(el) // connect → connected() installs the heal observer
    await tick()

    el.remove() // disconnect → #observer.disconnect() + nulled
    el.appendChild(document.createTextNode('Set while disconnected')) // a live observer would heal this; a dead one won't
    await tick()
    await tick()
    expect(el.querySelector('[data-part="label"]')).toBeNull() // NOT healed — the observer is torn down

    document.body.append(el) // reconnect → connected() re-runs → the initial #heal() call adopts the loose text node
    await tick()
    expect(el.querySelector('[data-part="label"]')?.textContent).toBe('Set while disconnected')
    expect(el.childElementCount).toBe(1) // exactly one wrapper — no leaked stray/duplicate
    el.remove()
  })
})
