// providers-config.ts — LLD-C11 / SPEC-R11 §5, SPEC-R12: pure typed helpers over an ALREADY-PARSED
// `ProvidersConfig` object (the committed `providers.json` registry). This module does NO I/O — the
// Node reader (the proxy + this package's `providers-config.test.ts`) obtains the parsed object via
// `readFileSync` + `JSON.parse` (the `tools/harness/validate-payload.ts` / `tools/corpus/import-seeds.ts`
// precedent: Node's native ESM loader rejects an attribute-less JSON import,
// `ERR_IMPORT_ATTRIBUTE_MISSING`, under `--experimental-strip-types`); the browser switcher obtains it
// via a Vite JSON import instead (LLD §2's "providers.json data-access" decision). Pure-core takes the
// object, the Node shell does the read (ADR-0062's pure-core/Node-shell split, generalized here).
//
// The registry is the SINGLE source of truth for BOTH the in-chat switcher menu (SPEC-R12) and the
// proxy's PAIR-allowlist (SPEC-R11/R12) — no hand-listed second list. `resolvePair` is that allowlist
// check: it is the ONLY place a client-supplied `{provider, model}` is validated before a key is ever
// read (ADR-0073 clause 5, "the proxy is the trust boundary").

/** The registry shape (SPEC §5's `ProvidersConfig`). `defaultProvider` MUST be an implemented provider;
 * `implemented: false` ⇒ menu-disabled (SPEC-R12) + proxy degrades (SPEC-R11 AC4). */
export interface ProviderModel {
  id: string
  label: string
}

export interface ProviderEntry {
  label: string
  envKey: string
  endpoint: string
  defaultModel: string
  models: ProviderModel[]
  implemented: boolean
}

export interface ProvidersConfig {
  defaultProvider: string
  providers: Record<string, ProviderEntry>
}

/**
 * Validate the registry's own internal invariants (ADR-0073 acceptance / SPEC-R11 AC2): every provider
 * carries `envKey`/`endpoint`/`defaultModel`/`implemented`; each provider's `defaultModel` is one of its
 * own `models`; `defaultProvider` names a provider that exists AND is `implemented`. Throws with a
 * specific message on the first violation found — this is a load-time assertion, not a lookup.
 */
export function validateProvidersConfig(cfg: ProvidersConfig): void {
  const ids = Object.keys(cfg.providers)
  if (ids.length === 0) {
    throw new Error('providers.json: no providers registered')
  }

  for (const id of ids) {
    const entry = cfg.providers[id]!
    if (typeof entry.label !== 'string' || entry.label.length === 0) {
      throw new Error(`providers.json: provider "${id}" is missing a label`)
    }
    if (typeof entry.envKey !== 'string' || entry.envKey.length === 0) {
      throw new Error(`providers.json: provider "${id}" is missing envKey`)
    }
    if (typeof entry.endpoint !== 'string' || entry.endpoint.length === 0) {
      throw new Error(`providers.json: provider "${id}" is missing endpoint`)
    }
    if (typeof entry.defaultModel !== 'string' || entry.defaultModel.length === 0) {
      throw new Error(`providers.json: provider "${id}" is missing defaultModel`)
    }
    if (typeof entry.implemented !== 'boolean') {
      throw new Error(`providers.json: provider "${id}" is missing implemented (boolean)`)
    }
    if (!Array.isArray(entry.models) || entry.models.length === 0) {
      throw new Error(`providers.json: provider "${id}" has no models`)
    }
    const modelIds = new Set(entry.models.map((m) => m.id))
    if (!modelIds.has(entry.defaultModel)) {
      throw new Error(`providers.json: provider "${id}"'s defaultModel "${entry.defaultModel}" is not in its own models`)
    }
  }

  if (!(cfg.defaultProvider in cfg.providers)) {
    throw new Error(`providers.json: defaultProvider "${cfg.defaultProvider}" is not a registered provider`)
  }
  if (!cfg.providers[cfg.defaultProvider]!.implemented) {
    throw new Error(`providers.json: defaultProvider "${cfg.defaultProvider}" is not implemented`)
  }
}

/** Why a `{provider, model}` pair was rejected (SPEC-R11 AC4 / SPEC-R12 AC1) — never a bare boolean, so
 * the proxy's degrade path and the switcher's disabled-state can both distinguish the cause. */
export type ResolvePairFailureReason = 'unknown-provider' | 'unknown-model' | 'unimplemented'

export type ResolvePairResult =
  | { ok: true; entry: ProviderEntry; envKey: string }
  | { ok: false; reason: ResolvePairFailureReason }

/**
 * The PAIR-allowlist check (SPEC-R11/R12, ADR-0073 clause 5) — the proxy's trust boundary. Returns the
 * matched entry + its env-var NAME only when `provider` is registered, `implemented`, AND `model` is one
 * of that provider's own `models`; otherwise a discriminated rejection reason. Never trusts an arbitrary
 * client-supplied provider/model string past this check.
 */
export function resolvePair(cfg: ProvidersConfig, provider: string, model: string): ResolvePairResult {
  const entry = cfg.providers[provider]
  if (entry === undefined) {
    return { ok: false, reason: 'unknown-provider' }
  }
  if (!entry.implemented) {
    return { ok: false, reason: 'unimplemented' }
  }
  if (!entry.models.some((m) => m.id === model)) {
    return { ok: false, reason: 'unknown-model' }
  }
  return { ok: true, entry, envKey: entry.envKey }
}
