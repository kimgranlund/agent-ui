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
import type { PersonaPatch } from '@agent-ui/a2ui/agent/meta-line' // ADR-0178 cl.2 / SPEC-R29 — the declared-patch shape, type-only from the SAME pure meta-line module `TurnProgress` rides (SPEC-N1-safe: no producer bytes cross)
import type { PlanDeclaration } from '@agent-ui/a2ui/agent/meta-line' // ADR-0182 cl.4 / SPEC-R20 — the ALREADY-SHIPPED plan-step shape, the SAME type-only import as PersonaPatch above
import type { TurnProgress } from '@agent-ui/a2ui/agent/meta-line' // ADR-0146 F1 — the live-turn progress vocabulary (type-only, from the PURE meta-line module, never the node-first ./agent barrel); a cross-package specifier stays extensionless (the repo's own local-.ts-only convention) — a2ui/package.json exports this as its own subpath
// M-D (SPEC-R3/R5) — the persona catalog compose-time overlay's static id-recognition inputs (the root
// `@agent-ui/a2ui` barrel, catalog/index.ts's own re-export of `catalog/compose.ts` + `catalog/personas/index.ts`).
import { derivedCatalogId, derivedCatalogIdsFor, SHIPPED_PERSONA_CATALOGS } from '@agent-ui/a2ui'
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
  /** The provider this model renders under in the Model GRID (Kim, 2026-07-19 rev.2: "a grid of
   *  options grouped by provider") — 'Anthropic' | 'Google' | 'OpenAI' | 'Other', open-ended. */
  provider: string
  /** Whether this model ships INCLUDED (its grid switch on) before the admin ever touches the record
   *  (rev.4: only Haiku+Sonnet ship on; the OpenAI/Gemini tier-equivalents ship as switchable options). */
  includedByDefault: boolean
}

/** Rev.4 (Kim, 2026-07-19): Opus and Fable are REMOVED entirely; the roster is the Haiku/Sonnet tier
 *  pair per provider — ids match the dev proxy's own providers.json rows EXACTLY (the one id namespace;
 *  openai/gemini are `implemented: false` there, so a live turn on them degrades visibly until their
 *  adapters land — the grid ships them switched OFF). */
export const SUPPORTED_MODELS: readonly SupportedModel[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', provider: 'Anthropic', includedByDefault: true },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', provider: 'Anthropic', includedByDefault: true },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', provider: 'OpenAI', includedByDefault: false },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI', includedByDefault: false },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', includedByDefault: false },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', includedByDefault: false },
]

/** Haiku by default (Kim, 2026-07-19) — the cheap/fast tier is the demo's sane default; Sonnet stays one
 *  commit away in the Balanced list. */
export const DEFAULT_MODEL_ID: string = 'claude-haiku-4-5-20251001'

// ── the Model GRID's data half (Kim, 2026-07-19 rev.2) ──────────────────────────────────────────────────

/** The store key holding the per-model INCLUSION record (`Record<modelId, boolean>` — the grid's
 *  switches). A missing key means INCLUDED (default-open roster; excluding is the explicit act). */
export const MODELS_INCLUDED_KEY = 'modelsIncluded'

/** The full model roster — the built-ins, in declaration order. (GH #137, Kim's option A, 2026-07-20:
 *  the "Additional models" free-text field that used to extend this roster with admin-typed ids is
 *  REMOVED — a raw comma-separated id blob was judged not worth the parsing ambiguity. This stays a
 *  function, not a plain re-export of `SUPPORTED_MODELS`, because every call site still calls it — the
 *  roster-as-a-function shape is cheap to keep and leaves room for a future non-text way to extend it.) */
export function modelRoster(): SupportedModel[] {
  return [...SUPPORTED_MODELS]
}

/** Whether a model is included per the store record — an explicit boolean wins; an absent entry falls
 *  back to the model's OWN `includedByDefault` (rev.4: built-ins ship Haiku+Sonnet on, the OpenAI/Gemini
 *  options off; admin-added customs on — you added it to use it). */
export function isModelIncluded(record: unknown, model: SupportedModel): boolean {
  if (typeof record === 'object' && record !== null) {
    const value = (record as Record<string, unknown>)[model.id]
    if (typeof value === 'boolean') return value
  }
  return model.includedByDefault
}

/** Fail-closed model read for turn/composer time: a store value naming a roster model passes;
 *  anything else falls back to DEFAULT_MODEL_ID (the sanitizeSelect discipline, roster-based now that
 *  the Model GRID replaced the schema's select field). */
export function sanitizeModel(value: unknown, roster: readonly SupportedModel[]): string {
  return typeof value === 'string' && roster.some((m) => m.id === value) ? value : DEFAULT_MODEL_ID
}

/** A model id's display label for the stub reply's citation string — falls back to the raw id itself
 *  (never throws) if `id` isn't one `SUPPORTED_MODELS` names, matching this file's own fail-closed law
 *  for a bring-your-own store's out-of-range values. */
function modelLabel(id: string): string {
  return SUPPORTED_MODELS.find((m) => m.id === id)?.label ?? id
}

/** Build the agent-config `SettingsSchema` (ADR-0131 cl.1 — no external runtime dependency). The MODEL
 *  moved OUT of this schema (Kim, 2026-07-19 rev.2): the admin's own Model GRID (provider-grouped rows,
 *  include switch + default checkbox) owns model management, writing the same `model`/`modelsIncluded`
 *  store keys; this schema keeps name/temperature/tools (GH #137, 2026-07-20: the "Additional models"
 *  free-text add-field this schema used to also carry is REMOVED — Kim's option A). Rendered by the
 *  composed `ui-settings` pane exactly as any other settings schema (SPEC-R10/R11/R12). */
export function agentConfigSchema(): SettingsSchema {
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
          key: 'temperature',
          type: 'slider',
          label: 'Temperature',
          description: 'How much the stub reply varies its framing (0 = terse, 1 = expansive).',
          default: 0.5,
          validation: { min: 0, max: 1, step: 0.1 },
        },
      ],
    },
  ],
  }
}

/** The shared, read-only default schema — the model select is GONE from it (the grid took over), so
 *  no store-driven schema rebuild exists anymore; the grid re-renders itself instead. The
 *  `toolsEnabled` boolean FIELD is gone too (vision rev.5, Kim's Figma frame 33:1693): kind-level
 *  gating moved to each capability section's own header master switch — same store keys, no field. */
export const defaultAgentConfigSchema: SettingsSchema = agentConfigSchema()

// ── Master toggles (vision rev.5 — Kim's Figma frame 33:1693, ruled 2026-07-19) ─────────────────────────

/** The store key for the Agent card's own master switch — "is this agent active/available" (Kim's
 *  ruling). `false` disables the composer (no turns run); everything else stays editable. */
export const AGENT_ENABLED_KEY = 'agentEnabled'

/** The store key carrying one capability kind's MASTER switch (the section-header toggle) — plural
 *  `${kind}sEnabled`, so the `tool` kind resolves to the PRE-EXISTING `toolsEnabled` key (the old Agent-
 *  card boolean field's persisted values carry over unchanged). */
export function kindEnabledKey(kind: string): string {
  return `${kind}sEnabled`
}

/** A master-switch read: default ON — only an explicit stored `false` disables (a fresh store ships
 *  every toggle up, matching the vision frame; NOTE this flips the old `toolsEnabled === true` read,
 *  whose unset default was OFF — the section-header switch renders its state honestly either way). */
export function isEnabledFlag(value: unknown): boolean {
  return value !== false
}

// ── Surface Options (vision rev.6 — the frame's node 34:1312) ──────────────────────────────────────────
// The agent's OUTPUT MODALITY contract: Markdown (rendered rich text, plain text the fallback), A2UI
// (the catalog picker), GenUI (the sandboxed free-form pattern-source picker — genui-surface.spec.md
// SPEC-R11, B2). GenUI defaults OFF (unlike the two live-since-launch modalities, which default ON): the
// modality's OWN row law is "visible-but-disabled until B2 ships" (PRD §3), and B2 does not flip its
// DEFAULT state on ship — an admin opts in per agent, the same "picked source's body composes only when
// enabled" degradation law SPEC-R10 already states for the prompt side.

/** Markdown surface — ON: agent-turn notes/system bubbles render through `ui-markdown` (sanitized by
 *  construction); OFF (an explicit stored `false`): plain `textContent`, the frame's own fallback. */
export const SURFACE_MARKDOWN_KEY = 'surfaceMarkdown'

/** A2UI surface — ON: an armed `agentSurfaceTurn` runs surface turns; OFF: even an armed runner is
 *  bypassed and the prose arm answers (surface action clicks no-op — no hidden turns from a disabled
 *  modality). */
export const SURFACE_A2UI_KEY = 'surfaceA2ui'

/** GenUI surface — ON: an armed `agentSurfaceTurn` MAY compose a genui line (SPEC-R10's teaching block
 *  joins the system prompt, and a real producer's peel/emit logic is live for this turn); OFF (the
 *  default — an explicit stored `true` is required to opt in, the INVERSE default of the other two
 *  modalities): no genui teaching composes, and any genui action click is inert (no hidden turns from a
 *  disabled modality — the SAME law `SURFACE_A2UI_KEY` already states for A2UI surface actions). */
export const SURFACE_GENUI_KEY = 'surfaceGenui'

/** Fail-closed read for the genui modality's OWN inverse-default: absent/malformed ⇒ OFF (unlike
 *  `isEnabledFlag`'s "absent ⇒ ON" law, which the two live-since-launch modalities use). An explicit
 *  stored `true` is the only way this surface turns on. */
export function isGenuiSurfaceEnabled(value: unknown): boolean {
  return value === true
}

/** genui-surface.spec.md v0.5 §11 (SPEC-R10 amended clause, GH #316/ADR-0162) — "Use agent-ui
 *  components", the dogfood toggle: ON loads the fleet's own docs-like asset pair into the genui frame
 *  and composes the SPEC-R13 dogfood prompt segment; OFF (the default — the SAME inverse-default law
 *  `SURFACE_GENUI_KEY` uses) is the row's byte-identical-to-today state. A per-agent sub-setting of the
 *  GenUI modality, never independently meaningful while `SURFACE_GENUI_KEY` itself is off (the runner
 *  reads both — `genuiOn && dogfoodOn` — so a stale `true` here left over from a prior session can never
 *  compose bytes or mount assets while the modality itself is off). */
export const SURFACE_GENUI_DOGFOOD_KEY = 'surfaceGenuiDogfood'

/** Fail-closed read for the dogfood toggle's OWN inverse-default: absent/malformed ⇒ OFF (the SAME
 *  `isGenuiSurfaceEnabled` shape). An explicit stored `true` is the only way this sub-setting turns on. */
export function isGenuiDogfoodEnabled(value: unknown): boolean {
  return value === true
}

// ── Planner-stage pilot (ADR-0174 cl.1 / SPEC-R21) ────────────────────────────────────────────────────
// The opt-in seam for the sequential plan→execute→synthesize host loop (`site/lib/plan-runner.ts`'s
// `runPlannerTurn`). A persona-scoped, `ProduceOptions`-ADJACENT knob (ADR-0174 cl.1): the HOST LOOP reads
// it BEFORE deciding which shape to run — the single-`produce()`-call microloop (today's shape, gate
// OFF/absent) or the multi-call plan→execute→synthesize loop (gate ON) — never inside `produce()` itself,
// which stays a plain per-call primitive either way. All three stages (planning/executing/synthesizing)
// stay INTERNAL (ADR-0174 cl.6 — no stage UI); this is the ONE user-facing lever the pilot introduces.

/** Planner-stage surface — ON: the persona's turns MAY run the opt-in sequential host loop instead of a
 *  single dispatch; OFF (the default — the SAME inverse-default law `SURFACE_GENUI_KEY` uses): every turn
 *  runs today's single-dispatch path, byte-identical, even when a model volunteers a `plan` declaration
 *  anyway (SPEC-R20's degrade law — the host never consumes it while this gate is off). */
export const SURFACE_PLANNER_KEY = 'surfacePlanner'

/** Fail-closed read for the planner modality's OWN inverse-default: absent/malformed ⇒ OFF (the SAME
 *  `isGenuiSurfaceEnabled` shape). An explicit stored `true` is the only way this surface turns on. */
export function isPlannerSurfaceEnabled(value: unknown): boolean {
  return value === true
}

// ── Persona authoring (ADR-0178 cl.3 / SPEC-R30) ──────────────────────────────────────────────────────
// The opt-in seam for the conversational persona-hydration flow: with this on, the turn's composed system
// prompt teaches the `personaPatch` meta-line arm (SPEC-R29), and the host applies a declared patch to the
// draft persona's store through the three-filter gate (ADR-0178 cl.2 — enumerated-key filter → per-key
// sanitizer → `validateNewEntry`). Persona-scoped rather than flow-hardcoded on purpose: flipping it ON
// for an ORDINARY persona is exactly the entry point ADR-0178 cl.6's deferred NL-edit slice needs, so the
// seam is built once. The host-authored Builder persona seeds it ON; every other persona ships it OFF.

/** Authoring surface — ON: the persona's turns are taught the `personaPatch` arm and a declared patch is
 *  applied to the draft persona's store; OFF (the default — the SAME inverse-default law
 *  `SURFACE_GENUI_KEY` uses): zero teaching bytes compose and a volunteered `personaPatch` is NEVER
 *  consumed (SPEC-R30's degrade law, the SPEC-R21 lineage — the field still rides the wire, gate-blind,
 *  exactly as a volunteered `plan` does; what the gate withholds is consumption). */
export const SURFACE_AUTHORING_KEY = 'surfaceAuthoring'

/** Fail-closed read for the authoring modality's OWN inverse-default: absent/malformed ⇒ OFF (the SAME
 *  `isGenuiSurfaceEnabled`/`isPlannerSurfaceEnabled` shape). An explicit stored `true` is the only way
 *  this surface turns on. */
export function isAuthoringSurfaceEnabled(value: unknown): boolean {
  return value === true
}

/** The A2UI catalog picker's persisted selection (an id from `A2UI_CATALOG_OPTIONS`). */
export const A2UI_CATALOG_KEY = 'a2uiCatalog'

/** The pickable catalogs (ADR-0169 cl.6 — the second entry, the upstream A2UI v0.9.1 Basic Catalog): the
 *  picker offers the SHORT id only, never the canonical URI alias (cl.13) — `sanitizeCatalog`, the
 *  picker build (`agent-admin.ts`), and the live-runner threading (`site/lib/admin-live-runner.ts`) all
 *  pick a new entry up with zero further edits, the seam was built for exactly this. ADR-0170 (booked
 *  Repair, narrowing this comment): the PICK-FROM-LIBRARY half of Kim's 2026-07-19 ruling lands with that
 *  record — this array IS the "Registered catalogs" library pack's source (cl.7), projected live. Only
 *  the CREATE/authoring affordance still lands separately, when a source registry that can mint a new
 *  catalog exists; its seam is the catalog kind's suppressed custom-add form (ADR-0170 cl.8).
 *
 *  `description` (ADR-0170 cl.7, OPTIONAL) is PRESENTATION copy for the library pack/menu row and the
 *  roster row only — `sanitizeCatalog` reads `id` alone, and the wire never sees it; omitting it degrades
 *  to an empty description line, which `entry-list.ts` already skips. A THIRD registered catalog is ONE
 *  row here: sanitize, the runner threading, AND the "Registered catalogs" pack all pick it up with zero
 *  further edits (the pack IS this array, mapped — no hand-copied trio table, so no parity test to
 *  forget). */
export const A2UI_CATALOG_OPTIONS: ReadonlyArray<{ id: string; label: string; description?: string }> = [
  {
    id: 'agent-ui',
    label: 'Default (agent-ui)',
    description: "The fleet's own catalog — every ui-* control the renderer paints, mapped 1:1.",
  },
  {
    id: 'a2ui-basic',
    label: 'A2UI Basic (upstream v0.9.1)',
    description: "Upstream A2UI's own core component set, rendered onto fleet controls (ADR-0169).",
  },
]

export const DEFAULT_A2UI_CATALOG_ID: string = 'agent-ui'

/** M-D (`persona-catalog-composition.spec.md` SPEC-R3, ADR-0172 cl.2) — every DERIVED catalogId
 *  `composePersonaCatalogs` (`@agent-ui/a2ui`'s `renderer.ts` constructor, SPEC-R2) registers, for
 *  every shipped persona package and every base its own `targetCatalogs` names. `derivedCatalogIdsFor`
 *  is the SAME persona/`targetCatalogs` metadata projection the constructor's derive-then-register
 *  step reads — a static computation, not a live registry lookup (this module is pure data; no
 *  renderer/registry instance exists here to ask). A persona whose fragment targets BOTH bases
 *  contributes TWO recognized ids, one per base (SPEC-R3 AC3's own widening requirement). */
const DERIVED_A2UI_CATALOG_IDS: ReadonlySet<string> = new Set(derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS))

/** Fail-closed catalog read — an unknown/malformed stored value coerces to the default id. Recognizes
 *  BOTH a registered base id (`A2UI_CATALOG_OPTIONS`, unchanged — SPEC-R3 AC2) and any registered
 *  DERIVED catalog id (`DERIVED_A2UI_CATALOG_IDS`, SPEC-R3 AC1/AC3) — the widening is additive: the
 *  original 2-entry allowlist's own behavior for `agent-ui`/`a2ui-basic` is untouched. */
export function sanitizeCatalog(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_A2UI_CATALOG_ID
  if (A2UI_CATALOG_OPTIONS.some((option) => option.id === value)) return value
  if (DERIVED_A2UI_CATALOG_IDS.has(value)) return value
  return DEFAULT_A2UI_CATALOG_ID
}

// ── the persona's local-pattern-set SELECTION (M-D SPEC-R5, ADR-0172 cl.1) ─────────────────────────────
// The persona's runtime state carries only WHICH `catalog/personas/<persona-id>/` local set (or none) it
// composes onto its base catalog — never the pattern DEFINITIONS themselves (those are package-shipped
// code, SPEC-R1). Symmetrical in storage shape to `A2UI_CATALOG_KEY`: a single persisted string, the
// SAME fail-closed-sanitized law.

/** The persisted selection key — a `SHIPPED_PERSONA_CATALOGS` `personaId`, or unset (no local set). */
export const A2UI_LOCAL_PATTERNS_KEY = 'a2uiLocalPatterns'

/** Fail-closed local-pattern-set read: an unset/malformed/unknown value coerces to "none selected"
 *  (`undefined`) — the SAME fail-closed law `sanitizeCatalog` uses for its own unknown-id case. */
export function sanitizeLocalPatterns(value: unknown): string | undefined {
  return typeof value === 'string' && SHIPPED_PERSONA_CATALOGS.some((p) => p.personaId === value) ? value : undefined
}

/**
 * SPEC-R5 AC3 — the effective catalogId a persona's turn actually resolves to: the selected local
 * set's DERIVED catalog for `baseId`, when a selection exists AND its fragment actually targets
 * `baseId` (checked against `derivedCatalogIdsFor`'s own registered-pairing enumeration — the SAME
 * projection `sanitizeCatalog` reads, so this can never name a derived id `composePersonaCatalogs`
 * never actually registered); else `baseId` alone — the SAME fail-closed degrade `selectCatalog`'s own
 * unknown-id case already has (ADR-0169 cl.3), never a hard error and never the WRONG derived id when
 * the selection's own base doesn't match the persona's CURRENT `A2UI_CATALOG_KEY` base.
 */
export function resolveEffectiveCatalogId(baseId: string, localPatternsSelection: unknown): string {
  const personaId = sanitizeLocalPatterns(localPatternsSelection)
  if (personaId === undefined) return baseId
  const candidate = derivedCatalogId(baseId, personaId)
  return DERIVED_A2UI_CATALOG_IDS.has(candidate) ? candidate : baseId
}

// ── the persona's persisted BANKROLL (GH #525) ────────────────────────────────────────────────────────
// A games-category capability, not every games persona's: a persona whose games keep a running score at
// a FIXED data-model path (`/bankroll`) may opt in (design call 2, 2026-08-07) so `agent-admin.ts`
// mirrors that pointer into the persona store after every surface turn and states the stored figure back
// at turn start (`composeLiveSystemPrompt`) — a fresh session resumes the running total instead of a
// fresh seed stake. Croupier opts in first (`agent-admin-presets.ts`); the mechanism itself is generic —
// any future games persona whose surface carries the SAME `/bankroll` pointer convention can opt in too.

/** The persona-scoped capability opt-in — the SAME inverse-default law `isGenuiSurfaceEnabled` uses
 *  (absent/malformed ⇒ OFF): a persona whose games do not keep a `/bankroll` pointer must never have its
 *  turns scanned for one, so this stays an explicit `true` a preset seeds, never an ambient default. */
export const BANKROLL_CAPABLE_KEY = 'bankrollCapable'

/** Fail-closed capability read — an unset/non-boolean/`false` value all read as "not capable". */
export function isBankrollCapable(value: unknown): boolean {
  return value === true
}

/** The persisted bankroll figure itself — a plain non-negative finite number (the surface's own chip-
 *  count widget formats it for display; this key holds the raw figure the prompt cites and the next
 *  session's game seeds from). */
export const BANKROLL_KEY = 'bankroll'

/** Fail-closed bankroll read — the SAME fail-closed law `sanitizeLocalPatterns`/`sanitizeCatalog` use for
 *  their own unset/malformed case: non-finite, negative, or absent all coerce to `undefined` ("no stored
 *  bankroll" — the 2026-08-07 design ruling's own words; the seed default applies). */
export function sanitizeBankroll(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
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
  /** ADR-0168 cl.5 (GH #402) — the ENABLED tool-entry labels (the `tool` kind, gated on the config's
   *  `toolsEnabled` master switch), forwarded raw: the SAME field, read the SAME way, that the surface
   *  arm's `AdminSurfaceTurnRequest.integrations` below already carries — the host's `/chat` route
   *  intersects them with ITS integration registry and ignores everything else, so the component still
   *  knows entry labels and never the registry. Absent/empty ⇒ no tools on the turn. The prose arm was
   *  the one live arm enablement never reached (the silent no-op #402 reported); now it does. */
  integrations?: readonly string[]
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
 *  turn's prose note (the ADR-0088 meta-line, already peeled by the runner — never ingested), a
 *  live-turn progress stage (the ADR-0146 F1 meta-line, routed to `AgentTurnHandle.progress`), or a
 *  genui-surface SPEC-R1 wire line (fed to `AgentTurnHandle.mountGenui` — routes by `surfaceId` to an
 *  inline `ui-sandbox-frame`, the PARALLEL mount mechanism SPEC-R8/PRD-G8 names — never `ingestLine`,
 *  which is A2UI-shaped and parses `surfaceId` off `createSurface`/`updateComponents`/etc envelope keys a
 *  genui line never carries). The runner already validated the genui envelope (SPEC-R1's `readGenuiLine`)
 *  before emitting this kind — the component never re-validates it. */
export type AdminSurfaceTurnEvent =
  | { kind: 'line'; line: string }
  | { kind: 'note'; note: string }
  | { kind: 'progress'; progress: TurnProgress }
  | { kind: 'genui'; surfaceId: string; html: string }
  /** ADR-0178 cl.2 / SPEC-R29 — a model-declared persona patch, peeled off the meta-line by the runner
   *  exactly as `note`/`progress` are. The peel is GATE-BLIND by design: whether this patch is ever
   *  CONSUMED is the component's decision alone (the store-identity fence AND a fresh gate read,
   *  conjunctive), and a second enforcement point in the runner could only drift from it. */
  | { kind: 'patch'; patch: PersonaPatch }
  /** ADR-0182 cl.4 / SPEC-R20 — a model-declared plan, peeled off the meta-line by the runner exactly as
   *  `patch`/`note`/`progress` are. The ALREADY-SHIPPED `plan` arm, reused verbatim (no new wire shape):
   *  here it carries the Builder-mission's open-sections view, per the runner's derived `builderMission`
   *  gate (ADR-0182 cl.1) rather than a new field of its own. */
  | { kind: 'plan'; plan: PlanDeclaration }

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
  /** The composer's Effort picker selection (the Figma chat-input refactor) — same ephemeral,
   *  per-conversation dial as `AdminTurnRequest.effort` above; `undefined` if the picker was never
   *  shown/committed. A runner that ignores it (or the value maps to no real dial) degrades the DIAL,
   *  never the request. */
  effort?: EffortLevel
  /** GH #49 — the ENABLED tool-entry labels (the `tool` kind, gated on the config's `toolsEnabled`
   *  master switch), forwarded raw: the dev proxy intersects them with ITS integration registry and
   *  ignores everything else — the component knows entry labels, never the registry. Absent/empty ⇒
   *  no tools on the turn. */
  integrations?: readonly string[]
  /** Vision rev.6 — the Surface Options catalog picker's SANITIZED selection (`A2UI_CATALOG_OPTIONS`).
   *  ADR-0169 cl.5/cl.6 — the runner (`site/lib/admin-live-runner.ts`) forwards this onto the produce
   *  POST body (absent ⇒ omit the key), where the server selects the matching registered catalog. */
  catalogId?: string
  /** genui-surface.spec.md SPEC-R10/R11 — the GenUI modality's live-apply signal, a FRESH store read every
   *  turn (the same live-apply law every other Surface Options/capability field already follows).
   *  `enabled` gates whether the runner's `ProduceOptions.genuiSurface` composes the teaching block at
   *  all; `sourceBody`, when present, is the D3-picked `pattern-source` entry's `content` VERBATIM (never
   *  a pack id the runner looks up itself — `pickedPatternSource`'s own projection already resolved it).
   *  Absent/`enabled:false` ⇒ the runner must compose zero genui bytes (SPEC-R10's degradation law).
   *  `dogfood` (v0.5 §11, GH #316/ADR-0162) — the SAME per-field live-apply signal, already `false`
   *  whenever `enabled` is `false` (the component's own read); gates whether the runner's
   *  `ProduceOptions.genuiSurface.dogfood` composes SPEC-R13's dogfood segment. */
  genui?: { enabled: boolean; sourceBody?: string; dogfood?: boolean }
  /** GH #418 — the A2UI modality's OWN live-apply signal (`SURFACE_A2UI_KEY`, a FRESH store read every
   *  turn, the SAME law `genui` above follows). Gates whether the runner's `ProduceOptions.a2uiEnabled`
   *  composes the A2UI grammar/catalog/examples/mini-skills block at all (`buildSystemPrompt`'s 7th
   *  parameter). Absent/`true` ⇒ byte-identical to before this field existed — the full A2UI teaching,
   *  unconditionally (every runner written before this field existed already behaves this way). `false` ⇒
   *  the runner must compose zero A2UI-grammar bytes: this client has no A2UI renderer available this
   *  turn (the toggle is off), so teaching the model to emit A2UI JSONL here would only mislead it. */
  a2uiEnabled?: boolean
  /** ADR-0178 cl.3 / SPEC-R30 — the persona-authoring gate's OWN live-apply signal (a FRESH read of the
   *  DRIVING store's `SURFACE_AUTHORING_KEY` at request-build time, the SAME law `genui`/`a2uiEnabled`
   *  above follow). Gates whether the runner's `ProduceOptions.authoringSurface` composes the
   *  `personaPatch` teaching block at all. Absent ⇒ the POST body carries no `authoring` key and the
   *  composed prompt is byte-identical to before this field existed.
   *
   *  This field teaches; it never authorizes. A patch that arrives anyway is still subject to the
   *  component's own consumption condition, which this signal is only one conjunct of. */
  authoring?: boolean
  /** ADR-0178 cl.5 — WHICH conversation this turn belongs to, so the runner can keep one producer
   *  `Session` per context. Absent = `'test'`, byte-compatible with every caller written before the
   *  authoring flow existed.
   *
   *  Two contexts, two histories, by necessity rather than tidiness: the Builder interview and the
   *  draft's own test chat are different agents' transcripts, and one shared session would feed the
   *  interview to the draft as its own memory — the draft would "remember" being designed.
   *
   *  ADR-0182 cl.1 — this field is ALSO the sole, structurally-guaranteed source of the runner's
   *  derived `builderMission` gate (`session === 'authoring'`): a fact never carried as a separate
   *  field on this interface, since `session` already answers it exactly. */
  session?: 'authoring' | 'test'
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
