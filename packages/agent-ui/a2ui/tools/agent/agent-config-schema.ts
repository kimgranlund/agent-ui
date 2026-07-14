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

import type { SettingsSchema, SettingsFieldOption } from '@agent-ui/shared'
import { findField, sanitizeNumber, sanitizeSelect } from '@agent-ui/shared'
import type { ProvidersConfig } from './providers-config.ts'
import { GEN_UI_MODES, DEFAULT_GEN_UI_MODE } from './gen-ui-mode.ts'
import type { GenUiMode } from './gen-ui-mode.ts'
import { DEFAULT_MINI_SKILL_CAP } from './mini-skills.ts'
import type { ProduceOptions } from './produce.ts'

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

/**
 * Build the live-agent config `SettingsSchema` from the parsed providers registry (ADR-0135 cl.4). Fields:
 * `mode` (the `GenUiMode` axis), `model` (options projected from `providers`), `k` (retrieval top-k),
 * `maxRounds` (self-correct bound), `miniSkillCap` (the mini-skill cap — a real tunable knob for the first
 * time, cl.7). Mirrors `defaultAgentConfigSchema`'s shape + fail-closed spirit but sources the model list
 * from the real registry rather than hardcoding it.
 */
export function liveAgentConfigSchema(providers: ProvidersConfig): SettingsSchema {
  return {
    version: 1,
    sections: [
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
    ],
  }
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
