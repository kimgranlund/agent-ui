import { describe, it, expect } from 'vitest'
import { effect, whenFlushed } from '@agent-ui/components'
import { prop, finalize, coerceAttribute, type PropsSchema, type ReactiveProps } from './props.ts'

// D2 — prop schema & runtime reactivity (rubric element.md D2). Proven in ISOLATION against a plain
// host stub (no UIElement / connection scope / AbortController — those are the later element slice):
// the per-instance signal store is lazy (WeakMap, created on first access), so finalize() needs no
// constructor. The named probes are finalize-installs-accessors · prop-write-invalidates ·
// objectis-equal-write-wakes-nothing · default-coercion.

const props = {
  variant: prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'),
  count: prop.number(0),
  label: prop.string('hi'),
  disabled: prop.boolean(false),
} satisfies PropsSchema

interface Host extends ReactiveProps<typeof props> {}
class Host {
  static props = props
}
finalize(Host)

describe('p-install — finalize() (D2)', () => {
  it('finalize-installs-accessors: a get/set per prop on the prototype; defaults read back', () => {
    const desc = Object.getOwnPropertyDescriptor(Host.prototype, 'variant')
    expect(typeof desc?.get).toBe('function')
    expect(typeof desc?.set).toBe('function')

    const el = new Host()
    expect(el.variant).toBe('solid') // declared default
    expect(el.count).toBe(0)
    expect(el.label).toBe('hi')
    expect(el.disabled).toBe(false)
  })

  it('is idempotent: a second finalize does not throw or re-define', () => {
    expect(() => finalize(Host)).not.toThrow()
  })

  it('signals are per-instance: a write on one instance does not leak to another', () => {
    const a = new Host()
    const b = new Host()
    a.variant = 'soft'
    expect(a.variant).toBe('soft')
    expect(b.variant).toBe('solid')
  })

  it('prop-write-invalidates: a read inside an effect tracks; a write re-runs it', async () => {
    const el = new Host()
    let runs = 0
    let seen: string | undefined
    const dispose = effect(() => {
      runs++
      seen = el.variant
    })
    expect(runs).toBe(1) // synchronous first run
    expect(seen).toBe('solid')

    el.variant = 'soft'
    await whenFlushed() // effect re-runs are microtask-scheduled
    expect(runs).toBe(2)
    expect(seen).toBe('soft')

    dispose()
  })

  it('objectis-equal-write-wakes-nothing: the kernel cutoff holds through the accessor', async () => {
    const el = new Host()
    let runs = 0
    const dispose = effect(() => {
      runs++
      void el.variant
    })
    expect(runs).toBe(1)

    el.variant = 'solid' // equal to the current value → Object.is cutoff → no invalidation
    await whenFlushed()
    expect(runs).toBe(1) // not re-run

    dispose()
  })

  it('default-coercion: an attribute string crosses to the typed value via PropType.from', () => {
    const el = new Host()
    expect(coerceAttribute(el, Host, 'count', '42')).toBe(42) // string → number
    expect(el.count).toBe(42)

    coerceAttribute(el, Host, 'count', null)
    expect(el.count).toBeNull() // absent attribute → null (number codec)

    coerceAttribute(el, Host, 'disabled', '') // boolean presence semantics
    expect(el.disabled).toBe(true)
  })

  it('coercion drives reactivity: an inbound attribute crossing wakes a tracking effect', async () => {
    const el = new Host()
    let seen: number | null = -1
    const dispose = effect(() => {
      seen = el.count
    })
    expect(seen).toBe(0)

    coerceAttribute(el, Host, 'count', '7')
    await whenFlushed()
    expect(seen).toBe(7)

    dispose()
  })
})
