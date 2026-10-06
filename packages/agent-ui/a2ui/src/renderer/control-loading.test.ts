// control-loading.test.ts: the renderer's deferred apply behind a catalog's `controls` loader (ADR-0233).
//
// Vacuity rule: every scenario here uses `x-ctl-probe-*` fixture tags from a fixture catalog registered
// through `Renderer.register`, served by a loader over fixture records whose `load()` waits on a test-held
// gate and then defines the tag (or rejects), so the test controls when a load settles. Each scenario first
// asserts its probe tags are undefined. The built-in catalogs' own loader is `builtin-controls.test.ts`.

import { describe, it, expect, vi } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { createControlLoader } from '@agent-ui/components/loader'
import type { ControlLoader, ControlRecord } from '@agent-ui/components/loader'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, A2uiErrorMessage, RendererHost } from './renderer.ts'
import type { A2uiServerMessage } from '../protocol.ts'
import type { WidgetFactory } from '../catalog/types.ts'

const line = (message: A2uiServerMessage): string => JSON.stringify(message)
const isError = (m: A2uiClientMessage): m is A2uiErrorMessage => 'error' in m
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

interface Gate {
  readonly promise: Promise<void>
  resolve(): void
  reject(error: unknown): void
}

function gate(): Gate {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  promise.catch(() => {}) // a rejected gate nobody awaits is not an unhandled rejection
  return { promise, resolve, reject }
}

/** A fixture record whose `load()` waits on `g`, then defines `tag`. */
function gatedRecord(tag: string, g: Gate): ControlRecord {
  return {
    tag,
    load: async () => {
      await g.promise
      if (customElements.get(tag) === undefined) customElements.define(tag, class extends HTMLElement {})
    },
  }
}

/**
 * One probe fixture: a catalog with a container `Box` and a `Leaf` (static or bound `label`), factories
 * creating `x-ctl-probe-{name}-box` and `-leaf`, a log of every applied label, and a loader over gated
 * records (`ensure` spied).
 */
function probe(name: string, options: { loader?: boolean } = {}) {
  const box = `x-ctl-probe-${name}-box`
  const leaf = `x-ctl-probe-${name}-leaf`
  const g = gate()
  const applied: unknown[] = []
  const catalog = {
    catalogId: `probe-${name}`,
    protocolVersion: 'v1.0',
    components: {
      Box: { properties: {}, children: 'ChildList' },
      Leaf: { properties: { label: { type: { type: 'string' }, bindable: true, mapsTo: 'textContent' } } },
    },
    functions: {},
  }
  const factories: Record<string, WidgetFactory> = {
    Box: { tag: box, create: () => document.createElement(box), applyProp: () => {} },
    Leaf: {
      tag: leaf,
      create: () => document.createElement(leaf),
      applyProp: (el, prop, value) => {
        if (prop !== 'label') return
        applied.push(value)
        el.textContent = value === undefined ? '' : String(value)
      },
    },
  }
  const loader: ControlLoader | undefined =
    options.loader === false ? undefined : createControlLoader({ [box]: gatedRecord(box, g), [leaf]: gatedRecord(leaf, g) }, { css: 'host' })
  const ensure = loader !== undefined ? vi.spyOn(loader, 'ensure') : undefined
  return { box, leaf, gate: g, applied, catalog, factories, loader, ensure }
}

type Probe = ReturnType<typeof probe>

function host(...probes: Probe[]): { r: RendererHost; mount: HTMLElement; sent: A2uiClientMessage[]; cleanup: () => void } {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer({ newId: () => 'act-1', now: () => '2026-10-05T00:00:00.000Z' })
  for (const p of probes) r.register(p.catalog, p.factories, undefined, p.loader)
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  return { r, mount, sent, cleanup: () => { r.dispose(); mount.remove() } }
}

const create = (r: RendererHost, surfaceId: string, p: Probe): void =>
  r.ingest(line({ version: 'v1.0', createSurface: { surfaceId, catalogId: p.catalog.catalogId } }))

const components = (r: RendererHost, surfaceId: string, list: Record<string, unknown>[]): void =>
  r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId, components: list as never } }))

const assertUndefined = (...tags: string[]): void => {
  for (const tag of tags) expect(customElements.get(tag)).toBeUndefined()
}

describe('renderer deferred apply behind a catalog control loader (ADR-0233)', () => {
  it('applies synchronously, with no ensure call, when no tag is missing', async () => {
    const p = probe('sync')
    assertUndefined(p.box, p.leaf)
    p.gate.resolve()
    await p.loader!.ensure([p.box, p.leaf]) // define both up front
    p.ensure!.mockClear()
    const { r, mount, sent, cleanup } = host(p)

    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a'] },
      { id: 'a', component: 'Leaf', label: 'now' },
    ])

    expect(mount.querySelector(p.leaf)?.textContent).toBe('now') // same tick: no deferral
    expect(p.ensure).not.toHaveBeenCalled()
    expect(sent.filter(isError)).toEqual([])
    cleanup()
  })

  it('defers a message whose tags are missing, keeps one ensure in flight, and drains the queue in order', async () => {
    const p = probe('defer')
    assertUndefined(p.box, p.leaf)
    const { r, mount, sent, cleanup } = host(p)

    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a', 'b'] },
      { id: 'a', component: 'Leaf', label: 'first' },
    ])
    components(r, 's', [{ id: 'b', component: 'Leaf', label: 'second' }])

    expect(mount.children).toHaveLength(0) // nothing created before the tags are defined
    expect(p.ensure).toHaveBeenCalledTimes(1)
    expect([...p.ensure!.mock.calls[0]![0]].sort()).toEqual([p.box, p.leaf].sort())
    assertUndefined(p.box, p.leaf)

    p.gate.resolve()
    await settle()

    expect(p.applied).toEqual(['first', 'second']) // message order
    expect([...mount.querySelectorAll(p.leaf)].map((el) => el.textContent)).toEqual(['first', 'second'])
    expect(mount.querySelector(p.box)).toBeInstanceOf(customElements.get(p.box)!)
    expect(p.ensure).toHaveBeenCalledTimes(1)
    expect(sent.filter(isError)).toEqual([])

    components(r, 's', [{ id: 'b', component: 'Leaf', label: 'third' }]) // queue empty, tags defined: sync again
    expect(p.applied.at(-1)).toBe('third')
    expect(p.ensure).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('re-checks missing per queued message and ensures again for a later message that needs a new tag', async () => {
    const p = probe('recheck')
    const extra = 'x-ctl-probe-recheck-extra'
    const extraGate = gate()
    assertUndefined(p.box, p.leaf, extra)
    const loader = createControlLoader(
      { [p.box]: gatedRecord(p.box, p.gate), [p.leaf]: gatedRecord(p.leaf, p.gate), [extra]: gatedRecord(extra, extraGate) },
      { css: 'host' },
    )
    const ensure = vi.spyOn(loader, 'ensure')
    const catalog = { ...p.catalog, components: { ...p.catalog.components, Extra: { properties: {} } } }
    const factories = { ...p.factories, Extra: { tag: extra, create: () => document.createElement(extra), applyProp: () => {} } }
    const { r, mount, cleanup } = host()
    r.register(catalog, factories, undefined, loader)

    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a', 'x'] },
      { id: 'a', component: 'Leaf', label: 'first' },
    ])
    components(r, 's', [{ id: 'x', component: 'Extra' }])
    expect(ensure).toHaveBeenCalledTimes(1)

    p.gate.resolve()
    await settle()
    expect(p.applied).toEqual(['first']) // the first message drained
    expect(mount.querySelector(extra)).toBeNull() // the second waits on its own tag
    expect(ensure).toHaveBeenCalledTimes(2)
    expect([...ensure.mock.calls[1]![0]]).toEqual([extra])

    extraGate.resolve()
    await settle()
    expect(mount.querySelector(extra)).toBeInstanceOf(customElements.get(extra)!)
    cleanup()
  })

  it('queues updateDataModel and finalize behind a pending surface', async () => {
    const p = probe('queued')
    assertUndefined(p.box, p.leaf)
    const { r, mount, sent, cleanup } = host(p)

    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a'] },
      { id: 'a', component: 'Leaf', label: { path: '/name' } },
    ])
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 's', path: '/name', value: 'late' } }))
    r.finalize('s')
    r.finalize()

    expect(sent.filter(isError)).toEqual([]) // finalize did not judge the empty component set
    expect(p.applied).toEqual([])

    p.gate.resolve()
    await settle()
    await whenFlushed()

    // The components applied before the data model: the bound label first resolved to nothing, then `late`.
    expect(p.applied).toEqual([undefined, 'late'])
    expect(mount.querySelector(p.leaf)?.textContent).toBe('late')
    expect(sent.filter(isError)).toEqual([]) // the queued finalizes saw the complete set (root present)
    cleanup()
  })

  it('deleteSurface while pending tears down and drops the queue; the late resolution is a no-op', async () => {
    const p = probe('delete')
    assertUndefined(p.box, p.leaf)
    const { r, mount, sent, cleanup } = host(p)

    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a'] },
      { id: 'a', component: 'Leaf', label: 'old' },
    ])
    r.ingest(line({ version: 'v1.0', deleteSurface: { surfaceId: 's' } }))
    expect(mount.children).toHaveLength(0)

    // A fresh surface at the same id, while the old load is still pending, starts its own queue.
    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a'] },
      { id: 'a', component: 'Leaf', label: 'new' },
    ])

    p.gate.resolve()
    await settle()
    expect(p.applied).toEqual(['new']) // the dropped queue's 'old' message never applies
    expect(mount.querySelector(p.leaf)?.textContent).toBe('new')
    expect(sent.filter(isError)).toEqual([])
    cleanup()
  })

  it('dispose while pending drops every queue; a late resolve or reject is a no-op', async () => {
    const ok = probe('dispose-ok')
    const bad = probe('dispose-bad')
    assertUndefined(ok.box, ok.leaf, bad.box, bad.leaf)
    const { r, mount, sent, cleanup } = host(ok, bad)

    create(r, 'a', ok)
    components(r, 'a', [{ id: 'root', component: 'Box', children: [] }])
    create(r, 'b', bad)
    components(r, 'b', [{ id: 'root', component: 'Box', children: [] }])
    r.dispose()

    ok.gate.resolve()
    bad.gate.reject(new Error('boom'))
    await settle()
    expect(mount.children).toHaveLength(0)
    expect(sent).toEqual([])
    cleanup()
  })

  it('on reject emits CONTROL_LOAD once for the surface and renders the still-undefined nodes as placeholders', async () => {
    const p = probe('reject')
    assertUndefined(p.box, p.leaf)
    const { r, mount, sent, cleanup } = host(p)

    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a', 'b'] },
      { id: 'a', component: 'Leaf', label: 'first' },
    ])
    components(r, 's', [{ id: 'b', component: 'Leaf', label: 'second' }])

    p.gate.reject(new Error('network down'))
    await settle()

    const errors = sent.filter(isError)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error.code).toBe('VALIDATION_FAILED')
    expect((errors[0]!.error as { surfaceId?: string }).surfaceId).toBe('s')
    expect(errors[0]!.error.message).toContain('controls failed to load')
    expect(errors[0]!.error.message).toContain('network down')

    const placeholders = [...mount.querySelectorAll('a2ui-placeholder')]
    expect(placeholders.map((el) => [el.getAttribute('data-id'), el.getAttribute('data-component')])).toEqual([
      ['root', 'Box'],
      ['a', 'Leaf'],
      ['b', 'Leaf'],
    ])
    expect(mount.querySelector(p.box)).toBeNull()
    expect(mount.querySelector(p.leaf)).toBeNull()
    expect(p.applied).toEqual([]) // placeholders stay inert
    assertUndefined(p.box, p.leaf)
    cleanup()
  })

  it('another surface is never delayed by a pending one', async () => {
    const slow = probe('slow')
    const other = probe('other', { loader: false })
    assertUndefined(slow.box, slow.leaf, other.box, other.leaf)
    customElements.define(other.box, class extends HTMLElement {})
    customElements.define(other.leaf, class extends HTMLElement {})
    const { r, mount, cleanup } = host(slow, other)

    create(r, 's1', slow)
    components(r, 's1', [{ id: 'root', component: 'Box', children: [] }])
    create(r, 's2', other)
    components(r, 's2', [
      { id: 'root', component: 'Box', children: ['a'] },
      { id: 'a', component: 'Leaf', label: 'free' },
    ])

    expect(mount.querySelector('[data-a2ui-surface="s2"]')).not.toBeNull() // s2 rendered in the same tick
    expect(other.applied).toEqual(['free'])
    expect(mount.querySelector('[data-a2ui-surface="s1"]')).toBeNull()

    slow.gate.resolve()
    await settle()
    expect(mount.querySelector('[data-a2ui-surface="s1"]')).not.toBeNull()
    cleanup()
  })

  it('a catalog without a loader applies synchronously, creating even an undefined element, as before', () => {
    const p = probe('absent', { loader: false })
    assertUndefined(p.box, p.leaf)
    const { r, mount, sent, cleanup } = host(p)

    create(r, 's', p)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a'] },
      { id: 'a', component: 'Leaf', label: 'raw' },
    ])

    expect(mount.querySelector(p.leaf)?.textContent).toBe('raw')
    assertUndefined(p.box, p.leaf)
    expect(sent.filter(isError)).toEqual([])
    cleanup()
  })
})
