import { describe, it, expect, vi } from 'vitest'
import { effect, whenFlushed } from '@agent-ui/components'
import { UIElement } from './element.ts'
import { prop, type PropsSchema, type ReactiveProps } from './props.ts'

// e-attrs (rubric element.md — the inbound side of the D3 reflection story; goals.md G2 DoD box 2). The
// REAL platform callback (observedAttributes + attributeChangedCallback) wired over the shipped
// coerceAttribute + the p-reflect directional lock. p-reflect SIMULATED the inbound crossing with a stub
// callback; here it is driven through the real platform reaction. Named probes: observed-from-schema ·
// attr-crosses-to-prop · override-mapping · property-only-excluded · no-loop-outbound · no-loop-inbound.

const attrProps = {
  variant: { ...prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'), reflect: true }, // reflect, attr = variant
  count: prop.number(0), // non-reflect, observed, attr = count
  payload: { ...prop.json<{ a: number }>({ a: 0 }), reflect: true }, // reflect json
  maxLength: { ...prop.number(0), attribute: 'max-length' }, // attribute OVERRIDE: attr = max-length, prop = maxLength
  internalState: { ...prop.string('x'), attribute: false as const }, // property-only: no attribute, not observed
} satisfies PropsSchema

interface AttrEl extends ReactiveProps<typeof attrProps> {}
class AttrEl extends UIElement {
  static props = attrProps
}
customElements.define('ui-attr-host', AttrEl)

describe('e-attrs — observedAttributes + attributeChangedCallback (D3 inbound, DoD box 2)', () => {
  it('observed-from-schema: observedAttributes lists exactly the observed names (override honoured, property-only excluded)', () => {
    expect([...AttrEl.observedAttributes].sort()).toEqual(['count', 'max-length', 'payload', 'variant'])
    expect(AttrEl.observedAttributes).not.toContain('maxLength') // override name, not the prop name
    expect(AttrEl.observedAttributes).not.toContain('internalState') // attribute:false → not observed
  })

  it('attr-crosses-to-prop: setting an observed attribute crosses string→typed and wakes a tracking effect', async () => {
    const el = new AttrEl()
    let seen: number | null = -1
    const dispose = effect(() => {
      seen = el.count
    })
    expect(seen).toBe(0) // default

    el.setAttribute('count', '42') // observed → the real attributeChangedCallback → coerceAttribute
    await whenFlushed()
    expect(seen).toBe(42) // string → number crossed, and the effect re-ran
    expect(el.count).toBe(42)

    dispose()
  })

  it('override-mapping: the attribute name maps to its differently-named prop (max-length ↔ maxLength)', async () => {
    const el = new AttrEl()
    let seen: number | null = -1
    const dispose = effect(() => {
      seen = el.maxLength
    })

    el.setAttribute('max-length', '5') // the OVERRIDE attribute → propForAttribute → 'maxLength'
    await whenFlushed()
    expect(seen).toBe(5)
    expect(el.maxLength).toBe(5)

    dispose()
  })

  it('property-only-excluded: a property-only prop is decoupled from attributes (no crossing)', () => {
    const el = new AttrEl()
    el.setAttribute('internalState', 'changed') // not observed → attributeChangedCallback never fires
    expect(el.internalState).toBe('x') // unchanged default
  })

  it('no-loop-outbound: a reflect write → setAttribute → the REAL attributeChangedCallback is suppressed (no re-loop)', async () => {
    const el = new AttrEl()
    let runs = 0
    let seen: { a: number } | undefined
    const dispose = effect(() => {
      runs++
      seen = el.payload
    })
    expect(runs).toBe(1)

    const payload = { a: 7 }
    el.payload = payload // setter → reflectOut → setAttribute → REAL attributeChangedCallback → coerceAttribute SUPPRESSED (outbound lock)
    await whenFlushed()

    expect(el.getAttribute('payload')).toBe('{"a":7}') // reflected once
    expect(runs).toBe(2) // exactly one invalidation — the echo did NOT re-parse a fresh object and re-invalidate
    expect(seen).toBe(payload) // identity preserved end-to-end through the real callback
    expect(el.payload).toBe(payload)

    dispose()
  })

  it('no-loop-inbound: an external setAttribute crosses to the value without reflecting back (no runaway)', () => {
    const el = new AttrEl()
    el.setAttribute('variant', 'soft') // prime via the platform path
    expect(el.variant).toBe('soft')

    const spy = vi.spyOn(el, 'setAttribute')
    el.setAttribute('variant', 'ghost') // external change → attributeChangedCallback → coerce under the inbound lock

    expect(el.variant).toBe('ghost') // value followed the attribute (inbound crossing)
    expect(spy).toHaveBeenCalledTimes(1) // ONLY the user's call — the setter did NOT reflect back out
    expect(el.getAttribute('variant')).toBe('ghost') // no runaway
  })
})
