// input.test.ts — generic two-way input binding controller (renderer LLD-C8, SPEC-R7; ADR-0019).
//
// Three probes carry the LLD-C8 contract:
//   1. Writeback + per-path waking (the headline) — a stub control's commit event writes its current
//      value into `surface.data` at the bound path; ONLY the binding on that path wakes, the sibling
//      stays asleep (SPEC-N2). Made anti-vacuous by a control arm that DOES wake the sibling (a commit to
//      its own path), proving the harness can observe a wake at all.
//   2. Zero-residue teardown (SPEC-N3) — after `disposeSurface` the surface AbortSignal is aborted and a
//      further commit event no longer mutates the data model: the listener was removed with the surface.
//   3. Negative control — a factory with NO `value` mark installs no listener (opt-in by the factory
//      mark): its commit event leaves the data model untouched.
//
// The controller is generic, so the stub is a plain element with a settable value property + a
// dispatched commit event — no real `ui-*` control is needed to exercise the round-trip.

import { describe, it, expect } from 'vitest'
import { effect, inspect, whenFlushed } from '@agent-ui/components'
import { createSurface, disposeSurface } from './surface.ts'
import type { Surface } from './surface.ts'
import { resolve } from './binding.ts'
import { installInputBinding } from './input.ts'
import type { A2uiComponent } from '../protocol.ts'
import type { WidgetFactory } from '../catalog/types.ts'

const init = { id: 's1', catalogId: 'demo', version: 'v1.0' }

/** A minimal input factory: the `value` mark is all the controller reads; `create`/`applyProp` are inert
 *  here (the test builds the element itself). `prop` names both the node binding and the DOM value read. */
function inputFactory(value: { prop: string; event: string }): WidgetFactory {
  return { tag: 'ui-stub', create: () => document.createElement('div'), applyProp: () => {}, value }
}

/** A stub control: a plain element carrying an assignable value property + the ability to dispatch its
 *  commit event — exactly the two surfaces the generic controller touches (`el[prop]`, `value.event`). */
function stubControl(): HTMLElement {
  return document.createElement('div')
}

/** Bind a counting effect to `path` (mirrors widget.ts `bindProp`): records the resolved value and how
 *  many times it re-applied, so an unwoken binding's `count` simply does not advance (SPEC-N2). */
function bindCounting(surface: Surface, path: string): { count: number; value: unknown } {
  const c = { count: 0, value: undefined as unknown }
  surface.scope.run(() => {
    effect(() => {
      c.value = resolve({ path }, surface)
      c.count++
    })
  })
  return c
}

describe('two-way input binding (renderer LLD-C8, SPEC-R7) — the headline', () => {
  it('a commit event writes the control value into surface.data at the bound path', async () => {
    const s = createSurface(init)
    s.data.value = { name: 'a', email: 'b' }
    const el = stubControl()
    const factory = inputFactory({ prop: 'value', event: 'input' })
    const node: A2uiComponent = { id: 'n1', component: 'TextField', value: { path: '/name' } }

    installInputBinding(el, factory, node, s)

    // The user types: the control's value property holds the committed value; the commit event fires.
    ;(el as { value?: unknown }).value = 'typed'
    el.dispatchEvent(new Event('input'))

    expect(resolve({ path: '/name' }, s)).toBe('typed') // optimistic write landed at the bound path
    expect((s.data.peek() as { email: unknown }).email).toBe('b') // sibling subtree untouched
  })

  it('the write wakes ONLY the bound path; a sibling binding stays asleep (SPEC-N2)', async () => {
    const s = createSurface(init)
    s.data.value = { name: 'a', email: 'b' }
    const name = bindCounting(s, '/name')
    const email = bindCounting(s, '/email')
    expect(name.count).toBe(1) // mount applies each once
    expect(email.count).toBe(1)

    const el = stubControl()
    installInputBinding(el, inputFactory({ prop: 'value', event: 'input' }), { id: 'n1', component: 'TextField', value: { path: '/name' } }, s)

    ;(el as { value?: unknown }).value = 'typed'
    el.dispatchEvent(new Event('input'))
    await whenFlushed()
    expect(name.value).toBe('typed')
    expect(name.count).toBe(2) // /name re-resolved — value changed
    expect(email.count).toBe(1) // /email UNCHANGED — structural sharing kept it Object.is-equal (SPEC-N2)

    // Control arm: a commit that writes /email DOES wake /email — the harness can observe a wake at all,
    // so the `email.count === 1` assertion above is meaningful, not impossible-to-fail.
    const el2 = stubControl()
    installInputBinding(el2, inputFactory({ prop: 'value', event: 'input' }), { id: 'n2', component: 'TextField', value: { path: '/email' } }, s)
    ;(el2 as { value?: unknown }).value = 'changed'
    el2.dispatchEvent(new Event('input'))
    await whenFlushed()
    expect(email.value).toBe('changed')
    expect(email.count).toBe(2)
    expect(name.count).toBe(2) // /name now asleep
  })

  it('honours the factory-declared commit event and value prop (Tabs-style selected/select)', () => {
    // Generic: a different { prop, event } needs no controller change — Tabs binds `selected` on `select`.
    const s = createSurface(init)
    s.data.value = { tab: 'one' }
    const el = stubControl()
    installInputBinding(el, inputFactory({ prop: 'selected', event: 'select' }), { id: 'n1', component: 'Tabs', selected: { path: '/tab' } }, s)

    ;(el as { selected?: unknown }).selected = 'two'
    el.dispatchEvent(new Event('select'))
    expect(resolve({ path: '/tab' }, s)).toBe('two')

    // An unrelated event the factory did NOT declare must not write.
    ;(el as { selected?: unknown }).selected = 'three'
    el.dispatchEvent(new Event('input'))
    expect(resolve({ path: '/tab' }, s)).toBe('two') // unchanged — only the declared event commits
  })
})

describe('zero-residue teardown (SPEC-N3)', () => {
  it('disposeSurface removes the listener via surface.ac — a later commit no longer writes', () => {
    const s = createSurface(init)
    s.data.value = { name: 'a' }
    const el = stubControl()
    installInputBinding(el, inputFactory({ prop: 'value', event: 'input' }), { id: 'n1', component: 'TextField', value: { path: '/name' } }, s)

    ;(el as { value?: unknown }).value = 'first'
    el.dispatchEvent(new Event('input'))
    expect(resolve({ path: '/name' }, s)).toBe('first') // listener live before teardown

    disposeSurface(s)
    expect(s.ac.signal.aborted).toBe(true) // AbortSignal asserts the listeners were torn down (N3)

    // A commit after teardown is inert: the aborted signal removed the listener, so no further write.
    ;(el as { value?: unknown }).value = 'late'
    el.dispatchEvent(new Event('input'))
    expect(resolve({ path: '/name' }, s)).toBe('first') // unchanged — zero residue
  })
})

describe('negative control — opt-in by the factory mark', () => {
  it('a factory with NO value mark installs no listener (a non-input control like ui-button)', () => {
    const s = createSurface(init)
    s.data.value = { name: 'a' }
    const el = stubControl()
    // A button-style factory: no `value`. The controller must leave it untouched.
    const factory: WidgetFactory = { tag: 'ui-button', create: () => document.createElement('div'), applyProp: () => {} }
    installInputBinding(el, factory, { id: 'n1', component: 'Button', label: 'Go' }, s)

    ;(el as { value?: unknown }).value = 'x'
    el.dispatchEvent(new Event('input'))
    el.dispatchEvent(new Event('change'))
    expect(s.data.peek()).toEqual({ name: 'a' }) // data model untouched — no listener was installed
  })

  it('a value mark whose node prop is a literal (not a {path}) installs no listener', () => {
    const s = createSurface(init)
    s.data.value = { name: 'a' }
    const el = stubControl()
    // Marked input, but the node binds a literal value — there is no path to write back to.
    const node: A2uiComponent = { id: 'n1', component: 'TextField', value: 'static' }
    installInputBinding(el, inputFactory({ prop: 'value', event: 'input' }), node, s)

    ;(el as { value?: unknown }).value = 'typed'
    el.dispatchEvent(new Event('input'))
    expect(s.data.peek()).toEqual({ name: 'a' }) // unchanged — no writeback target, no listener
  })
})

describe('per-path memo stays leak-free with input writes (SPEC-N3)', () => {
  it('after an input write the data signal still carries one subscriber per distinct path, zero after dispose', async () => {
    const s = createSurface(init)
    s.data.value = { name: 'a', email: 'b' }
    bindCounting(s, '/name')
    bindCounting(s, '/email')
    expect(inspect(s.data).subscribers).toBe(2)

    const el = stubControl()
    installInputBinding(el, inputFactory({ prop: 'value', event: 'input' }), { id: 'n1', component: 'TextField', value: { path: '/name' } }, s)
    ;(el as { value?: unknown }).value = 'typed'
    el.dispatchEvent(new Event('input'))
    await whenFlushed()
    expect(inspect(s.data).subscribers).toBe(2) // the optimistic write adds no subscriber

    disposeSurface(s)
    expect(inspect(s.data).subscribers).toBe(0)
  })
})
