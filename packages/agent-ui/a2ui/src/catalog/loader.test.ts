import { describe, it, expect, vi, afterEach } from 'vitest'
import { CatalogLoadError, loadCatalogBody } from './loader.ts'
import { Registry, RegistryError, RegistryErrorCode } from './registry.ts'
import type { CatalogBody, LazyCatalogRecord, WidgetFactory } from './types.ts'

// ADR-0241 slice 2: the memoized body load and `Registry.ensure`. Every fixture is synthetic (a record's
// `load` is a spy over an in-memory body), so nothing here imports a real catalog or a `ui-*` control.

const fakeFactory = (tag: string): WidgetFactory => ({ tag, create: () => document.createElement('div'), applyProp: () => {} })

const synthCatalog = (catalogId: string, types: string[]) => ({
  catalogId,
  protocolVersion: 'v1.0',
  components: Object.fromEntries(types.map((t) => [t, { properties: {} }])),
})

const body = (catalogId: string, types: string[] = ['Widget']): CatalogBody => ({
  catalog: synthCatalog(catalogId, types),
  factories: Object.fromEntries(types.map((t) => [t, fakeFactory(`ui-${t.toLowerCase()}`)])),
})

/** A record whose `load` resolves `loaded` (default: a one-type body under `id`) and counts its calls. */
const record = (id: string, loaded: CatalogBody = body(id)) => {
  const load = vi.fn(() => Promise.resolve(loaded))
  const rec: LazyCatalogRecord = { id, functions: {}, submitGate: [], load }
  return { rec, load }
}

afterEach(() => vi.restoreAllMocks())

describe('loadCatalogBody — the module-wide memo (ADR-0241 cl.4)', () => {
  it('calls load once however many times it is asked: one promise per record', async () => {
    const { rec, load } = record('a')
    const first = loadCatalogBody(rec)
    const second = loadCatalogBody(rec)
    expect(second).toBe(first)
    await first
    expect(loadCatalogBody(rec)).toBe(first) // still memoized once settled
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keys the memo by the record, not the id: two records sharing an id load separately', async () => {
    const one = record('same')
    const two = record('same')
    await Promise.all([loadCatalogBody(one.rec), loadCatalogBody(two.rec)])
    expect(one.load).toHaveBeenCalledTimes(1)
    expect(two.load).toHaveBeenCalledTimes(1)
  })

  it('a rejected load is dropped from the memo, so the next call retries (the loadAgentAdmin precedent)', async () => {
    const failure = new Error('chunk 404')
    const load = vi.fn<() => Promise<CatalogBody>>().mockRejectedValueOnce(failure).mockResolvedValue(body('a'))
    const rec: LazyCatalogRecord = { id: 'a', functions: {}, submitGate: [], load }

    await expect(loadCatalogBody(rec)).rejects.toBe(failure)
    await expect(loadCatalogBody(rec)).resolves.toMatchObject({ catalog: { catalogId: 'a' } })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('a load that throws synchronously becomes a rejection and is also retried', async () => {
    const load = vi
      .fn<() => Promise<CatalogBody>>()
      .mockImplementationOnce(() => {
        throw new Error('sync throw')
      })
      .mockResolvedValue(body('a'))
    const rec: LazyCatalogRecord = { id: 'a', functions: {}, submitGate: [], load }

    await expect(loadCatalogBody(rec)).rejects.toThrow('sync throw')
    await expect(loadCatalogBody(rec)).resolves.toBeDefined()
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('Registry.ensure (ADR-0241 cl.3-5)', () => {
  it('loads the body and registers it: get() answers, knows and supportedCatalogIds still list it once', async () => {
    const reg = new Registry()
    const { rec, load } = record('lazy')
    reg.registerLazy(rec)

    await reg.ensure('lazy')

    expect(load).toHaveBeenCalledTimes(1)
    expect(reg.get('lazy')?.catalog.catalogId).toBe('lazy')
    expect(reg.knows('lazy')).toBe(true)
    expect(reg.supportedCatalogIds()).toEqual(['lazy'])
  })

  it('threads the body\'s functions and controls into the entry, as register does', async () => {
    const reg = new Registry()
    const fn = () => true
    const controls = { missing: () => [], ensure: () => Promise.resolve() }
    const { rec } = record('lazy', { ...body('lazy'), functions: { isOk: fn }, controls })
    reg.registerLazy(rec)

    await reg.ensure('lazy')

    expect(reg.get('lazy')?.functions?.isOk).toBe(fn)
    expect(reg.get('lazy')?.controls).toBe(controls)
  })

  it('concurrent ensures share one load and register once (no re-register warn)', async () => {
    const reg = new Registry()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rec, load } = record('lazy')
    reg.registerLazy(rec)

    await Promise.all([reg.ensure('lazy'), reg.ensure('lazy'), reg.ensure('lazy')])
    await reg.ensure('lazy') // and a later call after settle

    expect(load).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('an already-registered id resolves without loading anything', async () => {
    const reg = new Registry()
    reg.register(synthCatalog('eager', ['Widget']), body('eager').factories)
    await expect(reg.ensure('eager')).resolves.toBeUndefined()
  })

  it('an id that is neither registered nor recorded rejects with CatalogLoadError naming it', async () => {
    const reg = new Registry()
    const failure = await reg.ensure('nope').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(CatalogLoadError)
    expect((failure as CatalogLoadError).catalogId).toBe('nope')
    expect((failure as CatalogLoadError).name).toBe('CatalogLoadError')
  })

  it('one load serves every registry: each registers the body into itself (the second renderer is not empty)', async () => {
    const first = new Registry()
    const second = new Registry()
    const { rec, load } = record('shared')
    first.registerLazy(rec)
    second.registerLazy(rec)

    await first.ensure('shared')
    expect(second.get('shared')).toBeUndefined() // loading in one registry registers in that one only
    await second.ensure('shared')

    expect(load).toHaveBeenCalledTimes(1)
    expect(first.get('shared')).toBeDefined()
    expect(second.get('shared')).toBeDefined()
    expect(second.get('shared')).not.toBe(first.get('shared'))
  })

  it('a rejected load rejects with CatalogLoadError carrying the cause, leaves the id known and unloaded, and retries', async () => {
    const reg = new Registry()
    const failure = new Error('chunk 404')
    const load = vi.fn<() => Promise<CatalogBody>>().mockRejectedValueOnce(failure).mockResolvedValue(body('lazy'))
    reg.registerLazy({ id: 'lazy', functions: {}, submitGate: [], load })

    const caught = await reg.ensure('lazy').catch((e: unknown) => e)
    expect(caught).toBeInstanceOf(CatalogLoadError)
    expect((caught as CatalogLoadError).catalogId).toBe('lazy')
    expect((caught as CatalogLoadError).cause).toBe(failure)
    expect(reg.get('lazy')).toBeUndefined()
    expect(reg.knows('lazy')).toBe(true)

    await reg.ensure('lazy') // retried, not served from a poisoned memo
    expect(load).toHaveBeenCalledTimes(2)
    expect(reg.get('lazy')).toBeDefined()
  })

  it('CATALOG_FACTORY_MISSING still runs, at load: a body with a factory gap rejects and registers nothing', async () => {
    const reg = new Registry()
    const { rec } = record('gap', { catalog: synthCatalog('gap', ['A', 'B']), factories: { A: fakeFactory('ui-a') } })
    reg.registerLazy(rec)

    const caught = await reg.ensure('gap').catch((e: unknown) => e)

    expect(caught).toBeInstanceOf(CatalogLoadError)
    const cause = (caught as CatalogLoadError).cause
    expect(cause).toBeInstanceOf(RegistryError)
    expect((cause as RegistryError).code).toBe(RegistryErrorCode.FACTORY_MISSING)
    expect(reg.get('gap')).toBeUndefined()
  })

  it('a body whose document declares another id rejects: the record id is the registry key, so nothing registers', async () => {
    const reg = new Registry()
    const { rec } = record('wanted', body('other'))
    reg.registerLazy(rec)

    const caught = await reg.ensure('wanted').catch((e: unknown) => e)

    expect(caught).toBeInstanceOf(CatalogLoadError)
    expect((caught as CatalogLoadError).message).toMatch(/wanted/)
    expect((caught as CatalogLoadError).message).toMatch(/other/)
    expect(reg.get('wanted')).toBeUndefined()
    expect(reg.get('other')).toBeUndefined()
  })

  it('a register() that lands while the body loads wins (last-wins): the late body is discarded', async () => {
    const reg = new Registry()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rec } = record('proj', body('proj', ['Lazy']))
    reg.registerLazy(rec)

    const pending = reg.ensure('proj')
    reg.register(synthCatalog('proj', ['Eager']), { Eager: fakeFactory('ui-eager') })
    await pending

    expect(Object.keys(reg.get('proj')?.catalog.components ?? {})).toEqual(['Eager'])
    expect(warn).toHaveBeenCalledTimes(1) // shadowing a recorded id is an override, logged like any other
  })

  it('a registerLazy() that lands while the body loads supersedes it: the stale body is discarded and ensure settles on the new record', async () => {
    const reg = new Registry()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stale = record('proj', body('proj', ['Stale']))
    const fresh = record('proj', body('proj', ['Fresh']))
    reg.registerLazy(stale.rec)

    const pending = reg.ensure('proj')
    reg.registerLazy(fresh.rec)
    await pending

    expect(Object.keys(reg.get('proj')?.catalog.components ?? {})).toEqual(['Fresh'])
    expect(fresh.load).toHaveBeenCalledTimes(1)
  })

  it('submitGateSelector and supportedCatalogIds do not double-count once the body is loaded', async () => {
    const reg = new Registry()
    const gated: CatalogBody = {
      catalog: synthCatalog('lazy', ['Provider']),
      factories: { Provider: { ...fakeFactory('ui-provider'), submitGate: true } },
    }
    reg.registerLazy({ id: 'lazy', functions: {}, submitGate: ['ui-provider'], load: () => Promise.resolve(gated) })
    expect(reg.submitGateSelector()).toBe('ui-provider') // from the manifest, before any load

    await reg.ensure('lazy')

    expect(reg.submitGateSelector()).toBe('ui-provider') // from the loaded factory now, once
    expect(reg.supportedCatalogIds()).toEqual(['lazy'])
  })
})
