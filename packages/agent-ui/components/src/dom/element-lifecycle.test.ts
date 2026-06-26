import { describe, it, expect } from 'vitest'
import { signal, inspect, type Signal } from '@agent-ui/components'
import { UIElement } from './element.ts'

// D4 — lifecycle & zero residue (rubric element.md D4, scope/subscriber half; goals.md G2 DoD box 3).
// Proven against a throwaway UIElement subclass whose render() READS a signal, so connect subscribes the
// one render effect and disconnect must leave zero residue. The this.listen → 0-live-listeners
// demonstration lands with e-helpers (slice 2); here we prove the scope/subscriber zero-residue, the
// reconnect cycle (K2, deferred from G1), and that the AbortController is wired (created on connect,
// aborted on disconnect). Named probes: connect-disconnect-zero · abort-on-disconnect ·
// reconnect-zero-residue.

class ProbeEl extends UIElement {
  readonly sig: Signal<number> = signal(0)
  renders = 0
  protected render(): void {
    this.renders++
    void this.sig.value // the render effect tracks `sig` → a subscriber appears on connect
  }
  // Re-expose the protected connection seam so a probe can observe the AbortSignal directly.
  get observedSignal(): AbortSignal | null {
    return this.connectionSignal
  }
}
customElements.define('ui-probe-lifecycle', ProbeEl)

describe('e-lifecycle — UIElement connection scope + abort (D4)', () => {
  it('connect-disconnect-zero: a signal read in render() subscribes on connect, 1→0 on disconnect', () => {
    const el = new ProbeEl()
    expect(el.renders).toBe(0) // no render before connect
    expect(inspect(el.sig).subscribers).toBe(0)

    document.body.append(el) // connectedCallback → scope + render effect
    expect(el.renders).toBe(1) // the ONE render effect ran once, synchronously
    expect(inspect(el.sig).subscribers).toBe(1) // and subscribed to the signal it read

    el.remove() // disconnectedCallback → scope.dispose()
    expect(inspect(el.sig).subscribers).toBe(0) // the render effect was disposed — zero residue
  })

  it('abort-on-disconnect: the connection AbortSignal is live on connect, aborted on disconnect, then nulled', () => {
    const el = new ProbeEl()
    expect(el.observedSignal).toBeNull() // none before connect

    document.body.append(el)
    const captured = el.observedSignal // hold the live signal while connected (it outlives the nulling)
    expect(captured).not.toBeNull()
    expect(captured?.aborted).toBe(false)

    el.remove()
    expect(captured?.aborted).toBe(true) // ac.abort() flipped it → every listener riding it dies
    expect(el.observedSignal).toBeNull() // and #ac was nulled
  })

  it('reconnect-zero-residue: connect→disconnect→reconnect re-subscribes clean (the K2 cycle)', () => {
    const el = new ProbeEl()

    document.body.append(el)
    expect(inspect(el.sig).subscribers).toBe(1)
    const firstSignal = el.observedSignal

    el.remove()
    expect(inspect(el.sig).subscribers).toBe(0)
    expect(firstSignal?.aborted).toBe(true)

    document.body.append(el) // reconnect — a FRESH scope + AbortController, a fresh render effect
    expect(el.renders).toBe(2) // render ran again
    expect(inspect(el.sig).subscribers).toBe(1) // exactly one subscriber — no stale residue, no double-subscribe
    const secondSignal = el.observedSignal
    expect(secondSignal).not.toBe(firstSignal) // a new AbortController per connect
    expect(secondSignal?.aborted).toBe(false)

    el.remove()
    expect(inspect(el.sig).subscribers).toBe(0) // clean teardown again
    expect(secondSignal?.aborted).toBe(true)
  })
})
