// binding.test.ts — per-path binding resolver (renderer LLD-C5, SPEC-N2/R5/R4-AC2/N3).
//
// The headline is the per-path-waking proof (`per-path waking … the headline`): a write to one path
// re-applies ONLY the widgets bound to that path; a disjoint binding stays asleep (SPEC-N2). It is made
// anti-vacuous by a negative control — the same scenario run through the COARSE memo-bypassing resolver,
// which DOES wake the sibling. Swap that resolver into the headline and `expect(b.count).toBe(1)` goes
// red; that is the whole point of shipping it.
//
// The other suites prove the supporting invariants: shared-path memo (one computed per path), leak-free
// teardown (SPEC-N3), and the placeholder + parent/child waking semantics (SPEC-R4 AC2 / R5 / N2).

import { describe, it, expect } from 'vitest'
import { effect, inspect, whenFlushed } from '@agent-ui/components'
import { createSurface, disposeSurface } from './surface.ts'
import type { Surface } from './surface.ts'
import { resolve, setPointer } from './binding.ts'

const init = { id: 's1', catalogId: 'demo', version: 'v1.0' }

/** A bound prop, modelled exactly as widget.ts `bindProp`: a `surface.scope`-owned effect that calls a
 *  resolver and counts each application. `value` mirrors the last resolved value; `count` is how many
 *  times the prop was (re-)applied — so an unwoken binding's `count` simply does not advance. */
interface Counter {
  count: number
  value: unknown
}

type Resolver = (binding: { path: string }, surface: Surface) => unknown

function bindCounting(surface: Surface, path: string, resolver: Resolver = resolve): Counter {
  const counter: Counter = { count: 0, value: undefined }
  surface.scope.run(() => {
    effect(() => {
      counter.value = resolver({ path }, surface)
      counter.count++
    })
  })
  return counter
}

/** The COARSE interim resolver (the negative control): reads the WHOLE data signal directly, so the
 *  bound-prop effect subscribes to `surface.data` itself — every write wakes every binding. Top-level
 *  key only, which is all `/a` `/b` need. */
const resolveCoarse: Resolver = (binding, surface) =>
  (surface.data.value as Record<string, unknown> | undefined)?.[binding.path.slice(1)]

describe('per-path waking (SPEC-N2) — the headline', () => {
  it('a write to /a wakes only /a; the disjoint /b binding stays asleep', async () => {
    const s = createSurface(init)
    s.data.value = { a: 1, b: 2 }
    const a = bindCounting(s, '/a')
    const b = bindCounting(s, '/b')
    expect(a.count).toBe(1) // mount applies each prop once
    expect(b.count).toBe(1)
    expect(a.value).toBe(1)
    expect(b.value).toBe(2)

    s.data.value = setPointer(s.data.peek(), '/a', 99)
    await whenFlushed()
    expect(a.value).toBe(99)
    expect(a.count).toBe(2) // /a re-applied
    expect(b.count).toBe(1) // /b UNCHANGED — the per-path-waking invariant (SPEC-N2)

    // Control arm: a /b write DOES wake /b. This proves the harness can detect a wake at all, so the
    // `/b unchanged` assertion above is meaningful rather than impossible-to-fail.
    s.data.value = setPointer(s.data.peek(), '/b', 88)
    await whenFlushed()
    expect(b.value).toBe(88)
    expect(b.count).toBe(2)
    expect(a.count).toBe(2) // /a now asleep
  })

  it('negative control: the memo-bypassing resolver wakes the sibling (the assertion can go red)', async () => {
    const s = createSurface(init)
    s.data.value = { a: 1, b: 2 }
    const a = bindCounting(s, '/a', resolveCoarse)
    const b = bindCounting(s, '/b', resolveCoarse)
    expect(a.count).toBe(1)
    expect(b.count).toBe(1)

    s.data.value = setPointer(s.data.peek(), '/a', 99)
    await whenFlushed()
    expect(a.count).toBe(2)
    // Both effects subscribe to surface.data itself, so a /a write wakes /b too: b.count advances to 2.
    // Drop `resolveCoarse` into the headline above and `expect(b.count).toBe(1)` turns RED — the proof
    // that per-path waking is real, not vacuous.
    expect(b.count).toBe(2)
  })
})

describe('shared-path memo — one computed per path (renderer LLD-C5)', () => {
  it('two bindings to the same path share ONE computed over surface.data', async () => {
    const s = createSurface(init)
    s.data.value = { x: 'hi' }
    const w1 = bindCounting(s, '/x')
    const w2 = bindCounting(s, '/x')
    expect(w1.value).toBe('hi')
    expect(w2.value).toBe('hi')
    // One shared computed ⇒ surface.data carries exactly ONE subscriber for /x, not one per binding;
    // a data change therefore drives a single pointer walk for the path, not two.
    expect(inspect(s.data).subscribers).toBe(1)

    s.data.value = setPointer(s.data.peek(), '/x', 'bye')
    await whenFlushed()
    expect(w1.value).toBe('bye')
    expect(w2.value).toBe('bye')
    expect(w1.count).toBe(2)
    expect(w2.count).toBe(2)
    expect(inspect(s.data).subscribers).toBe(1) // still one computed after the change
  })
})

describe('leak-free teardown (SPEC-N3)', () => {
  it('the data signal carries one subscriber per distinct path, then zero after disposeSurface', () => {
    const s = createSurface(init)
    s.data.value = { a: 1, b: 2, c: 3 }
    bindCounting(s, '/a')
    bindCounting(s, '/b')
    bindCounting(s, '/c')
    bindCounting(s, '/a') // a second /a binding reuses the existing computed — adds no subscriber
    expect(inspect(s.data).subscribers).toBe(3) // distinct paths: /a /b /c

    disposeSurface(s)
    expect(inspect(s.data).subscribers).toBe(0) // scope.dispose() disposed every path computed + effect
  })
})

describe('placeholder + parent/child semantics (SPEC-R4 AC2 / R5 / N2)', () => {
  it('an undefined path resolves to undefined, then updates when its data arrives', async () => {
    const s = createSurface(init)
    s.data.value = {}
    const w = bindCounting(s, '/missing')
    expect(w.value).toBeUndefined() // placeholder, R4 AC2
    expect(w.count).toBe(1)

    s.data.value = setPointer(s.data.peek(), '/missing', 5)
    await whenFlushed()
    expect(w.value).toBe(5) // R5 AC1
    expect(w.count).toBe(2)
  })

  it('a child write wakes the parent + child bindings but not a sibling', async () => {
    const s = createSurface(init)
    s.data.value = { user: { name: 'Ada' }, other: { k: 'v' } }
    const parent = bindCounting(s, '/user')
    const child = bindCounting(s, '/user/name')
    const sibling = bindCounting(s, '/other')
    expect(parent.count).toBe(1)
    expect(child.count).toBe(1)
    expect(sibling.count).toBe(1)

    s.data.value = setPointer(s.data.peek(), '/user/name', 'Bea')
    await whenFlushed()
    expect(child.value).toBe('Bea')
    expect(parent.count).toBe(2) // /user re-resolved — its subtree was copied along the path
    expect(child.count).toBe(2)
    expect(sibling.count).toBe(1) // /other's subtree kept its reference (structural sharing) → asleep
  })

  it('a whole-model replace (path omitted) re-resolves every bound path', async () => {
    const s = createSurface(init)
    s.data.value = { a: 1, b: 2 }
    const a = bindCounting(s, '/a')
    const b = bindCounting(s, '/b')
    expect(a.count).toBe(1)
    expect(b.count).toBe(1)

    s.data.value = { a: 10, b: 20 } // updateDataModel with no path → whole-document replace
    await whenFlushed()
    expect(a.value).toBe(10)
    expect(b.value).toBe(20)
    expect(a.count).toBe(2)
    expect(b.count).toBe(2)
  })
})

describe('list-item scope resolution (renderer LLD-C6 / ADR-0024)', () => {
  it('a RELATIVE path resolves within the item scope to {path}/{index}/…; an ABSOLUTE one to root', () => {
    const s = createSurface(init)
    s.data.value = { title: 'ROOT', items: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] }

    // Relative (no leading `/`): resolves to /items/{index}/label.
    expect(resolve({ path: 'label' }, s, { path: '/items', index: 0 })).toBe('a')
    expect(resolve({ path: 'label' }, s, { path: '/items', index: 2 })).toBe('c')
    // Empty relative path = the item itself (/items/{index}).
    expect(resolve({ path: '' }, s, { path: '/items', index: 1 })).toEqual({ label: 'b' })
    // Absolute (leading `/`): resolves from root REGARDLESS of the item scope.
    expect(resolve({ path: '/title' }, s, { path: '/items', index: 2 })).toBe('ROOT')
  })

  it('the per-path memo distinguishes indices because it keys on the RESOLVED absolute pointer', async () => {
    const s = createSurface(init)
    s.data.value = { items: [{ label: 'a' }, { label: 'b' }] }
    // Two bindings to the SAME relative path but DIFFERENT item indices → two distinct computeds.
    const i0 = bindCounting(s, 'label', (b, surf) => resolve(b, surf, { path: '/items', index: 0 }))
    const i1 = bindCounting(s, 'label', (b, surf) => resolve(b, surf, { path: '/items', index: 1 }))
    expect(i0.value).toBe('a')
    expect(i1.value).toBe('b')
    expect(inspect(s.data).subscribers).toBe(2) // /items/0/label and /items/1/label — NOT one shared computed

    // A write to /items/1/label wakes only the index-1 binding (per-path waking holds across item scopes).
    s.data.value = setPointer(s.data.peek(), '/items/1/label', 'B')
    await whenFlushed()
    expect(i1.value).toBe('B')
    expect(i1.count).toBe(2)
    expect(i0.count).toBe(1) // index-0 binding stayed asleep
  })

  it('with NO item scope a relative path resolves to undefined (pre-list behavior preserved)', () => {
    const s = createSurface(init)
    s.data.value = { label: 'x' }
    expect(resolve({ path: 'label' }, s)).toBeUndefined() // no leading slash, no scope → undefined
    expect(resolve({ path: '' }, s)).toEqual({ label: 'x' }) // '' is still whole-doc when unscoped
  })
})
