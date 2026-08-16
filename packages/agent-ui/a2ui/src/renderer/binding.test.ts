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
import { resolve, setPointer, mutate } from './binding.ts'

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

describe('mutate() — draft-first authoring ergonomics over setPointer (GH #976)', () => {
  it('a top-level assignment produces the SAME result as a hand-written setPointer', () => {
    const doc = { count: 1, other: 'unchanged' }
    const hand = setPointer(doc, '/count', 2)
    const drafted = mutate(doc, '', (draft: { count: number }) => {
      draft.count = 2
    })
    expect(drafted).toEqual(hand)
  })

  it('a nested assignment emits the same absolute-pointer write as hand-writing setPointer', () => {
    const doc = { user: { name: 'Ada', age: 30 }, other: { k: 'v' } }
    const hand = setPointer(doc, '/user/name', 'Bea')
    const drafted = mutate(doc, '', (draft: { user: { name: string } }) => {
      draft.user.name = 'Bea'
    })
    expect(drafted).toEqual(hand)
  })

  it('structural sharing holds: an untouched sibling subtree keeps its reference identity', () => {
    const doc = { user: { name: 'Ada' }, other: { k: 'v' } }
    const drafted = mutate(doc, '', (draft: { user: { name: string } }) => {
      draft.user.name = 'Bea'
    }) as typeof doc
    expect(drafted.other).toBe(doc.other) // never touched by the recipe → same reference (Object.is holds)
    expect(drafted.user).not.toBe(doc.user) // the written path was copied along the way
  })

  it('per-path waking still holds off a mutate()-produced write (the binding mechanism is unchanged)', async () => {
    const s = createSurface(init)
    s.data.value = { user: { name: 'Ada' }, other: { k: 'v' } }
    const child = bindCounting(s, '/user/name')
    const sibling = bindCounting(s, '/other')
    expect(child.count).toBe(1)
    expect(sibling.count).toBe(1)

    s.data.value = mutate(s.data.peek(), '', (draft: { user: { name: string } }) => {
      draft.user.name = 'Bea'
    })
    await whenFlushed()
    expect(child.value).toBe('Bea')
    expect(child.count).toBe(2)
    expect(sibling.count).toBe(1) // /other's subtree kept its reference → asleep, exactly as a hand-written setPointer
  })

  it('read-after-write: the recipe sees its own prior write through the draft', () => {
    const doc = { count: 1 }
    const drafted = mutate(doc, '', (draft: { count: number }) => {
      draft.count = draft.count + 1
      draft.count = draft.count + 1
    }) as typeof doc
    expect(drafted.count).toBe(3)
  })

  it('multiple assignments in one recipe replay in order — last write to a path wins', () => {
    const doc = { a: 1, b: 1 }
    const drafted = mutate(doc, '', (draft: { a: number; b: number }) => {
      draft.a = 2
      draft.b = 9
      draft.a = 3
    }) as typeof doc
    expect(drafted).toEqual({ a: 3, b: 9 })
  })

  it('a missing base path materializes an empty draft object, matching setPointer', () => {
    const doc = {}
    const hand = setPointer(doc, '/user/name', 'Ada')
    const drafted = mutate(doc, '/user', (draft: { name: string }) => {
      draft.name = 'Ada'
    })
    expect(drafted).toEqual(hand)
  })

  it('mutating a subtree path prefixes recorded writes with that base pointer', () => {
    const doc = { user: { name: 'Ada', age: 30 }, other: 1 }
    const drafted = mutate(doc, '/user', (draft: { age: number }) => {
      draft.age = 31
    }) as typeof doc
    expect(drafted).toEqual({ user: { name: 'Ada', age: 31 }, other: 1 })
    expect(drafted.other).toBe(doc.other)
  })

  it('a whole-subtree reassignment records one write at that path, not per-field', () => {
    const doc = { user: { name: 'Ada' }, other: 'x' }
    const drafted = mutate(doc, '', (draft: { user: { name: string } }) => {
      draft.user = { name: 'Zoe' }
    }) as typeof doc
    expect(drafted).toEqual({ user: { name: 'Zoe' }, other: 'x' })
  })

  it('an untouched recipe (no assignments) returns the doc unchanged (no-op writes)', () => {
    const doc = { a: 1 }
    const drafted = mutate(doc, '', () => {})
    expect(drafted).toBe(doc) // reduce over zero writes short-circuits to the original reference
  })

  it('an array-index assignment matches hand-written setPointer', () => {
    const doc = { items: ['a', 'b', 'c'] }
    const hand = setPointer(doc, '/items/1', 'B')
    const drafted = mutate(doc, '', (draft: { items: string[] }) => {
      draft.items[1] = 'B'
    })
    expect(drafted).toEqual(hand)
  })

  it('RFC-6901 tokens containing "/" and "~" round-trip through encodeToken exactly like a hand-written pointer', () => {
    const doc: Record<string, unknown> = { 'a/b': { 'c~d': 1 } }
    const hand = setPointer(doc, '/a~1b/c~0d', 2)
    const drafted = mutate(doc, '', (draft: Record<string, Record<string, number>>) => {
      draft['a/b']!['c~d'] = 2
    })
    expect(drafted).toEqual(hand)
  })

  describe('draft-leak prevention (review finding, GH #976) — no live Proxy or stale reference ever reaches the returned doc', () => {
    it('the documented spread idiom keeps untouched elements reference-identical, never a leaked Proxy', () => {
      const item0 = { id: 0 }
      const item1 = { id: 1 }
      const doc = { items: [item0, item1] }
      const drafted = mutate(doc, '', (draft: { items: Array<{ id: number }> }) => {
        draft.items = [...draft.items, { id: 2 }]
      }) as typeof doc
      expect(drafted.items).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }])
      expect(drafted.items[0]).toBe(item0) // untouched element keeps its ORIGINAL reference — no Proxy, no clone
      expect(drafted.items[1]).toBe(item1)
      expect(typeof drafted.items[0]).not.toBe('function') // sanity: a Proxy over an object still reports 'object'
      expect(Object.getPrototypeOf(drafted.items[0])).toBe(Object.prototype) // a real plain object, not a Proxy wrapper artifact
    })

    it('aliasing an untouched draft read (`draft.b = draft.a`) records the ORIGINAL reference, not a Proxy', () => {
      const a = { x: 1 }
      const doc = { a, b: null as unknown }
      const hand = setPointer(doc, '/b', a)
      const drafted = mutate(doc, '', (draft: { a: { x: number }; b: unknown }) => {
        draft.b = draft.a
      }) as typeof doc
      expect(drafted).toEqual(hand)
      expect(drafted.b).toBe(a)
    })

    it('spreading a nested draft (`{...draft.user}`) unwraps its own nested proxy properties too', () => {
      const addr = { city: 'Oslo' }
      const doc = { user: { name: 'Ada', addr } }
      const drafted = mutate(doc, '', (draft: { user: { name: string; addr: { city: string } }; copy?: unknown }) => {
        ;(draft as { copy?: unknown }).copy = { ...draft.user }
      }) as typeof doc & { copy: { name: string; addr: { city: string } } }
      expect(drafted.copy).toEqual({ name: 'Ada', addr: { city: 'Oslo' } })
      expect(drafted.copy.addr).toBe(addr) // the nested, never-written 'addr' keeps its original identity
    })

    it('embedding a DIRTIED nested draft snapshots it — a later write to that path never retroactively mutates the earlier record', () => {
      const doc = { a: { x: 1 }, copy: null as unknown }
      const drafted = mutate(doc, '', (draft: { a: { x: number }; copy: unknown }) => {
        draft.a.x = 1 // dirties the 'a' proxy
        draft.copy = draft.a // records a snapshot of 'a' as it stands right now (x: 1)
        draft.a.x = 2 // a LATER write to 'a' — must not retroactively change the already-recorded '/copy' write
      }) as typeof doc & { a: { x: number }; copy: { x: number } }
      expect(drafted.a.x).toBe(2)
      expect(drafted.copy.x).toBe(1) // the snapshot taken at record time, unaffected by the later write
    })
  })

  describe('array mutator methods and delete are refused, never silently applied (review finding, GH #976)', () => {
    it('push() throws instead of silently corrupting the array with a bogus numeric-string key', () => {
      const doc = { items: ['a', 'b'] }
      expect(() =>
        mutate(doc, '', (draft: { items: string[] }) => {
          draft.items.push('c')
        }),
      ).toThrow(TypeError)
    })

    it('a direct length write throws instead of silently truncating/corrupting', () => {
      const doc = { items: ['a', 'b'] }
      expect(() =>
        mutate(doc, '', (draft: { items: string[] }) => {
          draft.items.length = 0
        }),
      ).toThrow(TypeError)
    })

    it('delete throws rather than silently vanishing from the recorded write set', () => {
      const doc: Record<string, unknown> = { a: 1, b: 2 }
      expect(() =>
        mutate(doc, '', (draft: Record<string, unknown>) => {
          delete draft.a
        }),
      ).toThrow(TypeError)
    })

    it('a relative (non-absolute, non-empty) base path throws instead of silently resolving to a stray key', () => {
      const doc = { user: { name: 'Ada' } }
      expect(() => mutate(doc, 'user', (draft: { name: string }) => (draft.name = 'Bea'))).toThrow(TypeError)
    })
  })
})
