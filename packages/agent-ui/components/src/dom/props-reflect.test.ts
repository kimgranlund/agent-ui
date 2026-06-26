import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effect, whenFlushed } from '@agent-ui/components'
import { prop, finalize, coerceAttribute, type PropsSchema, type ReactiveProps } from './props.ts'

// D3 — reflection & directional locks (rubric element.md D3; goals.md G2 DoD2). Proven against a MINIMAL
// host stub — a throwaway `HTMLElement` with `static props`, finalized, and `customElements.define`d so
// reflection has a real `setAttribute` sink. The stub's `attributeChangedCallback` only FORWARDS to
// `coerceAttribute` (the inbound primitive the real e-attrs slice will later own) — it is the test's
// simulation of the platform echo, NOT the element lifecycle. jsdom fires that callback SYNCHRONOUSLY
// during `setAttribute`, so the value→attribute reflect and its attribute→value echo collide inside one
// call stack: exactly the loop the directional locks must break. Named probes: reflect-once ·
// attr-cross-typed · json-no-reloop · outbound-lock-suppresses-echo · inbound-no-reflect · round-trip.

interface Payload {
  a: number
}

// `reflect: true` is an opt-in on PropConfig; the `prop.*` constructors don't set it, so the author adds
// it. (Extending the constructors to take it is p-config's surface, out of this slice's bound.)
const props = {
  variant: { ...prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'), reflect: true },
  count: { ...prop.number(0), reflect: true },
  open: { ...prop.boolean(false), reflect: true },
  data: { ...prop.json<Payload>({ a: 0 }), reflect: true },
  label: prop.string('hi'), // NON-reflect control — must never touch an attribute
} satisfies PropsSchema

// Records every platform echo so a probe can prove the echo FIRED yet was suppressed (the lock did the
// work) rather than simply never happening.
const echoes: Array<{ name: string; value: string | null; ret: unknown }> = []

interface ReflectHost extends ReactiveProps<typeof props> {}
class ReflectHost extends HTMLElement {
  static props = props
  static get observedAttributes(): string[] {
    return Object.keys(props)
  }
  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    // The TEST's stand-in for e-attrs: forward the inbound crossing to the lock-guarded primitive.
    echoes.push({ name, value, ret: coerceAttribute(this, ReflectHost, name, value) })
  }
}
finalize(ReflectHost)
customElements.define('s-prop-reflect', ReflectHost)

beforeEach(() => {
  echoes.length = 0
})

describe('p-reflect — reflection & directional locks (D3)', () => {
  it('reflect-once: a reflect-prop write produces exactly one setAttribute with the `to`-codec string', () => {
    const el = new ReflectHost()
    const spy = vi.spyOn(el, 'setAttribute')

    el.variant = 'soft'

    expect(spy).toHaveBeenCalledTimes(1) // the platform echo did NOT add a second write
    expect(spy).toHaveBeenCalledWith('variant', 'soft') // value serialized via PropType.to
    expect(el.getAttribute('variant')).toBe('soft') // and the sink really took it (spy called through)
  })

  it('reflect-once: a NON-reflect prop write touches no attribute', () => {
    const el = new ReflectHost()
    const spy = vi.spyOn(el, 'setAttribute')

    el.label = 'bye'

    expect(spy).not.toHaveBeenCalled()
    expect(el.getAttribute('label')).toBeNull()
    expect(el.label).toBe('bye') // the signal still updated
  })

  it('attr-cross-typed: each typed value round-trips through `to` (out) and `from` (in)', () => {
    const el = new ReflectHost()

    // OUTBOUND: typed → string via PropType.to (the second boundary function)
    el.count = 42
    expect(el.getAttribute('count')).toBe('42')
    el.variant = 'ghost'
    expect(el.getAttribute('variant')).toBe('ghost')
    el.data = { a: 5 }
    expect(el.getAttribute('data')).toBe('{"a":5}')
    el.open = true
    expect(el.getAttribute('open')).toBe('') // boolean presence
    el.open = false
    expect(el.getAttribute('open')).toBeNull() // `to` → null removes the attribute

    // INBOUND: string → typed via PropType.from (the first boundary function)
    expect(coerceAttribute(el, ReflectHost, 'count', '99')).toBe(99)
    expect(el.count).toBe(99)
    expect(coerceAttribute(el, ReflectHost, 'data', '{"a":8}')).toEqual({ a: 8 })
    expect(el.data).toEqual({ a: 8 })
  })

  it('outbound-lock-suppresses-echo: the platform echo fires during the reflect but is suppressed (no loop)', async () => {
    const el = new ReflectHost()
    let runs = 0
    const dispose = effect(() => {
      runs++
      void el.variant
    })
    expect(runs).toBe(1)

    el.variant = 'soft'
    await whenFlushed()

    // The echo DID fire (proving the lock, not the absence of an echo, is what breaks the loop)…
    expect(echoes).toContainEqual({ name: 'variant', value: 'soft', ret: undefined })
    // …`ret: undefined` ⇒ coerceAttribute returned early under the outbound lock — no second signal write.
    expect(runs).toBe(2) // exactly one invalidation (our write), not two

    dispose()
  })

  it('inbound-no-reflect: an attribute→value coercion updates the signal but does NOT reflect back out', () => {
    const el = new ReflectHost()
    const spy = vi.spyOn(el, 'setAttribute')

    const crossed = coerceAttribute(el, ReflectHost, 'variant', 'ghost') // e-attrs hands us an inbound attribute

    expect(crossed).toBe('ghost') // string → typed crossed in
    expect(el.variant).toBe('ghost') // signal updated through the accessor
    expect(spy).not.toHaveBeenCalled() // the inbound lock stopped the setter bouncing it back to the attribute
  })

  it('json-no-reloop: a JSON-valued reflect round-trip does not re-loop or replace the held value', async () => {
    const el = new ReflectHost()
    let runs = 0
    let seen: Payload | undefined
    const dispose = effect(() => {
      runs++
      seen = el.data
    })
    expect(runs).toBe(1)

    const payload = { a: 7 }
    el.data = payload
    await whenFlushed()

    expect(el.getAttribute('data')).toBe('{"a":7}') // reflected once
    expect(runs).toBe(2) // NOT 3 — the echo's fresh JSON.parse object never invalidated the signal
    expect(seen).toBe(payload)
    expect(el.data).toBe(payload) // identity preserved ⇒ the suppressed echo never overwrote it with a clone

    dispose()
  })

  it('round-trip: property→attribute→property crosses each way exactly once via the real platform reaction', () => {
    const el = new ReflectHost()

    el.variant = 'soft' // outbound: value → attribute (+ suppressed echo)
    expect(el.getAttribute('variant')).toBe('soft')

    el.setAttribute('variant', 'ghost') // inbound: the real platform reaction fires coerceAttribute
    expect(el.variant).toBe('ghost') // value followed the attribute…
    expect(el.getAttribute('variant')).toBe('ghost') // …and the attribute did not run away (no reflect-back loop)
  })
})
