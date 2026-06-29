// list.test.ts — positional dynamic-list renderer (renderer LLD-C6, SPEC-R6 / ADR-0024 — vehicle B2).
//
// The headline is the POSITIONAL re-bind proof: a mid-array insert/remove keeps every surviving
// instance's DOM element (no re-create, no move) and re-binds it to its new index's data — instance `i`
// shows `/items/{i}`. Made anti-vacuous by capturing the element identities before the mutation and
// asserting the SAME nodes, in place, carry the SHIFTED values (a keyed move would instead relocate the
// node; a re-create would swap its identity). The other suites prove the supporting invariants: boundary-
// only append/remove (SPEC-R6 AC1), per-item child-scope disposal on removal (SPEC-N3, non-vacuous: a
// removed instance stops reacting), and leak-free teardown (no surface.data accumulation across churn).
//
// Built on the REAL widget factory path (`makeCreateWidget`) + the REAL per-path resolver (`resolve`),
// so the relative-path `{path}/{index}/…` resolution and the per-index child scope are exercised end to
// end against a stub catalog factory that records every `applyProp`.

import { describe, it, expect } from 'vitest'
import { inspect, whenFlushed } from '@agent-ui/components'
import { renderList } from './list.ts'
import { makeCreateWidget } from './widget.ts'
import { resolve, setPointer } from './binding.ts'
import { createSurface, disposeSurface } from './surface.ts'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from '../catalog/types.ts'

const init = { id: 's1', catalogId: 'demo', version: 'v1.0' }
const comp = (c: Record<string, unknown>): A2uiComponent => c as A2uiComponent

interface AppliedProp {
  el: HTMLElement
  prop: string
  value: unknown
}

/** A factory that creates a real element and records every prop the bound-prop effect applies. */
function stubFactory(tag = 'ui-text'): { factory: WidgetFactory; applied: AppliedProp[] } {
  const applied: AppliedProp[] = []
  const factory: WidgetFactory = {
    tag,
    create: () => document.createElement(tag),
    applyProp: (el, prop, value) => void applied.push({ el, prop, value }),
  }
  return { factory, applied }
}

/** A registry that resolves exactly `catalogId` to `factories`. */
function stubRegistry(catalogId: string, factories: Record<string, WidgetFactory>): CatalogRegistry {
  const entry = { factories } as unknown as CatalogEntry
  return {
    register: () => {},
    get: (id) => (id === catalogId ? entry : undefined),
    supportedCatalogIds: () => [catalogId],
  }
}

/** The latest value applied to `el` for `prop` (the bound prop's current rendered value). */
const latest = (applied: AppliedProp[], el: Element, prop: string): unknown =>
  [...applied].reverse().find((a) => a.el === el && a.prop === prop)?.value

/** How many times `prop` was applied to `el` (re-applies bump it; an unwoken instance does not). */
const applyCount = (applied: AppliedProp[], el: Element, prop: string): number =>
  applied.filter((a) => a.el === el && a.prop === prop).length

const childEls = (c: HTMLElement): HTMLElement[] => [...c.children] as HTMLElement[]

/**
 * A list driven by the REAL widget + resolver path. The template `Item` binds `text` to the RELATIVE
 * pointer `label`, so each instance resolves `/items/{index}/label`. `setItems` replaces the whole array
 * via the structural-sharing `setPointer` (exactly how the host applies an `updateDataModel` at `/items`).
 */
function listHarness(initialItems: unknown[], templateProps: Record<string, unknown> = { text: { path: 'label' } }) {
  const { factory, applied } = stubFactory('ui-text')
  const errors: A2uiError[] = []
  const createWidget = makeCreateWidget({
    registry: stubRegistry('demo', { Item: factory }),
    emitError: (e) => void errors.push(e),
    resolveBinding: (b, s, itemScope) => resolve(b, s, itemScope),
  })
  const surface = createSurface(init)
  surface.data.value = { items: initialItems }
  surface.components.set('tpl', comp({ id: 'tpl', component: 'Item', ...templateProps }))
  const container = document.createElement('div')
  renderList({ container, template: { path: '/items', componentId: 'tpl' }, surface, createWidget })
  const setItems = (items: unknown[]): void => {
    surface.data.value = setPointer(surface.data.peek(), '/items', items)
  }
  return { applied, errors, surface, container, setItems }
}

describe('initial render + boundary append/remove (SPEC-R6 AC1)', () => {
  it('renders one instance per element, in order, with relative paths resolved to {path}/{index}', () => {
    const { container, applied, errors } = listHarness([{ label: 'a' }, { label: 'b' }, { label: 'c' }])
    expect(errors).toEqual([])
    const els = childEls(container)
    expect(els).toHaveLength(3)
    expect(els.map((el) => el.tagName.toLowerCase())).toEqual(['ui-text', 'ui-text', 'ui-text'])
    expect(els.map((el) => latest(applied, el, 'text'))).toEqual(['a', 'b', 'c'])
  })

  it('append at the end adds ONLY the boundary instance; existing instances keep their identity', async () => {
    const { container, applied, setItems } = listHarness([{ label: 'a' }, { label: 'b' }])
    const [e0, e1] = childEls(container)

    setItems([{ label: 'a' }, { label: 'b' }, { label: 'c' }])
    await whenFlushed()

    const els = childEls(container)
    expect(els).toHaveLength(3)
    expect(els[0]).toBe(e0) // same node — not re-created
    expect(els[1]).toBe(e1)
    expect(latest(applied, els[2], 'text')).toBe('c') // the new boundary instance
    // The unaffected instances did not re-apply (their resolved value is Object.is-equal across the write).
    expect(applyCount(applied, e0, 'text')).toBe(1)
    expect(applyCount(applied, e1, 'text')).toBe(1)
  })

  it('remove at the end disposes ONLY the trailing instance; survivors keep their identity', async () => {
    const { container, setItems } = listHarness([{ label: 'a' }, { label: 'b' }, { label: 'c' }])
    const [e0, e1, e2] = childEls(container)

    setItems([{ label: 'a' }, { label: 'b' }])
    await whenFlushed()

    const els = childEls(container)
    expect(els).toHaveLength(2)
    expect(els[0]).toBe(e0)
    expect(els[1]).toBe(e1)
    expect(e2.isConnected).toBe(false) // the trailing instance was detached
  })

  it('a non-array (or undefined) bound value renders an empty list (no instances, no throw)', () => {
    const { container } = listHarness('not-an-array' as unknown as unknown[])
    expect(childEls(container)).toHaveLength(0)
  })
})

describe('mid-array shift RE-BINDS positionally, never moves/re-creates (the headline, SPEC-N2)', () => {
  it('a mid-array INSERT: survivors keep identity in place and re-bind to the shifted /items/{i}', async () => {
    const { container, applied, setItems } = listHarness([{ label: 'a' }, { label: 'b' }, { label: 'c' }])
    const [e0, e1, e2] = childEls(container)
    expect([e0, e1, e2].map((el) => latest(applied, el, 'text'))).toEqual(['a', 'b', 'c'])

    // Insert 'X' at index 1 → [a, X, b, c]. Length 3→4.
    setItems([{ label: 'a' }, { label: 'X' }, { label: 'b' }, { label: 'c' }])
    await whenFlushed()

    const els = childEls(container)
    expect(els).toHaveLength(4)
    // Identity preserved AND in original position for every survivor — NO move, NO re-create. A keyed
    // reconcile (repeat) would relocate the 'b' node to index 2; positional keeps the node and re-binds.
    expect(els[0]).toBe(e0)
    expect(els[1]).toBe(e1)
    expect(els[2]).toBe(e2)
    // Positional re-bind: instance i now shows /items/i. e1 went 'b'→'X', e2 went 'c'→'b', e3 is new 'c'.
    expect(latest(applied, e0, 'text')).toBe('a')
    expect(latest(applied, e1, 'text')).toBe('X')
    expect(latest(applied, e2, 'text')).toBe('b')
    expect(latest(applied, els[3], 'text')).toBe('c')
    // e0 is unchanged at /items/0 — its bound-prop effect stayed asleep (Object.is cutoff, SPEC-N2).
    expect(applyCount(applied, e0, 'text')).toBe(1)
    // e1/e2 each re-applied exactly once for the shift.
    expect(applyCount(applied, e1, 'text')).toBe(2)
    expect(applyCount(applied, e2, 'text')).toBe(2)
  })

  it('a mid-array REMOVE: survivors keep identity in place and re-bind to the shifted /items/{i}', async () => {
    const { container, applied, setItems } = listHarness([
      { label: 'a' },
      { label: 'b' },
      { label: 'c' },
      { label: 'd' },
    ])
    const [e0, e1, e2, e3] = childEls(container)

    // Remove index 1 ('b') → [a, c, d]. Length 4→3.
    setItems([{ label: 'a' }, { label: 'c' }, { label: 'd' }])
    await whenFlushed()

    const els = childEls(container)
    expect(els).toHaveLength(3)
    expect(els[0]).toBe(e0) // survivors keep identity in place
    expect(els[1]).toBe(e1)
    expect(els[2]).toBe(e2)
    expect(e3.isConnected).toBe(false) // the trailing node is the one removed (positional), NOT the 'b' node
    // Positional re-bind: e1 'b'→'c', e2 'c'→'d'; e0 unchanged.
    expect(latest(applied, e0, 'text')).toBe('a')
    expect(latest(applied, e1, 'text')).toBe('c')
    expect(latest(applied, e2, 'text')).toBe('d')
  })
})

describe('per-item child-scope disposal + leak-free teardown (SPEC-N3)', () => {
  it('removing an instance disposes its child scope — the removed node stops reacting (non-vacuous)', async () => {
    const { container, applied, setItems } = listHarness([{ label: 'a' }, { label: 'b' }, { label: 'c' }])
    const e2 = childEls(container)[2]
    expect(latest(applied, e2, 'text')).toBe('c')

    // Shrink to 2 — e2 removed, its child scope disposed.
    setItems([{ label: 'a' }, { label: 'b' }])
    await whenFlushed()
    expect(e2.isConnected).toBe(false)

    // Re-grow to 3 with a DIFFERENT index-2 value. If e2's scope had leaked, its effect (subscribed to
    // the MEMOIZED /items/2/label computed) would re-fire and apply 'Z' to the detached e2. It must not:
    // a fresh instance handles index 2 now.
    setItems([{ label: 'a' }, { label: 'b' }, { label: 'Z' }])
    await whenFlushed()

    const els = childEls(container)
    expect(els).toHaveLength(3)
    expect(els[2]).not.toBe(e2) // a NEW instance for the re-grown index — the old one was discarded
    expect(latest(applied, els[2], 'text')).toBe('Z')
    expect(latest(applied, e2, 'text')).toBe('c') // the detached old node never received 'Z' → scope was disposed
  })

  it('disposeSurface releases the whole list — surface.data drops to zero subscribers', () => {
    const { surface, container } = listHarness([{ label: 'a' }, { label: 'b' }, { label: 'c' }])
    expect(childEls(container)).toHaveLength(3)
    // /items (length computed) + /items/{0,1,2}/label (one per item) — four distinct path computeds.
    expect(inspect(surface.data).subscribers).toBe(4)

    disposeSurface(surface)
    expect(inspect(surface.data).subscribers).toBe(0) // scope.dispose() + the teardown carrier released all
  })

  it('add/remove churn does not accumulate subscribers on surface.data (bounded by distinct paths)', async () => {
    const five = [{ label: '0' }, { label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }]
    const { surface, container, setItems } = listHarness(five)
    // /items + /items/{0..4}/label = 6 distinct memoized path computeds.
    const baseline = inspect(surface.data).subscribers
    expect(baseline).toBe(6)

    for (let cycle = 0; cycle < 3; cycle++) {
      setItems([{ label: '0' }])
      await whenFlushed()
      expect(childEls(container)).toHaveLength(1)
      setItems(five)
      await whenFlushed()
      expect(childEls(container)).toHaveLength(5)
    }

    // The memo reuses one computed per distinct pointer, so churn never adds a subscriber — surface.data
    // carries exactly the same six it did before the churn (the per-item EFFECTS live in child scopes,
    // disposed on each shrink, never on surface.data).
    expect(inspect(surface.data).subscribers).toBe(baseline)
    disposeSurface(surface)
    expect(inspect(surface.data).subscribers).toBe(0)
  })
})

describe('absolute vs relative bindings inside a template (LLD-C6 / ADR-0024)', () => {
  it('an ABSOLUTE binding inside the template resolves from the data ROOT (not the item)', async () => {
    // `heading` is absolute (/title), `text` is relative (label) — proving the two resolve differently.
    const { factory, applied } = stubFactory('ui-text')
    const createWidget = makeCreateWidget({
      registry: stubRegistry('demo', { Item: factory }),
      emitError: () => {},
      resolveBinding: (b, s, itemScope) => resolve(b, s, itemScope),
    })
    const surface = createSurface(init)
    surface.data.value = { title: 'ROOT', items: [{ label: 'a' }, { label: 'b' }] }
    surface.components.set(
      'tpl',
      comp({ id: 'tpl', component: 'Item', text: { path: 'label' }, heading: { path: '/title' } }),
    )
    const container = document.createElement('div')
    renderList({ container, template: { path: '/items', componentId: 'tpl' }, surface, createWidget })

    const els = childEls(container)
    expect(els.map((el) => latest(applied, el, 'text'))).toEqual(['a', 'b']) // relative → /items/{i}/label
    expect(els.map((el) => latest(applied, el, 'heading'))).toEqual(['ROOT', 'ROOT']) // absolute → /title
  })
})
