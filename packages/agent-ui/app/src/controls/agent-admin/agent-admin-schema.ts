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

import type { SettingsSchema } from '../settings/schema.ts'
// ADR-0135 Piece A / Fork 2: the fail-closed guards + seed helper hoisted to `@agent-ui/shared` so app
// and a2ui share ONE implementation. Re-exported here so `agent-admin.ts` keeps its current
// `'./agent-admin-schema.ts'` import path unchanged.
export { initialValuesFor, sanitizeNumber, sanitizeSelect } from '@agent-ui/shared'

/** One selectable model — `{ id, label }` (TKT-0043). Scoped local to `agent-admin`, not
 *  `@agent-ui/shared`: nothing else in the repo consumes this list yet, and hoisting it cross-package
 *  before a second real consumer exists would be premature (the repo's own `providers.json`,
 *  `@agent-ui/a2ui/tools/agent/`, is a different package's dev-only JSON precedent, not a shared TS
 *  constant to extend). A live model call remains explicitly out of scope (ADR-0131 cl.4/cl.7) — this
 *  list only replaces the old generic `default`/`fast`/`careful` tiers with real, named options. */
export interface SupportedModel {
  id: string
  label: string
}

export const SUPPORTED_MODELS: readonly SupportedModel[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { id: 'claude-fable-5', label: 'Fable 5' },
]

export const DEFAULT_MODEL_ID: string = 'claude-sonnet-5'

/** A model id's display label for the stub reply's citation string — falls back to the raw id itself
 *  (never throws) if `id` isn't one `SUPPORTED_MODELS` names, matching this file's own fail-closed law
 *  for a bring-your-own store's out-of-range values. */
function modelLabel(id: string): string {
  return SUPPORTED_MODELS.find((m) => m.id === id)?.label ?? id
}

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
          description: 'Which model this agent runs on — no live model call happens here (ADR-0131).',
          default: DEFAULT_MODEL_ID,
          options: SUPPORTED_MODELS.map((m) => ({ value: m.id, label: m.label })),
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
    `[stub preview — no live model call] ${config.name} (${modelLabel(config.model)}, temp ${config.temperature.toFixed(1)}): ` +
    `instructed as "${promptPreview}".${toolsNote} ` +
    `Skills: ${labelList(config.skills)}. Workflows: ${labelList(config.workflows)}. ` +
    `Resources: ${labelList(config.resources)}. Tools: ${labelList(config.tools)}. You said: ${userText}`
  )
}
