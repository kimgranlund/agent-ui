import { describe, it, expect } from 'vitest'
import { signal, computed, effect, createScope, untracked, unowned, inspect, CycleError } from './graph.ts'
import type { ReadonlySignal } from './graph.ts'
import { flush } from './scheduler.ts'

describe('reactivity kernel', () => {
  it('basics: signal read/write, computed derive, effect reactivity', () => {
    const a = signal(1)
    const b = signal(2)
    const sum = computed(() => a.value + b.value)
    let seen = 0
    effect(() => { seen = sum.value })
    expect(seen).toBe(3)
    a.value = 10
    flush()
    expect(sum.value).toBe(12)
    expect(seen).toBe(12)
  })

  // ── K1 — equality cutoff & verified recompute ────────────────────────────
  it('cutoff-no-wake: an Object.is-equal write bumps no version and wakes nothing', () => {
    let runs = 0
    const s = signal(1)
    effect(() => { runs++; s.value })
    expect(runs).toBe(1)
    s.value = 1 // equal → no bump, no schedule
    flush()
    expect(runs).toBe(1)
    expect(inspect(s).version).toBe(0)
  })

  it('verify-skip-computed: a downstream computed skips when its source value is unchanged', () => {
    let c3runs = 0
    const a = signal(2)
    const positive = computed(() => a.value > 0)
    const c = computed(() => { c3runs++; return positive.value })
    expect(c.value).toBe(true)
    expect(c3runs).toBe(1)
    a.value = 3 // positive stays true
    expect(c.value).toBe(true)
    expect(c3runs).toBe(1) // verified unchanged → not recomputed
  })

  it('verify-skip-effect: an effect skips its body when its source value is unchanged', () => {
    let runs = 0
    const a = signal(2)
    const positive = computed(() => a.value > 0)
    effect(() => { runs++; positive.value })
    expect(runs).toBe(1)
    a.value = 3 // positive stays true
    flush()
    expect(runs).toBe(1)
  })

  // ── K2 — disposal & zero residue ─────────────────────────────────────────
  it('scope-dispose-zero: scope disposal leaves zero subscribers', () => {
    const s = signal(0)
    const scope = createScope()
    scope.run(() => { effect(() => { s.value }) })
    expect(inspect(s).subscribers).toBe(1)
    scope.dispose()
    expect(inspect(s).subscribers).toBe(0)
  })

  it('effect-dispose-zero: disposing an effect leaves zero subscribers', () => {
    const s = signal(0)
    const dispose = effect(() => { s.value })
    expect(inspect(s).subscribers).toBe(1)
    dispose()
    expect(inspect(s).subscribers).toBe(0)
  })

  it('computed-dispose-zero: disposing a computed unlinks it from its sources', () => {
    const s = signal(0)
    const scope = createScope()
    let c!: ReadonlySignal<number>
    scope.run(() => { c = computed(() => s.value) })
    c.value // refresh → subscribe c to s
    expect(inspect(s).subscribers).toBe(1)
    scope.dispose()
    expect(inspect(s).subscribers).toBe(0)
  })

  // ── K3 — cycle & failure semantics ───────────────────────────────────────
  it('cycle-error: a computed read during its own recompute throws CycleError', () => {
    let c!: ReadonlySignal<number>
    c = computed((): number => c.value + 1)
    expect(() => c.value).toThrow(CycleError)
  })

  it('throw-retry-computed: a throwing computed stays dirty, retries, never serves stale', () => {
    const bad = signal(false)
    let runs = 0
    const c = computed(() => { runs++; if (bad.value) throw new Error('boom'); return 1 })
    expect(c.value).toBe(1)
    expect(runs).toBe(1)
    bad.value = true
    expect(() => c.value).toThrow('boom')
    expect(runs).toBe(2)
    bad.value = false
    expect(c.value).toBe(1) // recomputed, not verified-and-stale (failure poisons verification)
    expect(runs).toBe(3)
  })

  it('cleanup-once: an effect cleanup runs once per re-run and once on dispose', () => {
    const s = signal(0)
    let cleanups = 0
    const dispose = effect(() => { s.value; return () => { cleanups++ } })
    s.value = 1
    flush()
    expect(cleanups).toBe(1)
    dispose()
    expect(cleanups).toBe(2)
  })

  // ── K5 — untracked / unowned isolation ───────────────────────────────────
  it('untracked-no-edge: an untracked read creates no dependency', () => {
    let runs = 0
    const s = signal(0)
    effect(() => { runs++; untracked(() => s.value) })
    expect(runs).toBe(1)
    s.value = 1
    flush()
    expect(runs).toBe(1)
    expect(inspect(s).subscribers).toBe(0)
  })

  it('unowned-survives-scope: an unowned node is not adopted by the active scope', () => {
    const s = signal(0)
    const scope = createScope()
    let runs = 0
    let disposeInner!: () => void
    scope.run(() => {
      unowned(() => { disposeInner = effect(() => { runs++; s.value }) })
    })
    expect(runs).toBe(1)
    scope.dispose() // must NOT dispose the unowned effect
    s.value = 1
    flush()
    expect(runs).toBe(2)
    disposeInner()
    s.value = 2
    flush()
    expect(runs).toBe(2)
  })

  // ── K7 — inspect() graph-inert ───────────────────────────────────────────
  it('inspect-inert: inspect creates no edge and never evaluates a dirty computed', () => {
    let runs = 0
    const s = signal(0)
    effect(() => { runs++; inspect(s) }) // inspects, never reads .value
    expect(runs).toBe(1)
    s.value = 1
    flush()
    expect(runs).toBe(1) // no dependency edge created
    expect(inspect(s).subscribers).toBe(0)

    let cruns = 0
    const a = signal(0)
    const c = computed(() => { cruns++; return a.value })
    expect(c.value).toBe(0)
    expect(cruns).toBe(1)
    a.value = 5 // c now dirty
    const snap = inspect(c)
    expect(snap.kind).toBe('computed')
    if (snap.kind === 'computed') expect(snap.dirty).toBe(true)
    expect(cruns).toBe(1) // inspect did NOT evaluate the dirty computed
    expect(c.value).toBe(5)
    expect(cruns).toBe(2)
  })

  // ── K6 — typed surface (read-only enforced at the type level) ─────────────
  it('K6 computed value is read-only at the type level', () => {
    const c = computed(() => 1)
    // @ts-expect-error — ReadonlySignal.value has no setter
    const assign = () => { c.value = 2 }
    expect(typeof assign).toBe('function') // never invoked; the type error above is the assertion
    expect(c.value).toBe(1)
  })
})
