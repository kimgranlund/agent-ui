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
import type { AskDeclaration } from '@agent-ui/a2ui/agent/meta-line' // GH #802 (ADR-0097 §1) — the declared feed-ask shape ({surfaceId}), the SAME type-only import as PersonaPatch/PlanDeclaration above
import type { TeamDeclaration } from '@agent-ui/a2ui/agent/meta-line' // GH #1196 (ADR-0203 clause 4) — the declared team-roster shape, the SAME type-only import as PersonaPatch/PlanDeclaration/AskDeclaration above
export type { TeamDeclaration } // re-exported so `agent-admin.ts` (which never imports @agent-ui/a2ui directly) can name the type for its own `#teamDeclaredRequest`/`onTeamDeclared` seam
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

/** GH #880 (Kim's ruling, 2026-08-14) — the AUTHORING (Builder Interview) context's own default: Sonnet 5,
 *  not the roster-wide `DEFAULT_MODEL_ID` above. The rationale is the same one the Builder preset's own
 *  Sonnet-class id already carries (agent-admin-presets.ts / LLD §15: interview quality IS the product) —
 *  the cheap/fast tier is the right default for a TEST chat, not for the model conducting the interview
 *  that authors an agent. The test context is untouched: it keeps `DEFAULT_MODEL_ID`. */
export const AUTHORING_DEFAULT_MODEL_ID: string = 'claude-sonnet-5'

/** The authoring context's model READ — `sanitizeModel`'s first clause verbatim, only the fallback differs.
 *  A stored value naming a roster model still WINS (an explicit Haiku choice stays Haiku); everything the
 *  roster does not name — the key absent, a non-string, an off-roster id — reads as Sonnet 5. That is a
 *  READ-TIME default and never a migration write (the `entryAvailability` precedent, entry-data.ts): a
 *  Builder store minted before this ruling, an exported/imported persona file, and a bring-your-own store
 *  are all unchanged byte-for-byte, and no store is ever written to make the default true.
 *
 *  ONE fallback rather than two (absent⇒Sonnet, garbage⇒Haiku) on purpose: this function answers "what does
 *  the interview run on when nothing valid says otherwise", and two answers to that question would be
 *  arbitrary at exactly the moment a hand-edited config needs a predictable read. The roster-membership
 *  guard keeps it honest if Sonnet ever leaves `SUPPORTED_MODELS` — an id the picker cannot offer is never
 *  returned; the read degrades to the roster-wide default instead. */
export function sanitizeAuthoringModel(value: unknown, roster: readonly SupportedModel[]): string {
  if (typeof value === 'string' && roster.some((m) => m.id === value)) return value
  return roster.some((m) => m.id === AUTHORING_DEFAULT_MODEL_ID) ? AUTHORING_DEFAULT_MODEL_ID : DEFAULT_MODEL_ID
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

// ── Chat bubble on/off setting (GH #1221, Kim's 2026-08-17 rulings) ───────────────────────────────────
// The Surface tab's toggle for `ui-conversation`'s own reflected `bubbles` prop — whether the host/agent
// message container paints CHROME (the ADR-0160 neutral background) or stays chrome-less. Kim's
// 2026-08-18 morning ruling (GH #1221, resolving the label-vs-look note): the DEFAULT is chrome-LESS —
// contained (padding + radius) but no background/border — so this is a pure PRESENTATION toggle with the
// INVERSE default (absent ⇒ OFF): an explicit stored `true` paints the chrome. `isBubblesChromeEnabled`
// below is that fail-closed read (the `isGenuiSurfaceEnabled` shape).

/** Chat bubbles surface — OFF (the default, per the 2026-08-18 ruling): the host/agent bubble is a padded,
 *  radiused, chrome-less container; ON (an explicit stored `true`): the ADR-0160 neutral background paints.
 *  Never touches the user bubble, and never a mounted Gen-UI/A2UI card's own chrome (GH #1221's OTHER half
 *  hoists the card out of the bubble entirely, independent of this setting). */
export const SURFACE_BUBBLES_KEY = 'surfaceBubbles'

/** Fail-closed read for the bubbles toggle's INVERSE default (GH #1221 morning ruling): absent/malformed
 *  ⇒ OFF (chrome-less); only an explicit stored `true` turns the chrome on. */
export function isBubblesChromeEnabled(value: unknown): boolean {
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

// ── the admin's HELP COPY (GH #844, widened admin-wide by GH #866) ────────────────────────────────────
// The ONE copy source for every explanation `ui-agent-admin` shows — the Surface tab's group headers and
// element rows (GH #844) AND, since GH #866, every section header on the Agent, Capabilities and Context
// tabs. Both consumers read THIS table:
//  - `agent-admin.ts`'s `surfaceRow(...)` takes each row's native `title` hint from `.summary` (those
//    five literal strings used to live inline at the call sites — they are gone; the table is where
//    they live now), and
//  - `admin-help.ts` renders the whole entry — title, summary, expanded body, labeled facts — into the
//    `ui-tooltip` help card the row's question-mark icon opens.
// So the hover hint and the help card can never drift: they are the same record, projected twice at
// different depths. This is DATA, like every other export in this file — no DOM, no copy in the view.
//
// ONE ENTRY PER CONCEPT, NOT PER PLACE (GH #866): the Capabilities tab's `Skills` fold and the Context:
// System view's `Skills` item are the same THING seen twice — an editor and a read-only projection of what
// the agent will actually be handed — so both read the SAME `skill` record rather than two near-identical
// ones drifting apart. That is why the copy explains the concept ("what a skill IS, and what enabling one
// does") instead of describing the widget under the icon.
//
// The catalog entry is a further degree of the same law: its facts are PROJECTED from
// `A2UI_CATALOG_OPTIONS` above rather than restated, so registering a third catalog writes its
// explanation into the help card with zero edits here (the "the pack IS this array, mapped" discipline
// that array's own doc comment already states for the library pack).
//
// RECONCILED WITH THE SCHEMA, never a second copy of it: the `agent` entry's own summary IS
// `agentConfigSchema()`'s section description, and its facts are that section's per-field `description`
// strings — read from the schema at module init, so an edit up there lands in the card with no edit here
// (GH #844's "sourced from / reconciled with the schema's description fields", now mechanical).
//
// The bodies are PLAIN structured prose — no markdown syntax (GH #844's ruled default: structured markup,
// `ui-markdown` only if the copy genuinely needs it). Keep it that way: `admin-help.ts` renders each
// paragraph as textContent, so a stray `**bold**` here would paint its own asterisks.

/** Dialog Turns retention cap (vision rev.5) — a bounded ring; the oldest records fall off. Session-
 *  ephemeral by design (like the conversation history): the store persists the agent's CONFIG, never its
 *  traffic. GH #866 moved it here from `agent-admin.ts`: the `context-turn` help card states the figure,
 *  and a hand-copied "20" in prose beside a `const` in the view is exactly the drift this file's own
 *  one-copy-source law exists to prevent. The view imports it back. */
export const TURN_LOG_CAP = 20

/** One labeled fact on a help card — "Default: Off", "Requires: the GenUI modality above, on". */
export interface AdminHelpFact {
  term: string
  detail: string
}

/** One group header's, section header's or element row's whole explanation. */
export interface AdminHelpEntry {
  /** The card's heading — the group/row's own display label, verbatim (also the icon's accessible name). */
  title: string
  /** The one-line gist. ALSO the row's native `title` hover hint — one string, two renderings. */
  summary: string
  /** The expanded explanation, one paragraph per member (at least one). Plain prose, no markup. */
  body: readonly string[]
  /** Optional labeled facts, rendered as a list under the prose. */
  facts?: readonly AdminHelpFact[]
}

/** Every helped surface — the Surface tab's two group headers and every element row it paints (GH #844),
 *  plus every section header on the Agent, Capabilities and Context tabs (GH #866). The union is what
 *  makes a typo a COMPILE error at the call site rather than a silently missing icon. */
export const ADMIN_HELP_KEYS = [
  // — the Surface tab (GH #844) —
  'surface-options',
  'markdown',
  'a2ui',
  'a2ui-catalog',
  'genui',
  'genui-dogfood',
  'planner',
  'authoring',
  'bubbles',
  'pattern-source',
  // — the Agent tab (GH #866) —
  'agent',
  'model',
  'bankroll',
  // — the Capabilities tab (GH #866); `a2ui-catalog`/`pattern-source` above serve the two kinds that
  //   render on OTHER tabs, so this list is the five that actually live here —
  'prompt-section',
  'skill',
  'workflow',
  'resource',
  'tool',
  // — the Context tabs (GH #866). Every per-KIND item there reuses the kind's own entry above
  //   (`helpKeyForKind`); these two are the items that have no editor counterpart at all: the compiled
  //   Agent record, and one logged dialog turn —
  'context-agent',
  'context-turn',
] as const

export type AdminHelpKey = (typeof ADMIN_HELP_KEYS)[number]

/** GH #866 — the Agent card's copy, READ OFF `agentConfigSchema()` instead of restated beside it: the
 *  section's own `description` is the card's one-line gist, and each field's `description` becomes a
 *  labeled fact. GH #844's acceptance asks for copy "sourced from / reconciled with the schema's
 *  description fields"; projecting it is the only version of that which cannot drift. A field that
 *  carries no description contributes no fact (rather than an empty row). */
const AGENT_SCHEMA_SECTION = defaultAgentConfigSchema.sections[0]
const AGENT_SCHEMA_SUMMARY: string =
  AGENT_SCHEMA_SECTION?.description ?? 'The identity and generation behavior this preview reads before every turn.'
const AGENT_SCHEMA_FACTS: readonly AdminHelpFact[] = (AGENT_SCHEMA_SECTION?.fields ?? [])
  .filter((field) => (field.description ?? '').trim().length > 0)
  .map((field) => ({ term: field.label, detail: field.description ?? '' }))

export const ADMIN_HELP: Readonly<Record<AdminHelpKey, AdminHelpEntry>> = {
  'surface-options': {
    title: 'Surface Options',
    summary: 'Which output modalities this agent may use, and how each one is configured',
    body: [
      'Each row here is one output modality — a way this agent is allowed to answer. A modality that is switched off composes no teaching for itself, so the agent is never told to produce something this client would refuse to show.',
      'Markdown and A2UI ship on; GenUI, Planner and Authoring are opt-in and ship off. Switching one off degrades the answer rather than breaking it: anything the model volunteers for a disabled modality is simply never consumed, and any surface left over from an earlier turn goes inert instead of starting a hidden turn.',
    ],
    facts: [{ term: 'Applies', detail: 'from the next turn — every switch is read fresh at turn time, never cached' }],
  },
  markdown: {
    title: 'Markdown',
    summary: 'Rendered as rich text — simple text is the fallback',
    body: [
      "On: the agent's notes and the system bubbles render as rich text — headings, lists, emphasis, links and code paint as real elements, sanitized by construction.",
      'Off: the very same text renders verbatim, character for character. Nothing is lost — the formatting is simply not interpreted.',
    ],
    facts: [{ term: 'Default', detail: 'On' }],
  },
  a2ui: {
    title: 'A2UI',
    summary: 'Structured generative UI against the picked catalog',
    body: [
      'On: a turn may stream A2UI wire lines, which this client renders into real controls — forms, cards, choices the reader can act on. Acting on one sends the agent a follow-up turn, so the surface is a conversation, not a picture.',
      'Off: no A2UI grammar is taught at all, and a surface from an earlier turn stops accepting clicks. A surface the agent tries to render while this is off is announced in the log rather than silently dropped.',
    ],
    facts: [
      { term: 'Default', detail: 'On' },
      { term: 'Configured by', detail: 'the catalog picked directly below this row' },
    ],
  },
  'a2ui-catalog': {
    title: 'Catalog',
    summary: 'The component vocabulary an A2UI surface is rendered against',
    body: [
      'Exactly one catalog is active. It decides both which components the agent is taught to emit and which ones this client will paint, so switching catalogs changes the vocabulary of every surface from the next turn on.',
      'Use "From library" to add a registered catalog to this roster. An entry already in the list is offered disabled rather than hidden, so it is visible why a second copy cannot be added.',
    ],
    // PROJECTED, never restated — see this block's own header comment. A third registered catalog
    // explains itself here for free.
    facts: A2UI_CATALOG_OPTIONS.map((option) => ({ term: option.label, detail: option.description ?? '' })),
  },
  genui: {
    title: 'GenUI',
    summary: 'Sandboxed free-form generative UI — a pattern source, picked below, conditions it',
    body: [
      'On: a turn may compose a free-form surface that mounts inside a sandboxed frame — no catalog, no fixed component set, and no access to this page. The pattern source picked under "Pattern sources" is what conditions the structure and style the agent aims for.',
      'Off: no GenUI teaching composes, and a frame left over from an earlier turn is inert — its actions start no hidden turn.',
    ],
    facts: [{ term: 'Default', detail: 'Off — an explicit opt-in per agent' }],
  },
  'genui-dogfood': {
    title: 'Use agent-ui components',
    summary: "Serve the fleet's own components into the GenUI frame",
    body: [
      "On: the sandboxed frame is served this fleet's own component and token assets, and the turn is taught to build with those elements instead of hand-rolled markup — so a generated surface looks like the rest of this app rather than a stranger inside it.",
      'Only meaningful while GenUI itself is on. With the modality off this setting composes nothing and mounts nothing, even if it was left on in an earlier session.',
    ],
    facts: [
      { term: 'Default', detail: 'Off' },
      { term: 'Requires', detail: 'the GenUI modality above, switched on' },
    ],
  },
  planner: {
    title: 'Planner',
    summary: 'Sequential plan → execute → synthesize host loop — opt-in',
    body: [
      'On: a turn may run as a sequence — the host asks for a plan, executes its steps, then asks for a synthesis — instead of one single dispatch. The stages stay internal: what changes is how the answer is produced, not what the reader sees.',
      'Off: every turn runs the single-dispatch path. A model that volunteers a plan anyway is not stopped from saying so — the host simply never acts on it.',
    ],
    facts: [{ term: 'Default', detail: 'Off — an explicit opt-in per agent' }],
  },
  authoring: {
    title: 'Authoring',
    summary: 'Let this agent propose edits to a draft agent’s own configuration — opt-in',
    body: [
      "On: the turn is taught how to declare a configuration patch, and a patch it declares may be applied to the draft agent's own settings. This is the seam the conversational agent-builder runs on.",
      'This switch teaches; it never authorizes on its own. A declared patch is still filtered key by key, sanitized, and validated before anything is written, and a patch declared outside the dedicated authoring conversation is ignored outright.',
    ],
    facts: [{ term: 'Default', detail: 'Off — an explicit opt-in per agent' }],
  },
  bubbles: {
    title: 'Chat bubbles',
    summary: 'Whether host/agent replies render inside a chat bubble or as flat, chromeless prose',
    body: [
      'On (the default): host/agent replies render inside the same neutral container this client has always used — nothing changes unless this is switched.',
      'Off: the container drops away and the reply renders as plain, full-width prose. Your own messages keep their bubble either way, and any card a reply renders — a form, a choice, a board — keeps its own contained look regardless of this switch.',
    ],
    facts: [{ term: 'Default', detail: 'On' }],
  },
  'pattern-source': {
    title: 'Pattern sources',
    summary: 'The style and structure reference a GenUI turn composes against',
    body: [
      'A pattern source is a body of reference material — markup conventions, a design language, a worked example — handed to a GenUI turn to compose against. Exactly the one picked here rides the turn; the rest stay parked in the list.',
      '"Add pattern source" authors one by hand: a name, an optional description, and the content itself. "From library" adds a shipped source with the typing already done. Both paths commit through the same validation, so a duplicate name is refused identically either way.',
    ],
    facts: [{ term: 'Read by', detail: 'the GenUI modality — with GenUI off, no source composes at all' }],
  },

  // ── the Agent tab (GH #866) — who this agent IS ────────────────────────────────────────────────────
  agent: {
    title: 'Agent',
    // PROJECTED from the schema, never restated — see this block's own header comment. Editing the
    // section's `description` up in `agentConfigSchema()` edits this card.
    summary: AGENT_SCHEMA_SUMMARY,
    body: [
      'This section is the agent itself: the name it answers to, and the dials that shape how a turn is generated. Every field is read FRESH at turn time, so an edit here applies to the next message without a reload and without a save step.',
      'The master switch on this heading row is a different thing from the fields below it: it says whether this agent is available at all. Switched off, the composer stops accepting turns while everything here stays editable — it is a pause, not a delete.',
    ],
    facts: AGENT_SCHEMA_FACTS,
  },
  model: {
    title: 'Model',
    summary: 'Which models this agent may run on, and which one it starts with',
    body: [
      'Each row is one model, grouped by provider. Its switch decides whether the model is OFFERED for this agent at all; the radio beside it picks the one a fresh conversation starts on. Excluding a model never rewrites history — turns already taken keep the model they were taken with.',
      'A model listed here is not necessarily reachable: the roster is this client’s, and whether a given provider actually answers depends on the host it is pointed at. An unreachable pick degrades visibly in the turn log rather than silently falling back to another model.',
    ],
    facts: [{ term: 'Reset Agent', detail: "clears this agent's whole configuration back to its seeded state — the roster included" }],
  },
  bankroll: {
    title: 'Bankroll',
    summary: 'The running figure a games persona carries between sessions',
    body: [
      'Some personas keep a score that must survive a reload — a chip count, a stake, a running total. When one of them plays a turn, the figure its surface holds is mirrored into this agent’s own storage, and the next session is told the stored figure instead of starting from a fresh seed stake.',
      '"Reset" clears the stored figure and nothing else. The next game then opens on its own seed value, exactly as a first-ever session would.',
    ],
    facts: [{ term: 'Shown', detail: 'only for a persona that opts into keeping a bankroll — there is nothing to store otherwise' }],
  },

  // ── the Capabilities tab (GH #866) — what this agent can DO ────────────────────────────────────────
  'prompt-section': {
    title: 'Instructions',
    summary: 'The composed system prompt, one titled section at a time',
    body: [
      'The agent’s system prompt is not one blob of text: it is this ordered list of titled sections, joined in order at turn time. Writing them separately is what makes one instruction editable, reorderable or switchable off without disturbing the rest.',
      'A section’s switch decides whether it composes at all. Switched off it stays here, fully editable, and simply contributes nothing to the next turn — the way to try an instruction’s absence without losing the words.',
    ],
    facts: [{ term: 'Applies', detail: 'from the next turn — the prompt is composed fresh every time, never cached' }],
  },
  skill: {
    title: 'Skills',
    summary: 'Named procedures the agent is taught it knows how to carry out',
    body: [
      'A skill is a piece of know-how written as prose: how to run a review, how to draft a release note, what "done" means for a recurring task. Enabled skills are named to the agent in its composed prompt, so it can recognise when one applies.',
      'Each row carries a mode. "In context" means the agent is told about the skill every turn, which is what you want for the handful it should always have in mind. "Invocable" keeps it out of the standing prompt and reachable on demand — the way to keep a long shelf without spending the whole prompt on it.',
    ],
    facts: [{ term: 'Master switch', detail: 'off ⇒ no skill composes at all, whatever the individual rows say' }],
  },
  workflow: {
    title: 'Workflows',
    summary: 'Multi-step procedures with an order the agent should keep',
    body: [
      'A workflow is a skill with a sequence: the steps, their order, and what has to be true before moving on. Enabled workflows are named to the agent the same way skills are, so it can follow one rather than improvising an order of its own.',
      'The same per-row mode applies: keep the few it should always follow in context, and leave the rest invocable so a long shelf costs nothing until it is actually asked for.',
    ],
    facts: [{ term: 'Master switch', detail: 'off ⇒ no workflow composes at all, whatever the individual rows say' }],
  },
  resource: {
    title: 'Resources',
    summary: 'Reference material the agent may consult while answering',
    body: [
      'A resource is knowledge rather than know-how: a policy, a glossary, a specification, a page of house style. Enabled resources are made available to the agent so an answer can be grounded in them instead of in a guess.',
      'Resources are usually the biggest thing on this tab, which is exactly what the per-row mode is for: keep the one or two that belong in every answer in context, and mark the reference shelf invocable.',
    ],
    facts: [{ term: 'Master switch', detail: 'off ⇒ no resource composes at all, whatever the individual rows say' }],
  },
  tool: {
    title: 'Tools',
    summary: 'Actions the agent may ask the host to take on its behalf',
    body: [
      'A tool is something the agent can DO rather than something it knows — look a record up, call a service, fetch a live figure. Enabled tool names ride the turn, and the host decides which of them it actually recognises and is willing to run.',
      'A tool named here that the host does not recognise is ignored rather than failed: this list is the agent’s side of the contract, never the host’s registry. That is also why renaming a row is safe — the underlying identifier the host matches on is never rewritten.',
    ],
    facts: [{ term: 'Master switch', detail: 'off ⇒ no tool rides the turn at all, whatever the individual rows say' }],
  },

  // ── the Context tabs (GH #866) — what the agent actually receives, and what it answered ────────────
  'context-agent': {
    title: 'Agent',
    summary: 'The compiled record a turn is actually built from — read-only',
    body: [
      'This is the whole configuration as the next turn will read it: the identity and generation dials, every surface modality’s live state, and the fully composed system prompt itself, verbatim. It is derived, never edited — the tabs to the left are where these values are set.',
      'It updates the moment anything it reads changes, which makes it the place to answer "did that setting actually reach the agent?" without taking a turn to find out.',
    ],
    facts: [{ term: 'Read-only', detail: 'a projection of the store, rebuilt on every change' }],
  },
  'context-turn': {
    title: 'Dialog turn',
    summary: 'One exchange, recorded exactly as it went over the wire',
    body: [
      'Each entry is a single turn: which arm ran it, the request that was sent — system prompt, model, history and all — and the response that came back. Newest first, and the newest one opens by default.',
      'This is a session-local trace kept to help you see what actually happened; it is bounded, so the oldest turns fall off as new ones arrive, and none of it is persisted with the agent’s configuration.',
    ],
    facts: [{ term: 'Retention', detail: `the last ${TURN_LOG_CAP} turns of this session — never saved with the agent` }],
  },
}

/**
 * GH #866 — the OPT-IN seam that decides whether an entry-list SECTION carries a help icon on its own
 * heading row, and which record it opens: the `ADMIN_HELP` key explaining `kind`, or `undefined` for a
 * kind that opts out (which mounts no icon at all).
 *
 * DEFAULT-OFF BY CONSTRUCTION, and deliberately here rather than inside `mountEntryList`: the entry-list
 * primitive has been HEADLESS since GH #225 — a section's header IS the consuming fold's `ui-disclosure`
 * summary row (ADR-0158), which the primitive neither owns nor can reach. Teaching it to mint a header
 * would hand every one of its consumers a heading it deliberately does not have. So the seam is a pure
 * lookup the CONSUMER applies to its own fold: a bare `mountEntryList(...)` mounts zero help icons,
 * unchanged, and an unrecognised kind mounts none either.
 *
 * The `catalog` kind maps onto the SAME `a2ui-catalog` record its Surface-tab card already uses — one
 * concept, one explanation (see this block's header comment).
 */
export function helpKeyForKind(kind: string): AdminHelpKey | undefined {
  return KIND_HELP_KEYS[kind]
}

const KIND_HELP_KEYS: Readonly<Record<string, AdminHelpKey>> = {
  'prompt-section': 'prompt-section',
  skill: 'skill',
  workflow: 'workflow',
  resource: 'resource',
  tool: 'tool',
  'pattern-source': 'pattern-source',
  catalog: 'a2ui-catalog',
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
  /** The sanitized `SUPPORTED_MODELS` id — the DRIVING context's own read (GH #880): `sanitizeModel`
   *  (`DEFAULT_MODEL_ID` fallback) for the test chat, `sanitizeAuthoringModel` (Sonnet 5 fallback) for the
   *  Builder Interview. A stored choice wins on either. */
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
  /** ADR-0198 cl.1 — the model's explicit ask-flow completion declaration (`flowEnd: true` on the
   *  meta-line), peeled by the runner exactly as `note`/`patch`/`plan` are. PAGE-CHROME territory by
   *  contract (ADR-0198 cl.3): the page's own wrapper consumes it to present the shared end-of-flow
   *  affordance row and filters it out; the component itself ignores this kind (its chat log is not
   *  where the affordance lives, and a model that never emits it costs nothing — the safe-degrade law). */
  | { kind: 'flowEnd' }
  /** ADR-0182 cl.4 / SPEC-R20 — a model-declared plan, peeled off the meta-line by the runner exactly as
   *  `patch`/`note`/`progress` are. The ALREADY-SHIPPED `plan` arm, reused verbatim (no new wire shape):
   *  here it carries the Builder-mission's open-sections view, per the runner's derived `builderMission`
   *  gate (ADR-0182 cl.1) rather than a new field of its own. */
  | { kind: 'plan'; plan: PlanDeclaration }
  /** GH #802 (ADR-0097 §1) — a model-declared FEED ASK, peeled off the meta-line by the runner exactly as
   *  `note`/`progress`/`patch`/`plan` are. It carries the ROUTING FACT only ("that surfaceId is an ask") —
   *  the ask's own surface rides the ordinary `line` stream, unchanged. The component reads it as the
   *  DIALOG-ROUND discriminator (`agent-admin.ts`'s `#askSurfaceIds`/`#resumeTargetFor`): an answered ask is
   *  never updated (the grammar's own law), so the reply to one opens a NEW round instead of resuming its
   *  bubble — while every NON-ask surface keeps TKT-0079's stay-in-the-card resume, byte-unchanged. */
  | { kind: 'ask'; ask: AskDeclaration }
  /** GH #1196 (ADR-0203 clause 4) — a model-declared TEAM ROSTER, peeled off the meta-line by the
   *  runner exactly as `note`/`patch`/`plan`/`ask` are. The peel is GATE-BLIND by design (the SAME
   *  law `patch` follows): whether this declaration is ever CONSUMED — minting N personas plus an
   *  `AgentTeam` record — is the component's decision alone (the SAME store-identity fence AND fresh
   *  `SURFACE_AUTHORING_KEY` read the `patch` arm already applies), surfaced onward through the
   *  `onTeamDeclared` callback rather than mutated here: persona minting/roster registration/team
   *  persistence are all SITE-owned (`saveImportedPersona`/`mintBlankPersona`/`saveAgentTeam` live in
   *  `site/pages/*`, never in this package — preserving the DAG this package's own layering rules fix). */
  | { kind: 'team'; team: TeamDeclaration }

/** A surface turn's request. `turn` mirrors the producer's two arms: a typed user intent, or a surface
 *  client message (an action click / function response bubbled up via `onClientMessage`) — `message` is
 *  deliberately `unknown` here (the component never inspects it; the runner casts at its own boundary). */
export interface AdminSurfaceTurnRequest {
  turn: { kind: 'intent'; text: string } | { kind: 'client'; message: unknown }
  /** The composed persona (`composeLiveSystemPrompt(...)`) — rides the producer's ADR-0138 persona seam,
   *  appended AFTER the catalog law (voice/content only, never the wire format). */
  personaSystem: string
  /** The sanitized `SUPPORTED_MODELS` id — the DRIVING context's own read, exactly `AdminTurnRequest.model`
   *  above (GH #880: Sonnet 5 is the Builder Interview's fallback, `DEFAULT_MODEL_ID` the test chat's). */
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
