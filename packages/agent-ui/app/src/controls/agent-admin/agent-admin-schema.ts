// agent-admin-schema.ts — the "Agent" section's flat config data (TKT-0039/ADR-0131, now one section
// among several under ADR-0132) — name/model/temperature/toolsEnabled, rendered by the composed
// `ui-settings` instance exactly as before. Types + pure data, plus the stub turn loop's OWN fail-closed
// read guards (sanitizeNumber/sanitizeSelect) — narrower than `ui-settings`' own commit-time validation
// (SPEC-R11/generate.ts, which this file does NOT reimplement): those guard values `ui-settings` itself
// writes; these guard a bring-your-own store that bypassed `ui-settings` entirely, so an out-of-range or
// unrecognized stored value never reaches the stub reply verbatim (component-reviewer MEDIUM finding).
//
// ADR-0132 moved system-prompt/instructions OUT of this file entirely — `entries.ts` now owns the
// generic ordered-entry-list primitive (prompt sections + the four capability kinds); the single
// `SYSTEM_PROMPT_KEY`/`DEFAULT_SYSTEM_PROMPT` pair this file used to export is gone, replaced by
// `entries.ts`'s `DEFAULT_PROMPT_SECTIONS`/`composeSystemPrompt`/`DEFAULT_SYSTEM_PROMPT_FALLBACK`.

import type { SettingsField, SettingsSchema } from '../settings/schema.ts'

/** The default agent-config `SettingsSchema` (ADR-0131 cl.1: name/model/temperature/tools — no external
 *  runtime dependency). Rendered by the composed `ui-settings` pane exactly as any other settings schema
 *  would be (SPEC-R10/R11/R12) — nothing here is agent-admin-specific to `ui-settings` itself. */
export const defaultAgentConfigSchema: SettingsSchema = {
  version: 1,
  sections: [
    {
      id: 'agent',
      label: 'Agent',
      description: 'The identity and generation behavior this preview reads before every turn.',
      fields: [
        {
          key: 'name',
          type: 'text',
          label: 'Name',
          description: "The agent's display name.",
          default: 'Untitled agent',
          validation: { required: true },
        },
        {
          key: 'model',
          type: 'select',
          label: 'Model',
          description: 'A generic behavior tier — this preview has no live model dependency (ADR-0131).',
          default: 'default',
          options: [
            { value: 'default', label: 'Default' },
            { value: 'fast', label: 'Fast' },
            { value: 'careful', label: 'Careful' },
          ],
        },
        {
          key: 'temperature',
          type: 'slider',
          label: 'Temperature',
          description: 'How much the stub reply varies its framing (0 = terse, 1 = expansive).',
          default: 0.5,
          validation: { min: 0, max: 1, step: 0.1 },
        },
        {
          key: 'toolsEnabled',
          type: 'boolean',
          label: 'Tools enabled',
          description: 'Whether the stub reply mentions tool availability.',
          default: false,
        },
      ],
    },
  ],
}

/** Every key + its schema `default` this schema's fields declare — the `initial` a
 *  `createMemoryStore({ persistKey })` needs to actually read its OWN localStorage-backed values back
 *  after a reload. `memory-store.ts`'s seed loop only checks `localStorage` for keys already present in
 *  `initial` at construction time (it iterates `values.keys()`, never a blind localStorage scan) — an
 *  empty `initial` means every `get()` returns `undefined` forever, even after a real prior `set()`,
 *  silently defeating ADR-0131 cl.3's ruled real-persistence scope. `agent-admin.ts` merges this with
 *  `entries.ts`'s own `initialEntryValues()` — the two files seed disjoint key sets, this one the flat
 *  "Agent" section, that one every entry-list kind. */
export function initialValuesFor(schema: SettingsSchema): Record<string, unknown> {
  const initial: Record<string, unknown> = {}
  for (const section of schema.sections) {
    for (const field of section.fields) initial[field.key] = field.default
  }
  return initial
}

/** Find one field's definition across every section of a schema, or `undefined` if the schema doesn't
 *  declare it (a bring-your-own schema/store combination the turn loop must still degrade safely against). */
function findField(schema: SettingsSchema, key: string): SettingsField | undefined {
  for (const section of schema.sections) {
    const field = section.fields.find((f) => f.key === key)
    if (field) return field
  }
  return undefined
}

/** Fail-closed against the SCHEMA's own declared bounds (SPEC-R11 is `ui-settings`' own commit-time
 *  guarantee for values IT writes; this is the turn loop's own guard for a bring-your-own store that
 *  bypassed `ui-settings` entirely — an out-of-range or unrecognized stored value must never reach the
 *  stub reply verbatim). `raw` wins only if it validates; otherwise the field's own schema `default` does. */
export function sanitizeNumber(schema: SettingsSchema, key: string, raw: unknown, fallback: number): number {
  const field = findField(schema, key)
  const min = field?.validation?.min ?? -Infinity
  const max = field?.validation?.max ?? Infinity
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= min && raw <= max) return raw
  const def = field?.default
  return typeof def === 'number' ? def : fallback
}

export function sanitizeSelect(schema: SettingsSchema, key: string, raw: unknown, fallback: string): string {
  const field = findField(schema, key)
  const allowed = field?.options?.map((o) => o.value)
  if (typeof raw === 'string' && (allowed === undefined || allowed.includes(raw))) return raw
  const def = field?.default
  return typeof def === 'string' ? def : fallback
}

/** The agent-config values the stub turn loop reads at turn time — always the CURRENT store contents,
 *  never cached (this IS the live-apply mechanism: a store read at turn time trivially reflects whatever
 *  the settings/prompts panes most recently wrote, no separate propagation channel needed).
 *  `systemPrompt` is now the COMPOSED multi-section prompt (`entries.ts`'s `composeSystemPrompt`), not a
 *  single flat key; `skills`/`workflows`/`resources`/`tools` are each kind's ENABLED entry labels
 *  (ADR-0132 cl.6 — the turn loop reads the composed prompt + the enabled-capabilities snapshot). */
export interface AgentConfigSnapshot {
  name: string
  model: string
  temperature: number
  toolsEnabled: boolean
  systemPrompt: string
  skills: readonly string[]
  workflows: readonly string[]
  resources: readonly string[]
  tools: readonly string[]
}

/** `"none" | "a, b, c"` — the shared list-labeling shape `runStubAgentTurn` uses for every capability
 *  kind, so an empty enabled-list reads as an explicit "none" rather than a bare empty string. */
function labelList(labels: readonly string[]): string {
  return labels.length > 0 ? labels.join(', ') : 'none'
}

/**
 * A deterministic, clearly-labeled STUB reply (ADR-0131: no external runtime dependency — this is not a
 * live model call). Its whole job is to make the live-apply wiring PROVABLE: the reply visibly cites the
 * config it read — the composed prompt AND the enabled capabilities (ADR-0132) — so a test (or a person)
 * can confirm an edited setting/section/capability actually reached the next turn without a manual
 * reload, per TKT-0039's own Acceptance criteria, generalized to the richer ADR-0132 architecture.
 */
export function runStubAgentTurn(userText: string, config: AgentConfigSnapshot): string {
  const promptPreview = config.systemPrompt.length > 60 ? `${config.systemPrompt.slice(0, 60)}…` : config.systemPrompt
  const toolsNote = config.toolsEnabled ? ' Tools are enabled.' : ''
  return (
    `[stub preview — no live model call] ${config.name} (${config.model}, temp ${config.temperature.toFixed(1)}): ` +
    `instructed as "${promptPreview}".${toolsNote} ` +
    `Skills: ${labelList(config.skills)}. Workflows: ${labelList(config.workflows)}. ` +
    `Resources: ${labelList(config.resources)}. Tools: ${labelList(config.tools)}. You said: ${userText}`
  )
}
