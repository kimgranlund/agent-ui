import { describe, it, expect } from 'vitest'
import { effect } from '@agent-ui/components'
import { UIElement } from './element.ts'
import { prop, type PropsSchema, type ReactiveProps } from './props.ts'

// e-upgrade (rubric element.md D5). The lazy-property upgrade dance: a `.prop=` assigned BEFORE the
// element upgrades creates an OWN data property that masks the finalize-installed prototype accessor;
// `upgradeProps` (at connect) dissolves the shadow so the value flows through the accessor into the
// signal. Named probes: lazy-upgrade-replay · no-accessor-shadow (+ array/object) · upgrade-noop ·
// upgrade↔attribute-ordering (the WATCH item, characterized).

const upgradeSchema = {
  variant: prop.enum(['solid', 'soft', 'ghost'] as const, 'solid'),
  count: prop.number(0),
  items: prop.json<number[]>([]), // array-valued, for the manual/object replay
} satisfies PropsSchema

interface UpEl extends ReactiveProps<typeof upgradeSchema> {}
class UpEl extends UIElement {
  static props = upgradeSchema
}
customElements.define('ui-upgrade', UpEl)

// A pre-upgrade own-property shadow: an own data property masking the prototype accessor (exactly what a
// `.prop=` before upgrade produces). Used where precise control beats the define-timing dance.
function shadow(el: object, name: string, value: unknown): void {
  Object.defineProperty(el, name, { value, writable: true, configurable: true, enumerable: true })
}

describe('e-upgrade — lazy-property upgrade dance (D5)', () => {
  it('lazy-upgrade-replay: a .prop= set BEFORE upgrade replays through the accessor at connect (D5=3)', () => {
    // The REAL pre-upgrade path: create the element while its tag is still UNDEFINED → no accessor yet →
    // the assignment is an own-property shadow. Then define + connect to upgrade and reconcile.
    const el = document.createElement('ui-upgrade-real')
    ;(el as unknown as Record<string, unknown>).variant = 'soft'
    expect(Object.hasOwn(el, 'variant')).toBe(true) // shadow (no accessor existed at assignment time)

    class RealUpEl extends UIElement {
      static props = upgradeSchema
    }
    customElements.define('ui-upgrade-real', RealUpEl)
    document.body.append(el) // insertion upgrades (constructor/finalize) then connects (upgradeProps)

    let seen: string | undefined
    const dispose = effect(() => {
      seen = (el as unknown as Record<string, unknown>).variant as string
    })
    expect(seen).toBe('soft') // reactive read via the accessor → the signal holds the replayed value
    expect(Object.getOwnPropertyDescriptor(el, 'variant')).toBeUndefined() // shadow dissolved
    dispose()
  })

  it('no-accessor-shadow: after upgradeProps no own property masks the accessor; the value lives in the signal (D5=5)', () => {
    const el = new UpEl()
    shadow(el, 'count', 9)
    expect(Object.getOwnPropertyDescriptor(el, 'count')?.value).toBe(9) // shadow present pre-connect

    document.body.append(el) // connect → upgradeProps dissolves it

    expect(Object.getOwnPropertyDescriptor(el, 'count')).toBeUndefined() // no own property masks the accessor
    let seen: number | null = -1
    const dispose = effect(() => {
      seen = el.count
    })
    expect(seen).toBe(9) // the value lives in the signal, read via the accessor
    dispose()
  })

  it('no-accessor-shadow: an array/object-valued prop replays too, with identity preserved (D5=5)', () => {
    const el = new UpEl()
    const arr = [1, 2, 3]
    shadow(el, 'items', arr)

    document.body.append(el)

    expect(Object.getOwnPropertyDescriptor(el, 'items')).toBeUndefined()
    let seen: number[] | undefined
    const dispose = effect(() => {
      seen = el.items
    })
    expect(seen).toBe(arr) // same reference replayed through the accessor (manual array/object accessor case)
    dispose()
  })

  it('upgrade-noop: upgradeProps leaves a normal (no-shadow) element untouched; later writes go through the accessor', () => {
    const el = new UpEl()
    document.body.append(el) // upgradeProps runs; there are no shadows
    el.variant = 'ghost' // a normal post-upgrade write — goes through the accessor, creates no own property
    expect(Object.getOwnPropertyDescriptor(el, 'variant')).toBeUndefined()
    expect(el.variant).toBe('ghost')
  })

  it('upgrade↔attribute-ordering (WATCH): a pre-upgrade property BEATS an initial attribute (property-wins, ADR-0005)', () => {
    // attributeChangedCallback fires DURING upgrade, before connect, while the shadow is still present, so
    // its inbound write lands on the own-property shadow. BUT the constructor already CAPTURED the
    // pre-upgrade property value ('soft') before that write — and upgradeProps replays the captured value,
    // so the imperatively-set property wins over the initial attribute. No crash / loss / loop.
    const el = document.createElement('ui-upgrade-watch')
    ;(el as unknown as Record<string, unknown>).variant = 'soft' // pre-upgrade JS property (own-property shadow)
    el.setAttribute('variant', 'ghost') // initial attribute for the same prop

    class WatchUpEl extends UIElement {
      static props = upgradeSchema
    }
    customElements.define('ui-upgrade-watch', WatchUpEl)
    document.body.append(el) // upgrade (ctor captures 'soft'; attr writes 'ghost' to the shadow) → connect (replay captured)

    expect(Object.getOwnPropertyDescriptor(el, 'variant')).toBeUndefined() // shadow dissolved
    let seen: string | undefined
    const dispose = effect(() => {
      seen = (el as unknown as Record<string, unknown>).variant as string
    })
    expect(seen).toBe('soft') // the captured pre-upgrade property won over the initial attribute
    dispose()
  })

  it('property-wins: created un-upgraded, `.prop=` then matching attribute → the property value wins (ADR-0005)', () => {
    const el = document.createElement('ui-upgrade-pw') as HTMLElement & { variant?: string }
    ;(el as unknown as Record<string, unknown>).variant = 'soft' // imperatively set BEFORE upgrade
    el.setAttribute('variant', 'solid') // an initial attribute carrying a different value

    class PwEl extends UIElement {
      static props = upgradeSchema
    }
    customElements.define('ui-upgrade-pw', PwEl)
    document.body.append(el) // define + connect → upgrade

    expect(el.variant).toBe('soft') // the property won; the attribute did not override it
  })
})
