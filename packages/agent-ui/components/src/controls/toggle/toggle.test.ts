import { describe, it, expect } from 'vitest'
import { UIToggleElement } from './toggle.ts'

// S7-a jsdom probes — ui-toggle (ADR-0179 GH #686 Amendment, admin-three-pane-ia.lld.md §16.4).
//
// jsdom reality: CustomStateSet is absent (the same jsdom blind spot every :state()-bearing control hits) —
// `internals.states` is optional-chained in toggle.ts, so the pressed/ready state writes are no-ops here;
// `[pressed]`'s own attribute reflection (asserted below) is what the jsdom-visible half of the dual-write
// covers, matching the fleet's own indicator/segmented-control precedent. `ui-toggle` is NOT form-associated
// (extends UIElement, not UIFormElement) — no setFormValue/setValidity stub is needed (contrast checkbox.test.ts).

// ── probe subclass — re-exposes the protected internals ─────────────────────────────────────────

class ProbeToggle extends UIToggleElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-toggle-probe', ProbeToggle)

function make(): ProbeToggle {
  return new ProbeToggle()
}

const key = (el: Element, type: 'keydown' | 'keyup', k: string): KeyboardEvent => {
  const event = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

// ── upgrade + typed prop surface ──────────────────────────────────────────────────────────────────

describe('UIToggleElement — upgrade + typed props', () => {
  it('upgrades to the class; props default to pressed=false, disabled=false, size=md', () => {
    const el = document.createElement('ui-toggle') as UIToggleElement
    expect(el).toBeInstanceOf(UIToggleElement)
    expect(el.pressed).toBe(false)
    expect(el.disabled).toBe(false)
    expect(el.size).toBe('md')
  })

  it('size is a literal union — compile-time narrowing (negative control)', () => {
    const fn = (): void => {
      const el = new UIToggleElement()
      el.size = 'sm'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member
      el.size = 'xl'
      // @ts-expect-error — a bare string is wider than the union
      el.size = 'x' as string
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors are the assertion
  })

  it('self-defines as ui-toggle, guarded against double-define', () => {
    expect(customElements.get('ui-toggle')).toBe(UIToggleElement)
    expect(() => {
      if (!customElements.get('ui-toggle')) customElements.define('ui-toggle', UIToggleElement)
    }).not.toThrow()
  })
})

// ── ARIA role + aria-pressed (FACE — internals only) ─────────────────────────────────────────────

describe('UIToggleElement — ARIA (role=button + aria-pressed via internals)', () => {
  it('internals.role is "button"; no host role/aria-* attribute', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('button')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('ariaPressed is "false" on connect (unpressed; the state effect runs synchronously)', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.ariaPressed).toBe('false')
    el.remove()
  })

  it('ariaPressed flips to "true"/"false" with the pressed prop', async () => {
    const el = make()
    document.body.append(el)
    el.pressed = true
    await el.updateComplete
    expect(el.probeInternals.ariaPressed).toBe('true')
    el.pressed = false
    await el.updateComplete
    expect(el.probeInternals.ariaPressed).toBe('false')
    el.remove()
  })
})

// ── pressed round-trip + [pressed] reflection ────────────────────────────────────────────────────

describe('UIToggleElement — pressed round-trip', () => {
  it('pressed round-trips: false → true → false', () => {
    const el = make()
    document.body.append(el)
    expect(el.pressed).toBe(false)
    el.pressed = true
    expect(el.pressed).toBe(true)
    el.pressed = false
    expect(el.pressed).toBe(false)
    el.remove()
  })

  it('pressed reflects to/from the attribute (boolean presence)', () => {
    const el = make()
    document.body.append(el)
    el.pressed = true
    expect(el.getAttribute('pressed')).toBe('')
    el.pressed = false
    expect(el.getAttribute('pressed')).toBeNull()
    el.setAttribute('pressed', '')
    expect(el.pressed).toBe(true)
    el.removeAttribute('pressed')
    expect(el.pressed).toBe(false)
    el.remove()
  })
})

// ── :state(pressed)/:state(ready) (capability-gated) ─────────────────────────────────────────────

describe('UIToggleElement — custom states (capability-gated)', () => {
  it(':state(pressed) present when pressed', async () => {
    const el = make()
    document.body.append(el)
    el.pressed = true
    await el.updateComplete
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('pressed')).toBe(true)
    }
    el.remove()
  })

  it(':state(pressed) absent when unpressed', async () => {
    const el = make()
    document.body.append(el)
    await el.updateComplete
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('pressed')).toBe(false)
    }
    el.remove()
  })
})

// ── press → toggle emission + commit (click, Space, Enter — both keys activate, unlike Indicator) ──

describe('UIToggleElement — press activation (click + Space + Enter — button-parity, not checkbox-parity)', () => {
  it('click toggles pressed false → true → false', () => {
    const el = make()
    document.body.append(el)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(true)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(false)
    el.remove()
  })

  it('Space keyup toggles pressed (keydown does NOT)', () => {
    const el = make()
    document.body.append(el)
    key(el, 'keydown', ' ')
    expect(el.pressed).toBe(false)
    key(el, 'keyup', ' ')
    expect(el.pressed).toBe(true)
    el.remove()
  })

  it('Enter DOES toggle pressed — button-parity, UNLIKE the Indicator class (checkbox/switch/radio suppress Enter)', () => {
    const el = make()
    document.body.append(el)
    key(el, 'keydown', 'Enter')
    expect(el.pressed).toBe(true)
    el.remove()
  })

  it('click emits exactly one "toggle" event', () => {
    const el = make()
    document.body.append(el)
    const seen: string[] = []
    el.addEventListener('toggle', () => seen.push('toggle'))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(seen).toEqual(['toggle'])
    el.remove()
  })

  it('"toggle" fires BEFORE pressed commits — a listener reads the PRE-flip value', () => {
    const el = make()
    document.body.append(el)
    let sawDuringEvent: boolean | undefined
    el.addEventListener('toggle', () => {
      sawDuringEvent = el.pressed // still false — the commit has not happened yet
    })
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(sawDuringEvent).toBe(false) // pre-commit value observed inside the listener
    expect(el.pressed).toBe(true) // post-dispatch, the commit has now happened
    el.remove()
  })
})

// ── refused toggle (the LLD §16.2 min-one-invariant seam) ────────────────────────────────────────

describe('UIToggleElement — refused toggle (preventDefault on "toggle" — the amendment\'s min-one seam)', () => {
  it('event.preventDefault() on "toggle" refuses the press: pressed stays UNCHANGED (no flip-then-revert)', () => {
    const el = make()
    document.body.append(el)
    el.addEventListener('toggle', (e) => e.preventDefault())
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(false) // never flipped — a true no-op
    el.remove()
  })

  it('a refused press on an ALREADY-pressed toggle stays pressed (the exact "last shown pill stays pressed" shape)', () => {
    const el = make()
    el.pressed = true
    document.body.append(el)
    el.addEventListener('toggle', (e) => e.preventDefault())
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(true) // stayed pressed — refused, not flipped-then-reverted
    el.remove()
  })

  it('un-canceled toggle events still commit normally (the refusal is opt-in per listener)', () => {
    const el = make()
    document.body.append(el)
    el.addEventListener('toggle', () => {}) // a listener that does NOT cancel
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(true)
    el.remove()
  })

  it('directly setting `pressed` is NEVER subject to refusal (only a real press goes through "toggle")', () => {
    const el = make()
    document.body.append(el)
    let toggleCount = 0
    el.addEventListener('toggle', () => toggleCount++)
    el.pressed = true // a programmatic write, not a press
    expect(el.pressed).toBe(true)
    expect(toggleCount).toBe(0) // no "toggle" emitted — naming.md §4's commit-semantics law
    el.remove()
  })
})

// ── disabled-inert ────────────────────────────────────────────────────────────────────────────────

describe('UIToggleElement — disabled-inert', () => {
  it('disabled click does not toggle pressed', () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(false)
    el.remove()
  })

  it('disabled Space/Enter does not toggle pressed', () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    key(el, 'keydown', 'Enter')
    expect(el.pressed).toBe(false)
    el.remove()
  })

  it('disabled removes the host from the tab order (async — tabbable effect is reactive)', async () => {
    const el = make()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0')
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false)
    el.remove()
  })

  it('disabled reflects to a [disabled] attribute', () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    expect(el.hasAttribute('disabled')).toBe(true)
    el.disabled = false
    expect(el.hasAttribute('disabled')).toBe(false)
    el.remove()
  })

  it('ariaDisabled mirrors disabled (reactive effect)', async () => {
    const el = make()
    document.body.append(el)
    el.disabled = true
    await el.updateComplete
    expect(el.probeInternals.ariaDisabled).toBe('true')
    el.disabled = false
    await el.updateComplete
    expect(el.probeInternals.ariaDisabled).toBeNull()
    el.remove()
  })
})

// ── size prop ────────────────────────────────────────────────────────────────────────────────────

describe('UIToggleElement — size prop', () => {
  it('size reflects JS-set value to the attribute (the CSS [size] hook)', () => {
    const el = make()
    document.body.append(el)
    el.size = 'sm'
    expect(el.getAttribute('size')).toBe('sm')
    el.size = 'lg'
    expect(el.getAttribute('size')).toBe('lg')
    el.size = 'md'
    expect(el.getAttribute('size')).toBe('md')
    el.remove()
  })
})

// ── zero residue (connect / disconnect) ──────────────────────────────────────────────────────────

describe('UIToggleElement — zero residue across connect/disconnect', () => {
  it('disconnect removes listeners; reconnect re-arms exactly once (not stacked)', () => {
    const el = make()
    document.body.append(el)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(true) // listener live while connected

    el.remove() // disconnect → ac.abort() removes all listeners
    el.pressed = false // reset
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(false) // listener gone — no toggle

    document.body.append(el) // reconnect → connected() re-runs fresh AbortController
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.pressed).toBe(true) // exactly one toggle — not a stacked double
    el.remove()
  })

  it('ARIA effect re-runs on reconnect with the current pressed value', () => {
    const el = make()
    el.pressed = true
    document.body.append(el)
    expect(el.probeInternals.ariaPressed).toBe('true') // initial sync run

    el.remove()
    document.body.append(el) // reconnect → effect reinstalls + runs synchronously
    expect(el.probeInternals.ariaPressed).toBe('true') // re-applied from the live signal value
    el.remove()
  })
})
