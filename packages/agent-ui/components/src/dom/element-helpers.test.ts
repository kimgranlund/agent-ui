import { describe, it, expect } from 'vitest'
import { signal, inspect } from '@agent-ui/components'
import { UIElement } from './element.ts'

// e-helpers (rubric element.md — completes D4's listener half, contributes D7's typed emit). The public
// host surface composed on the e-lifecycle base: this.effect (scope-owned), this.listen (rides the
// connection AbortSignal → auto-removed on disconnect), this.emit (typed CustomEvent), updateComplete.
// Named probes: this-effect-scope-owned · listen-zero-live · emit-typed (runtime + compile) · update-complete.

// Registers an extra connection-scoped effect at connect, so its scope-ownership can be inspected.
class EffectEl extends UIElement {
  readonly extra = signal(0)
  extraRuns = 0
  connectedCallback(): void {
    super.connectedCallback()
    this.effect(() => {
      this.extraRuns++
      void this.extra.value // tracks `extra` → a subscriber appears while connected
    })
  }
}
customElements.define('ui-helper-effect', EffectEl)

// render() reads a signal so a prop-style write wakes the render effect (for updateComplete).
class RenderEl extends UIElement {
  readonly sig = signal(0)
  renders = 0
  protected render(): void {
    this.renders++
    void this.sig.value
  }
}
customElements.define('ui-helper-render', RenderEl)

interface ChangeDetail {
  value: number
}

// A plain host for emit/listen (no reactive state needed).
class PlainEl extends UIElement {}
customElements.define('ui-helper-plain', PlainEl)

describe('e-helpers — UIElement public surface (D4 listener-half, D7 emit)', () => {
  it('this-effect-scope-owned: a this.effect reading a signal subscribes on connect, 0 after disconnect', () => {
    const el = new EffectEl()
    expect(inspect(el.extra).subscribers).toBe(0)

    document.body.append(el)
    expect(el.extraRuns).toBe(1) // ran once on registration
    expect(inspect(el.extra).subscribers).toBe(1) // subscribed

    el.remove()
    expect(inspect(el.extra).subscribers).toBe(0) // the scope owns the this.effect → disposed with it
  })

  it('listen-zero-live: a this.listen handler fires while connected, then is removed on disconnect', () => {
    const el = new PlainEl()
    document.body.append(el)
    const target = new EventTarget()
    let hits = 0
    el.listen(target, 'ping', () => {
      hits++
    })

    target.dispatchEvent(new Event('ping'))
    expect(hits).toBe(1) // live while connected

    el.remove() // disconnect → ac.abort() removes the listener
    target.dispatchEvent(new Event('ping'))
    expect(hits).toBe(1) // NOT 2 — zero live listeners after disconnect
  })

  it('listen throws if called outside the connected lifetime', () => {
    const el = new PlainEl() // never connected → no #ac
    expect(() => el.listen(new EventTarget(), 'ping', () => {})).toThrow()
  })

  it('emit-typed: this.emit dispatches a composed/bubbling/cancelable CustomEvent carrying the detail', () => {
    const el = new PlainEl()
    document.body.append(el)
    let received: ChangeDetail | undefined
    let captured: CustomEvent | undefined
    el.addEventListener('change', (e) => {
      captured = e as CustomEvent
      received = (e as CustomEvent<ChangeDetail>).detail
    })

    const notPrevented = el.emit<ChangeDetail>('change', { value: 7 })

    expect(received).toEqual({ value: 7 })
    expect(captured?.bubbles).toBe(true)
    expect(captured?.composed).toBe(true)
    expect(captured?.cancelable).toBe(true)
    expect(notPrevented).toBe(true) // no listener called preventDefault
  })

  it('emit returns false when a listener cancels (cancelable wiring)', () => {
    const el = new PlainEl()
    document.body.append(el)
    el.addEventListener('change', (e) => e.preventDefault())
    expect(el.emit<ChangeDetail>('change', { value: 1 })).toBe(false)
  })

  it('emit-typed compile-time: the detail is checked against the pinned D (load-bearing @ts-expect-error)', () => {
    const fn = () => {
      const el = new PlainEl()
      el.emit<ChangeDetail>('change', { value: 1 }) // the correct detail compiles
      // @ts-expect-error — detail must match the pinned D ({ value: number }); a string is rejected.
      // If emit's detail param were untyped, this directive would suppress nothing → tsc fails on an
      // unused @ts-expect-error. That is the compile-time assertion.
      el.emit<ChangeDetail>('change', 'not-a-detail')
    }
    expect(typeof fn).toBe('function') // never invoked; the type error above is the assertion
  })

  it('update-complete: resolves after a write wakes the render effect (the render re-ran)', async () => {
    const el = new RenderEl()
    document.body.append(el)
    expect(el.renders).toBe(1)

    el.sig.value = 1 // schedules the render effect (microtask-batched)
    await el.updateComplete // = whenFlushed() — resolves once the batch settles
    expect(el.renders).toBe(2)
  })
})
