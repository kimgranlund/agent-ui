import { describe, it, expect } from 'vitest'
import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../dom/index.ts'
import { tabbable } from './tabbable.ts'

// Phase-1 — the tabbable trait (ADR-0010). tabIndex=0 while enabled; removeAttribute('tabindex') while
// disabled (native `<button disabled>` parity); the rule rides a scope-owned `host.effect` so it REACTS to
// the disabled signal, dies with the connection scope, and re-installs on reconnect; release() is idempotent
// early teardown. Named probes: tab-default · tab-disabled-removes · tab-reactive · tab-leak-free · tab-release.
//
// The host carries `disabled` as a real signal-backed prop (not a plain field) — the trait's reactivity is
// the point, so the effect must re-run when the signal toggles.

const props = {
  disabled: prop.boolean(false),
} satisfies PropsSchema

interface TabEl extends ReactiveProps<typeof props> {}
class TabEl extends UIElement {
  static props = props
  releaseFn: (() => void) | null = null
  protected connected(): void {
    this.releaseFn = tabbable(this, { disabled: () => this.disabled })
  }
}
customElements.define('ui-tab', TabEl)

describe('tabbable — focusability + disabled tab-order (ADR-0010)', () => {
  it('tab-default: enabled host is keyboard-focusable (tabindex=0) by default', () => {
    const el = new TabEl()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0') // role=button focus parity
    expect(el.tabIndex).toBe(0)
    el.remove()
  })

  it('tab-disabled-removes: a disabled host leaves the tab order (no tabindex attribute)', () => {
    const el = new TabEl()
    el.disabled = true
    document.body.append(el)
    expect(el.hasAttribute('tabindex')).toBe(false) // native <button disabled> parity — out of the tab order
    el.remove()
  })

  it('tab-reactive: toggling the disabled signal re-applies the rule (effect reacts)', async () => {
    const el = new TabEl()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0') // enabled at connect (initial effect run is synchronous)

    el.disabled = true
    await el.updateComplete // effect re-runs are microtask-batched — wait for the flush
    expect(el.hasAttribute('tabindex')).toBe(false) // disabled → removed reactively

    el.disabled = false
    await el.updateComplete
    expect(el.getAttribute('tabindex')).toBe('0') // re-enabled → focusable again
    el.remove()
  })

  it('tab-leak-free: the effect dies on disconnect and re-installs on reconnect (no leak)', async () => {
    const el = new TabEl()
    document.body.append(el)
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false) // effect live: disabled removed the attribute

    el.remove() // disconnect → connection scope disposed → the effect dies
    el.disabled = false // mutate the signal while disconnected
    await el.updateComplete // give any leaked effect a chance to flush
    expect(el.hasAttribute('tabindex')).toBe(false) // a leaked effect would re-add tabindex; none does → leak-free

    document.body.append(el) // reconnect → connected() re-runs → a FRESH effect installs (synchronous first run)
    expect(el.getAttribute('tabindex')).toBe('0') // re-applied from the current (enabled) signal value
    el.remove()
  })

  it('tab-release: release() detaches the effect early and is idempotent', () => {
    const el = new TabEl()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0')

    el.releaseFn?.() // early teardown
    el.releaseFn?.() // idempotent — safe to call twice (no throw)

    el.disabled = true
    expect(el.getAttribute('tabindex')).toBe('0') // released → the effect no longer reacts
    el.remove()
  })
})
