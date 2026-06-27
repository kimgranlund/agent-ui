import { describe, it, expect } from 'vitest'
import { signal, inspect, type Signal } from '@agent-ui/components'
import { UIElement } from './element.ts'

// Phase-1 s2 — the connected()/disconnected() user-override hooks. A control overrides connected()
// (NOT connectedCallback + super) to register this.effect/this.listen with the scope live, and they are
// zero-residue on disconnect. disconnected() runs BEFORE teardown. Named probe: connected-hook.

class HookEl extends UIElement {
  readonly sig: Signal<number> = signal(0)
  readonly target = new EventTarget()
  connectedRan = 0
  disconnectedRan = 0
  effectRuns = 0
  listenerHits = 0
  subsWhenDisconnected = -1 // captured INSIDE disconnected(), to prove it runs before teardown

  protected connected(): void {
    this.connectedRan++
    this.effect(() => {
      this.effectRuns++
      void this.sig.value // a scope-owned effect, registered from connected()
    })
    this.listen(this.target, 'ping', () => {
      this.listenerHits++ // an abort-owned listener, registered from connected()
    })
  }

  protected disconnected(): void {
    this.disconnectedRan++
    this.subsWhenDisconnected = inspect(this.sig).subscribers // still 1 if we run BEFORE scope.dispose()
  }
}
customElements.define('ui-hook', HookEl)

describe('s2 lifecycle hooks — connected()/disconnected() (zero residue)', () => {
  it('connected-hook: connected() runs with the scope live; its effect + listener register', () => {
    const el = new HookEl()
    expect(el.connectedRan).toBe(0)

    document.body.append(el)
    expect(el.connectedRan).toBe(1) // ran on connect, without overriding connectedCallback
    expect(el.effectRuns).toBe(1) // the connected()-registered effect ran (scope was live)
    expect(inspect(el.sig).subscribers).toBe(1) // and subscribed

    el.target.dispatchEvent(new Event('ping'))
    expect(el.listenerHits).toBe(1) // the connected()-registered listener fires while connected

    el.remove()
  })

  it('connected-hook: a connected()-registered effect + listener leave ZERO residue on disconnect', () => {
    const el = new HookEl()
    document.body.append(el)
    expect(inspect(el.sig).subscribers).toBe(1)

    el.remove()

    expect(el.disconnectedRan).toBe(1) // disconnected() ran
    expect(el.subsWhenDisconnected).toBe(1) // …BEFORE teardown — the effect was still live when it ran
    expect(inspect(el.sig).subscribers).toBe(0) // then scope.dispose() → zero subscribers
    el.target.dispatchEvent(new Event('ping'))
    expect(el.listenerHits).toBe(0) // ac.abort() removed the listener → zero live listeners
  })

  it('connected-hook: reconnect re-runs connected() and re-registers clean (zero residue across the cycle)', () => {
    const el = new HookEl()
    document.body.append(el)
    el.remove()
    expect(inspect(el.sig).subscribers).toBe(0)

    document.body.append(el) // reconnect
    expect(el.connectedRan).toBe(2) // connected() ran again
    expect(inspect(el.sig).subscribers).toBe(1) // re-subscribed cleanly — exactly one
    el.target.dispatchEvent(new Event('ping'))
    expect(el.listenerHits).toBe(1) // a fresh listener on the new AbortController
    el.remove()
  })
})
