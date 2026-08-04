// env-projection.ts — the Worker's env→hostEnv projection (LLD-C5 / SPEC-R18 AC2 / ADR-0168 cl.4), pure
// and side-effect-free, split out of index.ts for exactly the reason route-guards.ts was (its own header):
// index.ts's first import, process-shim.ts, globally overrides `process.cwd()`, so index.ts can never be
// imported into the shared test process — a helper living INSIDE it could only ever be gated by reading
// its source text. Living here, the whole projection is behaviorally testable against the REAL registry.
//
// GH #115's lesson, now applied to both key registries at once: the set of secret NAMES the Worker projects
// out of its env binding is DERIVED from the registries that already declare them — providers.json's
// entries and the integration registry's `serverKey` manifests — never a hand-listed literal that drifts.
// Registering a keyed integration is therefore sufficient for its key to become reachable (if the env
// actually holds it); no matching edit here follows it. Names only: an `envKey` is an env-var NAME, and a
// resolved VALUE lives in the returned record for the duration of one request, never on a manifest, never
// serialized (SPEC-R18 / ADR-0073 cl.5).

/** The one fact this projection needs from a providers.json entry: the env-var NAME. */
interface ProviderKeySource {
  envKey: string
}

/** The two facts it needs from a registered manifest: whether it is keyed at all, and under what NAME. */
interface IntegrationKeySource {
  auth: 'none' | 'serverKey'
  envKey?: string
}

/**
 * Project the Worker's env binding down to `{ envKey: value }` for every key name the two registries
 * declare. A name the env doesn't hold as a string is simply absent from the result — the same degrade
 * the shipped provider loop already had, and the shape `resolveIntegrations`/`buildToolDispatch` expect
 * (an unprovisioned `serverKey` manifest is then EXCLUDED at resolve time, so the model is never offered
 * a tool that cannot run).
 */
export function projectEnv(
  env: Record<string, unknown>,
  providers: readonly ProviderKeySource[],
  integrations: readonly IntegrationKeySource[],
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  const take = (envKey: string | undefined): void => {
    if (envKey === undefined || envKey.length === 0) return
    const value = env[envKey]
    if (typeof value === 'string') result[envKey] = value
  }
  for (const entry of providers) take(entry.envKey)
  for (const manifest of integrations) {
    // `auth: 'none'` names no secret — nothing to project (and per SPEC-R18 such a manifest carries no
    // `envKey` at all; registration rejects the inverse, a `serverKey` manifest without one).
    if (manifest.auth !== 'serverKey') continue
    take(manifest.envKey)
  }
  return result
}
