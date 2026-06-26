import { describe, it, expect } from 'vitest'
import { computed, effect, inspect } from '@agent-ui/components'
import { createSurface, disposeSurface, SurfaceStore } from './surface.ts'

const init = { id: 's1', catalogId: 'demo', version: 'v1.0' }

describe('surface model (renderer LLD-C3, SPEC-R2)', () => {
  it('stands up a surface with scope, AbortController, one data signal, and empty buffers', () => {
    const s = createSurface(init)
    expect(s.id).toBe('s1')
    expect(s.catalogId).toBe('demo')
    expect(s.version).toBe('v1.0')
    expect(s.sendDataModel).toBe(false) // default
    expect(s.components.size).toBe(0)
    expect(s.widgets.size).toBe(0)
    expect(s.ac.signal.aborted).toBe(false)
    expect(s.data.peek()).toBeUndefined()
  })

  it('carries sendDataModel + surfaceProperties when provided', () => {
    const s = createSurface({ ...init, sendDataModel: true, surfaceProperties: { density: 'compact' } })
    expect(s.sendDataModel).toBe(true)
    expect(s.surfaceProperties).toEqual({ density: 'compact' })
  })

  it('data is one signal: a computed over it re-resolves when the model changes (SPEC-R5/N2)', () => {
    const s = createSurface(init)
    let name!: ReturnType<typeof computed<unknown>>
    s.scope.run(() => {
      name = computed(() => (s.data.value as { user?: { name?: string } } | undefined)?.user?.name)
    })
    expect(name.value).toBeUndefined()
    s.data.value = { user: { name: 'Ada' } }
    expect(name.value).toBe('Ada')
  })
})

describe('leak-free teardown (SPEC-N3)', () => {
  it('disposeSurface unsubscribes every scope-owned binding → 0 subscribers on the data signal', () => {
    const s = createSurface(init)
    // A binding effect (LLD-C5 shape) created inside the surface scope subscribes to data.
    s.scope.run(() => effect(() => void (s.data.value as unknown)))
    expect(inspect(s.data).subscribers).toBe(1)

    disposeSurface(s)
    expect(inspect(s.data).subscribers).toBe(0) // scope.dispose() removed the subscriber
  })

  it('disposeSurface aborts the controller → listeners registered with its signal are removed', () => {
    const s = createSurface(init)
    const target = document.createElement('div')
    let fired = 0
    target.addEventListener('input', () => void fired++, { signal: s.ac.signal })

    target.dispatchEvent(new Event('input'))
    expect(fired).toBe(1) // listener live

    disposeSurface(s)
    expect(s.ac.signal.aborted).toBe(true)
    target.dispatchEvent(new Event('input'))
    expect(fired).toBe(1) // abort removed the listener — no further increment
  })
})

describe('SurfaceStore (keyed create/delete, SPEC-R2)', () => {
  it('creates, gets, and deletes by id', () => {
    const store = new SurfaceStore()
    const s = store.create(init)
    expect(store.has('s1')).toBe(true)
    expect(store.get('s1')).toBe(s)
    expect(store.size).toBe(1)

    expect(store.delete('s1')).toBe(true)
    expect(store.has('s1')).toBe(false)
    expect(store.size).toBe(0)
  })

  it('delete of an unknown id is a no-op (late message tolerance)', () => {
    const store = new SurfaceStore()
    expect(store.delete('ghost')).toBe(false)
  })

  it('store.delete tears the surface down (N3: 0 subscribers afterward)', () => {
    const store = new SurfaceStore()
    const s = store.create(init)
    s.scope.run(() => effect(() => void (s.data.value as unknown)))
    expect(inspect(s.data).subscribers).toBe(1)

    store.delete('s1')
    expect(inspect(s.data).subscribers).toBe(0)
    expect(s.ac.signal.aborted).toBe(true)
  })

  it('re-creating an existing id disposes the prior surface (no leak)', () => {
    const store = new SurfaceStore()
    const first = store.create(init)
    first.scope.run(() => effect(() => void (first.data.value as unknown)))
    expect(inspect(first.data).subscribers).toBe(1)

    store.create(init) // same id → prior disposed
    expect(inspect(first.data).subscribers).toBe(0)
    expect(first.ac.signal.aborted).toBe(true)
    expect(store.size).toBe(1)
  })

  it('disposeAll releases every surface', () => {
    const store = new SurfaceStore()
    store.create({ ...init, id: 'a' })
    store.create({ ...init, id: 'b' })
    expect(store.size).toBe(2)
    store.disposeAll()
    expect(store.size).toBe(0)
  })
})
