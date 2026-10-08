// catalog-loading.test.ts: the renderer's deferred apply behind a lazy catalog body (ADR-0241), the analog of
// `control-loading.test.ts` one gate earlier.
//
// Injection seam: `vi.mock` replaces `catalog/records.ts`, the renderer's one source of built-in records, with
// probe records whose `load()` waits on a test-held gate. The public surface stays `register` alone (ADR-0241
// cl.3: no public `registerLazy`). The loader memoizes a body module-wide by record, so every scenario that
// needs a pending load uses its own probe id. Probe bodies carry no control loader (so they apply
// synchronously once loaded and create their undefined `x-cat-probe-*` tags as is), except the one scenario
// that proves the catalog gate runs ahead of the control gate.

import { describe, it, expect, vi } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { createControlLoader } from '@agent-ui/components/loader'
import type { ControlRecord } from '@agent-ui/components/loader'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, A2uiErrorMessage, RendererHost } from './renderer.ts'
import { handleCallFunction } from './call-function.ts'
import type { A2uiErrorMessage as WireErrorMessage, A2uiFunctionResponseMessage, A2uiServerMessage } from '../protocol.ts'
import { Registry } from '../catalog/registry.ts'
import type { CatalogBody, CatalogRegistry, LazyCatalogRecord, WidgetFactory } from '../catalog/types.ts'

const probes = vi.hoisted(() => {
  interface Slot {
    gate: Promise<void>
    resolve(): void
    reject(error: unknown): void
    body: () => CatalogBody
    loads: number
  }
  const slots = new Map<string, Slot>()
  const record = (id: string, functions: LazyCatalogRecord['functions'] = {}): LazyCatalogRecord => ({
    id,
    functions,
    submitGate: [],
    load: () => {
      const slot = slots.get(id)!
      slot.loads += 1
      return slot.gate.then(() => slot.body())
    },
  })
  const PING_CLIENT_ONLY = { ping: { args: {}, returns: { type: 'string' }, callableFrom: 'clientOnly' as const } }
  const names = ['defer', 'unloaded', 'memo', 'reject', 'delete', 'dispose-ok', 'dispose-bad', 'controls', 'slow']
  return { slots, PING_CLIENT_ONLY, records: [...names.map((n) => record(`probe-${n}`)), record('probe-fn', PING_CLIENT_ONLY)] }
})

vi.mock('../catalog/records.ts', () => ({ BUILTIN_CATALOG_RECORDS: probes.records }))

const line = (message: A2uiServerMessage): string => JSON.stringify(message)
const isError = (m: A2uiClientMessage): m is A2uiErrorMessage => 'error' in m
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** A probe body: a `Box` container and a `Leaf` with a bindable `label`, logging every applied label. */
function fixture(name: string) {
  const box = `x-cat-probe-${name}-box`
  const leaf = `x-cat-probe-${name}-leaf`
  const applied: unknown[] = []
  const catalog = {
    catalogId: `probe-${name}`,
    protocolVersion: 'v1.0',
    components: {
      Box: { properties: {}, children: 'ChildList' },
      Leaf: { properties: { label: { type: { type: 'string' }, bindable: true, mapsTo: 'textContent' } } },
    },
    functions: name === 'fn' ? probes.PING_CLIENT_ONLY : {},
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
  return { box, leaf, applied, catalog, factories }
}

/** Arm probe `name`: a fresh gate (re-armed for a retry) and the body its record resolves to. */
function arm(name: string, body: (f: ReturnType<typeof fixture>) => CatalogBody = (f) => ({ catalog: f.catalog, factories: f.factories })) {
  const f = fixture(name)
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const gate = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  gate.catch(() => {}) // a rejected gate nobody else awaits is not an unhandled rejection
  const prior = probes.slots.get(`probe-${name}`)
  probes.slots.set(`probe-${name}`, { gate, resolve, reject, body: () => body(f), loads: prior?.loads ?? 0 })
  return { ...f, id: `probe-${name}`, slot: () => probes.slots.get(`probe-${name}`)! }
}

function host(): { r: RendererHost; mount: HTMLElement; sent: A2uiClientMessage[]; cleanup: () => void } {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer({ newId: () => 'act-1', now: () => '2026-10-07T00:00:00.000Z' })
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  return { r, mount, sent, cleanup: () => { r.dispose(); mount.remove() } }
}

const create = (r: RendererHost, surfaceId: string, catalogId: string): void =>
  r.ingest(line({ version: 'v1.0', createSurface: { surfaceId, catalogId } }))

const components = (r: RendererHost, surfaceId: string, list: Record<string, unknown>[]): void =>
  r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId, components: list as never } }))

describe('renderer deferred apply behind a lazy catalog body (ADR-0241)', () => {
  it('createSurface on a recorded id creates the surface at once, starts the load before any component, and drains in order', async () => {
    const p = arm('defer')
    const { r, mount, sent, cleanup } = host()

    create(r, 's', p.id)
    expect(p.slot().loads).toBe(1) // the fetch starts at createSurface, overlapping the model's first token
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a', 'b'] },
      { id: 'a', component: 'Leaf', label: { path: '/name' } },
    ])
    components(r, 's', [{ id: 'b', component: 'Leaf', label: 'second' }])
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 's', path: '/name', value: 'late' } }))
    r.finalize('s')

    expect(mount.children).toHaveLength(0) // nothing applied before the body loads
    expect(sent.filter(isError)).toEqual([]) // not CATALOG_UNKNOWN, and finalize did not judge an empty set

    p.slot().resolve()
    await settle()
    await whenFlushed()

    // Components in message order, then the data model: the bound label first resolved to nothing, then `late`.
    expect(p.applied).toEqual([undefined, 'second', 'late'])
    expect([...mount.querySelectorAll(p.leaf)].map((el) => el.textContent)).toEqual(['late', 'second'])
    expect(sent.filter(isError)).toEqual([]) // the queued finalize saw the complete set (root present)
    expect(p.slot().loads).toBe(1)
    cleanup()
  })

  it('an id neither registered nor recorded is CATALOG_UNKNOWN, synchronously, with no surface and no load', () => {
    const { r, mount, sent, cleanup } = host()
    create(r, 's', 'probe-never-recorded')
    components(r, 's', [{ id: 'root', component: 'Box', children: [] }])
    const errors = sent.filter(isError)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error.message).toContain('unknown catalogId "probe-never-recorded"')
    expect(mount.children).toHaveLength(0)
    cleanup()
  })

  it('a recorded id is known but not loaded: nothing loads until a surface or preload names it', async () => {
    const p = arm('unloaded')
    const { r, cleanup } = host()
    expect(p.slot().loads).toBe(0) // construction records the id; it fetches nothing
    const preloaded = r.preload(p.id)
    expect(p.slot().loads).toBe(1)
    p.slot().resolve()
    await expect(preloaded).resolves.toBeUndefined()
    await expect(r.preload('probe-never-recorded')).rejects.toThrow('no catalog record')
    cleanup()
  })

  it('once loaded the path is synchronous; the body loads once for every renderer, each registering it for itself', async () => {
    const p = arm('memo')
    const one = host()
    const two = host()
    p.slot().resolve()
    await one.r.preload(p.id)

    create(one.r, 's', p.id)
    components(one.r, 's', [{ id: 'root', component: 'Leaf', label: 'now' }])
    expect(one.mount.querySelector(p.leaf)?.textContent).toBe('now') // same tick: no deferral

    // The second renderer's registry has not registered the body yet: it defers, then reuses the one load.
    create(two.r, 's', p.id)
    components(two.r, 's', [{ id: 'root', component: 'Leaf', label: 'later' }])
    expect(two.mount.querySelector(p.leaf)).toBeNull()
    await settle()
    expect(two.mount.querySelector(p.leaf)?.textContent).toBe('later')
    expect(p.slot().loads).toBe(1)
    expect([...one.sent, ...two.sent].filter(isError)).toEqual([])
    one.cleanup()
    two.cleanup()
  })

  it('a failed load emits one CATALOG_LOAD per surface, drops its queued messages, removes the surface; a later createSurface retries', async () => {
    const p = arm('reject')
    const { r, mount, sent, cleanup } = host()

    create(r, 's1', p.id)
    components(r, 's1', [{ id: 'root', component: 'Leaf', label: 'one' }])
    r.finalize('s1')
    create(r, 's2', p.id)
    components(r, 's2', [{ id: 'root', component: 'Leaf', label: 'two' }])
    p.slot().reject(new Error('chunk offline'))
    await settle()

    const errors = sent.filter(isError)
    expect(errors.map((m) => [m.error.code, (m.error as { surfaceId?: string }).surfaceId])).toEqual([
      ['VALIDATION_FAILED', 's1'],
      ['VALIDATION_FAILED', 's2'],
    ])
    for (const m of errors) {
      expect(m.error.message).toContain(`catalog "${p.id}" failed to load`)
      expect(m.error.message).toContain('chunk offline')
    }
    expect(mount.children).toHaveLength(0)
    expect(p.applied).toEqual([]) // the queued messages were dropped, not drained into the unknown-type path

    // The surface is gone, so a late message for it is a no-op, exactly as after CATALOG_UNKNOWN.
    components(r, 's1', [{ id: 'root', component: 'Leaf', label: 'late' }])
    r.finalize('s1')
    expect(sent.filter(isError)).toHaveLength(2)

    // The rejected load left the memo: the next surface retries it.
    const retry = arm('reject')
    create(r, 's3', p.id)
    expect(retry.slot().loads).toBe(2)
    components(r, 's3', [{ id: 'root', component: 'Leaf', label: 'three' }])
    retry.slot().resolve()
    await settle()
    expect(mount.querySelector(retry.leaf)?.textContent).toBe('three')
    expect(sent.filter(isError)).toHaveLength(2)
    cleanup()
  })

  it('deleteSurface while the load is pending drops the queue; a fresh surface at the same id starts its own', async () => {
    const p = arm('delete')
    const { r, mount, sent, cleanup } = host()

    create(r, 's', p.id)
    components(r, 's', [{ id: 'root', component: 'Leaf', label: 'old' }])
    r.ingest(line({ version: 'v1.0', deleteSurface: { surfaceId: 's' } }))
    create(r, 's', p.id)
    components(r, 's', [{ id: 'root', component: 'Leaf', label: 'new' }])

    p.slot().resolve()
    await settle()
    expect(p.applied).toEqual(['new']) // the dropped queue's 'old' message never applies
    expect(mount.querySelector(p.leaf)?.textContent).toBe('new')
    expect(sent.filter(isError)).toEqual([])
    expect(p.slot().loads).toBe(1)
    cleanup()
  })

  it('dispose while pending drops every queue; a late resolve or reject is a no-op', async () => {
    const ok = arm('dispose-ok')
    const bad = arm('dispose-bad')
    const { r, mount, sent, cleanup } = host()

    create(r, 'a', ok.id)
    components(r, 'a', [{ id: 'root', component: 'Leaf', label: 'a' }])
    create(r, 'b', bad.id)
    components(r, 'b', [{ id: 'root', component: 'Leaf', label: 'b' }])
    r.dispose()

    ok.slot().resolve()
    bad.slot().reject(new Error('boom'))
    await settle()
    expect(mount.children).toHaveLength(0)
    expect(sent).toEqual([])
    cleanup()
  })

  it('the catalog gate runs ahead of the control gate: a loaded body with a control loader still defers until its controls are defined', async () => {
    let defineControls!: () => void
    const controlsReady = new Promise<void>((res) => (defineControls = res))
    const records: Record<string, ControlRecord> = {}
    const p = arm('controls', (f) => {
      for (const tag of [f.box, f.leaf]) {
        records[tag] = {
          tag,
          load: async () => {
            await controlsReady
            if (customElements.get(tag) === undefined) customElements.define(tag, class extends HTMLElement {})
          },
        }
      }
      return { catalog: f.catalog, factories: f.factories, controls: createControlLoader(records, { css: 'host' }) }
    })
    const { r, mount, sent, cleanup } = host()

    create(r, 's', p.id)
    components(r, 's', [
      { id: 'root', component: 'Box', children: ['a'] },
      { id: 'a', component: 'Leaf', label: 'gated twice' },
    ])
    p.slot().resolve()
    await settle()
    expect(mount.children).toHaveLength(0) // the body loaded; the controls have not
    expect(customElements.get(p.leaf)).toBeUndefined()

    defineControls()
    await settle()
    expect(mount.querySelector(p.leaf)).toBeInstanceOf(customElements.get(p.leaf)!)
    expect(mount.querySelector(p.leaf)?.textContent).toBe('gated twice')
    expect(sent.filter(isError)).toEqual([])
    cleanup()
  })

  it('another surface is never delayed by a pending catalog', async () => {
    const slow = arm('slow')
    const free = fixture('free')
    const { r, mount, cleanup } = host()
    r.register(free.catalog, free.factories)

    create(r, 's1', slow.id)
    components(r, 's1', [{ id: 'root', component: 'Leaf', label: 'slow' }])
    create(r, 's2', 'probe-free')
    components(r, 's2', [{ id: 'root', component: 'Leaf', label: 'free' }])
    expect(mount.querySelector('[data-a2ui-surface="s2"]')?.textContent).toBe('free') // same tick
    expect(mount.querySelector('[data-a2ui-surface="s1"]')).toBeNull()

    slow.slot().resolve()
    await settle()
    expect(mount.querySelector('[data-a2ui-surface="s1"]')?.textContent).toBe('slow')
    cleanup()
  })
})

describe('callFunction reads the manifest of a recorded, unloaded catalog (ADR-0241 cl.7)', () => {
  const callPing = (r: RendererHost): void =>
    r.ingest(line({ version: 'v1.0', functionCallId: 'fc-1', wantResponse: true, callFunction: { call: 'ping', args: {} } } as never))

  it('a clientOnly declaration in an unloaded manifest rejects a server call before and after the body loads', async () => {
    const p = arm('fn')
    const { r, sent, cleanup } = host()

    callPing(r)
    expect(p.slot().loads).toBe(0) // judged from the manifest, no body fetched
    p.slot().resolve()
    await r.preload(p.id)
    callPing(r)

    expect(sent.map((m) => ('error' in m ? m.error.code : 'functionResponse' in m ? 'response' : 'action'))).toEqual([
      'INVALID_FUNCTION_CALL',
      'INVALID_FUNCTION_CALL',
    ])
    for (const m of sent) expect((m as WireErrorMessage).error.message).toContain('clientOnly')
    cleanup()
  })

  it('negative control: a registry that hides its records lets the same call through, so the manifest read is what bites', () => {
    const registry = new Registry()
    registry.register(
      {
        catalogId: 'probe-open',
        protocolVersion: 'v1.0',
        components: { X: { properties: {} } },
        functions: { ping: { args: {}, returns: { type: 'string' }, callableFrom: 'clientOrRemote' } },
      },
      { X: { tag: 'x-cat-probe-open', create: () => document.createElement('x-cat-probe-open'), applyProp: () => {} } },
    )
    registry.registerLazy({ id: 'probe-fn-copy', functions: probes.PING_CLIENT_ONLY, submitGate: [], load: () => Promise.reject(new Error('never loaded')) })
    const run = (reg: CatalogRegistry): (A2uiFunctionResponseMessage | WireErrorMessage)[] => {
      const out: (A2uiFunctionResponseMessage | WireErrorMessage)[] = []
      handleCallFunction({ functionCallId: 'fc', wantResponse: true, callFunction: { call: 'ping', args: {} } }, reg, 'v1.0', (m) => void out.push(m))
      return out
    }
    expect('error' in run(registry)[0]!).toBe(true)
    const blind: CatalogRegistry = {
      register: () => {},
      get: (id) => registry.get(id),
      supportedCatalogIds: () => registry.supportedCatalogIds(),
      submitGateSelector: () => registry.submitGateSelector(),
    }
    expect('functionResponse' in run(blind)[0]!).toBe(true)
  })
})
