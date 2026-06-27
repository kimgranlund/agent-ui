import { describe, it, expect } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { pressActivation } from './press-activation.ts'

// Phase-1 s4 — the pressActivation trait. Space activates on keyUP (keydown preventDefaults scroll); Enter
// activates on keydown; disabled() ⇒ inert; listeners ride the host AbortSignal (auto-clean on disconnect);
// release() is early teardown. Named probes: press-space · press-enter · press-disabled-inert ·
// press-auto-cleanup · press-release.

class PressEl extends UIElement {
  isDisabled = false
  releaseFn: (() => void) | null = null
  protected connected(): void {
    this.releaseFn = pressActivation(this, { disabled: () => this.isDisabled })
  }
}
customElements.define('ui-press', PressEl)

const key = (el: Element, type: 'keydown' | 'keyup', k: string): KeyboardEvent => {
  const event = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

describe('pressActivation — Space/Enter → click (s4)', () => {
  it('press-space: keydown preventDefaults (scroll), keyUP activates the click', () => {
    const el = new PressEl()
    document.body.append(el)
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    const kd = key(el, 'keydown', ' ')
    expect(kd.defaultPrevented).toBe(true) // Space keydown stops the page scroll
    expect(clicks).toBe(0) // …and does NOT activate yet

    key(el, 'keyup', ' ')
    expect(clicks).toBe(1) // Space activates on keyup
    el.remove()
  })

  it('press-enter: keydown activates the click', () => {
    const el = new PressEl()
    document.body.append(el)
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    key(el, 'keydown', 'Enter')
    expect(clicks).toBe(1) // Enter activates on keydown
    el.remove()
  })

  it('press-disabled-inert: disabled() true ⇒ no preventDefault and no activation', () => {
    const el = new PressEl()
    el.isDisabled = true
    document.body.append(el)
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    const kd = key(el, 'keydown', ' ')
    expect(kd.defaultPrevented).toBe(false) // disabled → no preventDefault
    key(el, 'keyup', ' ')
    key(el, 'keydown', 'Enter')
    expect(clicks).toBe(0) // disabled → fully inert
    el.remove()
  })

  it('press-auto-cleanup: after disconnect the listeners are gone (ride the abort signal)', () => {
    const el = new PressEl()
    document.body.append(el)
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    el.remove() // disconnect → host AbortController aborts → host.listen listeners removed
    key(el, 'keydown', 'Enter')
    key(el, 'keyup', ' ')
    expect(clicks).toBe(0) // zero live listeners after disconnect
  })

  it('press-release: release() stops activation early while still connected (idempotent)', () => {
    const el = new PressEl()
    document.body.append(el)
    let clicks = 0
    el.addEventListener('click', () => clicks++)

    el.releaseFn?.() // early teardown
    el.releaseFn?.() // idempotent — safe to call twice
    key(el, 'keydown', 'Enter')
    key(el, 'keyup', ' ')
    expect(clicks).toBe(0) // released → inert
    el.remove()
  })
})
