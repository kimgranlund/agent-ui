// registry.test.ts — LLD-C1's gate (SPEC-R16 AC1 / SPEC-R18 AC1): boot-fail-fast registration + the
// fail-closed resolve path, deterministic, no key, no network. Also LLD-C2's gate (SPEC-R3 AC1/AC2,
// ADR-0185): `resolveAgainst`'s service-ref expansion, over FABRICATED manifest arrays only (the
// `projectIntegrationTrios` precedent) — those cases never touch the module REGISTRY.
//
// The registry is MODULE state shared by every test in this file (one module graph per test file), so each
// case registers manifests under its OWN unique ids and asserts only about those — no reset hatch exists,
// and none is exported: production code never un-registers an integration.
import { describe, it, expect, vi } from 'vitest'
import { registerIntegration, listIntegrations, resolveIntegrations, resolveAgainst } from './registry.ts'
import type { IntegrationManifest } from './registry.ts'

function manifest(overrides: Partial<IntegrationManifest> & { id: string }): IntegrationManifest {
  return {
    version: '1.0.0',
    label: `Label ${overrides.id}`,
    description: `Test manifest ${overrides.id}.`,
    tool: {
      name: overrides.id,
      description: 'A test tool.',
      input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    },
    auth: 'none',
    execute: async () => 'ok',
    ...overrides,
  }
}

const NO_ENV: Record<string, string | undefined> = {}

describe('registerIntegration — boot fail-fast (SPEC-R16)', () => {
  it('registers a manifest and lists it', () => {
    const m = manifest({ id: 'reg-basic' })
    registerIntegration(m)
    expect(listIntegrations()).toContain(m)
  })

  it('throws on a duplicate id', () => {
    registerIntegration(manifest({ id: 'reg-dup-id' }))
    expect(() => registerIntegration(manifest({ id: 'reg-dup-id', tool: { name: 'reg-dup-id-other', description: 'x', input_schema: { type: 'object' } } }))).toThrow(
      /duplicate id `reg-dup-id`/,
    )
  })

  it('throws on a duplicate wire tool.name under a different id', () => {
    registerIntegration(manifest({ id: 'reg-wire-a' }))
    expect(() =>
      registerIntegration(
        manifest({ id: 'reg-wire-b', tool: { name: 'reg-wire-a', description: 'x', input_schema: { type: 'object' } } }),
      ),
    ).toThrow(/duplicate tool name `reg-wire-a`/)
  })

  it('throws when the declared input_schema leaves the supported subset (a nested object property)', () => {
    expect(() =>
      registerIntegration(
        manifest({
          id: 'reg-bad-schema',
          tool: {
            name: 'reg-bad-schema',
            description: 'x',
            input_schema: { type: 'object', properties: { where: { type: 'object', properties: { city: { type: 'string' } } } } },
          },
        }),
      ),
    ).toThrow(/`reg-bad-schema` — unsupported input_schema/)
  })

  it('leaves a rejected manifest OUT of the registry (no half-registration)', () => {
    const rejected = manifest({
      id: 'reg-rejected',
      tool: { name: 'reg-rejected', description: 'x', input_schema: { type: 'object', properties: { tags: { type: 'array' } } } },
    })
    expect(() => registerIntegration(rejected)).toThrow()
    expect(listIntegrations()).not.toContain(rejected)
    expect(resolveIntegrations(['reg-rejected'], NO_ENV)).toEqual([])
  })

  it('throws when a serverKey manifest names no envKey', () => {
    expect(() => registerIntegration(manifest({ id: 'reg-keyless-serverkey', auth: 'serverKey' }))).toThrow(
      /declares auth "serverKey" but no envKey/,
    )
  })
})

describe('resolveIntegrations — fail-closed enablement (SPEC-R16/R18)', () => {
  it('returns [] for anything non-array', () => {
    expect(resolveIntegrations(undefined, NO_ENV)).toEqual([])
    expect(resolveIntegrations(null, NO_ENV)).toEqual([])
    expect(resolveIntegrations('weather', NO_ENV)).toEqual([])
    expect(resolveIntegrations({ 0: 'weather' }, NO_ENV)).toEqual([])
  })

  it('drops unknown ids and non-string entries, keeping registered matches', () => {
    const m = manifest({ id: 'resolve-known' })
    registerIntegration(m)
    expect(resolveIntegrations(['resolve-known', 'no-such-integration', 42, null], NO_ENV)).toEqual([m])
  })

  it('caps the requested list at 16 entries — an id past the cap is dropped', () => {
    const m = manifest({ id: 'resolve-capped' })
    registerIntegration(m)
    const junk = Array.from({ length: 16 }, (_, i) => `junk-${i}`)
    expect(resolveIntegrations([...junk, 'resolve-capped'], NO_ENV)).toEqual([])
    expect(resolveIntegrations([...junk.slice(0, 15), 'resolve-capped'], NO_ENV)).toEqual([m])
  })

  it('excludes a serverKey manifest whose env var is unset or empty, includes it once provisioned', () => {
    const m = manifest({ id: 'resolve-keyed', auth: 'serverKey', envKey: 'FAKE_INTEGRATION_KEY' })
    registerIntegration(m)
    expect(resolveIntegrations(['resolve-keyed'], NO_ENV)).toEqual([])
    expect(resolveIntegrations(['resolve-keyed'], { FAKE_INTEGRATION_KEY: '' })).toEqual([])
    expect(resolveIntegrations(['resolve-keyed'], { FAKE_INTEGRATION_KEY: '   ' })).toEqual([])
    expect(resolveIntegrations(['resolve-keyed'], { FAKE_INTEGRATION_KEY: 'not-a-real-key' })).toEqual([m])
  })

  it('never leaks the key value into the resolved manifest (envKey stays a NAME)', () => {
    // Registers its OWN fixture (not the previous case's) — this file's ids are unique per case exactly so
    // no test depends on another having run first (`.only`/shuffled order stays green).
    registerIntegration(manifest({ id: 'resolve-keyed-leak', auth: 'serverKey', envKey: 'FAKE_LEAK_KEY' }))
    const active = resolveIntegrations(['resolve-keyed-leak'], { FAKE_LEAK_KEY: 'not-a-real-key' })
    expect(active[0]?.envKey).toBe('FAKE_LEAK_KEY')
    expect(JSON.stringify(active)).not.toContain('not-a-real-key')
  })

  it('resolveIntegrations end-to-end wires a real registered ref through the real REGISTRY (delegation proof)', () => {
    // Proves the SIGNATURE-unchanged delegation itself, not just the pure core below: two manifests
    // registered under the SAME service, resolved through the public `resolveIntegrations` export
    // using a service ref — no other test in this file registers under `mcp:regtest:`, so this is
    // safe against shuffled/parallel order.
    registerIntegration(manifest({ id: 'mcp:regtest:one' }))
    registerIntegration(manifest({ id: 'mcp:regtest:two' }))
    const resolved = resolveIntegrations(['mcp:regtest:*'], NO_ENV)
    expect(resolved.map((m) => m.id).sort()).toEqual(['mcp:regtest:one', 'mcp:regtest:two'])
  })
})

describe('resolveAgainst — the pure expansion core (LLD-C2, SPEC-R3), fabricated arrays only', () => {
  it('SPEC-R3 AC1: expands a ref, unions an exact match, dedups, drops unknown ids/refs — one pass', () => {
    const calcAdd = manifest({ id: 'mcp:calc:add' })
    const calcMultiply = manifest({ id: 'mcp:calc:multiply' })
    const notesSearch = manifest({ id: 'mcp:notes:search' })
    const fakeRegistry = [calcAdd, calcMultiply, notesSearch]

    const resolved = resolveAgainst(
      fakeRegistry,
      ['mcp:calc:*', 'mcp:notes:search', 'mcp:calc:add', 'mcp:ghost:*', 'nonsense'],
      NO_ENV,
    )

    expect(resolved).toEqual([calcAdd, calcMultiply, notesSearch])
    expect(resolved).toHaveLength(3) // each manifest exactly once, despite the calc/add overlap
  })

  it('SPEC-R3 AC2: an unprovisioned serverKey manifest is excluded THROUGH expansion, the rest unaffected', () => {
    const keptOpen = manifest({ id: 'mcp:notes:list' })
    const keptKeyed = manifest({ id: 'mcp:notes:search', auth: 'serverKey', envKey: 'FAKE_NOTES_KEY' })
    const fakeRegistry = [keptOpen, keptKeyed]

    expect(resolveAgainst(fakeRegistry, ['mcp:notes:*'], NO_ENV)).toEqual([keptOpen])
    expect(resolveAgainst(fakeRegistry, ['mcp:notes:*'], { FAKE_NOTES_KEY: 'not-a-real-key' })).toEqual([
      keptOpen,
      keptKeyed,
    ])
  })

  it('returns [] for anything non-array, over a fabricated (non-empty) registry too', () => {
    const fakeRegistry = [manifest({ id: 'mcp:any:tool' })]
    expect(resolveAgainst(fakeRegistry, undefined, NO_ENV)).toEqual([])
    expect(resolveAgainst(fakeRegistry, null, NO_ENV)).toEqual([])
    expect(resolveAgainst(fakeRegistry, 'mcp:any:*', NO_ENV)).toEqual([])
  })

  it('the pre-expansion MAX_ENABLED cap still drops a wanted ref past position 16', () => {
    const fakeRegistry = [manifest({ id: 'mcp:many:tool' })]
    const junk = Array.from({ length: 16 }, (_, i) => `junk-${i}`)
    expect(resolveAgainst(fakeRegistry, [...junk, 'mcp:many:*'], NO_ENV)).toEqual([])
    expect(resolveAgainst(fakeRegistry, [...junk.slice(0, 15), 'mcp:many:*'], NO_ENV)).toEqual(fakeRegistry)
  })

  it('the post-expansion MAX_RESOLVED ceiling (64) truncates in registration order and warns exactly once', () => {
    const fakeRegistry = Array.from({ length: 70 }, (_, i) => manifest({ id: `mcp:many:tool-${i}` }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const resolved = resolveAgainst(fakeRegistry, ['mcp:many:*'], NO_ENV)

    expect(resolved).toHaveLength(64)
    expect(resolved).toEqual(fakeRegistry.slice(0, 64)) // registration order, first 64 survive
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith('integration registry: resolved set truncated to 64')
    warnSpy.mockRestore()
  })

  it('a set at or under the MAX_RESOLVED ceiling never warns', () => {
    const fakeRegistry = Array.from({ length: 64 }, (_, i) => manifest({ id: `mcp:atcap:tool-${i}` }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(resolveAgainst(fakeRegistry, ['mcp:atcap:*'], NO_ENV)).toHaveLength(64)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
