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
import type { EffortLevel } from '../conversation/composer-options.ts'
import type { TurnProgress } from '@agent-ui/a2ui/agent/meta-line' // ADR-0146 F1 — the live-turn progress vocabulary (type-only, from the PURE meta-line module, never the node-first ./agent barrel); a cross-package specifier stays extensionless (the repo's own local-.ts-only convention) — a2ui/package.json exports this as its own subpath
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
  /** The Model select's list this model renders under (Kim, 2026-07-19: "models should be a few lists")
   *  — realized as ui-select role=group wrappers via SettingsFieldOption.group. */
  group: string
}

export const SUPPORTED_MODELS: readonly SupportedModel[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', group: 'Fast' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', group: 'Balanced' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', group: 'Frontier' },
  { id: 'claude-fable-5', label: 'Fable 5', group: 'Frontier' },
]

/** Haiku by default (Kim, 2026-07-19) — the cheap/fast tier is the demo's sane default; Sonnet stays one
 *  commit away in the Balanced list. */
export const DEFAULT_MODEL_ID: string = 'claude-haiku-4-5-20251001'

// ── admin-added models (Kim, 2026-07-19: "admins can make additional models available") ────────────────

/** The store key carrying the admin's ADDITIONAL model ids (the `customModels` config field below):
 *  comma-separated, each `id` or `id|Label`. Parsed fail-closed — malformed segments drop silently. */
export const CUSTOM_MODELS_KEY = 'customModels'

/** Parse the customModels config value into SupportedModel rows (group: 'Additional'). Dedupes against
 *  the built-in ids and within itself; a non-string/empty value ⇒ []. */
export function parseCustomModels(raw: unknown): SupportedModel[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return []
  const seen = new Set(SUPPORTED_MODELS.map((m) => m.id))
  const out: SupportedModel[] = []
  for (const segment of raw.split(',')) {
    const [idPart, labelPart] = segment.split('|')
    const id = (idPart ?? '').trim()
    if (id.length === 0 || seen.has(id)) continue
    seen.add(id)
    out.push({ id, label: (labelPart ?? '').trim() || id, group: 'Additional' })
  }
  return out
}

/** A model id's display label for the stub reply's citation string — falls back to the raw id itself
 *  (never throws) if `id` isn't one `SUPPORTED_MODELS` names, matching this file's own fail-closed law
 *  for a bring-your-own store's out-of-range values. */
function modelLabel(id: string): string {
  return SUPPORTED_MODELS.find((m) => m.id === id)?.label ?? id
}

/** Build the agent-config `SettingsSchema` (ADR-0131 cl.1: name/model/temperature/tools — no external
 *  runtime dependency), optionally extended with admin-added models (they join the Model select under
 *  the 'Additional' list). Rendered by the composed `ui-settings` pane exactly as any other settings
 *  schema would be (SPEC-R10/R11/R12) — nothing here is agent-admin-specific to `ui-settings` itself. */
export function agentConfigSchema(customModels: readonly SupportedModel[] = []): SettingsSchema {
  const allModels = [...SUPPORTED_MODELS, ...customModels]
  return {
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
          options: allModels.map((m) => ({ value: m.id, label: m.label, group: m.group })),
        },
        {
          key: CUSTOM_MODELS_KEY,
          type: 'text',
          label: 'Additional models',
          description:
            'Comma-separated model ids (optionally `id | Label`) to offer in the Model list under ' +
            '“Additional”. Live turns still pass the dev proxy’s provider allowlist — an id it doesn’t ' +
            'know fails that turn visibly.',
          default: '',
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
}

/** The zero-custom-models schema — the shared, read-only default every existing consumer keeps
 *  (agent-admin rebuilds with `agentConfigSchema(parseCustomModels(...))` when the admin adds models). */
export const defaultAgentConfigSchema: SettingsSchema = agentConfigSchema()

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

// ── The injectable turn-runner seam (ALM-C2, TKT-0052/ADR-0136) ────────────────────────────────────────
// The DEV-only live overlay's contract. App-local by construction: a2ui's tools-internal `Turn`
// (agent-transport.ts) is deliberately NOT a package export (SPEC-N1), so this surface declares its OWN
// minimal shapes and the site runner matches them structurally. This is NOT `resolveProduceOptions`/
// `ProduceOptions` (ADR-0135) — those carry `produce()`-loop knobs this surface never runs and a Node-side
// `ProvidersConfig` the browser can't read (LLD Q1). `agentTurn` stays `undefined` in every default/static
// path, so the packaged component itself carries zero fetch/env/proxy code (the stub is the only built path).

/** One prior completed turn replayed into a live request — the standard Messages-API role/content shape,
 *  matching a2ui's `Turn` structurally without importing it (SPEC-N1). */
export interface AdminTurn {
  role: 'user' | 'assistant'
  content: string
}

/** One live turn's request, projected from `agent-admin`'s OWN current config at turn time (LLD Q1/Q4). */
export interface AdminTurnRequest {
  /** The user's message, verbatim. */
  text: string
  /** `composeLiveSystemPrompt(...)` output — the composed prompt + enabled-capability projection, fresh-read. */
  system: string
  /** The sanitized `SUPPORTED_MODELS` id (`sanitizeSelect`, `DEFAULT_MODEL_ID` fallback). */
  model: string
  /** The composer's Effort picker selection (the Figma chat-input refactor) — ephemeral, per-conversation
   *  state (unlike `model`, it has no persisted-settings counterpart; `undefined` if the picker was never
   *  shown/committed). A runner that ignores it (or the value maps to no real dial) degrades the DIAL,
   *  never the request. */
  effort?: EffortLevel
  /** Prior completed turns only — NOT including `text` (the runner appends the user message itself). */
  history: readonly AdminTurn[]
}

// ── the SURFACE-capable live turn (TKT-0076/ADR-0138) ────────────────────────────────────────────────
// The same SPEC-N1 discipline as AdminTurn above: the a2ui producer transport (agent-transport.ts) is
// deliberately NOT a package export, so this surface declares its OWN seam. The RUNNER (a site-page
// injection, admin-live-runner.ts) owns everything transport-shaped — the a2ui `Session` transcript,
// the ADR-0088 meta-line peel, the provider pairing — and streams back a typed envelope the component
// consumes without ever importing the fenced machinery.

/** One streamed event of a surface turn: a VALIDATED A2UI wire line (fed to
 *  `AgentTurnHandle.ingestLine` — it routes by surfaceId to an inline ui-surface-host, ADR-0129), the
 *  turn's prose note (the ADR-0088 meta-line, already peeled by the runner — never ingested), or a
 *  live-turn progress stage (the ADR-0146 F1 meta-line, routed to `AgentTurnHandle.progress`). */
export type AdminSurfaceTurnEvent =
  | { kind: 'line'; line: string }
  | { kind: 'note'; note: string }
  | { kind: 'progress'; progress: TurnProgress }

/** A surface turn's request. `turn` mirrors the producer's two arms: a typed user intent, or a surface
 *  client message (an action click / function response bubbled up via `onClientMessage`) — `message` is
 *  deliberately `unknown` here (the component never inspects it; the runner casts at its own boundary). */
export interface AdminSurfaceTurnRequest {
  turn: { kind: 'intent'; text: string } | { kind: 'client'; message: unknown }
  /** The composed persona (`composeLiveSystemPrompt(...)`) — rides the producer's ADR-0138 persona seam,
   *  appended AFTER the catalog law (voice/content only, never the wire format). */
  personaSystem: string
  /** The sanitized `SUPPORTED_MODELS` id. */
  model: string
  /** GH #49 — the ENABLED tool-entry labels (the `tool` kind, gated on the config's `toolsEnabled`
   *  master switch), forwarded raw: the dev proxy intersects them with ITS integration registry and
   *  ignores everything else — the component knows entry labels, never the registry. Absent/empty ⇒
   *  no tools on the turn. */
  integrations?: readonly string[]
}

/** The injected surface runner (DEV-only, the `agentTurn` pattern): one turn in, an ordered stream of
 *  typed events out. Throwing (network fault, proxy error) surfaces via the conversation's fail path. */
export type AdminAgentSurfaceTurn = (req: AdminSurfaceTurnRequest) => AsyncIterable<AdminSurfaceTurnEvent>

/** The single injectable seam `ui-agent-admin` exposes as its `agentTurn` prop: one request in, one full
 *  reply string out (single-shot, LLD Q3 — the frozen `AgentTurnHandle` contract hosts no incremental
 *  prose method). A thrown/rejected runner degrades via `handle.fail()` (LLD Q5). */
export type AdminAgentTurn = (req: AdminTurnRequest) => Promise<string>

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
