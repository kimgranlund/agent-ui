// registry.test.ts — LLD-C1's gate (SPEC-R16 AC1 / SPEC-R18 AC1): boot-fail-fast registration + the
// fail-closed resolve path, deterministic, no key, no network.
//
// The registry is MODULE state shared by every test in this file (one module graph per test file), so each
// case registers manifests under its OWN unique ids and asserts only about those — no reset hatch exists,
// and none is exported: production code never un-registers an integration.
import { describe, it, expect } from 'vitest'
import { registerIntegration, listIntegrations, resolveIntegrations } from './registry.ts'
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
    const active = resolveIntegrations(['resolve-keyed'], { FAKE_INTEGRATION_KEY: 'not-a-real-key' })
    expect(active[0]?.envKey).toBe('FAKE_INTEGRATION_KEY')
    expect(JSON.stringify(active)).not.toContain('not-a-real-key')
  })
})
