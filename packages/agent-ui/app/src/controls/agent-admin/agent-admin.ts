// agent-admin.ts — UIAgentAdminElement, the Agent Admin UI (TKT-0039, ADR-0131/ADR-0132): a live-editable
// agent config + instructions with a working chat preview, composing the shipped M2 (`ui-conversation`)
// and M5 shell-archetype (`ui-super-shell`, GH #52/ADR-0154 — GH #700 flattened out the `ui-chat-shell`
// hop: that preset contributed nothing to this element but the `narrow-start="stack"` default, now set
// directly below) + M4 (`ui-settings`) primitives PLUS the generic ordered-entry-list primitive
// (`entries.ts`/`entry-list.ts`, ADR-0132) — no new primitive FAMILY beyond that one, no new protocol
// dependency.
//
// ONE composed `ui-super-shell` (GH #52/ADR-0154 via the retired `ui-chat-shell` preset, re-hosted again
// by ADR-0179, then again by GH #686's Amendment, then flattened to a direct composition by GH #700 —
// superseding vision rev.5's hand-rolled `ui-split` composition, which itself superseded
// ADR-0131 cl.2's three-pane order): `header` = the unified header bar (S7-c, admin-three-pane-ia.lld.md
// §16.1/§16.3/§16.4 — the pane nav that used to occupy this slot is retired; this replacement is a
// different shape, not a restoration: agent select + pane pills/segments + page actions, never a mode
// switcher), `content` = the pane holder — three sibling regions (Chat · Settings · Co-pilot), a shown-SET + a
// primary member deciding what paints at a given band (§16.2) — no more pairing vehicle, no more single
// active place. The old single resizable options-pane end retired with cl.1 first
// (admin-three-pane-ia.lld.md §7); the settings content it used to hold now lives in the Settings
// region. GH #574 split the old single flat "Settings" segment (ten folds, three ranks flattened
// into one scroll) into three ranked ones, Kim's ruling: Agent — who it is (Agent/Model/Bankroll);
// Capabilities — what it can do (Instructions/Skills/Workflows/Resources/Tools); Surface — how it
// renders (Surface Options/Pattern sources). Since GH #225 each fold is a heading-row FOLD (the GH #222
// Context pattern); the Context segments are the
// read-only introspection surface, split in two (GH #161, superseding the single combined "Context"
// tab): "Context: System" (the compiled Agent System JSON) and "Context: Dialog" (the Dialog Turns
// payload log). Composition is idempotent — the `master-detail.ts`/`settings.ts` `#compose()`
// precedent: built ONCE at first connect, never rebuilt on a later reconnect.
//
// ADR-0132 replaced the single free-text prompt + flat-only settings with FIVE instantiations of one
// generic entry-list primitive: prompt sections (Foundation/Personality/Critical Items, seeded,
// toggle-off-only); Skills/Workflows/Resources/Tools (unseeded, purely custom-authored) alongside the
// "Agent" flat config — spread across the Agent/Capabilities tabs since GH #574. All five share ONE shared `SettingsStore` instance
// (settings/store.ts) — one persisted config, five slices of it. Vision rev.5 adds the MASTER switches:
// the Agent ACTIVE toggle (`agentEnabled` — OFF disables the composer, no turns run) and one per
// capability kind (`${kind}sEnabled` — OFF gates the whole kind out, winning over per-entry toggles;
// the `tool` kind's key IS the old `toolsEnabled`, whose Agent-card field retired in the same change).
//
// LIVE-APPLY (ADR-0131's "no manual reload" requirement, now ADR-0132's richer version): the stub turn
// loop reads the store's CURRENT entries at turn time — a `composeSystemPrompt` over the enabled prompt
// sections, plus the enabled labels of each capability kind. No propagation channel exists because none
// is needed — a store read trivially reflects whatever any pane most recently committed.
//
// FAIL-CLOSED: `ui-settings`' own generated fields already validate before commit (SPEC-R11/generate.ts);
// `entries.ts`'s `validateNewEntry` guards every custom entry (a required name, no id collision); an
// empty/all-disabled prompt-section set falls back to `DEFAULT_SYSTEM_PROMPT_FALLBACK` — never an empty
// instruction silently reaching the stub reply.
//
// `controls → @agent-ui/components` (+ this package's own `../settings/`/`../conversation/` siblings)
// only — NEVER `@agent-ui/router`/`@agent-ui/a2a`; the app `layering.test.ts` trip-wire guards it.

import { UIElement, prop, untracked, whenFlushed, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
// Side-effect only: registers these tags before this element (or the `entry-list.ts` sibling it composes)
// ever calls `document.createElement` on one. `button`/`icon` (TKT-0048) register entry-list.ts's
// `entry-add-toggle`/`entry-delete` `<ui-button>`s + the add-toggle's leading `<ui-icon>` explicitly;
// `@agent-ui/code/editor` (ADR-0139, superseding TKT-0049's `textarea`) registers entry-list.ts's
// `entry-content`/`entry-add-content` `<ui-code-editor>`s the same way (the import registers the tag only —
// the CodeMirror runtime stays lazy); `text-field` (TKT-0060) registers its `entry-add-label`/`entry-add-description` `<ui-text-field>`s
// — previously these upgraded only via an incidental transitive path (agent-admin → conversation →
// surface-host → the a2ui default catalog's factories.ts, which value-imports the whole family) that a
// future tree-shaking change could sever. `field` (TKT-0073) registers the `<ui-field>` wrapper entry-list.ts
// now hosts those two text-fields in, so their required-validation message renders outside their own box.
import '@agent-ui/components/controls/switch'
// (`controls/select` used to register here for the Surface Options catalog picker — ADR-0170 cl.6 retired
// that `ui-select`, and this element creates no other one, so the registration went with it.)
import '@agent-ui/components/controls/button'
import '@agent-ui/components/controls/icon'
import '@agent-ui/code/editor'
import '@agent-ui/components/controls/field'
import '@agent-ui/components/controls/text-field'
// S7-c (LLD §16.1/§16.3) — the unified header bar's own controls: `ui-toggle` (S7-a, ADR-0179 GH #686
// Amendment) for the wide pane pills, `ui-segmented-control`/`ui-segment` for the narrow single-select
// rendering of the SAME visibility choice, `ui-select` for the agent roster, and `ui-menu` for the narrow
// `•••` overflow (Import/Export). `ui-icon`/`ui-button` are already registered above.
import '@agent-ui/components/controls/toggle'
import type { UIToggleElement } from '@agent-ui/components/controls/toggle'
import '@agent-ui/components/controls/segmented-control'
import type { UISegmentedControlElement } from '@agent-ui/components/controls/segmented-control'
import '@agent-ui/components/controls/segment'
import type { UISegmentElement } from '@agent-ui/components/controls/segment'
import '@agent-ui/components/controls/select'
import type { UISelectElement } from '@agent-ui/components/controls/select'
import '@agent-ui/components/controls/menu'
import type { UIMenuElement } from '@agent-ui/components/controls/menu'
import type { UIIconElement } from '@agent-ui/components/controls/icon'
// GH #665 — the two conversation regions' own quiet identity kicker (`#makeRegionKicker`): the fleet's
// `ui-text[variant='kicker']` idiom (the nav-rail `context-label` precedent, GH #624), reused rather than
// re-minted — the eyebrow-header dimensions/casing already live there, this file only repoints the ink.
import '@agent-ui/components/controls/text'
// The Model grid's row controls (2026-07-19 rev.2) — ui-switch is already registered above; ui-radio
// registers here for the default-position column (rev.3: a radio SYSTEM — the semantically honest
// pick-exactly-one control; selection coordination stays this element's render, not a ui-radio-group,
// whose roving/one-group contract doesn't fit rows interleaved with switches across provider groups).
import '@agent-ui/components/controls/radio'
import '@agent-ui/components/controls/disclosure' // vision rev.5 — the Context tabs' accordion primitive
// GH #686's Amendment (admin-three-pane-ia.lld.md §16) retires the top-level pane nav that used to be a
// SECOND `ui-tabs` instance below — the Settings place's own internal sub-nav (OQ2, §5) is the
// one survivor: a bare `ui-tabs` host of `ui-tab` children, no `ui-tab-panel`s (the GH #221 composition
// shape, `super-shell.ts`'s own panel-less pane-tabs/narrow-tabs strips). (Originally imported for GH
// #646's try-it bar, which ADR-0179 retired; the pane nav that replaced it is retired in turn here.)
import '@agent-ui/components/controls/tabs'
import type { UITabsElement, UITabElement } from '@agent-ui/components/controls/tabs'
// GH #52 (ADR-0154, agent-admin-shell-rehost.lld.md LLD-C4), re-hosted again by ADR-0179, then again by
// GH #686's Amendment — the shell-archetype grammar still carries exactly two slots: `header` (the
// unified header bar, S7-c's own build, LLD §16.4) and `content` (the pane holder). The old
// options-pane end + `narrow-end="tabs"` six-entry vocabulary retired with ADR-0179 cl.1
// (admin-three-pane-ia.lld.md §7) — replacing, in turn, the original hand-rolled ui-split + narrow
// ui-tabs dual-shell + the ResizeObserver-driven #applyLayout reparenting. GH #700 — this element used
// to reach `ui-super-shell` through the `ui-chat-shell` preset (whose ONLY real contribution here was
// the `narrow-start="stack"` default); it now composes `ui-super-shell` directly and sets that default
// itself (`#compose()` below), removing one wrapper element from every agent-admin DOM tree.
import '../super-shell/super-shell.ts'
import type { UISuperShellElement } from '../super-shell/super-shell.ts'
// GH #686's Amendment (LLD §16.5) retires `ui-master-detail` as the Author⇄Settings pairing vehicle
// entirely: the wireframe's all-active geometry does not fit its 40rem own-container dock floor. The
// three places are three sibling regions now (`#compose`, below) — no more MD import at this element's
// top level (`ui-settings`' OWN internal rail|panel `ui-master-detail`, composed inside the Settings
// region, is unrelated and untouched — settings.ts imports its own copy).
// Vision rev.6 (Surface Options): the Markdown modality renders agent notes through <ui-markdown> —
// sanitized by construction. App → code is the ADR-0139-ruled edge this file already takes for
// `@agent-ui/code/editor`; ui-conversation itself stays code-free (the SPEC-R12 renderer seam carries it).
// GH #468 (the app-diet hunt) — `@agent-ui/code/markdown` moved LAZY: no other app-tier control renders
// markdown (ui-conversation's own banner says it stays code-free), and the modality is OPT-IN, OFF by
// default (`isEnabledFlag`'s own inverse-default law), so a static import here cost every consumer of the
// app barrel the same bytes whether or not Markdown mode was ever switched on. No static reference to
// `@agent-ui/code/markdown` remains anywhere in this file — the `loadMarkdownRenderer`/
// `preloadMarkdownRenderer` pair below (near the dogfood loader, the SAME GH #354 shape) replaces it;
// search "GH #468" for the loader + the render-path fallback.
import { UISettingsElement } from '../settings/settings.ts'
import { UIConversationElement } from '../conversation/conversation.ts'
// genui-surface.spec.md v0.5 §11 (SPEC-R12, GH #316/ADR-0162) — the dogfood frame asset pair rides the
// opt-in `@agent-ui/components/dogfood-frame` subpath (`app` already imports `components`;
// catalog-invisible by construction — the a2ui catalog never maps `ui-sandbox-frame` either way). GH #354
// (Kim's 2026-07-29 ruling) — reached ONLY through the dynamic `import()` in `loadDogfoodAssets()` below;
// the sole STATIC dogfood reference left in this file is the type-only import on the next line (zero bytes).
import type { SandboxFrameAssets } from '@agent-ui/components/components'
// GH #525 — the bankroll RESET row's own trailing `<ui-button>` (TKT-0048's real-button precedent,
// entry-list.ts's `deleteBtn`); `ui-button` is already registered above (`controls/button`).
import type { UIButtonElement } from '@agent-ui/components/controls/button'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsSchema } from '../settings/schema.ts'
import type { SettingsStore } from '../settings/store.ts'
import {
  AGENT_ENABLED_KEY,
  A2UI_CATALOG_KEY,
  DEFAULT_A2UI_CATALOG_ID,
  DEFAULT_MODEL_ID,
  MODELS_INCLUDED_KEY,
  SURFACE_A2UI_KEY,
  SURFACE_MARKDOWN_KEY,
  SURFACE_GENUI_KEY,
  isGenuiSurfaceEnabled,
  SURFACE_GENUI_DOGFOOD_KEY,
  isGenuiDogfoodEnabled,
  SURFACE_PLANNER_KEY,
  isPlannerSurfaceEnabled,
  SURFACE_AUTHORING_KEY,
  isAuthoringSurfaceEnabled,
  defaultAgentConfigSchema,
  isEnabledFlag,
  kindEnabledKey,
  sanitizeCatalog,
  A2UI_LOCAL_PATTERNS_KEY,
  resolveEffectiveCatalogId,
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  isBankrollCapable,
  sanitizeBankroll,
  initialValuesFor,
  isModelIncluded,
  modelRoster,
  sanitizeModel,
  runStubAgentTurn,
  sanitizeNumber,
  type AgentConfigSnapshot,
  type AdminAgentTurn,
  type AdminAgentSurfaceTurn,
  type AdminTurn,
  type AdminTurnRequest,
} from './agent-admin-schema.ts'
import { EFFORT_LEVELS, type EffortLevel } from '../conversation/composer-options.ts'
import {
  ENTRY_KINDS,
  initialEntryValues,
  readCatalogEntries,
  isRegisteredCatalog,
  composeSystemPrompt,
  composeLiveSystemPrompt,
  pickedPatternSource,
  type LiveCapabilityGroup,
  type LiveBankrollState,
} from './entries.ts'
// ADR-0164 cl.2/cl.7 — the generic data core + the section-shell mount function both moved to the shared
// `entry-list/` folder (a `settings/` sibling, public `./entry-data`/`./entry-list` subpaths); this
// element is that extraction's first CONSUMER now, not its owner.
import { entriesStoreKey, readEntries, validateNewEntry, type Entry, type EntryLibraryPack } from '../entry-list/entry-data.ts'
import { mountEntryList, showAddError, type EntryListSection } from '../entry-list/entry-list.ts'
import { lintPromptSections } from './prompt-lint.ts'
// ADR-0178 cl.2 — the three-filter apply gate + the canonical key set it enumerates (LLD-C1). A pure
// module: store in, writes out, a report back — this element owns WHEN it may run, never HOW it filters.
import { applyPersonaPatch, draftStateBlock, type PatchReport } from './persona-patch.ts'

/** GH #686's Amendment (admin-three-pane-ia.lld.md §16.1/§16.2) — the vocabulary re-pins from
 *  ADR-0179 cl.1's `chat | author | settings` to `chat | settings | copilot` (the Builder interview
 *  renamed Co-pilot), and READING ORDER is now load-bearing: `PANE_ORDER` is the one place it is written,
 *  consumed by every DOM-order, `data-show` composition, and primary-repoint site below. */
type Pane = 'chat' | 'settings' | 'copilot'
const PANE_ORDER: readonly Pane[] = ['chat', 'settings', 'copilot']
/** S7-c (LLD §16.1) — each pane's identity glyph + label, the ONE table both header renderings (the wide
 *  pills and the narrow segments) read from, so the two can never drift onto different icons/copy for the
 *  same pane. */
const PANE_IDENTITY: Record<Pane, { glyph: string; label: string }> = {
  chat: { glyph: 'chats-circle', label: 'Chat' },
  settings: { glyph: 'gear-six', label: 'Settings' },
  copilot: { glyph: 'robot', label: 'Co-pilot' },
}

const agentAdminProps = {
  // Non-reflected properties — too structured for an attribute (the `ui-split` `sizes` / `ui-settings`
  // `schema`/`store` precedent). Both default to `undefined` at the PROP level (matching `ui-settings`'
  // own convention exactly — and the ADR-0004 descriptor's `default: undefined` token, which a real
  // object literal cannot represent cleanly) and are lazily assigned a real, usable default in
  // `connected()`: `schema` gets the shared `defaultAgentConfigSchema` (plain, read-only data — safe to
  // share across instances); `store` gets its OWN fresh persisted instance (a shared module-level default
  // would leak state across independently-constructed instances — each element gets its OWN default store).
  schema: { ...prop.json<SettingsSchema | undefined>(undefined), attribute: false as const },
  store: { ...prop.json<SettingsStore | undefined>(undefined), attribute: false as const },
  // The DEV-only live-turn seam (TKT-0052/ADR-0136): default `undefined` ⇒ the stub branch runs, so the
  // static build carries no live-call code (the site page assigns this ONLY under `import.meta.env.DEV`,
  // the a2ui-live.ts construction-site precedent — the packaged component itself stays fetch/env/proxy-free).
  agentTurn: { ...prop.json<AdminAgentTurn | undefined>(undefined), attribute: false as const },
  // The SURFACE-capable live seam (TKT-0076/ADR-0138) — same DEV-only injection discipline as agentTurn.
  // When set it takes PRECEDENCE over agentTurn: the turn streams typed events (validated A2UI wire lines
  // + the peeled prose note) and the wire lines drive `AgentTurnHandle.ingestLine` — REAL inline surfaces
  // (ADR-0129) instead of a prose reply.
  agentSurfaceTurn: { ...prop.json<AdminAgentSurfaceTurn | undefined>(undefined), attribute: false as const },
  // GH #47/#48 — entry-library packs, keyed by entry kind (skill/workflow/...). Non-reflected pure
  // type-carrier (the schema/store precedent). The section SHELL is still built once at compose time
  // (`#makeSection`, the sections' build-once law) — but GH #143 made the add-from-library MENU inside
  // each shell reactive: a post-connect reassignment (a new object reference, the `schema`/`store`
  // identity-change law) re-runs the `connected()` effect and rebuilds just that menu per kind via
  // `EntryListSection.updateLibraries` — e.g. a caller re-scoping which packs apply on a persona/preset
  // switch. Only the menu updates; a section's rendered ENTRIES are unaffected (those already re-render
  // off `store`, a separate signal).
  libraries: { ...prop.json<Record<string, readonly EntryLibraryPack[]> | undefined>(undefined), attribute: false as const },
  // ADR-0178 cl.5 (LLD-C6) — the guided-authoring flow's second composition source. SET ⇒ the flow is
  // ACTIVE: a second conversation mounts beside the test one, its turns compose from THIS store (the
  // host-authored Builder persona's own config), and any patch they declare applies to `store` — the
  // DRAFT. CLEARED ⇒ the authoring context tears down and the element is byte-identically what it was
  // before this prop existed.
  //
  // A prop rather than a flag because the flow needs a whole second persona to compose from, and a prop
  // is this element's one configuration idiom (the `store` shape, verbatim). Crucially it is a SECOND
  // store, never a replacement: `store` is never reassigned by entering, leaving, or flipping the flow
  // (GH #145's reset fires on a real persona switch and on nothing else).
  authoringStore: { ...prop.json<SettingsStore | undefined>(undefined), attribute: false as const },
} satisfies PropsSchema

/** The five ENTRY_KINDS instantiations, each paired with its display copy — the single source of truth
 *  `#compose()`/the reactive effect both iterate, so a future 6th kind (ADR-0132 Fork 2's extensibility)
 *  is one array entry, never new list/toggle/author/render code. */
const CAPABILITY_KINDS: ReadonlyArray<{ kind: string; label: string; addLabel: string; liveHeading: string }> = [
  { kind: ENTRY_KINDS.skill, label: 'Skills', addLabel: 'Add skill', liveHeading: 'Skills available to you' },
  { kind: ENTRY_KINDS.workflow, label: 'Workflows', addLabel: 'Add workflow', liveHeading: 'Workflows available to you' },
  { kind: ENTRY_KINDS.resource, label: 'Resources', addLabel: 'Add resource', liveHeading: 'Resources available to you' },
  { kind: ENTRY_KINDS.tool, label: 'Tools', addLabel: 'Add tool', liveHeading: 'Tools available to you' },
  // genui-surface.spec.md SPEC-R11 (D3/D4) — reuses this SAME generic entry-list section machinery for the
  // GenUI pattern-source picker ("no new list/toggle/author code"): the fold, the add-from-library menu
  // (`genuiPackLibrary`-projected packs), the master switch, and the live-apply store discipline are ALL
  // the existing per-kind mechanism, zero new code. `liveHeading` here is UNUSED in practice — see
  // `#capabilityGroups`' own filter, which excludes this ONE kind from the generic capability projection
  // (its picked entry's body composes through the DEDICATED genui prompt block instead, SPEC-R10 — never
  // BOTH, which would double-inject the identical prose, the exact ADR-0091 §4 defect class).
  { kind: ENTRY_KINDS.patternSource, label: 'Pattern sources', addLabel: 'Add pattern source', liveHeading: 'Pattern sources available to you' },
  // ADR-0170 cl.1 — the A2UI catalog LIBRARY. It rides this SAME machinery with three single-line row
  // exceptions, each named at its own site below: (a) NO master switch is minted for it — the A2UI
  // surface toggle is the gate (cl.5, `#compose`); (b) its section suppresses the authoring form and the
  // per-entry editor (cl.8, `#makeSection`); (c) its toggle/delete write the ONE persisted selection key
  // instead of per-entry flags (cl.3, `#selectCatalog`/`#deleteCatalog`). `addLabel` is dead text under
  // (b) — supplied for the row shape; `liveHeading` is unused in practice, like pattern-source's:
  // `#capabilityGroups` excludes this kind (cl.5), because a catalog selection threads as `catalogId` on
  // the wire and never as prompt prose.
  //
  // GH #488 — this array's ORDER no longer decides this kind's DOM placement: `#compose`'s capability
  // loop special-cases `kind === ENTRY_KINDS.catalog` and mounts its section directly adjacent to the
  // Surface Options A2UI row instead of a top-level `settingsItem` fold (one visual cluster — the toggle
  // + its own catalog choice, replacing the earlier placement in a separate "Catalogs" section far below
  // the modality it configures). `label` still names this kind's Context: System item
  // (`#renderContextSystem`); it just no longer labels a top-level Settings fold.
  { kind: ENTRY_KINDS.catalog, label: 'Catalogs', addLabel: 'Add catalog', liveHeading: 'Catalogs available to you' },
]

/** Dialog Turns retention cap (vision rev.5) — a bounded ring; the oldest records fall off. Session-
 *  ephemeral by design (like `#history`): the store persists the agent's CONFIG, never its traffic. */
const TURN_LOG_CAP = 20

/** GH #63 — max CONSECUTIVE renderer-error-driven surface turns before the loop halts visibly (the
 *  produce() `maxRounds: 3` self-correct discipline, applied to the client-turn loop): an error turn is
 *  the agent's chance to correct, not a license to loop. Reset by any non-error client message (a real
 *  user action) or a typed intent. See the onClientMessage wiring for the full root-cause note. */
const ERROR_TURN_BUDGET = 3

// GH #418 — the two visible-refusal notices for "A2UI is off but something A2UI-shaped still reached this
// client" (a lingering surface's action click, or a model that emitted A2UI JSONL anyway despite the
// composed prompt no longer teaching it). Chosen client-plane policy: NEVER render/act on A2UI content
// while the toggle is off — either don't render it at all (with a visible one-line notice), or refuse the
// action outright — never a silent no-op (the exact reported defect: a surface renders, looks alive, then
// goes dead on the first click, with no error anywhere).
const A2UI_OFF_ACTION_REFUSAL = 'A2UI is off in Surface Options — this action was not sent.'
const A2UI_OFF_INGEST_NOTICE = '⚠ A2UI is off in Surface Options — a surface the agent tried to render was not shown.'

/** ADR-0182 cl.5 — formats a declared `plan` (the Builder-mission's open-sections view) into the SAME
 *  plain-prose shape `note` already renders in, for the append-only `outgoing` fold in `#runSurfaceTurn`.
 *  No new UI component: a checklist is one more line of text, exactly like `assetWarning`/the a2ui-
 *  refused notice above it. An empty step list composes `undefined` — the model's own note already says
 *  so in plain prose (`prompts/builder-mission.md`) when nothing remains, so this never doubles that up. */
function formatPlanChecklist(plan: { steps: readonly { description: string }[] }): string | undefined {
  if (plan.steps.length === 0) return undefined
  return `Still open: ${plan.steps.map((step) => step.description).join(' · ')}`
}

// genui-surface.spec.md v0.5 §11 (SPEC-R12, GH #316/ADR-0162) — the ONE committed asset pair, now fetched
// LAZILY: at most ONCE per page, and ONLY on a dogfood-ON frame mount (GH #354, Kim's 2026-07-29 ruling).
//
// WHY (the bug this closes): the pair is a 450 675 B generated fixture. Imported statically it contributed
// 449 007 of the app entry chunk's 747 986 B min — `@agent-ui/app`'s PUBLIC barrel measured 153 969 B gz
// against a 75 776 B budget (2.08×), so every consumer of the barrel paid ~78 KB gz whether or not it ever
// opened agent-admin. Behind this dynamic `import()` the barrel carries ZERO dogfood bytes and the pair
// lands in a lazy chunk that no main bundle contains (`dogfood-lazy.bundle.test.ts` pins that in a REAL
// Rolldown bundle; `npm run size`'s app row is the same figure measured through the gate).
//
// SHAPE follows ADR-0139 cl.5's lazy-CodeMirror seam — the fleet's ruled precedent for a heavy lazy
// dependency — in both its mechanism AND its OUTCOME law, which is DEGRADE, never fail: "load failure — or
// any environment where CM cannot mount — leaves a fully functional plain editor, only the highlighting is
// lost" (ADR-0139 cl.5). Kim ruled the same for this pair on 2026-07-29: a failed load mounts the frame
// WITHOUT assets and tells the user; it never fails the turn. That matters more here than for CM, because
// this await sits AHEAD of `surfaceTurn(request)` — failing on it would mean a stale hashed chunk after a
// deploy stops the agent request from being issued at ALL, so every genui turn dies over a cosmetic asset
// pair until someone thinks to toggle dogfood off. The two hard-won details carried over verbatim:
//   • a load CEILING — an unreachable chunk must not hang the turn behind a live bubble; at the ceiling the
//     turn proceeds assets-less (see `#runSurfaceTurn`), so this bounds a DELAY, never a failure;
//   • NO memoized failure — a rejected promise is dropped from the memo, so the next turn retries rather
//     than inheriting a permanently poisoned one (a RESOLVED one is reused for the whole page lifetime).
const DOGFOOD_LOAD_TIMEOUT_MS = 10_000 // the ADR-0139 cl.5 ceiling, reused verbatim
let dogfoodAssetsMemo: Promise<SandboxFrameAssets> | undefined
function loadDogfoodAssets(): Promise<SandboxFrameAssets> {
  if (dogfoodAssetsMemo === undefined) {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('ui-agent-admin: dogfood asset load timed out')), DOGFOOD_LOAD_TIMEOUT_MS)
    })
    const load = import('@agent-ui/components/dogfood-frame')
      .then(({ DOGFOOD_CSS, DOGFOOD_JS }): SandboxFrameAssets => ({ css: DOGFOOD_CSS, js: DOGFOOD_JS }))
      .finally(() => clearTimeout(timer))
    dogfoodAssetsMemo = Promise.race([load, timeout]).catch((err: unknown) => {
      dogfoodAssetsMemo = undefined
      throw err
    })
  }
  return dogfoodAssetsMemo
}

// GH #468 (the app-diet hunt) — `@agent-ui/code/markdown` LAZY, the SAME shape as the dogfood loader just
// above (a memoized promise, a load ceiling, a dropped-on-failure memo so the next attempt retries) with
// ONE necessary difference: the dogfood await sits ahead of an ASYNC turn (a natural `await` point), but
// `#renderBody`'s content-renderer callback (conversation.ts) is SYNCHRONOUS — it must return a Node right
// now, with no await available. So this loader is fired ahead of need (`preloadMarkdownRenderer`, called
// from `#applyMasterStates` on connect/every rewire whenever the Markdown modality is already on, and from
// the Markdown toggle's own `change` handler the instant it flips on) rather than awaited at render time.
// The render path (search "GH #468" in `#compose`) checks `customElements.get('ui-markdown')` and falls
// back to the SAME plain-text node the modality's OFF state already returns — degrade, never fail, exactly
// the dogfood ruling's law, extended to cover "still loading" as a third legitimate fallback reason beside
// "off" and "unsanitizable". A resolved load is reused for the page's whole lifetime; a failed OR timed-out
// one is dropped from the memo so the very next preload call (any later rewire or toggle) retries rather
// than leaving Markdown mode permanently degraded after one transient chunk error.
const MARKDOWN_LOAD_TIMEOUT_MS = 10_000 // the ADR-0139 cl.5 / dogfood ceiling, reused verbatim
let markdownReadyMemo: Promise<void> | undefined
function loadMarkdownRenderer(): Promise<void> {
  if (markdownReadyMemo === undefined) {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('ui-agent-admin: markdown renderer load timed out')), MARKDOWN_LOAD_TIMEOUT_MS)
    })
    const load = import('@agent-ui/code/markdown')
      .then((): void => undefined) // this dynamic import self-defines <ui-markdown> as its own side effect (code/markdown barrel banner)
      .finally(() => clearTimeout(timer))
    markdownReadyMemo = Promise.race([load, timeout]).catch((err: unknown) => {
      markdownReadyMemo = undefined
      throw err
    })
  }
  return markdownReadyMemo
}
/** Fire-and-forget: every call site here runs OUTSIDE an async turn (a connect-time effect, a toggle's
 *  `change` listener), so there is no caller to hand a rejection to. A failed/timed-out attempt is silent
 *  by design — the render path's own synchronous fallback (plain text) is exactly what a user sees either
 *  way, and `loadMarkdownRenderer` already drops a failed attempt from its memo so the NEXT preload call
 *  (the next rewire, the next toggle flip) retries for real rather than inheriting a poisoned promise. */
function preloadMarkdownRenderer(): void {
  loadMarkdownRenderer().catch(() => {})
}

/**
 * GH #670 (Kim's 2026-08-10 fork ruling) — what an Author-card PRE-ARM pick asks the page's mint path to
 * seed the newly-minted interviewer store with, handed over as `onGenerateRequest`'s one argument.
 *
 * The pick WINS by being seeded, never by a later overwrite: there is no write-then-correct step anywhere
 * on this path, so the arm's own `#syncAuthoringConversationConfig` reads the user's choice out of the
 * store as that store's committed value from its very first read (fork 2).
 *
 * A key the user never touched is simply ABSENT, and the minted store's own default wins — which is why
 * every field here is optional. `effort` is deliberately NOT a field: it has no store home in this design
 * (`#effort`, this element's own per-conversation dial), so its half of the same pre-arm record is applied
 * where effort actually lives — see `#startFromFirstMessage`, the arm this pick seeds.
 */
export interface GenerateSeed {
  /** The model id picked on the unarmed Author card, before there was a store to hold it. */
  model?: string
}

/**
 * S7-c (LLD §16.3, frozen seam shape, verbatim) — one roster row for the header's `agent-select`: the
 * page-owned persona/agent identity this component renders but does not itself know the shape of (the
 * component cannot import site code, the DAG — the same reason `onGenerateRequest`'s mint path is a
 * callback, never an import).
 */
export interface AgentRosterEntry {
  id: string
  label: string
}

export interface UIAgentAdminElement extends ReactiveProps<typeof agentAdminProps> {}
export class UIAgentAdminElement extends UIElement {
  static props = agentAdminProps

  // The composed SHELL — created ONCE (idempotent, `#shell` doubles as the guard) and PERSISTS across a
  // reconnect (the `master-detail.ts`/`settings.ts` precedent). GH #52/ADR-0154, re-hosted by ADR-0179,
  // re-ruled again by GH #686's Amendment (admin-three-pane-ia.lld.md §16, S7-b), then flattened by
  // GH #700 to compose `ui-super-shell` directly (no more intermediate `ui-chat-shell`): a `ui-super-shell`
  // hosting `content` = the pane holder, three sibling regions (Chat conversation · Settings · Co-pilot
  // conversation). The `header` slot now carries S7-c's own unified header bar (LLD §16.1/§16.3) — the
  // pane nav that used to live there retired with the visibility model it drove (§16.5); the replacement
  // is a different shape (agent select + pane pills/segments + page actions), not a restoration of the
  // old nav. Region visibility is likewise VISIBILITY-ONLY — no JS layout code, no reparenting, ever
  // (`#applyPaneVisibility`).
  #shell: UISuperShellElement | null = null
  #conversation: UIConversationElement | null = null
  // ── ADR-0178 cl.5 (LLD-C6) — the DUAL-CONTEXT chat ────────────────────────────────────────────────────
  // Two MOUNTED conversations, never one conversation with two transcripts: the test context above stays
  // byte-unchanged, and the authoring one mounts alongside it. Both keep their DOM transcripts for the
  // element's whole life, which is what makes a visibility-set flip a pure visibility change — no
  // snapshot/restore machinery to invent, and nothing for `admin.store` to be reassigned FOR.
  // GH #686's Amendment — the interview mounts directly into `#paneHolder` now (the `ui-master-detail`
  // pairing it used to mount into, `#authorPane`, retired with the vehicle, LLD §16.5); its own `data-part`
  // carries the region identity instead (`copilot-pane`, below).
  #authoringConversation: UIConversationElement | null = null
  // ── GH #686's Amendment (admin-three-pane-ia.lld.md §16.2, S7-b) — the shown-set visibility model ──────
  /**
   * The WIDE truth: which of the three regions have a box, independent of any single "active" one — at
   * and above the triple line more than one paints at once, so there is no longer a single active place to
   * name. Invariant `size ≥ 1`, enforced centrally by `#setPanesShown`: a zero-pane surface is broken by
   * construction, so the last member's own removal is refused.
   *
   * Entry default: all three (OQ-D's rec, the wireframe's own all-active state) — flagged in the LLD as
   * still OPEN for Kim to confirm, not a ruled default; this slice ships the recommendation because a
   * visibility model needs SOME entry state to be buildable at all, and the done-when this slice is graded
   * against names no other default.
   *
   * Replaces `#pane` as the visibility truth. `#setPane`/`#applyPane` are gone with it — there is no
   * single "active place" concept left in this element; the header's pills/segments (S7-c) mirror THIS
   * state (`#applyHeaderPaneState`), they never own a second copy of it.
   */
  #panesShown: Set<Pane> = new Set(PANE_ORDER)
  /**
   * The NARROW truth: which one region paints alone below the triple line, and which pill/segment reads
   * pressed/selected when only one CAN be shown that way. Invariant: always a member of `#panesShown`
   * (`#setPanesShown` repoints it the moment its own member leaves the set, to the first remaining member
   * in `PANE_ORDER`).
   *
   * Entry default `'chat'` (OQ-D's rec — content-first, carried over from the retired `#pane`'s own
   * default).
   */
  #panePrimary: Pane = 'chat'
  /**
   * The content slot's holder — the box the three regions live in. GH #686's Amendment re-rules ADR-0179
   * cl.1's Amendment (GH #662's `data-pane`): `#applyPaneVisibility` below writes `data-show` (the WHOLE
   * shown set, space-joined, `PANE_ORDER`) + `data-primary` (the narrow truth) and nothing else. THIS
   * SHEET says what paints, reading both attributes against the holder's OWN inline-size — no
   * ResizeObserver, no JS layout, no state written by a resize (the shell family's own-container-width
   * law, carried over verbatim — only the vocabulary widened from one active place to a set). The regions
   * therefore carry NO `hidden` attribute of their own: a region that paints must not claim to be hidden,
   * and `display:none` from the band rule removes a non-painting one from the a11y tree exactly as
   * `hidden` did.
   */
  #paneHolder: HTMLElement | null = null
  // GH #686's Amendment retires `ui-master-detail` as the Author⇄Settings pairing vehicle entirely (the
  // wireframe's all-active geometry — three 296px-ish columns — does not fit the MD's 40rem own-container
  // dock floor, LLD §16). The three places are THREE SIBLING regions directly under `#paneHolder` now, in
  // `PANE_ORDER`: the chat conversation (`#conversation`, `data-part="chat-pane"`), a plain div
  // (`data-part="settings-pane"` — the SAME `settings-nav` + five section units, moved here whole exactly
  // as before, never a runtime reparent; no field of its own — `#applySettingsSection` already tracks its
  // children via `#settingsSections`, and nothing else needs the wrapper's own identity), and the
  // Co-pilot conversation (`#authoringConversation`, `data-part="copilot-pane"` — the GH #666 card,
  // renamed from the retired `author-pane` wrapper). cl.3's law survives the vehicle change: same
  // singleton nodes, zero duplication, zero reparenting after this one compose-time build (verified with
  // `isSameNode` probes across visibility-set flips, agent-admin.test.ts).
  #generateRequest: ((seed?: GenerateSeed) => void) | undefined
  // ── S7-c (LLD §16.3) — the unified header bar's six registration seams + the elements they drive ──────
  // Callback fields, the `#generateRequest` shape verbatim: registration, never a CustomEvent (SPEC-R5);
  // last registration wins (a bare reassignment); read at call/reflect time, so registering before OR
  // after connect both work (the GH #666 order rule — `#applyActionAvailability`/`#applyAgentRoster`
  // below are this seam family's own `#reflectAuthorEntry`).
  #agentSelectCallback: ((id: string) => void) | undefined
  #newAgentRequest: (() => void) | undefined
  #importRequest: (() => void) | undefined
  #exportRequest: (() => void) | undefined
  // S7-d places this seam's CONSUMER (the Settings model-grid fold's own "Reset Agent" affordance) — this
  // slice builds only the registration seam itself, unconsumed by any header affordance yet (LLD §16.4's
  // own S7-c/S7-d split).
  #resetRequest: (() => void) | undefined
  // `setAgentRoster` is data-in, not a callback — but the SAME "safe before or after connect" law applies
  // (LLD §16.3), so a pre-connect call is held here and applied once `#agentSelectEl` exists
  // (`#applyAgentRoster`), exactly the `#generateRequest`/`#reflectAuthorEntry` build-time-reflect shape.
  #pendingRoster: { entries: readonly AgentRosterEntry[]; activeId: string | undefined } | undefined
  #agentSelectEl: UISelectElement | null = null
  // Keyed by pane so `#applyHeaderPaneState` (`#applyPaneVisibility`'s own mirror step) can write pressed/
  // selected state onto the right control without re-querying the DOM every render.
  #panePills: Map<Pane, UIToggleElement> = new Map()
  #panePillStateIcons: Map<Pane, UIIconElement> = new Map()
  #paneSegments: UISegmentedControlElement | null = null
  #newAgentWideBtn: HTMLElement | null = null
  #newAgentNarrowBtn: HTMLElement | null = null
  #importActionBtn: HTMLElement | null = null
  #exportActionBtn: HTMLElement | null = null
  #overflowTriggerBtn: HTMLElement | null = null
  #overflowImportItem: HTMLElement | null = null
  #overflowExportItem: HTMLElement | null = null
  // S7-d (LLD §16.4) — "Reset Agent"'s own consumer, at the model-grid fold's content end. HIDDEN, not
  // disabled, while `onResetRequest` is unregistered (`#applyActionAvailability`'s own law, extended).
  #resetAgentBtn: HTMLElement | null = null
  /**
   * GH #670 — the Author card's Model/Effort pick made BEFORE the flow is armed, held here until there is
   * somewhere real to put it. It exists because the pickers are props-down/callbacks-up: armed, a pick
   * commits to its home and the home feeds the committed value back; UNARMED there is no interviewer store
   * and no interview, so the same callback used to write `this.authoringStore?.set('model', id)` into
   * nothing at all. A picker that visibly accepts a choice and drops it is worse than no picker, which is
   * why the props were never set unarmed in the first place.
   *
   * ONE record for BOTH pickers (Kim's fork-3 ruling: no special-casing) — same capture rule, same single
   * apply point (`#startFromFirstMessage`, the arm), same clears. Only the DESTINATION differs at the arm, and that split
   * is this file's pre-existing law rather than anything #670 introduces: `model` is store state (the
   * Builder's own, page-minted), `effort` is element state (`#effort`, deliberately store-less).
   *
   * A BRIDGE, never a second source of truth: it is emptied the moment the flow arms (from there the store
   * is the truth) and on a real persona switch (`#resetConversationState`, GH #145/#644 — a pick made for
   * one persona's unarmed session must not leak into the next one's).
   */
  #preArm: { model?: string; effort?: EffortLevel } = {}
  /** The five settings section units, in strip order — the SAME nodes at every band (the
   *  no-duplication assert), keyed by their stable `data-role`. Visibility-only flips, exactly the shell
   *  strip's own SPEC-R7c behavior: nothing is unmounted, so section state survives every flip. */
  #settingsSections: HTMLElement[] = []
  #idSeq = 0
  /** The authoring context's own store identity, so the effect can tell a real reassignment from a bare
   *  re-run (the `#lastStore` precedent, applied to the second store). */
  #lastAuthoringStore: SettingsStore | undefined
  /** The authoring context's own store subscription teardown (its own slot, the `#modelGridUnsub`
   *  precedent — the shared `#unsubscribes` map is cleared on every DRAFT-store rewire). */
  #authoringUnsub: (() => void) | undefined
  #settingsEl: UISettingsElement | null = null
  // Every entry-list instantiation (prompt sections + all four capability kinds), keyed by `kind` — the
  // ONE registry `#rewireAllSections`/`#compose` both iterate uniformly.
  #capabilitySections: Map<string, EntryListSection> = new Map()

  // GH #52/ADR-0154 (extended GH #574), re-homed by ADR-0179: the five settings content units
  // (`agentContent`/`capabilitiesContent`/`surfaceContent` — the three ranked config units GH #574 split
  // the old single Settings unit into; `contextSystemContent`/`contextDialogContent` — the two Context
  // halves, GH #161) are built ONCE in `#compose()` and authored directly into the Settings place
  // (`#settingsSections` below) — never moved again, so no field holds them past construction (the
  // settings-nav strip drives visibility in place, SPEC-R7c; TKT-0085's reparenting machinery, and the
  // field slots that tracked its targets, are gone).
  // ── vision rev.5: the master switches + the Context tabs' render slots ──────────────────────────────
  #agentSwitch: (HTMLElement & { checked: boolean }) | null = null
  #kindSwitches: Map<string, HTMLElement & { checked: boolean }> = new Map()
  // ── vision rev.6: the Surface Options controls (built once; state re-applied per store change) ───────
  #surfaceMarkdownSwitch: (HTMLElement & { checked: boolean }) | null = null
  #surfaceA2uiSwitch: (HTMLElement & { checked: boolean }) | null = null
  // genui-surface.spec.md SPEC-R11 — the GenUI modality's own row switch (live, B2).
  #surfaceGenuiSwitch: (HTMLElement & { checked: boolean }) | null = null
  // genui-surface.spec.md v0.5 §11 (SPEC-R10 amended clause, GH #316/ADR-0162) — the dogfood sub-toggle.
  #surfaceGenuiDogfoodSwitch: (HTMLElement & { checked: boolean; disabled: boolean }) | null = null
  // ADR-0174 cl.1/OF3 — the planner-stage modality's own row switch: a bare, ungrouped row (the markdown
  // precedent) — the gate has no sub-options yet (SPEC-R21; OF4's possible future prompt-section entry is
  // unbuilt).
  #surfacePlannerSwitch: (HTMLElement & { checked: boolean }) | null = null
  // ADR-0178 cl.3 / SPEC-R30 — the persona-authoring gate's row switch: the planner row's shape,
  // verbatim (bare, ungrouped, inverse-default OFF).
  #surfaceAuthoringSwitch: (HTMLElement & { checked: boolean }) | null = null
  // GH #525/#541 — the bankroll Settings FOLD (its own group since #541): built once; `hidden` reflects
  // the persona's OWN opt-in (`BANKROLL_CAPABLE_KEY`), applied in `#applyMasterStates` like every other
  // row's state — never a DOM add/remove per persona switch.
  #bankrollItem: (HTMLElement & { hidden: boolean }) | null = null
  #contextSystemHost: HTMLElement | null = null // Agent System — rebuilt wholesale per store change
  #contextTurnsHost: HTMLElement | null = null // Dialog Turns — rebuilt per logged turn
  /** The Context tabs' shared store subscription (both System and Dialog read off the same store) — its
   *  OWN slot (the #modelGridUnsub precedent): it must outlive `#rewireAllSections`' clear-and-rebuild
   *  of the shared #unsubscribes map. */
  #contextUnsub: (() => void) | undefined
  /** The Dialog Turns ring (newest LAST here; rendered newest-FIRST) — request/response per turn,
   *  every arm (stub, live, surface), failures included. Element-lifetime, never persisted. `n` is a
   *  MONOTONIC turn number (the vision frame's 04→01), stable as the bounded ring drops its oldest. */
  #turnLog: Array<{ n: number; arm: 'stub' | 'live' | 'surface'; request: unknown; response: unknown }> = []
  #turnCounter = 0

  #unsubscribes: Map<string, () => void> = new Map()
  /** The Model grid's host element (composed once, re-rendered wholesale per store change). */
  #modelGrid: HTMLElement | null = null
  /** The grid subscription's own teardown (never the shared #unsubscribes map — rewires clear it). */
  #modelGridUnsub: (() => void) | undefined
  // The no-subscribe fallback trigger — `#updateEntries` calls this directly ONLY when the current
  // store has no `subscribe` method to notify it instead (component-reviewer MODERATE fix).
  #renders: Map<string, () => void> = new Map()
  // The multi-turn conversation history (TKT-0052 Q4, element-lifetime, private): prior COMPLETED turns —
  // user text + reply — appended on BOTH the stub and the live path. Replayed into the live request as
  // PRIOR turns only; the system prompt is rebuilt fresh every turn and NEVER stored here, so a mid-
  // conversation model/prompt/capability switch applies to the NEXT turn only and prior turns are never
  // rewritten (the acceptance criterion falls out by construction). GH #644 — this is the TEST context's
  // own array; the authoring context has its own below (`#authoringHistory`), and `#contextFor()` is the
  // one place that picks between them.
  #history: AdminTurn[] = []
  // GH #644 — the PROSE arm's authoring-context counterpart to `#history` above, mirroring the surface
  // arm's per-context `Session` map (`admin-live-runner.ts`'s `sessions` keyed by `req.session`, ADR-0178
  // cl.5): the Builder interview and the draft's own test chat are different agents' transcripts, so a
  // single shared history would feed the interview to the draft as its own memory (and vice-versa) — the
  // exact identity confusion the surface arm's map already prevents. `#contextFor()` selects which array a
  // turn reads/appends; both are cleared together on a real persona switch (`#resetConversationState`,
  // GH #145) and `#authoringHistory` alone resets on a real `authoringStore` identity change
  // (`#rewireAuthoringContext`) — a different interviewer starts a fresh interview, but the draft's own
  // test-chat memory is untouched.
  #authoringHistory: AdminTurn[] = []
  // GH #525 (review MAJOR 1b) — the surfaceIds this admin has actually forwarded a `createSurface` for
  // (via `handle.ingestLine`, so ONLY while A2UI is on — the SAME gate that decides whether the real
  // renderer's own `SurfaceStore` would know it), minus any it has forwarded a `deleteSurface` for.
  // Mirrors the real renderer's own bookkeeping (renderer.ts's `SurfaceStore`) without importing it — the
  // bankroll mirror's OWN "is this surfaceId real" check (`#runSurfaceTurn`) reads this set rather than
  // trusting an `updateDataModel` envelope's `surfaceId` at face value. Element-lifetime, cleared on a
  // real persona switch (`#resetConversationState`) exactly like `#history`/`#turnLog` above.
  #knownSurfaceIds: Set<string> = new Set()
  // The composer's Effort picker selection (the Figma chat-input refactor) — ephemeral, element-lifetime
  // state, deliberately NOT persisted to `store` (unlike `model`): reasoning effort is a per-conversation
  // dial, not a saved agent-profile setting, and Figma's own composer design carries no Effort field in
  // the settings pane either. Written into `#conversation.effort` imperatively whenever it changes — see
  // `#syncConversationConfig`.
  #effort: EffortLevel = 'medium'
  // GH #145 — the store-swap effect's own "was this a real reassignment or a bare reconnect" memory
  // (the #modelGridUnsub precedent, generalized): a REAL reassignment (a persona switch — a different
  // store object) must start a fresh conversation; a bare reconnect with the SAME store (a layout
  // crossing, TKT-0085) must not wipe an in-progress one. `#storeSeen` distinguishes "never run" (the
  // element's first ever connect — nothing to reset, the conversation is already empty) from "ran once
  // with `undefined`" (a real state a later defined store can still differ from).
  #storeSeen = false
  #lastStore: SettingsStore | undefined
  // GH #63 — the client-turn error-loop budget state (see the onClientMessage wiring + ERROR_TURN_BUDGET).
  #consecutiveErrorTurns = 0
  #errorLoopHalted = false
  /** GH #354 — a monotonic conversation generation, bumped by `#resetConversationState()` (a persona
   *  switch). A surface turn captures it before the lazy dogfood-asset await and abandons itself if the
   *  thread was reset while the chunk was in flight, so no frame is ever mounted into a torn-down bubble
   *  (the ADR-0139 cl.5 `#mountGen` precedent). Abandoning an un-finalized handle cannot wedge the
   *  composer: `ui-conversation.reset()` zeroes its own in-flight counter and re-reflects busy. */
  #conversationEpoch = 0

  protected connected(): void {
    this.#compose() // idempotent — builds ONLY the shell + the composed children, once ever

    // Lazily default `schema`/`store` (once ever — a later reconnect finds them already set and skips
    // this). `schema` shares the module-level constant (plain, read-only data); `store` gets its OWN
    // fresh persisted instance per element, seeded from BOTH the flat "Agent" schema's own defaults
    // (agent-admin-schema.ts's `initialValuesFor`) AND every entry-list kind's seed data
    // (entries.ts's `initialEntryValues`) — disjoint key sets, merged so the localStorage read-back
    // (the CRITICAL component-reviewer fix) covers the whole persisted shape, not just the flat half.
    if (this.schema === undefined) {
      this.schema = defaultAgentConfigSchema
    }
    if (this.store === undefined) {
      this.store = createMemoryStore({
        persistKey: 'ui-agent-admin',
        // `model` seeds explicitly — the Model GRID owns it now and the schema carries no model field
        // for initialValuesFor to walk (Kim, 2026-07-19 rev.2).
        initial: { model: DEFAULT_MODEL_ID, ...initialValuesFor(this.schema), ...initialEntryValues() },
      })
    }
    // The Model GRID (Kim, 2026-07-19 rev.2 — supersedes the one-day-old customModels→schema rebuild:
    // the schema carries no model select anymore, the grid re-renders itself instead; GH #137, 2026-07-20:
    // the customModels admin-add capability itself is now gone too, Kim's option A): render now from
    // the store's current contents, and re-render on either of its two keys through its OWN teardown
    // slot — NEVER the shared #unsubscribes map, which #rewireAllSections clears on every store rewire
    // (this subscription must outlive rewires; it dies with the connection).
    {
      this.#renderModelGrid()
      this.#modelGridUnsub?.()
      this.#modelGridUnsub = this.store?.subscribe?.((key) => {
        if (key === 'model' || key === MODELS_INCLUDED_KEY) this.#renderModelGrid()
      })
    }

    // schema/store → the composed ui-settings pane + every entry-list section's render + subscription.
    // Reactive: a real reassignment (different object references) re-wires from scratch; a reconnect with
    // the SAME store re-arms only. Entries are block-level content (not per-keystroke), so — unlike the
    // v1 single-field case — always re-rendering from the CURRENT store value on every connect (real
    // reassignment or bare reconnect alike) is safe: there is no in-progress-edit-preservation concern a
    // full list rebuild could clobber the way reseeding a live textarea mid-edit would.
    this.effect(() => {
      const schema = this.schema
      const store = this.store
      const libraries = this.libraries
      // ADR-0178 cl.5 — tracked alongside the others so arming/clearing the flow re-runs this effect.
      const authoringStore = this.authoringStore
      untracked(() => {
        // GH #145 — a REAL store reassignment (a persona switch: `admin.store = presetStore(other)`)
        // must start a genuinely fresh conversation for the newly-selected persona: the visible chat
        // log + any open A2UI surfaces (`#conversation.reset()`), the multi-turn `#history` fed into
        // live requests, and the Dialog Turns ring (`#turnLog`) the Context: Dialog tab reads. Gated on
        // `#storeSeen` so the element's FIRST ever connect (nothing to reset yet) and a bare reconnect
        // with the SAME store (e.g. a TKT-0085 layout crossing) both skip it — only a genuine identity
        // change resets. `#rewireContext` below re-renders the (now-empty) Dialog Turns view.
        if (this.#storeSeen && this.#lastStore !== store) this.#resetConversationState()
        this.#storeSeen = true
        this.#lastStore = store
        if (this.#settingsEl) {
          this.#settingsEl.schema = schema
          this.#settingsEl.store = store
        }
        this.#rewireAllSections(store)
        this.#updateLibraries(libraries)
        this.#syncConversationConfig(store)
        this.#rewireContext(store)
        // AFTER the draft's own rewire: a persona switch clears `authoringStore` first (the page's
        // `applyPersona` choke point), so by the time both props have settled this call sees the final
        // state and the flow always opens — or closes — clean.
        this.#rewireAuthoringContext(authoringStore)
      })
    })
  }

  protected disconnected(): void {
    for (const unsubscribe of this.#unsubscribes.values()) unsubscribe()
    this.#unsubscribes.clear()
    this.#modelGridUnsub?.()
    this.#modelGridUnsub = undefined
    this.#contextUnsub?.()
    this.#contextUnsub = undefined
    this.#authoringUnsub?.()
    this.#authoringUnsub = undefined
  }

  /** GH #646, now feeding the pane-nav and settings-nav `ui-tabs` strips' `link()` calls (the
   *  `super-shell.ts` `#nextId` precedent); this element mints no other ids, so a small local counter
   *  is enough. */
  #nextId(prefix: string): string {
    this.#idSeq += 1
    return `ui-agent-admin-${prefix}-${this.#idSeq}`
  }

  // ── composition (idempotent — the master-detail.ts/settings.ts `#compose` doc-comment precedent) ──────

  /** Build the ui-super-shell + the pane nav + the five composed entry-list sections + the composed
   *  ui-settings, once ever. ADR-0179 — `header` = the pane nav, `content` = the pane holder (the Chat
   *  conversation + the Author⇄Settings pairing); the whole config column and both Context halves live
   *  in the Settings place as `data-segment` siblings, never a separate ui-tabs/reparenting shell.
   *  The store-driven CONTENT (each section's rendered entries) is the `connected()` effect's job, not
   *  this method's. */
  #compose(): void {
    if (this.#shell) return

    // GH #700 — composes `ui-super-shell` directly now, not through the `ui-chat-shell` preset: that
    // preset's ONLY real contribution here was defaulting `narrow-start="stack"` (chat-shell.ts's own
    // FORWARD_ATTRS — `resizable-end`/`size-end`/`narrow-end`/`resizable-start`/`size-start`/
    // `collapse-band` — were never set on the composed shell by this element, so nothing else needed to
    // move with the flatten); that default is set explicitly below instead.
    const shell = document.createElement('ui-super-shell') as UISuperShellElement
    shell.setAttribute('narrow-start', 'stack')
    // (SPEC-R6a/R7b's `resizable-end` + `narrow-end="tabs"` RETIRED with the options-pane they governed —
    // ADR-0179 cl.1 / admin-three-pane-ia.lld.md §7: the settings region left the shell's end side for the
    // pane holder below. The shell still carries exactly two slots: `header` (S7-c's unified header bar,
    // `#composeHeader` below) and `content` (the pane holder).)

    // GH #686's Amendment (LLD §16.1/§16.2) — the content slot HOLDS THE PLACES (it was `chat-stack`, a
    // two-conversation stacking vehicle for one place; ADR-0178 cl.5's stacking model is superseded by
    // citation). Its THREE children are three sibling regions — the test conversation (Chat), the
    // Settings region, the Co-pilot conversation — in `PANE_ORDER`. `#applyPaneVisibility` writes the
    // shown SET + primary onto this box as `data-show`/`data-primary`, and the SHEET decides which
    // regions have a box — the primary alone below the triple line, the whole shown set at and above it.
    const paneHolder = document.createElement('div')
    paneHolder.setAttribute('data-part', 'pane-holder')
    paneHolder.setAttribute('data-slot', 'content')
    this.#paneHolder = paneHolder

    const conversation = new UIConversationElement()
    conversation.setAttribute('data-part', 'chat-pane') // LLD §16.1's anatomy — the region identity the band CSS/tests target
    // GH #665 — putting more than one conversation on screen at once needs something saying which is
    // which (Kim's screenshot: two visually identical empty threads). A quiet region kicker, prepended
    // before the control's own log/composer mount (`ui-conversation`'s `connected()` only ever APPENDS —
    // see `#makeRegionKicker`'s own comment), names this one the permanent test context (`#contextFor`'s
    // 'chat' origin) — host chrome, not something the agent itself authors.
    conversation.prepend(this.#makeRegionKicker('Test chat'))
    // GH #238/#239/ADR-0159 — the admin chat opts INTO the receipt pattern (Kim's 2026-07-23 ruling; this
    // is the surface the ruling's screenshot came from): each turn's activity renders as one morphing line
    // while live and auto-collapses to a "N steps · total" receipt at the turn's end, expandable both ways.
    conversation.receipt = true
    // GH #240/ADR-0159 wave B — and into the per-step SOURCE reveal (part 3 of the same ruling): each
    // expanded activity step reveals the raw wire line(s) behind it (the createSurface/updateDataModel
    // JSONL), one deliberate developer level deep. The admin chat is the fleet's developer surface — every
    // other conversation consumer (a2ui-chat, the demos) stays default-off, byte-identical. The producer
    // half of the channel is the live runner's own `progressDetail:'source'` request (admin-live-runner.ts).
    conversation.sources = true
    // GH #662 — the ORIGIN travels with the submission. Per-pane composers (cl.4) mean this composer IS
    // the test context, permanently and at every band; naming that here is what makes the triple dock's
    // two simultaneously-visible composers unable to cross-route (see `#contextFor`).
    conversation.onSubmit((text) => this.#handleSubmit(text, 'chat'))
    // Models picker → the SAME persisted `model` store key the settings pane's own generated field reads/
    // writes (one source of truth, TKT-0021's own external-store-write precedent) — `#syncConversationConfig`'s
    // subscription feeds the committed value back down into `conversation.model` (props down, callbacks up).
    conversation.onModelChange((id) => this.store?.set('model', id))
    // Effort picker → ephemeral element state only (no persisted counterpart) — write-then-reflect
    // immediately, since nothing external can also change it the way another tab's store write could.
    conversation.onEffortChange((id) => {
      this.#effort = id as EffortLevel
      conversation.effort = this.#effort
    })
    // Surface client messages (an action click inside a mounted ui-surface-host, bubbled per LLD-C4) run
    // the NEXT surface turn — the Hit/Stand loop (TKT-0076). Callback registration, never a CustomEvent
    // (SPEC-R5). A no-op unless the surface arm is armed (the stub/text arms mount no surfaces anyway).
    //
    // GH #63 — two guards on the client-turn spawn, root-caused from the "page freeze" livelock:
    // renderer-emitted ERRORS ride this SAME callback as action clicks (renderer.ts #emitInternalError →
    // #emit → every onClientMessage listener), and an ingest error is emitted SYNCHRONOUSLY from inside
    // the CURRENT turn's own handle.ingestLine. Un-deferred, that re-entered #runSurfaceTurn mid-ingest;
    // with a producer that answers an error turn with another invalid payload (the scripted test runner
    // replying a cross-turn root-resend, which the renderer's ADR-0128 IDGRAPH guard rejects every time),
    // the turn→error→turn cycle became an UNBOUNDED synchronous loop — ~2000 turns/12s, starving
    // macrotasks (setTimeout, CDP — the "even setTimeout stops firing" freeze). Live producers never hit
    // it (produce()'s session-seeded validation, TKT-0081, can't ship the invalid line — and a real model
    // answers an error turn with corrected content), which is why only scripted delivery detonated.
    //   1. DEFER every client turn to a fresh macrotask — "the agent continues on the NEXT turn" (the
    //      a2ui-live.ts law) now literally means the next event-loop task, never a mid-ingest re-entry.
    //   2. BUDGET consecutive error-driven turns (the produce() maxRounds discipline, same bound of 3):
    //      an error turn is the agent's chance to self-correct, not a license to loop — the budget
    //      exhausting halts visibly (a failed turn bubble), and any non-error client message (a real
    //      user action) or typed intent re-arms it.
    conversation.onClientMessage((message) => this.#handleClientMessage(conversation, 'chat', message))
    // Vision rev.6 — the Markdown surface rides ui-conversation's SPEC-R12 content-render seam: agent
    // notes/system bubbles render through <ui-markdown> (sanitized by construction) while the switch is
    // ON, and fall back to a plain text node (the frame's own "simple text is fallback") when OFF. The
    // store is read FRESH per render — the live-apply law; flipping the switch changes the NEXT bubble.
    // GH #468 — `<ui-markdown>` is now LAZY (search "GH #468" above for the loader): this callback is
    // SYNCHRONOUS (`#renderBody` needs a Node back right now, no await available), so a THIRD fallback
    // reason joins "off" here — "on, but the lazy chunk hasn't resolved yet" — same plain-text node either
    // way. `preloadMarkdownRenderer()` below fires the load in case nothing already did (defensive; the
    // real trigger is `#applyMasterStates`, which fires on connect and on every toggle, well ahead of any
    // turn reply) — memoized, so a call here after one already succeeded/is in flight is a no-op.
    conversation.setContentRenderer((text) => this.#renderContent(text, this.store))
    // GH #52/ADR-0154, re-homed by ADR-0179 — Agent ⇄ Capabilities ⇄ Surface ⇄ Context: System ⇄
    // Context: Dialog are FIVE `data-segment` siblings inside the Settings place (GH #574 split the old
    // single Settings segment into three ranked ones — identity/runtime, capability content, rendering
    // surface — the SAME tripling GH #161 already did once for the old single Context segment), driven
    // by this element's own admin-composed `settings-nav` `ui-tabs` strip (§9/LLD-P3).

    // GH #574 (Kim's ruling, in-session 2026-08-07) — the old flat Settings tab's ten folds, ranked into
    // three tabs: Agent (who it is — Agent/Model/Bankroll), Capabilities (what it can do — Instructions/
    // Skills/Workflows/Resources/Tools), Surface (how it renders — Surface Options/Pattern sources).
    // Every section stays a heading-row FOLD since GH #225 (Kim's ruling, the follow-on to GH #222: the
    // Context tabs' chevron/accordion pattern applied back to the config column): one `settingsItem`
    // ui-disclosure per section — Agent (the ACTIVE master switch ON its heading row, Kim's ruling: "the
    // agent master toggle is just if the agent is active/available or not"), Model, Surface Options
    // (GH #488 moved it above Instructions — the modality choices read before the prose they gate),
    // Instructions (the old prompts pane, merged in), and the four capability kinds (each kind's master
    // switch on ITS heading row) — ONE reparent-able node (the TKT-0085 wrapper discipline) apiece. The
    // old plain `<h3>` heading parts (agent-header/agent-heading/model-grid-heading/surface-options-
    // heading/entry-section-heading) retired with the fold summaries that replaced them.
    const agentSwitch = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
    agentSwitch.setAttribute('data-part', 'agent-enabled')
    // GH #226/ADR-0158 — the heading-row placement is DECLARATIVE now: `slot="summary"` marks the switch
    // and ui-disclosure itself adopts it into the summary part at connect, re-adopts it across any heal
    // rebuild, and owns the toggle-click-≠-fold activation guard (the app-side placeSummaryControl
    // placement + preventDefault guard this replaces are gone).
    agentSwitch.setAttribute('slot', 'summary')
    agentSwitch.setAttribute('aria-label', 'Agent active')
    agentSwitch.checked = true
    agentSwitch.addEventListener('change', () => {
      this.store?.set(AGENT_ENABLED_KEY, agentSwitch.checked)
      // A no-subscribe store never notifies — apply the composer gate + context view directly (the
      // #updateEntries fallback discipline); with a subscription the callback does both (idempotent).
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#agentSwitch = agentSwitch
    const settingsEl = new UISettingsElement()
    // Event-boundary guard (the settings.ts `md`/`rail` precedent, same rationale): `settingsEl` is an
    // internal composition detail — its own bubbling `select`/`change` (a section switch) must not reach
    // a listener on THIS element, which owns no event vocabulary of its own (descriptor `events: []`).
    settingsEl.addEventListener('select', (event) => event.stopPropagation())
    settingsEl.addEventListener('change', (event) => event.stopPropagation())
    // GH #574 — the three ranked content units the old single `settingsContent` div split into. Each is
    // its OWN reparent-able node (the TKT-0085 wrapper discipline, tripled again like GH #161's Context
    // split): `data-role` names the unit for CSS/tests (the `settings-content` precedent), `data-segment`
    // is the tab label the shell's own strip renders verbatim.
    const agentContent = document.createElement('div')
    agentContent.setAttribute('data-role', 'agent-content')
    agentContent.setAttribute('data-segment', 'Agent')
    const capabilitiesContent = document.createElement('div')
    capabilitiesContent.setAttribute('data-role', 'capabilities-content')
    capabilitiesContent.setAttribute('data-segment', 'Capabilities')
    const surfaceContent = document.createElement('div')
    surfaceContent.setAttribute('data-role', 'surface-content')
    surfaceContent.setAttribute('data-segment', 'Surface')
    // The Model GRID (Kim, 2026-07-19 rev.2): its own card host, sitting between the Agent form card
    // and the prompt/capability sections (its fold's summary carries the "Model" heading, GH #225).
    // Content renders/rerenders from the store.
    const modelGrid = document.createElement('div')
    modelGrid.setAttribute('data-part', 'model-grid')
    this.#modelGrid = modelGrid
    const promptSections = this.#makeSection(ENTRY_KINDS.promptSection, 'Add section')

    // ── Surface Options (vision rev.6 — the frame's node 34:1312): the agent's output-modality card.
    // Originally placed after the prompt sections (the frame's own Agent-card order); GH #488 moved its
    // PANE POSITION above Instructions (the settingsContent.append order below — GH #574 renamed that
    // unit `surfaceContent`, now its own tab entirely) — the modality choices now read before the prose
    // they gate. This build-order comment still matters here: the section
    // itself is still BUILT here, before the capability sections, because the A2UI row it defines
    // (`a2ui`, below) is where the catalog picker mounts (GH #488's other move, in the CAPABILITY_KINDS
    // loop). Rows build ONCE; their state is (re)applied by #applyMasterStates (the master-switch
    // discipline).
    const surfaceOptions = document.createElement('div')
    surfaceOptions.setAttribute('data-part', 'surface-options')

    // GH #138 (row-pattern standardization, Kim's option-A ruling): switch leads, label next, a
    // flexible spacer, then trailing action/selection content pinned to the right edge — every
    // `surfaceRow` and its caller-appended trailing content (catalog select / note) follows this.
    const surfaceRow = (surface: string, label: string, title: string): { row: HTMLElement; toggle: HTMLElement & { checked: boolean; disabled: boolean } } => {
      const row = document.createElement('div')
      row.setAttribute('data-part', 'surface-row')
      row.setAttribute('data-surface', surface)
      const toggle = document.createElement('ui-switch') as HTMLElement & { checked: boolean; disabled: boolean }
      toggle.setAttribute('data-part', 'surface-toggle')
      toggle.setAttribute('aria-label', `${label} surface`)
      toggle.checked = true
      const rowLabel = document.createElement('span')
      rowLabel.setAttribute('data-part', 'surface-label')
      rowLabel.textContent = label
      rowLabel.title = title
      const spacer = document.createElement('span')
      spacer.setAttribute('data-part', 'surface-spacer')
      row.append(toggle, rowLabel, spacer)
      return { row, toggle }
    }

    // GH #541 — a modality whose configuration has CHILDREN (A2UI's catalogs, GenUI's sub-option) renders
    // as a GROUP: the modality row on top, its children in an indented detail zone directly beneath, both
    // on one shared inner surface. The flat sibling stack this replaces encoded rank only in reading
    // order, so a catalog card and the surface toggle that owns it read as peers.
    const surfaceGroup = (surface: string, row: HTMLElement): { group: HTMLElement; detail: HTMLElement } => {
      const group = document.createElement('div')
      group.setAttribute('data-part', 'surface-group')
      group.setAttribute('data-surface', surface)
      const detail = document.createElement('div')
      detail.setAttribute('data-part', 'surface-detail')
      group.append(row, detail)
      return { group, detail }
    }

    const markdown = surfaceRow('markdown', 'Markdown', 'Rendered as rich text — simple text is the fallback')
    markdown.toggle.addEventListener('change', () => {
      this.store?.set(SURFACE_MARKDOWN_KEY, markdown.toggle.checked)
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceMarkdownSwitch = markdown.toggle

    const a2ui = surfaceRow('a2ui', 'A2UI', 'Structured generative UI against the picked catalog')
    a2ui.toggle.addEventListener('change', () => {
      this.store?.set(SURFACE_A2UI_KEY, a2ui.toggle.checked)
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceA2uiSwitch = a2ui.toggle
    // ADR-0170 cl.6 — the bare `ui-select` picker that used to live here is RETIRED: the Catalogs library
    // section (CAPABILITY_KINDS, below) is the ONE writer of `A2UI_CATALOG_KEY`, and two write paths into
    // one key — each obliged to reconcile the other's surface — is exactly the second-writer defect that
    // record closes. GH #488 mounted the REAL picker directly below this row; the read-only catalog-label
    // MIRROR that clause left behind in the trailing slot is RETIRED by ADR-0170's 2026-08-07 Amendment
    // (proposed, GH #541): with the picker nested under this row, the active catalog's own card carries
    // that identical label one line below — the same string projected twice, adjacently. cl.6's rationale
    // is met structurally now (containment, not duplication); its one-writer rule is untouched.
    const a2uiGroup = surfaceGroup('a2ui', a2ui.row)

    // genui-surface.spec.md SPEC-R11/B2 — LIVE: the row's own "visible-but-disabled, PRD pending" state
    // (PRD §3) stood until this slice shipped; the modality's own inverse-default (OFF until an admin
    // opts in, `isGenuiSurfaceEnabled`) replaces the PRD-gated `disabled` lock. The pattern-source PICK
    // itself lives in the "Pattern sources" capability section below (CAPABILITY_KINDS, D4's "From
    // library" affordance) — this row is only the modality's own on/off switch, mirroring markdown/a2ui.
    const genui = surfaceRow('genui', 'GenUI', 'Sandboxed free-form generative UI — a pattern source, picked below, conditions it')
    genui.toggle.checked = false // the inverse default (OFF) — applyMasterStates re-applies the real stored value below
    genui.toggle.addEventListener('change', () => {
      this.store?.set(SURFACE_GENUI_KEY, genui.toggle.checked)
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceGenuiSwitch = genui.toggle

    // genui-surface.spec.md v0.5 §11 (SPEC-R10 amended clause, GH #316/ADR-0162) — "Use agent-ui
    // components" (Fisher-Price label; internal name `dogfood`). GH #541 — it is a nested DETAIL row under
    // the GenUI modality now, not trailing content in the modality's own row: two toggles of different
    // scope in one row is one visual unit claiming to be one decision. Disabled while the modality itself
    // is off (#applyMasterStates below); its OWN default is OFF regardless of the modality's state (a
    // stale stored `true` never composes bytes or mounts assets while `SURFACE_GENUI_KEY` is off — the
    // doc comment's own promise).
    const genuiGroup = surfaceGroup('genui', genui.row)
    const genuiDogfoodRow = document.createElement('div')
    genuiDogfoodRow.setAttribute('data-part', 'surface-detail-row')
    genuiDogfoodRow.setAttribute('data-detail', 'genui-dogfood')
    const genuiDogfoodLabel = document.createElement('span')
    genuiDogfoodLabel.setAttribute('data-part', 'surface-genui-dogfood-label')
    genuiDogfoodLabel.textContent = 'Use agent-ui components'
    const genuiDogfoodSwitch = document.createElement('ui-switch') as HTMLElement & { checked: boolean; disabled: boolean }
    genuiDogfoodSwitch.setAttribute('data-part', 'surface-genui-dogfood-toggle')
    genuiDogfoodSwitch.setAttribute('aria-label', 'Use agent-ui components in the GenUI frame')
    genuiDogfoodSwitch.checked = false
    genuiDogfoodSwitch.addEventListener('change', () => {
      this.store?.set(SURFACE_GENUI_DOGFOOD_KEY, genuiDogfoodSwitch.checked)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceGenuiDogfoodSwitch = genuiDogfoodSwitch
    // Switch leads, label next — the GH #138 row grammar the modality rows above already follow.
    genuiDogfoodRow.append(genuiDogfoodSwitch, genuiDogfoodLabel)
    genuiGroup.detail.append(genuiDogfoodRow)

    // ADR-0174 cl.1 / OF3 (ruled here) — the planner-stage pilot's own modality row, placed beside GenUI
    // (Kim's placement call): a persona-scoped opt-in for `site/lib/plan-runner.ts`'s sequential
    // plan→execute→synthesize host loop, the SAME inverse-default law GenUI's row already uses (OFF until
    // an admin opts in). A BARE row, not a `surfaceGroup` — the gate has no sub-options yet (OF4's possible
    // future "planning style" prompt-section entry is unbuilt), matching the markdown row's own ungrouped
    // shape. This row writes `this.store` — `ui-agent-admin`'s OWN persona `SettingsStore`, the SAME store
    // the A2UI/GenUI rows already write — never a page-local store: `site/pages/a2ui-live.ts`'s `?planner=1`
    // dev toggle is a SEPARATE page with no persona/settings surface of its own (its own inline comment says
    // so), so there is no single runtime store to share between the two pages; a2ui-live's toggle stays its
    // own independent dev override, documented at its own definition. This row is the seam a future
    // admin-side runner (an `admin-live-runner.ts`-style planner wiring, not built here) would read.
    // DELIBERATELY independent of the A2UI master (no dim, no disable): the planner is a turn-SHAPE knob
    // the host loop reads, not an output modality — planner-ON + A2UI-OFF is legal here; the future
    // admin-side runner slice owns deciding whether that combo degrades or dims (review note, 2026-08-08).
    const planner = surfaceRow('planner', 'Planner', 'Sequential plan → execute → synthesize host loop — opt-in')
    planner.toggle.checked = false // the inverse default (OFF) — applyMasterStates re-applies the real stored value below
    planner.toggle.addEventListener('change', () => {
      this.store?.set(SURFACE_PLANNER_KEY, planner.toggle.checked)
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfacePlannerSwitch = planner.toggle

    // ADR-0178 cl.3 / SPEC-R30 — the persona-authoring gate's own row, appended after Planner: the SAME
    // `surfaceRow` shape and the SAME inverse-default law (OFF until a persona explicitly opts in), zero
    // new row machinery — the Planner row IS the template. A BARE row, not a `surfaceGroup`: the gate has
    // no sub-options, so ADR-0170 cl.5's dimmed-while-off law has no child to dim here (it is the reason
    // this row mints no nested detail zone at all, not an omission). Flipping it ON for an ORDINARY
    // persona is exactly cl.6's deferred NL-edit entry point — the seam is built once, here.
    //
    // The gate governs TEACHING (the composed prompt's personaPatch arm) and is ONE conjunct of
    // consumption; it never authorizes a write on its own. A patch declared outside the dedicated
    // authoring context is ignored with this switch ON — see `#runSurfaceTurn`'s apply loop.
    const authoring = surfaceRow('authoring', 'Authoring', 'Let this agent propose edits to a draft agent’s own configuration — opt-in')
    authoring.toggle.checked = false // the inverse default (OFF) — applyMasterStates re-applies the stored value
    authoring.toggle.addEventListener('change', () => {
      this.store?.set(SURFACE_AUTHORING_KEY, authoring.toggle.checked)
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceAuthoringSwitch = authoring.toggle

    // GH #525 — the bankroll RESET row (design call 3, 2026-08-07: a settings-pane affordance, never a
    // chat command): a plain label + spacer + trailing `<ui-button>` (the entry-list.ts `deleteBtn`
    // precedent), no toggle (there is no on/off here, only a stored figure to clear). GH #541 — it is its
    // OWN Settings fold now, not a fourth row inside Surface Options: a persona's stored figure is not an
    // output modality, and the shared `surface-row` chrome made it read as one. Hidden entirely (fold and
    // all) for a persona that never opted in (`#applyMasterStates` reflects `BANKROLL_CAPABLE_KEY`) —
    // never just dimmed, since a persona with no `/bankroll` pointer has nothing here to configure.
    const bankrollRow = document.createElement('div')
    bankrollRow.setAttribute('data-part', 'bankroll-row')
    const bankrollLabel = document.createElement('span')
    bankrollLabel.setAttribute('data-part', 'bankroll-label')
    bankrollLabel.textContent = 'Stored bankroll'
    const bankrollSpacer = document.createElement('span')
    bankrollSpacer.setAttribute('data-part', 'surface-spacer')
    const bankrollReset = document.createElement('ui-button') as UIButtonElement
    bankrollReset.setAttribute('variant', 'soft')
    bankrollReset.setAttribute('data-part', 'bankroll-reset')
    bankrollReset.textContent = 'Reset'
    bankrollReset.addEventListener('click', () => {
      // `null` (not `undefined`) — a real JSON-round-trippable "cleared" value (memory-store.ts persists
      // via `JSON.stringify`); `sanitizeBankroll(null)` reads it back as `undefined` ("no stored
      // bankroll") exactly like a store that never held the key at all.
      this.store?.set(BANKROLL_KEY, null)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    bankrollRow.append(bankrollLabel, bankrollSpacer, bankrollReset)
    const bankrollItem = settingsItem('bankroll', 'Bankroll', bankrollRow)
    this.#bankrollItem = bankrollItem as HTMLElement & { hidden: boolean }

    surfaceOptions.append(markdown.row, a2uiGroup.group, genuiGroup.group, planner.row, authoring.row)

    // GH #225/#226 — each Settings section is a heading-row fold (the GH #222 Context pattern applied to
    // the config column). The master switches (Agent + one per kind) ride their fold's heading row
    // DECLARATIVELY: marked `slot="summary"` at creation, appended as ordinary fold children here —
    // ui-disclosure's own slot partition adopts them into the summary part at connect (ADR-0158), no
    // connect-order placement dance required.
    const agentItem = settingsItem('agent', 'Agent', settingsEl)
    agentItem.append(agentSwitch)

    // S7-d (LLD §16.4) — "Reset Agent" at the model-grid fold's content END: a second content element in
    // the SAME settingsItem below (`modelGrid` is wholesale-`replaceChildren`d by `#renderModelGrid` on
    // every store change, so this row lives BESIDE it, never inside it, or a re-render would wipe it). The
    // bankroll-row shape verbatim (`[ label | spacer | trailing ui-button ]`), minted for THIS seam's mint
    // path (`onResetRequest`) rather than the store-local bankroll clear. HIDE-not-disable while
    // unregistered — the six-seam family's own stated divergence from `onGenerateRequest`'s card-disable
    // precedent (LLD §16.3): a bare action row has no copy worth showing disabled.
    const resetAgentRow = document.createElement('div')
    resetAgentRow.setAttribute('data-part', 'reset-agent-row')
    // The bankroll-row NOUN-label/VERB-button pairing (review finding, S7-d): "Stored bankroll" | Reset —
    // never the same verb phrase twice at two casings. The label names the THING being reset, the button
    // names the ACTION.
    const resetAgentLabel = document.createElement('span')
    resetAgentLabel.setAttribute('data-part', 'reset-agent-label')
    resetAgentLabel.textContent = 'Agent configuration'
    const resetAgentSpacer = document.createElement('span')
    resetAgentSpacer.setAttribute('data-part', 'surface-spacer')
    const resetAgentBtn = document.createElement('ui-button') as UIButtonElement
    resetAgentBtn.setAttribute('variant', 'soft')
    resetAgentBtn.setAttribute('data-part', 'reset-agent-button')
    resetAgentBtn.textContent = 'Reset Agent'
    resetAgentBtn.addEventListener('click', () => this.#resetRequest?.())
    this.#resetAgentBtn = resetAgentBtn
    resetAgentRow.append(resetAgentLabel, resetAgentSpacer, resetAgentBtn)

    // GH #574 — Agent tab: who it is (Agent · Model · Bankroll — persona state lives with the persona).
    agentContent.append(
      agentItem,
      settingsItem('model', 'Model', modelGrid, resetAgentRow),
      // GH #541 — Bankroll sits adjacent to Surface Options (the modality choices it reads alongside),
      // as its own group rather than a row inside them; GH #574 moved the WHOLE Surface Options fold to
      // its own tab, so Bankroll now closes out the Agent tab instead.
      bankrollItem,
    )
    // GH #574 — Capabilities tab: what it can do (Instructions leads, then the four generic capability
    // kinds below — Skills/Workflows/Resources/Tools). Pattern sources rides the Surface tab instead
    // (see the CAPABILITY_KINDS loop below) — it configures HOW the GenUI modality renders, not a
    // capability the agent has.
    capabilitiesContent.append(settingsItem(ENTRY_KINDS.promptSection, 'Instructions', promptSections.host))
    // GH #574 — Surface tab: how it renders (Surface Options · Pattern sources).
    surfaceContent.append(settingsItem('surface', 'Surface Options', surfaceOptions))
    for (const { kind, label, addLabel } of CAPABILITY_KINDS) {
      const section = this.#makeSection(kind, addLabel)
      // GH #488 — the catalog picker is no longer a separate top-level Settings fold: it mounts directly
      // adjacent to the Surface Options A2UI row instead (one visual cluster — the toggle + its own
      // catalog choice), replacing the earlier placement in a "Catalogs" section far below the modality
      // it configures. Still built/registered through the SAME `#makeSection` call as every other kind,
      // and still wired through `#rewireAllSections`/`#applyMasterStates` by `kind`, never by DOM
      // position (`#capabilitySections`/`#renders` are keyed maps) — only where the host LANDS changes.
      // ADR-0170 cl.5's no-master-switch rationale is unchanged by the move (see below) — a catalog is
      // always exactly-one-active, so there is still no top-level fold, and thus no heading row, for it
      // to ride.
      if (kind === ENTRY_KINDS.catalog) {
        // GH #541 — into the A2UI row's own detail zone (indented, shared inner surface), not as its flat
        // next sibling: the catalog roster and the "+ From library" add-row belong to THIS toggle, and the
        // nesting is what says so.
        a2uiGroup.detail.append(section.host)
        continue
      }
      const item = settingsItem(kind, label, section.host)
      // The kind's MASTER switch (vision rev.5) — rendered on the kind's fold heading row (GH #225;
      // declaratively slotted per GH #226/ADR-0158, like the Agent switch above); `false` gates the
      // whole kind out of the composed prompt + the live roster (isEnabledFlag: default ON). (The catalog
      // kind, handled above, never reaches here: ADR-0170 cl.5 — a master-OFF "no catalogs" state has no
      // wire meaning, and the modality gate already exists, `SURFACE_A2UI_KEY`, applied as this section's
      // dim in `#applyMasterStates`. Minting a switch here would persist a `catalogsEnabled` key nothing
      // reads.)
      const kindSwitch = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
      kindSwitch.setAttribute('data-part', 'kind-enabled')
      kindSwitch.setAttribute('slot', 'summary')
      kindSwitch.setAttribute('aria-label', `${label} enabled`)
      kindSwitch.checked = true
      kindSwitch.addEventListener('change', () => {
        this.store?.set(kindEnabledKey(kind), kindSwitch.checked)
        this.#applyMasterStates(this.store)
        if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
      })
      this.#kindSwitches.set(kind, kindSwitch)
      item.append(kindSwitch)
      // GH #574 — Pattern sources rides the Surface tab (how it renders, alongside Surface Options —
      // the modality it conditions); every other capability kind rides Capabilities (what it can do).
      if (kind === ENTRY_KINDS.patternSource) surfaceContent.append(item)
      else capabilitiesContent.append(item)
    }

    // GH #161 — the old single Context tab's ONE content unit split into TWO content units:
    // `#contextSystemContent` (Agent System — what the agent actually sees, derived fresh from the store
    // per change) and `#contextDialogContent` (Dialog Turns — the per-turn request/response JSON log,
    // newest first). GH #222 (Kim's screenshot ruling: "nesting too much — should be more like the
    // Settings tab") then FLATTENED both: the outer wrapper cards (the "Agent System"/"Dialog Turns"
    // `ui-disclosure data-part="context-section"` shells) are GONE — the segment strip already labels the
    // context, so each content unit is now just its render slot, whose items each read as [ plain section
    // heading row + ONE card of content ] (see `contextItem` below + agent-admin.css's context block).
    // Each unit stays its own reparent-able node (the TKT-0085 wrapper discipline) — `data-role`s
    // unchanged; the render slots build ONCE and are rebuilt wholesale (#renderContextSystem /
    // #renderContextTurns), completely unaffected by which tab hosts them.
    const contextSystemContent = document.createElement('div')
    contextSystemContent.setAttribute('data-role', 'context-system-content')
    contextSystemContent.setAttribute('data-segment', 'Context: System')
    const contextSystemHost = document.createElement('div')
    contextSystemHost.setAttribute('data-part', 'context-system')
    this.#contextSystemHost = contextSystemHost
    contextSystemContent.append(contextSystemHost)

    const contextDialogContent = document.createElement('div')
    contextDialogContent.setAttribute('data-role', 'context-dialog-content')
    contextDialogContent.setAttribute('data-segment', 'Context: Dialog')
    const contextTurnsHost = document.createElement('div')
    contextTurnsHost.setAttribute('data-part', 'context-turns')
    this.#contextTurnsHost = contextTurnsHost
    contextDialogContent.append(contextTurnsHost)

    // ADR-0178 cl.5 / LLD-C9's try-it bar — the authoring ⇄ test flip that used to compose here — RETIRED
    // with the mode seam it drove (ADR-0179 cl.2 / admin-three-pane-ia.lld.md §7): the flip is a PLACE
    // change now, voiced once by the pane-nav strip above. Its composition METHOD survives, re-anchored
    // one level up — the same GH #221 panel-less `ui-tabs` shape, in the shell's header slot rather than
    // atop the old chat stack.

    // ── ADR-0179 cl.1 (LLD §2/§3) — the SETTINGS place: one region, five sections, its own sub-nav ───────
    // The five units are the SAME nodes GH #574/#161 already built above, moved ONCE here at compose time
    // (never a runtime reparent — the whole point of cl.3's "arranged, never duplicated"). DOM order fixes
    // the strip order exactly as the shell's own segment machinery did: Agent · Capabilities · Surface ·
    // Context: System · Context: Dialog.
    //
    // OQ2 — the sub-nav is the SAME segment/tab machinery one level down: an admin-composed PANEL-LESS
    // `ui-tabs` (GH #221's shape, its second re-anchoring), driven from the five units themselves in
    // today's order. S1-b scaffolded it mechanically; LLD-P6 (GH #656, §5's grouping boundary) rules the
    // grouping FINAL at GH #574's ranked five — Agent · Capabilities · Surface · Context: System ·
    // Context: Dialog — and makes two mechanical changes inside that boundary:
    //
    //  1. The tab's KEY is the section's stable `data-role`, its TEXT the human `data-segment` label. S1-b
    //     used the label for both, which welded section IDENTITY to display copy: any future label edit
    //     (§5 hands S2-a the label set) would silently desync `#applySettingsSection`'s match and blank the
    //     pane. Keying on the role the sections already carry makes the label a free variable by
    //     construction — no new attribute, no lookup table.
    //  2. `overflow="menu"` (GH #586's shipped not-enough-room strategy). Five labels — two of them the
    //     long `Context: …` pair — do not fit the detail pane's own column at the bands the admin actually
    //     runs at. MEASURED, both engines: a 414px frame gives the rail 390px and a 800px frame (the wide
    //     pairing docked) gives it 388px — the two `Context: …` tabs overflow at BOTH; only from ~1200px
    //     (rail 588px) up do all five fit, and there the menu is simply `hidden`. The default `scroll`
    //     still technically reaches every section, but through an affordance-less horizontal scroll; the
    //     menu keeps a6 ("each section reachable at every band") honest, pins the selected tab visible,
    //     and is the fleet's own ruled answer rather than a bespoke admin metric.
    const settingsSections = [agentContent, capabilitiesContent, surfaceContent, contextSystemContent, contextDialogContent]
    this.#settingsSections = settingsSections
    const settingsNav = document.createElement('ui-tabs') as UITabsElement
    settingsNav.setAttribute('data-part', 'settings-nav')
    settingsNav.setAttribute('overflow', 'menu') // connect-resolved (tabs.md) — set before the strip connects
    for (const section of settingsSections) {
      const tab = document.createElement('ui-tab') as UITabElement
      tab.setAttribute('key', section.getAttribute('data-role') ?? '')
      tab.textContent = section.getAttribute('data-segment') ?? ''
      // aria-controls → the section this tab reveals (panel-less element-reflection, the pane-tabs
      // precedent: the sections are NOT `ui-tab-panel`s, and visibility stays this element's own).
      tab.link(section, this.#nextId('settings-nav'))
      settingsNav.append(tab)
    }
    settingsNav.selected = settingsSections[0]?.getAttribute('data-role') ?? ''
    settingsNav.addEventListener('select', (event) => {
      event.stopPropagation() // this element's OWN event vocabulary stays closed (the try-it bar's precedent)
      this.#applySettingsSection((event as CustomEvent<{ value: string; index: number }>).detail.value)
    })
    // GH #686's Amendment (LLD §16.1/§16.5) — the Settings region is a plain sibling `div` now, never a
    // `ui-master-detail-pane` (the MD wrapper role retires with the vehicle; this element owns no `pane`
    // attribute to carry). Same contents, same DOM identities, moved here whole exactly as before.
    const settingsPane = document.createElement('div')
    settingsPane.setAttribute('data-part', 'settings-pane')
    // GH #665 (screens:layout-checker finding 1, SHIPPABLE grade) — the settings column went unnamed at
    // exactly the band the (then-)pane-nav's own "Settings" label vanished. The layout-checker's finding
    // proposed a third "Settings" kicker here; Kim OVERRULED it (2026-08-10, GH #665 follow-up): the
    // sub-nav labels the column itself — no kicker, the properties-rail grammar stands on its own. The two
    // CONVERSATION kickers remain the labeling system for the canvases.
    settingsPane.append(settingsNav, ...settingsSections)

    // ── ADR-0179 OQ4 (LLD §2), GH #666, re-ruled by GH #686's Amendment — the CO-PILOT place: ONE
    // conversation card, armed or not (renamed from "Author" — the vocabulary re-pins to
    // `[Chat | Settings | Co-pilot]`, LLD §16.1). Kim's 2026-08-10 pixel ruling ("the center pane should
    // be a CHAT, just like Test chat") retires the old two-box arrangement — a borderless prose block
    // beside a bordered chat card. The Co-pilot place IS the interview's `ui-conversation` from first
    // paint; unarmed, its log is empty and its own composer is the flow's entry (GH #684 — the headline +
    // copy that used to occupy the log while unarmed are gone; the composer's own placeholder and the
    // pre-arm Model/Effort pickers are the only orientation left, per Kim's live pixel-truth ruling).
    // Arming FILLS this card — it never swaps one box for another, which is why the mount is not lazy.
    //
    // GH #686's Amendment retires the `ui-master-detail-pane` wrapper this card used to mount into
    // (`author-pane`) along with the whole MD vehicle — `#mountAuthoringConversation` below appends the
    // conversation directly into `#paneHolder` and its OWN `data-part` (`copilot-pane`, set there) carries
    // the region identity now; no wrapper element exists for it any more.

    // GH #686's Amendment (LLD §16.1/§16.2) — three SIBLING regions, no pairing vehicle: the DOM order is
    // `PANE_ORDER` (chat · settings · copilot), which is also the reading order `#applyPaneVisibility`'s
    // `data-show` composes in and the order a primary repoint falls back through. `conversation`/
    // `settingsPane` append FIRST (chat, settings) so `#mountAuthoringConversation`'s own append below
    // lands copilot as the holder's THIRD child, never its first — several probes key off
    // `el.querySelector('ui-conversation')` matching the TEST conversation, document order (the
    // shipped-anatomy precedent this ordering preserves).
    paneHolder.append(conversation, settingsPane)
    this.#mountAuthoringConversation()
    // S7-c — the unified header bar (LLD §16.1/§16.3), `data-slot="header"`'s one authored child.
    shell.append(this.#composeHeader(), paneHolder)
    this.append(shell)

    this.#shell = shell
    this.#conversation = conversation
    this.#settingsEl = settingsEl
    // Paint the entry visibility state (LLD §16.2's OQ-D rec: all three shown, Chat primary) and the first
    // settings sub-section.
    this.#applySettingsSection(settingsNav.selected)
    this.#applyPaneVisibility()
    // GH #666 order rule, applied to the header's own seams — a page can register/push data BEFORE this
    // element ever connects (the `#generateRequest`/`#reflectAuthorEntry` precedent); both reflect calls
    // read whatever landed on the private fields BEFORE `#compose` ran, so build-time state is honest
    // whichever order the page called in.
    this.#applyAgentRoster()
    this.#applyActionAvailability()
  }

  /**
   * S7-c (LLD §16.1/§16.3) — the unified header bar: `[data-part="admin-header"]`, the `header` slot's one
   * authored child. Three zones, DOM order matching the anatomy diagram: `agent-select` (`setAgentRoster`/
   * `onAgentSelect`), the pane-visibility pair (`pane-pills` wide / `pane-segments` narrow — the SAME
   * `#panesShown`/`#panePrimary` truth §16.2 already owns, never a second copy of it), and
   * `header-actions` (New Agent · Import · Export, wide labeled `ui-button`s / narrow `+` + a `•••`
   * `ui-menu`). No `data-landmark` override — the slot's own default (`banner`, super-shell.ts's
   * `roleFor`) is exactly the anatomy's "no landmark override; the nav retired" note.
   *
   * Band rendering (pills⇄segments, wide-actions⇄narrow-actions) is pure CSS (agent-admin.css's own
   * `@container` pair on the composed `ui-super-shell`, the GH #665 54rem line REPURPOSED — see that
   * file for the full mechanics); this method only builds both renderings of the SAME state, once, and
   * wires each to write through the shared visibility machine (`#setPanesShown`/`#setPanePrimary`) or its
   * own registered seam.
   */
  #composeHeader(): HTMLElement {
    const header = document.createElement('div')
    header.setAttribute('data-slot', 'header')
    header.setAttribute('data-part', 'admin-header')

    // ── Zone 1 — the agent roster select (setAgentRoster / onAgentSelect) ──────────────────────────────
    const agentSelect = document.createElement('ui-select') as UISelectElement
    agentSelect.setAttribute('data-part', 'agent-select')
    agentSelect.setAttribute('placeholder', 'Select agent')
    // The select's own internal select/change events stay CONTAINED (LLD §16.3's own restatement of the
    // closed-seven-event law) — the registered callback, not a re-emitted host event, is this element's
    // vocabulary for "the user picked an agent".
    agentSelect.addEventListener('select', (event) => {
      event.stopPropagation()
      this.#agentSelectCallback?.((event as CustomEvent<string>).detail)
    })
    this.#agentSelectEl = agentSelect

    // ── Zone 2a — the WIDE pane pills (ui-toggle ×3, LLD §16.1) ────────────────────────────────────────
    const panePills = document.createElement('div')
    panePills.setAttribute('data-part', 'pane-pills')
    for (const pane of PANE_ORDER) {
      const { glyph, label } = PANE_IDENTITY[pane]
      const pill = document.createElement('ui-toggle') as UIToggleElement
      pill.setAttribute('data-pane', pane)
      const identityIcon = document.createElement('ui-icon')
      identityIcon.setAttribute('slot', 'icon')
      identityIcon.setAttribute('glyph', glyph)
      const stateIcon = document.createElement('ui-icon') as UIIconElement
      stateIcon.setAttribute('slot', 'state-icon')
      // The pill's own visible label text IS its accessible name (toggle.md's `label` slot) — no
      // aria-label owed here; only the ICON-ONLY narrow segments/actions need one (LLD §16.4 done-when).
      pill.append(identityIcon, document.createTextNode(label), stateIcon)
      // LLD §16.2's refused-toggle wiring, for real (toggle.md's "Refused toggle" mechanism, S7-a's own
      // reason for existing): `toggle` fires BEFORE `pressed` commits — compute the WOULD-BE next set,
      // and if it is empty, refuse (event.preventDefault()) rather than let the pill flip to a state
      // `#setPanesShown` would immediately refuse anyway (a flip-then-stick paint the min-one invariant
      // does not actually allow). A non-empty result always commits through the ONE shared mutator, which
      // repoints `primary` itself when the caller's own primary fell out of the set — turning a pane ON
      // never needs to move primary, turning the CURRENT primary off does, and `#setPanesShown` already
      // knows which; this handler only ever hands it the CURRENT primary, unchanged.
      //
      // The `pane` argument to `#setPanesShown` below (its own third, "skip this one" parameter) is load-
      // bearing, not decorative: `toggle` fires BEFORE `pressed` commits, and toggle.ts's OWN click handler
      // runs its single authoritative `this.pressed = !this.pressed` line immediately AFTER this listener
      // returns (same synchronous dispatch). If the mirror this call triggers (`#applyHeaderPaneState`,
      // via `#setPanesShown` → `#applyPaneVisibility`) also wrote THIS pill's own `pressed` here, that
      // write would land BEFORE toggle.ts's own commit line reads `this.pressed` to flip it — a real,
      // measured double-flip (mirror sets it correct, then toggle.ts's `!` flips it wrong again), which
      // silently desyncs `pressed` from `#panesShown` and corrupts the NEXT click's own `turningOn` read.
      // Every OTHER pill/segment/icon still mirrors normally; only THIS pane's own `pressed` write is
      // deferred to toggle.ts's own commit, which is correct unassisted the moment nothing races it.
      pill.addEventListener('toggle', (event) => {
        const turningOn = !pill.pressed
        const next = new Set(this.#panesShown)
        if (turningOn) next.add(pane)
        else next.delete(pane)
        if (next.size === 0) {
          event.preventDefault() // refused — min-one invariant; pressed stays exactly where it was
          return
        }
        this.#setPanesShown(next, this.#panePrimary, pane)
      })
      this.#panePills.set(pane, pill)
      this.#panePillStateIcons.set(pane, stateIcon)
      panePills.append(pill)
    }

    // ── Zone 2b — the NARROW pane segments (ui-segmented-control, single-select, LLD §16.1) ───────────
    const paneSegments = document.createElement('ui-segmented-control') as UISegmentedControlElement
    paneSegments.setAttribute('data-part', 'pane-segments')
    paneSegments.setAttribute('aria-label', 'Visible pane')
    for (const pane of PANE_ORDER) {
      const { glyph, label } = PANE_IDENTITY[pane]
      const segment = document.createElement('ui-segment') as UISegmentElement
      segment.setAttribute('value', pane)
      // Icon-only (LLD §16.4 done-when: "every icon-only affordance... carries an asserted accessible
      // name") — segment.md's own labelSource is textContent, which an icon-only segment has none of, so
      // the consumer-supplied `aria-label` (the same idiom this file already uses for every icon-only
      // ui-switch/ui-button, e.g. `agentSwitch`/`overflowTrigger` below) is the real name source.
      segment.setAttribute('aria-label', label)
      const segmentIcon = document.createElement('ui-icon')
      segmentIcon.setAttribute('glyph', glyph)
      segment.append(segmentIcon)
      paneSegments.append(segment)
    }
    // LLD §16.2's narrow-segment write semantics ("set primary AND ensure membership") — `#setPanePrimary`
    // verbatim, the arm's own caller (`#rewireAuthoringContext`).
    paneSegments.addEventListener('change', (event) => {
      event.stopPropagation() // the closed seven-event set stays closed — this element re-emits nothing
      const pane = paneSegments.value as Pane | null
      if (pane !== null) this.#setPanePrimary(pane)
    })
    this.#paneSegments = paneSegments

    // ── Zone 3 — header-actions (New Agent · Import · Export; LLD §16.1's wide/narrow collapse) ───────
    const headerActions = document.createElement('div')
    headerActions.setAttribute('data-part', 'header-actions')

    const newAgentWide = document.createElement('ui-button') as UIButtonElement
    newAgentWide.setAttribute('data-part', 'new-agent-wide')
    newAgentWide.setAttribute('variant', 'soft')
    const newAgentWideIcon = document.createElement('ui-icon')
    newAgentWideIcon.setAttribute('slot', 'leading')
    newAgentWideIcon.setAttribute('glyph', 'plus')
    newAgentWide.append(newAgentWideIcon, document.createTextNode('New Agent'))
    newAgentWide.addEventListener('click', () => this.#newAgentRequest?.())
    this.#newAgentWideBtn = newAgentWide

    // The narrow `+` collapse (LLD §16.4) — the SAME seam, an icon-only rendering (button.md's
    // `icon-only` opt-in + a real `aria-label`, the overflowTrigger idiom below).
    const newAgentNarrow = document.createElement('ui-button') as UIButtonElement
    newAgentNarrow.setAttribute('data-part', 'new-agent-narrow')
    newAgentNarrow.setAttribute('variant', 'soft')
    newAgentNarrow.setAttribute('icon-only', '')
    newAgentNarrow.setAttribute('aria-label', 'New Agent')
    const newAgentNarrowIcon = document.createElement('ui-icon')
    newAgentNarrowIcon.setAttribute('slot', 'leading')
    newAgentNarrowIcon.setAttribute('glyph', 'plus')
    newAgentNarrow.append(newAgentNarrowIcon)
    newAgentNarrow.addEventListener('click', () => this.#newAgentRequest?.())
    this.#newAgentNarrowBtn = newAgentNarrow

    const importAction = document.createElement('ui-button') as UIButtonElement
    importAction.setAttribute('data-part', 'import-action')
    importAction.setAttribute('variant', 'ghost')
    importAction.textContent = 'Import'
    importAction.addEventListener('click', () => this.#importRequest?.())
    this.#importActionBtn = importAction

    const exportAction = document.createElement('ui-button') as UIButtonElement
    exportAction.setAttribute('data-part', 'export-action')
    exportAction.setAttribute('variant', 'ghost')
    exportAction.textContent = 'Export'
    exportAction.addEventListener('click', () => this.#exportRequest?.())
    this.#exportActionBtn = exportAction

    // The narrow `•••` collapse (LLD §16.4/§16.6 OQ-B) — Import/Export ONLY (Reset stays Settings-only,
    // Kim's text ruling, OQ-B). The `overflowTrigger` shape mirrors the retired site-level overflow menu
    // exactly (icon-only + a real aria-label, GH #168's "no glued '…' text node" fix). No `data-part` of
    // its own: `ui-menu`'s `#ensureParts` unconditionally stamps `data-part="trigger"` on its first child
    // at connect (menu.ts), clobbering any value authored here — every selector/CSS rule that needs THIS
    // button addresses it as `[data-part='overflow-menu'] [data-part='trigger']` instead (scoped through
    // the menu's own part, never a second, losing attribute name).
    const overflowMenu = document.createElement('ui-menu') as UIMenuElement
    overflowMenu.setAttribute('data-part', 'overflow-menu')
    overflowMenu.setAttribute('placement', 'bottom-end')
    const overflowTrigger = document.createElement('ui-button') as UIButtonElement
    overflowTrigger.setAttribute('variant', 'ghost')
    overflowTrigger.setAttribute('icon-only', '')
    overflowTrigger.setAttribute('aria-label', 'More actions')
    const overflowIcon = document.createElement('ui-icon')
    overflowIcon.setAttribute('slot', 'leading')
    overflowIcon.setAttribute('glyph', 'dots-three')
    overflowTrigger.append(overflowIcon)
    this.#overflowTriggerBtn = overflowTrigger
    const overflowImportItem = document.createElement('div')
    // A real gotcha, not stylistic naming: layering.test.ts's raw-text specifier scanner keys on the
    // module-loading keyword sitting directly against a following quote mark, ANYWHERE in this file — it
    // cannot tell that from a plain string literal holding the same six letters. The trailing suffix here
    // breaks that adjacency.
    overflowImportItem.dataset.value = 'import-agent'
    overflowImportItem.textContent = 'Import'
    this.#overflowImportItem = overflowImportItem
    const overflowExportItem = document.createElement('div')
    overflowExportItem.dataset.value = 'export-agent'
    overflowExportItem.textContent = 'Export'
    this.#overflowExportItem = overflowExportItem
    overflowMenu.append(overflowTrigger, overflowImportItem, overflowExportItem)
    overflowMenu.addEventListener('select', (event) => {
      event.stopPropagation()
      const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
      if (value === 'import-agent') this.#importRequest?.()
      else if (value === 'export-agent') this.#exportRequest?.()
    })

    headerActions.append(newAgentWide, importAction, exportAction, newAgentNarrow, overflowMenu)

    header.append(agentSelect, panePills, paneSegments, headerActions)
    return header
  }

  /** OQ2 — reveal ONE settings section (visibility-only, exactly the shell strip's own SPEC-R7c behavior:
   *  no reparenting, no rebuild, the same node identities before and after every flip — so a dirty field,
   *  an added entry, and every fold's open state all survive a flip away and back).
   *
   *  LLD-P6: the match is on the section's stable `data-role`, never its display label — the strip's tab
   *  keys are minted from the same attribute, so the two cannot drift. */
  #applySettingsSection(key: string): void {
    for (const section of this.#settingsSections) {
      section.hidden = section.getAttribute('data-role') !== key
    }
  }

  /** GH #665 — a quiet identity header for a conversation region: the fleet's `ui-text[variant='kicker']`
   *  eyebrow (nav-rail's `context-label`/GH #624 precedent — dimensions/uppercase-casing already live on
   *  the shared control, this method only repoints the ink via `[data-part='region-kicker']` in
   *  agent-admin.css, the same token-repoint pattern the picker pills use). `prepend`-ed onto a fresh
   *  `ui-conversation` BEFORE it ever connects: `connected()` only ever `this.append(this.#log, composer)`
   *  (conversation.ts) — appending to whatever is already there — so a kicker seated first stays first,
   *  and `reset()`'s own `#log!.replaceChildren()` clears only the log's OWN children, never this
   *  host-level sibling. */
  #makeRegionKicker(label: string): HTMLElement {
    const kicker = document.createElement('ui-text')
    kicker.setAttribute('variant', 'kicker')
    kicker.setAttribute('size', 'sm')
    kicker.setAttribute('data-part', 'region-kicker')
    kicker.textContent = label
    return kicker
  }

  /**
   * ADR-0179 OQ4 (LLD §2) — the Author place's UNARMED state: a first-class place that vanishes when the
   * flow is unarmed would not be a place at all, so the region always exists and says what it is for.
   *
   * GH #666 — COMPOSER-FIRST (Kim's 2026-08-10 ruling on his own live report: "where am I supposed to
   * describe it?"). The unarmed third is not a promise with no verb: typing the first message IS the start.
   *
   * GH #666 REOPENED (Kim's second 2026-08-10 ruling, pixel-truth) — that composer is no longer a separate
   * element here. It is the interview card's OWN composer, pinned at its bottom exactly like Test chat's.
   * One composer in the column, at every moment of the flow — arming fills the card rather than swapping
   * it for a different one.
   *
   * GH #681 (Kim's 2026-08-10 live pass) removed a secondary "New agent → Generate" action that used to
   * ride inside the card's empty log (a bare arm, no opening turn): it duplicated the roster (...) menu's
   * identically-labelled item down to the outcome (both ultimately called the page's
   * `createGeneratedAgent`), and creating a new agent is an action that belongs in the roster menu, not
   * duplicated inside the card. GH #684 (Kim's later 2026-08-10 live pixel-truth ruling) then removed the
   * headline + copy that were the empty log's only remaining content — `#createAuthorEmpty()` and
   * `ui-conversation.setEmptyState()` are gone from this element entirely (no dead code for a node with
   * nothing left to hold): the unarmed card's log is simply empty, and the composer's own placeholder plus
   * the pre-arm Model/Effort pickers (GH #670) are the only orientation left. Whether that is enough
   * orientation is an open question for a future live ruling, not resolved here (GH #684).
   *
   * The card's own composer — the first message arms via `#startFromFirstMessage` — remains the one
   * in-card entry; the roster menu is the survivor for "arm without typing anything".
   *
   * The card's `disabled` state still tracks whether a mint path exists at all (`#generateRequest`,
   * registered through `onGenerateRequest(cb)` — the registration idiom, `UIConversationElement.onSubmit`'s
   * own shape, SPEC-R5's never-a-CustomEvent law, because the mint path is page-owned
   * (`createGeneratedAgent`) and this component cannot import site code, the DAG). With NO callback
   * registered there is no mint path, so the unarmed card is `disabled` — the composer's own busy guard
   * refuses the send before it reads the text (`#send`'s first line, TKT-0034), so a first message that
   * could arm nothing is structurally impossible to swallow rather than handed back after the fact.
   *
   * GH #666 defect 1 — the `disabled` reveal is computed HERE from `#generateRequest`, not only pushed by
   * `onGenerateRequest`. The page registers before it appends the element (agent-admin-app.ts), so at
   * registration time this state does not exist yet and the push landed on nothing; reading the field at
   * build time makes the reveal order-free — register before OR after connect, both reveal.
   * (`ui-conversation-composer`'s own `onMicClick` opt-in carries this same two-sided shape.)
   */

  /** GH #666/#684 — the UNARMED card's own state, in one place: the card is available only when a mint
   *  path exists (the OQ4 degrade above). Armed, `#syncAuthoringConversationConfig` owns `disabled` from
   *  the Builder's own store instead. Idempotent, so every caller (mount · registration · leaving the
   *  flow) can run it unconditionally. */
  #reflectAuthorEntry(): void {
    const conversation = this.#authoringConversation
    if (conversation === null || this.authoringStore !== undefined) return
    conversation.disabled = this.#generateRequest === undefined
    this.#reflectPreArmPickers(conversation)
  }

  /**
   * GH #670 — the UNARMED card's Model/Effort pickers: the same two rows the armed interview shows, from
   * the same roster and the same `EFFORT_LEVELS`, so a choice exists at FIRST TOUCH instead of only after
   * the user has already committed to defaults. Setting the four props is all it takes — the composer's own
   * guard reads an unset `models`/`efforts` as "no picker to render" (conversation-composer.ts), which is
   * precisely why the unarmed card had none.
   *
   * The inclusion set reads as ABSENT here (there is no Builder store yet), which `isModelIncluded` answers
   * with each model's own `includedByDefault` — the SAME set a freshly-minted Builder store yields, since
   * its seed carries no inclusion record either. Same roster before and after the arm, by construction.
   *
   * The committed VALUE is whatever this element can honestly answer with no store to read:
   *  - `model` is the pre-arm pick ALONE. Unpicked it stays `undefined`, which the composer renders as the
   *    neutral "Models" trigger — and that is the truthful reading, not a gap: the model a fresh interviewer
   *    runs on is its own store's default, which is page-owned (`builderStore()`) and unknowable from here,
   *    so naming one would print a label the arm then contradicts.
   *  - `effort` IS knowable (`#effort` is element-local and is exactly what the arm will carry over), so the
   *    pre-arm pick falls back to the live value rather than to nothing.
   */
  #reflectPreArmPickers(conversation: UIConversationElement): void {
    const roster = modelRoster()
    conversation.models = roster.filter((m) => isModelIncluded(undefined, m))
    conversation.model = this.#preArm.model
    conversation.efforts = EFFORT_LEVELS
    conversation.effort = this.#preArm.effort ?? this.#effort
  }

  /**
   * GH #670 — a Model pick from the Author card, at EITHER arming state (the one pre-arm-then-seed path
   * Kim's fork-1/3 ruling names). ARMED it commits to the Builder's OWN store, which feeds the committed
   * value back down — writing it to the draft instead would let the interviewer's model choice silently
   * become the draft agent's. UNARMED there is no store to write, so the pick is REMEMBERED and seeds the
   * mint (`#startFromFirstMessage`, the arm) rather than evaporating into a no-op.
   */
  #pickAuthoringModel(id: string): void {
    if (this.authoringStore !== undefined) {
      this.authoringStore.set('model', id)
      return
    }
    this.#preArm = { ...this.#preArm, model: id }
    this.#reflectAuthorEntry() // props down: the trigger now names what the user chose
  }

  /** GH #670 — an Effort pick, the IDENTICAL treatment (fork 3: no special-casing). Armed, effort's home is
   *  this element's own dial; unarmed, the same `#preArm` record holds it until the arm carries it there. */
  #pickAuthoringEffort(level: EffortLevel): void {
    if (this.authoringStore !== undefined) {
      this.#effort = level
      if (this.#authoringConversation) this.#authoringConversation.effort = level
      return
    }
    this.#preArm = { ...this.#preArm, effort: level }
    this.#reflectAuthorEntry()
  }

  /**
   * GH #666 — the composer-first entry: the first message typed into the UNARMED Author card ARMS the flow
   * and then lands in the Builder's transcript as the interview's opening turn. Nothing is swallowed — the
   * description the user typed is what the Builder answers.
   *
   * GH #681 — the card's ONE in-card arming entry (the empty state's secondary "New agent → Generate"
   * button, which used to run the same arm from a click, was removed as a duplicate of the roster (...)
   * menu's identically-labelled item; `#requestGenerate` accordingly folded in here, its own single caller).
   * `#generateRequest` is the SAME page callback the roster menu's item runs (`createGeneratedAgent` — mint
   * the draft, assign `authoringStore`). Everything that follows is `#rewireAuthoringContext`'s
   * already-shipped machinery: reset the interview, sync its config, land the user in Author. Arming here
   * and arming from the roster therefore converge on identical state by construction — except the pre-arm
   * pick below, which only this entry carries (the roster menu, invoked from outside any specific card, has
   * no pick to carry).
   *
   * GH #670 — the arm carries the card's pre-arm Model/Effort pick INTO the mint. Each half goes to the
   * home that owns it: `model` rides the seed into the store the page is about to mint, and `effort` lands
   * on this element, which is where effort lives at every arming state. An untouched half is simply absent,
   * and the minted store's own default wins (fork 2). Seeded, never written-then-overwritten: by the time
   * `#rewireAuthoringContext` runs `#syncAuthoringConversationConfig` against the new store, the user's
   * model IS that store's committed value, so there is no second write to lose a race with. The pick is
   * read into a local BEFORE the callback because the mint path re-enters this element (the page's
   * `applyPersona` swaps `store`, firing GH #145's reset) and empties `#preArm` on the way through — the
   * seed is already in hand by then.
   *
   * GH #666 REOPENED — the caller is the CARD'S OWN composer (`#mountAuthoringConversation`'s `onSubmit`),
   * so this method no longer replays a submit from outside: `ui-conversation`'s own composer forwarder has
   * already painted the user's bubble (`addUserMessage`, then the callback) by the time this runs. The
   * arm's `reset()` clears that optimistic bubble, so the `addUserMessage` below re-seats it — exactly one
   * bubble either way, and the description is on screen from the keystroke onward. `#handleSubmit` is
   * reused rather than re-implemented, which is what keeps the TURN logic single.
   *
   * If the arm does not take, nothing is swallowed and nothing is put back by hand: with NO mint path the
   * card is `disabled`, so the composer's own busy guard refused the send before reading the text; with a
   * mint path that armed nothing, the optimistic bubble simply stays in the card unanswered.
   *
   * The `whenFlushed()` await is load-bearing, not defensive: `authoringStore` is a SIGNAL, so the page's
   * assignment lands synchronously but the effect that acts on it (mount the interview, `reset()` it,
   * sync its config) is microtask-batched. Submitting before that flush would push the opening turn into a
   * conversation that does not exist yet — or, worse, into one the arm's own `reset()` is about to clear.
   */
  async #startFromFirstMessage(text: string): Promise<void> {
    if (this.authoringStore === undefined) {
      // GH #670 — a choice made before there was a store to hold it seeds the one this call is about to
      // create.
      const { model, effort } = this.#preArm
      if (effort !== undefined) this.#effort = effort
      this.#generateRequest?.({ model })
    }
    if (this.authoringStore !== undefined) await whenFlushed()
    const conversation = this.#authoringConversation
    if (this.authoringStore === undefined || conversation === null) return
    conversation.addUserMessage(text)
    if (conversation.disabled) return // armed, but the Builder's own master switch is off — the turn is not owed
    this.#handleSubmit(text, 'copilot')
  }

  /** One conversation's content-render seam, parameterized by the store whose Markdown modality governs
   *  it (extracted verbatim from the test conversation's own inline callback so the authoring context can
   *  share it — the behaviour is identical, only the store it reads differs). */
  #renderContent(text: string, store: SettingsStore | undefined): Node {
    if (!isEnabledFlag(store?.get(SURFACE_MARKDOWN_KEY))) return document.createTextNode(text)
    if (customElements.get('ui-markdown') === undefined) {
      preloadMarkdownRenderer()
      return document.createTextNode(text)
    }
    const node = document.createElement('ui-markdown') as HTMLElement & { markdown: string }
    node.markdown = text
    return node
  }

  /** The GH #63 client-turn guards, extracted so BOTH conversations run the one budget. The budget is
   *  deliberately SHARED rather than per-context: it bounds this element's error-driven turn spawning as a
   *  whole, which is what the livelock it closes was made of. */
  #handleClientMessage(conversation: UIConversationElement, origin: 'chat' | 'copilot', message: unknown): void {
    if (this.agentSurfaceTurn === undefined) return
    const isError = typeof message === 'object' && message !== null && 'error' in message
    if (isError) {
      if (this.#errorLoopHalted) return // already halted + reported; drop until a user action re-arms
      this.#consecutiveErrorTurns += 1
      if (this.#consecutiveErrorTurns > ERROR_TURN_BUDGET) {
        this.#errorLoopHalted = true
        conversation.beginAgentTurn().fail(`surface loop halted — ${ERROR_TURN_BUDGET} consecutive turns ended in a renderer error`)
        return
      }
    } else {
      this.#consecutiveErrorTurns = 0
      this.#errorLoopHalted = false
    }
    // GH #662 — the deferred turn carries the ORIGIN it was spawned from. Under the pane-keyed selector a
    // pane flip inside this macrotask window re-routed the turn to whatever place the user had walked to
    // (LLD §8's named inherited hazard); origin-anchoring closes it as a side effect of the triple's own
    // requirement.
    setTimeout(() => this.#runSurfaceTurn({ kind: 'client', message }, origin), 0)
  }

  /**
   * ADR-0178 cl.5 (LLD-C6) — WHICH context drives the next turn, and everything that follows from it.
   *
   * The authoring context resolves only while the flow is armed AND the active PLACE is Author; everything
   * else resolves to EXACTLY today's values, which is the zero-regression invariant this whole
   * dual-context scaffold rests on (asserted in the suite: an inactive flow builds a byte-identical
   * request).
   *
   * ADR-0179 cl.2 (admin-three-pane-ia.lld.md §2/§4) re-keyed the selector from the retired `#mode` seam
   * to `#pane`. GH #662's TRIPLE DOCK re-keys it once more, to the SUBMITTING COMPOSER'S ORIGIN — and this
   * is a correctness requirement of the triple, not a preference:
   *
   *   Below the triple line exactly one place paints, so "the active place" and "the composer the user can
   *   reach" are the same thing and `#pane` is a sound proxy for origin. At the triple line BOTH composers
   *   are on screen and typable at once. A user typing into CHAT's composer while the nav still says
   *   Author would have resolved the AUTHORING quadruple under the pane-keyed selector — the turn landing
   *   in the interview transcript and, gate ON, its patch reaching the draft. That is precisely the thing
   *   cl.4 promises cannot happen ("Chat stays pure test by construction"), and the pane proxy is what
   *   would have broken it. Origin is the property cl.4 actually rests on: per-pane composers mean each
   *   composer IS a context, permanently, at every band.
   *
   * The fence itself is untouched — it keys off DRIVING-STORE IDENTITY, never this selector
   * (`#runSurfaceTurn`'s `drivingStore === this.authoringStore` conjunct). Re-keying to origin STRENGTHENS
   * it: the Chat composer can no longer resolve `authoringStore` under any pane, band, or timing, which
   * also closes the mid-defer pane-flip misroute the LLD §8 named as inherited (a deferred client turn now
   * reads the origin it was spawned from, not whatever place the user has since walked to).
   *
   * `store` is what the turn COMPOSES FROM — never what a patch applies to. A patch always targets
   * `this.store`, the draft.
   */
  #contextFor(origin: 'chat' | 'copilot'): {
    store: SettingsStore | undefined
    conversation: UIConversationElement | null
    session: 'authoring' | 'test' | undefined
    history: AdminTurn[]
  } {
    const authoringStore = this.authoringStore
    if (authoringStore !== undefined && origin === 'copilot' && this.#authoringConversation) {
      return { store: authoringStore, conversation: this.#authoringConversation, session: 'authoring', history: this.#authoringHistory }
    }
    // `session` stays UNDEFINED for the test context rather than the literal 'test': the runner defaults an
    // absent value to the same slot, so an inactive flow's request is byte-identical to a pre-S3 one.
    // GH #644 — `history` is likewise the TEST context's own array, never `#authoringHistory`.
    return { store: this.store, conversation: this.#conversation, session: undefined, history: this.#history }
  }

  /**
   * ADR-0178 cl.5 — mount the authoring conversation, once.
   *
   * GH #666 (Kim's 2026-08-10 pixel ruling) — NO LONGER LAZY. ADR-0178 cl.5 mounted this on the first
   * `authoringStore` assignment so an element that never entered the flow carried no second conversation;
   * that was a cost argument, and the ruling overrides it with a shape requirement: the Author place must
   * BE this card unarmed, with the same border, kicker and bottom-pinned composer as Test chat. A second
   * element that only imitated the card is the duplication the lazy mount was avoiding in the first place,
   * so the honest reading of cl.5 is to mount the real one. `#compose()` is now its only caller of
   * consequence; the guard below keeps `#rewireAuthoringContext`'s historical call a no-op.
   */
  #mountAuthoringConversation(): void {
    // GH #686's Amendment (LLD §16.1/§16.5) — the mount target is `#paneHolder` DIRECTLY now: the
    // `ui-master-detail-pane` wrapper (`#authorPane`) this used to mount into retired with the whole MD
    // vehicle. This element's own `data-part` (`copilot-pane`, below) carries the region identity that
    // wrapper used to.
    const holder = this.#paneHolder
    if (this.#authoringConversation !== null || holder === null) return
    const conversation = new UIConversationElement()
    conversation.setAttribute('data-part', 'copilot-pane') // LLD §16.1 — renamed from the retired author-pane wrapper
    // GH #665 — the interview's own kicker (the "Builder INTERVIEW" identity Kim's screenshot named),
    // matching the test conversation's `#makeRegionKicker` above.
    conversation.prepend(this.#makeRegionKicker('Builder interview'))
    // Same two developer-surface opt-ins the test conversation takes (GH #238/#240/ADR-0159): the
    // interview is watched by the same person debugging the draft.
    conversation.receipt = true
    conversation.sources = true
    // GH #662 — this composer IS the authoring context, origin-keyed (`#contextFor`). GH #666 — and while
    // the flow is UNARMED it is also the flow's entry: the first message arms, then lands as the
    // interview's opening turn (one composer in the column at every moment, so there is no second submit
    // path to keep in step).
    conversation.onSubmit((text) => {
      if (this.authoringStore === undefined) void this.#startFromFirstMessage(text)
      else this.#handleSubmit(text, 'copilot')
    })
    // GH #670 — one handler per picker, covering BOTH arming states: armed, the pick commits to its own
    // home (the Builder's store for model — writing it to the draft would let the interviewer's model choice
    // silently become the draft agent's; this element for effort); unarmed, it is remembered and seeds the
    // arm. The unconditional `this.authoringStore?.set(...)` these replace was the #670 bug itself: unarmed
    // there is no store, so the write landed on nothing.
    conversation.onModelChange((id) => this.#pickAuthoringModel(id))
    conversation.onEffortChange((id) => this.#pickAuthoringEffort(id as EffortLevel))
    conversation.onClientMessage((message) => this.#handleClientMessage(conversation, 'copilot', message))
    conversation.setContentRenderer((text) => this.#renderContent(text, this.authoringStore))
    holder.append(conversation)
    this.#authoringConversation = conversation
    // GH #666 — the card starts in its empty-log state (and, with no mint path, unavailable).
    this.#reflectAuthorEntry()
  }

  /**
   * GH #686's Amendment (LLD §16.2) — the ONE mutator every visibility write funnels through: it holds the
   * min-one invariant (an empty resulting set is REFUSED — a no-op, the caller's previous state stands —
   * "a zero-pane surface is broken by construction") and the primary invariant (`primary` always ends up a
   * member of the resulting set: if the caller's own `primary` argument isn't in `shown`, this repoints to
   * the first remaining member in `PANE_ORDER` — the "removing the primary repoints it to the first
   * remaining member in reading order" rule, read as a general invariant rather than a pill-specific one).
   *
   * PRIVATE by contract (LLD §4/§16.2's "no attribute, no event" carryover): no attribute, no event, no
   * `attributes[]` row. `#setPanePrimary` below is one real caller (the arm — LLD §16.2's "ensure copilot
   * ∈ shown + primary = 'copilot'" line); a WIDE pill's toggle-membership write (S7-c's `#composeHeader`)
   * is the other, funnelling through this SAME mutator, so the min-one/primary-repoint invariants below
   * need no second implementation. Probes reach the machine directly via the protected
   * `setPaneVisibilitySeam`.
   *
   * `skipPillPressedFor` (optional) — the ONE pane whose own pill `#applyHeaderPaneState` must NOT write
   * `pressed` for this reflect (see the wide pill's own `toggle` listener, `#composeHeader`, for the full
   * double-flip mechanics this parameter exists to avoid). Every other caller (the narrow segment
   * `change` handler, the arm) passes nothing — no pill is mid-commit for either of those paths.
   */
  #setPanesShown(shown: ReadonlySet<Pane> | readonly Pane[], primary: Pane, skipPillPressedFor?: Pane): void {
    const next = new Set(shown)
    if (next.size === 0) return // refused — min-one invariant (LLD §16.2)
    this.#panesShown = next
    this.#panePrimary = next.has(primary) ? primary : (PANE_ORDER.find((p) => next.has(p)) ?? primary)
    this.#applyPaneVisibility(skipPillPressedFor)
  }

  /** The NARROW segment's write semantics (LLD §16.2): set primary AND ensure membership. Two real
   *  callers: the arm (below, `#rewireAuthoringContext`) and the header's own narrow segment `change`
   *  handler (S7-c's `#composeHeader`). */
  #setPanePrimary(pane: Pane): void {
    const next = new Set(this.#panesShown)
    next.add(pane)
    this.#setPanesShown(next, pane)
  }

  /**
   * Reflect the visibility state onto the composed anatomy — visibility ONLY (LLD §16.2), no arrangement
   * left to carry (the MD's consumer-written `selected` retired with the MD itself):
   *
   *  - `data-show` — the WHOLE shown set, space-joined in `PANE_ORDER` — and `data-primary` land on the
   *    pane holder, and the SHEET reads both against the holder's own inline-size: below the triple line
   *    exactly `data-primary`'s region paints; at and above it every `data-show` member does. Nothing here
   *    consults a width — a band crossing repaints with zero state written, the shell family's
   *    own-container-width law (the reason no ResizeObserver exists in this file).
   *  - S7-c (`#applyHeaderPaneState` below) mirrors pressed/selected state onto the header's pills AND
   *    the segment control here — programmatic writes, no event echo (ADR-0019), so flipping one
   *    rendering (e.g. a wide pill click) repaints the OTHER (the narrow segment's selection) without
   *    either side ever re-entering the visibility mutator.
   *
   * GH #666 — nothing here is armed-state dependent. The Co-pilot region is ONE card at every point of the
   * flow: unarmed its log is empty (GH #684 — no dedicated empty-state node), armed it shows the
   * transcript, and the swap is the log's own content, never a visibility flip between two boxes.
   */
  #applyPaneVisibility(skipPillPressedFor?: Pane): void {
    const holder = this.#paneHolder
    if (holder === null) return
    holder.setAttribute('data-show', PANE_ORDER.filter((p) => this.#panesShown.has(p)).join(' '))
    holder.setAttribute('data-primary', this.#panePrimary)
    this.#applyHeaderPaneState(skipPillPressedFor)
  }

  /**
   * S7-c (LLD §16.4 done-when: "pills and segment mirror ONE state") — the header half of
   * `#applyPaneVisibility`'s reflect, factored out so it is a no-op (never a throw) before `#composeHeader`
   * has run: `#panePills`/`#paneSegments` are empty/null pre-compose, and `#applyPaneVisibility` itself is
   * called once from within `#compose()` before any pill exists — the SAME "reflect is safe whenever it
   * runs" shape `#applyMasterStates` already relies on elsewhere in this file.
   *
   * Every write here is PROGRAMMATIC (`.pressed =` / `.value =` / `.glyph =`, never `.click()` or a
   * synthesized `toggle`/`change`) — ADR-0019's law, and the reason this can run unconditionally on every
   * visibility change without the mirror itself re-triggering the very handlers that call
   * `#setPanesShown`/`#setPanePrimary` in the first place — EXCEPT `skipPillPressedFor`'s own one pane
   * (see `#setPanesShown`'s doc comment): its `pressed` write is left to toggle.ts's own post-emit commit
   * line, which runs immediately after the wide pill's `toggle` listener returns and would otherwise race
   * a write landing here first (a measured double-flip, not a hypothetical one).
   */
  #applyHeaderPaneState(skipPillPressedFor?: Pane): void {
    for (const [pane, pill] of this.#panePills) {
      const shown = this.#panesShown.has(pane)
      if (pane !== skipPillPressedFor) pill.pressed = shown
      const stateIcon = this.#panePillStateIcons.get(pane)
      if (stateIcon) stateIcon.glyph = shown ? 'eye' : 'eye-slash'
    }
    if (this.#paneSegments) this.#paneSegments.value = this.#panePrimary
  }

  /** Arm, re-arm, or tear down the authoring context in response to an `authoringStore` change. A real
   *  identity change rebuilds only THIS context — the draft's own transcript is untouched, because the
   *  draft did not change (that is `store`'s job, and its GH #145 reset). */
  #rewireAuthoringContext(authoringStore: SettingsStore | undefined): void {
    const changed = this.#lastAuthoringStore !== authoringStore
    this.#lastAuthoringStore = authoringStore
    if (authoringStore === undefined) {
      // Leaving the flow: the conversation stays mounted (cheap, and re-entering is common) but is
      // emptied. ADR-0179 OQ4 — teardown NEVER forces navigation (LLD §16.2's own restatement): the
      // Co-pilot region is always-present, so clearing while the user is looking at it simply returns the
      // card to its unarmed, empty-log state (GH #684 — no dedicated empty-state node exists to re-seat).
      // GH #644 — the interview's own model memory leaves with it, alongside its visible transcript.
      if (changed) {
        this.#authoringConversation?.reset()
        this.#authoringHistory = []
      }
      this.#authoringUnsub?.()
      this.#authoringUnsub = undefined
      // GH #666 — the card stays; it returns to its empty-log state (and to the no-mint-path degrade, if
      // that is where this element stands). `reset()` above already cleared the transcript.
      this.#reflectAuthorEntry()
      return
    }
    this.#mountAuthoringConversation()
    if (changed) {
      this.#authoringConversation?.reset() // a DIFFERENT interviewer starts a fresh interview
      this.#authoringHistory = [] // GH #644 — and a fresh interview carries no prior interviewer's memory
      // GH #670 — the pre-arm bridge's job ends exactly here: its model half is already SEEDED into the
      // store being wired in below, its effort half is already on `#effort`, and from this moment the store
      // is the truth. Emptying it is what stops a pick from re-applying to a LATER arm (leave the flow, come
      // back, and the card starts neutral again) — the same no-leak law GH #145's reset carries.
      this.#preArm = {}
    }
    this.#syncAuthoringConversationConfig(authoringStore)
    // LLD §16.2 — arming the flow lands Co-pilot visible AND primary, at the one choke point every arm
    // path already crosses (the roster menu's "New agent → Generate" and the card's own composer-first
    // entry both converge here through the page's `createGeneratedAgent`). Replaces the retired
    // `#setPane('author')` line verbatim.
    this.#setPanePrimary('copilot')
  }

  /** The authoring conversation's own model roster/selection + master-switch reflection, read from the
   *  BUILDER's store (the `#syncConversationConfig`/`#applyMasterStates` pair, scoped to this context). */
  #syncAuthoringConversationConfig(store: SettingsStore | undefined): void {
    const conversation = this.#authoringConversation
    if (!conversation) return
    conversation.efforts = EFFORT_LEVELS
    conversation.effort = this.#effort
    const render = (): void => {
      const roster = modelRoster()
      conversation.models = roster.filter((m) => isModelIncluded(store?.get(MODELS_INCLUDED_KEY), m))
      conversation.model = sanitizeModel(store?.get('model'), roster)
      conversation.disabled = !isEnabledFlag(store?.get(AGENT_ENABLED_KEY))
    }
    render()
    // Props down, callbacks up: the picker writes the store, the store feeds the committed value back.
    // Its OWN teardown slot (the `#modelGridUnsub` precedent) — it must outlive `#rewireAllSections`'
    // clears of the shared map, which belong to the DRAFT's store, not this one.
    this.#authoringUnsub?.()
    this.#authoringUnsub = store?.subscribe?.((key) => {
      if (key === 'model' || key === MODELS_INCLUDED_KEY || key === AGENT_ENABLED_KEY) render()
    })
  }

  /** Build ONE entry-list section wired to THIS element's store — the ONE shared mechanism every
   *  instantiation (prompt sections + all four capability kinds) reuses (ADR-0132 cl.1). Registers the
   *  result in `#capabilitySections` (keyed by `kind`, prompt sections included) so
   *  `#rewireAllSections`/`#handleSubmit` can iterate uniformly. */
  #makeSection(kind: string, addLabel: string): EntryListSection {
    // ADR-0170 cl.3 — the catalog kind's toggle and delete are SELECTION writes against the one persisted
    // key, never per-entry flag writes (the entries store holds the roster; `A2UI_CATALOG_KEY` holds the
    // selection). Its add path stays the generic `validateNewEntry` one, unchanged.
    const isCatalog = kind === ENTRY_KINDS.catalog
    const section = mountEntryList(
      kind,
      addLabel,
      {
      onToggle: (id, enabled) =>
        isCatalog
          ? this.#selectCatalog(id, enabled)
          : this.#updateEntries(kind, (entries) => entries.map((e) => (e.id === id ? { ...e, enabled } : e))),
      onContentChange: (id, content) => this.#updateEntries(kind, (entries) => entries.map((e) => (e.id === id ? { ...e, content } : e))),
      // The `|| e.builtin` guard is defensive, mirroring entry-list.ts's own choice not to render a
      // delete affordance for a builtin entry in the first place (ADR-0132 Fork 4: toggle off, never
      // delete) — a stray call still cannot remove one.
      onDelete: (id) =>
        isCatalog
          ? this.#deleteCatalog(id)
          : this.#updateEntries(kind, (entries) => entries.filter((e) => e.id !== id || e.builtin)),
      onAdd: (input) => {
        // GH #564 — the catalog kind's entry id is a FOREIGN KEY into `A2UI_CATALOG_OPTIONS`: a collision
        // there is a duplicate (re-adding an already-registered catalog), never a name clash to suffix
        // around, so it rejects instead of minting an `-2` id the registry does not know. The collision
        // set is the PROJECTED roster (`readCatalogEntries` ensures the Default row), matching what the
        // picker disables against — a raw-store read would still accept a deletable Default duplicate
        // through a programmatic onAdd (review M1).
        const existing = isCatalog ? readCatalogEntries(this.store) : readEntries(this.store, kind)
        const result = validateNewEntry(existing, kind, input, { rejectOnCollision: isCatalog })
        if (!result.ok) {
          showAddError(section, result.error)
          return false
        }
        this.#updateEntries(kind, (entries) => [...entries, result.entry])
        return true
      },
      },
      // GH #47/#48 — this kind's library packs, captured at compose time (the sections' build-once law;
      // the `libraries` prop doc names the set-before-append requirement). The kind's master switch no
      // longer routes through here — it rides the kind's FOLD heading row instead (GH #225, slotted
      // `slot="summary"` per GH #226/ADR-0158); the section shell itself is headless (its fold summary
      // labels it).
      //
      // ADR-0170 cl.8 — the catalog kind alone suppresses BOTH authoring affordances: its entries key an
      // EXTERNAL registry (`A2UI_CATALOG_OPTIONS`), so there is nothing to author or edit — adds come
      // from the library menu, rows render as label + description + switch. Every other kind passes
      // `true`, which is exactly the absent-option default (byte-identical render). `rejectOnCollision`
      // (GH #564) rides the SAME `isCatalog` split as the `onAdd` handler above — the picker disables an
      // already-added catalog row instead of leaving it clickable-but-silently-rejected.
      { libraries: this.libraries?.[kind], customAdd: !isCatalog, contentField: !isCatalog, rejectOnCollision: isCatalog },
    )
    this.#capabilitySections.set(kind, section)
    return section
  }

  /** Read → transform → persist one kind's entry list. `store.subscribe` (armed by `#rewireAllSections`)
   *  is the PREFERRED re-render trigger — calling it here too would double-render (this element's own
   *  `set()` synchronously re-fires its own subscription before a direct call would even return).
   *  Component-reviewer MODERATE fix: `SettingsStore.subscribe` is OPTIONAL (store.ts) — a bring-your-own
   *  store that omits it would otherwise never re-render after this write (add/delete/toggle would
   *  persist but never visibly appear). Falls back to a direct render ONLY when this store genuinely has
   *  no `subscribe` to rely on. */
  #updateEntries(kind: string, updater: (entries: Entry[]) => Entry[]): void {
    const store = this.store
    const current = readEntries(store, kind)
    store?.set(entriesStoreKey(kind), updater(current))
    if (store !== undefined && store.subscribe === undefined) {
      this.#renders.get(kind)?.()
      // GH #419 — and re-derive the modality lint against the NEW content (a fixed section's warning must
      // clear on the edit that fixed it). A subscribing store gets this through its own notification.
      this.#applyMasterStates(store)
    }
  }

  // ── the catalog kind's SELECTION writes (ADR-0170 cl.3/cl.4) ─────────────────────────────────────────
  // The switch doubles as a radio here — the interaction-vocabulary stretch Kim ruled ON at ratification.
  // Every arm below writes AT MOST ONE key, and no arm ever writes a per-entry `enabled` flag: the roster
  // records membership, `A2UI_CATALOG_KEY` records the selection, and `readCatalogEntries` derives every
  // switch from the latter (so the section cannot disagree with the `catalogId` the runner threads).

  /** Toggling a catalog row (ADR-0170 cl.3). Four arms:
   *  · ON + registered ⇒ the selection MOVES (one write).
   *  · ON + unregistered (a dedup-suffixed duplicate row) ⇒ NO write — a VISIBLE no-op: the re-render
   *    snaps the switch back and the selection is unchanged. Never a silent write of the default.
   *  · OFF on the ACTIVE row ⇒ the DEFAULT id is written: the fail-closed law surfacing in the UI, so the
   *    selection visibly moves to the Default row rather than pretending a "none" state exists.
   *  · OFF on an already-inactive row ⇒ nothing to do (the row derives OFF already). */
  #selectCatalog(id: string, checked: boolean): void {
    const store = this.store
    const active = sanitizeCatalog(store?.get(A2UI_CATALOG_KEY))
    let next: string | undefined
    if (checked && isRegisteredCatalog(id)) next = id
    else if (!checked && id === active) next = DEFAULT_A2UI_CATALOG_ID
    if (next !== undefined) store?.set(A2UI_CATALOG_KEY, next)
    // Re-render DIRECTLY unless a real selection change is guaranteed to notify. Three cases need it, and
    // all three leave the flipped switch visually wrong otherwise — the UI lying about the one fact this
    // section exists to state:
    //  · nothing was written (a refused unregistered ON, or an already-OFF row) — no subscriber fires;
    //  · the written value EQUALS the previous one (toggling the ACTIVE row off when the active row IS
    //    the Default: the fail-closed law writes the default over itself) — `SettingsStore` promises no
    //    notification on a same-value `set`, so treat that arm as unwritten rather than depending on one
    //    implementation's behaviour;
    //  · the store has no `subscribe` at all (`#updateEntries`' own fallback discipline).
    if (next === undefined || next === active || store?.subscribe === undefined) this.#refreshCatalogSection()
  }

  /** Deleting a catalog row (ADR-0170 cl.4) — the ordinary roster delete, plus the default-id write when
   *  the deleted row was the ACTIVE one (the same fail-closed surfacing as an OFF toggle). Builtin rows
   *  keep the no-delete-affordance law (the `|| e.builtin` guard, as every other kind).
   *
   *  ORDER — key first, then roster: the LLD's §3 invariant is that "a subscriber never observes an active
   *  id absent from the roster". Writing the roster first would violate exactly that (between the two
   *  writes the key still names the just-deleted row, so the projection would derive ZERO switches ON —
   *  a visible flash of the broken invariant). Key-first keeps every intermediate state consistent: the
   *  Default row is guaranteed present by `readCatalogEntries`, so it is selectable at the instant the key
   *  moves. (This is the one place this build reads the LLD's stated INVARIANT over its ordering label.) */
  #deleteCatalog(id: string): void {
    const store = this.store
    if (id === sanitizeCatalog(store?.get(A2UI_CATALOG_KEY))) store?.set(A2UI_CATALOG_KEY, DEFAULT_A2UI_CATALOG_ID)
    this.#updateEntries(ENTRY_KINDS.catalog, (entries) => entries.filter((e) => e.id !== id || e.builtin))
    if (store?.subscribe === undefined) this.#refreshCatalogSection()
  }

  /** The catalog section's direct re-render + master/mirror re-derivation — for the two paths a store
   *  subscription cannot cover: a REFUSED toggle (nothing was written, so nothing notifies) and a store
   *  with no `subscribe` at all. Idempotent; safe to call on top of a subscription-driven render. */
  #refreshCatalogSection(): void {
    this.#renders.get(ENTRY_KINDS.catalog)?.()
    this.#applyMasterStates(this.store)
    if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
  }

  /** (Re-)render every section from `store`'s CURRENT contents + (re-)arm each kind's subscription — the
   *  `settings.ts`/TKT-0021 field-subscription precedent, generalized to five keys: a subscription dies
   *  with every disconnect and must be re-armed on every connect. Always renders (never skipped on a
   *  bare reconnect) — see the `connected()` doc comment for why that is safe for entries specifically.
   *  Also (re)populates `#renders` — `#updateEntries`' own no-subscribe fallback trigger. */
  #rewireAllSections(store: SettingsStore | undefined): void {
    for (const unsubscribe of this.#unsubscribes.values()) unsubscribe()
    this.#unsubscribes.clear()
    this.#renders.clear()

    const allKinds = [ENTRY_KINDS.promptSection, ...CAPABILITY_KINDS.map((c) => c.kind)]
    for (const kind of allKinds) {
      const section = this.#capabilitySections.get(kind)
      if (!section) continue
      // ADR-0170 cl.2 — the catalog kind renders from the PROJECTION (the ensured Default row + every
      // switch derived from the persisted selection), never the bare roster; and it re-renders on EITHER
      // of its two inputs, since the selection lives outside the entries store.
      const isCatalog = kind === ENTRY_KINDS.catalog
      const render = (): void => section.render(isCatalog ? readCatalogEntries(store) : readEntries(store, kind))
      this.#renders.set(kind, render)
      render()
      const unsubscribe = store?.subscribe?.((key) => {
        if (key === entriesStoreKey(kind) || (isCatalog && key === A2UI_CATALOG_KEY)) render()
      })
      if (unsubscribe) this.#unsubscribes.set(kind, unsubscribe)
    }
  }

  /** GH #143 — rebuild each CAPABILITY kind's add-from-library menu from `libraries`' CURRENT contents.
   *  Runs on every `connected()` effect tick (a fresh connect and a real `libraries` reassignment alike) —
   *  cheap (a handful of menu rows per kind) and idempotent, the `#rewireAllSections` precedent. Prompt
   *  sections never carry a library pack (only the four capability kinds do — `#makeSection`'s own
   *  `{ libraries: this.libraries?.[kind] }` wiring), so this loop is scoped to `CAPABILITY_KINDS`. */
  #updateLibraries(libraries: Record<string, readonly EntryLibraryPack[]> | undefined): void {
    for (const { kind } of CAPABILITY_KINDS) {
      this.#capabilitySections.get(kind)?.updateLibraries(libraries?.[kind] ?? [])
    }
  }

  /** Feed the composer's Models/Effort pickers from THIS element's own current config (the Figma
   *  chat-input refactor) — `models`/`efforts` are static option lists (no re-render cost in setting them
   *  every call); `model` re-derives from `store`'s CURRENT value (the SAME `sanitizeSelect`/fail-closed
   *  guard `#handleSubmit`'s own config snapshot uses) and re-arms a subscription so an EXTERNAL write to
   *  `model` (the settings pane's own field, another tab, TKT-0021's own precedent) also reflects into the
   *  picker — one source of truth, not a second parallel selection. Shares `#unsubscribes` with
   *  `#rewireAllSections` (called first, same effect tick) — that method's own unconditional clear-then-
   *  rebuild at the top of every call is what keeps this subscription from leaking across re-runs. */
  /** (Re)build the Model GRID from the store's CURRENT contents (Kim, 2026-07-19 rev.2): rows grouped
   *  by provider, each `[ label | include ui-switch | default ui-checkbox ]`. Wholesale rebuild per
   *  change (the entry-list render precedent — listeners are per-render, no re-arm bookkeeping).
   *  Semantics: the DEFAULT checkbox is radio-like (checking a row moves the default there; unchecking
   *  the current default is a no-op — a roster always has a default); the default row's include switch
   *  is locked ON (the default is always offered). */
  #renderModelGrid(): void {
    const host = this.#modelGrid
    const store = this.store
    if (!host) return
    const roster = modelRoster()
    const included = store?.get(MODELS_INCLUDED_KEY)
    const current = sanitizeModel(store?.get('model'), roster)
    host.replaceChildren()
    for (const provider of [...new Set(roster.map((m) => m.provider))]) {
      const providerLabel = document.createElement('div')
      providerLabel.setAttribute('data-part', 'model-provider')
      providerLabel.textContent = provider
      host.append(providerLabel)
      for (const model of roster.filter((m) => m.provider === provider)) {
        const row = document.createElement('div')
        row.setAttribute('data-part', 'model-row')
        if (model.id === current) row.setAttribute('data-default', '')

        const label = document.createElement('span')
        label.setAttribute('data-part', 'model-row-label')
        label.textContent = model.label
        label.title = model.id

        const include = document.createElement('ui-switch') as HTMLElement & { checked: boolean; disabled: boolean }
        include.setAttribute('data-part', 'model-include')
        include.setAttribute('aria-label', `Include ${model.label}`)
        include.checked = isModelIncluded(included, model)
        // The default is ALWAYS offered — its include switch locks on (checked + disabled).
        if (model.id === current) {
          include.checked = true
          include.disabled = true
        }
        include.addEventListener('change', () => {
          const record = { ...((store?.get(MODELS_INCLUDED_KEY) as Record<string, boolean> | undefined) ?? {}) }
          record[model.id] = include.checked
          store?.set(MODELS_INCLUDED_KEY, record)
          if (store !== undefined && store.subscribe === undefined) this.#renderModelGrid() // the #updateEntries no-subscribe fallback
        })

        const isDefault = document.createElement('ui-radio') as HTMLElement & { checked: boolean }
        isDefault.setAttribute('data-part', 'model-default')
        isDefault.setAttribute('name', 'model-default') // one logical radio SYSTEM across the provider groups
        isDefault.setAttribute('aria-label', `Default: ${model.label}`)
        isDefault.checked = model.id === current
        isDefault.addEventListener('change', () => {
          if (isDefault.checked) {
            // Moving the default also re-includes the row (the always-offered law) — one write each,
            // the store's own notifications re-render the grid (radio semantics fall out of the render).
            const record = { ...((store?.get(MODELS_INCLUDED_KEY) as Record<string, boolean> | undefined) ?? {}) }
            if (record[model.id] === false) {
              record[model.id] = true
              store?.set(MODELS_INCLUDED_KEY, record)
            }
            store?.set('model', model.id)
            if (store !== undefined && store.subscribe === undefined) this.#renderModelGrid()
          } else {
            // A grouped radio can't untoggle, but a STANDALONE Indicator-class radio can (pressActivation
            // toggles) — the restore guard keeps "a roster always has a default" true regardless.
            this.#renderModelGrid()
          }
        })

        row.append(label, include, isDefault)
        host.append(row)
      }
    }
  }

  #syncConversationConfig(store: SettingsStore | undefined): void {
    const conversation = this.#conversation
    if (!conversation) return
    conversation.efforts = EFFORT_LEVELS
    conversation.effort = this.#effort
    const renderModel = (): void => {
      // The picker offers the INCLUDED roster only (the Model grid's switches, 2026-07-19 rev.2); the
      // committed default always stays offered — the grid disables excluding it, and sanitizeModel
      // falls back to DEFAULT_MODEL_ID for anything off-roster.
      const roster = modelRoster()
      const included = store?.get(MODELS_INCLUDED_KEY)
      conversation.models = roster.filter((m) => isModelIncluded(included, m))
      conversation.model = sanitizeModel(store?.get('model'), roster)
    }
    renderModel()
    const unsubscribe = store?.subscribe?.((key) => {
      if (key === 'model' || key === MODELS_INCLUDED_KEY) renderModel()
    })
    if (unsubscribe) this.#unsubscribes.set('model', unsubscribe)
  }

  /** The turn loop. Reads the store's CURRENT entries at turn time (the live-apply mechanism itself — no
   *  propagation channel, just a fresh read): composes the enabled prompt sections into the final prompt
   *  string (`composeSystemPrompt`, fail-closed to `DEFAULT_SYSTEM_PROMPT_FALLBACK` if every section is
   *  disabled/empty), and gathers each capability kind's enabled entry labels (ADR-0132 cl.6).
   *
   *  Two arms (TKT-0052/ADR-0136): `agentTurn` UNSET ⇒ the deterministic stub (ADR-0131, byte-unchanged —
   *  the only path the static build ever carries); `agentTurn` SET (a DEV-only, site-page-injected runner)
   *  ⇒ a real live turn through the reused `dev-proxy-plugin.ts` trust boundary, single-shot into
   *  `setNote`/`finalize` (LLD Q3), degrading a thrown/rejected runner via `handle.fail()` (LLD Q5, no crash,
   *  no silent swallow). Both arms append the completed exchange to `#history`. */
  #handleSubmit(text: string, origin: 'chat' | 'copilot'): void {
    // ADR-0178 cl.5 — every read below is against the DRIVING context's store. With the flow inactive
    // that resolves to `this.store` and today's conversation, so this method's behaviour is unchanged.
    // GH #644 — `history` is this call's context-scoped array (test vs. authoring); every read/append
    // below goes through it rather than `this.#history` directly, so the two contexts' model memory never
    // cross-pollinate.
    const { store, conversation, history } = this.#contextFor(origin)
    if (!conversation) return
    const schema = this.schema ?? defaultAgentConfigSchema
    // Vision rev.5 — the Agent master switch ("active/available or not", Kim's ruling): the composer is
    // already busy-disabled via `conversation.disabled`, so this is the belt (a programmatic submit).
    if (!isEnabledFlag(store?.get(AGENT_ENABLED_KEY))) return

    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    const systemPrompt = composeSystemPrompt(sections)
    // A kind whose MASTER switch is off contributes NOTHING — the section-header toggle wins over
    // per-entry toggles (vision rev.5, generalizing the old tools-only boolean).
    const enabledLabels = (kind: string): string[] =>
      isEnabledFlag(store?.get(kindEnabledKey(kind)))
        ? readEntries(store, kind)
            .filter((e) => e.enabled)
            .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
            .map((e) => e.label)
        : []

    const config: AgentConfigSnapshot = {
      name: typeof store?.get('name') === 'string' ? (store.get('name') as string) : 'Untitled agent',
      model: sanitizeModel(store?.get('model'), modelRoster()),
      temperature: sanitizeNumber(schema, 'temperature', store?.get('temperature'), 0.5),
      toolsEnabled: isEnabledFlag(store?.get(kindEnabledKey(ENTRY_KINDS.tool))),
      systemPrompt,
      skills: enabledLabels(ENTRY_KINDS.skill),
      workflows: enabledLabels(ENTRY_KINDS.workflow),
      resources: enabledLabels(ENTRY_KINDS.resource),
      tools: enabledLabels(ENTRY_KINDS.tool),
    }

    // The SURFACE arm (TKT-0076) — takes precedence when armed AND at least ONE structured modality is on
    // (vision rev.6: switching BOTH structured modalities off bypasses even an armed runner — the prose
    // arm answers instead). genui-surface SPEC-R11/B2 widens this from "A2UI on" alone to "A2UI OR GenUI
    // on": the same producer stream now carries either kind, so the structured arm must run whenever
    // either is enabled — GenUI defaults OFF, so this is a zero-regression widening for every existing
    // caller that never enables it.
    if (this.agentSurfaceTurn !== undefined && (isEnabledFlag(store?.get(SURFACE_A2UI_KEY)) || isGenuiSurfaceEnabled(store?.get(SURFACE_GENUI_KEY)))) {
      // GH #63 — a typed intent is a fresh user gesture: re-arm the error-loop budget.
      this.#consecutiveErrorTurns = 0
      this.#errorLoopHalted = false
      this.#runSurfaceTurn({ kind: 'intent', text }, origin)
      return
    }

    // setNote (not ingestLine): ingestLine expects A2UI wire JSONL (surfaceIdOf/categoryOf parse it) — a
    // plain prose reply is exactly what setNote's contract is for ("rendered verbatim at finalize()").
    const handle = conversation.beginAgentTurn()
    const agentTurn = this.agentTurn

    // Stub arm — byte-unchanged (ADR-0131). The only path the static build carries.
    if (agentTurn === undefined) {
      const reply = runStubAgentTurn(text, config)
      handle.setNote(reply)
      handle.finalize()
      this.#recordTurn(history, text, reply)
      this.#logTurn('stub', { text, config }, { reply })
      return
    }

    // Live arm (DEV-only, injected). The system prompt is rebuilt FRESH here (with the capability
    // projection, ADR-0136 Fork 3) and never stored in history; `history` carries PRIOR turns only, so a
    // mid-conversation config switch applies next-turn-only by construction (Q4). The in-flight busy-lock
    // (TKT-0034, auto-tracked off beginAgentTurn) disables the composer until finalize()/fail() runs.
    const request: AdminTurnRequest = {
      text,
      system: this.#personaSystemFor(store, sections),
      model: config.model,
      effort: this.#effort,
      // ADR-0168 cl.5 / GH #402 — the prose arm forwards enablement too (it was the one live arm the
      // tool toggle never reached: a silent no-op). LLD-C7: the wire carries entry IDS, not labels —
      // `#enabledToolIds` is the SAME master-gated fresh read the surface arm uses, so the two arms can
      // never drift. NOT `config.tools`: that stays the enabled LABELS (its own doc comment's contract),
      // which the stub arm and the turn logger want for human display.
      integrations: this.#enabledToolIds(store),
      history: [...history],
    }
    void (async () => {
      try {
        const reply = await agentTurn(request)
        handle.setNote(reply)
        handle.finalize()
        this.#recordTurn(history, text, reply)
        this.#logTurn('live', request, { reply })
      } catch (err) {
        // A network/provider fault, a non-2xx proxy response, or the runner's 120s timeout: surface it
        // visibly (an error narration entry + a "⚠ …" system bubble, composer re-enabled) — never a crash
        // or a silent swallow (SPEC-R6 AC3 path, the shipped ui-conversation affordance). The failed
        // exchange is NOT recorded into history — there is no assistant reply to pair. It IS logged to
        // the Dialog Turns view (a failure is exactly what a payload inspector exists to show).
        const message = err instanceof Error ? err.message : String(err)
        handle.fail(message)
        this.#logTurn('live', request, { error: message })
      }
    })()
  }

  /** One SURFACE turn (TKT-0076/ADR-0138): stream the injected runner's typed events — every `line` is a
   *  validated A2UI wire message fed to `ingestLine` (fresh surfaceId ⇒ a new inline ui-surface-host in
   *  this turn's bubble; known ⇒ routed to its ORIGINAL host, ADR-0129 — the Croupier's one-table game);
   *  the peeled `note` renders via setNote at finalize. The persona + model are FRESH store reads (the
   *  live-apply law); the runner owns the transport-side session/history (SPEC-N1 — the component never
   *  sees a transport type). Errors surface through the fail path, exactly the text arm's discipline.
   *
   *  `origin` (GH #662) is a SEPARATE parameter, deliberately not a member of `turn`: `turn` is the wire
   *  shape handed verbatim to the injected runner (SPEC-N1), and which composer a turn came from is this
   *  element's own routing business, not the runner's. It selects the context (`#contextFor`) and nothing
   *  else. */
  #runSurfaceTurn(turn: { kind: 'intent'; text: string } | { kind: 'client'; message: unknown }, origin: 'chat' | 'copilot'): void {
    // ADR-0178 cl.5 — as in `#handleSubmit`: with the flow inactive, `store`/`conversation` resolve to
    // exactly today's values and `session` stays absent, so the built request is byte-identical.
    const { store, conversation, session } = this.#contextFor(origin)
    const surfaceTurn = this.agentSurfaceTurn
    if (!conversation || surfaceTurn === undefined) return
    // The store this turn is FENCED to. Captured here, at turn start, and compared by IDENTITY when a
    // patch arrives — the bankroll mirror's own captured-store posture.
    const drivingStore = store
    // The Agent master switch gates surface turns too — BOTH kinds: a typed intent and a surface action
    // click (an inactive agent runs nothing, Kim's ruling).
    if (!isEnabledFlag(store?.get(AGENT_ENABLED_KEY))) return
    const a2uiOn = isEnabledFlag(store?.get(SURFACE_A2UI_KEY))
    const genuiOn = isGenuiSurfaceEnabled(store?.get(SURFACE_GENUI_KEY))
    // genui-surface.spec.md v0.5 §11 (GH #316/ADR-0162) — a FRESH store read (the live-apply law); a stale
    // `true` left over from a prior session can never take effect while the modality itself is off (the
    // schema doc comment's own promise — `SURFACE_GENUI_DOGFOOD_KEY`).
    const dogfoodOn = genuiOn && isGenuiDogfoodEnabled(store?.get(SURFACE_GENUI_DOGFOOD_KEY))
    // genui-surface.spec.md SPEC-R10/R11 (independent-review MODERATE fix): a `client` message's OWN
    // modality gates it — a genui action click is inert while GenUI is off (even if A2UI is on), and
    // symmetrically an A2UI action click is REFUSED while A2UI is off (even if GenUI is on). A lingering
    // frame/host from a NOW-disabled modality must never spawn a hidden NETWORK turn — the exact
    // contradiction `SURFACE_GENUI_KEY`'s own doc comment already promised and this gate previously broke
    // (an OR across both switches let a disabled modality's stale click still run). A typed `intent`
    // targets NO specific modality — it needs at least ONE structured modality on (unchanged, vision
    // rev.6/B2).
    if (turn.kind === 'client') {
      const wantsGenui = isGenuiActionClientMessage(turn.message)
      if (wantsGenui && !genuiOn) return
      if (!wantsGenui && !a2uiOn) {
        // GH #418 — the reported defect: this click used to no-op SILENTLY (no error, no signal anywhere)
        // because the surface it targets should never have rendered as interactive in the first place
        // while A2UI is off. Never spawn a real network turn (the modality really is off, unchanged), but
        // DO surface a one-line visible refusal on the clicked surface's own bubble — `fail()` only
        // narrates (conversation.ts), it starts no work — so this stays a client-only, zero-network path.
        conversation.beginAgentTurn({ intoSurface: clientMessageSurfaceId(turn.message) }).fail(A2UI_OFF_ACTION_REFUSAL)
        return
      }
    } else if (!a2uiOn && !genuiOn) {
      return
    }
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    const request = {
      turn,
      personaSystem: this.#personaSystemFor(store, sections),
      model: sanitizeModel(store?.get('model'), modelRoster()),
      // The composer's Effort picker selection (see AdminSurfaceTurnRequest.effort) — the same dial the
      // plain-chat arm (`#handleSubmit`'s `AdminTurnRequest`) already threads.
      effort: this.#effort,
      // Vision rev.6 — the catalog picker's sanitized selection (see AdminSurfaceTurnRequest.catalogId).
      // M-D SPEC-R5 — widened to the EFFECTIVE catalogId: the persona's local-pattern-set selection
      // (A2UI_LOCAL_PATTERNS_KEY), composed onto the base ONLY when its fragment actually targets that
      // base; a selection targeting some other base fails closed to the base alone (AC3), never a
      // hard error and never the wrong derived id.
      catalogId: resolveEffectiveCatalogId(sanitizeCatalog(store?.get(A2UI_CATALOG_KEY)), store?.get(A2UI_LOCAL_PATTERNS_KEY)),
      // GH #49 / ADR-0168 cl.2 — the ENABLED tool entries' IDS (never their labels: LLD-C7 decoupled the
      // two), master-gated on the tool kind's switch: the proxy intersects with its registry; a
      // non-registry id is inert. A FRESH store read (the live-apply law), shared with the prose arm.
      integrations: this.#enabledToolIds(store),
      // genui-surface.spec.md SPEC-R10/R11 — a FRESH store read (the live-apply law): `enabled` gates
      // whether the runner composes the genui teaching block at all; `sourceBody`, when present, is the
      // D3-picked `pattern-source` entry's `content` VERBATIM (never a pack id — `pickedPatternSource`
      // already resolved the single pick from whichever entries are enabled, first-by-order).
      genui: {
        enabled: genuiOn,
        sourceBody: genuiOn ? pickedPatternSource(readEntries(store, ENTRY_KINDS.patternSource))?.content : undefined,
        // genui-surface.spec.md v0.5 §11 (SPEC-R10 amended clause, GH #316/ADR-0162) — threaded the SAME
        // fresh-read way `sourceBody` is; `dogfoodOn` is already `false` whenever `genuiOn` is `false`.
        dogfood: dogfoodOn,
      },
      // GH #418 — the A2UI Surface Option's OWN fresh store read, threaded so the runner's
      // `ProduceOptions.a2uiEnabled` can compose ZERO A2UI-grammar/catalog bytes when this client has no
      // A2UI renderer available this turn. Before this field existed, the composed prompt ignored the
      // toggle entirely (the reported defect: a GenUI-only turn taught the model the FULL A2UI catalog).
      a2uiEnabled: a2uiOn,
      // ADR-0178 cl.5 / SPEC-R30 — BOTH fields exist only for the authoring context, so an inactive flow
      // (and every pre-S3 caller) builds the byte-identical request it always did. `authoring` is a FRESH
      // read of the DRIVING store's gate (the live-apply law); `session` keeps this interview's producer
      // history separate from the draft's test chat.
      ...(session === undefined ? {} : { session, authoring: isAuthoringSurfaceEnabled(store?.get(SURFACE_AUTHORING_KEY)) }),
    }
    // TKT-0079 — an action-click/error turn RESUMES the bubble owning its surface (the game loop stays in
    // one card); a typed intent stays a fresh bubble (its reply must not appear above the question).
    const handle = conversation.beginAgentTurn(
      turn.kind === 'client' ? { intoSurface: clientMessageSurfaceId(turn.message) } : undefined,
    )
    // GH #354 — the conversation generation this turn belongs to, captured BEFORE the (dogfood-only) asset
    // await below; see `#conversationEpoch`.
    const epoch = this.#conversationEpoch
    void (async () => {
      const wireLines: string[] = []
      let note: string | undefined
      // GH #418 — set when the stream carries an A2UI wire line while `a2uiOn` is false: the composed
      // prompt no longer teaches A2UI grammar in this state (system-prompt.ts), so this should be rare
      // (model non-compliance only) — but if it happens, this client must never render it (it would only
      // grow into ANOTHER silently-inert surface, the click-gate above's whole point) — never-render is
      // the chosen client-plane policy, paired with ONE visible notice rather than a silent drop.
      let a2uiRefused = false
      // ADR-0178 cl.2 — what the patch arm did this turn, for the log (never an error surface).
      const patchReports: PatchReport[] = []
      let patchIgnored = false
      // ADR-0182 cl.5 — the Builder-mission's own declared open-sections view, last-write-wins per turn
      // exactly like `note` (a turn carries at most one leading meta-line either way).
      let planChecklist: string | undefined
      try {
        // GH #354 — the ONE await the lazy asset pair introduces is HOISTED HERE, ahead of the first
        // consumed event, so `mountGenui` below stays SYNCHRONOUS inside the stream loop exactly as it was
        // when the pair was a static module constant. That is what keeps the mount ordering intact: were
        // the await inside the loop, a concurrent turn (a deferred client turn, see onClientMessage) could
        // mount into the SAME surfaceId while this turn's chunk was still in flight and then be overwritten
        // by this turn's older html when it resolved — a stale-asset/stale-html inversion that cannot arise
        // when the pair is in hand before any event is read. Dogfood-OFF awaits NOTHING (the `import()` is
        // never reached and no extra microtask is introduced — the OFF path is timing-identical to before).
        //
        // DEGRADE, never fail (Kim's 2026-07-29 ruling; ADR-0139 cl.5's own outcome law — see
        // `loadDogfoodAssets`): a failed or timed-out load leaves `assets` undefined, the turn runs exactly
        // as a dogfood-OFF turn would — PROMPT AND RENDER BOTH — and the reason rides out with this turn's
        // note so the user is told rather than left wondering why the toggle did nothing. The catch is
        // scoped to the LOAD alone: a fault in the turn itself still takes the outer `handle.fail` path,
        // unchanged (that path deliberately omits `assetWarning` — a turn that failed outright has a more
        // important thing to say than why its frame would have been unstyled).
        //
        // The PROMPT degrades with the assets (review finding, 2026-07-29 — the first cut degraded only
        // half of it): `request` has not been issued yet at this point, so clearing `dogfood` here is what
        // makes this a real degrade. Left true, `system-prompt.ts` would still inject the dogfood teaching
        // + inventory and the model would author `<ui-*>` fleet markup into a frame with no component
        // definitions and no fleet CSS — text-bearing controls would fall back to bare unstyled text, but
        // anything that builds its content in JS (ui-calendar/ui-slider/ui-select) would render NOTHING.
        // That is strictly WORSE than a dogfood-OFF turn, which asks for plain HTML and gets it. Clearing
        // it also keeps `#logTurn` honest: a turn that ran without the pair records `dogfood: false`.
        let assets: SandboxFrameAssets | undefined
        let assetWarning: string | undefined
        if (dogfoodOn) {
          try {
            assets = await loadDogfoodAssets()
          } catch (cause) {
            request.genui.dogfood = false
            assetWarning = `⚠ agent-ui components could not be loaded for this frame — rendering it without them (${cause instanceof Error ? cause.message : String(cause)})`
          }
        }
        // A persona switch (a real `store` reassignment) resets the thread — the bubble this handle points
        // at is gone. Abandon rather than mount a frame into a conversation that no longer exists (the
        // ADR-0139 cl.5 `#mountGen` precedent). Deliberately NOT gated on `isConnected`: a disconnect here
        // is an ordinary layout crossing (TKT-0085) that the composed shell and log SURVIVE, so bailing on
        // it would drop output that reaches the user today.
        if (epoch !== this.#conversationEpoch) return
        for await (const event of surfaceTurn(request)) {
          if (event.kind === 'note') note = event.note
          else if (event.kind === 'progress') handle.progress(event.progress) // ADR-0146 F1 — live narration
          else if (event.kind === 'genui') {
            // genui-surface.spec.md SPEC-R8/PRD-G8 — a PARALLEL mount path, never `ingestLine` (A2UI-
            // shaped; a genui line carries neither `createSurface` nor any envelope key `surfaceIdOf`
            // parses). `mountGenui` mirrors `ingestLine`'s own fresh/known bubble routing for a
            // structurally different host (`ui-sandbox-frame`, not `ui-surface-host`).
            // genui-surface.spec.md v0.5 §11 (GH #316/ADR-0162) — the frame-mount asset pass-through, on
            // BOTH arms of `routeGenui` (a fresh mount and a rebuild-in-place of a known surfaceId).
            // `assets` is resolved from THIS turn's fresh `dogfoodOn` read (captured before the stream
            // started, GH #354's hoisted await) — a toggle flipped mid-turn can no more change this turn's
            // decision than it could when the pair was a module constant; it applies to the NEXT turn.
            handle.mountGenui(event.surfaceId, event.html, assets)
          } else if (event.kind === 'patch') {
            // ── the CONSUMPTION CONDITION (ADR-0178 cl.2, narrowed by Kim's §15 option-(b) ruling) ──────
            // CONJUNCTIVE, and both conjuncts are load-bearing:
            //
            //   1. the store-identity FENCE — this turn must be driven by `authoringStore` itself, i.e. it
            //      is a turn of the dedicated authoring interview. A patch volunteered on ANY other turn,
            //      a test chat included, is never consumed, even with the gate on.
            //   2. the GATE, read FRESH from the driving store at RECEIPT (never the value captured when
            //      the request was built — a gate switched off mid-turn takes effect on the rest of it).
            //
            // The fence exists because values merge last-writer-wins, and the patchable value set
            // includes `SURFACE_AUTHORING_KEY` itself: without it, a consumed self-patch could arm a
            // persona's own gate — model-authored writes widening the model's future write authority.
            // The fence never REPLACES the gate; a persona that has not opted in is still never patched.
            //
            // The target is always `this.store`, the DRAFT — never the driving store, which holds the
            // interviewer's own configuration.
            const fenced = drivingStore !== undefined && drivingStore === this.authoringStore
            const gateOn = isAuthoringSurfaceEnabled(drivingStore?.get(SURFACE_AUTHORING_KEY))
            const target = this.store
            if (fenced && gateOn && target !== undefined) {
              // Applied MID-STREAM, so the panes hydrate while the turn is still streaming — the live
              // feedback the whole flow exists to give. Every write lands on a key class with a shipped
              // store subscription, so no re-render machinery is needed here (ADR-0178 cl.2).
              patchReports.push(applyPersonaPatch(target, event.patch, { models: modelRoster(), schema: this.schema ?? defaultAgentConfigSchema }))
            } else {
              patchIgnored = true // logged below; zero writes, no error surface (SPEC-R30's degrade law)
            }
          } else if (event.kind === 'plan') {
            // ADR-0182 cl.4/cl.5 — the ALREADY-SHIPPED `plan` arm, reused verbatim; consumption here is
            // pure rendering (no store write, unlike the `patch` arm above), so no fence/gate check is
            // needed — a plan arriving on a turn this client never asked the model to produce is simply
            // formatted the same as one it did (the wire is gate-blind, SPEC-R20/SPEC-R31).
            planChecklist = formatPlanChecklist(event.plan)
          } else if (event.kind === 'line') {
            wireLines.push(event.line)
            // GH #418 — an A2UI wire line only renders (`ingestLine`) while A2UI is actually on this
            // turn; the toggle's OFF state must never render a surface whose actions the click-gate above
            // would then refuse (the reported "renders, looks alive, dies on click" defect). The raw line
            // still rides into `wireLines`/`#logTurn` below — visible in the Dialog Turns inspector for
            // debugging a non-compliant model reply — it just never reaches the live surface host.
            if (a2uiOn) {
              handle.ingestLine(event.line)
              // GH #525 (review MAJOR 1b) — kept in lockstep with the SAME lines that just reached the
              // real renderer: a createSurface it actually rendered is now "known" (the bankroll mirror
              // may trust an updateDataModel naming it); a deleteSurface retires it, mirroring the real
              // renderer's own SurfaceStore teardown (`#onDeleteSurface`).
              const lifecycle = surfaceLifecycleOf(event.line)
              if (lifecycle?.kind === 'create') this.#knownSurfaceIds.add(lifecycle.surfaceId)
              else if (lifecycle?.kind === 'delete') this.#knownSurfaceIds.delete(lifecycle.surfaceId)
            } else a2uiRefused = true
          }
        }
        // GH #354 — the degraded-assets reason rides out WITH this turn's own note rather than replacing
        // it (`setNote` is last-write-wins and `finalize` re-renders whatever it holds, so a bare
        // `setNote(warning)` would be overwritten by, or overwrite, the agent's prose). Same `⚠ ` marker
        // `handle.fail`'s system bubble uses. It is also logged, so the Dialog Turns inspector shows why a
        // dogfood-ON turn rendered a bare frame.
        // GH #418 — the a2ui-refused notice rides the SAME "append, never replace" composition: the
        // agent's own note (if any) stays intact, with the refusal appended so the never-silent law holds
        // even when the model DID say something narratable alongside the line this client refused.
        // ADR-0182 cl.5 — the plan checklist rides the SAME "append, never replace" fold, one more
        // member alongside the a2ui-refused notice: the agent's own note (if any) stays intact.
        const outgoing = [note, assetWarning, a2uiRefused ? A2UI_OFF_INGEST_NOTICE : undefined, planChecklist]
          .filter((text) => text !== undefined)
          .join('\n\n')
        if (outgoing !== '') handle.setNote(outgoing)
        handle.finalize()
        // GH #525 (design call 1, 2026-08-07) — "NO new tool — zero API surface, rides the existing turn
        // wiring": the mirror reads the SAME raw wire lines this turn already captured for narration/
        // disclosure (`wireLines`), never a new a2ui read (SPEC-N1's own discipline — this file declares
        // its OWN seams rather than importing the renderer's internal surface store, exactly like
        // `clientMessageSurfaceId`/`categoryOf` already inspect wire envelopes structurally). A turn that
        // never touched `/bankroll`, or whose figure fails to sanitize, writes nothing — fail-closed,
        // never a stale-but-wrong overwrite of whatever the store already holds.
        //
        // GH #525 (review MAJOR 1a) — gated on `a2uiOn` too, the SAME condition `handle.ingestLine` above
        // is gated on: `wireLines` collects every raw line REGARDLESS of the toggle (GH #418's own
        // debugging-visibility law), but a line the toggle refused was never rendered — persisting a
        // figure nothing rendered would silently disagree with what the player actually saw.
        if (a2uiOn && isBankrollCapable(store?.get(BANKROLL_CAPABLE_KEY))) {
          const bankroll = bankrollFromWireLines(wireLines, this.#knownSurfaceIds)
          if (bankroll !== undefined) store?.set(BANKROLL_KEY, bankroll)
        }
        this.#logTurn('surface', request, {
          note,
          lines: wireLines,
          ...(assetWarning === undefined ? {} : { assetWarning }),
          // ADR-0178 cl.2 — observability without an error surface: what a consumed patch actually wrote
          // (including every DROP), or the bare fact that one arrived and was refused. Both keys are
          // absent on a turn that carried no patch, so an ordinary turn's record is unchanged.
          ...(patchReports.length === 0 ? {} : { patch: patchReports.length === 1 ? patchReports[0] : patchReports }),
          ...(patchIgnored ? { patchIgnored: true } : {}),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        handle.fail(message)
        this.#logTurn('surface', request, { error: message, lines: wireLines })
      }
    })()
  }

  /** The turn's composed persona, for whichever context is driving.
   *
   *  The test context gets exactly today's composition. The AUTHORING context gets the interviewer's own
   *  persona PLUS a fresh serialization of the draft's current state (ADR-0178 cl.4 / LLD §2): steering an
   *  interview toward completion is impossible without seeing what is already established — and because
   *  the user may hand-edit the same draft between turns, that projection has to be re-read per turn
   *  rather than accumulated from what the model itself has patched. This is the host side of SPEC-R29's
   *  incremental merge law. */
  #personaSystemFor(store: SettingsStore | undefined, sections: readonly Entry[]): string {
    const persona = composeLiveSystemPrompt(sections, this.#capabilityGroups(store), this.#bankrollForPrompt(store))
    const isAuthoringContext = this.authoringStore !== undefined && store === this.authoringStore
    return isAuthoringContext ? `${persona}\n\n${draftStateBlock(this.store)}` : persona
  }

  /** Each capability kind's raw store slice + its live `##` group heading + its MASTER switch (vision
   *  rev.5), for `composeLiveSystemPrompt` (which does the enabled-filter/sort/master-gate itself).
   *  EXCLUDES `pattern-source` (genui-surface SPEC-R10/R11): that kind's picked entry composes through
   *  the DEDICATED genui prompt block (`#runSurfaceTurn`'s own `pickedPatternSource` read) instead of the
   *  generic `## Pattern sources available to you` capability projection — including it here too would
   *  double-inject the identical body in one prompt (the exact ADR-0091 §4 defect class).
   *  EXCLUDES `catalog` too (ADR-0170 cl.5): the catalog selection threads as `catalogId` on the wire (the
   *  server picks the registered catalog and the producer stamps it, ADR-0169 cl.3/4) — never as prompt
   *  prose. Projecting the roster here would teach the model about catalogs it cannot choose between. */
  #capabilityGroups(store: SettingsStore | undefined): LiveCapabilityGroup[] {
    return CAPABILITY_KINDS.filter(({ kind }) => kind !== ENTRY_KINDS.patternSource && kind !== ENTRY_KINDS.catalog).map(({ kind, liveHeading }) => ({
      kind,
      heading: liveHeading,
      entries: readEntries(store, kind),
      enabled: isEnabledFlag(store?.get(kindEnabledKey(kind))),
    }))
  }

  /** GH #525 (bootstrap fix, 2026-08-07 live-proof finding) — the bankroll teaching input for the composed
   *  prompt at turn start, applied at EVERY `composeLiveSystemPrompt` call site (the prose arm, the surface
   *  arm, the Context: System snapshot) so the three can never read three different answers to "does this
   *  turn teach /bankroll right now". `undefined` unless the persona opted in AND A2UI is currently on —
   *  the SAME `a2uiOn` condition the post-turn mirror itself gates on (`#runSurfaceTurn`, below):
   *  modality-correct, no A2UI renderer available this turn ⇒ no data-model path to teach. Capable+A2UI-on
   *  ALWAYS returns an object (never gated on whether a figure is stored yet — the bootstrap fix itself:
   *  the path must be taught BEFORE a first value ever exists, or nothing would ever settle there). */
  #bankrollForPrompt(store: SettingsStore | undefined): LiveBankrollState | undefined {
    if (!isBankrollCapable(store?.get(BANKROLL_CAPABLE_KEY))) return undefined
    if (!isEnabledFlag(store?.get(SURFACE_A2UI_KEY))) return undefined
    return { stored: sanitizeBankroll(store?.get(BANKROLL_KEY)) }
  }

  /** ADR-0168 cl.2 / LLD-C7 — the ENABLEMENT WIRE projection, shared by BOTH live arms (`#handleSubmit`'s
   *  prose request and `#runSurfaceTurn`'s surface request) so they can never drift into two different
   *  answers for "what is enabled right now". A FRESH store read (the live-apply law), master-gated on the
   *  tool kind's switch (the SAME switch that gates the kind's prompt projection).
   *
   *  It forwards each enabled entry's `id`, NEVER its `label`. The id is the stable wire vocabulary the
   *  host's `resolveIntegrations` intersects against its registry; the label is human display text that a
   *  user may freely edit. They were the same string until this slice — forwarding the label worked only
   *  by that coincidence, so a prettier label silently disarmed the tool. The component stays entirely
   *  generic here: it knows nothing of registries or integration ids, it just forwards the stable key
   *  instead of the display name. A non-registry id is inert downstream (the fail-closed intersection). */
  #enabledToolIds(store: SettingsStore | undefined): string[] {
    if (!isEnabledFlag(store?.get(kindEnabledKey(ENTRY_KINDS.tool)))) return []
    return readEntries(store, ENTRY_KINDS.tool)
      .filter((e) => e.enabled)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .map((e) => e.id)
  }

  // ── vision rev.5: master-state application + the Context tabs' renderers ────────────────────────────

  /** (Re-)apply the master states + (re-)render both Context tabs + (re-)arm their shared store
   *  subscription — the Agent System view reads nearly every key (name/model/temperature, the master toggles,
   *  all five entry lists) and writes are commit-time (never per-keystroke), so an unfiltered wholesale
   *  re-render per store write is the honest cheap option. Its OWN teardown slot (the #modelGridUnsub
   *  precedent — it must outlive `#rewireAllSections`' clears); re-armed per store (re)assignment via
   *  the connected() effect, torn down in disconnected(). */
  #rewireContext(store: SettingsStore | undefined): void {
    this.#applyMasterStates(store)
    this.#renderContextSystem()
    this.#renderContextTurns()
    this.#contextUnsub?.()
    this.#contextUnsub = store?.subscribe?.(() => {
      this.#applyMasterStates(store) // keeps the header switches honest on EXTERNAL writes too
      this.#renderContextSystem()
    })
  }

  /** Reflect every master switch's STORED state onto its control + its gated surface — the Agent switch
   *  onto `conversation.disabled` (an inactive agent takes no input), each kind switch onto its section
   *  host's `data-kind-disabled` dim. Called at rewire time, from the context subscription (external
   *  writes), and directly from each switch's own change listener (the no-subscribe fallback). */
  #applyMasterStates(store: SettingsStore | undefined): void {
    const agentOn = isEnabledFlag(store?.get(AGENT_ENABLED_KEY))
    if (this.#agentSwitch) this.#agentSwitch.checked = agentOn
    if (this.#conversation) this.#conversation.disabled = !agentOn
    const a2uiOn = isEnabledFlag(store?.get(SURFACE_A2UI_KEY))
    for (const { kind } of CAPABILITY_KINDS) {
      // ADR-0170 cl.5 — the catalog kind has NO master switch, so its dim derives from the A2UI MODALITY
      // instead (inheriting the retired select's own rationale: choosing a catalog for a surface that
      // can't run is noise, not configuration). Reading `kindEnabledKey('catalog')` here would answer a
      // phantom always-ON master for a key nothing ever writes.
      const on = kind === ENTRY_KINDS.catalog ? a2uiOn : isEnabledFlag(store?.get(kindEnabledKey(kind)))
      const kindSwitch = this.#kindSwitches.get(kind) // undefined for the catalog kind — nothing to reflect
      if (kindSwitch) kindSwitch.checked = on
      this.#capabilitySections.get(kind)?.host.toggleAttribute('data-kind-disabled', !on)
    }
    // Vision rev.6 — the Surface Options rows reflect their stored state the same way.
    const markdownOn = isEnabledFlag(store?.get(SURFACE_MARKDOWN_KEY))
    if (this.#surfaceMarkdownSwitch) this.#surfaceMarkdownSwitch.checked = markdownOn
    // GH #468 — every path that can make Markdown mode ON runs through this method (connect, a rewire, the
    // toggle's own change listener, an external store write), so firing the lazy preload HERE — rather than
    // scattering a call at each individual call site — covers all of them in one place, ahead of any reply
    // that would actually need `<ui-markdown>`. A no-op (memoized) once loaded/in flight; OFF fires nothing.
    if (markdownOn) preloadMarkdownRenderer()
    if (this.#surfaceA2uiSwitch) this.#surfaceA2uiSwitch.checked = a2uiOn
    const genuiOn = isGenuiSurfaceEnabled(store?.get(SURFACE_GENUI_KEY))
    if (this.#surfaceGenuiSwitch) this.#surfaceGenuiSwitch.checked = genuiOn
    if (this.#surfaceGenuiDogfoodSwitch) {
      this.#surfaceGenuiDogfoodSwitch.checked = isGenuiDogfoodEnabled(store?.get(SURFACE_GENUI_DOGFOOD_KEY))
      this.#surfaceGenuiDogfoodSwitch.disabled = !genuiOn
    }
    // ADR-0174 cl.1/OF3 — the planner-stage modality row reflects its own stored state the same way.
    if (this.#surfacePlannerSwitch) this.#surfacePlannerSwitch.checked = isPlannerSurfaceEnabled(store?.get(SURFACE_PLANNER_KEY))
    // ADR-0178 cl.3 — the authoring gate reflects its own stored state the same way.
    if (this.#surfaceAuthoringSwitch) this.#surfaceAuthoringSwitch.checked = isAuthoringSurfaceEnabled(store?.get(SURFACE_AUTHORING_KEY))
    // GH #525 — the bankroll group is entirely HIDDEN for a persona that never opted in
    // (`BANKROLL_CAPABLE_KEY`) — there is no in-between "visible but nothing to do" state the way an OFF
    // modality still has, so this is `hidden`, never a `data-disabled` dim.
    if (this.#bankrollItem) this.#bankrollItem.hidden = !isBankrollCapable(store?.get(BANKROLL_CAPABLE_KEY))
    // GH #419 — the prompt-section lint is derived from the SAME two stored modality flags this method
    // just reflected, so it re-derives here: every path that can flip a Surface Option ends in a call to
    // this method (the row's own change listener, the store subscription, a rewire), which is exactly when
    // a warning must appear or clear.
    this.#applyPromptLint(store, { a2ui: a2uiOn, genui: genuiOn })
  }

  /** GH #419 — stamp the non-blocking modality warning onto whichever ENABLED prompt sections name a
   *  modality that is OFF (`prompt-lint.ts` owns the vocabulary + the decision). NOTHING else changes:
   *  the composed prompt, the request, and the turn are byte-identical whether a warning shows or not —
   *  this is authoring feedback, never a gate. */
  #applyPromptLint(store: SettingsStore | undefined, modalities: { a2ui: boolean; genui: boolean }): void {
    const section = this.#capabilitySections.get(ENTRY_KINDS.promptSection)
    if (!section) return
    section.showNotices(lintPromptSections(readEntries(store, ENTRY_KINDS.promptSection), modalities))
  }

  /** Rebuild the Context: System view from the store's CURRENT contents: one `Agent` section (open by
   *  default — the vision frame's expanded JSON preview) carrying the compiled config + the EXACT live
   *  system prompt a turn would send, then one section per capability kind (closed by default — the
   *  frame's caret-right rows). Each section is a heading-row fold + ONE JSON card (GH #222 — no outer
   *  wrapper card, no card-in-card). Wholesale rebuild per store change; each open/closed fold survives
   *  via a pre-rebuild state capture (`data-item` keyed). */
  #renderContextSystem(): void {
    const host = this.#contextSystemHost
    if (!host) return
    const store = this.store
    const schema = this.schema ?? defaultAgentConfigSchema
    const openStates = new Map<string, boolean>()
    for (const el of host.querySelectorAll<HTMLElement & { open: boolean }>('[data-part="context-item"]')) {
      openStates.set(el.getAttribute('data-item') ?? '', el.open)
    }
    const items: HTMLElement[] = []
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    items.push(
      contextItem(
        'agent',
        'Agent',
        {
          name: typeof store?.get('name') === 'string' ? (store.get('name') as string) : 'Untitled agent',
          model: sanitizeModel(store?.get('model'), modelRoster()),
          temperature: sanitizeNumber(schema, 'temperature', store?.get('temperature'), 0.5),
          effort: this.#effort,
          active: isEnabledFlag(store?.get(AGENT_ENABLED_KEY)),
          surface: {
            markdown: isEnabledFlag(store?.get(SURFACE_MARKDOWN_KEY)),
            a2ui: isEnabledFlag(store?.get(SURFACE_A2UI_KEY)),
            catalog: sanitizeCatalog(store?.get(A2UI_CATALOG_KEY)),
            // genui-surface.spec.md SPEC-R11/B2 — live: the modality's on/off state + the D3-picked
            // pattern-source's label, when one is picked (undefined otherwise — the degradation law).
            genui: isGenuiSurfaceEnabled(store?.get(SURFACE_GENUI_KEY)),
            genuiSource: pickedPatternSource(readEntries(store, ENTRY_KINDS.patternSource))?.label,
            // ADR-0174 cl.1/OF3 — the planner-stage modality's own on/off state, the same introspection law.
            planner: isPlannerSurfaceEnabled(store?.get(SURFACE_PLANNER_KEY)),
            // ADR-0178 cl.3 — the authoring gate's own on/off state, the same introspection law.
            authoring: isAuthoringSurfaceEnabled(store?.get(SURFACE_AUTHORING_KEY)),
          },
          systemPrompt: composeLiveSystemPrompt(sections, this.#capabilityGroups(store), this.#bankrollForPrompt(store)),
        },
        openStates.get('agent') ?? true,
      ),
    )
    for (const { kind, label } of CAPABILITY_KINDS) {
      // ADR-0170 cl.5 — the catalog kind has no master switch: its `enabled` cell is the SAME
      // `SURFACE_A2UI_KEY` read that dims its section (an unwritten `kindEnabledKey('catalog')` would read
      // as a phantom always-ON master here). Its entries come from the PROJECTION, so this introspection
      // view shows exactly what the section shows — the ensured Default row and the one derived selection.
      const isCatalog = kind === ENTRY_KINDS.catalog
      items.push(
        contextItem(
          kind,
          label,
          {
            enabled: isCatalog ? isEnabledFlag(store?.get(SURFACE_A2UI_KEY)) : isEnabledFlag(store?.get(kindEnabledKey(kind))),
            entries: (isCatalog ? readCatalogEntries(store) : readEntries(store, kind)).map((e) => ({
              label: e.label,
              enabled: e.enabled,
              description: e.description,
            })),
          },
          openStates.get(kind) ?? false,
        ),
      )
    }
    host.replaceChildren(...items)
  }

  /** Rebuild the Dialog Turns view (the Context: Dialog tab) from `#turnLog`, NEWEST FIRST with
   *  zero-padded descending numbers (the vision frame's 04→01). The newest turn's fold defaults open;
   *  older folds keep whatever state the user left them in (turn-number keyed capture). */
  #renderContextTurns(): void {
    const host = this.#contextTurnsHost
    if (!host) return
    const openStates = new Map<string, boolean>()
    for (const el of host.querySelectorAll<HTMLElement & { open: boolean }>('[data-part="context-turn"]')) {
      openStates.set(el.getAttribute('data-item') ?? '', el.open)
    }
    const items: HTMLElement[] = []
    const newest = this.#turnLog.at(-1)
    for (let i = this.#turnLog.length - 1; i >= 0; i -= 1) {
      const turn = this.#turnLog[i]!
      const label = String(turn.n).padStart(2, '0')
      const item = contextItem(`turn-${turn.n}`, label, { arm: turn.arm, request: turn.request, response: turn.response }, openStates.get(`turn-${turn.n}`) ?? turn === newest)
      item.setAttribute('data-part', 'context-turn')
      items.push(item)
    }
    host.replaceChildren(...items)
  }

  /** Append one turn's request/response to the Dialog Turns ring (every arm, failures included) and
   *  re-render the view. Bounded at TURN_LOG_CAP — the oldest records fall off. */
  #logTurn(arm: 'stub' | 'live' | 'surface', request: unknown, response: unknown): void {
    this.#turnCounter += 1
    this.#turnLog.push({ n: this.#turnCounter, arm, request, response })
    if (this.#turnLog.length > TURN_LOG_CAP) this.#turnLog.splice(0, this.#turnLog.length - TURN_LOG_CAP)
    this.#renderContextTurns()
  }

  /** Append one completed exchange to the multi-turn history (both arms). GH #644 — `history` is the
   *  CALLER's context-scoped array (`#handleSubmit`'s `#contextFor()` read), never `this.#history`
   *  directly, so a turn always lands in the transcript it was actually composed from. */
  #recordTurn(history: AdminTurn[], text: string, reply: string): void {
    const turns: AdminTurn[] = [
      { role: 'user', content: text },
      { role: 'assistant', content: reply },
    ]
    history.push(...turns)
  }

  /**
   * ADR-0179 OQ4 (LLD §2) — register the page's "start the guided flow" path, invoked by the Author card's
   * own composer-first entry (`#startFromFirstMessage`). A CALLBACK registration, never a CustomEvent
   * (SPEC-R5's law, and the `UIConversationElement.onSubmit` idiom this copies): the mint path is
   * page-owned (`createGeneratedAgent` — a roster mint plus a `builderStore()` arm), and this component
   * cannot import site code without inverting the DAG.
   *
   * Registering OPENS the flow entry — the unarmed card stops being `disabled`; a component with no
   * registration shows an unavailable card (the static-build degrade; GH #684 — no copy rides inside it
   * any more). Last registration wins — one page owns one admin.
   *
   * Safe BEFORE or AFTER connect, and that is a fix, not a nicety (GH #666 defect 1): the real page
   * registers on a detached element and appends it later, so this call used to land on a not-yet-built
   * card and the reveal was silently lost — Kim's live Author column showed copy with no verb.
   * `#reflectAuthorEntry` reads `#generateRequest` at build time, so both orders open.
   *
   * GH #670 — the callback receives a `GenerateSeed`: the Model pick the user made on the unarmed card,
   * for the page to SEED the store it is about to mint with (`builderStore(seed?.model)`). Optional on both
   * ends — a page that ignores the argument keeps exactly its previous behaviour, and an untouched picker
   * sends nothing, leaving the minted store's own default in charge. GH #681 — this is now the ONLY
   * arm-with-a-seed path: the roster (...) menu reaches the same page-side mint path directly (for "arm
   * without typing anything"), not through this callback — from outside any specific card it has no
   * pre-arm pick to carry, so its own call sends no seed and the minted store's own default stands.
   */
  onGenerateRequest(callback: (seed?: GenerateSeed) => void): void {
    this.#generateRequest = callback
    this.#reflectAuthorEntry()
  }

  // ── S7-c (LLD §16.3, frozen seam shapes) — the unified header bar's six registration seams ───────────
  // All six follow `onGenerateRequest`'s shipped semantics verbatim: callback registration, never a
  // CustomEvent (SPEC-R5); last registration wins (a bare field reassignment); safe before OR after
  // connect (the GH #666 order rule — each setter's own reflect call, mirrored by `#compose`'s build-time
  // call, covers both orders). The DEGRADE diverges deliberately from `onGenerateRequest`'s own precedent
  // (stated, not silently inherited): that seam DISABLES its card when unregistered (a disabled
  // conversation still shows its own copy); these HIDE their affordance entirely — the right degrade for a
  // bare action button/menu item, which has no copy to show disabled (LLD §16.3).

  /**
   * Push the current agent roster into the header's `agent-select` — data-in, not a callback, and
   * RE-CALLABLE (a page re-pushes after a mint/import, LLD §16.3). Rebuilds the select's OWN roster
   * options wholesale from `entries` (the select's own dynamic-adoption seam, select.md's Slots note,
   * handles a later call without a disconnect/reconnect) and sets `value` to `activeId` (or '' — nothing
   * selected) as a silent programmatic write (no `select` emission, ADR-0019 — only a real user pick
   * fires that).
   */
  setAgentRoster(entries: readonly AgentRosterEntry[], activeId?: string): void {
    this.#pendingRoster = { entries, activeId }
    this.#applyAgentRoster()
  }

  /**
   * `setAgentRoster`'s own build-time/call-time reflect (the `#reflectAuthorEntry` shape) — a no-op
   * before `#composeHeader` has run OR before `setAgentRoster` has ever been called; both call sites
   * (`setAgentRoster` itself, and `#compose`'s tail) are safe to call unconditionally.
   *
   * A real bug once lived here, root-caused post-review: `select.replaceChildren()` wipes EVERY host
   * child, and `ui-select` creates its own trigger/aria-label span/listbox as direct children of the
   * host itself (select.ts's `#ensureParts`) — a full wipe destroyed the control's own internal parts
   * on the FIRST call, not merely the roster options, so `onAgentSelect` could never fire again (no
   * trigger left to click, and any freshly-adopted options landed in a listbox already severed from the
   * control's own machinery). The fix removes ONLY the previously-pushed `[role='option']` nodes — real
   * descendants of the host (adopted into the listbox by the control's own TKT-0026 machinery, but still
   * findable via a plain descendant query, no private-field reach-in needed) — leaving the trigger/aria-
   * label span/listbox untouched, then re-adopts the new set through the SAME public, documented seam
   * every other author-supplied option already uses (`select.append(...)`, select.md's Slots note: "No
   * disconnect/reconnect is required to add or remove options").
   */
  #applyAgentRoster(): void {
    const select = this.#agentSelectEl
    const pending = this.#pendingRoster
    if (select === null || pending === undefined) return
    for (const option of [...select.querySelectorAll('[role="option"]')]) option.remove()
    for (const entry of pending.entries) {
      const option = document.createElement('div')
      option.setAttribute('role', 'option')
      option.setAttribute('value', entry.id)
      option.textContent = entry.label
      select.append(option)
    }
    select.value = pending.activeId ?? ''
  }

  /** Register the header roster's own pick handler — the select's `select` event stays CONTAINED
   *  (stopPropagation, wired at build time in `#composeHeader`); this is the seam a page reads it through. */
  onAgentSelect(callback: (id: string) => void): void {
    this.#agentSelectCallback = callback
  }

  /** Register the header's "New Agent" affordance (the wide labeled button AND its narrow `+` icon-only
   *  twin, LLD §16.1's collapse — ONE seam drives both renderings). Unregistered ⇒ both are HIDDEN (never
   *  disabled) — a bare "+" with nothing to do is not a legible affordance the way a disabled labeled
   *  button is. */
  onNewAgentRequest(callback: () => void): void {
    this.#newAgentRequest = callback
    this.#applyActionAvailability()
  }

  /** Register the header's Import affordance (the wide labeled button AND the narrow `•••` menu's own
   *  "Import" item). Unregistered ⇒ both HIDE independently of Export's own registration state (each
   *  action seam degrades on its own — LLD §16.3's "the right degrade for a bare action... menu item"). */
  onImportRequest(callback: () => void): void {
    this.#importRequest = callback
    this.#applyActionAvailability()
  }

  /** Register the header's Export affordance — the Import seam's shape, mirrored. */
  onExportRequest(callback: () => void): void {
    this.#exportRequest = callback
    this.#applyActionAvailability()
  }

  /**
   * Register "Reset Agent"'s mint path. S7-d (LLD §16.4) places this seam's CONSUMER — the Settings
   * model-grid fold's own `reset-agent-button` (`#compose`, above) — reflected through the SAME
   * `#applyActionAvailability` funnel every other action seam already uses: HIDE, not disable, while
   * unregistered (LLD §16.3's stated divergence from `onGenerateRequest`'s card-disable precedent).
   */
  onResetRequest(callback: () => void): void {
    this.#resetRequest = callback
    this.#applyActionAvailability()
  }

  /**
   * The action-seam HIDE degrade (LLD §16.3/§16.4), applied per affordance — never a blanket disable. New
   * Agent's two renderings share one registration; Import/Export each degrade independently (a wide
   * button AND its own narrow menu item); the `•••` trigger itself hides only when BOTH narrow items it
   * would open onto are gone (an openable-but-empty menu is not a real affordance either); Reset Agent
   * (S7-d) is its own independent affordance, outside the header entirely (the Settings model-grid fold).
   * Safe to call before `#composeHeader`/`#compose` has built anything (every ref is nullable) and is
   * `#compose`'s own build-time reflect call, the `#reflectAuthorEntry` shape.
   */
  #applyActionAvailability(): void {
    const newAgentHidden = this.#newAgentRequest === undefined
    if (this.#newAgentWideBtn) this.#newAgentWideBtn.hidden = newAgentHidden
    if (this.#newAgentNarrowBtn) this.#newAgentNarrowBtn.hidden = newAgentHidden
    const importHidden = this.#importRequest === undefined
    const exportHidden = this.#exportRequest === undefined
    if (this.#importActionBtn) this.#importActionBtn.hidden = importHidden
    if (this.#exportActionBtn) this.#exportActionBtn.hidden = exportHidden
    if (this.#overflowImportItem) {
      this.#overflowImportItem.hidden = importHidden
      this.#overflowImportItem.setAttribute('aria-disabled', String(importHidden))
    }
    if (this.#overflowExportItem) {
      this.#overflowExportItem.hidden = exportHidden
      this.#overflowExportItem.setAttribute('aria-disabled', String(exportHidden))
    }
    if (this.#overflowTriggerBtn) this.#overflowTriggerBtn.hidden = importHidden && exportHidden
    if (this.#resetAgentBtn) this.#resetAgentBtn.hidden = this.#resetRequest === undefined
  }

  // ── protected test seams (the split.ts/slider-multi.ts precedent) ────────────────────────────────────

  /** LLD §16.2 — set the visibility model's whole state from a test probe: `setPaneSeam(pane)` retires
   *  with `#pane`/`#setPane` (there is no single active place any more to set). `#setPanesShown` stays
   *  private by contract; `protected` keeps this off the PUBLIC element, exactly the
   *  `setPaneSeam`/`setModeSeam` precedent — a consumer cannot reach it, so no API is widened and no
   *  descriptor row is owed. S7-c's real pills/segments (`#composeHeader`) are the honest end-to-end path
   *  now (a probe can click a pill / select a segment directly); this seam remains the shortest path for a
   *  test that only cares about the RESULTING state, not the interaction that produced it. */
  protected setPaneVisibilitySeam(shown: readonly Pane[], primary: Pane): void {
    this.#setPanesShown(shown, primary)
  }

  /** GH #145 — every piece of PER-PERSONA conversation state, cleared together on a real store
   *  reassignment: the visible chat log + any open A2UI surfaces (`ui-conversation.reset()`, the same
   *  method a consumer calls for a user-facing "start over"), the live-request `#history` ring (so a
   *  freshly-selected persona's first turn carries no prior persona's exchanges), and the Dialog Turns
   *  log (`#turnLog`/`#turnCounter`) the Context: Dialog tab's `#renderContextTurns` reads — the caller
   *  (the connected() effect) re-renders that view immediately after via `#rewireContext`. */
  #resetConversationState(): void {
    this.#conversation?.reset()
    // ADR-0178 cl.5 — the authoring transcript belongs to the DRAFT too (it is the interview that
    // produced it), so a real persona switch clears both. A mode FLIP clears neither: that is the
    // distinction this method's caller draws, and the whole reason a flip is not a store reassignment.
    this.#authoringConversation?.reset()
    this.#history = []
    // GH #644 — the authoring context's own model memory belongs to the DRAFT too, exactly like its
    // transcript above: a real persona switch must clear both, or the next persona's first authoring turn
    // would still carry the PREVIOUS persona's interview as prior context.
    this.#authoringHistory = []
    this.#turnLog = []
    this.#turnCounter = 0
    this.#knownSurfaceIds.clear() // GH #525 — a new persona's surfaces are unrelated to the old ones
    // GH #670 — and so is an unarmed Author pick: a Model/Effort choice made while describing THIS persona's
    // successor must not silently seed the next persona's interview. The card re-paints neutral pickers on
    // the `#reflectAuthorEntry` the caller's `#rewireAuthoringContext` already runs.
    this.#preArm = {}
    this.#conversationEpoch += 1 // GH #354 — invalidate any surface turn waiting on its lazy dogfood chunk
  }
}

/** TKT-0079 — the surface a client message belongs to (`action.surfaceId` / the error union's
 *  VALIDATION_FAILED arm), for routing the follow-up turn into that surface's OWNING bubble.
 *  `undefined` (e.g. INVALID_FUNCTION_CALL) ⇒ the fresh-bubble path. */
/** The ONE fold-host shape both tab families share (GH #222/GH #225): a chrome-free `ui-disclosure`
 *  whose summary IS the section heading (the shared heading register, chevron on the heading row) —
 *  `part` picks the flavor (`context-item`/`settings-item`; a Dialog turn overwrites its to
 *  `context-turn`), `key` lands in `data-item` (query/open-state addressing). */
function foldItem(part: string, key: string, summary: string, open: boolean): HTMLElement & { open: boolean } {
  const item = document.createElement('ui-disclosure') as HTMLElement & { open: boolean }
  item.setAttribute('data-part', part)
  item.setAttribute('data-item', key)
  item.setAttribute('summary', summary)
  if (open) item.setAttribute('open', '')
  return item
}

/** One Context-tab section (vision rev.5): a `ui-disclosure` labeled `summary` whose body is the
 *  pretty-printed JSON of `value` — the frame's `[ header + caret | mono JSON preview ]` shape. Built
 *  fresh per render (the wholesale-rebuild law); `data-item` keys the open-state capture across
 *  rebuilds. GH #222 (amending vision rev.5's card-in-card realization): the fold host is CHROME-FREE —
 *  its summary renders as a plain section heading (the shared heading register, chevron kept: the
 *  folds are load-bearing, the Agent item carries the full composed system prompt and every dialog turn
 *  carries its whole request payload) and the JSON body is the section's ONE card. */
function contextItem(key: string, summary: string, value: unknown, open: boolean): HTMLElement {
  const item = foldItem('context-item', key, summary, open)
  const pre = document.createElement('pre')
  pre.setAttribute('data-part', 'context-json')
  pre.textContent = JSON.stringify(value, null, 2)
  item.append(pre)
  return item
}

/** One Settings-tab section (GH #225 — Kim's ruling, the GH #222 pattern applied back to the config
 *  column): a fold whose body is the section's content card(s). Config sections default OPEN, always —
 *  Settings is an EDITING surface (a closed-by-default section would hide the very affordances the tab
 *  exists for; Context's newest-open/older-closed logic is a reading-order choice specific to that log
 *  view). Built ONCE (the sections' build-once law), never rebuilt — fold state lives in the live DOM
 *  for the element's lifetime, so none of Context's rebuild-capture machinery applies here, and (like
 *  Context) the state is deliberately session-ephemeral: the store persists the agent's CONFIG, never
 *  its view state. */
function settingsItem(key: string, summary: string, ...content: HTMLElement[]): HTMLElement {
  const item = foldItem('settings-item', key, summary, true)
  item.append(...content)
  return item
}

function clientMessageSurfaceId(message: unknown): string | undefined {
  const m = message as { action?: { surfaceId?: unknown }; error?: { surfaceId?: unknown }; genuiAction?: { surfaceId?: unknown } } | null
  if (m && typeof m === 'object' && m.action && typeof m.action.surfaceId === 'string') return m.action.surfaceId
  if (m && typeof m === 'object' && m.error && typeof m.error.surfaceId === 'string') return m.error.surfaceId
  // genui-surface.spec.md SPEC-R8 — a genui `action` click bubbles as `{genuiAction:{surfaceId,...}}`
  // (conversation.ts's `mountGenui` routing) — TKT-0079's same-bubble-resume law applies identically: the
  // agent's reply to a GenUI action stays in the SAME card, never a fresh one above the click.
  if (m && typeof m === 'object' && m.genuiAction && typeof m.genuiAction.surfaceId === 'string') return m.genuiAction.surfaceId
  return undefined
}

/** genui-surface.spec.md SPEC-R10/R11 — `true` iff `message` is a genui bridge-action bubble
 *  (`{genuiAction:{...}}`, conversation.ts's `mountGenui` routing), never a real A2UI client message
 *  (`action`/`error`). Used ONLY to pick which modality's OWN switch gates a `kind:'client'` surface turn
 *  — an independent review's MODERATE finding: a message's kind must match its OWN modality flag, never
 *  an OR across both (a lingering genui frame's click must stay inert while GenUI is off, symmetrically
 *  for a lingering A2UI surface's action while A2UI is off — SURFACE_GENUI_KEY's own doc comment promises
 *  exactly this: "no hidden turns from a disabled modality"). */
function isGenuiActionClientMessage(message: unknown): boolean {
  return typeof message === 'object' && message !== null && 'genuiAction' in message
}

/** GH #525 (review MAJOR 1b) — `{kind:'create'|'delete', surfaceId}` for a createSurface/deleteSurface
 *  envelope, `undefined` for anything else/unparseable — the SAME structural inspection technique
 *  `categoryOf`/`surfaceIdOf` (conversation.ts) already use, narrowed to the two lifecycle edges the
 *  bankroll mirror's own known-surfaceId bookkeeping needs (`#knownSurfaceIds`, above). */
function surfaceLifecycleOf(line: string): { kind: 'create' | 'delete'; surfaceId: string } | undefined {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof msg !== 'object' || msg === null) return undefined
  const m = msg as Record<string, { surfaceId?: unknown } | undefined>
  if (m.createSurface && typeof m.createSurface.surfaceId === 'string') return { kind: 'create', surfaceId: m.createSurface.surfaceId }
  if (m.deleteSurface && typeof m.deleteSurface.surfaceId === 'string') return { kind: 'delete', surfaceId: m.deleteSurface.surfaceId }
  return undefined
}

/** GH #525 (design call 1, 2026-08-07; review MAJOR 1b) — the `/bankroll` pointer's value at the END of
 *  this turn's own raw wire-line stream, read the SAME structural way `categoryOf`/`surfaceIdOf`
 *  (conversation.ts) and `clientMessageSurfaceId` (above) already inspect A2UI envelopes — never a new
 *  a2ui read. Two shapes of `updateDataModel` can touch the pointer: a direct `path:'/bankroll'` set, or
 *  a whole-document replace (`path` absent/`''`/`'/'`, the SAME root alias `#onUpdateDataModel` resolves,
 *  renderer.ts) whose `value.bankroll` carries it — EITHER shape is counted only when its OWN `surfaceId`
 *  is a member of `knownSurfaceIds` (the real renderer's own `#onUpdateDataModel` no-ops for a surfaceId
 *  its `SurfaceStore` never created, renderer.ts:318-319 — an envelope naming an unknown/hallucinated id
 *  must degrade the SAME way here, not mirror a figure nothing actually holds). The LAST touch across the
 *  whole turn wins (a later line supersedes an earlier one, matching the real renderer's own
 *  last-write-wins merge); a turn that never touches the pointer on a known surface, or whose final
 *  figure fails `sanitizeBankroll`, returns `undefined` — "no mirror write this turn", never a throw and
 *  never a stale-but-wrong figure. */
function bankrollFromWireLines(lines: readonly string[], knownSurfaceIds: ReadonlySet<string>): number | undefined {
  let last: unknown
  let touched = false
  for (const line of lines) {
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (typeof msg !== 'object' || msg === null) continue
    const body = (msg as Record<string, unknown>).updateDataModel
    if (typeof body !== 'object' || body === null) continue
    const { surfaceId, path, value } = body as { surfaceId?: unknown; path?: unknown; value?: unknown }
    if (typeof surfaceId !== 'string' || !knownSurfaceIds.has(surfaceId)) continue
    if (path === '/bankroll') {
      last = value
      touched = true
    } else if (path === undefined || path === '' || path === '/') {
      if (typeof value === 'object' && value !== null) {
        last = (value as Record<string, unknown>).bankroll
        touched = true
      }
    }
  }
  return touched ? sanitizeBankroll(last) : undefined
}

if (!customElements.get('ui-agent-admin')) customElements.define('ui-agent-admin', UIAgentAdminElement)
