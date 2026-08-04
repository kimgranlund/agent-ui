// index.ts — LLD-C3 (SPEC-R16): the ONE module both hosts import. Importing it BOOTS the registry — each
// v1 manifest module registers itself as a top-level side effect, so the import order below IS the
// registration order `listIntegrations()` reports. A registration failure (duplicate id, duplicate wire
// name, a schema beyond the validator's subset, a keyless `serverKey`) throws HERE, at import — the
// boot-fail-fast posture both hosts already take on a malformed `providers.json`.
//
// Adding an integration = one new module + one line below. There is no parallel integrations.json
// (ADR-0168's rejected alternative).

import './weather.ts'
import './wikipedia-search.ts'
import './currency.ts'

export { registerIntegration, listIntegrations, resolveIntegrations } from './registry.ts'
export type { IntegrationManifest, ExecuteContext } from './registry.ts'
