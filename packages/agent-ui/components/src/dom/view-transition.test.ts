// view-transition.test.ts — the helper's own gate (GH #740/ADR-0183): the opt-in × availability ×
// reduced-motion truth table, jsdom-side. jsdom ships NO startViewTransition and NO matchMedia — which
// IS the progressive-enhancement fallback environment, so the sync path is the unstubbed default here;
// the transition path is proven by stubbing the platform seam. The REAL-engine split (a genuine
// startViewTransition on Chromium, the feature-detect honesty on WebKit) is the router outlet's own
// browser probe.
import { describe, it, expect, afterEach } from 'vitest'
import { withViewTransition, viewTransitionAvailable } from './view-transition.ts'

// A standalone stub shape (NOT `extends Document`) — lib.dom now declares `startViewTransition` as a
// required method, so a widening interface can't mark it optional; the `as unknown as` cast is what
// lets these tests assign and DELETE the seam the way the runtime environments actually vary.
const doc = document as unknown as { startViewTransition?: (cb: () => void) => unknown }

afterEach(() => {
  delete doc.startViewTransition
  // matchMedia stays whatever the environment ships (jsdom: undefined) — tests stub per-case via globalThis
  delete (globalThis as { matchMedia?: unknown }).matchMedia
})

describe('withViewTransition — the opt-in × availability × reduced-motion truth table', () => {
  it('no API (jsdom default): runs mutate SYNCHRONOUSLY even when enabled — progressive enhancement', () => {
    let ran = false
    withViewTransition(() => {
      ran = true
    }, true)
    expect(ran).toBe(true) // synchronous — asserted before any microtask could run
  })

  it('disabled: never touches the API even when present', () => {
    let transitioned = false
    doc.startViewTransition = () => {
      transitioned = true
    }
    let ran = false
    withViewTransition(() => {
      ran = true
    }, false)
    expect(ran).toBe(true)
    expect(transitioned).toBe(false)
  })

  it('enabled + API present: the mutation routes THROUGH startViewTransition', () => {
    const calls: Array<() => void> = []
    doc.startViewTransition = (cb: () => void) => {
      calls.push(cb)
    }
    let ran = false
    withViewTransition(() => {
      ran = true
    }, true)
    expect(calls).toHaveLength(1)
    expect(ran).toBe(false) // NOT yet — the platform owns when the callback runs (the stated caveat)
    calls[0]!()
    expect(ran).toBe(true)
  })

  it('enabled + API present + prefers-reduced-motion: the transition is SKIPPED, mutate runs sync', () => {
    doc.startViewTransition = () => {
      throw new Error('must not be called under reduced motion')
    }
    ;(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({ matches: q.includes('prefers-reduced-motion') })
    let ran = false
    withViewTransition(() => {
      ran = true
    }, true)
    expect(ran).toBe(true)
  })

  it('viewTransitionAvailable mirrors the exact gate (exported so probes assert WHICH path ran)', () => {
    expect(viewTransitionAvailable()).toBe(false) // jsdom: no API
    doc.startViewTransition = () => {}
    expect(viewTransitionAvailable()).toBe(true) // API present, no matchMedia ⇒ not reduced
    ;(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({ matches: q.includes('prefers-reduced-motion') })
    expect(viewTransitionAvailable()).toBe(false) // reduced motion wins
  })
})
