// env-projection.test.ts — LLD-C5's gate (SPEC-R18 AC2) AND LLD-C9's keyed-groundwork proof (SPEC-R18 AC1).
// Deterministic: no key, no network, no live model — the "key" here is the literal string `not-a-real-key`.
//
// Why this file exists at all: LLD-C5 widens the Worker's `envVars(env)` projection to cover registered
// `serverKey` manifests, and `worker/index.ts` can NEVER be imported into a shared test process (its first
// import, process-shim.ts, globally overrides `process.cwd()` — see both files' headers, vitest.config.ts's
// `tools` project comment, and route-guards.test.ts). Rather than settle for reading `envVars`'s source text
// (chat-route.test.ts's structural idiom for the same un-importable file), the projection itself was split
// into the pure `env-projection.ts` — route-guards.ts's own precedent — so the widening is proven
// BEHAVIORALLY against the REAL registry and the REAL providers.json here, and only the two-line wiring
// inside `envVars` is left to a structural pin (the last describe below).
//
// LLD-C9's other two legs are already proven and are NOT rebuilt here: C1's exclusion of an unprovisioned
// keyed manifest by `resolveIntegrations` (integrations/registry.test.ts — "excludes a serverKey manifest
// whose env var is unset or empty, includes it once provisioned") and C4's ctx key hand-off (integrations/
// tool-dispatch.test.ts — "buildToolDispatch — the keyed seam (SPEC-R18)"). What was missing was C5's
// projection: whether a registered keyed manifest's `envKey` is reachable in the Worker AT ALL. The
// end-to-end describe below chains all three (project → resolve → dispatch → ctx.apiKey) with ONE fake
// manifest, which is exactly LLD-C9's row.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { projectEnv } from './env-projection.ts'
import { registerIntegration, listIntegrations, resolveIntegrations, buildToolDispatch } from '../integrations/index.ts'
import type { ExecuteContext, IntegrationManifest } from '../integrations/index.ts'
import type { ProvidersConfig } from '../providers-config.ts'
import providersConfigRaw from '../providers.json'

// The REAL providers registry the Worker loads (same `import providersConfigRaw from '../providers.json'`
// index.ts uses), so "derives from providers.json entries" is asserted against the shipped file, not a
// fixture copy of it.
const PROVIDERS = Object.values((providersConfigRaw as ProvidersConfig).providers)

// THE fake keyed integration. ADR-0168's Non-goals are explicit that the first REAL keyed integration is its
// own later work item — a test-only manifest is the whole of LLD-C9's groundwork proof. Registered once, at
// module scope: the registry is module state and vitest gives this file its own module graph, so this
// registration is invisible to registry.test.ts/tool-dispatch.test.ts (and its id/wire name are unique
// regardless). Importing the barrel boots the three REAL v1 manifests alongside it, which is the point —
// they are all `auth: 'none'`, so a realistic registry must contribute exactly ONE key name here.
const FAKE_ENV_KEY = 'FAKE_KEYED_INTEGRATION_KEY'
const FAKE_KEY_VALUE = 'not-a-real-key'
const FAKE_ID = 'fake-keyed-groundwork'
const FAKE_WIRE_NAME = 'fake_keyed_groundwork'

const calls: { input: Record<string, unknown>; ctx: ExecuteContext }[] = []
const fakeKeyed: IntegrationManifest = {
  id: FAKE_ID,
  version: '1.0.0',
  label: 'Fake Keyed Groundwork',
  description: 'Test-only keyed manifest (ADR-0168 cl.4 groundwork). Never registered in production.',
  tool: {
    name: FAKE_WIRE_NAME,
    description: 'A test tool that needs a server key.',
    input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
  },
  auth: 'serverKey',
  envKey: FAKE_ENV_KEY,
  execute: async (input, ctx) => {
    calls.push({ input, ctx })
    return 'ran fake-keyed-groundwork'
  },
}
registerIntegration(fakeKeyed)

/** A Workers env binding also carries non-secret, non-string bindings (`ASSETS`) — realistic noise the
 *  projection must narrow away, not pass through. */
const ASSETS = { fetch: async () => new Response('') }

describe('projectEnv — the provider half, unchanged (GH #115)', () => {
  it('projects each providers.json entry by whatever NAME the file declares, and NOTHING else', () => {
    const env = { ASSETS, ANTHROPIC_API_KEY: 'p-key', UNRELATED_SECRET: 'must-not-cross' }
    // The WHOLE returned shape, not just a spot check: the projection is a narrowing, so an undeclared env
    // var (or the ASSETS binding) appearing here would be the leak this function exists to prevent.
    expect(projectEnv(env, PROVIDERS, [])).toEqual({ ANTHROPIC_API_KEY: 'p-key' })
  })

  it('reaches EVERY provider entry in the shipped providers.json (no hand-listed subset)', () => {
    for (const entry of PROVIDERS) {
      expect(projectEnv({ ASSETS, [entry.envKey]: `value-of-${entry.envKey}` }, PROVIDERS, [])).toEqual({
        [entry.envKey]: `value-of-${entry.envKey}`,
      })
    }
  })

  it('omits a declared name the env does not hold as a string (absent, never an undefined-valued key)', () => {
    const out = projectEnv({ ASSETS, ANTHROPIC_API_KEY: 12345 }, PROVIDERS, [])
    expect(out).toEqual({})
    expect('ANTHROPIC_API_KEY' in out).toBe(false)
  })
})

describe('projectEnv — the integrations half, LLD-C5’s widening (SPEC-R18 AC2)', () => {
  it('surfaces a REGISTERED serverKey manifest’s envKey value — the projection the shipped provider-only loop could not reach', () => {
    const env = { ASSETS, [FAKE_ENV_KEY]: FAKE_KEY_VALUE }
    // Pre-widening behaviour, pinned as the contrast: providers.json alone never names an integration key.
    expect(projectEnv(env, PROVIDERS, [])).toEqual({})
    // Post-widening: registering the manifest is the ONLY thing that made this name reachable.
    expect(projectEnv(env, PROVIDERS, listIntegrations())).toEqual({ [FAKE_ENV_KEY]: FAKE_KEY_VALUE })
  })

  it('excludes the name when the env does not hold it — projecting a registry is not asserting provisioning', () => {
    const out = projectEnv({ ASSETS }, PROVIDERS, listIntegrations())
    expect(out).toEqual({})
    expect(FAKE_ENV_KEY in out).toBe(false)
  })

  it('projects BOTH registries in one pass (a provider key and an integration key side by side)', () => {
    const env = { ASSETS, ANTHROPIC_API_KEY: 'p-key', [FAKE_ENV_KEY]: FAKE_KEY_VALUE, OTHER: 'x' }
    expect(projectEnv(env, PROVIDERS, listIntegrations())).toEqual({
      ANTHROPIC_API_KEY: 'p-key',
      [FAKE_ENV_KEY]: FAKE_KEY_VALUE,
    })
  })

  it('the three real v1 manifests are auth:"none" and contribute NO key name', () => {
    const keyless = listIntegrations().filter((m) => m.auth === 'none')
    expect(keyless.length).toBeGreaterThanOrEqual(3) // weather + wikipedia-search + currency
    for (const m of keyless) expect(m.envKey).toBeUndefined()
    // Even given an env stuffed with every id/wire name as a variable, a keyless manifest projects nothing.
    const noisy: Record<string, unknown> = { ASSETS }
    for (const m of keyless) noisy[m.id] = 'x'
    expect(projectEnv(noisy, [], keyless)).toEqual({})
  })

  it('`auth` is the gate, not the mere presence of an envKey — a keyless manifest carrying a stray name projects nothing', () => {
    // Registration forbids the inverse (a serverKey manifest with no envKey, registry.test.ts) but nothing
    // forbids this shape, and it must not open a second path to a secret.
    const stray = [{ auth: 'none' as const, envKey: FAKE_ENV_KEY }]
    expect(projectEnv({ [FAKE_ENV_KEY]: FAKE_KEY_VALUE }, [], stray)).toEqual({})
  })

  it('a non-string value under a keyed name is skipped, exactly as for a provider', () => {
    expect(projectEnv({ [FAKE_ENV_KEY]: { toString: () => FAKE_KEY_VALUE } }, PROVIDERS, listIntegrations())).toEqual({})
  })

  it('projects an EMPTY-string value verbatim (the shipped provider semantics), which resolve then treats as unprovisioned', () => {
    const hostEnv = projectEnv({ [FAKE_ENV_KEY]: '' }, PROVIDERS, listIntegrations())
    expect(hostEnv).toEqual({ [FAKE_ENV_KEY]: '' })
    // The projection reports what the env holds; SPEC-R18's "unprovisioned ⇒ never offered" is enforced one
    // step later, by resolveIntegrations. Both halves have to hold for the degrade to be honest.
    expect(resolveIntegrations([FAKE_ID], hostEnv)).toEqual([])
  })
})

describe('the keyed groundwork end to end — project → resolve → dispatch → ctx (LLD-C9)', () => {
  it('a provisioned keyed manifest is offered and its key reaches execute via ctx.apiKey', async () => {
    const hostEnv = projectEnv({ ASSETS, [FAKE_ENV_KEY]: FAKE_KEY_VALUE }, PROVIDERS, listIntegrations())
    const active = resolveIntegrations([FAKE_ID], hostEnv)
    expect(active).toEqual([fakeKeyed])

    const built = buildToolDispatch(active, hostEnv)
    expect(built.tools.map((t) => t.name)).toEqual([FAKE_WIRE_NAME])
    await expect(built.executeTool(FAKE_WIRE_NAME, { q: 'helsinki' })).resolves.toBe('ran fake-keyed-groundwork')
    expect(calls).toHaveLength(1)
    expect(calls[0].ctx.apiKey).toBe(FAKE_KEY_VALUE)

    // The whole point of the trust boundary: the key value exists only inside this host-side chain.
    expect(JSON.stringify(built.tools)).not.toContain(FAKE_KEY_VALUE)
    expect(JSON.stringify(built.tools)).not.toContain(FAKE_ENV_KEY)
    expect(JSON.stringify(active)).not.toContain(FAKE_KEY_VALUE)
  })

  it('the SAME manifest is never offered when the Worker env lacks the key — the projection is the first gate', () => {
    const hostEnv = projectEnv({ ASSETS }, PROVIDERS, listIntegrations())
    expect(hostEnv).toEqual({})
    const active = resolveIntegrations([FAKE_ID], hostEnv)
    expect(active).toEqual([])
    // Zero active manifests ⇒ the bare `{}` both hosts spread, so the model is declared no tool at all.
    expect(buildToolDispatch(active, hostEnv)).toEqual({})
  })

  it('a keyless v1 manifest still dispatches with no key alongside the keyed one', async () => {
    const hostEnv = projectEnv({ ASSETS, [FAKE_ENV_KEY]: FAKE_KEY_VALUE }, PROVIDERS, listIntegrations())
    const active = resolveIntegrations([FAKE_ID, 'weather'], hostEnv)
    expect(active.map((m) => m.id).sort()).toEqual([FAKE_ID, 'weather'])
    const built = buildToolDispatch(active, hostEnv)
    // The weather executor would hit the network, so only the fake one is CALLED here; what matters is that
    // sharing an env never hands a keyless manifest the other's secret (tool-dispatch.test.ts proves the
    // per-manifest rule; this pins it over the REAL registry + REAL projection).
    await built.executeTool(FAKE_WIRE_NAME, { q: 'x' })
    expect(calls.at(-1)?.ctx.apiKey).toBe(FAKE_KEY_VALUE)
    expect(built.tools.some((t) => t.name === 'weather')).toBe(true)
  })
})

// The wiring inside `envVars` is the ONE part of LLD-C5 that cannot be executed here (worker/index.ts is not
// importable — see this file's header), so it gets chat-route.test.ts's structural pin: assert the function
// derives from BOTH registries and hand-lists nothing. Behaviour of what it calls is proven above.
describe('envVars wires the projection to BOTH registries (structural — worker/index.ts is not importable under vitest)', () => {
  const source = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8')
  const envVars = source.slice(source.indexOf('function envVars('), source.indexOf('function json('))

  it('calls projectEnv with providers.json’s entries AND listIntegrations()', () => {
    expect(envVars).toContain('projectEnv(env, Object.values(config.providers), listIntegrations())')
  })

  it('imports both from their single sources — no second copy of either registry', () => {
    expect(source).toContain("import { buildToolDispatch, listIntegrations, resolveIntegrations } from '../integrations/index.ts'")
    expect(source).toContain("import { projectEnv } from './env-projection.ts'")
  })

  it('names no key literal of its own (GH #115’s drift class stays closed)', () => {
    expect(envVars).not.toMatch(/API_KEY/)
    expect(envVars).not.toMatch(/envKey/)
  })
})
