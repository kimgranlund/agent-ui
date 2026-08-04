// agent-config-schema.ts — ADR-0135 Piece B: A2UI Chat's live-agent config as a real `SettingsSchema`
// instance + a fail-closed resolver into `ProduceOptions`. The `produce()` loop's tuning knobs (mode /
// model / k / maxRounds / miniSkillCap) get ONE described, validatable shape, reusing the app-side
// vocabulary (ADR-0131/0132) now hoisted to `@agent-ui/shared` (Piece A).
//
// `liveAgentConfigSchema` is a schema BUILDER, not a bare constant: the `model` field's options are
// PROJECTED from the passed `ProvidersConfig` (the single source of truth for models, SPEC-R11/R12) —
// NOT a hardcoded second model list (Fork 1). Pure-core: it takes the already-parsed+validated
// `ProvidersConfig` object; the Node shell (the proxy / a test) does the `readFileSync` +
// `validateProvidersConfig` (ADR-0062's pure-core/Node-shell split, the providers-config.ts precedent).
//
// ADR-0168 cl.6 (LLD-C8) first-classes the second knob the same way: an OPTIONAL `integrations` argument —
// the manifest list, PASSED IN exactly like `providers` rather than read from the registry here, keeping
// this module pure-core and the Node shell the one that imports the self-registering manifests — projects
// ONE `boolean` field per manifest (`integration:<id>`, the manifest's own label/description, `default:
// false`) into an `integrations` section. Fork 1's law applied again: never a hardcoded second integration
// list. Absent or empty ⇒ NO section, a schema byte-identical to the pre-ADR-0168 one (the additive-optional
// posture `AgentProvider.stream`'s `tools?`/`executeTool?` seam already takes).
//
// `resolveProduceOptions` reads a `SettingsStore`-shaped source live at call time and returns the
// `ProduceOptions` shape `produce()` already expects, fail-closed on a bad stored value via the SHARED
// `sanitizeNumber`/`sanitizeSelect` guards (Piece A) — the exact idiom `agent-admin.ts`'s `#handleSubmit`
// uses, now with one implementation instead of a re-invented second one. Wiring a `ui-settings` UI (or
// the dev proxy) to this schema is OUT OF SCOPE (ADR-0135 cl.7) — the schema + resolver sit ALONGSIDE
// `ProduceOptions` as an alternate config-collection path, not a replacement.
//
// The `@agent-ui/shared` type import is `import type` only — shared sits below a2ui in the DAG
// (`shared ← components ← a2ui`) and a type-only import erases at build; the guard functions are runtime
// values, but this is Node-only tooling (never a browser bundle, SPEC-R3/N2), so a real cross-package
// value import is fine here.

import type { SettingsSchema, SettingsSection, SettingsFieldOption } from '@agent-ui/shared'
import { findField, sanitizeBoolean, sanitizeNumber, sanitizeSelect } from '@agent-ui/shared'
import type { ProvidersConfig } from './providers-config.ts'
import type { IntegrationManifest } from './integrations/registry.ts'
import { GEN_UI_MODES, DEFAULT_GEN_UI_MODE } from '../../src/agent/gen-ui-mode.ts'
import type { GenUiMode } from '../../src/agent/gen-ui-mode.ts'
import { DEFAULT_MINI_SKILL_CAP } from '../../src/agent/mini-skills.ts'
import type { ProduceOptions } from '../../src/agent/produce.ts'

/** The minimal `SettingsStore`-shaped read seam `resolveProduceOptions` needs — a synchronous
 *  `get(key)`. Declared locally (not imported from `@agent-ui/app`'s `SettingsStore`, which is downstream
 *  in the DAG and unreachable from here); any store offering a `get` satisfies it. */
export interface SettingsRead {
  get(key: string): unknown
}

/** Project the passed registry's IMPLEMENTED providers' models into `SettingsFieldOption[]` (Fork 1) —
 *  the model select never carries a hardcoded parallel list, only what `providers.json` actually
 *  allowlists. Deduplicated by model id (first label wins) in case two providers expose the same id. */
function modelOptions(providers: ProvidersConfig): SettingsFieldOption[] {
  const seen = new Map<string, string>()
  for (const id of Object.keys(providers.providers)) {
    const entry = providers.providers[id]!
    if (!entry.implemented) continue
    for (const model of entry.models) {
      if (!seen.has(model.id)) seen.set(model.id, model.label)
    }
  }
  return [...seen].map(([value, label]) => ({ value, label }))
}

/** The default model — the default provider's own `defaultModel` (guaranteed implemented + present by
 *  `validateProvidersConfig`), falling back to the first projected option if the registry was not
 *  validated first. */
function defaultModelOf(providers: ProvidersConfig): string {
  const entry = providers.providers[providers.defaultProvider]
  return entry?.defaultModel ?? modelOptions(providers)[0]?.value ?? ''
}

/** The `integrations` section's field-key prefix. The field key CARRIES the manifest id
 *  (`integration:<id>`, ADR-0168 cl.6's literal naming), which is what lets `resolveIntegrationIds` read the
 *  enabled ids straight back off the schema — one naming home, no parallel id list on either side. */
const INTEGRATION_KEY_PREFIX = 'integration:'

/** The schema field key one manifest id projects to — exported so a caller (an admin projection, a test)
 *  reads or writes the store under the SAME key this builder declares, never a re-spelled literal. */
export function integrationFieldKey(id: string): string {
  return `${INTEGRATION_KEY_PREFIX}${id}`
}

/** Project the passed manifests into one `boolean` enablement field each (ADR-0168 cl.6) — label and
 *  description come from the manifest itself (the registry owns human text; `id` stays the wire fact), and
 *  every toggle ships OFF: enablement is opt-in per agent, the same inverse-default the admin surface
 *  toggles already take. No `SettingsFieldType` widening — the existing `boolean` vocabulary says it. */
function integrationSection(integrations: readonly IntegrationManifest[]): SettingsSection {
  return {
    id: 'integrations',
    label: 'Integrations',
    description: 'Which registered integrations this agent may call as tools during a turn.',
    fields: integrations.map((manifest) => ({
      key: integrationFieldKey(manifest.id),
      type: 'boolean',
      label: manifest.label,
      description: manifest.description,
      default: false,
    })),
  }
}

/**
 * Build the live-agent config `SettingsSchema` from the parsed providers registry (ADR-0135 cl.4) plus,
 * optionally, the registered integration manifests (ADR-0168 cl.6). Fields: `mode` (the `GenUiMode` axis),
 * `model` (options projected from `providers`), `k` (retrieval top-k), `maxRounds` (self-correct bound),
 * `miniSkillCap` (the mini-skill cap — a real tunable knob for the first time, cl.7); plus one
 * `integration:<id>` boolean per passed manifest. Mirrors `defaultAgentConfigSchema`'s shape + fail-closed
 * spirit but sources both projected lists from the real registries rather than hardcoding either.
 *
 * `integrations` absent or empty ⇒ the returned schema is IDENTICAL to the pre-ADR-0168 one (no extra
 * section, no extra field) — the widening is additive and opt-in for every existing caller.
 */
export function liveAgentConfigSchema(
  providers: ProvidersConfig,
  integrations: readonly IntegrationManifest[] = [],
): SettingsSchema {
  const sections: SettingsSection[] = [
    {
      id: 'live-agent',
      label: 'Live agent',
      description: 'The tuning knobs the produce() loop reads before composing each turn.',
      fields: [
        {
          key: 'mode',
          type: 'select',
          label: 'Gen-UI mode',
          description: 'The per-turn disposition scaling clarify/negotiate behavior (ADR-0090).',
          default: DEFAULT_GEN_UI_MODE,
          options: GEN_UI_MODES.map((mode) => ({ value: mode, label: mode })),
        },
        {
          key: 'model',
          type: 'select',
          label: 'Model',
          description: 'Which registered, implemented model this agent runs on (from providers.json).',
          default: defaultModelOf(providers),
          options: modelOptions(providers),
        },
        {
          key: 'k',
          type: 'number',
          label: 'Retrieval top-k',
          description: 'How many exemplars to retrieve per turn.',
          default: 3,
          validation: { min: 1 },
        },
        {
          key: 'maxRounds',
          type: 'number',
          label: 'Max self-correct rounds',
          description: 'The bound on validator-driven self-correction before halting.',
          default: 3,
          validation: { min: 1 },
        },
        {
          key: 'miniSkillCap',
          type: 'number',
          label: 'Mini-skill cap',
          description: 'At most this many composition-idiom modules compose into one prompt (ADR-0091).',
          default: DEFAULT_MINI_SKILL_CAP,
          validation: { min: 0 },
        },
      ],
    },
  ]
  if (integrations.length > 0) sections.push(integrationSection(integrations))
  return { version: 1, sections }
}

/** The model field's own declared default, read straight off the schema so the resolver carries no
 *  parallel model literal — its only role is the guard's belt-and-braces fallback (never reached for a
 *  well-formed schema, whose `model` default is always a string). */
function schemaStringDefault(schema: SettingsSchema, key: string): string {
  const def = findField(schema, key)?.default
  return typeof def === 'string' ? def : ''
}

/**
 * Read a `SettingsStore`-shaped source into the `ProduceOptions` shape `produce()` expects (ADR-0135
 * cl.6), fail-closed on a bad stored value via the SHARED guards (Piece A): an out-of-range or
 * unrecognized stored value degrades to the schema's own declared default, never reaching the loop
 * verbatim. `mode` is guaranteed a `GenUiMode` member by `sanitizeSelect` against the schema's
 * `GEN_UI_MODES` options; `'default'` composes byte-identically to an absent mode (Piece C / ADR-0090).
 */
export function resolveProduceOptions(read: SettingsRead, schema: SettingsSchema): ProduceOptions {
  return {
    mode: sanitizeSelect(schema, 'mode', read.get('mode'), DEFAULT_GEN_UI_MODE) as GenUiMode,
    model: sanitizeSelect(schema, 'model', read.get('model'), schemaStringDefault(schema, 'model')),
    k: sanitizeNumber(schema, 'k', read.get('k'), 3),
    maxRounds: sanitizeNumber(schema, 'maxRounds', read.get('maxRounds'), 3),
    miniSkillCap: sanitizeNumber(schema, 'miniSkillCap', read.get('miniSkillCap'), DEFAULT_MINI_SKILL_CAP),
  }
}

/**
 * Read the enabled integration `id`s out of a `SettingsStore`-shaped source (ADR-0168 cl.6's fail-closed
 * resolver). The SCHEMA is the list of candidates — every `boolean` field keyed `integration:<id>` — so a
 * schema built without integrations resolves to `[]` and no id can be enabled that the builder never
 * projected. A field contributes its id only when its stored value is EXACTLY `true` via the shared
 * `sanitizeBoolean` guard (whose fallback is the field's own declared `false`): a missing key, the STRING
 * `'true'`, a `1`, a `null`, an object — all degrade to NOT enabled. Fail-closed both ways: a malformed
 * store never crashes a turn and never turns a tool ON by accident. Returns ids in schema (registration)
 * order; the id vocabulary is exactly what `resolveIntegrations(ids, env)` intersects against.
 */
export function resolveIntegrationIds(read: SettingsRead, schema: SettingsSchema): string[] {
  const enabled: string[] = []
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type !== 'boolean' || !field.key.startsWith(INTEGRATION_KEY_PREFIX)) continue
      const id = field.key.slice(INTEGRATION_KEY_PREFIX.length)
      if (id.length === 0) continue
      if (sanitizeBoolean(schema, field.key, read.get(field.key), false)) enabled.push(id)
    }
  }
  return enabled
}
